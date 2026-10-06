import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
if (!endpoint) throw new Error('Usage: node tests/browser-item-hotkeys.mjs <Chromium CDP WebSocket URL>');
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

const server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
  env: {...process.env, PORT: '3131'}, stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', chunk => {serverLog += String(chunk);});
server.stderr.on('data', chunk => {serverLog += String(chunk);});
let targetId;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const deadline = Date.now() + 10000;
  while (!serverLog.includes('Server started at 3131.')) {
    if (Date.now() > deadline) throw new Error(serverLog);
    await delay(20);
  }
  ({targetId} = await command('Target.createTarget', {url: 'about:blank', newWindow: true}));
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  await command('Page.enable', {}, sessionId);
  // Route this test page to its independent real server, leaving other pages alone.
  await command('Page.addScriptToEvaluateOnNewDocument', {source: `
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(url, protocols) {
        super(String(url).endsWith('/game') ? 'ws://127.0.0.1:3131' : url, protocols);
      }
    };
  `}, sessionId);
  await command('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080,
    deviceScaleFactor: 1, mobile: false}, sessionId);
  await command('Page.navigate', {url: 'http://127.0.0.1:5173'}, sessionId);
  await waitUntil(sessionId, `document.querySelector('#tank')?.options.length===21`);
  await evaluate(sessionId, `document.querySelector('#room-mode').value='4';document.querySelector('#room-mode').dispatchEvent(new Event('change'))`);
  await waitUntil(sessionId, `Array.from(document.querySelector('#room-map').options).some(o=>Number(o.value)===7)`);
  await evaluate(sessionId, `document.querySelector('#room-map').value='7';document.querySelector('#player-name').value='Shortcut observer';document.querySelector('#create-room').click()`);
  await waitUntil(sessionId, `document.querySelector('#battle-status').dataset.world`);
  for (let index = 0; index < 3; index++) {
    await evaluate(sessionId, `document.querySelector('[data-add-cpu]').click()`);
    await waitUntil(sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===${index + 2}`);
  }
  await waitUntil(sessionId, `!document.querySelector('[data-ready]').disabled && JSON.parse(document.querySelector('#battle-status').dataset.world).mapLoaded && JSON.parse(document.querySelector('#battle-status').dataset.world).renderedPlayers===4`);
  await evaluate(sessionId, `document.querySelector('[data-ready]').click()`);
  const read = () => evaluate(sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  await waitUntil(sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  const initial = await read();
  const local = state => state.players.find(player => player.id === state.playerId);
  assert.equal(local(initial).selectedAmmoSlot, 1);
  const key = async (slot, repeat = false) => {
    await command('Input.dispatchKeyEvent', {type: 'keyDown', key: String(slot), code: `Digit${slot}`,
      windowsVirtualKeyCode: 48 + slot, autoRepeat: repeat}, sessionId);
    await command('Input.dispatchKeyEvent', {type: 'keyUp', key: String(slot), code: `Digit${slot}`,
      windowsVirtualKeyCode: 48 + slot}, sessionId);
  };
  const settle = async () => {
    const tick = (await read()).tick;
    await waitUntil(sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).tick>=${tick + 3}`);
    return read();
  };
  await evaluate(sessionId, `document.querySelector('[data-chat-input]').focus()`);
  assert(await evaluate(sessionId, `document.activeElement.matches('[data-chat-input]')`));
  await key(1);
  assert.equal(local(await settle()).selectedAmmoSlot, 1, 'Text input focus must suppress shortcuts');
  await evaluate(sessionId, `document.querySelector('#world').focus()`);
  await key(1, true);
  assert.equal(local(await settle()).selectedAmmoSlot, 1, 'Repeated keydown must not dispatch a shortcut');
  await key(2);
  assert.equal(local(await settle()).selectedAmmoSlot, 1, 'An unowned ammo slot must not select ammo');
  await key(1);
  await waitUntil(sessionId, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.players.find(p=>p.id===s.playerId).selectedAmmoSlot===1})()`);
  const selected = await read();
  assert(selected.players.filter(player => player.isCpu).every(player => player.selectedAmmoSlot === 1));
  assert.equal(local(selected).kills, 0);
  const shotDeadline = Date.now() + 15000;
  let fighting = selected;
  while (!fighting.players.some(player => player.isCpu && player.score > 0)) {
    if (Date.now() > shotDeadline) throw new Error('CPUs did not naturally score');
    await delay(200); fighting = await read();
  }
  await evaluate(sessionId, `document.querySelector('#leave').click()`);
  await waitUntil(sessionId, `!document.querySelector('#battle-status').dataset.world`);
  await writeFile('recovery/output/browser-item-hotkeys.json', JSON.stringify({status: 'PASS',
    scope: '1920x1080 browser actual Digit keys, independent real server, ordinary CPU input; focus/repeat/empty slot/default selection and exit. No consumable inventory/skill execution or performance claim.',
    initial, selected, fighting}, null, 2));
  console.log('PASS: browser Digit shortcuts, focus/repeat/empty slot/default ammo, CPU natural combat and exit');
} finally {
  if (targetId) await command('Target.closeTarget', {targetId});
  ws.close(); server.kill();
}
