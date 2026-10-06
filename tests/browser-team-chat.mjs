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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3187', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-team-chat-'));
let server, chrome, vite, ws;
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M6-08-T team chat through ordinary browser controls, authoritative current-team routing and real Ready transition.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  const result = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`${output}-${name}.png`, Buffer.from(result.data, 'base64'));
}
const world = session => evaluate(session, worldExpression);
const chatRows = (from, session) => network.slice(from).filter(row => row.page === session && row.name === 'RoomChat' && row.direction === 'sent');
async function ready(session) {
  await waitUntil(session, `document.querySelector('#tank')?.options.length===21&&localStorage.getItem('cdtank-account-token')&&!document.querySelector('#create-room').disabled&&document.querySelector('#open-quick-chat-settings')`);
}
async function newPage(browserContextId, width = 1920, height = 1080) {
  const {targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  pages.push({targetId, sessionId});
  await command('Network.enable', {}, sessionId);
  await command('Page.enable', {}, sessionId);
  await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false}, sessionId);
  await command('Page.navigate', {url: 'http://127.0.0.1:5222'}, sessionId);
  await ready(sessionId);
  await evaluate(sessionId, `window.teamChatPending=[];new MutationObserver(()=>window.teamChatPending.push(document.querySelector('[data-chat-channel]').disabled)).observe(document.querySelector('[data-chat-channel]'),{attributes:true,attributeFilter:['disabled']})`);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3187', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9292', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9292/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['PlayerInput', 'RoomChat', 'Ready', 'CreateRoom', 'Join', 'ChangeTeam'].includes(result.service.name)
        || result.service.name === 'RoomEvent' && result.msg.type === 'chat') {
      network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent', kind: result.type, name: result.service.name,
        ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err} : {payload: result.msg ?? result.req})});
    }
  });
}

