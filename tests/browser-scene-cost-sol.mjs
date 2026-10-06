import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';

var WebSocket = createRequire(import.meta.url)('ws');
var endpoint = process.argv[2];
var origin = process.argv[3] || 'http://127.0.0.1:5178';
if (!endpoint) throw new Error('Usage: node tests/browser-scene-cost-sol.mjs <CDP browser URL> [Vite origin]');
var ws = new WebSocket(endpoint);
await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
var sequence = 0;
var pending = new Map();
ws.on('message', raw => {
  var message = JSON.parse(String(raw));
  var callback = pending.get(message.id);
  if (!callback) return;
  pending.delete(message.id);
  message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
});
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    var id = ++sequence;
    pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, sessionId}));
  });
}
async function evaluate(sessionId, expression) {
  var result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
var targetId;
try {
  ({targetId} = await command('Target.createTarget', {url: 'about:blank'}));
  var {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  await command('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false}, sessionId);
  await command('Page.enable', {}, sessionId);
  await command('Page.navigate', {url: origin + '/@vite/client'}, sessionId);
  await evaluate(sessionId, `(async()=>{while(location.origin!==${JSON.stringify(origin)}||document.readyState==='loading')await new Promise(r=>setTimeout(r,50));})()`);
  var setup = await evaluate(sessionId, `(async()=>{
    document.body.innerHTML='<canvas id="cost"></canvas>';
    document.documentElement.style.cssText='margin:0;width:100%;height:100%;overflow:hidden';
    document.body.style.cssText='margin:0;width:100%;height:100%;overflow:hidden';
    const canvas=document.querySelector('canvas');canvas.style.cssText='display:block;width:100vw;height:100vh';
    const source=await(await fetch('/src/main.ts')).text();
    const coreUrl=source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1];
    const loaderUrl=source.match(/import "([^"]*@babylonjs_loaders_glTF.js[^"]*)"/)[1];
    const B=await import(coreUrl);await import(loaderUrl);
    const {ScenePreview}=await import('/src/assets/scenes/scene-preview.ts');
    const {TankView,tankCatalog}=await import('/src/assets/tanks/tank-view.ts');
    const engine=new B.Engine(canvas,true,{},true);engine.setHardwareScalingLevel(1);engine.resize();
    const scene=new B.Scene(engine);scene.clearColor=new B.Color4(.25,.36,.44,1);
    const camera=new B.ArcRotateCamera('cost-camera',-Math.PI/2,Math.PI/3,100,B.Vector3.Zero(),scene);
    camera.minZ=.1;camera.maxZ=100000;
    const light=new B.HemisphericLight('sky',new B.Vector3(0,1,0),scene);light.intensity=1.2;light.groundColor=new B.Color3(.35,.35,.35);
    const preview=new ScenePreview(scene,camera);const status=await preview.load('0007');camera.radius=700;
    const si=new B.SceneInstrumentation(scene),ei=new B.EngineInstrumentation(engine);
    for(const key of ['captureFrameTime','captureRenderTime','captureInterFrameTime','captureActiveMeshesEvaluationTime','captureAnimationsTime','captureCameraRenderTime'])si[key]=true;
    ei.captureGPUFrameTime=true;
    const gl=engine._gl,debug=gl.getExtension('WEBGL_debug_renderer_info');
    const device={width:engine.getRenderWidth(),height:engine.getRenderHeight(),devicePixelRatio:devicePixelRatio,hardwareScaling:engine.getHardwareScalingLevel(),webGLVersion:engine.webGLVersion,renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),timerQuery:!!engine.getCaps().timerQuery,antialias:gl.getContextAttributes().antialias};
    const tanks=[];const actorTimes=[];
    const originalAdvance=TankView.prototype.advanceAnimations;
    TankView.prototype.advanceAnimations=function(...args){const t=performance.now();try{return originalAdvance.apply(this,args);}finally{actorTimes.push(performance.now()-t);}};
    function stats(values){const v=values.slice().sort((a,b)=>a-b);return {count:v.length,mean:v.reduce((a,b)=>a+b,0)/v.length,p50:v[Math.floor(v.length*.5)],p95:v[Math.floor(v.length*.95)],max:v.at(-1)};}
    async function sample(label){
      await scene.whenReadyAsync();
      let previous,rows=[],warmup=[],frames=0,resolve;
      actorTimes.length=0;
      const gpuCount=ei.gpuFrameTimeCounter.count,gpuTotal=ei.gpuFrameTimeCounter.total;
      const start=performance.now();
      const done=new Promise(r=>resolve=r);
      const loop=()=>{
        const now=performance.now(),interval=previous===undefined?null:now-previous;previous=now;
        const begin=performance.now();scene.render();const renderWall=performance.now()-begin;if(frames<5)warmup.push({renderWallMs:renderWall,intervalMs:interval});
        if(frames++>=5){const row={intervalMs:interval,renderWallMs:renderWall,activeMeshes:scene.getActiveMeshes().length,activeTriangles:scene.getActiveIndices()/3};
          for(const key of ['frameTimeCounter','renderTimeCounter','activeMeshesEvaluationTimeCounter','animationsTimeCounter','cameraRenderTimeCounter','drawCallsCounter'])row[key]=si[key].current;
          rows.push(row);
        }
        if(rows.length>=30||performance.now()-start>=45000){engine.stopRenderLoop(loop);resolve();}
      };
      engine.runRenderLoop(loop);await done;
      const inventory=scene.meshes.filter(m=>m.isEnabled()&&m.getTotalVertices()>0).map(m=>({name:m.name,vertices:m.getTotalVertices(),indices:m.getTotalIndices(),subMeshes:m.subMeshes?.length??0,instances:m.instances?.length??0,isInstance:m.isAnInstance,material:m.material?.name,className:m.getClassName()}));
      const active=Array.from(scene.getActiveMeshes().data.slice(0,scene.getActiveMeshes().length)).map(m=>({name:m.name,indices:m.getTotalIndices(),subMeshes:m.subMeshes?.length??0,isInstance:m.isAnInstance,material:m.material?.name}));
      return {label,device,camera:{alpha:camera.alpha,beta:camera.beta,radius:camera.radius,target:camera.target.asArray()},elapsedMs:performance.now()-start,meshCount:scene.meshes.length,enabledMeshCount:inventory.length,tankIds:tanks.map(t=>t.tankId),frame:Object.fromEntries(Object.keys(rows[0]??{}).map(k=>[k,stats(rows.map(row=>row[k]))])),actorAnimationMs:stats(actorTimes),gpu:{samples:ei.gpuFrameTimeCounter.count-gpuCount,phaseAverageNs:ei.gpuFrameTimeCounter.count>gpuCount?(ei.gpuFrameTimeCounter.total-gpuTotal)/(ei.gpuFrameTimeCounter.count-gpuCount):null,currentNs:device.timerQuery?ei.gpuFrameTimeCounter.current:null},warmup,rows,inventory,active};
    }
    globalThis.sceneCost={sample,async addTanks(){const entries=await tankCatalog();for(const [index,entry] of entries.slice(0,5).entries()){const tank=await TankView.load(scene,'cost-tank-'+index,entry.id);tank.position(camera.target.x+(index-2)*45,0,camera.target.z);tanks.push(tank);}return {tankIds:tanks.map(t=>t.tankId),lastEngineMatches:B.EngineStore.LastCreatedEngine===engine,engineCapsAvailable:!!engine.getCaps()};},dispose(){TankView.prototype.advanceAnimations=originalAdvance;tanks.forEach(t=>t.dispose());si.dispose();ei.dispose();preview.clear();scene.dispose();engine.dispose();}};
    return {status,device};
  })()`);
  assert.equal(setup.device.width, 1920);
  assert.equal(setup.device.height, 1080);
  assert.equal(setup.device.hardwareScaling, 1);
  console.log('SETUP', JSON.stringify(setup));
  var phases = [];
  phases.push(await evaluate(sessionId, `sceneCost.sample('map-0007')`));
  console.log('MAP', JSON.stringify(phases[0].frame));
  console.log('LOADED',JSON.stringify(await evaluate(sessionId, 'sceneCost.addTanks()')));
  phases.push(await evaluate(sessionId, `sceneCost.sample('map-0007-plus-five-normal-tanks')`));
  for (var phase of phases) assert(phase.frame.intervalMs.count >= 10, 'Insufficient rendered frames');
  var evidence = {status: 'MEASURED',scope: 'Bounded rendering diagnosis: original ScenePreview 0007 and five normal TankView loads at fixed battle radius 700. No network, AI, effects, motion, or match lifecycle acceptance.',setup,phases};
  await writeFile('recovery/output/browser-scene-cost-sol.json', JSON.stringify(evidence, null, 2));
  console.log('TANKS', JSON.stringify(phases[1].frame));
  await evaluate(sessionId, 'sceneCost.dispose()');
} finally {
  if (targetId) await command('Target.closeTarget', {targetId}).catch(() => {});
  ws.close();
}
