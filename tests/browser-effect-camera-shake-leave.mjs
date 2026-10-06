import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
const origin = process.argv[3] ?? 'http://127.0.0.1:5173';
if (!endpoint) throw new Error('Usage: node tests/browser-effect-camera-shake-leave.mjs <Chromium CDP WebSocket URL> [origin]');
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
  await command('Page.navigate', {url: origin}, session);
  await waitUntil(session, "document.querySelector('#tank')?.options.length===21");
  await evaluate(session, `(async()=>{
    const source=await(await fetch('/src/main.ts')).text();
    const battleUrl=source.split(String.fromCharCode(10)).find(line=>line.includes('battle.ts')&&line.includes('from ')).split('"')[1];
    const {Battle}=await import(battleUrl);
    const original=Battle.prototype.render;
    Battle.prototype.render=function(){window.shakeBattle=this;return original.call(this);};
    document.querySelector('#room-mode').value='4';document.querySelector('#room-mode').dispatchEvent(new Event('change'));
  })()`);
  await waitUntil(session, "Array.from(document.querySelector('#room-map').options).some(option=>Number(option.value)===7)");
  await evaluate(session, "document.querySelector('#room-map').value='7';document.querySelector('#player-name').value='Shake Observer';document.querySelector('#create-room').click()");
  await waitUntil(session, "JSON.parse(document.querySelector('#battle-status').dataset.world||'{}').mapLoaded && JSON.parse(document.querySelector('#battle-status').dataset.world||'{}').renderedPlayers===1 && !document.querySelector('#leave').hidden && window.shakeBattle");
  const result=await evaluate(session, `(async()=>{
    const battle=window.shakeBattle, camera=battle.camera, scene=battle.scene;
    scene.getEngine().stopRenderLoop();
    battle.effects.clear();
    battle.players.render(1,battle.playerId);
    const baseline=Array.from(camera.getViewMatrix(true).m);
    const baselineTarget=camera.target.asArray();
    const player=battle.players.get(battle.roomFeed.snapshot.players[0].id);
    await battle.effects.playWorldEffect(player,['_root','other','1000','11001','s12','3','zhendong'].join(String.fromCharCode(92)),[0,0,0]);
    battle.effects.update(.2);battle.effects.update(.016);
    const moved=Array.from(camera.getViewMatrix().m).some((value,index)=>Math.abs(value-baseline[index])>.000001);
    scene.render(false);
    const renderedTarget=camera.target.asArray();
    document.querySelector('#leave').click();
    const restored=Array.from(camera.getViewMatrix().m).every((value,index)=>Math.abs(value-baseline[index])<=.000001);
    return {passed:moved&&restored,moved,restored,baselineTarget,renderedTarget,active:battle.active,retainedPlayers:battle.players.size,
      retainedEffects:scene.meshes.filter(mesh=>mesh.metadata?.originalEffect).length,sourceInvocation:'diagnostic',serverSkillTriggered:false};
  })()`);
  assert.deepEqual(result.renderedTarget,result.baselineTarget);
  assert.equal(result.passed,true);
  assert.equal(result.active,false);
  assert.equal(result.retainedPlayers,0);
  assert.equal(result.retainedEffects,0);
  assert.equal(result.serverSkillTriggered,false);
  await writeFile('recovery/output/browser-effect-camera-shake-leave.json',JSON.stringify(result,null,2)+'\n');
  console.log('PASS: actual room UI leave restores production camera after diagnostic original shake source invocation');
} finally {
  if (target) await command('Target.closeTarget', {targetId: target});
  ws.close();
}
