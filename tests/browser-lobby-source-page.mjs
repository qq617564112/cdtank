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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3320', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-02-R-PAGE formal original lobby framework and ordinary room/account entry operations.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = `recovery/output/browser-lobby-source-page-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
await mkdir('recovery/output', {recursive: true});
const world = session => evaluate(session, worldExpression);
async function ready(session){await waitUntil(session,`document.querySelector('[data-lobby-background] [data-source-image]')&&document.querySelector('[data-room-card-id="R6"]')&&!document.querySelector('[data-room-card-create]').disabled`);}
async function newPage(browserContextId, width = 1920, height = 1080) {
  const {targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  pages.push({targetId, sessionId});
  await command('Network.enable', {}, sessionId);
  await command('Page.enable', {}, sessionId);
  await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false}, sessionId);
  await command('Page.navigate', {url: 'http://127.0.0.1:5344'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3320', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9544', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9544/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
  const client = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3320', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
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
async function snapshot(session){return evaluate(session,`(()=>{const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};const stage=document.querySelector('[data-lobby-stage]');return {stage:box(stage),background:box(document.querySelector('[data-lobby-background]')),cards:box(document.querySelector('[data-room-cards-embedded]')),players:box(document.querySelector('[data-lobby-player-panel]')),chat:box(document.querySelector('[data-source-control=lt][data-source-layout="ui/layouts/chat.xml"]')),input:document.querySelector('[data-lobby-chat-input]')?box(document.querySelector('[data-lobby-chat-input]')):null,page:document.querySelector('[data-room-card-page]').textContent,selected:document.querySelector('[data-room-card-id][aria-pressed=true]')?.dataset.roomCardId,name:document.querySelector('#player-name').value,diagnostics:[...document.querySelectorAll('#tank,#start-cpu,#create-room,#room,#open-room-cards,aside.controls')].map(e=>e.id),cardsModal:document.querySelector('dialog[data-room-cards]')!==null,sourcePictures:[...stage.querySelectorAll('.lobby-source-picture')].map(e=>({name:e.dataset.sourceControl,rect:box(e),images:[...e.querySelectorAll('[data-source-image],[data-source-frame]')].map(i=>({asset:i.dataset.sourceAsset,rect:box(i)}))}))}})()`);}
async function capture(session,label,width,height){const state=await snapshot(session),scale=Math.min(width/800,height/600),ox=(width-800*scale)/2,oy=(height-600*scale)/2;assert.deepEqual(state.diagnostics,[]);assert.equal(state.cardsModal,false);for(const[name,x,y,w,h]of [['stage',0,0,800,600],['background',0,0,800,600],['cards',0,84,615,321],['players',610,97,190,503],['chat',9,426,594,132]]){const r=state[name];for(const[key,value]of [['x',ox+x*scale],['y',oy+y*scale],['width',w*scale],['height',h*scale]])assert(Math.abs(r[key]-value)<.15,name+' '+key);}assert.equal(state.name,'整页中文玩家');await screenshot(session,label);captures.push({file:output+'-'+label+'.png',label,state});return state;}
async function returnModal(session,kind){const selector=kind==='home'?'[data-room-card-home]':'[data-room-card-shop]',id=kind==='home'?'home-inventory':'account-shop';await click(session,selector);await waitUntil(session,`document.querySelector('#${id}')?.open&&document.querySelector('#${id}').getAttribute('aria-busy')==='false'`);await press(session,'Escape','Escape');await waitUntil(session,`document.activeElement?.matches('${selector}')`);const s=await snapshot(session);assert.equal(s.selected,'R17');assert.equal(s.page,'2 / 2');assert.equal(s.name,'整页中文玩家');return s;}
try{
 await launchServer();vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5344,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3320',ws:true,rewrite:()=> '/'}}}});await vite.listen();
 for(let id=6;id<=17;id++){const owner=await fixtureClient();const r=await owner.callApi('CreateRoom',{mode:1,mapId:7,minPlayers:2,maxPlayers:6,roomName:'整页房'+id,name:'房主'+id,tankId:1});assert(r.isSucc);assert.equal(r.res.room.id,'R'+id);}
 await launchBrowser();const page=await newPage();await input(page,'#player-name','整页中文玩家');
 await evaluate(page,`(async()=>{await Promise.all([...document.querySelectorAll('[data-source-asset]')].map(async e=>{const i=new Image();i.src='/'+e.dataset.sourceAsset;await i.decode()}))})()`);
 for(const[width,height,label]of [[800,600,'800'],[1920,1080,'1080p'],[3840,2160,'4k']]){
 await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);await pause(220);
 if((await snapshot(page)).page==='2 / 2')await click(page,'[data-room-card-previous]');
 await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1},page);await capture(page,label+'-first',width,height);
 await click(page,'[data-room-card-id="R6"]');await click(page,'[data-room-card-next]');await click(page,'[data-room-card-id="R17"]');await waitUntil(page,`document.querySelector('[data-room-card-id="R17"]').getAttribute('aria-pressed')==='true'`);
 const home=await returnModal(page,'home'),shop=await returnModal(page,'shop');
 await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1},page);await capture(page,label+'-second',width,height);
 evidence.checks.push({name:label+' full source background/frame/regions; ordinary paging/select/Home/Shop returns with focus and Chinese identity',home,shop});
 }
 await click(page,'[data-room-card-sort]');await click(page,'[data-room-card-sort]');assert.equal((await snapshot(page)).page,'1 / 2');
 await click(page,'[data-room-card-create]');await waitUntil(page,`document.querySelector('[data-map-selector-confirm]')&&!document.querySelector('[data-map-selector-confirm]').disabled`);await click(page,'[data-map-selector-close]');await waitUntil(page,`document.activeElement?.matches('[data-room-card-create]')`);
 await click(page,'[data-room-card-create]');await waitUntil(page,`document.querySelector('[data-map-selector-confirm]')&&!document.querySelector('[data-map-selector-confirm]').disabled`);await click(page,'[data-map-selector-confirm]');await waitUntil(page,`document.querySelector('[data-room-create-name]')`);await input(page,'[data-room-create-name]','取消整页中文建房');await click(page,'[data-room-create-cancel]');await waitUntil(page,`document.activeElement?.matches('[data-room-card-create]')`);evidence.checks.push({name:'ordinary sorting and source map selection/create cancellation restore source opener without creating room'});
 await click(page,'[data-room-card-next]');await click(page,'[data-room-card-id="R17"]');const from=network.length;await click(page,'[data-room-card-express]');await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);const joined=network.slice(from).find(n=>n.page===page&&n.name==='Join'&&n.direction==='received');assert(joined?.success);const w=await world(page);assert.equal(w.roomId,'R17');assert.equal(w.playerId,joined.response.playerId);if(!await evaluate(page,`document.querySelector('dialog[data-waiting-room]')?.open`))await click(page,'[data-open-waiting-room]');await waitUntil(page,`document.querySelector('[data-waiting-close]')`);await click(page,'[data-waiting-close]');await waitUntil(page,`!(${worldExpression})&&document.querySelector('[data-lobby-page]')&&!document.querySelector('[data-lobby-page]').hidden`);assert.equal((await snapshot(page)).name,'整页中文玩家');evidence.checks.push({name:'source directory Join reaches authoritative WAITING; ordinary source Leave returns formal full lobby and retains Chinese identity',joined,world:w});
 await writeFile(output+'-pixel-input.json',JSON.stringify(captures));evidence.pixels=JSON.parse(execFileSync('recovery/.venv/bin/python',['tests/lobby-source-page-pixels.py',output+'-pixel-input.json'],{encoding:'utf8',maxBuffer:8*1024*1024}));evidence.status='PASS';console.log('PASS formal original lobby framework 3 resolutions / source pixels / ordinary room-account entries');
}catch(error){evidence.status='FAIL';evidence.error=error.stack??String(error);const session=pages[0]?.sessionId;if(session){evidence.failureState=await snapshot(session).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
}finally{for(const f of fixtures)await f.disconnect();if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3320,vite:5344,chrome:9544};evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.captures=captures;evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);}
