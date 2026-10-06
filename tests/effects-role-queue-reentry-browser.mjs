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
  await writeFile('recovery/output/effects-role-queue-reentry-browser.json', JSON.stringify(result, null, 2) + '\n');
  console.log('PASS: Chromium silent original role queue pixels, alternation, cleanup and reentry');
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
    const camera = new FreeCamera('camera', new Vector3(0, 100, -300), scene); camera.setTarget(Vector3.Zero());
    const runtime = new EffectRuntime(scene, camera);
    engine.runRenderLoop(() => scene.render());
    const view = await TankView.load(scene, 'queue-actor', 1);
    await runtime.load(); runtime.attach(view); runtime.start();
    await new Promise(resolve => setTimeout(resolve, 150));
    engine.stopRenderLoop(); scene.onBeforeRenderObservable.remove(runtime.renderObserver);
    const notifications = createSkillEffectNotifications(runtime, catalog, {role: id => id === 47 ? view : undefined, localRole: () => view});
    const battle = new BattleSkillEffects(notifications);
    const play = skillId => battle.event({roomId: 'R1', type: 'itemUsed', message: '', playerId: 'P47', targetId: '', value: 0, x: 0, y: 0, z: 0,
      playSkillEffect: {skillId, effectIndex: 0, duration: 99, roleId: 47, xBits: 0, zBits: 0}});
    const graphics = async (effect, nodes) => {
      const instance = runtime.instances[0];
      check(runtime.instances.length === 1 && instance.tree.root.definition.name === '_root\\online\\'+effect, 'queued root mismatch');
      check(instance.tree.parentMatrix === view.primaryTag('tag_efcenter'), 'queued root wrong attachment');
      for (let tick = 0; tick < 20; ++tick) runtime.update(.025);
      scene.render();
      const meshes = scene.meshes.filter(mesh => nodes.includes(mesh.metadata?.sourceNode));
      check(meshes.length === nodes.length && meshes.every(mesh => mesh.getTotalVertices() > 0), 'queued actual draw missing');
      const actual = new Uint8Array((await engine.readPixels(0,0,256,256)).buffer).slice();
      meshes.forEach(mesh => mesh.setEnabled(false)); scene.render();
      const baseline = new Uint8Array((await engine.readPixels(0,0,256,256)).buffer);
      let changedPixels = 0;
      for (let index = 0; index < actual.length; index += 4) if ([0,1,2].some(channel => actual[index+channel] !== baseline[index+channel])) ++changedPixels;
      meshes.forEach(mesh => mesh.setEnabled(true));
      check(changedPixels > 0, 'queued actual framebuffer unchanged');
      check(runtime.skillSound.voices.size === 0 && runtime.sound.voices.size === 0, 'original silent queue created media');
      return {effect, drawNodes: nodes, changedPixels, mediaVoices: 0};
    };
    const enqueue = () => {
      play(13501); play(13502);
      check(notifications.queues.get(47).length === 2 && runtime.instances.length === 0 && runtime.skillSound.voices.size === 0, 'enqueue started before revival');
      battle.revive('P47');
    };
    enqueue();
    const first = notifications.queues.get(47)[0].effect;
    rounds.push(await graphics('031', [2601,2882]));
    notifications.advanceTimers(5);
    check(notifications.queueTimers.get(47).remaining === 0 && notifications.queues.get(47)[1].effect === undefined && runtime.instances[0].handle === first, 'timer fired at exact zero');
    notifications.advanceTimers(.01);
    check(!runtime.instances.some(instance => instance.handle === first), 'alternation retained first tree');
    const second = notifications.queues.get(47)[1].effect;
    check(second > first, 'second queue handle missing');
    rounds.push(await graphics('032', [2828]));
    notifications.advanceTimers(5); notifications.advanceTimers(.01);
    check(!runtime.instances.some(instance => instance.handle === second) && notifications.queues.get(47)[0].effect > second, 'queue failed to wrap to first');
    rounds.push(await graphics('031', [2601,2882]));
    battle.remove('P47'); runtime.detach(view);
    notifications.advanceTimers(30);
    check(notifications.queues.size === 0 && notifications.queueTimers.size === 0 && runtime.instances.length === 0 && !scene.meshes.some(mesh => [2601,2882,2828].includes(mesh.metadata?.sourceNode)), 'role cleanup restarted queued effect');
    rounds.push({cleanup: 'role removal', timers: 0, queues: 0, instances: 0, mediaVoices: 0});
    battle.clear(); runtime.stop(); runtime.start(); runtime.attach(view);
    scene.onBeforeRenderObservable.remove(runtime.renderObserver);
    enqueue();
    rounds.push({...await graphics('031', [2601,2882]), stage: 'same-scene reentry'});
    notifications.advanceTimers(5); notifications.advanceTimers(.01);
    rounds.push({...await graphics('032', [2828]), stage: 'same-scene reentry'});
    battle.clear(); runtime.stop(); notifications.advanceTimers(30);
    check(notifications.queues.size === 0 && notifications.queueTimers.size === 0 && runtime.instances.length === 0 && runtime.sound.voices.size === 0 && runtime.skillSound.voices.size === 0, 'global cleanup restarted queue');
    const context = runtime.skillSound.context;
    scene.dispose(); await until(() => context.state === 'closed');
    rounds.push({cleanup: 'leave and scene disposal', timers: 0, queues: 0, instances: 0, mediaVoices: 0, context: context.state});
    return {status: 'PASS', sourceInvocation: 'ordinary room-event notification fixture', serverSkillTriggered: false,
      rounds, scope: 'Original silent skill13501/13502 queue with real Chromium Effect31/32 framebuffer; ordinary notifications and revival supplied by fixture, no server trigger/revival business acceptance'};
  } finally {
    window.addEventListener = add; window.removeEventListener = remove;
    engine.dispose(); canvas.remove();
  }
}
