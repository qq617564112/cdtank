import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
if (!endpoint) throw new Error('Usage: node tests/browser-battle.mjs <Chromium CDP WebSocket URL>');
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
  return evaluate(session, `(async()=>{const deadline=Date.now()+45000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
}
const pages = [];
try {
  for (let index = 0; index < 2; index++) {
    const {targetId} = await command('Target.createTarget', {url: 'http://127.0.0.1:5173', newWindow: true});
    const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
    pages.push({targetId, sessionId});
    await command('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false}, sessionId);
    await waitUntil(sessionId, `document.querySelector('#refresh-rooms') && document.querySelector('#tank').options.length===21`);
    await evaluate(sessionId, `document.querySelector('#refresh-rooms').click()`);
    await waitUntil(sessionId, `document.querySelector('#room').options.length>0`);
    if (index === 0) {
      const room = await evaluate(sessionId, `Array.from(document.querySelector('#room').options).find(o=>o.textContent.includes('田野路') && o.textContent.includes('(0/'))?.value`);
      assert(room, 'Need an empty room for independent browser test');
      pages[0].roomId = room;
    }
    await evaluate(sessionId, `document.querySelector('#room').value=${JSON.stringify(pages[0].roomId)};document.querySelector('#tank').value='${index + 1}';document.querySelector('#player-name').value='Browser${index}';document.querySelector('#join').click()`);
    await waitUntil(sessionId, `document.querySelector('#battle-status').dataset.world`);
  }
  for (const page of pages) await evaluate(page.sessionId, `document.querySelector('[data-match-panel]:not([hidden]) [data-ready]').click()`);
  const [a, b] = pages.map(page => page.sessionId);
  const state = session => evaluate(session, `JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  await waitUntil(a, `JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===2`);
  await waitUntil(b, `JSON.parse(document.querySelector('#battle-status').dataset.world).renderedPlayers===2 && JSON.parse(document.querySelector('#battle-status').dataset.world).mapLoaded`);
  const heartbeatStart = Date.now();
  await waitUntil(b, `Date.now()>${heartbeatStart}+16000 && JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===2`);
  const mapEvidence = await evaluate(b, `(async()=>{
    const source=await (await fetch('/src/main.ts')).text();
    const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);
    const scene=EngineStore.LastCreatedScene;
    const world=JSON.parse(document.querySelector('#battle-status').dataset.world);
    return {mapId:world.mapId, terrainVertices:scene.getMeshByName('plane01/0')?.getTotalVertices(),
      placements:scene.transformNodes.filter(n=>n.name.startsWith('placement-')).length,
      cameraAboveGround:scene.activeCamera.position.y>scene.activeCamera.target.y,
      players:world.players.map(p=>{const root=scene.getTransformNodeByName('player-'+p.id);return {
        id:p.id, tankId:p.tankId, parts:scene.getTransformNodeByName('player-'+p.id+'-action-01').getChildTransformNodes().filter(n=>n.name.startsWith('player-'+p.id+'-part-')).map(n=>n.name),
        expected:[-p.x,p.y,p.z], actual:root?.position.asArray(), scale:root?.scaling.asArray()};})};
  })()`);
  assert.equal(mapEvidence.mapId, 2);
  assert(mapEvidence.terrainVertices>0, 'Battle must contain original terrain geometry');
  assert.equal(mapEvidence.placements, 91, 'Battle must include original placements and castles');
  assert(mapEvidence.cameraAboveGround);
  for (const player of mapEvidence.players) {
    assert.deepEqual(player.scale,[1,1,1]);
    assert.equal(player.parts.length,4, 'Source tank must have M/U/X/Y assembled');
    assert(player.actual.every((v,i)=>Math.abs(v-player.expected[i])<0.1), 'Browser tank must match source coordinates with X reflection');
  }
  const before = await state(a);
  const mine = before.players.find(player => player.id === before.playerId);
  assert.deepEqual(before.players.map(player => player.tankId).sort(), [1,2]);
  await evaluate(a, `document.querySelector('canvas').focus();window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowRight'}))`);
  await waitUntil(b, `JSON.parse(document.querySelector('#battle-status').dataset.world).players.some(p=>p.id===${JSON.stringify(mine.id)} && p.aim>0.15)`);
  await evaluate(a, `window.dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowRight'}))`);
  const aimEvidence = await evaluate(b, `(async()=>{
    const source=await (await fetch('/src/main.ts')).text();
    const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);
    const scene=EngineStore.LastCreatedScene;
    const world=JSON.parse(document.querySelector('#battle-status').dataset.world);
    const player=world.players.find(p=>p.id===${JSON.stringify(mine.id)});
    return {aim:player.aim, turretYaw:scene.getTransformNodeByName('player-'+player.id+'-turret').rotation.y};
  })()`);
  assert(Math.abs(aimEvidence.aim+aimEvidence.turretYaw)<0.06, 'Remote turret must show authoritative aim with X reflection');
  await evaluate(a, `document.querySelector('canvas').focus();window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}))`);
  await waitUntil(b, `JSON.parse(document.querySelector('#battle-status').dataset.world).renderedActions.some(p=>p.id===${JSON.stringify(mine.id)} && p.action==='02')`);
  const movementAction = await state(b);
  await evaluate(a, `window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}))`);
  await waitUntil(b, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.bullets>0 && s.players.some(p=>p.id===${JSON.stringify(mine.id)} && Math.abs(p.z-(${mine.z}))>2)})()`);
  const remote = await state(b);
  await waitUntil(b, `JSON.parse(document.querySelector('#battle-status').dataset.world).renderedActions.some(p=>p.id===${JSON.stringify(mine.id)} && p.action==='03')`);
  const firingAction = await state(b);
  await evaluate(a, `window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space'}))`);
  await waitUntil(b, `JSON.parse(document.querySelector('#battle-status').dataset.world).renderedActions.some(p=>p.id===${JSON.stringify(mine.id)} && p.action==='01')`);
  assert.notEqual(remote.playerId, before.playerId);
  const shot = await command('Page.captureScreenshot', {format: 'png'}, b);
  await writeFile('recovery/output/browser-battle.png', Buffer.from(shot.data, 'base64'));
  await evaluate(a, `document.querySelector('#leave').click()`);
  await waitUntil(b, `JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===1`);
  const after = await state(b);
  assert.equal(after.players.length, 1);
  await writeFile('recovery/output/browser-battle.json', JSON.stringify({mapEvidence, aimEvidence, before, movementAction, firingAction, remote, after}, null, 2));
  console.log('PASS: two browser clients, original map and tank assets, source coordinates, room join, remote movement/fire, heartbeat continuity, player identity and leave cleanup');
} finally {
  for (const page of pages) await command('Target.closeTarget', {targetId: page.targetId});
  ws.close();
}
