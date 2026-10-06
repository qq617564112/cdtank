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
  await writeFile('recovery/output/effects-retained-role-isolation-browser.json', JSON.stringify(result, null, 2) + '\n');
  console.log('PASS: Chromium retained roles Effect3/GA16 isolation, expiry, removal and same-scene reentry');
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
    const camera = new FreeCamera('camera', new Vector3(0, 150, -350), scene); camera.setTarget(Vector3.Zero());
    const runtime = new EffectRuntime(scene, camera);
    engine.runRenderLoop(() => scene.render());
    const views = await Promise.all([TankView.load(scene, 'retained-left', 1), TankView.load(scene, 'retained-right', 1)]);
    views[0].root.position.x = -70; views[1].root.position.x = 70;
    await runtime.load(); views.forEach(view => runtime.attach(view)); runtime.start();
    await new Promise(resolve => setTimeout(resolve, 150));
    engine.stopRenderLoop(); scene.onBeforeRenderObservable.remove(runtime.renderObserver);
    const notifications = createSkillEffectNotifications(runtime, catalog, {role: id => views[id - 47], localRole: () => views[0]});
    const battle = new BattleSkillEffects(notifications);
    const play = (roleId, skillId, duration = 3) => battle.event({roomId: 'R1', type: 'itemUsed', message: '', playerId: 'P'+roleId, targetId: '', value: 0, x: 0, y: 0, z: 0,
      playSkillEffect: {skillId, effectIndex: 0, duration, roleId, xBits: 0, zBits: 0}});
    const stop = (roleId, skillId) => battle.event({roomId: 'R1', type: 'itemUsed', message: '', playerId: 'P'+roleId, targetId: '', value: 0, x: 0, y: 0, z: 0, stopSkillEffect: {roleId, skillId}});
    const graphics = async instances => {
      for (let tick = 0; tick < 30; ++tick) runtime.update(.025);
      scene.render();
      const drawMeshes = scene.meshes.filter(mesh => [2428,2436,2525,2627].includes(mesh.metadata?.sourceNode));
      check(drawMeshes.length === instances * 4, 'Effect3 four actual draws per actor missing');
      const actual = new Uint8Array((await engine.readPixels(0,0,256,256)).buffer).slice();
      drawMeshes.forEach(mesh => mesh.setEnabled(false)); scene.render();
      const baseline = new Uint8Array((await engine.readPixels(0,0,256,256)).buffer);
      let changedPixels = 0;
      for (let index = 0; index < actual.length; index += 4) if ([0,1,2].some(channel => actual[index+channel] !== baseline[index+channel])) ++changedPixels;
      drawMeshes.forEach(mesh => mesh.setEnabled(true));
      check(changedPixels > 0, 'Effect3 actual framebuffer unchanged');
      return changedPixels;
    };
    const media = async () => {
      const voices = [...runtime.skillSound.voices.values()];
      check(voices.length === 2 && voices.every(voice => voice.audio.loop && voice.audio.src.endsWith('/GA16.wav')), 'retained GA16 loop selection mismatch');
      await Promise.all(voices.map(voice => voice.audio.play()));
      await until(() => voices.every(voice => !voice.audio.paused && voice.audio.currentTime > 0));
      return voices;
    };
    for (const cleanup of ['stop notification', 'role removal']) {
      play(47,10); play(48,11);
      check(notifications.records.length === 2 && runtime.instances.length === 2, 'two retained notifications missing');
      const [firstRecord, survivorRecord] = notifications.records;
      const survivor = runtime.instances.find(instance => instance.handle === survivorRecord.effect);
      check(survivor.tree.parentMatrix === views[1].primaryTag('tag_efcenter'), 'survivor wrong attachment');
      const [firstVoice, survivorVoice] = await media();
      const changedPixels = await graphics(2);
      const survivorMeshes = survivor.draws.map(draw => draw.sprite?.mesh ?? draw.particle?.sprite.mesh).filter(Boolean);
      if (cleanup === 'stop notification') stop(47,10);
      else {battle.remove('P47'); runtime.detach(views[0]);}
      check(firstVoice.audio.paused && !survivorVoice.audio.paused, 'one role cleanup affected wrong audio');
      check(notifications.records.length === 1 && notifications.records[0] === survivorRecord, 'survivor notification changed');
      check(runtime.instances.length === 1 && runtime.instances[0] === survivor, 'survivor instance changed');
      check(survivorMeshes.every(mesh => !mesh.isDisposed() && mesh.getTotalVertices() > 0), 'survivor graphics disposed');
      scene.render();
      const beforeTime = survivorVoice.audio.currentTime;
      await until(() => survivorVoice.audio.currentTime > beforeTime);
      notifications.update(30); notifications.update(30); notifications.update(30);
      check(survivorVoice.audio.paused && notifications.records.length === 0 && runtime.instances.length === 0 && runtime.skillSound.voices.size === 0, 'duration expiry retained media/tree');
      check(!scene.meshes.some(mesh => [2428,2436,2525,2627].includes(mesh.metadata?.sourceNode)), 'duration expiry retained meshes');
      rounds.push({cleanup, changedPixels, draws: 8, survivorInstancePreserved: true, survivorMeshesPreserved: true,
        survivorPlaybackAdvanced: true, expiryPaused: true, records: 0, instances: 0, voices: 0});
      if (cleanup === 'role removal') runtime.attach(views[0]);
    }
    const context = runtime.skillSound.context;
    battle.clear(); runtime.stop(); runtime.start();
    play(47,10); play(48,11);
    const reenteredVoices = await media();
    const reentryPixels = await graphics(2);
    check(runtime.skillSound.context === context && context.state === 'running', 'normal reentry replaced or closed context');
    battle.clear(); runtime.stop();
    check(reenteredVoices.every(voice => voice.audio.paused) && runtime.instances.length === 0 && runtime.skillSound.voices.size === 0 && notifications.records.length === 0, 'normal leave retained effects');
    rounds.push({cleanup: 'same-scene stop/start reentry', changedPixels: reentryPixels, draws: 8, contextPreserved: true,
      leavePaused: true, records: 0, instances: 0, voices: 0});
    scene.dispose(); await until(() => context.state === 'closed');
    return {status: 'PASS', sourceInvocation: 'ordinary room-event notification fixture', serverSkillTriggered: false,
      rounds, scope: 'Original retained notification and actor tree contract, two real Chromium Effect3 draws/GA16 loops; ordinary notification input supplied by fixture, no new server business-trigger acceptance'};
  } finally {
    window.addEventListener = add; window.removeEventListener = remove;
    engine.dispose(); canvas.remove();
  }
}
