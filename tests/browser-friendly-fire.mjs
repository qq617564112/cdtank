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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3181', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-friendly-fire-'));
let server, chrome, vite, ws;
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-02-F native friendly-fire controls and ordinary browser combat.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = 'recovery/output/browser-friendly-fire';
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5219'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3181', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9289', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9289/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['PlayerInput', 'Ready', 'CreateRoom', 'Join', 'ListRooms', 'ListMaps', 'Cpu', 'ChangeTeam', 'RoomEvent', 'RoomSnapshot'].includes(result.service.name)) {
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
    await waitUntil(session, `(${worldExpression}).renderedPlayers===(${worldExpression}).players.length&&(${worldExpression}).renderedActions.length>=(${worldExpression}).players.length`);
    await click(session, '[data-ready]');
    await pause(250);
    await waitUntil(session, `(${worldExpression}).match.readyPlayerIds.includes((${worldExpression}).playerId)`);
  }
}
try {
  await launchServer();
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    server: {port: 5219, strictPort: true, host: '127.0.0.1', hmr: false, proxy: {'/game': {target: 'ws://127.0.0.1:3181', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  await launchBrowser();
  const a = await newPage();
  await input(a, '#player-name', '友伤甲');
  const {browserContextId: peerContext} = await command('Target.createBrowserContext');
  contexts.push(peerContext);
  const b = await newPage(peerContext);
  await input(b, '#player-name', '友伤乙');
  const {browserContextId: opponentContext} = await command('Target.createBrowserContext');
  contexts.push(opponentContext);
  const c = await newPage(opponentContext);
  await input(c, '#player-name', '静止敌方');
  await click(a, '#create-room-controls summary');
  const state = () => evaluate(a, `({checked:document.querySelector('#room-friendly-fire').checked,disabled:document.querySelector('#room-friendly-fire').disabled})`);
  await chooseMap(a, 1, 7);
  assert.deepEqual(await state(), {checked:false,disabled:false});
  await click(a, '#room-friendly-fire');
  assert.deepEqual(await state(), {checked:true,disabled:false});
  await chooseMap(a, 4, 7);
  assert.deepEqual(await state(), {checked:false,disabled:true});
  for (const mode of [5,6]) {
    const maps = network.find(row=>row.page===a&&row.name==='ListMaps'&&row.direction==='received').response.maps;
    const map = maps.find(map=>map.mode===mode);
    if (map) {await chooseMap(a, mode, map.mapId); assert.deepEqual(await state(),{checked:false,disabled:true});}
  }
  for (const mode of [2,3,1]) {await select(a,'#room-mode',mode);assert.deepEqual(await state(),{checked:false,disabled:false});}
  await chooseMap(a, 1, 7);
  evidence.checks.push({name:'default off; team modes1–3 enabled; personal modes disabled and reset', state:await state()});
  await input(a, '#room-min-players', '3'); await input(a, '#room-max-players', '4');
  await click(a, '#room-friendly-fire');
  await screenshot(a, '1080p-controls');
  await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},a);
  await screenshot(a, '4k-controls');
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},a);
  const wrap = angle => Math.atan2(Math.sin(angle),Math.cos(angle));
  const held = new Map();
  async function controls(session, requested) {
    await command('Page.bringToFront',{},session);
    const previous=held.get(session)??new Set();
    for(const code of previous) if(!requested.includes(code)) await key(session, keyNames[code], code, 'keyUp');
    for(const code of requested) if(!previous.has(code)) await key(session,keyNames[code],code);
    held.set(session,new Set(requested));
  }
  const keyNames={KeyW:'w',KeyA:'a',KeyD:'d',ArrowLeft:'ArrowLeft',ArrowRight:'ArrowRight',Space:' '};
  async function fight(enabled) {
    const initial = await create(a, enabled?'友伤开启':'友伤关闭');
    assert.equal(initial.request.payload.friendlyFire,enabled);
    assert.equal(initial.world.match.friendlyFire,enabled);
    const listed=await directoryRoom(b,initial.world.roomId);
    assert.equal(listed.friendlyFire,enabled);
    await click(b,'#join');
    for(const session of [a,b]) await waitUntil(session,`(${worldExpression})?.players.length===2`);
    let owner=await world(a), peer=await world(b);
    const ownerId=owner.playerId,peerId=peer.playerId,team=owner.players.find(p=>p.id===ownerId).team;
    if(peer.players.find(p=>p.id===peerId).team!==team) {
      await click(b,`[data-change-team="${team}"]`);
      await waitUntil(a,`(${worldExpression}).players.every(p=>p.team===${team})`);
    }
    await directoryRoom(c, initial.world.roomId);
    await click(c, '#join');
    await waitUntil(a,`(${worldExpression}).players.length===3`);
    owner=await world(a);
    const opponentId = (await world(c)).playerId;
    assert(owner.players.find(p=>p.id===opponentId).team!==team);
    await confirmReady(a);await confirmReady(b);await confirmReady(c);
    for(const session of [a,b]) await waitUntil(session,`(${worldExpression}).phase==='PLAYING'`);
    const from=network.length, started=Date.now();
    await click(a,'canvas');
    let hit, last;
    while(Date.now()-started<75000) {
      const value=await world(a),p=value.players.find(p=>p.id===ownerId),t=value.players.find(p=>p.id===peerId);
      last={owner:p,peer:t,elapsed:Date.now()-started};
      const event=network.slice(from).find(row=>row.page===a&&row.name==='RoomEvent'&&row.payload?.playerId===ownerId&&row.payload.targetId===peerId&&row.payload.type===(enabled?'hit':'friendlyFire'));
      if(event){hit=event;break;}
      if(value.phase!=='PLAYING')break;
      if(!p.alive||!t.alive){await controls(a,[]);await pause(250);continue;}
      const bearing=Math.atan2(t.x-p.x,t.z-p.z), distance=Math.hypot(t.x-p.x,t.z-p.z);
      const aim=wrap(bearing-p.yaw-p.aim);
      const desired=[];
      if(Math.abs(aim)>.025)desired.push(aim>0?'ArrowLeft':'ArrowRight');
      if(distance<650&&Math.abs(aim)<.035)desired.push('Space');
      await controls(a,desired);await pause(90);
    }
    await controls(a,[]);
    if(!hit) throw new Error(`Ordinary friendly shot inaccessible within75s: ${JSON.stringify(last)}`);
    await pause(250);
    const snapshots=network.slice(from).filter(row=>row.page===a&&row.name==='RoomSnapshot');
    const prior=snapshots.filter(row=>row.index<hit.index);
    const before=prior.at(-2)?.payload ?? prior.at(-1)?.payload;
    const after=prior.at(-1)?.payload ?? before;
    const hpBefore=before?.players.find(p=>p.id===peerId)?.hp,hpAfter=after?.players.find(p=>p.id===peerId)?.hp;
    assert.equal(typeof hpBefore,'number');assert.equal(typeof hpAfter,'number');
    if(enabled) assert(hpAfter<hpBefore, JSON.stringify({hpBefore,hpAfter,event:hit,beforeTick:before?.tick,afterTick:after?.tick}));
    else assert.equal(hpAfter,hpBefore);
    if(enabled) assert.equal(hit.payload.type, 'hit'); else assert.equal(hit.payload.type, 'friendlyFire');
    const syncDeadline=Date.now()+15000;
    const matchingEvent = row => row.name==='RoomEvent'&&JSON.stringify(row.payload)===JSON.stringify(hit.payload);
    const matchingSnapshot = row => row.name==='RoomSnapshot'&&row.payload.tick===after.tick;
    while (Date.now()<syncDeadline && [a,b].some(session=>!network.slice(from).some(row=>row.page===session&&matchingEvent(row))||!network.slice(from).some(row=>row.page===session&&matchingSnapshot(row)))) await pause(100);
    const eventPeers=network.slice(from).filter(matchingEvent);
    for (const session of [a,b]) assert(eventPeers.some(row=>row.page===session&&JSON.stringify(row.payload)===JSON.stringify(hit.payload)), 'Both pages must receive the same authoritative event');
    for (const session of [a,b]) {
      const synced=network.slice(from).find(row=>row.page===session&&row.name==='RoomSnapshot'&&row.payload.tick===after.tick);
      assert(synced, 'Both pages must receive the hit tick snapshot');
      assert.equal(synced.payload.players.find(p=>p.id===peerId).hp,hpAfter);
    }
    for(const session of [a,b])assert.equal((await world(session)).match.friendlyFire,enabled);
    evidence.checks.push({name:`ordinary native same-team projectile ${enabled?'damages':'does not damage'} peer`,listed,request:initial.request,event:hit,eventPeers,hpBefore,hpAfter,before,after,last});
    await screenshot(a,enabled?'on-owner':'off-owner');await screenshot(b,enabled?'on-peer':'off-peer');
    await click(a,'#leave');await click(b,'#leave');await click(c,'#leave');await waitUntil(a,`!(${worldExpression})`);
  }
  await fight(true);
  await chooseMap(a,1,7);
  if((await state()).checked)await click(a,'#room-friendly-fire');
  await input(a,'#room-min-players','3');await input(a,'#room-max-players','4');
  await fight(false);
  evidence.status = 'PASS';
  await rm(`${output}-failure.png`, {force: true});
  console.log('PASS: native friendly-fire controls, room wire/list/snapshot, ordinary same-team shots on/off and dual browser events');
} catch (error) {
  evidence.status = 'FAIL'; evidence.error = error.stack ?? String(error);
  const session = pages[0]?.sessionId;
  if (session) {evidence.failureWorld = await world(session).catch(() => null); evidence.failureStatus = await evaluate(session, `document.querySelector('#battle-status')?.value`).catch(() => null); await screenshot(session, 'failure').catch(() => {});}
  throw error;
} finally {
  if (ws?.readyState === WebSocket.OPEN) ws.close();
  await vite?.close(); await stop(server); await stop(chrome);
  await rm(directory, {recursive: true, force: true, maxRetries: 5, retryDelay: 100});
  evidence.isolation = {server: 3181, vite: 5219, chrome: 9289};
  evidence.noInjectedGameplayState = true;
  evidence.processCleanup = {serverExited: server?.exitCode !== null || server?.signalCode !== null, chromeExited: chrome?.exitCode !== null || chrome?.signalCode !== null, viteClosed: true, temporaryDirectoryRemoved: true};
  evidence.network = network;
  await writeFile(`${output}.json`, JSON.stringify(evidence, null, 2) + '\n');
  await writeFile(`${output}.log`, serverLog);
}
