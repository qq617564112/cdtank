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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3179', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-player-limits-'));
let server, chrome, vite, ws;
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-02-N normal room minimum/maximum controls, real authority, Ready and CPU membership.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  await command('Page.bringToFront', {}, session);
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
  const result = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`${output}-${name}.png`, Buffer.from(result.data, 'base64'));
}
const output = 'recovery/output/browser-room-player-limits';
const world = session => evaluate(session, worldExpression);
async function ready(session) {
  await waitUntil(session, `document.querySelector('#tank')?.options.length===21&&localStorage.getItem('cdtank-account-token')&&!document.querySelector('#create-room').disabled&&document.querySelector('#room-min-players')`);
}
async function newPage(browserContextId, width = 1920, height = 1080) {
  const {targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  pages.push({targetId, sessionId});
  await command('Network.enable', {}, sessionId);
  await command('Page.enable', {}, sessionId);
  await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false}, sessionId);
  await command('Page.navigate', {url: 'http://127.0.0.1:5218'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3179', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9288', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9288/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['PlayerInput', 'Ready', 'CreateRoom', 'Join', 'ListRooms', 'ListMaps', 'Cpu'].includes(result.service.name)) {
      network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent', kind: result.type, name: result.service.name,
        ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err} : {payload: result.msg ?? result.req})});
    }
  });
}

