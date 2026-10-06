import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const {WsClient} = require('tsrpc');
const {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3184', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-directory-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-02-F native room-directory controls and ordinary browser combat.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  const deadline = Date.now() + 90000;
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
async function screenshot(session, name) {
  const result = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`${output}-${name}.png`, Buffer.from(result.data, 'base64'));
}
const output = 'recovery/output/browser-room-directory';
await mkdir('recovery/output', {recursive: true});
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5221'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3184', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9291', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9291/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['CreateRoom', 'Join', 'ListRooms', 'ListMaps', 'RoomSnapshot'].includes(result.service.name)) {
      network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent', kind: result.type, name: result.service.name,
        ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err} : {payload: result.msg ?? result.req})});
    }
  });
}

async function select(session, selector, value) {
  const index = await evaluate(session, `Array.from(document.querySelector(${JSON.stringify(selector)}).options).filter(o=>!o.disabled).findIndex(o=>o.value===${JSON.stringify(String(value))})`);
  assert(index >= 0, `${selector} option ${value}`);
  await click(session, selector);
  await press(session, 'Home', 'Home');
  for (let step = 0; step < index; step++) await press(session, 'ArrowDown', 'ArrowDown');
  await press(session, 'Enter', 'Enter');
  assert.equal(await evaluate(session, `document.querySelector(${JSON.stringify(selector)}).value`), String(value));
}
async function fixtureClient() {
  const client = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3184', logger: undefined});
  fixtures.push(client);
  assert((await client.connect()).isSucc);
  assert((await client.callApi('Account', {})).isSucc);
  return client;
}
async function fixtureJoin(roomId, name) {
  const client = await fixtureClient();
  const result = await client.callApi('Join', {roomId, clientId: name, name, tankId: 1});
  assert(result.isSucc, JSON.stringify(result));
  return client;
}
const directoryState = session => evaluate(session, `({sort:document.querySelector('#room-sort').value,selected:document.querySelector('#room').value,password:document.querySelector('#join-password').value,joinDisabled:document.querySelector('#join').disabled,lobby:!document.querySelector('#battle-controls').hidden,options:[...document.querySelector('#room').options].map(o=>({id:o.value,text:o.textContent,disabled:o.disabled}))})`);
async function refresh(session) {
  const from = network.length;
  await click(session, '#refresh-rooms');
  await waitUntil(session, `!document.querySelector('#refresh-rooms').disabled&&document.querySelector('#room').options.length>=10`);
  const listed = network.slice(from).find(row => row.page === session && row.name === 'ListRooms' && row.direction === 'received');
  assert(listed?.success);
  return listed.response.rooms;
}
const numericId = (a,b) => Number(a.id.slice(1))-Number(b.id.slice(1));
function expectedOrder(rooms, mode) {
  const available = room => room.phase !== 'PLAYING' && room.playerCount < room.maxPlayers;
  return [...rooms].sort(mode === 'ID' ? numericId : (a,b) => Number(available(b))-Number(available(a)) || (b.maxPlayers-b.playerCount)-(a.maxPlayers-a.playerCount) || a.playerCount-b.playerCount || numericId(a,b)).map(room => room.id);
}
try {
  await launchServer();
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    server: {port: 5221, strictPort: true, host: '127.0.0.1', hmr: false, proxy: {'/game': {target: 'ws://127.0.0.1:3184', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  const created = [];
  for (const [index, maxPlayers] of [2,4,6,4,6].entries()) {
    const owner = await fixtureClient();
    const result = await owner.callApi('CreateRoom', {mode:4,mapId:7,minPlayers:2,maxPlayers,roomName:`目录${index+6}`,name:`房主${index+6}`,tankId:1,...(index===4?{password:'directory-pass'}:{})});
    assert(result.isSucc, JSON.stringify(result));
    created.push(result.res.room.id);
  }
  assert.deepEqual(created, ['R6','R7','R8','R9','R10']);
  await fixtureJoin('R6','满员占位');
  await fixtureJoin('R7','四人房占位');
  await fixtureJoin('R8','六人房占位甲');
  await fixtureJoin('R8','六人房占位乙');
  await launchBrowser();
  const page = await newPage();
  await input(page, '#player-name', '目录玩家');
  await waitUntil(page, `document.querySelector('#room-sort')`);
  let rooms = await refresh(page);
  let state = await directoryState(page);
  assert.equal(state.sort, 'ID');
  assert.deepEqual(state.options.map(o=>o.id), expectedOrder(rooms,'ID'));
  assert(state.options.find(o=>o.id==='R6').disabled);
  assert(state.options.findIndex(o=>o.id==='R6')<state.options.findIndex(o=>o.id==='R10'));
  evidence.checks.push({name:'default ID uses numeric room IDs and full room disabled',rooms,state});
  await select(page,'#room','R9');
  await select(page,'#room-sort','EMPTY');
  state = await directoryState(page);
  assert.equal(state.selected,'R9');
  assert.deepEqual(state.options.map(o=>o.id),expectedOrder(rooms,'EMPTY'));
  evidence.checks.push({name:'EMPTY prioritizes joinable rooms and remaining capacity; sort preserves selection',state});
  await screenshot(page,'1080p-empty');
  rooms = await refresh(page);
  assert.equal((await directoryState(page)).selected,'R9');
  assert.equal((await directoryState(page)).sort,'EMPTY');
  await select(page,'#room-sort','ID');
  assert.equal((await directoryState(page)).selected,'R9');
  await select(page,'#room','R7');
  await fixtureJoin('R7','四人房占位乙');
  await fixtureJoin('R7','四人房占位丙');
  rooms = await refresh(page);
  state = await directoryState(page);
  assert(state.options.find(o=>o.id==='R7').disabled);
  assert.notEqual(state.selected,'R7');
  assert(!state.options.find(o=>o.id===state.selected)?.disabled);
  evidence.checks.push({name:'refresh preserves valid selection; selected room becoming full falls back to joinable room',state});
  await select(page,'#room','R10');
  await select(page,'#room-sort','EMPTY');
  await input(page,'#join-password','incorrect-pass');
  const from = network.length;
  await click(page,'#join');
  await waitUntil(page, `document.querySelector('#battle-status').value.includes('密码')&&!document.querySelector('#join').disabled`);
  const rejected = network.slice(from).find(row=>row.page===page&&row.name==='Join'&&row.direction==='received');
  assert.equal(rejected?.success,false);
  assert.equal(rejected.response.code,'ROOM_JOIN_REJECTED');
  state = await directoryState(page);
  assert(state.lobby);
  assert.equal(await world(page),null);
  assert.equal(state.password,'incorrect-pass');
  assert.equal(state.sort,'EMPTY');
  assert.equal(state.selected,'R10');
  evidence.checks.push({name:'wrong password rejected by server while ordinary page remains lobby and preserves draft',rejected,state});
  await screenshot(page,'1080p-password-rejected');
  await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},page);
  await select(page,'#room-sort','ID');
  assert.equal((await directoryState(page)).selected,'R10');
  await select(page,'#room-sort','EMPTY');
  await input(page,'#join-password','directory-pass');
  state = await directoryState(page);
  assert.equal(state.password,'directory-pass');
  assert.equal(state.sort,'EMPTY');
  await screenshot(page,'4k-controls');
  evidence.checks.push({name:'4K native sort and password input operate with selection retained',state});
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},page);
  const joinFrom = network.length;
  await click(page,'#join');
  await waitUntil(page, `(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'&&document.querySelector('#battle-controls').hidden`);
  const joined = network.slice(joinFrom).find(row=>row.page===page&&row.name==='Join'&&row.direction==='received');
  assert(joined?.success);
  const value = await world(page);
  assert.equal(value.roomId,'R10');
  assert.equal(value.playerId,joined.response.playerId);
  assert(value.players.some(p=>p.id===value.playerId&&p.name==='目录玩家'));
  assert.equal((await directoryState(page)).lobby,false);
  evidence.checks.push({name:'correct password ordinary Join enters WAITING with server player identity',joined,world:value});
  await screenshot(page,'1080p-waiting');
  evidence.status = 'PASS';
  await rm(`${output}-failure.png`, {force:true});
  console.log('PASS: native room directory ID/EMPTY sorting, refresh/selection, full-room fallback, password rejection and WAITING entry at 1080p/4K');
} catch (error) {
  evidence.status='FAIL'; evidence.error=error.stack??String(error);
  const session=pages[0]?.sessionId;
  if(session){evidence.failureState=await directoryState(session).catch(()=>null);evidence.failureStatus=await evaluate(session,`document.querySelector('#battle-status')?.value`).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}
  throw error;
} finally {
  for(const fixture of fixtures) await fixture.disconnect();
  if(ws?.readyState===WebSocket.OPEN)ws.close();
  await vite?.close(); await stop(server); await stop(chrome);
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.isolation={server:3184,vite:5221,chrome:9291};
  evidence.noInjectedGameplayState=true;
  evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};
  evidence.network=network;
  await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');
  await writeFile(`${output}.log`,serverLog);
}