const output = 'recovery/output/browser-team-chat';
const channelSelect = '[data-chat-channel]';
async function selectValue(session, selector, value) {
  const index = await evaluate(session, `[...document.querySelector(${JSON.stringify(selector)}).options].findIndex(o=>o.value===${JSON.stringify(String(value))})`);
  assert(index >= 0, `${selector} option ${value}`);
  await click(session, selector); await press(session, 'Home', 'Home');
  for (let step = 0; step < index; step++) await press(session, 'ArrowDown', 'ArrowDown');
  await press(session, 'Enter', 'Enter');
  assert.equal(await evaluate(session, `document.querySelector(${JSON.stringify(selector)}).value`), String(value));
}
async function assertLayout(session,width,height) {
  const geometry=await evaluate(session, `(()=>{const selectors=['.battle-chat','[data-chat-channel]','[data-chat-input]','.battle-chat button'];return selectors.map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect();return {selector,x:r.x,y:r.y,width:r.width,height:r.height,display:getComputedStyle(e).display};});})()`);
  assert(geometry.every(r=>r.display!=='none'&&r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height));
  const channel=geometry[1],input=geometry[2],button=geometry[3];
  assert(channel.x+channel.width<=input.x+1&&input.x+input.width<=button.x+1);
  evidence.checks.push({name:`${width}x${height} chat/channel/input/send visible without overlap`,geometry});
}
async function createRoom(session, mode = 1) {
  if (!await evaluate(session, `document.querySelector('#create-room-controls').open`)) await click(session, '#create-room-controls summary');
  await input(session, '#room-name', '队伍聊天验收');
  await selectValue(session, '#room-mode', mode);
  await waitUntil(session, `[...document.querySelector('#room-map').options].some(o=>o.value==='7')`);
  await selectValue(session, '#room-map', 7);
  await input(session, '#room-min-players', '2');
  await click(session, '#create-room');
  await waitUntil(session, `(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'&&!document.querySelector('.battle-chat').hidden&&window.teamChatBattle.players.resourcesReady`);
  return world(session);
}
async function joinRoom(session, roomId) {
  await click(session, '#refresh-rooms');
  await waitUntil(session, `[...document.querySelector('#room').options].some(o=>o.value===${JSON.stringify(roomId)}&&!o.disabled)&&!document.querySelector('#join').disabled`);
  await selectValue(session, '#room', roomId); await click(session, '#join');
  await waitUntil(session, `(${worldExpression})?.roomId===${JSON.stringify(roomId)}&&window.teamChatBattle.players.resourcesReady`);
}
async function setTeam(session, team) {
  const before = await world(session);
  if (before.players.find(p=>p.id===before.playerId).team === team) return;
  await waitUntil(session, `!document.querySelector('[data-change-team="${team}"]').disabled`);
  await click(session, `[data-change-team="${team}"]`);
  await waitUntil(session, `(${worldExpression}).players.find(p=>p.id===(${worldExpression}).playerId).team===${team}`);
}
async function confirmed(session, text, channel, observers, excluded, quick = false) {
  const before = await world(session), sender = before.players.find(p=>p.id===before.playerId);
  const expected = `${channel === 1 ? '[队伍] ' : ''}${sender.name}: ${text}`;
  const from = network.length;
  const excludedLogs = await Promise.all(excluded.map(page=>evaluate(page, logExpression)));
  const observerCounts = await Promise.all(observers.map(page=>evaluate(page, `${logExpression}.filter(v=>v===${JSON.stringify(expected)}).length`)));
  await selectValue(session, channelSelect, channel);
  if (quick) {await click(session, 'canvas'); await press(session, 'F5', 'F5');}
  else {await input(session, chatInput, text); await press(session, 'Enter', 'Enter');}
  for (let index=0;index<observers.length;index++) await waitUntil(observers[index], `${logExpression}.filter(v=>v===${JSON.stringify(expected)}).length===${observerCounts[index]+1}`);
  await waitUntil(session, `!document.querySelector('${channelSelect}').disabled`);
  if (!quick) assert.equal(await evaluate(session, `document.querySelector('${chatInput}').value`), '');
  await pause(150);
  const requests = network.slice(from).filter(row=>row.page===session&&row.direction==='sent'&&row.name==='RoomChat');
  assert.equal(requests.length, 1); assert.equal(requests[0].payload.channel, channel);
  const response = network.slice(from).find(row=>row.page===session&&row.direction==='received'&&row.name==='RoomChat');
  assert(response?.success);
  const events = network.slice(from).filter(row=>row.name==='RoomEvent');
  assert.equal(events.length, observers.length);
  assert(events.every(row=>observers.includes(row.page)&&row.payload.message===expected&&row.payload.playerId===sender.id&&row.payload.value===channel));
  for (let index=0;index<excluded.length;index++) assert.deepEqual(await evaluate(excluded[index], logExpression), excludedLogs[index]);
  evidence.checks.push({name: `${quick ? 'F5' : 'Enter'} ${before.phase} channel${channel} current team delivery`, sender: {id: sender.id, team: sender.team}, requests, response, events, excluded});
}
try {
  await launchServer();
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    plugins: [{name: 'team-chat-readiness-observer', transform(source, id) {
      if (!id.endsWith('/src/match/battle.ts')) return;
      return source + `\nconst setQuickChats = Battle.prototype.setQuickChats; Battle.prototype.setQuickChats = function(value) {window.teamChatBattle = this; return setQuickChats.call(this, value);};\n`;
    }}], server: {port: 5222, strictPort: true, host: '127.0.0.1', hmr: false,
      proxy: {'/game': {target: 'ws://127.0.0.1:3187', ws: true, rewrite: () => '/'}}}});
  await vite.listen(); await launchBrowser();
  const sessions = [];
  for (const name of ['队聊甲','队聊乙','队聊丙','隔壁丁']) {
    const {browserContextId} = await command('Target.createBrowserContext'); contexts.push(browserContextId);
    const session = await newPage(browserContextId); sessions.push(session); await input(session, '#player-name', name);
  }
  const [a,b,c,d] = sessions;
  await click(a, '#open-quick-chat-settings'); await input(a, '[data-quick-chat-key="F5"]', '跟随当前队伍');
  await click(a, '#quick-chat-settings-save'); await click(a, '#quick-chat-settings-cancel');
  const initial = await createRoom(a); await joinRoom(b, initial.roomId); await joinRoom(c, initial.roomId);
  await createRoom(d);
  for (const session of [a,b,c]) await waitUntil(session, `(${worldExpression})?.players.length===3&&(${worldExpression}).renderedPlayers===3`);
  await setTeam(a,0); await setTeam(b,0); await setTeam(c,1);
  for (const session of [a,b,c]) await waitUntil(session, `(${worldExpression}).players.filter(p=>p.team===0).length===2`);
  evidence.waitingWorlds = await Promise.all(sessions.map(world));
  assert(evidence.waitingWorlds.every(value=>value.players.every(p=>!p.isCpu)));
  assert.notEqual(evidence.waitingWorlds[0].roomId,evidence.waitingWorlds[3].roomId);
  assert.deepEqual(await evaluate(a, `[...document.querySelector('${channelSelect}').options].map(o=>[o.value,o.textContent])`), [['0','房间'],['1','队伍']]);
  await confirmed(a,'只有猫队收到',1,[a,b],[c,d]);
  await confirmed(a,'全房间一起准备',0,[a,b,c],[d]);
  await confirmed(a,'跟随当前队伍',1,[a,b],[c,d],true);
  await assertLayout(a,1920,1080); await screenshot(a,'1080p-waiting-team'); await screenshot(c,'1080p-enemy');
  await setTeam(a,1);
  for (const session of [a,b,c]) await waitUntil(session, `(${worldExpression}).players.find(p=>p.id===${JSON.stringify(initial.playerId)}).team===1`);
  await confirmed(a,'换队后发给狗队',1,[a,c],[b,d]);
  await confirmed(a,'跟随当前队伍',1,[a,c],[b,d],true);
  evidence.teamChanges = network.filter(row=>row.name==='ChangeTeam');
  assert(evidence.teamChanges.some(row=>row.page===a&&row.direction==='received'&&row.success));
  await command('Emulation.setDeviceMetricsOverride', {width:3840,height:2160,deviceScaleFactor:1,mobile:false},a);
  await assertLayout(a,3840,2160); await screenshot(a,'4k-waiting-team');
  for (const session of [a,b,c]) {await waitUntil(session, `!document.querySelector('[data-ready]').disabled`); await click(session,'[data-ready]');}
  for (const session of [a,b,c]) await waitUntil(session, `(${worldExpression})?.phase==='PLAYING'`);
  evidence.playingWorlds = await Promise.all([a,b,c].map(world));
  await confirmed(a,'战斗中继续队聊',1,[a,c],[b,d]);
  await screenshot(a,'4k-playing-team');
  await command('Emulation.setDeviceMetricsOverride', {width:1920,height:1080,deviceScaleFactor:1,mobile:false},a);
  await click(a, channelSelect);
  const focusFrom = network.length;
  await press(a,'w','KeyW'); await press(a,' ','Space'); await press(a,'5','Digit5'); await pause(200);
  const focusedInputs = network.slice(focusFrom).filter(row=>row.page===a&&row.name==='PlayerInput'&&row.direction==='sent');
  assert(focusedInputs.length>0); assert(focusedInputs.every(row=>row.payload.move===0&&row.payload.turn===0&&row.payload.aim===0&&!row.payload.fire&&!row.payload.useItem));
  evidence.checks.push({name:'Native focused channel select suppresses movement/fire/item keys',focusedInputs});
  await press(a,'Escape','Escape');
  await confirmed(a,'跟随当前队伍',1,[a,c],[b,d],true);
  await confirmed(a,'战斗公开频道',0,[a,b,c],[d]);
  await screenshot(a,'1080p-playing-public');
  await selectValue(a,channelSelect,1); await input(a,chatInput,'离开前草稿'); await click(a,'#leave');
  await waitUntil(a, `!document.body.classList.contains('in-battle')&&document.querySelector('.battle-chat').hidden`);
  assert.deepEqual(await evaluate(a,logExpression),[]); assert.equal(await evaluate(a,`document.querySelector('${chatInput}').value`),'');
  assert.equal(await evaluate(a,`document.querySelector('${channelSelect}').value`),'0');
  await click(b,'#leave');
  await waitUntil(c, `(${worldExpression})?.phase==='FINISHED'`);
  await joinRoom(a,initial.roomId);
  assert.deepEqual(await evaluate(a,logExpression),[]); assert.equal(await evaluate(a,`document.querySelector('${channelSelect}').value`),'0');
  await screenshot(a,'reentry-cleared'); await click(c,'#leave');
  evidence.checks.push({name:'Normal leave/reentry clears log/draft and restores room channel0'});
  await click(a,'#leave'); await createRoom(a,4); await selectValue(a,channelSelect,1);
  const refusedFrom=network.length;
  await input(a,chatInput,'个人模式队聊草稿'); await press(a,'Enter','Enter');
  await waitUntil(a, `document.querySelector('${chatStatus}').textContent.length>0&&!document.querySelector('${channelSelect}').disabled`);
  const refusal = network.slice(refusedFrom).find(row=>row.page===a&&row.direction==='received'&&row.name==='RoomChat');
  assert(refusal&&!refusal.success); assert.equal(await evaluate(a,`document.querySelector('${chatInput}').value`),'个人模式队聊草稿');
  assert.deepEqual(await evaluate(a,logExpression),[]); assert.equal(network.slice(refusedFrom).filter(row=>row.name==='RoomEvent').length,0);
  evidence.checks.push({name:'Personal mode server rejects team channel visibly and retains draft', refusal, status:await evaluate(a,`document.querySelector('${chatStatus}').textContent`)});
  await screenshot(a,'personal-rejection');
  evidence.pendingSelector=await evaluate(a, `window.teamChatPending`); assert(evidence.pendingSelector.includes(true)&&evidence.pendingSelector.includes(false));
  evidence.status='PASS'; await rm(`${output}-failure.png`,{force:true});
  console.log('PASS: team/public browser routing, current-team ChangeTeam/F5, real Ready PLAYING, selector focus isolation, personal refusal/draft, leave/reentry, 1080p/4K');
} catch(error) {
  evidence.status='FAIL'; evidence.error=String(error);
  const session=pages[0]?.sessionId;
  if(session) {evidence.failureWorld=await world(session).catch(()=>null); evidence.failureStatus=await evaluate(session, `document.querySelector('#battle-status')?.value`).catch(()=>null); await screenshot(session,'failure').catch(()=>{});}
  throw error;
} finally {
  if(ws?.readyState===WebSocket.OPEN) ws.close();
  await vite?.close(); await stop(server); await stop(chrome);
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.isolation={server:3187,vite:5222,chrome:9292}; evidence.noInjectedGameplayState=true;
  evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};
  evidence.network=network;
  await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n'); await writeFile(`${output}.log`,serverLog);
}
