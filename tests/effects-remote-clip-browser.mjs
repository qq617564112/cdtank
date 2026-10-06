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
  await writeFile('recovery/output/effects-remote-clip-browser.json', JSON.stringify(result, null, 2) + '\n');
  console.log('PASS: Chromium remote clipping/current camera, visible Effect11, independent GA15 lifecycle and local exception');
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
    const view = await TankView.load(scene, 'remote-clip-actor', 1);
    await runtime.load(); runtime.attach(view); runtime.start();
    await new Promise(resolve => setTimeout(resolve, 150));
    engine.stopRenderLoop();
    scene.onBeforeRenderObservable.remove(runtime.renderObserver);
    let local;
    const notifications = createSkillEffectNotifications(runtime, catalog, {role: id => id === 47 ? view : undefined, localRole: () => local});
    const battle = new BattleSkillEffects(notifications);
    const play = () => battle.event({roomId: 'R1', type: 'itemUsed', message: '', playerId: 'P47', targetId: '', value: 0, x: 0, y: 0, z: 0,
      playSkillEffect: {skillId: 1, effectIndex: 0, duration: 0, roleId: 47, xBits: 0, zBits: 0}});
    const behind = new Vector3(0, 200, -600);
    camera.setTarget(behind);
    play();
    check(runtime.instances.length === 0, 'remote outside current view created tree');
    check(notifications.records.length === 0, 'one-shot created persistent notification record');
    const outsideVoice = [...runtime.skillSound.voices.values()][0];
    check(outsideVoice && outsideVoice.audio.src.endsWith('/GA15.wav') && !outsideVoice.audio.loop, 'clipped effect suppressed independent GA15');
    await outsideVoice.audio.play();
    await until(() => outsideVoice.audio.currentTime > 0 && !outsideVoice.audio.paused);
    const outsideTime = outsideVoice.audio.currentTime;
    await until(() => outsideVoice.audio.ended && runtime.skillSound.voices.size === 0);
    rounds.push({case: 'remote outside after turn before render', instances: 0, independentAudioTime: outsideTime, naturallyEnded: true, voices: 0});
    camera.setTarget(Vector3.Zero());
    play();
    check(runtime.instances.length === 1, 'remote inside current view was incorrectly dropped');
    check(runtime.instances[0].tree.parentMatrix === view.primaryTag('tag_efcenter'), 'remote primary attachment mismatch');
    for (let tick = 0; tick < 100; ++tick) {
      runtime.update(.025);
      if (scene.meshes.filter(mesh => [2664,2665,2667,2830,2834].includes(mesh.metadata?.sourceNode)).length === 5) break;
    }
    scene.render();
    const drawMeshes = scene.meshes.filter(mesh => [2664,2665,2667,2830,2834].includes(mesh.metadata?.sourceNode));
    check(drawMeshes.length === 5 && drawMeshes.some(mesh => mesh.getTotalVertices() > 0), 'inside actual geometry missing');
    const actual = new Uint8Array((await engine.readPixels(0, 0, 256, 256)).buffer).slice();
    drawMeshes.forEach(mesh => mesh.setEnabled(false)); scene.render();
    const baseline = new Uint8Array((await engine.readPixels(0, 0, 256, 256)).buffer);
    let changedPixels = 0;
    for (let index = 0; index < actual.length; index += 4) if ([0,1,2].some(channel => actual[index+channel] !== baseline[index+channel])) ++changedPixels;
    check(changedPixels > 0, 'inside effect actual framebuffer unchanged');
    const insideVoice = [...runtime.skillSound.voices.values()][0];
    await insideVoice.audio.play(); await until(() => insideVoice.audio.currentTime > 0 && !insideVoice.audio.paused);
    for (let tick = 0; tick < 400 && runtime.instances.length; ++tick) runtime.update(.025);
    check(runtime.instances.length === 0 && !scene.meshes.some(mesh => mesh.metadata?.sourceNode), 'remote geometry failed natural expiry');
    await until(() => insideVoice.audio.ended && runtime.skillSound.voices.size === 0);
    rounds.push({case: 'remote inside after turn back before render', changedPixels, drawNodes: [2664,2665,2667,2830,2834], naturalExpiry: true, naturallyEnded: true, voices: 0});
    camera.setTarget(behind); local = view;
    play(); check(runtime.instances.length === 1, 'local outside should bypass clipping');
    const localVoice = [...runtime.skillSound.voices.values()][0];
    await localVoice.audio.play(); await until(() => !localVoice.audio.paused);
    runtime.stop();
    check(localVoice.audio.paused && runtime.instances.length === 0 && runtime.skillSound.voices.size === 0, 'stop retained local audio or geometry');
    rounds.push({case: 'local outside exception', created: true, stopPaused: true, instances: 0, voices: 0});
    const context = runtime.skillSound.context;
    scene.dispose(); await until(() => context.state === 'closed');
    check(runtime.subscriptions.size === 0 && runtime.skillSound.voices.size === 0, 'scene leave cleanup retained state');
    return {status: 'PASS', sourceInvocation: 'ordinary room-event notification fixture', serverSkillTriggered: false,
      rounds, scope: 'Existing native actor clipping/notification contract with current Web camera, real Chromium Effect11 framebuffer and independent GA15 media; server business triggering is outside this check'};
  } finally {
    window.addEventListener = add; window.removeEventListener = remove;
    engine.dispose(); canvas.remove();
  }
}
