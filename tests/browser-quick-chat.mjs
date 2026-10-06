import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const {WsClient} = require('tsrpc');
const {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3267', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-quick-chat-'));
let server, chrome, vite, ws;
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M6-08-Q quick-chat normal editor and authoritative RoomChat; native CDP input, real rooms/CPU/Ready and persistence.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
      if (await evaluate(session, `Boolean(${expression})`)) return;
      if (await evaluate(session, `document.querySelector('#battle-status')?.value.includes('Internal Server Error')`)) throw new Error('Browser received Internal Server Error');
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed') && !String(error).includes('Inspected target navigated')) throw error;
    }
    await pause(100);
  }
  throw new Error('Browser condition timeout: ' + expression + '\n' + await evaluate(session, `document.querySelector('#battle-status')?.value`));
}
async function click(session, selector) {
  await command('Page.bringToFront', {}, session);
  const point = await evaluate(session, `(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing control');e.scrollIntoView({block:'center'});await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Control obscured '+e.id);return {x,y}})()`);
  await command('Input.dispatchMouseEvent', {type: 'mousePressed', button: 'left', clickCount: 1, ...point}, session);
  await command('Input.dispatchMouseEvent', {type: 'mouseReleased', button: 'left', clickCount: 1, ...point}, session);
  await evaluate(session, 'new Promise(requestAnimationFrame)');
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
async function key(session, key, code, type = 'keyDown', options = {}) {
  await command('Input.dispatchKeyEvent', {type, key, code, ...(type === 'keyDown' && (key === 'Enter' || key.length === 1) ? {text: key === 'Enter' ? '\r' : key} : {}), ...options, windowsVirtualKeyCode: (/^F(?:[5-9]|1[0-2])$/.test(code) ? 111 + Number(code.slice(1)) : ({Enter: 13, Escape: 27, Home: 36, End: 35, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, ' ': 32})[key] ?? key.toUpperCase().charCodeAt(0))}, session);
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
  const layout=await evaluate(session,`(()=>{const e=document.querySelector('dialog[open]');if(!e)return null;const r=e.getBoundingClientRect();return {viewport:[innerWidth,innerHeight],dialog:[r.x,r.y,r.width,r.height],inputs:e.querySelectorAll('input,button').length};})()`);
  if(layout){const [x,y,w,h]=layout.dialog;assert(w>0&&h>0&&x>=-1&&y>=-1&&x+w<=layout.viewport[0]+1&&y+h<=layout.viewport[1]+1,'Visible settings dialog fits viewport');(evidence.layouts??=[]).push({name,...layout});}

  const result = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`${output}-${name}.png`, Buffer.from(result.data, 'base64'));
}
const repeatOnly = process.argv.includes('--repeat-defaults-only');
const output = process.env.CDTANK_QUICK_CHAT_OUTPUT ?? 'recovery/output/browser-quick-chat' + (repeatOnly ? '-repeat-defaults' : '');
const storageKey = 'cdtank.quick-chat-settings.v1';
const codes = Array.from({length: 8}, (_, index) => 'F' + (index + 5));
const presets = Object.fromEntries(codes.map(code => [code, `${code} 快捷消息` ]));
const field = code => `[data-quick-chat-key="${code}"]`;
const saved = session => evaluate(session, `JSON.parse(localStorage.getItem('${storageKey}')??'null')`);
const world = session => evaluate(session, worldExpression);
const chatRows = (from, session) => network.slice(from).filter(row => row.page === session && row.name === 'RoomChat' && row.direction === 'sent');
async function reload(session) {
  const previous=await evaluate(session,'performance.timeOrigin');
  await command('Page.reload',{},session);
  await waitUntil(session,`performance.timeOrigin!==${previous}`);
  await ready(session);
}
async function ready(session) {
  await waitUntil(session, `document.querySelector('#tank')?.options.length===21&&localStorage.getItem('cdtank-account-token')&&!document.querySelector('#create-room').disabled&&document.querySelector('#open-quick-chat-settings')`);
}
async function newPage(browserContextId, width = 1920, height = 1080, fixture = '') {
  const {targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  pages.push({targetId, sessionId});
  await command('Network.enable', {}, sessionId);
  await command('Page.enable', {}, sessionId);
  await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false}, sessionId);
  await command('Page.addScriptToEvaluateOnNewDocument',{source:`window.quickPresetWrites=[];${fixture}`},sessionId);
  await command('Page.navigate', {url: 'http://127.0.0.1:5297'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3267', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {serverLog += String(data);});
  server.stderr.on('data', data => {serverLog += String(data);});
  const deadline = Date.now() + 15000;
  while (!serverLog.slice(from).includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
  assert(serverLog.slice(from).includes('Server started'), serverLog);
}
async function launchBrowser() {
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=9497', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9497/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
  }
  assert(endpoint, 'Dedicated Chromium failed to start');
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
  ws.on('close', () => {for (const callback of pending.values()) callback.reject(new Error('CDP closed')); pending.clear();});
  ws.on('message', raw => {
    const message = JSON.parse(String(raw));
    const callback = pending.get(message.id);
    if (callback) {pending.delete(message.id); message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);}
    if (!['Network.webSocketFrameReceived', 'Network.webSocketFrameSent'].includes(message.method)) return;
    const frame = message.params.response;
    if (frame.opcode !== 2) return;
    const bytes = new Uint8Array(Buffer.from(frame.payloadData, 'base64'));
    if (bytes.length === 1 && bytes[0] === 0) return;
    const received = message.method.endsWith('Received');
    const parsed = received ? TransportDataUtil.parseServerOutout(decoder.tsbuffer, decoder.serviceMap, bytes) : parseClientInput(bytes);
    assert(parsed.isSucc, parsed.errMsg);
    const result = parsed.result;
    if (['PlayerInput', 'RoomChat', 'Ready', 'CreateRoom', 'Join'].includes(result.service.name)
        || result.service.name === 'RoomEvent' && result.msg.type === 'chat') {
      network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent', kind: result.type, name: result.service.name,
        ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err} : {payload: result.msg ?? result.req})});
    }
  });
}
async function editPresets(session, values) {
  await click(session, '#open-quick-chat-settings');
  for (const [code, text] of Object.entries(values)) await input(session, field(code), text);
  await click(session, '#quick-chat-settings-save');
  await click(session, '#quick-chat-settings-cancel');
  assert.deepEqual(await saved(session), values);
}
async function confirmedQuick(session, code, text, observers = [session], repeat = false) {
  const before = await world(session), sender = before.players.find(player => player.id === before.playerId);
  const from = network.length;
  await click(session, 'canvas');
  await key(session, code, code);
  if (repeat) await key(session, code, code, 'keyDown', {autoRepeat: true});
  await key(session, code, code, 'keyUp');
  const expected = `${sender.name}: ${text}`;
  for (const observer of observers) await waitUntil(observer, `${logExpression}.filter(value=>value===${JSON.stringify(expected)}).length===1`);
  await waitUntil(session, `document.querySelector('${chatStatus}').textContent===''`);
  assert.equal(chatRows(from, session).length, 1);
  assert.deepEqual(chatRows(from, session)[0].payload, {text, channel: 0});
  const response = network.slice(from).find(row => row.page === session && row.name === 'RoomChat' && row.direction === 'received');
  assert(response?.success);
  const events = network.slice(from).filter(row => observers.includes(row.page) && row.name === 'RoomEvent');
  assert.equal(events.length, observers.length);
  assert(events.every(row => row.payload.playerId === sender.id && row.payload.message === expected));
  evidence.checks.push({name: `${code} ${before.phase} authoritative exactly-once${repeat ? ' repeat suppressed' : ''}`, response, events});
}
async function noQuick(session, name, action) {
  const from = network.length;
  await action();
  await pause(200);
  assert.equal(chatRows(from, session).length, 0, name);
  evidence.checks.push({name, roomChatRequests: 0});
}
async function createRoom(session, mode = 1) {
  if (!await evaluate(session, `document.querySelector('#create-room-controls').open`)) await click(session, '#create-room-controls summary');
  await input(session, '#room-name', '快捷聊天验收');
  await click(session, '#room-mode');
  await press(session, 'Home', 'Home');
  for (let index = 1; index < mode; index++) await press(session, 'ArrowDown', 'ArrowDown');
  await press(session, 'Enter', 'Enter');
  await waitUntil(session, `[...document.querySelector('#room-map').options].some(option=>option.value==='7')`);
  const mapIndex = await evaluate(session, `[...document.querySelector('#room-map').options].findIndex(option=>option.value==='7')`);
  await click(session, '#room-map');
  await press(session, 'Home', 'Home');
  for (let index = 0; index < mapIndex; index++) await press(session, 'ArrowDown', 'ArrowDown');
  await press(session, 'Enter', 'Enter');
  await click(session, '#create-room');
  await waitUntil(session, `(${worldExpression})?.mapLoaded&&!document.querySelector('#leave').hidden&&(${worldExpression}).phase==='WAITING'&&!document.querySelector('.battle-chat').hidden&&window.quickChatBattle.players.resourcesReady`);
  return world(session);
}
try {
  await launchServer();
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    plugins: [{name: 'quick-chat-readiness-observer', transform(source, id) {
      if (!id.endsWith('/src/match/battle.ts')) return;
      return source + `\nconst setQuickChats = Battle.prototype.setQuickChats; Battle.prototype.setQuickChats = function(value) {window.quickChatBattle = this; window.quickPresetWrites.push({...value}); return setQuickChats.call(this, value);};\n`;
    }}],
    server: {port: 5297, strictPort: true, host: '127.0.0.1', hmr: false, proxy: {'/game': {target: 'ws://127.0.0.1:3267', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  await launchBrowser();
  const a = await newPage();
  if (repeatOnly) {
    evidence.scope = 'M6-08-Q final production native F5 repeat and blank F12 browser default suppression.';
    const values = {...Object.fromEntries(codes.map(code => [code, ''])), F5: '最终重复按键确认'};
    await editPresets(a, values);
    const initial = await createRoom(a);
    await confirmedQuick(a, 'F5', values.F5, [a], true);
    const typedFrom = network.length;
    const sender = initial.players.find(player => player.id === initial.playerId);
    const text = '普通聊天输入确认';
    await input(a, chatInput, text);
    await press(a, 'Enter', 'Enter');
    await waitUntil(a, `${logExpression}.filter(value=>value===${JSON.stringify(`${sender.name}: ${text}`)}).length===1&&document.querySelector('${chatInput}').value===''`);
    assert.equal(chatRows(typedFrom, a).length, 1);
    assert.deepEqual(chatRows(typedFrom, a)[0].payload, {text, channel: 0});
    const typedResponse = network.slice(typedFrom).find(row => row.page === a && row.name === 'RoomChat' && row.direction === 'received');
    assert(typedResponse?.success);
    evidence.checks.push({name: 'ordinary typed Enter uses shared send, acknowledged log and cleared input', response: typedResponse});
    await noQuick(a, 'blank F12 no request and room retained', async () => {await click(a, 'canvas'); await press(a, 'F12', 'F12');});
    assert.equal((await world(a)).roomId, initial.roomId);
    assert.deepEqual(await saved(a), values);
    await screenshot(a, 'room');
  } else {
    await input(a, '#player-name', '快捷甲');
    const {browserContextId} = await command('Target.createBrowserContext');
    contexts.push(browserContextId);
    const b = await newPage(browserContextId);
    await input(b, '#player-name', '快捷乙');
    await noQuick(a, 'outside-room F5-F12 no RPC', async () => {await click(a, '#world'); for (const code of codes) await press(a, code, code);});
    await ready(a);
    await click(a, '#open-quick-chat-settings');
    assert.equal(await evaluate(a, `[...document.querySelectorAll('[data-quick-chat-key]')].length`), 8);
    for (const code of codes) assert.equal(await evaluate(a, `document.querySelector('${field(code)}').value`), '');
    await click(a,field('F5'));
    await command('Input.imeSetComposition',{text:'中文输入验证',selectionStart:6,selectionEnd:6},a);
    await evaluate(a,'new Promise(requestAnimationFrame)');
    assert.equal(await evaluate(a,`document.querySelector('${field('F5')}').value`),'中文输入验证');
    await command('Input.insertText',{text:'中文输入验证'},a);
    await evaluate(a,'new Promise(requestAnimationFrame)');
    assert.equal(await evaluate(a,`document.querySelector('${field('F5')}').value`),'中文输入验证');
    evidence.checks.push({name:'native Chinese IME composition and commit retained in React controlled input'});
    await input(a, field('F5'), '取消草稿');
    await click(a, '#quick-chat-settings-cancel');
    await click(a, '#open-quick-chat-settings');
    assert.equal(await evaluate(a, `document.querySelector('${field('F5')}').value`), '');
    await click(a, '#quick-chat-settings-cancel');
    await editPresets(a, presets);
    await click(a, '#open-quick-chat-settings');
    await screenshot(a, '1080p-settings');
    await input(a, field('F5'), '界'.repeat(73));
    const maximum = await evaluate(a, `document.querySelector('${field('F5')}').maxLength`);
    assert.equal(maximum, 72);
    assert.equal(await evaluate(a, `document.querySelector('${field('F5')}').value.length`), 72);
    await click(a, '#quick-chat-settings-cancel');
    assert.deepEqual(await saved(a), presets);
    await click(a, '#open-quick-chat-settings');
    await input(a, field('F5'), '无效\u0007消息');
    assert.equal(await evaluate(a, `document.querySelector('${field('F5')}').value`), '无效\u0007消息', 'Native input preserves the invalid control character for validation');
    await click(a, '#quick-chat-settings-save');
    await waitUntil(a, `document.querySelector('#quick-chat-settings-status').textContent.length>0`);
    assert.deepEqual(await saved(a), presets);
    evidence.checks.push({name: 'cancel, maxlength72 and control-text visibly refused', status: await evaluate(a, `document.querySelector('#quick-chat-settings-status').textContent`)});
    await click(a, '#quick-chat-settings-cancel');
    await click(a, '#open-quick-chat-settings');
    await click(a, '#quick-chat-settings-defaults');
    for (const code of codes) assert.equal(await evaluate(a, `document.querySelector('${field(code)}').value`), '');
    assert.deepEqual(await saved(a), presets);
    await click(a, '#quick-chat-settings-save');
    await click(a, '#quick-chat-settings-cancel');
    assert.deepEqual(await saved(a), Object.fromEntries(codes.map(code => [code, ''])));
    await editPresets(a, presets);
    await reload(a);
    assert.deepEqual(await saved(a), presets);
    const uhd = await newPage(undefined, 3840, 2160);
    await click(uhd, '#open-quick-chat-settings');
    for (const code of codes) assert.equal(await evaluate(uhd, `document.querySelector('${field(code)}').value`), presets[code]);
    await screenshot(uhd, '4k-settings');
    await command('Target.closeTarget', {targetId: pages.at(-1).targetId});
    evidence.checks.push({name: 'save/default restore/refresh/new-page 4K persisted presets', presets});
    const initial = await createRoom(a);
    await click(b, '#refresh-rooms');
    await waitUntil(b, `[...document.querySelector('#room').options].some(option=>option.value===${JSON.stringify(initial.roomId)})&&!document.querySelector('#join').disabled`);
    await selectRoom(b, initial.roomId);
    await click(b, '#join');
    for (const session of [a, b]) await waitUntil(session, `(${worldExpression})?.players.length===2&&(${worldExpression}).renderedPlayers===2`);
    evidence.waitingWorlds = await Promise.all([world(a), world(b)]);
    assert(evidence.waitingWorlds.every(value => value.phase === 'WAITING' && value.players.every(player => !player.isCpu)));
    await input(a, chatInput, '普通未发送草稿');
    for (const code of codes) {await confirmedQuick(a, code, presets[code], [a, b], code === 'F5'); assert.equal(await evaluate(a, `document.querySelector('${chatInput}').value`), '普通未发送草稿');}
    await noQuick(a, 'Ctrl/Alt/Shift/Meta shortcuts suppressed', async () => {
      await click(a, 'canvas');
      for (const modifiers of [1, 2, 4, 8]) {await key(a, 'F6', 'F6', 'keyDown', {modifiers}); await key(a, 'F6', 'F6', 'keyUp', {modifiers});}
    });
    await noQuick(a, 'editable chat prevents shortcut', async () => {await click(a, chatInput); await press(a, 'F6', 'F6');});
    await noQuick(a, 'settings modal prevents shortcut', async () => {await click(a, '#open-quick-chat-settings'); await press(a, 'F6', 'F6');});
    await click(a, '#quick-chat-settings-cancel');
    await editPresets(a, {...presets, F12: ''});
    await noQuick(a, 'blank preset no RPC', async () => {await click(a, 'canvas'); await press(a, 'F12', 'F12');});
    await screenshot(a, 'waiting-self');
    await screenshot(b, 'waiting-peer');
    await click(a, '#leave');
    await waitUntil(a, `!(${worldExpression})`);
    await click(b, '#leave');
    const store=new AccountStore(join(directory,'accounts.sqlite'));
    try {
      const owner=store.open(await evaluate(a,"localStorage.getItem('cdtank-account-token')"));
      const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(row=>row.tankId===1&&row.part===0);
      const fields=value=>new Map(Object.entries(value).map(([key,value])=>[Number(key),value]));
      const equipment={name:'明确导入原战车',fields:fields(native.equipment)},base={name:'明确导入原宠物',fields:fields(native.base)};
      equipment.fields.set(0x1c,72);equipment.fields.set(0x24,1);equipment.fields.set(0x28,10011);equipment.fields.set(0x2c,10012);equipment.fields.set(0x30,10013);
      store.replaceRoleRecords(owner.accountId,{base:[base],equipment:[equipment]});
      const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa8,72,true);view.setUint32(0xa4,base.fields.get(0),true);
      store.replaceRoleProfile(owner.accountId,{bytes,strings:['','']});
      evidence.fixture={native:'world-role-attributes-native.json tank1 part0',ownedInstance:72,scope:'Explicit native owned account fixture for ordinary PLAYING movement; no combat state injected.'};
    } finally {store.close();}
    await createRoom(a, 4);
    for (let index = 0; index < 3; index++) {await waitUntil(a, `!document.querySelector('[data-add-cpu]').disabled`); await click(a, '[data-add-cpu]'); await waitUntil(a, `(${worldExpression}).players.length===${index + 2}`);}
    await waitUntil(a, `(${worldExpression}).renderedPlayers===4&&window.quickChatBattle.players.resourcesReady`);
    await click(a, '[data-ready]');
    await waitUntil(a, `(${worldExpression})?.phase==='PLAYING'`);
    evidence.playingWorld = await world(a);
    assert.equal(evidence.playingWorld.players.filter(player => player.isCpu).length, 3);
    await confirmedQuick(a, 'F7', presets.F7);
    const from = network.length;
    const beforeMove = await world(a);
    await click(a, 'canvas'); await key(a, 'w', 'KeyW'); await pause(350); await key(a, 'w', 'KeyW', 'keyUp');
    const afterMove = await world(a), id = afterMove.playerId;
    const beforePlayer = beforeMove.players.find(player => player.id === id), afterPlayer = afterMove.players.find(player => player.id === id);
    assert(network.slice(from).some(row => row.page === a && row.name === 'PlayerInput' && row.direction === 'sent' && row.payload.move === 1));
    assert(Math.hypot(afterPlayer.x - beforePlayer.x, afterPlayer.z - beforePlayer.z) > .1);
    evidence.checks.push({name: 'CPU Ready PLAYING quick message and subsequent real movement', beforePlayer, afterPlayer});
    await screenshot(a, 'playing');
    const retained = await saved(a);
    await stop(server);
    await waitUntil(a, `document.querySelector('#battle-status').value.includes('连接已断开')`);
    const failureStatus = await evaluate(a, `document.querySelector('#battle-status').value`);
    assert(failureStatus.includes('连接已断开，请返回后重新加入'));
    assert.deepEqual(await saved(a), retained);
    await noQuick(a, 'disconnected shortcut no RPC', async () => {await press(a, 'F5', 'F5');});
    await screenshot(a, 'disconnected');
    await launchServer();
    await reload(a);
    assert.deepEqual(await saved(a), retained);
    await createRoom(a);
    await confirmedQuick(a, 'F5', presets.F5);
    await click(a, '#leave');
    evidence.checks.push({name: 'visible real disconnect retains presets; server restart/reload normal room sends restored F5', failureStatus});
    ws.close(); await stop(chrome);
    await launchBrowser();
    const reopened = await newPage();
    await click(reopened, '#open-quick-chat-settings');
    for (const code of codes) assert.equal(await evaluate(reopened, `document.querySelector('${field(code)}').value`), retained[code]);
    await screenshot(reopened, 'profile-reopened');
    evidence.checks.push({name: 'Chromium restart same profile restores editor presets', presets: retained});
    await click(reopened,'#quick-chat-settings-cancel');
    const diagnosticsContext=async()=>{const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);return browserContextId;};
    const malformed=await newPage(await diagnosticsContext(),1920,1080,`localStorage.setItem('${storageKey}','{broken');`);
    await click(malformed,'#open-quick-chat-settings');
    for(const code of codes)assert.equal(await evaluate(malformed,`document.querySelector('${field(code)}').value`),'');
    await click(malformed,'#quick-chat-settings-cancel');
    const denied=await newPage(await diagnosticsContext(),1920,1080,`for(const method of ['getItem','setItem']){const original=Storage.prototype[method];Storage.prototype[method]=function(name,...args){if(name==='${storageKey}')throw new DOMException('Fixture storage disabled','SecurityError');return original.call(this,name,...args);};}`);
    await click(denied,'#open-quick-chat-settings');
    assert((await evaluate(denied,`document.querySelector('#quick-chat-settings-status').textContent`)).includes('无法读取'));
    const writeCount=await evaluate(denied,'window.quickPresetWrites.length');
    await input(denied,field('F5'),'保存失败草稿');await click(denied,'#quick-chat-settings-save');
    assert((await evaluate(denied,`document.querySelector('#quick-chat-settings-status').textContent`)).includes('无法保存'));
    assert.equal(await evaluate(denied,'window.quickPresetWrites.length'),writeCount);
    await click(denied,'#quick-chat-settings-cancel');await click(denied,'#open-quick-chat-settings');
    assert.equal(await evaluate(denied,`document.querySelector('${field('F5')}').value`),'');
    evidence.checks.push({name:'malformed defaults, denied read diagnostics, native failed save preserves active presets and reopen discards draft',writeCount});

  }
  evidence.status = 'PASS';
  await rm(`${output}-failure.png`, {force: true});
  console.log(repeatOnly ? 'PASS: final production F5 repeat, blank F12 room retained, ordinary typed Enter acknowledged and draft cleared' : 'PASS: quick-chat editor/persistence, all F5-F12 authoritative peer delivery, repeat/modifier/focus/modal/blank isolation, draft retained, real CPU PLAYING movement and disconnect recovery');
} catch (error) {
  evidence.status = 'FAIL'; evidence.error = String(error);
  const session = pages[0]?.sessionId;
  if (session) {evidence.failureWorld = await world(session).catch(() => null); evidence.failureStatus = await evaluate(session, `document.querySelector('#battle-status')?.value`).catch(() => null); await screenshot(session, 'failure').catch(() => {});}
  throw error;
} finally {
  if (ws?.readyState === WebSocket.OPEN) ws.close();
  await vite?.close(); await stop(server); await stop(chrome);
  await rm(directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 100});
  evidence.isolation = {server: 3267, vite: 5297, chrome: 9497};
  evidence.noInjectedGameplayState = true;
  evidence.processCleanup = {serverExited: server?.exitCode !== null || server?.signalCode !== null, chromeExited: chrome?.exitCode !== null || chrome?.signalCode !== null, viteClosed: true, temporaryDirectoryRemoved: true};
  evidence.network = network;
  await writeFile(`${output}.json`, JSON.stringify(evidence, null, 2) + '\n');
  await writeFile(`${output}.log`, serverLog);
}
