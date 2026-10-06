import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const {WsClient} = require('tsrpc');
const {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3156', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-chat-'));
let server, chrome, vite, ws;
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'PASS', scope: 'M6-08-R rebuilt channel0 room/battle chat, two normal browser accounts, normal create/join/Ready and keyboard controls.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function stop(process) {
  if (process?.exitCode === null && process.signalCode === null) {
    const ended = new Promise(resolve => process.once('exit', resolve));
    process.kill();
    await ended;
  }
}
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
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(session, expression)) return;
      if (await evaluate(session, `document.querySelector('#battle-status')?.value.includes('Internal Server Error')`)) throw new Error('Browser received Internal Server Error');
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed') && !String(error).includes('Inspected target navigated')) throw error;
    }
    await pause(100);
  }
  throw new Error('Browser condition timeout: ' + expression + '\n' + await evaluate(session, `document.querySelector('#battle-status')?.value`));
}
async function click(session, selector) {
  const point = await evaluate(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing control');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent', {type: 'mousePressed', button: 'left', clickCount: 1, ...point}, session);
  await command('Input.dispatchMouseEvent', {type: 'mouseReleased', button: 'left', clickCount: 1, ...point}, session);
}
async function input(session, selector, value) {
  await click(session, selector);
  await command('Input.dispatchKeyEvent', {type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2}, session);
  await command('Input.dispatchKeyEvent', {type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2}, session);
  await command('Input.insertText', {text: value}, session);
}
function parseClientInput(bytes) {
  const envelope = TransportDataUtil.tsbuffer.decode(bytes, 'ServerInputData');
  assert(envelope.isSucc, envelope.errMsg);
  const service = decoder.serviceMap.id2Service[envelope.value.serviceId];
  const payload = decoder.tsbuffer.decode(envelope.value.buffer, service.type === 'api' ? service.reqSchemaId : service.msgSchemaId);
  assert(payload.isSucc, payload.errMsg);
  return {isSucc: true, result: {type: service.type, service, ...(service.type === 'api' ? {req: payload.value} : {msg: payload.value})}};
}
const worldExpression = `JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')`;
const chatInput = '[data-chat-input]';
const chatStatus = '.battle-chat [role=status]';
const logExpression = `[...document.querySelector('[data-chat-log]').children].map(e=>e.textContent)`;
async function key(session, key, code, type = 'keyDown') {
  await command('Input.dispatchKeyEvent', {type, key, code, ...(type === 'keyDown' && (key === 'Enter' || key.length === 1) ? {text: key === 'Enter' ? '\r' : key} : {}), windowsVirtualKeyCode: ({Enter: 13, Escape: 27, Home: 36, End: 35, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, ' ': 32})[key] ?? key.toUpperCase().charCodeAt(0)}, session);
}
async function press(session, value, code) {
  await key(session, value, code);
  await key(session, value, code, 'keyUp');
}
async function selectRoom(session, roomId) {
  const index = await evaluate(session, `Array.from(document.querySelector('#room').options).findIndex(o=>o.value===${JSON.stringify(roomId)})`);
  assert(index >= 0);
  await click(session, '#room');
  await press(session, 'Home', 'Home');
  for (let step = 0; step < index; step++) await press(session, 'ArrowDown', 'ArrowDown');
  await press(session, 'Enter', 'Enter');
  assert.equal(await evaluate(session, `document.querySelector('#room').value`), roomId);
}
async function screenshot(session, name) {
  const result = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`recovery/output/browser-room-chat-${name}.png`, Buffer.from(result.data, 'base64'));
}
async function submit(session, text) {
  await input(session, chatInput, text);
  await press(session, 'Enter', 'Enter');
}
async function confirmedChat(session, text, name, playerId) {
  const from = network.length;
  await submit(session, text);
  const expected = `${name}: ${text}`;
  for (const page of pages) await waitUntil(page.sessionId, `${logExpression}.filter(text=>text===${JSON.stringify(expected)}).length===1`);
  await waitUntil(session, `document.querySelector('${chatInput}').value===''`);
  const response = network.slice(from).find(event => event.page === session && event.direction === 'received' && event.name === 'RoomChat');
  assert(response?.success, 'RoomChat must acknowledge the accepted normal send');
  const events = network.slice(from).filter(event => event.direction === 'received' && event.name === 'RoomEvent');
  assert.equal(events.length, 2);
  for (const event of events) {
    assert.equal(event.payload.playerId, playerId);
    assert.equal(event.payload.message, expected);
  }
  for (const page of pages) assert.equal((await evaluate(page.sessionId, logExpression)).filter(value => value === expected).length, 1);
  evidence.checks.push({name: 'confirmed room chat', text, playerId, response, events});
}

