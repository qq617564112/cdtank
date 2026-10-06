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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3190', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-mode-icons-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-02-CM exact source mode imagery in five real system rooms with native selection and refresh.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
function parseClientInput(bytes) {
  const envelope = TransportDataUtil.tsbuffer.decode(bytes, 'ServerInputData');
  assert(envelope.isSucc, envelope.errMsg);
  const service = decoder.serviceMap.id2Service[envelope.value.serviceId];
  const payload = decoder.tsbuffer.decode(envelope.value.buffer, service.type === 'api' ? service.reqSchemaId : service.msgSchemaId);
  assert(payload.isSucc, payload.errMsg);
  return {isSucc: true, result: {type: service.type, service, ...(service.type === 'api' ? {req: payload.value} : {msg: payload.value})}};
}
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
const output = 'recovery/output/browser-room-mode-icons';
await mkdir('recovery/output', {recursive: true});
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5225'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3190', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9295', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9295/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
const modal = 'dialog[data-room-cards]';
const card = id => `[data-room-card-id="${id}"]`;
const modalState = session => evaluate(session, `(()=>{const d=document.querySelector('${modal}');return {open:d.open,sort:d.querySelector('[data-room-card-sort]').dataset.roomCardSortMode,selected:document.querySelector('#room').value,cards:[...d.querySelectorAll('[data-room-card-id]')].map(e=>{const c=e.querySelector('[data-source-control="picGameMode"]');const r=c.getBoundingClientRect();return {id:e.dataset.roomCardId,selected:e.getAttribute('aria-pressed'),asset:c.dataset.sourceAsset,background:getComputedStyle(c).backgroundImage,text:c.textContent,title:c.title,hidden:c.hidden,display:getComputedStyle(c).display,rect:{x:r.x,y:r.y,width:r.width,height:r.height},native:{left:c.style.left,top:c.style.top,width:c.style.width,height:c.style.height}}})}})()`);
async function refreshCards(session) {
  const from=network.length;
  await click(session,'[data-room-card-refresh]');
  await waitUntil(session,`!document.querySelector('[data-room-card-refresh]').disabled`);
  for(let attempt=0;attempt<100&&!network.slice(from).some(row=>row.page===session&&row.name==='ListRooms'&&row.direction==='received');attempt++)await pause(50);
  const listed=network.slice(from).find(row=>row.page===session&&row.name==='ListRooms'&&row.direction==='received');
  assert(listed?.success,JSON.stringify(listed));
  return listed.response.rooms;
}
// Native RoomListItem raw mode 0..4 selects these original source image references.
const expectedReferences = ["set:gy0 image:data\\ui\\gy\\0.tga", "set:gy0 image:data\\ui\\gy\\1.tga", "set:gy0 image:data\\ui\\gy\\2.tga", "set:gy0 image:data\\ui\\gy\\3.tga", "set:gy0 image:data\\ui\\gy\\4.tga"];
async function verifyIcons(session, rooms, width, height) {
  assert.equal(expectedReferences.length,5,'Source mapping must be supplied');
  const expected = await evaluate(session,`(async()=>{const ui=await (await fetch('/ui.json')).json();return ${JSON.stringify(expectedReferences)}.map(reference=>{const match=/^set:(\\S+) image:(.+)$/.exec(reference);const sets=ui.imagesets.filter(set=>set.attributes.Name===match[1]);const set=sets.find(set=>set.path.includes('imagesets_dds/'))??sets[0];return {reference,asset:set.images.find(image=>image.Name===match[2]).asset}})})()`);
  const state=await modalState(session);
  assert.deepEqual(state.cards.map(c=>c.id).sort(),['R1','R2','R3','R4','R5']);
  if(state.sort==='ID')assert.deepEqual(state.cards.map(c=>c.id),['R1','R2','R3','R4','R5']);
  for(const row of state.cards){
    const room=rooms.find(room=>room.id===row.id);assert(room);assert.equal(room.mode,Number(row.id.slice(1)));
    const source=expected[room.mode-1];assert(source.asset);assert.equal(row.asset,source.asset);
    assert(row.background.includes('/'+source.asset));assert.equal(row.text,'');assert(row.title.length>0);
    assert(!row.hidden&&row.display!=='none');
    assert(row.rect.width>0&&row.rect.height>0&&row.rect.x>=0&&row.rect.y>=0&&row.rect.x+row.rect.width<=width&&row.rect.y+row.rect.height<=height);
    assert.deepEqual(row.native,{left:'42px',top:'7px',width:'79px',height:'22px'});
  }
  const decoded=await evaluate(session,`Promise.all(${JSON.stringify(expected)}.map(source=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({...source,width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(new Error(source.asset));image.src='/'+source.asset})))`);
  assert(decoded.every(row=>row.width>0&&row.height>0));
  evidence.checks.push({name:`five exact original mode references and actual PNG decoding at ${width}x${height}`,rooms,state,decoded});
  return state;
}
try {
  await launchServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5225,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3190',ws:true,rewrite:()=> '/'}}}});
  await vite.listen();await launchBrowser();
  const page=await newPage();
  await click(page,'#refresh-rooms');
  await waitUntil(page,`!document.querySelector('#refresh-rooms').disabled&&document.querySelector('#room').options.length===5`);
  await click(page,'#open-room-cards');
  await waitUntil(page,`document.querySelector('${modal}').open&&document.querySelector('${card('R5')} [data-source-control="picGameMode"]')`);
  let rooms=await refreshCards(page);
  await verifyIcons(page,rooms,1920,1080);await screenshot(page,'1080p');
  await click(page,card('R3'));assert.equal((await modalState(page)).selected,'R3');
  await click(page,'[data-room-card-sort]');await waitUntil(page, `document.querySelector('[data-room-card-sort]').dataset.roomCardSortMode === 'EMPTY'`);rooms=await refreshCards(page);
  assert.equal((await modalState(page)).selected,'R3');await verifyIcons(page,rooms,1920,1080);
  evidence.checks.push({name:'native card selection, EMPTY sorting and real refresh retain selected room and all mode assets'});
  await click(page,'[data-room-card-sort]');await waitUntil(page, `document.querySelector('[data-room-card-sort]').dataset.roomCardSortMode === 'ID'`);
  await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},page);
  await verifyIcons(page,rooms,3840,2160);await screenshot(page,'4k');
  evidence.status='PASS';await rm(`${output}-failure.png`,{force:true});console.log('PASS: five original mode icon assets, real system rooms, native selection/sort/refresh and 1080p/4K');
} catch(error) {
  evidence.status='FAIL';evidence.error=error.stack??String(error);
  const session=pages[0]?.sessionId;if(session){evidence.failureState=await modalState(session).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
} finally {
  if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.isolation={server:3190,vite:5225,chrome:9295};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;
  await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);
}
