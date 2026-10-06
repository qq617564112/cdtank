import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
if (!endpoint) throw new Error('Usage: node tests/browser-cpu-entry.mjs <Chromium CDP WebSocket URL>');
const directory = await mkdtemp(join(tmpdir(), 'cdtank-cpu-entry-'));
const database = join(directory, 'accounts.sqlite');
let server;
async function start() {
  let log='';
  server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],
    {env:{...process.env,PORT:'3132',ACCOUNT_DB_PATH:database},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',data=>{log+=String(data);});server.stderr.on('data',data=>{log+=String(data);});
  const deadline=Date.now()+15000;
  while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
}
async function stop() {
  if(server?.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
}
await start();
const vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',
  server:{port:5191,host:'127.0.0.1',proxy:{'/game':{target:'ws://127.0.0.1:3132',ws:true,rewrite:()=> '/'}}}});
await vite.listen();
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
      return await evaluate(session, `(async()=>{const deadline=Date.now()+45000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#room-map-info')?.value+' tanks='+document.querySelector('#tank')?.options.length+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed')) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Page navigation timeout');
}
const pages = [];
const contexts = [];
const state = session => evaluate(session, `JSON.parse(document.querySelector('#battle-status').dataset.world)`);
try {
  const {browserContextId} = await command('Target.createBrowserContext');
  contexts.push(browserContextId);
  const {targetId} = await command('Target.createTarget', {url:'http://127.0.0.1:5191',browserContextId});
  const {sessionId} = await command('Target.attachToTarget',{targetId,flatten:true});
  pages.push({targetId,sessionId});
  await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
  await waitUntil(sessionId, `document.querySelector('#start-cpu') && !document.querySelector('#start-cpu').disabled`);
  assert(await evaluate(sessionId, `!document.querySelector('#viewer') && !document.querySelector('#model')`),
    'Production page does not include the asset inspection controls');
  assert(await evaluate(sessionId, `performance.getEntriesByType('resource').every(entry =>
    !/asset-viewer|(?:mv3|pol|cvd)-conversion\.json/.test(entry.name))`),
    'Production startup does not load the viewer or inspection catalogs');
  await evaluate(sessionId, `(async()=>{
    const source=await(await fetch('/src/main.ts')).text();
    const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);EngineStore.LastCreatedEngine.setHardwareScalingLevel(3);
    EngineStore.LastCreatedEngine.resize();
  })()`);
  await command('Network.enable',{},sessionId);
  await command('Network.setBlockedURLs',{urls:['*combat-catalog.json*']},sessionId);
  await evaluate(sessionId, `document.querySelector('#start-cpu').click()`);
  const loading=await evaluate(sessionId, `({disabled:document.querySelector('#start-cpu').disabled,busy:document.querySelector('#start-cpu').getAttribute('aria-busy'),text:document.querySelector('#cpu-status').value})`);
  assert.equal(loading.disabled,true);assert.equal(loading.busy,'true');
  await waitUntil(sessionId, `document.querySelector('#cpu-status').value.includes('CPU 对局失败') && !document.querySelector('#start-cpu').disabled`);
  const failure=await evaluate(sessionId, `({text:document.querySelector('#cpu-status').value,world:document.querySelector('#battle-status').dataset.world,controlsHidden:document.querySelector('#battle-controls').hidden})`);
  assert.equal(failure.controlsHidden,false);assert(!failure.world);
  await command('Network.setBlockedURLs',{urls:[]},sessionId);
  await evaluate(sessionId, `document.querySelector('#start-cpu').click()`);
  await waitUntil(sessionId, `(()=>{const raw=document.querySelector('#battle-status').dataset.world;if(!raw)return false;const s=JSON.parse(raw);return s.phase==='PLAYING'&&s.players.length===4&&s.renderedPlayers===4&&s.mapLoaded&&document.querySelector('#battle-controls').hidden})()`);
  const initial=await state(sessionId);
  assert.equal(initial.mode,4);assert.equal(initial.mapId,7);
  assert.equal(initial.players.filter(p=>p.isCpu).length,3);
  await waitUntil(sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).players.some(p=>p.isCpu && ${JSON.stringify(initial.players)}.some(q=>q.id===p.id && Math.hypot(q.x-p.x,q.z-p.z)>5))`);
  const playing=await state(sessionId);
  assert(playing.players.some(p=>p.isCpu && initial.players.some(q=>q.id===p.id && Math.hypot(q.x-p.x,q.z-p.z)>5)));
  await evaluate(sessionId, `document.querySelector('#leave').click()`);
  await waitUntil(sessionId, `!document.querySelector('#battle-status').dataset.world && !document.querySelector('#battle-controls').hidden && !document.querySelector('#start-cpu').disabled`);
  await writeFile('recovery/output/browser-cpu-entry.json',JSON.stringify({status:'PASS',scope:'Normal single button creates map7 mode4, three CPUs, resource readiness and normal Ready; blocked catalog failure feedback and retry; CPU ordinary autonomous movement; return. Reduced render resolution, no HD or full round claim.',loading,failure,initial,playing},null,2));
  console.log('PASS: one-click CPU entry, resource failure feedback, retry, automatic readiness, autonomous CPU movement and return');
} finally {
  for(const page of pages) await command('Target.closeTarget',{targetId:page.targetId});
  for (const browserContextId of contexts) await command('Target.disposeBrowserContext',{browserContextId});
  ws.close();
  await vite.close();
  await stop();
  await rm(directory,{recursive:true,force:true});
}
