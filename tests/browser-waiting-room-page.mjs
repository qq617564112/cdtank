import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const {WsClient} = require('tsrpc');
const {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3321', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-03-R-PAGE formal source waiting page, direct entry and ordinary source actions.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = `recovery/output/browser-waiting-room-page-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
await mkdir('recovery/output', {recursive: true});
const world = session => evaluate(session, worldExpression);
async function ready(session){await waitUntil(session,`document.querySelector('[data-lobby-background] [data-source-image]')&&document.querySelector('[data-room-card-id="R1"]')&&!document.querySelector('[data-room-card-create]').disabled`);}
async function newPage(browserContextId, width = 1920, height = 1080) {
  const {targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  pages.push({targetId, sessionId});
  await command('Network.enable', {}, sessionId);
  await command('Page.enable', {}, sessionId);
  await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false}, sessionId);
  await command('Page.navigate', {url: 'http://127.0.0.1:5345'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3321', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9545', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9545/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['CreateRoom', 'Join', 'Leave', 'ListRooms', 'ListMaps', 'RoomSnapshot', 'Inventory', 'Kitbag', 'Shop'].includes(result.service.name)) {
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
  const client = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3321', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
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
const captures=[];
async function snapshot(session){return evaluate(session,`(()=>{const d=document.querySelector('[data-waiting-room]'),box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {open:d.open,formal:d.dataset.waitingRoomFormal,dialog:box(d),stage:box(d.querySelector('[data-waiting-room-stage]')),opener:!!document.querySelector('[data-open-waiting-room]'),temporary:!!document.querySelector('.battle-match[data-phase=WAITING]'),duplicateReady:!!document.querySelector('[data-ready]'),duplicateTeam:!!document.querySelector('[data-change-team]'),duplicateRoster:!!document.querySelector('[data-waiting-roster]'),roomName:d.querySelector('[data-source-control=txtRoomName]').textContent,mapName:d.querySelector('[data-source-control=txtMapName]').textContent,players:[...d.querySelectorAll('[data-waiting-source-player]')].map(e=>({id:e.dataset.waitingSourcePlayer,team:e.dataset.team,ready:e.dataset.waitingPlayerReady})),ready:d.querySelector('[data-waiting-ready]').getAttribute('aria-pressed'),management:!!d.querySelector('[data-waiting-management]')}})()`);}
try{
 await launchServer();vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5345,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3321',ws:true,rewrite:()=> '/'}}}});await vite.listen();
 await launchBrowser();const page=await newPage();await input(page,'#player-name','等待整页中文');await click(page,'[data-room-card-create]');await waitUntil(page,`document.querySelector('[data-map-selector-confirm]')&&!document.querySelector('[data-map-selector-confirm]').disabled`);await click(page,'[data-map-selector-mode="1"]');await click(page,'[data-map-selector-map="7"]');await click(page,'[data-map-selector-confirm]');await waitUntil(page,`document.querySelector('[data-room-create-name]')`);await input(page,'[data-room-create-name]','原等待整页中文房');await click(page,'[data-room-create-confirm]');await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'&&!document.querySelector('[data-room-create-dialog]')&&document.querySelector('[data-waiting-room]')?.open&&document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);
 const w=await world(page);const peer=await fixtureJoin(w.roomId,'普通队友');await waitUntil(page,`document.querySelectorAll('[data-waiting-source-player]').length===2`);
 for(const[width,height,label]of [[800,600,'800'],[1920,1080,'1080p'],[3840,2160,'4k']]){
 await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);const expectedScale=Math.max(.25,Math.min((width-64)/615,(height-180)/391,2));await waitUntil(page,`Math.abs(document.querySelector('[data-waiting-room-stage]').getBoundingClientRect().width-${615*expectedScale})<.01`);const s=await snapshot(page);assert.equal(s.open,true);assert.equal(s.formal,'true');assert.equal(s.opener,false);assert.equal(s.temporary,false);assert.equal(s.duplicateReady,false);assert.equal(s.duplicateTeam,false);assert.equal(s.duplicateRoster,false);assert(s.roomName.startsWith('原等待整页中文房'));assert(s.management);assert(s.stage.x>=0&&s.stage.y>=0&&s.stage.x+s.stage.width<=width+1&&s.stage.y+s.stage.height<=height+1);assert.equal(s.players.length,2);
 await screenshot(page,label);captures.push({file:output+'-'+label+'.png',state:s});await click(page,'[data-waiting-ready]');await waitUntil(page,`document.querySelector('[data-waiting-ready]').getAttribute('aria-pressed')==='true'&&!document.querySelector('[data-waiting-ready]').disabled`);assert(await evaluate(page,`[...document.querySelectorAll('[data-waiting-team]')].every(e=>e.disabled)`));await click(page,'[data-waiting-ready]');await waitUntil(page,`document.querySelector('[data-waiting-ready]').getAttribute('aria-pressed')==='false'&&!document.querySelector('[data-waiting-ready]').disabled`);await press(page,'Escape','Escape');assert.equal((await snapshot(page)).open,true);evidence.checks.push({name:label+' formal source page direct entry/Chinese room and two source slots; Ready/Cancel/Escape preserves source page',state:s});
 }
 const before=(await snapshot(page)).players.find(p=>p.id===w.playerId);const next=before.team==='0'?'1':'0';await click(page,`[data-waiting-team="${next}"]`);await waitUntil(page,`document.querySelector('[data-waiting-source-player="${w.playerId}"]').dataset.team==='${next}'`);assert.equal(await evaluate(page,`document.querySelector('[data-waiting-ready]').getAttribute('aria-pressed')`),'false');
 await click(page,'[data-add-cpu]');await waitUntil(page,`document.querySelector('[data-remove-cpu]')`);const cpu=await evaluate(page,`document.querySelector('[data-remove-cpu]').dataset.removeCpu`);await click(page,`[data-remove-cpu="${cpu}"]`);await waitUntil(page,`!document.querySelector('[data-remove-cpu]')`);await click(page,'[data-autopilot]');await waitUntil(page,`document.querySelector('[data-autopilot]').getAttribute('aria-pressed')==='true'&&!document.querySelector('[data-autopilot]').disabled`);await click(page,'[data-autopilot]');await waitUntil(page,`document.querySelector('[data-autopilot]').getAttribute('aria-pressed')==='false'&&!document.querySelector('[data-autopilot]').disabled`);evidence.checks.push({name:'ordinary source ChangeTeam plus existing CPU add/remove and autopilot transactions remain reachable in formal waiting page'});
 await click(page,'[data-waiting-close]');await waitUntil(page,`!(${worldExpression})&&!document.querySelector('[data-waiting-room]')&&!document.querySelector('[data-lobby-page]').hidden`);await waitUntil(page,`document.querySelector('[data-room-card-id="${w.roomId}"]')`);await click(page,`[data-room-card-id="${w.roomId}"]`);await click(page,'[data-room-card-express]');await waitUntil(page,`(${worldExpression})?.mapLoaded&&document.querySelector('[data-waiting-room]')?.open&&document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);assert.equal((await snapshot(page)).ready,'false');await click(page,'[data-waiting-close]');await waitUntil(page,`!(${worldExpression})&&!document.querySelector('[data-waiting-room]')`);evidence.checks.push({name:'source Leave returns formal lobby, ordinary re-entry directly opens source page with cleared ready then source Leave cleans again'});evidence.status='PASS';console.log('PASS formal waiting page 3res/source controls/CPU transactions/Leave reentry');
}catch(error){evidence.status='FAIL';evidence.error=error.stack??String(error);const session=pages[0]?.sessionId;if(session){evidence.failureState=await snapshot(session).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
}finally{for(const f of fixtures)await f.disconnect();if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3321,vite:5345,chrome:9545};evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.captures=captures;evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);}
