import assert from 'node:assert/strict';
import {writeFile, readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const WebSocket = createRequire(import.meta.url)('ws');
const endpoint = process.argv[2];
assert(endpoint, 'Usage: node tests/browser-tank-actor-clock-sol.mjs <CDP WebSocket URL>');
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
const fixture=JSON.parse(await readFile('recovery/output/tank-actor-clock-native-sol.json','utf8'));
const getter=JSON.parse(await readFile('recovery/output/effect-model-source-state-native.json','utf8')).deltaRows;
var tankViewUrl='/@fs'+fileURLToPath(new URL('../apps/web/src/assets/tanks/tank-view.ts',import.meta.url));
var effectAnimationUrl='/@fs'+fileURLToPath(new URL('../apps/web/src/render/effects/models/effect-model-animation.ts',import.meta.url));
const vite=await createServer({configFile:'tools/asset-viewer/vite.config.ts',server:{port:5202,strictPort:true,host:'127.0.0.1',hmr:false}});
await vite.listen();
let targetId;
try {
  ({targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5202'}));
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
  const ready=`(async()=>{const deadline=Date.now()+45000;while(Date.now()<deadline){if(document.querySelector('#model')?.options.length>=745&&!document.querySelector('#model').disabled)return;await new Promise(r=>setTimeout(r,100));}throw new Error('Asset viewer not ready');})()`;
  for(let attempt=0;;attempt++){
    try{await evaluate(sessionId,ready);break;}catch(error){
      if(attempt>4||(!String(error).includes('Execution context was destroyed')&&!String(error).includes('Inspected target navigated')))throw error;
    }
  }
  const result=await evaluate(sessionId,`(async()=>{
    const fixture=${JSON.stringify(fixture)},getter=${JSON.stringify(getter)};
    const source=await(await fetch('/main.ts')).text();
    const module=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(module),{TankView}=await import(${JSON.stringify(tankViewUrl)});
    const {effectModelEngineDelta}=await import(${JSON.stringify(effectAnimationUrl)});
    const scene=EngineStore.LastCreatedScene,engine=scene.getEngine();
    const loops=[...engine.activeRenderLoops],getDeltaTime=engine.getDeltaTime;
    engine.stopRenderLoop();
    const original=scene.meshes.filter(mesh=>mesh.isEnabled());original.forEach(mesh=>mesh.setEnabled(false));
    const counts=()=>({meshes:scene.meshes.length,materials:scene.materials.length,textures:scene.textures.length,observers:scene.onBeforeRenderObservable.observers.length});
    const before=counts();let view;const modes=[],getters=[];
    try{
      for(const row of getter){const actual=effectModelEngineDelta(row.input);if(actual!==row.output)throw new Error('Native getter mismatch '+row.input);getters.push({...row,actual});}
      for(const mode of ['idle','fire-suspended','fire-direct']){
        view=await TankView.loadPreview(scene,'source-clock-'+mode,1);
        if(mode!=='idle')await view.fire();
        const reference=fixture.rows.filter(row=>row.mode===mode);
        const notifications=[];view.actionMessages.add(message=>notifications.push({...message}));
        const steps=[];
        for(let index=0;index<reference[0].steps.length;index++){
          const input=reference[0].steps[index].inputSeconds;
          const delta=reference[0].steps[index].delta;
          notifications.length=0;
          if(mode==='fire-direct')view.advanceAnimations(input);
          else{engine.getDeltaTime=()=>input*1000;scene.onBeforeRenderObservable.notifyObservers(scene);}
          const components=view.current.components;
          const clocks=components.map(component=>({part:component.part,time:component.clock.time,overMessage:component.clock.overMessage}));
          const expected=reference.map(row=>({part:row.action.part,time:row.steps[index].time,overMessage:row.steps[index].overMessage}));
          if(JSON.stringify(clocks)!==JSON.stringify(expected))throw new Error('Clock '+mode+' '+index+' '+JSON.stringify({clocks,expected}));
          const messages=reference.flatMap(row=>row.steps[index].messages.map(identifier=>({part:row.action.part,action:mode==='idle'?'01':'03',time:row.steps[index].time,identifier})));
          if(JSON.stringify(notifications)!==JSON.stringify(messages))throw new Error('Messages '+mode+' '+index+' '+JSON.stringify({actual:notifications,messages}));
          if(view.root.metadata.action!==(mode==='idle'?'01':'03'))throw new Error('Root action metadata');
          const metadata=view.root.metadata.actionClocks.map(({part,time,overMessage})=>({part,time,overMessage}));
          if(JSON.stringify(metadata)!==JSON.stringify(expected))throw new Error('Root clock metadata');
          steps.push({inputSeconds:input,sourceDelta:delta,clocks,messages:notifications.map(message=>({...message})),metadata:view.root.metadata,firing:view.firing});
        }
        if(mode!=='idle'&&view.firing!==false)throw new Error('Firing completion not cleared');
        modes.push({mode,steps});view.dispose();view=undefined;
        await new Promise(resolve=>setTimeout(resolve,100));
        if(JSON.stringify(counts())!==JSON.stringify(before))throw new Error('Dispose counts '+JSON.stringify({before,after:counts()}));
      }
      return {getters,modes,before,after:counts(),restoredLoopCount:loops.length};
    }finally{
      view?.dispose();engine.getDeltaTime=getDeltaTime;
      original.forEach(mesh=>mesh.setEnabled(true));loops.forEach(loop=>engine.runRenderLoop(loop));
      if(engine.getDeltaTime!==getDeltaTime||engine.activeRenderLoops.length!==loops.length)throw new Error('Engine restoration');
    }
  })()`);
  assert.equal(result.modes.length,3);assert.deepEqual(result.before,result.after);
  assert.equal(result.modes.find(mode=>mode.mode==='fire-suspended').steps[0].sourceDelta,Math.fround(.1));
  assert.equal(result.modes.find(mode=>mode.mode==='fire-direct').steps[0].sourceDelta,2);
  const evidence={status:'PASS',scope:'Source clock replay through production scene onBeforeRender; asset viewer only, no combat state injection or performance claim.',...result};
  await writeFile('recovery/output/browser-tank-actor-clock-sol.json',JSON.stringify(evidence,null,2));
  console.log('PASS: native getter11 samples, actual beforeRender tank1 idle/fire clocks60 componentticks and events, longframe float32 clamp, direct raw delta, metadata and asynchronous cleanup');
}finally{
  if(targetId)await command('Target.closeTarget',{targetId});ws.close();await vite.close();
}
