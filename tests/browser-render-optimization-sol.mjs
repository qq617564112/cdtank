import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';

var WebSocket = createRequire(import.meta.url)('ws');
var endpoint = process.argv[2];
var origin = process.argv[3] || 'http://127.0.0.1:5198';
if (!endpoint) throw new Error('Usage: node tests/browser-render-optimization-sol.mjs <CDP browser URL> [Vite origin]');
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
  await command('Page.navigate', {url: origin + '/scene-placements.json'}, sessionId);
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
    const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true},true);engine.setHardwareScalingLevel(1);engine.resize();
    const scene=new B.Scene(engine);scene.clearColor=new B.Color4(.25,.36,.44,1);
    const camera=new B.ArcRotateCamera('cost-camera',-Math.PI/2,Math.PI/3,100,B.Vector3.Zero(),scene);
    camera.minZ=.1;camera.maxZ=100000;
    const light=new B.HemisphericLight('sky',new B.Vector3(0,1,0),scene);light.intensity=1.2;light.groundColor=new B.Color3(.35,.35,.35);
    const beforeLoad={meshes:scene.meshes.length,geometries:scene.geometries.length,materials:scene.materials.length,textures:scene.textures.length};
    const preview=new ScenePreview(scene,camera);const status=await preview.load('0007');camera.radius=700;
    const si=new B.SceneInstrumentation(scene),ei=new B.EngineInstrumentation(engine);
    for(const key of ['captureFrameTime','captureRenderTime','captureInterFrameTime','captureActiveMeshesEvaluationTime','captureAnimationsTime','captureCameraRenderTime'])si[key]=true;
    ei.captureGPUFrameTime=true;
    const gl=engine._gl,debug=gl.getExtension('WEBGL_debug_renderer_info');
    const device={width:engine.getRenderWidth(),height:engine.getRenderHeight(),devicePixelRatio:devicePixelRatio,hardwareScaling:engine.getHardwareScalingLevel(),webGLVersion:engine.webGLVersion,renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),timerQuery:!!engine.getCaps().timerQuery,antialias:gl.getContextAttributes().antialias};
    const terrain=preview.assets[0].meshes;
    const terrainState=()=>terrain.map(mesh=>({name:mesh.name,matrix:Array.from(mesh.computeWorldMatrix(true).m),positions:Array.from(mesh.getVerticesData('position')??[]),normals:Array.from(mesh.getVerticesData('normal')??[]),uv:Array.from(mesh.getVerticesData('uv')??[]),indices:Array.from(mesh.getIndices()??[]),material:mesh.material?.uniqueId,textures:mesh.material?.getActiveTextures().map(t=>({id:t.uniqueId,samplingMode:t.samplingMode,wrapU:t.wrapU,wrapV:t.wrapV}))}));
    const originalTerrain=terrainState();
    let baselinePixels;
    function comparePixels(){scene.render();const pixels=new Uint8Array(engine.getRenderWidth()*engine.getRenderHeight()*4);gl.readPixels(0,0,engine.getRenderWidth(),engine.getRenderHeight(),gl.RGBA,gl.UNSIGNED_BYTE,pixels);if(!baselinePixels){baselinePixels=pixels;return {bytes:pixels.length,differentBytes:0,maxDifference:0};}let differentBytes=0,maxDifference=0;for(let i=0;i<pixels.length;i++){const d=Math.abs(pixels[i]-baselinePixels[i]);if(d){differentBytes++;maxDifference=Math.max(maxDifference,d);}}return {bytes:pixels.length,differentBytes,maxDifference};}
    function stats(values){const v=values.slice().sort((a,b)=>a-b);return {count:v.length,mean:v.reduce((a,b)=>a+b,0)/v.length,p50:v[Math.floor(v.length*.5)],p95:v[Math.floor(v.length*.95)],max:v.at(-1)};}
    async function sample(label){
      await scene.whenReadyAsync();
      let previous,rows=[],warmup=[],frames=0,resolve;
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
      return {label,device,camera:{alpha:camera.alpha,beta:camera.beta,radius:camera.radius,target:camera.target.asArray()},elapsedMs:performance.now()-start,meshCount:scene.meshes.length,enabledMeshCount:inventory.length,frame:Object.fromEntries(Object.keys(rows[0]??{}).map(k=>[k,stats(rows.map(row=>row[k]))])),gpu:{samples:ei.gpuFrameTimeCounter.count-gpuCount,phaseAverageNs:ei.gpuFrameTimeCounter.count>gpuCount?(ei.gpuFrameTimeCounter.total-gpuTotal)/(ei.gpuFrameTimeCounter.count-gpuCount):null,currentNs:device.timerQuery?ei.gpuFrameTimeCounter.current:null},warmup,rows,inventory,active};
    }
    globalThis.sceneCost={sample,setFrozen(frozen){for(const mesh of terrain){if(frozen)mesh.freezeWorldMatrix();else mesh.unfreezeWorldMatrix();}return {frozen,count:terrain.filter(m=>m.isWorldMatrixFrozen).length};},terrainState,originalTerrain,comparePixels,resources(){return {meshes:scene.meshes.length,geometries:scene.geometries.length,materials:scene.materials.length,textures:scene.textures.length};},edge(){camera.target.x+=1000;scene.render();return {drawCalls:si.drawCallsCounter.current,triangles:scene.getActiveIndices()/3};},center(){camera.target.x-=1000;},textureNames(){return scene.textures.map(t=>t.name);},async reload(){await preview.load('0007');await scene.whenReadyAsync();},clear(){preview.clear();return this.resources();},dispose(){si.dispose();ei.dispose();preview.clear();scene.dispose();engine.dispose();return this.resources();}};
    return {status,device,beforeLoad};
  })()`);
  assert.equal(setup.device.width, 1920);
  assert.equal(setup.device.height, 1080);
  assert.equal(setup.device.hardwareScaling, 1);
  console.log('SETUP', JSON.stringify(setup));

  var originalGeometry=await evaluate(sessionId,'sceneCost.originalTerrain');
  var phases=[];
  // Reversal distinguishes a persistent change from a single warmup phase.
  for(var [index,frozen] of [false,true,false,true].entries()){
    var mode=await evaluate(sessionId,`sceneCost.setFrozen(${frozen})`);
    var phase=await evaluate(sessionId,`sceneCost.sample('${frozen?'frozen':'baseline'}-${index}')`);
    var geometry=await evaluate(sessionId,'sceneCost.terrainState()');
    assert.deepEqual(geometry,originalGeometry,'Terrain geometry/material/sampler changed');
    var pixels=await evaluate(sessionId,'sceneCost.comparePixels()');
    assert.equal(pixels.differentBytes,0,'Fixed-camera pixels changed');
    assert(phase.frame.intervalMs.count>=30);
    phases.push({...phase,mode,pixels});
    console.log('PHASE',JSON.stringify({label:phase.label,mode,frame:phase.frame}));
  }
  // Move the camera with matrices frozen; culling remains camera-dependent.
  await evaluate(sessionId,'sceneCost.setFrozen(false)');
  var edgeBaseline=await evaluate(sessionId,'sceneCost.edge()');
  await evaluate(sessionId,'sceneCost.center();sceneCost.setFrozen(true)');
  var edgeFrozen=await evaluate(sessionId,'sceneCost.edge()');
  assert.deepEqual(edgeFrozen,edgeBaseline,'Camera culling changed');
  var cleanup=await evaluate(sessionId,'sceneCost.clear()');
  // Observe scene resources again after pending loader cleanup.
  cleanup=await evaluate(sessionId,`(async()=>{await new Promise(r=>setTimeout(r,500));return sceneCost.resources();})()`);
  var cleanupTextureNames=await evaluate(sessionId,'sceneCost.textureNames()');
  await evaluate(sessionId,'sceneCost.reload()');
  var baselineCleanup=await evaluate(sessionId,'sceneCost.clear()');
  assert.deepEqual(cleanup,baselineCleanup,'Frozen cleanup changed resource retention');
  assert.deepEqual({meshes:cleanup.meshes,geometries:cleanup.geometries,materials:cleanup.materials},{meshes:0,geometries:0,materials:0});
  var sceneDisposed=await evaluate(sessionId,'sceneCost.dispose()');
  assert.deepEqual(sceneDisposed,{meshes:0,geometries:0,materials:0,textures:0});
  await writeFile('recovery/output/browser-render-optimization-sol.json',JSON.stringify({status:'NO_JUSTIFIED_FULL_FRAME_GAIN',scope:'Original 0007 map only, fixed 1080p camera; concurrent software-rendered match load on same host; no full match optimization acceptance',candidate:'Freeze only original static terrain world matrices',setup,geometryEqual:true,edgeBaseline,edgeFrozen,phases,cleanup,baselineCleanup,cleanupTextureNames,sceneDisposed},null,2));

} finally {
  if (targetId) await command('Target.closeTarget', {targetId}).catch(() => {});
  ws.close();
}
