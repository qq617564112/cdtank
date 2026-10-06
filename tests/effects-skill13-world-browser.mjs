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
  await writeFile('recovery/output/effects-skill13-world-browser.json', JSON.stringify(result, null, 2) + '\n');
  console.log('PASS: Chromium Skill13 world positions, draw isolation, silent audio and reentry');
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
    const scene = new Scene(engine); scene.clearColor = new Color4(.05,.1,.15,1);
    const camera = new FreeCamera('camera',new Vector3(0,150,-350),scene);camera.setTarget(Vector3.Zero());
    const runtime = new EffectRuntime(scene,camera);await runtime.load();runtime.start();
    camera.getViewMatrix(true);camera.getProjectionMatrix(true);
    const notifications=createSkillEffectNotifications(runtime,catalog,{role:()=>undefined,localRole:()=>undefined});
    const battle=new BattleSkillEffects(notifications);
    const bits=value=>{const buffer=new ArrayBuffer(4);new DataView(buffer).setFloat32(0,value,true);return new DataView(buffer).getUint32(0,true);};
    const play=(x,z)=>battle.event({roomId:'R1',type:'itemUsed',message:'',playerId:'P47',targetId:'',value:0,x:0,y:0,z:0,
      playSkillEffect:{skillId:13,effectIndex:0,duration:0,roleId:0,xBits:bits(x),zBits:bits(z)}});
    const nodes=[2463,2464,2465,2466,2467,2468,2559,2560];
    const graphics=async instances=>{
      const seen=new Set();
      for(let tick=0;tick<50;++tick){runtime.update(.025);scene.meshes.filter(mesh=>nodes.includes(mesh.metadata?.sourceNode)&&mesh.getTotalVertices()>0).forEach(mesh=>seen.add(mesh.metadata.sourceNode));if(seen.size===8)break;}
      check(seen.size===8,'world original eight geometry nodes missing');scene.render();
      const meshes=scene.meshes.filter(mesh=>nodes.includes(mesh.metadata?.sourceNode));
      check(meshes.length===instances*8,'world instance draw count mismatch');
      const actual=new Uint8Array((await engine.readPixels(0,0,256,256)).buffer).slice();meshes.forEach(mesh=>mesh.setEnabled(false));scene.render();
      const baseline=new Uint8Array((await engine.readPixels(0,0,256,256)).buffer);let changedPixels=0;
      for(let index=0;index<actual.length;index+=4)if([0,1,2].some(channel=>actual[index+channel]!==baseline[index+channel]))++changedPixels;
      meshes.forEach(mesh=>mesh.setEnabled(true));check(changedPixels>0,'world framebuffer unchanged');return {changedPixels,drawNodes:[...seen].sort((a,b)=>a-b)};
    };
    play(-60,0);play(60,0);check(runtime.instances.length===2,'two world notifications missing');
    const [first,survivor]=runtime.instances;
    check(first.tree.origin[0]===-60&&survivor.tree.origin[0]===60&&!first.tree.parentMatrix&&!survivor.tree.parentMatrix,'world original coordinate bits or parent mismatch');
    rounds.push({...await graphics(2),stage:'two world instances'});
    check(runtime.skillSound.voices.size===0&&runtime.sound.voices.size===0,'world path incorrectly played outer SE02');
    battle.remove('P47');check(runtime.instances.length===2,'role removal removed ownerless world effect');
    const survivorMeshes=survivor.draws.map(draw=>draw.sprite?.mesh??draw.particle?.sprite.mesh).filter(Boolean);
    runtime.stopEffect(first.handle);check(runtime.instances.length===1&&runtime.instances[0]===survivor&&survivorMeshes.every(mesh=>!mesh.isDisposed()),'world stop removed survivor');
    rounds.push({...await graphics(1),stage:'one world stopped; survivor preserved'});
    for(let tick=0;tick<400&&runtime.instances.length;++tick)runtime.update(.025);
    check(runtime.instances.length===0&&survivorMeshes.every(mesh=>mesh.isDisposed()),'world natural expiry retained meshes');
    const outsideBefore=runtime.instances.length;play(10000,0);check(runtime.instances.length===outsideBefore,'outside world point created instance');
    runtime.stop();runtime.start();play(20,0);rounds.push({...await graphics(1),stage:'same-scene reentry'});
    battle.clear();runtime.stop();check(runtime.instances.length===0&&runtime.skillSound.voices.size===0&&runtime.sound.voices.size===0,'world leave retained state');
    const context=runtime.skillSound.context;scene.dispose();await until(()=>context.state==='closed');
    rounds.push({cleanup:'natural expiry, clipped world, leave',instances:0,mediaVoices:0,context:context.state});
    return {status: 'PASS', sourceInvocation: 'ordinary room-event notification fixture', serverSkillTriggered: false,
      rounds, scope: 'Original role0 Skill13 world Effect10, source coordinates, real framebuffer and silent handler; supplied notification input, not server bombardment qualification'};
  } finally {
    window.addEventListener = add; window.removeEventListener = remove;
    engine.dispose(); canvas.remove();
  }
}
