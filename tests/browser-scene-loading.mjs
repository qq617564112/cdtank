import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
if (!endpoint) throw new Error('Usage: node tests/browser-scene-loading.mjs <Chromium CDP WebSocket URL> [web origin]');
const ws = new WebSocket(endpoint);
await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
let sequence = 0;
const pending = new Map();
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, sessionId}));
  });
}
async function evaluate(session, expression) {
  const result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}, session);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitUntil(session, expression) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      return await evaluate(session, `(async()=>{const deadline=Date.now()+45000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed')) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Page navigation timeout');
}
const pages = [];
try {
  const {targetId} = await command('Target.createTarget', {url: process.argv[3] ?? 'http://127.0.0.1:5173', newWindow: true});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  pages.push({targetId});
  await waitUntil(sessionId, `document.querySelector('#tank')?.options.length===21`);
  const result=await evaluate(sessionId, `(async()=>{
    const source=await(await fetch('/src/main.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);const {ScenePreview}=await import('/src/assets/scenes/scene-preview.ts');
    const scene=EngineStore.LastCreatedScene,preview=new ScenePreview(scene,scene.activeCamera);
    const entries=await(await fetch('/scene-placements.json')).json(),entry=entries.find(e=>e.id==='0002');
    const paths=new Set([...entry.records,...entry.castles].filter(p=>p.asset).map(p=>'/'+p.asset));
    const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;
    const requests=new WeakMap();let active=0,maximum=0,started=0,ended=0;
    XMLHttpRequest.prototype.open=function(method,url,...rest){requests.set(this,new URL(String(url),location.href).pathname);return open.call(this,method,url,...rest);};
    XMLHttpRequest.prototype.send=function(...args){
      if(paths.has(requests.get(this))){active++;started++;maximum=Math.max(maximum,active);this.addEventListener('loadend',()=>{active--;ended++;},{once:true});}
      return send.apply(this,args);
    };
    try{
      const pending=preview.load('0002');
      const deadline=Date.now()+30000;
      while(started<4&&Date.now()<deadline)await new Promise(r=>setTimeout(r,1));
      if(started<4)throw Error('No parallel source model requests');
      preview.clear();
      if(await pending!=='')throw Error('Cancelled parallel load completed');
      await new Promise(r=>setTimeout(r,100));
      if(scene.transformNodes.some(n=>n.name.startsWith('placement-')))throw Error('Cancelled parallel scene leaked placements');
      const start=performance.now();await preview.load('0002');
      const loadMs=performance.now()-start;
      const expected=[...entry.records,...entry.castles].filter(p=>p.asset).length;
      if(scene.transformNodes.filter(n=>n.name.startsWith('placement-')).length!==expected)throw Error('Full source placement count');
      if(maximum<2)throw Error('Source model requests remained serial');
      preview.clear();
      if(scene.transformNodes.some(n=>n.name.startsWith('placement-')))throw Error('Completed scene leaked placements');
      return {status:'PASS',maximumParallelModelRequests:maximum,started,ended,sourcePlacements:expected,loadMs,cancelledDuringModelLoads:true};
    }finally{XMLHttpRequest.prototype.open=open;XMLHttpRequest.prototype.send=send;preview.clear();}
  })()`);
  await writeFile('recovery/output/browser-scene-loading.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
}finally{for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId});ws.close();}
