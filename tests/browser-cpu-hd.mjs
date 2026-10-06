import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
const mode = 4;
assert([1, 4].includes(mode), 'Mode must be 1 or 4');
const killTarget = mode === 1 ? 30 : 10;
const evidenceName = mode === 1 ? 'browser-team-objective' : 'browser-melee-objective';
const count = 1;
const timeLimit = 300;
if (!endpoint) throw new Error('Usage: node tests/browser-melee-objective.mjs <Chromium CDP WebSocket URL> [mode: 1|4]');
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
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    try {
      return await evaluate(session, `(async()=>{const deadline=Date.now()+180000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed')) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Page navigation timeout');
}
const pages = [];
const state = session => evaluate(session, `JSON.parse(document.querySelector('#battle-status').dataset.world)`);
try {
  const {targetId} = await command('Target.createTarget', {url:'http://127.0.0.1:5173',newWindow:true});
  const {sessionId} = await command('Target.attachToTarget',{targetId,flatten:true});
  pages.push({targetId,sessionId});
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
  await waitUntil(sessionId, `document.querySelector('#tank')?.options.length===21`);
  await evaluate(sessionId, `(async()=>{
    const source=await(await fetch('/src/main.ts')).text();
    const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);EngineStore.LastCreatedEngine.setHardwareScalingLevel(1);
    EngineStore.LastCreatedEngine.resize();
  })()`);
  await evaluate(sessionId, `document.querySelector('#room-mode').value='4';document.querySelector('#room-mode').dispatchEvent(new Event('change'))`);
  await waitUntil(sessionId, `Array.from(document.querySelector('#room-map').options).some(o=>Number(o.value)===7)`);
  await evaluate(sessionId, `document.querySelector('#room-map').value='7';document.querySelector('#player-name').value='CPU Observer';document.querySelector('#create-room').click()`);
  await waitUntil(sessionId, `document.querySelector('#battle-status').dataset.world`);
  for(let i=0;i<3;i++){
    await evaluate(sessionId, `document.querySelector('[data-add-cpu]').click()`);
    await waitUntil(sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===${i+2}`);
  }
  const created = await state(sessionId);
  const {targetId: secondTarget} = await command('Target.createTarget',{url:'http://127.0.0.1:5173',newWindow:true});
  const {sessionId: second} = await command('Target.attachToTarget',{targetId:secondTarget,flatten:true});
  pages.push({targetId:secondTarget,sessionId:second});
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},second);
  await waitUntil(second, `document.querySelector('#tank')?.options.length===21`);
  await evaluate(second, `document.querySelector('#refresh-rooms').click()`);
  await waitUntil(second, `Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(created.roomId)})`);
  await evaluate(second, `document.querySelector('#room').value=${JSON.stringify(created.roomId)};document.querySelector('#player-name').value='HD Observer 2';document.querySelector('#join').click()`);
  await waitUntil(second, `(()=>{const s=document.querySelector('#battle-status').dataset.world;return s&&JSON.parse(s).mapLoaded&&JSON.parse(s).renderedPlayers===5})()`);
  for(const page of pages)await evaluate(page.sessionId, `(async()=>{
    const source=await(await fetch('/src/main.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);const engine=EngineStore.LastCreatedEngine,scene=EngineStore.LastCreatedScene;
    engine.setHardwareScalingLevel(1);engine.resize();
    globalThis.cpuHdFrames=[];let previous=performance.now();
    scene.onAfterRenderObservable.add(()=>{const now=performance.now();globalThis.cpuHdFrames.push(now-previous);previous=now;});
    const gl=engine._gl,ext=gl.getExtension('WEBGL_debug_renderer_info');
    globalThis.cpuHdDevice={width:engine.getRenderWidth(),height:engine.getRenderHeight(),scaling:engine.getHardwareScalingLevel(),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
  })()`);
  const initial=await state(sessionId);
  assert.equal(initial.phase,'WAITING');assert.equal(initial.match.readyPlayerIds.length,3);
  await waitUntil(sessionId, `!document.querySelector('[data-ready]').disabled && document.querySelector('#battle-status').dataset.world && JSON.parse(document.querySelector('#battle-status').dataset.world).mapLoaded`);
  await evaluate(second, `document.querySelector('[data-ready]').click()`);
  await evaluate(sessionId, `document.querySelector('[data-ready]').click()`);
  await waitUntil(sessionId, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.phase==='PLAYING'&&s.renderedPlayers===5&&s.mapLoaded})()`);
  const started=Date.now(),samples=[];
  while(Date.now()-started<320000){
    const s=await state(sessionId);samples.push(s);
    if(s.phase==='FINISHED')break;
    await new Promise(r=>setTimeout(r,5000));
    console.log('CPU autonomous '+s.remaining+'s, kills '+s.players.map(p=>p.kills).join('/'));
  }
  const finished=await state(sessionId);
  assert.equal(finished.phase,'FINISHED');assert(finished.match.result.players.some(p=>p.kills>0));
  await waitUntil(second, `JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'`);
  const remote=await state(second);assert.deepEqual(remote.match.result,finished.match.result);
  const result=finished.match.result;
  const rendering=await Promise.all(pages.map(page=>evaluate(page.sessionId, `({device:globalThis.cpuHdDevice,frames:globalThis.cpuHdFrames})`)));
  for(const r of rendering){assert.equal(r.device.width,1920);assert.equal(r.device.height,1080);assert.equal(r.device.scaling,1);assert(r.frames.length>10);r.frames.sort((a,b)=>a-b);r.p50Ms=r.frames[Math.floor(r.frames.length*.5)];r.p95Ms=r.frames[Math.floor(r.frames.length*.95)];r.frameCount=r.frames.length;delete r.frames;}
  await new Promise(r=>setTimeout(r,1000));assert.deepEqual((await state(sessionId)).match.result,result);
  await waitUntil(sessionId, `document.querySelectorAll('[data-result-player]').length===5`);
  const screenshot=await command('Page.captureScreenshot',{format:'png'},sessionId);
  await writeFile('recovery/output/browser-cpu-hd.png',Buffer.from(screenshot.data,'base64'));
  await evaluate(sessionId, `document.querySelector('[data-rematch]').click()`);
  await waitUntil(second, `JSON.parse(document.querySelector('#battle-status').dataset.world).match.rematchPlayerIds.length===4`);
  assert.equal((await state(second)).phase,'FINISHED');
  await evaluate(second, `document.querySelector('[data-rematch]').click()`);
  await waitUntil(sessionId, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.phase==='PLAYING'&&s.match.round===2&&s.players.every(p=>p.kills===0&&p.alive&&p.hp===p.maxHp)})()`);
  const replay=await state(sessionId);
  await evaluate(second, `document.querySelector('#leave').click()`);
  await evaluate(sessionId, `document.querySelector('#leave').click()`);
  await waitUntil(sessionId, `!document.querySelector('#battle-status').dataset.world`);
  await writeFile('recovery/output/browser-cpu-hd.json',JSON.stringify({status:'PASS',scope:'Actual real-time CPU match, normal room UI, original timer, autonomous server inputs, two independent 1920x1080 hardwareScaling1 browsers observe only, consistent settlement/freeze, automatic CPU rematch, exit',elapsedSeconds:(Date.now()-started)/1000,initial,samples,finished,remote,rendering,replay},null,2));
  console.log('PASS: autonomous CPU real-time match, settlement, rematch and exit');
}finally{for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
