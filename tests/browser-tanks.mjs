import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
if (!endpoint) throw new Error('Usage: node tests/browser-tanks.mjs <Chromium CDP WebSocket URL> [web origin]');
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
const nativeActors = JSON.parse(await readFile('recovery/output/effect-actor-update-native.json', 'utf8')).rows.filter(row=>row.stopped);
const pages = [];
try {
  const {targetId} = await command('Target.createTarget', {url: process.argv[3] ?? 'http://127.0.0.1:5173', newWindow: true});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  pages.push({targetId, sessionId});
  await waitUntil(sessionId, `document.querySelector('#tank')?.options.length===21`);
  const result = await evaluate(sessionId, `(async()=>{
    const source=await (await fetch('/src/main.ts')).text();
    const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore,Vector3}=await import(url);
    const {TankView,tankCatalog}=await import('/src/assets/tanks/tank-view.ts');
    const {EFFECT_PRIMARY_TAGS}=await import('/src/assets/tanks/effect-tag-matrices.ts');
    const {sampleEffectTag}=await import('/src/assets/tanks/effect-tag-sampler.ts');
    const {composeEffectWorldTag}=await import('/src/assets/tanks/effect-tag-world.ts');
    const {effectTurretPivotCorrection}=await import('/src/assets/tanks/effect-turret-pivot.ts');
    const scene=EngineStore.LastCreatedScene;
    const results=[];
    const nativeActors=${JSON.stringify(nativeActors)};
    for (const tank of await tankCatalog()) {
      const view=await TankView.load(scene,'check-'+tank.id,tank.id);
      const tagReferences=new Map(EFFECT_PRIMARY_TAGS.map(name=>[name,view.primaryTag(name)]));
      const parts=scene.getTransformNodeByName('check-'+tank.id+'-action-01').getChildTransformNodes().filter(n=>n.name.startsWith('check-'+tank.id+'-part-'));
      const expectedParts=tank.components.filter(c=>c.actions.length).length;
      if(parts.length!==expectedParts)throw new Error('Part count '+tank.id);
      view.root.position.set(100,20,300);
      view.root.rotation.y=0;
      const pivot=scene.getTransformNodeByName('check-'+tank.id+'-turret').position;
      let vertices=0,maxError=0;
      for (const angle of [0,0.7,-1.1]) {
        view.aim(angle);
        view.root.computeWorldMatrix(true);
        for(const part of parts){
          part.computeWorldMatrix(true);
          const isTurret=part.name.endsWith('-U');
          for(const mesh of part.getChildMeshes()){
            if(!mesh.getTotalVertices())continue;
            mesh.computeWorldMatrix(true);
            const positions=mesh.getVerticesData('position');
            for(let i=0;i<positions.length;i+=3){
              let x=-positions[i],y=positions[i+1],z=positions[i+2];
              if(isTurret){const dx=x-pivot.x,dz=z-pivot.z,c=Math.cos(angle),s=Math.sin(angle);
                x=pivot.x+c*dx-s*dz;z=pivot.z+s*dx+c*dz;}
              const actual=Vector3.TransformCoordinates(new Vector3(positions[i],positions[i+1],positions[i+2]),mesh.getWorldMatrix());
              maxError=Math.max(maxError,Math.hypot(actual.x-(100+x),actual.y-(20+y),actual.z-(300+z)));
              vertices++;
            }
          }
        }
      }
      const meshes=parts.flatMap(p=>p.getChildMeshes()).filter(m=>m.morphTargetManager);
      const weights=()=>meshes.map(m=>Array.from({length:m.morphTargetManager.numTargets},(_,i)=>m.morphTargetManager.getTarget(i).influence));
      const before=weights();
      const deadline=performance.now()+5000;
      let animatedChange=false;
      while(!animatedChange && performance.now()<deadline){
        await new Promise(r=>setTimeout(r,100));
        animatedChange=JSON.stringify(before)!==JSON.stringify(weights());
      }
      const engine=scene.getEngine(),loops=[...engine.activeRenderLoops];
      engine.stopRenderLoop();
      let nativeTicks=0;
      try{
        await view.motion(true);
        if(view.activeAction!=='02')throw new Error('Movement action '+tank.id);
        for(const name of ['03','09']){
          if(name==='03')await view.fire();else await view.life(false);
          if(view.activeAction!==name)throw new Error('Action '+tank.id+'/'+name);
          const oracle=nativeActors.filter(row=>row.action.tankId===tank.id&&row.action.action===name);
          for(let step=0;step<oracle[0].steps.length;step++){
            const pose=step%2===0?{position:[-100,20,300],yaw:0,turretYaw:-1.1*180/Math.PI}:
              {position:[-713,1,205.125],yaw:-37.5,turretYaw:-80};
            view.root.rotation.y=-pose.yaw*Math.PI/180;
            view.position(...pose.position);
            view.aim((pose.turretYaw-pose.yaw)*Math.PI/180);
            const delta=oracle[0].steps[step].delta,messages=view.advanceAnimations(delta);
            for(const row of oracle){
              const expected=row.steps[step],clock=view.root.metadata.actionClocks.find(c=>c.part===row.action.part);
              if(clock.time!==expected.time||clock.overMessage!==expected.overMessage)throw new Error('Native actor state '+tank.id+'/'+row.action.part+'/'+name+'/'+step);
              const ids=messages.filter(m=>m.part===row.action.part).map(m=>m.identifier);
              if(JSON.stringify(ids)!==JSON.stringify(expected.messages))throw new Error('Native actor messages '+tank.id+'/'+row.action.part+'/'+name+'/'+step);
              const component=view.current.components.find(c=>c.part===row.action.part);
              for(const group of component.assets.animationGroups){
                const fps=group.targetedAnimations[0].animation.framePerSecond;
                const frame=(expected.time%row.action.duration)/1000*fps;
                for(const track of group.targetedAnimations){
                  const keys=track.animation.getKeys();
                  let value=keys[0].value;
                  for(let key=1;key<keys.length;key++){
                    const left=keys[key-1],right=keys[key];
                    if(frame>=right.frame){value=right.value;continue;}
                    if(frame>left.frame)value=left.value+(right.value-left.value)*(frame-left.frame)/(right.frame-left.frame);
                    break;
                  }
                  if(Math.abs(track.target.influence-value)>0.00001)throw new Error('Native tick GLB morph sample '+tank.id+'/'+row.action.part+'/'+name+'/'+step);
                }
              }
              nativeTicks++;
            }
            const fourPart=tank.components.some(c=>c.part==='U'&&c.actions.length>0);
            const pivotFrames=tank.components.find(c=>c.part==='M')?.actions.find(a=>a.fields.name==='01')?.turretPivotFrames;
            const pivot=pivotFrames?.length?sampleEffectTag(pivotFrames,1):undefined;
            const correction=effectTurretPivotCorrection(pivot?[pivot[12],pivot[14]]:[0,0],pose.yaw,pose.turretYaw,[0,1,0]);
            for(const tag of EFFECT_PRIMARY_TAGS){
              const sources=['M',...(fourPart?['U']:[])].map(part=>({part,
                track:tank.components.find(c=>c.part===part)?.actions.find(a=>a.fields.name===name)?.primaryTags.find(t=>t.name===tag)}));
              const source=sources.find(s=>s.track);
              const local=source?sampleEffectTag(source.track.frames,oracle.find(row=>row.action.part===source.part).steps[step].time):Array(16).fill(0);
              const expected=composeEffectWorldTag(local,{...pose,pivot:[correction[0],correction[2]]},fourPart&&tag==='tag_efattack');
              const matrix=view.primaryTag(tag);
              if(matrix!==tagReferences.get(tag))throw new Error('Unstable primary tag reference '+tank.id+'/'+tag);
              if(matrix.some((value,index)=>Math.abs(value-expected[index])>0.00001))throw new Error('Live primary tag '+tank.id+'/'+name+'/'+tag+'/'+step);
            }
          }
          if(name==='03'){
            await view.motion(false);
            if(view.activeAction!=='01')throw new Error('Attack completion '+tank.id);
          }else{
            await view.motion(true);await view.fire();
            if(view.activeAction!=='09'||!view.root.isEnabled())throw new Error('Death priority '+tank.id);
          }
        }
        await view.life(true);
        if(view.activeAction!=='01')throw new Error('Revival action '+tank.id);
      }finally{for(const loop of loops)engine.runRenderLoop(loop);}
      const enabled=scene.transformNodes.filter(n=>n.name.startsWith('check-'+tank.id+'-action-') && !n.name.endsWith('-turret') && n.isEnabled());
      if(enabled.length!==1)throw new Error('Action visibility '+tank.id);
      results.push({id:tank.id,parts:parts.length,vertices,maxError,animatedChange,nativeTicks,primaryTagChecks:nativeTicks/parts.length*7,primaryReferencesCleared:true,actions:['01','02','03','01','09','01']});
      view.dispose();
      if(scene.transformNodes.some(n=>n.name==='check-'+tank.id))throw new Error('Dispose '+tank.id);
      if([...tagReferences.values()].some(m=>m.some(v=>v!==0)))throw new Error('Disposed tag reference '+tank.id);
    }
    const pendingView=await TankView.load(scene,'pending-dispose',1);
    const pendingFire=pendingView.fire();
    pendingView.dispose();
    await pendingFire.catch(error=>{
      if(!String(error).includes('战车已释放'))throw error;
    });
    await new Promise(r=>setTimeout(r,0));
    if(scene.transformNodes.some(n=>n.name.startsWith('pending-dispose')) ||
       scene.meshes.some(m=>m.name.startsWith('pending-dispose'))){
      throw new Error('Pending action disposal leaked nodes');
    }
    return results;
  })()`);
  assert.equal(result.length,21);
  await writeFile('recovery/output/browser-tanks.json', JSON.stringify(result,null,2));
  for(const tank of result){
    assert(tank.vertices>0);
    assert(tank.maxError<0.0001, `Source part transform ${tank.id}: ${tank.maxError}`);
    assert(tank.animatedChange, `Source morph animation ${tank.id}`);
  }
  console.log(`PASS: all 21 source tank assemblies, native vertices, turret angles, movement/fire/death/revival and pending disposal`);
} finally {
  for (const page of pages) await command('Target.closeTarget', {targetId: page.targetId});
  ws.close();
}
