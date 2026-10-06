import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
const origin = process.argv[3] ?? 'http://127.0.0.1:5173';
if (!endpoint) throw new Error('Usage: node tests/browser-cpu-profile.mjs <Chromium CDP WebSocket URL>');
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
  const {targetId} = await command('Target.createTarget', {url:origin,newWindow:true});
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
  await waitUntil(sessionId, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.mapLoaded&&s.renderedPlayers===4})()`);
  await evaluate(sessionId, `(async()=>{
    const source=await(await fetch('/src/main.ts')).text();
    const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore,SceneInstrumentation,EngineInstrumentation}=await import(url);
    const scene=EngineStore.LastCreatedScene,engine=scene.getEngine();
    const timings={};const restores=[];
    function wrap(proto,name,label){
      const original=proto[name];
      proto[name]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{(timings[label]??=[]).push(performance.now()-start);}};
      restores.push(()=>{proto[name]=original;});
    }
    function importedUrl(text,suffix){
      for(const line of text.split(String.fromCharCode(10))){
        const match=line.match(/from "([^"]+)"/);
        if(match&&match[1].includes(suffix))return match[1];
      }
      throw new Error('Missing production import '+suffix);
    }
    const battleUrl=importedUrl(source,'/battle.ts');
    const battleSource=await(await fetch(battleUrl)).text();
    const {Battle}=await import(battleUrl);
    const {BattleHud}=await import(importedUrl(battleSource,'/battle-hud.ts'));
    const {ScenePreview}=await import(importedUrl(battleSource,'/scene-preview.ts'));
    const playersSource=await(await fetch(importedUrl(battleSource,'/battle-players.ts'))).text();
    const {TankView}=await import(importedUrl(playersSource,'/tank-view.ts'));
    wrap(Battle.prototype,'render','battleRender');wrap(Battle.prototype,'reconcile','snapshotReconcile');
    wrap(BattleHud.prototype,'update','hudUpdate');wrap(ScenePreview.prototype,'updateObjects','objectsUpdate');
    wrap(TankView.prototype,'advanceAnimations','actorAnimation');wrap(scene,'render','sceneRender');
    const si=new SceneInstrumentation(scene),ei=new EngineInstrumentation(engine);
    for(const key of ['captureFrameTime','captureRenderTime','captureInterFrameTime','captureActiveMeshesEvaluationTime','captureAnimationsTime','captureCameraRenderTime'])si[key]=true;
    ei.captureGPUFrameTime=true;
    const gl=engine._gl,ext=gl.getExtension('WEBGL_debug_renderer_info');
    const counters=['frameTimeCounter','renderTimeCounter','interFrameTimeCounter','activeMeshesEvaluationTimeCounter','animationsTimeCounter','cameraRenderTimeCounter','drawCallsCounter'];
    let samples=[],previous=performance.now();
    const observer=scene.onAfterRenderObservable.add(()=>{
      const now=performance.now(),row={intervalMs:now-previous};previous=now;
      for(const key of counters)row[key]=si[key].current;
      row.activeMeshes=scene.getActiveMeshes().length;row.activeIndices=scene.getActiveIndices();
      samples.push(row);
    });
    globalThis.cpuProfile={
      async sample(scaling,durationMs){
        engine.setHardwareScalingLevel(scaling);engine.resize();
        await new Promise(r=>setTimeout(r,3000));
        for(const key of Object.keys(timings))timings[key]=[];
        samples=[];previous=performance.now();
        const gpuCountBefore=ei.gpuFrameTimeCounter.count;
        const gpuTotalBefore=ei.gpuFrameTimeCounter.total;
        await new Promise(r=>setTimeout(r,durationMs));
        const stats=values=>{const sorted=values.slice().sort((a,b)=>a-b);return {count:sorted.length,mean:sorted.reduce((a,b)=>a+b,0)/sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)};};
        return {device:{width:engine.getRenderWidth(),height:engine.getRenderHeight(),scaling,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),timerQuery:!!engine.getCaps().timerQuery},
          durationMs,methods:Object.fromEntries(Object.entries(timings).map(([k,v])=>[k,stats(v)])),
          frame:Object.fromEntries(Object.keys(samples[0]??{}).map(k=>[k,stats(samples.map(s=>s[k]))])),
          gpu:{samplesDuringPhase:ei.gpuFrameTimeCounter.count-gpuCountBefore,currentNs:engine.getCaps().timerQuery?ei.gpuFrameTimeCounter.current:null,phaseAverageNs:ei.gpuFrameTimeCounter.count>gpuCountBefore?(ei.gpuFrameTimeCounter.total-gpuTotalBefore)/(ei.gpuFrameTimeCounter.count-gpuCountBefore):null},meshCount:scene.meshes.length};
      },
      dispose(){scene.onAfterRenderObservable.remove(observer);si.dispose();ei.dispose();for(const restore of restores)restore();engine.setHardwareScalingLevel(1);engine.resize();}
    };
  })()`);
  await waitUntil(sessionId, `!document.querySelector('[data-ready]').disabled`);
  await evaluate(sessionId, `document.querySelector('[data-ready]').click()`);
  await waitUntil(sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  const phases=[];
  for(const [label,scaling,duration] of [['HD-before',1,20000],['resolution-diagnostic',2,10000],['HD-restored',1,20000]]){
    const measured=await evaluate(sessionId, `globalThis.cpuProfile.sample(${scaling},${duration})`);
    phases.push({label,...measured,snapshot:await state(sessionId)});
    assert(measured.frame.intervalMs.count>10);
    for(const name of ['battleRender','snapshotReconcile','hudUpdate','objectsUpdate','actorAnimation','sceneRender'])assert(measured.methods[name]?.count>0, 'Missing live-module timing: '+name);
    if(scaling===1){assert.equal(measured.device.width,1920);assert.equal(measured.device.height,1080);}
    console.log(label,JSON.stringify({device:measured.device,frame:measured.frame.intervalMs,methods:measured.methods,gpu:measured.gpu}));
  }
  await evaluate(sessionId, `globalThis.cpuProfile.dispose();document.querySelector('#leave').click()`);
  await writeFile('recovery/output/browser-cpu-profile.json',JSON.stringify({status:'MEASURED',scope:'Single view autonomous normal-input CPU combat; HD source scene and resolution diagnostic only. Timings overlap and GPU counters may be unavailable. Does not certify match lifecycle or smooth HD.',phases},null,2));
}finally{for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