try {
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3156', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {serverLog += String(data);});
  server.stderr.on('data', data => {serverLog += String(data);});
  const deadline = Date.now() + 15000;
  while (!serverLog.includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
  assert(serverLog.includes('Server started'), serverLog);
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    server: {port: 5203, strictPort: true, host: '127.0.0.1', hmr: false,
      proxy: {'/game': {target: 'ws://127.0.0.1:3156', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=9275', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9275/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
  }
  assert(endpoint, 'Dedicated Chrome failed to start');
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
  ws.on('message', raw => {
    const message = JSON.parse(String(raw));
    const callback = pending.get(message.id);
    if (callback) {
      pending.delete(message.id);
      message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
    }
    if (['Network.webSocketFrameReceived', 'Network.webSocketFrameSent'].includes(message.method)) {
      const frame = message.params.response;
      if (frame.opcode !== 2) return;
      const bytes = new Uint8Array(Buffer.from(frame.payloadData, 'base64'));
      if (bytes.length === 1 && bytes[0] === 0) return;
      const received = message.method.endsWith('Received');
      const parsed = received ? TransportDataUtil.parseServerOutout(decoder.tsbuffer, decoder.serviceMap, bytes)
        : parseClientInput(bytes);
      assert(parsed.isSucc, parsed.errMsg);
      const result = parsed.result;
      if (result.service.name === 'PlayerInput' || result.service.name === 'RoomChat'
          || result.service.name === 'Ready' || result.service.name === 'CreateRoom'
          || result.service.name === 'Join'
          || result.service.name === 'RoomEvent' && result.msg.type === 'chat') {
        network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent',
          kind: result.type, name: result.service.name,
          ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err}
            : {payload: result.msg ?? result.req})});
      }
    }
  });
  for (let index = 0; index < 2; index++) {
    const {browserContextId} = await command('Target.createBrowserContext');
    contexts.push(browserContextId);
    const {targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId});
    const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
    pages.push({targetId, sessionId});
    await command('Network.enable', {}, sessionId);
    await command('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false}, sessionId);
    await command('Page.navigate', {url: 'http://127.0.0.1:5203'}, sessionId);
    await waitUntil(sessionId, `document.querySelector('#tank')?.options.length===21&&localStorage.getItem('cdtank-account-token')&&document.querySelector('#room-map')?.options.length>0`);
    await input(sessionId, '#player-name', index === 0 ? '聊天甲' : '聊天乙');
  }
  const [a, b] = pages.map(page => page.sessionId);
  await click(a, '#create-room-controls summary');
  await input(a, '#room-name', '普通房间聊天验收');
  await click(a, '#room-mode');
  await press(a, 'Home', 'Home');
  await press(a, 'Enter', 'Enter');
  assert.equal(await evaluate(a, `document.querySelector('#room-mode').value`), '1');
  await waitUntil(a, `Array.from(document.querySelector('#room-map').options).some(o=>o.value==='7')`);
  await click(a, '#room-map');
  const mapIndex = await evaluate(a, `Array.from(document.querySelector('#room-map').options).findIndex(o=>o.value==='7')`);
  await press(a, 'Home', 'Home');
  for (let index = 0; index < mapIndex; index++) await press(a, 'ArrowDown', 'ArrowDown');
  await press(a, 'Enter', 'Enter');
  assert.equal(await evaluate(a, `document.querySelector('#room-map').value`), '7');
  await click(a, '#create-room');
  await waitUntil(a, `(()=>{const w=${worldExpression};return w?.mapLoaded&&w.phase==='WAITING'&&w.renderedPlayers===1})()`);
  const initial = await evaluate(a, worldExpression);
  assert.equal(initial.match.minPlayers, 2);
  const roomId = initial.roomId;
  await click(b, '#refresh-rooms');
  await waitUntil(b, `Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})&&!document.querySelector('#join').disabled`);
  await selectRoom(b, roomId);
  await click(b, '#join');
  for (const session of [a, b]) await waitUntil(session, `(()=>{const w=${worldExpression};return w?.mapLoaded&&w.phase==='WAITING'&&w.players.length===2&&w.renderedPlayers===2})()`);
  evidence.initial = await Promise.all([a, b].map(session => evaluate(session, worldExpression)));
  assert(evidence.initial.every(world => world.players.every(player => !player.isCpu)));
  assert.notEqual(evidence.initial[0].playerId, evidence.initial[1].playerId);
  const playerId = initial.playerId;
  const senderName = evidence.initial[0].players.find(player => player.id === playerId).name;
  const remoteName = evidence.initial[1].players.find(player => player.id === evidence.initial[1].playerId).name;
  assert.equal(await evaluate(a, `document.querySelector('${chatInput}').maxLength`), 72);
  await confirmedChat(a, '大家好，准备开始！', senderName, playerId);
  await confirmedChat(b, '收到，一起出发。', remoteName, evidence.initial[1].playerId);
  const literal = '<img src=x onerror="window.chatExecuted=1">';
  await confirmedChat(a, literal, senderName, playerId);
  for (const session of [a, b]) {
    assert.equal(await evaluate(session, `document.querySelector('[data-chat-log] img')`), null);
    assert.equal(await evaluate(session, `window.chatExecuted??null`), null);
  }
  const invalidFrom = network.length;
  await submit(a, '   ');
  await waitUntil(a, `document.querySelector('${chatStatus}').textContent.includes('有效内容')`);
  assert.equal(network.slice(invalidFrom).filter(event => event.name === 'RoomChat').length, 0);
  evidence.checks.push({name: 'empty text rejected visibly before transport', status: await evaluate(a, `document.querySelector('${chatStatus}').textContent`)});
  await screenshot(a, 'waiting-self');
  await screenshot(b, 'waiting-remote');
  for (const session of [a, b]) await click(session, '[data-match-panel] [data-ready]');
  for (const session of [a, b]) await waitUntil(session, `(()=>{const w=${worldExpression};return w?.phase==='PLAYING'&&w.mapLoaded&&w.renderedPlayers===2})()`);
  assert.equal(network.filter(event => event.name === 'Ready' && event.direction === 'received' && event.success).length, 2);
  await click(a, 'canvas');
  const movementFrom = network.length;
  await key(a, 'w', 'KeyW');
  await pause(200);
  assert(network.slice(movementFrom).some(event => event.page === a && event.name === 'PlayerInput' && event.payload.move === 1));
  await press(a, 'Enter', 'Enter');
  assert.equal(await evaluate(a, `document.activeElement===document.querySelector('${chatInput}')`), true);
  await pause(120);
  const focusedFrom = network.length;
  await key(a, 'w', 'KeyW', 'keyUp');
  await press(a, 'w', 'KeyW');
  await press(a, ' ', 'Space');
  await press(a, '5', 'Digit5');
  await pause(250);
  const focusedInputs = network.slice(focusedFrom).filter(event => event.page === a && event.name === 'PlayerInput');
  assert(focusedInputs.length >= 2, 'Focused-input observation needs the normal input cadence');
  assert(focusedInputs.every(event => event.payload.move === 0 && event.payload.turn === 0 && event.payload.aim === 0 && !event.payload.fire && event.payload.useItem === 0));
  evidence.checks.push({name: 'Enter opens chat, clears held movement, normal focused KeyW/Space/Digit5 suppress battle requests', focusedInputs});
  await confirmedChat(a, '战斗中也能正常聊天', senderName, playerId);
  await input(a, chatInput, '中文输入法确认');
  const imeFrom = network.length;
  await evaluate(a, `(()=>{const input=document.querySelector('${chatInput}');input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,bubbles:true,cancelable:true}));input.form.requestSubmit();})()`);
  await pause(200);
  assert.equal(network.slice(imeFrom).filter(event => event.name === 'RoomChat').length, 0);
  assert.equal(await evaluate(a, `document.querySelector('${chatInput}').value`), '中文输入法确认');
  await evaluate(a, `document.querySelector('${chatInput}').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}))`);
  await confirmedChat(a, '中文输入法确认', senderName, playerId);
  evidence.checks.push({name: 'IME composition Enter guard', method: 'Synthetic DOM compositionstart/composing keydown/form submit/compositionend; confirmed text subsequently submitted with ordinary CDP Enter. This checks the guard, not an OS IME session.'});
  await screenshot(a, 'playing-self');
  await screenshot(b, 'playing-remote');
  await press(a, 'Escape', 'Escape');
  assert.equal(await evaluate(a, `document.activeElement.tagName`), 'CANVAS');
  const resumedFrom = network.length;
  await key(a, 'w', 'KeyW');
  await pause(200);
  await key(a, 'w', 'KeyW', 'keyUp');
  const resumed = network.slice(resumedFrom).filter(event => event.page === a && event.name === 'PlayerInput' && event.payload.move === 1);
  assert(resumed.length > 0);
  evidence.checks.push({name: 'Escape returns canvas and ordinary battle input resumes', resumed});
  await input(a, chatInput, '离开前尚未发送');
  await click(a, '#leave');
  await waitUntil(a, `!document.body.classList.contains('in-battle')&&document.querySelector('.battle-chat').hidden`);
  assert.deepEqual(await evaluate(a, logExpression), []);
  assert.equal(await evaluate(a, `document.querySelector('${chatInput}').value`), '');
  await waitUntil(b, `(${worldExpression})?.phase==='FINISHED'`);
  await click(a, '#refresh-rooms');
  await waitUntil(a, `Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)}&&!o.disabled)&&!document.querySelector('#join').disabled`);
  await selectRoom(a, roomId);
  await click(a, '#join');
  await waitUntil(a, `document.body.classList.contains('in-battle')&&!document.querySelector('.battle-chat').hidden&&(${worldExpression})?.players.length===2`);
  assert.deepEqual(await evaluate(a, logExpression), []);
  assert.equal(await evaluate(a, `document.querySelector('${chatInput}').value`), '');
  evidence.checks.push({name: 'Leave and normal reentry clear previous log and draft'});
  await screenshot(a, 'reentry-cleared');
  await input(a, chatInput, '连接中断后的草稿');
  await stop(server);
  await waitUntil(a, `document.querySelector('#battle-status').value.includes('连接已断开')`);
  assert.equal(await evaluate(a, `document.querySelector('.battle-chat').hidden`), true);
  assert.equal(await evaluate(a, `document.querySelector('${chatInput}').value`), '');
  assert.deepEqual(await evaluate(a, logExpression), []);
  const disconnectedStatus = await evaluate(a, `document.querySelector('#battle-status').value`);
  assert(disconnectedStatus.includes('连接已断开，请返回后重新加入'), disconnectedStatus);
  evidence.checks.push({name: 'Disconnect visibly explains recovery and clears chat log/draft', status: disconnectedStatus});
  await screenshot(a, 'disconnected');
  evidence.network = network;
  evidence.noInjectedState = true;
  evidence.isolation = {server: 3156, vite: 5203, chrome: 9275};
  await writeFile('recovery/output/browser-room-chat.json', JSON.stringify(evidence, null, 2) + '\n');
  await writeFile('recovery/output/browser-room-chat.md', '# M6-08-R rebuilt room/battle chat browser acceptance\n\nPASS. Two fresh normal Web accounts create/join mode1/map7, then Ready into PLAYING at 1920×1080, scale1. No CPU or gameplay-state injection.\n\n- Chinese waiting and playing messages use acknowledged RoomChat and authoritative RoomEvent; both pages display the same server identity and text exactly once.\n- HTML-looking text stays literal; empty text receives a visible client rejection.\n- Enter focuses chat and clears held movement. Read-only decoded PlayerInput observation confirms normal KeyW, Space and Digit5 while focused request no movement, fire or item use. Escape returns canvas and movement requests resume.\n- Synthetic composition events explicitly exercise the IME Enter guard; confirmed text then uses ordinary CDP Enter.\n- Leave/reentry clear old log and draft. A stopped isolated server clears chat and displays the connection failure with return/rejoin guidance.\n\nEvidence: [JSON](browser-room-chat.json), [waiting sender](browser-room-chat-waiting-self.png), [waiting recipient](browser-room-chat-waiting-remote.png), [playing sender](browser-room-chat-playing-self.png), [playing recipient](browser-room-chat-playing-remote.png), [reentry](browser-room-chat-reentry-cleared.png), [disconnected](browser-room-chat-disconnected.png).\n\n## Limitations\n\nRebuilt channel0 acceptance only; private/public original channels, native input packet fidelity and OS IME behavior are outside this result. No gameplay authority changes or natural multi-round claim. Isolated ports3156/5203/9275; ports3001/5173 untouched.\n');
  console.log('PASS: acknowledged room/battle chat, authoritative exactly-once identity, literal text, visible rejection, Enter/focused input isolation, synthetic IME guard, Escape, reentry and disconnect cleanup');
} catch (error) {
  await writeFile('recovery/output/browser-room-chat.json', JSON.stringify({...evidence, status: 'FAIL', error: String(error), serverLog, network}, null, 2) + '\n');
  console.error(serverLog);
  throw error;
} finally {
  if (ws?.readyState === WebSocket.OPEN) {
    for (const page of pages) await command('Target.closeTarget', {targetId: page.targetId}).catch(() => {});
    for (const browserContextId of contexts) await command('Target.disposeBrowserContext', {browserContextId}).catch(() => {});
    ws.close();
  }
  await vite?.close();
  await stop(server);
  await stop(chrome);
  await rm(directory, {recursive: true, force: true});
}
