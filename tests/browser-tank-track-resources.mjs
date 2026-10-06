import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const WebSocket=createRequire(import.meta.url)('ws');
const endpoint=process.argv[2]??(await(await fetch('http://127.0.0.1:9621/json/version')).json()).webSocketDebuggerUrl;
const origin=process.argv[3]??'http://127.0.0.1:5421/';
const ws=new WebSocket(endpoint);await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
let serial=0;const pending=new Map();
ws.on('message',raw=>{const message=JSON.parse(raw),handler=pending.get(message.id);if(!handler)return;pending.delete(message.id);message.error?handler.reject(new Error(JSON.stringify(message.error))):handler.resolve(message.result);});
function command(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,sessionId}));});}
async function evaluate(sessionId,expression){const result=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},sessionId);if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
const output='recovery/output/browser-tank-track-resources-'+new Date().toISOString().replace(/[:.]/g,'-');
let targetId;const evidence={status:'RUNNING',scope:'Isolated actual WebGL consumer coverage, not ordinary gameplay. All 21 embedded default A/B pairs, all battle actions, X/Y drawing, freeze/snap and release.'};
try{
  ({targetId}=await command('Target.createTarget',{url:origin}));
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
  await command('Emulation.setDeviceMetricsOverride',{width:640,height:360,deviceScaleFactor:1,mobile:false},sessionId);
  for(let attempt=0;attempt<150;attempt++){
    try{if(await evaluate(sessionId,`Boolean(document.querySelector('[data-room-card-create]'))`))break;}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  evidence.rows=await evaluate(sessionId,`(async()=>{
    const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore,Scene,ArcRotateCamera,Vector3,Color3,PBRMaterial}=await import(url);
    const {TankView,tankCatalog}=await import('/src/assets/tanks/tank-view.ts');
    const engine=EngineStore.Instances.find(engine=>engine.getRenderingCanvas()===document.querySelector('#world'));
    engine.stopRenderLoop();const scene=new Scene(engine);scene.ambientColor=Color3.White();
    const camera=new ArcRotateCamera('track-resources',Math.PI/4,1.05,130,new Vector3(0,12,0),scene);camera.minZ=.1;camera.maxZ=10000;
    scene.onBeforeRenderObservable.clear();
    const warm=new PBRMaterial('brdf-warmup',scene);warm.dispose();
    const counts=()=>({meshes:scene.meshes.length,materials:scene.materials.length,textures:scene.textures.length});
    const baseline=counts(),rows=[];
    const catalog=(await(await fetch('/tank-textures.json')).json()).rows;
    function inspect(view){return view.current.components.filter(component=>['X','Y'].includes(component.part)).flatMap(component=>component.assets.meshes.filter(mesh=>mesh.getTotalVertices()>0).map(mesh=>({part:component.part,texture:mesh.material.getActiveTextures()[0]?.url,vertices:mesh.getTotalVertices()})));}
    async function render(view){for(const component of view.current.components)for(const mesh of component.assets.meshes)if(mesh.material)await mesh.material.forceCompilationAsync(mesh);scene.render();return inspect(view);}
    for(const tank of await tankCatalog()){
      const view=await TankView.load(scene,'source-tracks-'+tank.id,tank.id);
      scene.onBeforeRenderObservable.clear();
      const draws=[];
      for(const promise of view.actions.values()){
        const action=await promise;
        for(const component of action.components)if(['X','Y'].includes(component.part))for(const mesh of component.assets.meshes)if(mesh.getTotalVertices())mesh.onAfterRenderObservable.add(()=>draws.push({part:component.part,texture:mesh.material.getActiveTextures()[0]?.url,action:view.activeAction}));
      }
      const source=catalog.find(row=>row.tankId===tank.id&&row.part==='XY'&&row.textures.A.request.toLowerCase().endsWith(tank.id.toString().padStart(3,'0')+'xy_001_a.tga'));
      if(!source)throw new Error('Embedded pair '+tank.id);
      const a=await render(view);
      view.trackMovementTarget(-10,0);view.advanceAnimations(.11);const b=await render(view);
      for(const [variant,samples]of [['A',a],['B',b]])for(const part of ['X','Y'])if(!samples.some(row=>row.part===part&&row.texture?.endsWith('/'+source.textures[variant].asset)))throw new Error('Default actual shader '+tank.id+'/'+part+'/'+variant);
      const before=await engine.readPixels(0,0,engine.getRenderWidth(),engine.getRenderHeight());
      view.trackMovementTarget(0,0);const frozen={...view.trackPhase};view.advanceAnimations(.4);
      if(JSON.stringify(frozen)!==JSON.stringify(view.trackPhase))throw new Error('Stop phase '+tank.id);
      const actions=[];
      for(const action of ['02','03','05','06','07','08','09','01']){
        if(action==='02')await view.motion(true);else if(action==='03')await view.fire();else if(action==='09')await view.life(false);else if(action==='01')await view.life(true);else await view.hurt(Number(action)-4);
        view.trackMovementTarget(-10,0);view.advanceAnimations(.11);
        const samples=await render(view),variant=view.trackPhase.index?'B':'A';
        for(const part of ['X','Y'])if(!samples.some(row=>row.part===part&&row.texture?.endsWith('/'+source.textures[variant].asset)))throw new Error('Action phase '+tank.id+'/'+action+'/'+part);
        actions.push({action,variant,samples});
      }
      for(const variant of ['A','B'])for(const part of ['X','Y'])if(!draws.some(row=>row.part===part&&row.texture?.endsWith('/'+source.textures[variant].asset)))throw new Error('Actual draw '+tank.id+'/'+part+'/'+variant);
      view.position(100,0,100);const afterSnap={...view.trackPhase};view.advanceAnimations(.4);if(JSON.stringify(view.trackPhase)!==JSON.stringify(afterSnap))throw new Error('Snap phase '+tank.id);
      view.dispose();await new Promise(resolve=>setTimeout(resolve,0));
      if(JSON.stringify(counts())!==JSON.stringify(baseline))throw new Error('Resource leak '+tank.id+' '+JSON.stringify(counts())+' '+JSON.stringify(baseline));
      rows.push({tankId:tank.id,embedded:source.recordId,a,b,draws,actions,framebufferBytes:before.length,cleanup:counts()});
    }
    scene.dispose();return rows;
  })()`);
  assert.equal(evidence.rows.length,21);evidence.status='PASS';console.log('PASS: 21 default tank pairs and all action consumers '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(targetId)await command('Target.closeTarget',{targetId}).catch(()=>{});ws.close();}
