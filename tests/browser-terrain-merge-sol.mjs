import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';

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
var entries = await (await fetch(origin + '/scene-placements.json')).json();
var terrain = entries.find(entry => entry.id === '0007').terrain;
var bytes = Buffer.from(await (await fetch(origin + '/' + terrain)).arrayBuffer());
var gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
var materialUses = new Map();
for (var mesh of gltf.meshes) for (var primitive of mesh.primitives) {
  materialUses.set(primitive.material, (materialUses.get(primitive.material) || 0) + 1);
}
var eligibility = {materialCount: gltf.materials.length,primitiveCount: [...materialUses.values()].reduce((a,b)=>a+b,0),sharedMaterialEntries: [...materialUses].filter(([,count])=>count>1),alphaModes: [...new Set(gltf.materials.map(material=>material.alphaMode))]};
assert.equal(eligibility.sharedMaterialEntries.length, 0, '0007 material identity eligibility changed: reassess candidate');
var targetId;
try {
  ({targetId}=await command('Target.createTarget',{url:'about:blank'}));
  var {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
  await command('Page.enable',{},sessionId);
  await command('Page.navigate',{url:origin+'/@vite/client'},sessionId);
  await evaluate(sessionId,`(async()=>{while(location.origin!==${JSON.stringify(origin)}||document.readyState==='loading')await new Promise(r=>setTimeout(r,50));})()`);
  await evaluate(sessionId,`(async()=>{
    document.body.innerHTML='<canvas></canvas>';document.body.style.cssText='margin:0';document.documentElement.style.cssText='margin:0;overflow:hidden';
    const canvas=document.querySelector('canvas');canvas.style.cssText='display:block;width:100vw;height:100vh';
    const main=await(await fetch('/src/main.ts')).text();
    const B=await import(main.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1]);
    await import(main.match(/import "([^"]*@babylonjs_loaders_glTF.js[^"]*)"/)[1]);
    const source=await(await fetch('/src/assets/scenes/scene-preview.ts')).text();
    const baseline=source.replace(/(from |import )"([/][^" ]+)"/g,(_,prefix,path)=>prefix+JSON.stringify(location.origin+path));
    const {ScenePreview:Original}=await import('data:text/javascript;base64,'+btoa(unescape(encodeURIComponent(baseline))));
    const {ScenePreview:Merged}=await import('/src/assets/scenes/scene-preview.ts');
    const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true},true);engine.setHardwareScalingLevel(1);engine.resize();
    const scene=new B.Scene(engine);scene.clearColor=new B.Color4(.25,.36,.44,1);
    const camera=new B.ArcRotateCamera('camera',-Math.PI/2,Math.PI/3,100,B.Vector3.Zero(),scene);camera.minZ=.1;camera.maxZ=100000;
    const light=new B.HemisphericLight('sky',new B.Vector3(0,1,0),scene);light.intensity=1.2;light.groundColor=new B.Color3(.35,.35,.35);
    const si=new B.SceneInstrumentation(scene);si.captureRenderTime=true;si.captureActiveMeshesEvaluationTime=true;
    const geometry=()=>{
      const groups={};
      for(const mesh of scene.meshes){if(!mesh.isEnabled()||!mesh.getTotalVertices()||mesh.isAnInstance)continue;
        const material=mesh.material?.name??'',wm=mesh.computeWorldMatrix(true),positions=mesh.getVerticesData('position'),normals=mesh.getVerticesData('normal'),uv=mesh.getVerticesData('uv');
        const rows=groups[material]??=[];
        for(let i=0;i<positions.length/3;i++){const p=B.Vector3.TransformCoordinates(B.Vector3.FromArray(positions,i*3),wm);const n=normals?B.Vector3.TransformNormal(B.Vector3.FromArray(normals,i*3),wm).normalize():B.Vector3.Zero();rows.push([...p.asArray(),...n.asArray(),...(uv?Array.from(uv.slice(i*2,i*2+2)):[])]);}
      }
      for(const rows of Object.values(groups))rows.sort((a,b)=>{for(let i=0;i<a.length;i++){const d=Math.round(a[i]*100)-Math.round(b[i]*100);if(d)return d;}return 0;});
      return groups;
    };
    let preview;
    globalThis.mergeTest={async load(which){preview=new (which==='baseline'?Original:Merged)(scene,camera);await preview.load('0007');camera.radius=700;await scene.whenReadyAsync();return {width:engine.getRenderWidth(),height:engine.getRenderHeight(),geometry:geometry(),batches:scene.meshes.filter(m=>m.name.startsWith('terrain-batch-')).map(m=>({name:m.name,material:m.material?.name,vertices:m.getTotalVertices()}))};},async sample(){
      const rows=[];let previous,frames=0,resolve;const done=new Promise(r=>resolve=r);const loop=()=>{const now=performance.now(),interval=previous===undefined?null:now-previous;previous=now;const t=performance.now();scene.render();if(frames++>=5)rows.push({intervalMs:interval,renderMs:performance.now()-t,drawCalls:si.drawCallsCounter.current,triangles:scene.getActiveIndices()/3,cullingMs:si.activeMeshesEvaluationTimeCounter.current});if(rows.length>=20){engine.stopRenderLoop(loop);resolve();}};engine.runRenderLoop(loop);await done;return rows;},async edge(){camera.target.x+=1000;for(let i=0;i<5;i++){scene.render();await new Promise(r=>requestAnimationFrame(r));}return {drawCalls:si.drawCallsCounter.current,triangles:scene.getActiveIndices()/3};},clear(){preview.clear();return {meshes:scene.meshes.length,geometries:scene.geometries.length,materials:scene.materials.length};},async cancel(){const realFetch=globalThis.fetch;let release,started;const ready=new Promise(r=>started=r);globalThis.fetch=async(...args)=>{if(args[0]==='/scene-placements.json'){started();await new Promise(r=>release=r);}return realFetch(...args);};const p=preview.load('0007');await ready;preview.clear();release();const status=await p;globalThis.fetch=realFetch;return {status,meshes:scene.meshes.length};},dispose(){si.dispose();scene.dispose();engine.dispose();}};
  })()`);
  var phases=[];
  for(var label of ['baseline','merged']){
    var loaded=await evaluate(sessionId,`mergeTest.load('${label}')`);
    var rows=await evaluate(sessionId,'mergeTest.sample()');
    var image=await command('Page.captureScreenshot',{format:'png'},sessionId);
    await writeFile('recovery/output/terrain-merge-'+label+'.png',Buffer.from(image.data,'base64'));
    var edge=await evaluate(sessionId,'mergeTest.edge()');
    var edgeImage=await command('Page.captureScreenshot',{format:'png'},sessionId);
    await writeFile('recovery/output/terrain-merge-'+label+'-edge.png',Buffer.from(edgeImage.data,'base64'));
    var clear=await evaluate(sessionId,'mergeTest.clear()');
    phases.push({label,...loaded,rows,edge,clear});
    console.log(label,JSON.stringify({batches:loaded.batches,first:rows[0],clear}));
  }
  for (var phase of phases) {
    assert.equal(phase.batches.length, 0);
    assert(phase.rows.every(row=>row.drawCalls===47 && row.triangles===8500));
    assert.deepEqual(phase.clear, {meshes:0,geometries:0,materials:0});
  }
  assert.deepEqual(phases[0].geometry, phases[1].geometry);
  assert.deepEqual(phases[0].edge, phases[1].edge);
  var screenshotsEqual = {};
  for (var suffix of ['', '-edge']) {
    var before = await readFile('recovery/output/terrain-merge-baseline'+suffix+'.png');
    var after = await readFile('recovery/output/terrain-merge-merged'+suffix+'.png');
    screenshotsEqual[suffix || 'center'] = before.equals(after);
    assert(screenshotsEqual[suffix || 'center'], 'Lossless screenshots differ: '+suffix);
  }
  var cancellation=await evaluate(sessionId,'mergeTest.cancel()');
  assert.deepEqual(cancellation, {status:'',meshes:0});
  await writeFile('recovery/output/browser-terrain-merge-sol.json',JSON.stringify({status:'NO_ELIGIBLE_BATCHES',scope:'Limited 0007 terrain batching eligibility and fixed-camera resource/lifecycle comparison; no full match acceptance.',eligibility,screenshotsEqual,phases,cancellation},null,2));
  await evaluate(sessionId,'mergeTest.dispose()');
}finally{if(targetId)await command('Target.closeTarget',{targetId}).catch(()=>{});ws.close();}
