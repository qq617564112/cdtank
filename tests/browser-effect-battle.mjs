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
  const {targetId} = await command('Target.createTarget', {url:'http://127.0.0.1:5173',newWindow:true});
  const {sessionId} = await command('Target.attachToTarget',{targetId,flatten:true});
  pages.push({targetId,sessionId});
  await command('Runtime.enable', {}, sessionId);
  const errors=[];
  ws.on('message', raw => {const message=JSON.parse(String(raw));if(message.sessionId===sessionId&&message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);});
  await command('Emulation.setDeviceMetricsOverride',{width:960,height:540,deviceScaleFactor:1,mobile:false},sessionId);
  await waitUntil(sessionId, `document.querySelector('#tank')?.options.length===21`);
  await evaluate(sessionId, `(async()=>{
    const source=await(await fetch('/src/main.ts')).text();
    const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore,VertexBuffer}=await import(url);const engine=EngineStore.LastCreatedEngine;
    engine.setHardwareScalingLevel(2);engine.resize();const scene=engine.scenes[0];
    window.effectBattleEvidence={draws:[],frames:0};
    scene.onAfterRenderObservable.add(()=>{const record=window.effectBattleEvidence;++record.frames;
      for(const mesh of scene.meshes.filter(mesh=>mesh.metadata?.originalEffect&&mesh.isEnabled())){
        const positions=mesh.getVerticesData(VertexBuffer.PositionKind);
        if(record.draws.length<3000)record.draws.push({frame:record.frames,node:mesh.metadata.sourceNode,
          vertices:positions?.length/3,position:positions?.slice(0,3),texture:mesh.material.getActiveTextures()[0]?.url});
      }
      if(record.draws.some(draw=>draw.node===2431)&&scene.meshes.some(mesh=>mesh.metadata?.sourceNode===2509&&mesh.isEnabled())){
        engine.stopRenderLoop();record.captureFrame=record.frames;
        const pixels=new Uint8Array(engine.getRenderWidth()*engine.getRenderHeight()*4);
        engine._gl.readPixels(0,0,engine.getRenderWidth(),engine.getRenderHeight(),engine._gl.RGBA,engine._gl.UNSIGNED_BYTE,pixels);
        window.effectBattlePixels=pixels;
      }
    });
  })()`);
  await evaluate(sessionId, `document.querySelector('#tank').value='105';document.querySelector('#room-mode').value='4';document.querySelector('#room-mode').dispatchEvent(new Event('change'))`);
  await waitUntil(sessionId, `Array.from(document.querySelector('#room-map').options).some(o=>Number(o.value)===7)`);
  await evaluate(sessionId, `document.querySelector('#room-map').value='7';document.querySelector('#player-name').value='Effect Observer';document.querySelector('#create-room').click()`);
  await waitUntil(sessionId, `document.querySelector('#battle-status').dataset.world`);
  for(let i=0;i<3;i++){
    await evaluate(sessionId, `document.querySelector('[data-add-cpu]').click()`);
    await waitUntil(sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===${i+2}`);
  }
  await waitUntil(sessionId, `!document.querySelector('[data-ready]').disabled && JSON.parse(document.querySelector('#battle-status').dataset.world).mapLoaded && JSON.parse(document.querySelector('#battle-status').dataset.world).renderedPlayers===4 && !document.querySelector('#leave').hidden`);
  await evaluate(sessionId, `document.querySelector('[data-ready]').click()`);
  await waitUntil(sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  await command('Input.dispatchKeyEvent',{type:'keyDown',code:'Space',key:' '},sessionId);
  const deadline=Date.now()+180000;
  let evidence;
  while(Date.now()<deadline){
    evidence=await evaluate(sessionId, 'window.effectBattleEvidence');
    if(evidence.captureFrame)break;
    if(errors.length)throw new Error(JSON.stringify(errors));
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  await command('Input.dispatchKeyEvent',{type:'keyUp',code:'Space',key:' '},sessionId);
  assert.equal(errors.length,0,JSON.stringify(errors));
  assert.ok(evidence.draws.some(draw=>draw.node===2431),'Original attack sprite must render');
  assert.ok(evidence.draws.some(draw=>draw.node===2509),'Original tank105 death strip must render');
  assert.ok(evidence.draws.some(draw=>draw.node===2508),'Original oriented death sprite must render');
  assert.ok(evidence.draws.some(draw=>draw.node===2430),'Original smoke particles must render');
  assert.ok(evidence.draws.every(draw=>draw.vertices>0&&draw.texture));
  assert.ok(evidence.captureFrame,'Capture an actual rendered death strip frame');
  const changedPixels=await evaluate(sessionId, `(async()=>{
    const source=await(await fetch('/src/main.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);const engine=EngineStore.LastCreatedEngine,scene=engine.scenes[0];
    scene.onBeforeRenderObservable.clear();scene.onAfterRenderObservable.clear();
    const meshes=scene.meshes.filter(mesh=>mesh.metadata?.originalEffect&&mesh.isEnabled());
    meshes.forEach(mesh=>mesh.setEnabled(false));scene.render();
    const pixels=new Uint8Array(window.effectBattlePixels.length);const gl=engine._gl;
    gl.readPixels(0,0,engine.getRenderWidth(),engine.getRenderHeight(),gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let count=0;for(let index=0;index<pixels.length;index+=4)if(pixels[index]!==window.effectBattlePixels[index]||pixels[index+1]!==window.effectBattlePixels[index+1]||pixels[index+2]!==window.effectBattlePixels[index+2])++count;
    meshes.forEach(mesh=>mesh.setEnabled(true));scene.render();return count;
  })()`);
  assert.ok(changedPixels>0,'Original effect meshes must contribute visible framebuffer pixels');
  const screenshot=await command('Page.captureScreenshot',{format:'png'},sessionId);
  await writeFile('recovery/output/browser-effect-battle.png',Buffer.from(screenshot.data,'base64'));
  await evaluate(sessionId, `document.querySelector('#leave').click()`);
  const retained=await evaluate(sessionId, `(async()=>{const source=await(await fetch('/src/main.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url);return EngineStore.LastCreatedEngine.scenes[0].meshes.filter(mesh=>mesh.metadata?.originalEffect).length;})()`);
  assert.equal(retained,0);
  await writeFile('recovery/output/browser-effect-battle.json',JSON.stringify({evidence,errors,retained,changedPixels},null,2)+'\n');
  console.log('PASS: actual multiplayer ELK attack/smoke and tank105 death oriented sprite/strip draw, original textures and leave cleanup');
} finally {
  for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId});
  ws.close();
}