async function select(session, selector, value) {
  const index = await evaluate(session, `Array.from(document.querySelector(${JSON.stringify(selector)}).options).findIndex(o=>o.value===${JSON.stringify(String(value))})`);
  assert(index >= 0, `${selector} option ${value}`);
  await click(session, selector);
  await press(session, 'Home', 'Home');
  for (let step = 0; step < index; step++) await press(session, 'ArrowDown', 'ArrowDown');
  await press(session, 'Enter', 'Enter');
  assert.equal(await evaluate(session, `document.querySelector(${JSON.stringify(selector)}).value`), String(value));
}
const fields = session => evaluate(session, `({min:Number(document.querySelector('#room-min-players').value),max:Number(document.querySelector('#room-max-players').value),info:document.querySelector('#room-map-info').value})`);
function response(from, session, name) {
  return network.slice(from).find(row => row.page === session && row.name === name && row.direction === 'received');
}
async function chooseMap(session, mode, mapId) {
  await select(session, '#room-mode', mode);
  await waitUntil(session, `[...document.querySelector('#room-map').options].some(option=>option.value===${JSON.stringify(String(mapId))})`);
  await select(session, '#room-map', mapId);
}
async function create(session, name) {
  await input(session, '#room-name', name);
  const from = network.length;
  await click(session, '#create-room');
  await waitUntil(session, `(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);
  const request = network.slice(from).find(row => row.page === session && row.name === 'CreateRoom' && row.direction === 'sent');
  assert(response(from, session, 'CreateRoom')?.success);
  return {world: await world(session), request};
}
async function directoryRoom(session, roomId) {
  const from = network.length;
  await click(session, '#refresh-rooms');
  await waitUntil(session, `[...document.querySelector('#room').options].some(option=>option.value===${JSON.stringify(roomId)})&&!document.querySelector('#join').disabled`);
  await selectRoom(session, roomId);
  return response(from, session, 'ListRooms').response.rooms.find(room => room.id === roomId);
}
async function confirmReady(session) {
  const value = await world(session);
  if (!value.match.readyPlayerIds.includes(value.playerId)) {
    await click(session, '[data-ready]');
    await waitUntil(session, `(${worldExpression}).match.readyPlayerIds.includes((${worldExpression}).playerId)`);
  }
}
try {
  await launchServer();
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    server: {port: 5218, strictPort: true, host: '127.0.0.1', hmr: false, proxy: {'/game': {target: 'ws://127.0.0.1:3179', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  await launchBrowser();
  const a = await newPage();
  await input(a, '#player-name', '人数甲');
  const {browserContextId: peerContext} = await command('Target.createBrowserContext');
  contexts.push(peerContext);
  const b = await newPage(peerContext);
  await input(b, '#player-name', '人数乙');
  const {browserContextId: thirdContext} = await command('Target.createBrowserContext');
  contexts.push(thirdContext);
  const c = await newPage(thirdContext);
  await input(c, '#player-name', '人数丙');
  await click(a, '#create-room-controls summary');
  const maps = network.find(row => row.page === a && row.name === 'ListMaps' && row.direction === 'received').response.maps;
  const defaults = async (mode, mapId) => {
    await chooseMap(a, mode, mapId);
    const expected = maps.find(map => map.mode === mode && map.mapId === mapId);
    const actual = await fields(a);
    assert.equal(actual.min, expected.sourceMinPlayers);
    assert.equal(actual.max, expected.maxPlayers);
    assert(actual.info.includes(String(expected.maxPlayers)));
    evidence.checks.push({name: `mode ${mode} map ${mapId} source defaults`, actual, source: expected});
  };
  await defaults(4, 7);
  await input(a, '#room-min-players', '3'); await input(a, '#room-max-players', '3');
  const modeOne = maps.find(map => map.mode === 1);
  assert(modeOne, 'mode1 exposes a normal map');
  await defaults(1, modeOne.mapId);
  await input(a, '#room-min-players', '3'); await input(a, '#room-max-players', '3');
  await defaults(4, 7);
  const alternate = maps.find(map => map.mode === 4 && map.mapId !== 7);
  assert(alternate, 'mode4 exposes another normal map');
  await input(a, '#room-min-players', '3'); await input(a, '#room-max-players', '3');
  await select(a, '#room-map', alternate.mapId);
  let actual = await fields(a);
  assert.equal(actual.min, alternate.sourceMinPlayers); assert.equal(actual.max, alternate.maxPlayers);
  evidence.checks.push({name: 'map change discards old overrides and resets source defaults', actual, source: alternate});
  await defaults(4, 7);
  await input(a, '#room-min-players', '4'); await input(a, '#room-max-players', '3');
  const invalidFrom = network.length;
  await click(a, '#create-room');
  await waitUntil(a, `document.querySelector('#battle-status').value.includes('人数')`);
  await pause(200);
  assert(!network.slice(invalidFrom).some(row => row.page === a && row.name === 'CreateRoom' && row.direction === 'sent'));
  actual = await fields(a);
  assert.equal(actual.min, 4); assert.equal(actual.max, 3); assert.equal(await world(a), null);
  evidence.checks.push({name: 'min above max rejected visibly before RPC with inputs preserved', actual, status: await evaluate(a, `document.querySelector('#battle-status').value`), createRequests: 0});
  await input(a, '#room-min-players', '3');
  await screenshot(a, '1080p-controls');
  await command('Emulation.setDeviceMetricsOverride', {width: 3840, height: 2160, deviceScaleFactor: 1, mobile: false}, a);
  await screenshot(a, '4k-controls');
  await command('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false}, a);
  const initial = await create(a, '人数三至三');
  assert.equal(initial.request.payload.minPlayers, 3); assert.equal(initial.request.payload.maxPlayers, 3);
  assert.equal(initial.world.match.minPlayers, 3); assert.equal(initial.world.match.maxPlayers, 3);
  const listed = await directoryRoom(b, initial.world.roomId);
  assert.equal(listed.minPlayers, 3); assert.equal(listed.maxPlayers, 3);
  const joinFrom = network.length;
  await click(b, '#join');
  for (const session of [a, b]) await waitUntil(session, `(${worldExpression})?.players.length===2&&(${worldExpression}).renderedPlayers===2`);
  assert(response(joinFrom, b, 'Join')?.success);
  await directoryRoom(c, initial.world.roomId);
  await confirmReady(a); await confirmReady(b);
  await pause(300);
  for (const session of [a, b]) {
    const value = await world(session);
    assert.equal(value.phase, 'WAITING'); assert.equal(value.players.length, 2); assert.equal(value.match.readyPlayerIds.length, 2);
  }
  evidence.checks.push({name: 'both real players ready below room min3 remain WAITING', worlds: await Promise.all([world(a), world(b)]), listed});
  await waitUntil(a, `!document.querySelector('[data-add-cpu]').disabled`);
  await click(a, '[data-add-cpu]');
  for (const session of [a, b]) await waitUntil(session, `(${worldExpression}).players.length===3&&(${worldExpression}).renderedPlayers===3`);
  assert.equal((await world(a)).phase, 'WAITING');
  const cpuFrom = network.length;
  await waitUntil(a, `!document.querySelector('[data-add-cpu]').disabled`);
  await click(a, '[data-add-cpu]');
  await waitUntil(a, `document.querySelector('.battle-match [role=status]').textContent.includes('满')`);
  const cpuRejected = response(cpuFrom, a, 'Cpu');
  assert.equal(cpuRejected?.success, false);
  assert.equal((await world(a)).players.length, 3);
  evidence.checks.push({name: 'full WAITING ordinary add CPU reaches server and visibly rejects', response: cpuRejected, status: await evaluate(a, `document.querySelector('.battle-match [role=status]').textContent`)});
  const staleFrom = network.length;
  await click(c, '#join');
  await waitUntil(c, `document.querySelector('#battle-status').value.includes('满')`);
  const staleRejected = response(staleFrom, c, 'Join');
  assert.equal(staleRejected?.success, false); assert.equal(await world(c), null);
  assert.equal(await evaluate(c, `document.querySelector('#battle-controls').hidden`), false);
  evidence.checks.push({name: 'third isolated player stale normal directory Join rejected by full server and stays lobby', response: staleRejected, status: await evaluate(c, `document.querySelector('#battle-status').value`)});
  await screenshot(a, 'full-waiting'); await screenshot(c, 'full-join-rejected');
  await confirmReady(a); await confirmReady(b);
  for (const session of [a, b]) await waitUntil(session, `(${worldExpression}).phase==='PLAYING'`);
  const playing = await world(a);
  assert.equal(playing.players.filter(player => player.isCpu).length, 1);
  assert.equal(playing.players.length, 3); assert.equal(playing.match.minPlayers, 3);
  await screenshot(a, 'playing-owner'); await screenshot(b, 'playing-peer');
  const beforeMove = await world(a), moveFrom = network.length;
  await click(a, 'canvas'); await key(a, 'w', 'KeyW'); await pause(350); await key(a, 'w', 'KeyW', 'keyUp');
  const afterMove = await world(a), id = afterMove.playerId;
  const beforePlayer = beforeMove.players.find(player => player.id === id), afterPlayer = afterMove.players.find(player => player.id === id);
  assert(network.slice(moveFrom).some(row => row.page === a && row.name === 'PlayerInput' && row.direction === 'sent' && row.payload.move === 1));
  assert(Math.hypot(afterPlayer.x - beforePlayer.x, afterPlayer.z - beforePlayer.z) > .1);
  evidence.checks.push({name: 'three-member CPU room starts via ordinary Ready; native movement remains operational', playing, beforePlayer, afterPlayer});
  await click(a, '#leave'); await click(b, '#leave');
  await waitUntil(a, `!(${worldExpression})`);
  await chooseMap(a, 1, modeOne.mapId);
  await defaults(4, 7);
  const defaultRoom = await create(a, '地图默认人数');
  const source = maps.find(map => map.mode === 4 && map.mapId === 7);
  assert.equal(defaultRoom.world.match.minPlayers, source.sourceMinPlayers);
  const defaultListed = await directoryRoom(b, defaultRoom.world.roomId);
  assert.equal(defaultListed.maxPlayers, source.maxPlayers); assert.equal(defaultListed.minPlayers, source.sourceMinPlayers);
  evidence.checks.push({name: 'untouched normal defaults remain original source limits', request: defaultRoom.request, listed: defaultListed, source});
  await click(a, '#leave');
  evidence.status = 'PASS';
  await rm(`${output}-failure.png`, {force: true});
  console.log('PASS: native room min/max controls, source defaults, invalid draft preserved/no RPC, real peer Ready below minimum, full CPU/stale Join rejection, CPU PLAYING and movement');
} catch (error) {
  evidence.status = 'FAIL'; evidence.error = String(error);
  const session = pages[0]?.sessionId;
  if (session) {evidence.failureWorld = await world(session).catch(() => null); evidence.failureStatus = await evaluate(session, `document.querySelector('#battle-status')?.value`).catch(() => null); await screenshot(session, 'failure').catch(() => {});}
  throw error;
} finally {
  if (ws?.readyState === WebSocket.OPEN) ws.close();
  await vite?.close(); await stop(server); await stop(chrome);
  await rm(directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 100});
  evidence.isolation = {server: 3179, vite: 5218, chrome: 9288};
  evidence.noInjectedGameplayState = true;
  evidence.processCleanup = {serverExited: server?.exitCode !== null || server?.signalCode !== null, chromeExited: chrome?.exitCode !== null || chrome?.signalCode !== null, viteClosed: true, temporaryDirectoryRemoved: true};
  evidence.network = network;
  await writeFile(`${output}.json`, JSON.stringify(evidence, null, 2) + '\n');
  await writeFile(`${output}.log`, serverLog);
}
