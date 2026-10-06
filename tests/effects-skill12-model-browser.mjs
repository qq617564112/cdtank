import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
if (!endpoint) throw new Error('Usage: node tests/browser-effect-model.mjs <Chromium CDP WebSocket URL>');
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
let target;
try {
  target = (await command('Target.createTarget', {url: 'about:blank'})).targetId;
  const session = (await command('Target.attachToTarget', {targetId: target, flatten: true})).sessionId;
  await command('Page.enable', {}, session);
  await command('Page.navigate', {url: 'http://127.0.0.1:5209/does-not-exist'}, session);
  await waitUntil(session, 'document.readyState === "complete"');
  const result = await evaluate(session, `(${browserCheck.toString()})()`);
  assert.equal(result.status, 'PASS');
  await writeFile('recovery/output/effects-skill12-model-browser.json', JSON.stringify(result, null, 2) + '\n');
  console.log('PASS: Chromium Skill12 model live attachment, role isolation, GA35 natural audio and reentry');
} finally {
  if (target) await command('Target.closeTarget', {targetId: target});
  ws.close();
}

async function browserCheck() {
  const {Engine, Scene, FreeCamera, Vector3, Color4} = await import('/@fs/workspace/cdtank/node_modules/@babylonjs/core/index.js');
  const {EffectRuntime} = await import('/@fs/workspace/cdtank/apps/web/src/render/effects/runtime/effect-runtime.ts');
  const {TankView} = await import('/@fs/workspace/cdtank/apps/web/src/assets/tanks/tank-view.ts');
  const {createSkillEffectNotifications} = await import('/@fs/workspace/cdtank/apps/web/src/match/skills/skill-effect-runtime.ts');
  const {BattleSkillEffects} = await import('/@fs/workspace/cdtank/apps/web/src/match/skills/battle-skill-effects.ts');
  const catalog = await (await fetch('/combat-catalog.json')).json();
  const check = (condition, message) => {if (!condition) throw new Error(message);};
  const until = async condition => {
    const deadline = Date.now() + 10000;
    while (!condition()) {if (Date.now() >= deadline) throw new Error('Audio lifecycle timeout'); await new Promise(resolve => setTimeout(resolve, 20));}
  };
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256; document.body.append(canvas);
  const engine = new Engine(canvas, false, {preserveDrawingBuffer: true});
  const rounds = [];
  const add = window.addEventListener, remove = window.removeEventListener;
  const callbacks = new Set();
  window.addEventListener = function(name, listener, options) {
    if (name === 'pointerdown' || name === 'keydown') callbacks.add(listener);
    return add.call(this, name, listener, options);
  };
  window.removeEventListener = function(name, listener, options) {
    callbacks.delete(listener); return remove.call(this, name, listener, options);
  };
  try {
    const scene = new Scene(engine); scene.clearColor = new Color4(.05, .1, .15, 1);
    const camera = new FreeCamera('camera', new Vector3(0,100,-300), scene); camera.setTarget(Vector3.Zero());
    camera.mode = 1; camera.orthoLeft = camera.orthoBottom = -200; camera.orthoRight = camera.orthoTop = 200;
    const runtime = new EffectRuntime(scene,camera); engine.runRenderLoop(() => scene.render());
    const views = await Promise.all([TankView.load(scene,'skill12-left',1),TankView.load(scene,'skill12-right',1)]);
    views[0].root.position.x = -70; views[1].root.position.x = 70;
    await runtime.load(); views.forEach(view => runtime.attach(view)); runtime.start();
    await new Promise(resolve => setTimeout(resolve,150));
    engine.stopRenderLoop(); scene.onBeforeRenderObservable.remove(runtime.renderObserver);
    const notifications = createSkillEffectNotifications(runtime,catalog,{role:id => views[id-47],localRole:() => views[0]});
    const battle = new BattleSkillEffects(notifications);
    const play = roleId => battle.event({roomId:'R1',type:'itemUsed',message:'',playerId:'P'+roleId,targetId:'',value:0,x:0,y:0,z:0,
      playSkillEffect:{skillId:12,effectIndex:0,duration:0,roleId,xBits:0,zBits:0}});
    const models = instance => instance.draws.flatMap(draw => draw.model?.meshes ?? []);
    const pixels = async meshes => {
      scene.render(); await Promise.all(meshes.map(mesh => mesh.material.forceCompilationAsync(mesh))); scene.render();
      const actual = new Uint8Array((await engine.readPixels(0,0,256,256)).buffer).slice();
      meshes.forEach(mesh => mesh.setEnabled(false)); scene.render();
      const baseline = new Uint8Array((await engine.readPixels(0,0,256,256)).buffer);
      let changedPixels = 0;
      for(let index=0;index<actual.length;index+=4) if([0,1,2].some(channel => actual[index+channel]!==baseline[index+channel])) ++changedPixels;
      meshes.forEach(mesh => mesh.setEnabled(true)); check(changedPixels>0,'Skill12 model actual framebuffer unchanged'); return changedPixels;
    };
    for(const cleanup of ['explicit stop','role removal']) {
      play(47); play(48);
      check(runtime.instances.length===2 && notifications.records.length===0,'Skill12 one-shot creation mismatch');
      const [first,survivor]=runtime.instances;
      check(first.tree.parentMatrix===views[0].primaryTag('tag_efcenter') && survivor.tree.parentMatrix===views[1].primaryTag('tag_efcenter'),'Skill12 actor attachment mismatch');
      const voices=[...runtime.skillSound.voices.values()];
      check(voices.length===2 && voices.every(voice=>!voice.audio.loop && voice.audio.src.endsWith('/GA35.wav')),'Skill12 original GA35 selection mismatch');
      await Promise.all(voices.map(voice=>voice.audio.play()));
      await until(()=>voices.every(voice=>voice.audio.currentTime>0 && !voice.audio.paused));
      for(let tick=0;tick<11;++tick) runtime.update(.05);
      const firstModels=models(first), survivorModels=models(survivor);
      check(firstModels.length>0 && survivorModels.length===firstModels.length,'Skill12 type5 model draws missing');
      check([...firstModels,...survivorModels].every(mesh => mesh.metadata.sourceModel === 'data\\effect\\effect\\online\\00012.cvd' &&
        mesh.material.getActiveTextures().some(texture => texture.name.endsWith('/Data/effect/effect/online/00012A.png'))), 'Skill12 model original texture/material missing');
      const changedPixels=await pixels([...firstModels,...survivorModels]);
      const mesh=firstModels[0], before=Array.from(mesh.getVerticesData('position'));
      first.tree.parentMatrix[12]+=20; runtime.update(0);
      const after=mesh.getVerticesData('position');
      for(let index=0;index<before.length;index+=3) check(Math.abs(after[index]-before[index]+20)<.0001,'Skill12 model live matrix did not move');
      if(cleanup==='explicit stop') runtime.stopEffect(first.handle);
      else {battle.remove('P47'); runtime.detach(views[0]);}
      check(runtime.instances.length===1 && runtime.instances[0]===survivor && firstModels.every(mesh=>mesh.isDisposed()),'Skill12 cleanup released wrong model');
      check(survivorModels.every(mesh=>!mesh.isDisposed() && mesh.getTotalVertices()>0),'surviving model was disposed');
      check(voices.every(voice=>!voice.audio.paused),'one-shot model cleanup stopped independent GA35');
      const survivorTime=voices[1].audio.currentTime; await until(()=>voices[1].audio.currentTime>survivorTime);
      const survivorPixels=await pixels(survivorModels);
      for(let tick=0;tick<400 && runtime.instances.length;++tick) runtime.update(.025);
      check(runtime.instances.length===0 && survivorModels.every(mesh=>mesh.isDisposed()),'Skill12 model natural expiry retained graphics');
      await until(()=>voices.every(voice=>voice.audio.ended) && runtime.skillSound.voices.size===0);
      rounds.push({cleanup,changedPixels,survivorPixels,modelSections:firstModels.length*2,liveAttachment:true,
        survivorObjectsPreserved:true,independentGA35Continued:true,naturalExpiry:true,naturallyEnded:true,instances:0,voices:0});
      if(cleanup==='role removal') runtime.attach(views[0]);
      scene.onBeforeRenderObservable.remove(runtime.renderObserver);
    }
    const context=runtime.skillSound.context;
    battle.clear(); runtime.stop(); runtime.start(); play(47);
    for(let tick=0;tick<11;++tick)runtime.update(.05);
    const reentryPixels=await pixels(models(runtime.instances[0]));
    const reentered=[...runtime.skillSound.voices.values()][0];await reentered.audio.play();
    await until(()=>reentered.audio.currentTime>0 && !reentered.audio.paused);
    check(runtime.skillSound.context===context,'Skill12 reentry changed sound context');
    battle.clear(); runtime.stop();check(reentered.audio.paused && runtime.instances.length===0 && runtime.skillSound.voices.size===0,'Skill12 leave retained resources');
    scene.dispose();await until(()=>context.state==='closed');
    rounds.push({cleanup:'same-scene reentry and terminal leave',changedPixels:reentryPixels,contextPreserved:true,leavePaused:true,instances:0,voices:0,context:context.state});
    return {status: 'PASS', sourceInvocation: 'ordinary room-event notification fixture', serverSkillTriggered: false,
      rounds, scope: 'Original Skill12 Effect19/GA35 production notification and model rendering; supplied ordinary notification input, not new server skill qualification'};
  } finally {
    window.addEventListener = add; window.removeEventListener = remove;
    engine.dispose(); canvas.remove();
  }
}
