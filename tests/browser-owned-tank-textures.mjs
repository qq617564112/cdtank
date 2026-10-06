import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

const WebSocket = createRequire(import.meta.url)('ws');
const endpoint = process.argv[2];
assert(endpoint, 'Usage: node tests/browser-owned-tank-textures.mjs <CDP WebSocket URL> [web origin]');
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
    const source=await(await fetch('/src/main.ts')).text();
    const module=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore,PBRMaterial}=await import(module);
    const {TankView}=await import('/src/assets/tanks/tank-view.ts');
    const scene=EngineStore.LastCreatedScene,engine=scene.getEngine();
    const loops=[...engine.activeRenderLoops];engine.stopRenderLoop();
    const original=scene.meshes.filter(mesh=>mesh.isEnabled());original.forEach(mesh=>mesh.setEnabled(false));
    const counts=()=>({meshes:scene.meshes.length,materials:scene.materials.length,textures:scene.textures.length});
    const catalog=await(await fetch('/tank-textures.json')).json();
    const rows=[];
    const ids={U:10011,M:10012,XY:10013}, alternate={U:10021,M:10022,XY:10023};
    // GLB PBR imports initialize the scene-owned BRDF lookup, which survives material disposal.
    const warmup=new PBRMaterial('owned-textures-brdf-warmup',scene);
    warmup.dispose();
    const sharedBrdf=scene.environmentBRDFTexture;
    if(!sharedBrdf||!scene.textures.includes(sharedBrdf))throw new Error('Scene BRDF lookup missing');
    const beforeTextures=[...scene.textures];
    const before=counts();
    function verifyTextures(){
      if(scene.environmentBRDFTexture!==sharedBrdf||scene.textures.some(texture=>!beforeTextures.includes(texture))||
          beforeTextures.some(texture=>!scene.textures.includes(texture)))throw new Error('Actor cleanup changed texture identity');
    }
    const first=await TankView.load(scene,'skin-first',1,ids);
    const second=await TankView.load(scene,'skin-second',1,alternate);
    function inspect(view,expected){
      const components=[];
      for(const component of view.current.components){
        const part=component.part==='X'||component.part==='Y'?'XY':component.part;
        const id=expected[part];if(id===undefined)continue;
        const path=catalog.rows.find(row=>row.recordId===id).textures.A.asset;
        const meshes=component.assets.meshes.filter(mesh=>mesh.getTotalVertices()>0);
        for(const mesh of meshes){
          const material=mesh.material;if(!material.metadata?.originalMV3)throw new Error('Expected original shader '+part);
          const texture=material.getActiveTextures()[0];
          if(!texture?.url.endsWith('/'+path))throw new Error('Wrong component texture '+part+' '+texture?.url);
          if(texture.samplingMode!==2||texture.wrapU!==1||texture.wrapV!==1)throw new Error('Sampler');
          if(component.assets.textures.includes(texture))throw new Error('Actor texture belongs to action container');
          awaitCompile.push(material.forceCompilationAsync(mesh));
        }
        components.push({part:component.part,id,meshes:meshes.length,path});
      }
      return components;
    }
    let awaitCompile=[];
    try{
      for(const action of ['01','02','03','09','01']){
        for(const view of [first,second]){
          if(action==='02')await view.motion(true);
          if(action==='03')await view.fire();
          if(action==='09')await view.life(false);
          if(action==='01'&&view.activeAction==='09')await view.life(true);
        }
        awaitCompile=[];
        const a=inspect(first,ids),b=inspect(second,alternate);
        await Promise.all(awaitCompile);scene.render();
        for(const key of ['U','M','XY'])if(first.textures.get(key)===second.textures.get(key))throw new Error('Actor texture identity shared');
        for(const view of [first,second]){
          const path=catalog.rows.find(row=>row.recordId===view.tankTextures.XY).textures.B.asset;
          if(!view.textures.get('XY-B')?.url.endsWith('/'+path))throw new Error('Original XY B preload');
        }
        if(first.textures.get('XY')!==first.current.components.find(row=>row.part==='X').assets.meshes.find(mesh=>mesh.getTotalVertices()>0).material.getActiveTextures()[0])throw new Error('XY A ownership');
        rows.push({action,first:a,second:b});
      }
      first.dispose();await new Promise(resolve=>setTimeout(resolve,100));
      awaitCompile=[];inspect(second,alternate);await Promise.all(awaitCompile);scene.render();
      second.dispose();await new Promise(resolve=>setTimeout(resolve,100));
      verifyTextures();
      if(JSON.stringify(counts())!==JSON.stringify(before))throw new Error('Actor cleanup '+JSON.stringify({before,after:counts()}));
      let failure='';try{await TankView.load(scene,'skin-invalid',1,{U:0xffffffff,M:0,XY:0});}catch(error){failure=String(error);}
      if(!failure.includes('4294967295'))throw new Error('Missing selected texture did not fail');
      let crossTank='';try{await TankView.load(scene,'skin-cross-tank',1,{U:20011,M:0,XY:0});}catch(error){crossTank=String(error);}
      if(!crossTank.includes('20011'))throw new Error('Cross tank source did not fail');
      await new Promise(resolve=>setTimeout(resolve,100));
      verifyTextures();
      if(JSON.stringify(counts())!==JSON.stringify(before))throw new Error('Failed load leaked');
      const type4Ids={U:0xffffffff,M:catalog.rows.find(row=>row.tankId===151&&row.part==='M'&&row.textures.A.asset).recordId,
        XY:catalog.rows.find(row=>row.tankId===151&&row.part==='XY'&&row.textures.A.asset).recordId};
      const type4=await TankView.load(scene,'skin-no-turret',151,type4Ids);
      if(type4.textures.has('U'))throw new Error('Empty turret component requested texture');
      const type4Parts=type4.current.components.map(component=>component.part);
      type4.dispose();await new Promise(resolve=>setTimeout(resolve,100));
      verifyTextures();
      if(JSON.stringify(counts())!==JSON.stringify(before))throw new Error('Type4 load leaked');
      return {rows,before,after:counts(),sceneBrdf:{name:sharedBrdf.name,retainedIdentity:true},failure,crossTank,type4Parts};
    }finally{first.dispose();second.dispose();original.forEach(mesh=>mesh.setEnabled(true));loops.forEach(loop=>engine.runRenderLoop(loop));}
  })()`);
  assert.equal(result.rows.length,5);
  assert.deepEqual(result.before,result.after);
  await writeFile('recovery/output/browser-owned-tank-textures.json',JSON.stringify({...result,status:'PASS'},null,2));
  console.log('PASS: two owned tank skins across idle/move/fire/death/revive, exact component textures/sampler/shader, independent identity, survivor render and asynchronous cleanup');
} finally {
  if(targetId)await command('Target.closeTarget',{targetId});
  ws.close();
}
