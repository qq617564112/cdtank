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
  await writeFile('recovery/output/effects-load-scene-disposal-browser.json', JSON.stringify(result, null, 2) + '\n');
  console.log('PASS: Chromium delayed effect load disposal does not resurrect resources, fresh scene draws/audio');
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
  const originalFetch = window.fetch;
  let release;
  const gate = new Promise(resolve => {release = resolve;});
  const lateCanvas = document.createElement('canvas'); document.body.append(lateCanvas);
  const lateEngine = new Engine(lateCanvas, false);
  const lateScene = new Scene(lateEngine);
  const lateRuntime = new EffectRuntime(lateScene, new FreeCamera('late-camera', Vector3.Zero(), lateScene));
  window.fetch = async (...args) => {await gate; return originalFetch(...args);};
  try {
    const loading = lateRuntime.load();
    lateScene.dispose(); release(); await loading;
    check(lateRuntime.skillSound.context === undefined && lateRuntime.textures.size === 0 && lateRuntime.library === undefined,
      'late load resurrected context, textures or library');
  } finally {window.fetch = originalFetch; lateEngine.dispose(); lateCanvas.remove();}
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
    for (let round = 0; round < 1; ++round) {
      const scene = new Scene(engine); scene.clearColor = new Color4(.05, .1, .15, 1);
      const camera = new FreeCamera('camera', new Vector3(0, 100, -300), scene); camera.setTarget(Vector3.Zero());
      const runtime = new EffectRuntime(scene, camera);
      engine.runRenderLoop(() => scene.render());
      const view = await TankView.load(scene, 'disposal-actor', 1);
      await runtime.load(); runtime.attach(view); runtime.start();
      const notifications = createSkillEffectNotifications(runtime, catalog, {role: id => id === 47 ? view : undefined, localRole: () => view});
      new BattleSkillEffects(notifications).event({roomId: 'R1', type: 'itemUsed', message: '', playerId: 'P47', targetId: '', value: 0, x: 0, y: 0, z: 0,
        playSkillEffect: {skillId: 1, effectIndex: 0, duration: 0, roleId: 47, xBits: 0, zBits: 0}});
      const voice = [...runtime.skillSound.voices.values()][0];
      check(voice && voice.audio.src.endsWith('/GA15.wav') && !voice.audio.loop, 'notification GA15 media missing');
      await voice.audio.play();
      await until(() => !voice.audio.paused && voice.audio.currentTime > 0);
      await until(() => scene.meshes.filter(mesh => [2664,2665,2667,2830,2834].includes(mesh.metadata?.sourceNode)).length === 5);
      engine.stopRenderLoop(); scene.render();
      const drawMeshes = scene.meshes.filter(mesh => [2664,2665,2667,2830,2834].includes(mesh.metadata?.sourceNode));
      check(drawMeshes.length === 5 && drawMeshes.some(mesh => mesh.getTotalVertices() > 0), 'notification actual geometry missing');
      const actual = new Uint8Array((await engine.readPixels(0, 0, 256, 256)).buffer).slice();
      drawMeshes.forEach(mesh => mesh.setEnabled(false)); scene.render();
      const baseline = new Uint8Array((await engine.readPixels(0, 0, 256, 256)).buffer);
      let changedPixels = 0;
      for (let index = 0; index < actual.length; index += 4) if ([0,1,2].some(channel => actual[index+channel] !== baseline[index+channel])) ++changedPixels;
      check(changedPixels > 0, 'effect actual framebuffer unchanged');
      const type4Handle = runtime.sound.play('GA15', 0);
      const type4Audio = runtime.sound.voices.get(type4Handle).audio;
      await type4Audio.play();
      const drawNodes = drawMeshes.map(mesh => mesh.metadata.sourceNode);
      const context = runtime.skillSound.context;
      const audioTime = voice.audio.currentTime;
      check(!voice.audio.paused && !voice.audio.ended && !type4Audio.paused,
        'fixture must dispose while both effect media are active');
      const unlock = runtime.skillSound.resume;
      check(callbacks.has(unlock), 'unlock callbacks not registered');
      scene.dispose();
      await until(() => context.state === 'closed');
      check(voice.audio.paused && type4Audio.paused, 'scene disposal retained active media');
      check(runtime.instances.length === 0 && runtime.sound.voices.size === 0 && runtime.skillSound.voices.size === 0, 'scene disposal retained effect state');
      check(runtime.subscriptions.size === 0 && !callbacks.has(unlock), 'scene disposal retained callback');
      check(scene.meshes.length === 0 && scene.materials.length === 0, 'scene disposal retained graphics');
      rounds.push({round, changedPixels, drawNodes, audioTime,
        paused: voice.audio.paused, type4Paused: type4Audio.paused, context: context.state, instances: runtime.instances.length,
        voices: runtime.skillSound.voices.size, subscriptions: runtime.subscriptions.size, unlockListeners: callbacks.has(unlock) ? 1 : 0});
    }
    return {status: 'PASS', sourceInvocation: 'ordinary room-event notification fixture', serverSkillTriggered: false,
      lateLoad: {context: false, textures: 0, library: false}, rounds, scope: 'Real Chromium geometry/framebuffer and original GA15 media; server business triggering is outside this focused teardown check'};
  } finally {
    window.addEventListener = add; window.removeEventListener = remove;
    engine.dispose(); canvas.remove();
  }
}
