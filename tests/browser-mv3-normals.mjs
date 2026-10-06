import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

const WebSocket = createRequire(import.meta.url)('ws');
const endpoint = process.argv[2];
assert(endpoint, 'Usage: node tests/browser-mv3-normals.mjs <CDP WebSocket URL> [web origin]');
const ws = new WebSocket(endpoint);
await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
let sequence = 0;
const pending = new Map();
ws.on('message', raw => {
  const response = JSON.parse(String(raw));
  const callback = pending.get(response.id);
  if (!callback) return;
  pending.delete(response.id);
  response.error ? callback.reject(new Error(JSON.stringify(response.error))) : callback.resolve(response.result);
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
let targetId;
try {
  ({targetId} = await command('Target.createTarget', {url: process.argv[3] ?? 'http://127.0.0.1:5173'}));
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  const readyExpression = `(async()=>{const deadline=Date.now()+45000;
    while(Date.now()<deadline){if(document.querySelector('#tank')?.options.length===21)return;
      await new Promise(r=>setTimeout(r,100));}throw new Error('Tank catalog not ready');})()`;
  const navigationDeadline = Date.now() + 45000;
  while (true) {
    try {await evaluate(sessionId, readyExpression); break;} catch (error) {
      if (Date.now() >= navigationDeadline || (!String(error).includes('Inspected target navigated or closed') &&
          !String(error).includes('Execution context was destroyed'))) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  const result = await evaluate(sessionId, `(async()=>{
    const source=await (await fetch('/src/main.ts')).text();
    const module=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore,Vector3}=await import(module);
    const {TankView,tankCatalog}=await import('/src/assets/tanks/tank-view.ts');
    const scene=EngineStore.LastCreatedScene,engine=scene.getEngine();
    const loops=[...engine.activeRenderLoops];engine.stopRenderLoop();
    const originals=scene.meshes.filter(mesh=>mesh.isEnabled());
    originals.forEach(mesh=>mesh.setEnabled(false));
    const rows=[];let shaderNormalDraws=0,sourceMaterialDraws=0;
    function close(actual,expected,label){
      if(!actual || actual.length!==expected.length)throw new Error(label+' length');
      let error=0;for(let i=0;i<actual.length;i++)error=Math.max(error,Math.abs(actual[i]-expected[i]));
      if(error>3e-7)throw new Error(label+' error '+error);return error;
    }
    async function glb(path){
      const buffer=await (await fetch('/'+path)).arrayBuffer(),view=new DataView(buffer);
      const size=view.getUint32(12,true);
      const doc=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,size)));
      const binary=28+size;
      return {doc,values(index){const a=doc.accessors[index],v=doc.bufferViews[a.bufferView];
        if(a.type!=='VEC3'||a.componentType!==5126)throw new Error('Normal accessor contract');
        return new Float32Array(buffer,binary+(v.byteOffset||0)+(a.byteOffset||0),a.count*3);}};
    }
    try{
      for(const tank of await tankCatalog()){
        const resourceCounts=()=>[scene.meshes.length,scene.materials.length,scene.textures.length];
        const beforeResources=resourceCounts();
        const view=await TankView.load(scene,'normal-check-'+tank.id,tank.id);
        try{
          for(const action of ['01','02','03','09','01']){
            if(action==='02')await view.motion(true);
            if(action==='03')await view.fire();
            if(action==='09')await view.life(false);
            if(action==='01'&&view.activeAction==='09')await view.life(true);
            if(view.activeAction!==action)throw new Error('Action mismatch '+tank.id+'/'+action);
            let vertices=0,targets=0,maxError=0,normalShaders=0,sourceShaders=0;
            for(const component of view.current.components){
              const file=await glb(component.action.asset);
              const primitives=file.doc.meshes.flatMap(mesh=>mesh.primitives);
              const meshes=component.assets.meshes.filter(mesh=>mesh.getTotalVertices()>0);
              if(meshes.length!==primitives.length)throw new Error('Primitive count');
              for(let i=0;i<meshes.length;i++){
                const mesh=meshes[i],primitive=primitives[i],base=file.values(primitive.attributes.NORMAL);
                maxError=Math.max(maxError,close(mesh.getVerticesData('normal'),base,'base normal'));
                vertices+=base.length/3;
                const sourceTargets=primitive.targets||[],manager=mesh.morphTargetManager;
                if(sourceTargets.length){
                  if(!manager?.supportsNormals || manager.numTargets!==sourceTargets.length)throw new Error('Morph normal support');
                  for(let j=0;j<sourceTargets.length;j++){
                    const delta=file.values(sourceTargets[j].NORMAL);
                    const expected=Array.from(base,(v,k)=>v+delta[k]);
                    maxError=Math.max(maxError,close(manager.getTarget(j).getNormals(),expected,'target normal'));
                    targets++;
                  }
                }
              }
            }
            for(const delta of [0.003,0.009,0.017]){
              view.advanceAnimations(delta);scene.render();
              for(const component of view.current.components)for(const mesh of component.assets.meshes){
                if(!mesh.getTotalVertices()||!mesh.morphTargetManager?.numInfluencers)continue;
                const defines=mesh.subMeshes?.[0]?.effect?.defines||'';
                if(defines.includes('MORPHTARGETS_NORMAL'))normalShaders++;
                if(mesh.material?.metadata?.originalMV3){
                  if(!mesh.subMeshes?.[0]?.effect?.isReady())throw new Error('Original MV3 shader not ready');
                  if(!defines.includes('MORPHTARGETS_POSITION'))throw new Error('Original MV3 position morph not compiled');
                  if(defines.includes('MORPHTARGETS_NORMAL'))throw new Error('Ambient-only original shader unexpectedly uses morph normals');
                  for(const texture of mesh.material.getActiveTextures()){
                    if(texture.samplingMode!==2||texture.wrapU!==1||texture.wrapV!==1)
                      throw new Error('Original MV3 sampler not retained on imported texture');
                  }
                  sourceShaders++;
                }
              }
            }
            if(targets && !normalShaders && !sourceShaders)throw new Error('Source morph shader not compiled '+tank.id+'/'+action);
            shaderNormalDraws+=normalShaders;
            sourceMaterialDraws+=sourceShaders;
            rows.push({tankId:tank.id,action,vertices,targets,maxError,normalShaders,sourceShaders});
          }
        }finally{view.dispose();}
        await new Promise(resolve=>setTimeout(resolve,0));
        const afterResources=resourceCounts();
        if(JSON.stringify(beforeResources)!==JSON.stringify(afterResources))
          throw new Error('Tank material/mesh/texture disposal '+tank.id+' '+JSON.stringify({beforeResources,afterResources}));
      }
    }finally{originals.forEach(mesh=>mesh.setEnabled(true));for(const loop of loops)engine.runRenderLoop(loop);}
    return {scope:'Actual TankView GLB load, 21 tank action lifecycles, base/absolute morph normal upload and source-tagged ambient-only position morph shader compilation. Unresolved textures retain their prior material. Asset rendering test; no original D3D framebuffer proof.',rows,shaderNormalDraws,sourceMaterialDraws};
  })()`);
  assert.equal(result.rows.length, 105);
  assert(result.sourceMaterialDraws > 0);
  result.resolutions = [];
  for (const [width, height] of [[1920, 1080], [3840, 2160]]) {
    await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false}, sessionId);
    const dimensions = await evaluate(sessionId, `(async()=>{
      const source=await (await fetch('/src/main.ts')).text();
      const module=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(module),scene=EngineStore.LastCreatedScene,engine=scene.getEngine();
      engine.setHardwareScalingLevel(1);engine.resize();
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      scene.render();const canvas=engine.getRenderingCanvas();
      return {viewport:[innerWidth,innerHeight],render:[engine.getRenderWidth(),engine.getRenderHeight()],
        canvas:[canvas.clientWidth,canvas.clientHeight],scaling:engine.getHardwareScalingLevel(),
        normalMeshes:scene.meshes.filter(mesh=>mesh.isEnabled()&&mesh.getTotalVertices()>0&&mesh.getVerticesData('normal')).length};
    })()`);
    assert.deepEqual(dimensions.viewport, [width, height]);
    assert.deepEqual(dimensions.render, dimensions.canvas);
    assert.equal(dimensions.scaling, 1);
    assert(dimensions.normalMeshes > 0);
    const screenshot = await command('Page.captureScreenshot', {format:'png'}, sessionId);
    const path = `recovery/output/mv3-normals-${width}.png`;
    await writeFile(path, Buffer.from(screenshot.data, 'base64'));
    result.resolutions.push({...dimensions,screenshot:path});
  }
  await writeFile('recovery/output/browser-mv3-normals.json', JSON.stringify({...result,status:'PASS'},null,2));
  console.log('PASS: 21 actual tank views / 105 action samples, base and morph normals retained, source ambient-only morph shaders compiled; 1080p/4K viewport at actual canvas pixel resolution');
} finally {
  if(targetId)await command('Target.closeTarget',{targetId});
  ws.close();
}
