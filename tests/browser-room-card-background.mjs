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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3318', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-02-C-CREATEENTRY original shopping entry opens existing React shop queries and returns directory focus/identity without purchases.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = `recovery/output/browser-room-card-background-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5342'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3318', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9542', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9542/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
  const client = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3318', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
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
const modal='dialog[data-room-cards]';const captures=[];
async function snapshot(session){return evaluate(session,`(()=>{const d=document.querySelector('${modal}'),stage=d.querySelector('[data-room-card-stage]'),bg=d.querySelector('[data-room-card-background]'),image=bg.querySelector('[data-source-image]');const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {stage:box(stage),background:{rect:box(bg),imageRect:box(image),left:bg.style.left,top:bg.style.top,width:bg.style.width,height:bg.style.height,asset:image.dataset.sourceAsset,pointer:getComputedStyle(bg).pointerEvents,imagePointer:getComputedStyle(image).pointerEvents,opacity:getComputedStyle(image).opacity,format:[image.dataset.sourceHorzFormat,image.dataset.sourceVertFormat],clip:image.dataset.sourceClip,frames:bg.querySelectorAll('[data-source-frame]').length},cards:[...d.querySelectorAll('[data-room-card-id]')].map(card=>{const r=box(card);return {id:card.dataset.roomCardId,rect:r,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===card,above:!!(bg.compareDocumentPosition(card)&Node.DOCUMENT_POSITION_FOLLOWING),text:card.querySelector('[data-source-control=txtRoomID]').textContent,disabled:card.disabled}}),controls:[...d.querySelectorAll('.room-source-page-button')].map(e=>{const r=box(e);return {source:e.dataset.sourceControl,rect:r,disabled:e.disabled,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e,above:!!(bg.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING)}}),selected:document.querySelector('#room').value,page:d.querySelector('[data-room-card-page]').textContent,sort:d.querySelector('[data-room-card-sort]').dataset.roomCardSortMode,playerName:document.querySelector('#player-name').value}})()`);}
async function capture(session,label,width,height){const s=await snapshot(session),scale=s.stage.width/615;assert.deepEqual([s.background.left,s.background.top,s.background.width,s.background.height],['0px','0px','615px','316px']);assert.equal(s.background.asset,'ui/regions/60/0.png');assert.equal(s.background.pointer,'none');assert.equal(s.background.imagePointer,'none');assert.equal(s.background.opacity,'1');assert.deepEqual(s.background.format,['HorzStretched','VertStretched']);assert.equal(s.background.clip,'inner-rectangle');assert.equal(s.background.frames,0);assert(Math.abs(s.background.rect.x-s.stage.x)<.15);assert(Math.abs(s.background.rect.y-s.stage.y)<.15);assert(Math.abs(s.background.rect.width-615*scale)<.15);assert(Math.abs(s.background.rect.height-316*scale)<.15);for(const key of ['x','y','width','height'])assert(Math.abs(s.background.rect[key]-s.background.imageRect[key])<.15);assert(s.background.rect.x>=0&&s.background.rect.y>=0&&s.background.rect.x+s.background.rect.width<=width+1&&s.background.rect.y+s.background.rect.height<=height+1);for(const card of s.cards){assert(card.hit);assert(card.above);assert.equal(card.text,card.id);}for(const control of s.controls){assert(control.above);assert(control.hit);}assert.equal(s.playerName,'背景中文玩家');await screenshot(session,label);captures.push({file:output+'-'+label+'.png',label,state:s});return s;}
async function returns(session,kind){const selector=kind==='create'?'[data-room-card-create]':kind==='home'?'[data-room-card-home]':'[data-room-card-shop]';await click(session,selector);if(kind==='create'){await waitUntil(session,`document.querySelector('[data-room-create-cancel]')`);await input(session,'[data-room-create-name]','取消中文房');await click(session,'[data-room-create-cancel]');}else{const id=kind==='home'?'home-inventory':'account-shop';await waitUntil(session,`document.querySelector('#${id}')?.open&&document.querySelector('#${id}').getAttribute('aria-busy')==='false'`);await press(session,'ArrowRight','ArrowRight');await press(session,'Escape','Escape');}await waitUntil(session,`document.activeElement?.matches('${selector}')`);const s=await snapshot(session);assert.equal(s.page,'2 / 2');assert.equal(s.selected,'R17');assert.equal(s.sort,'ID');assert.equal(s.playerName,'背景中文玩家');return s;}
try{
 await launchServer();vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5342,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3318',ws:true,rewrite:()=> '/'}}}});await vite.listen();
 for(let id=6;id<=17;id++){const owner=await fixtureClient();const created=await owner.callApi('CreateRoom',{mode:1,mapId:7,minPlayers:2,maxPlayers:6,roomName:'背景房'+id,name:'房主'+id,tankId:1});assert(created.isSucc);assert.equal(created.res.room.id,'R'+id);}
 await launchBrowser();const page=await newPage();await input(page,'#player-name','背景中文玩家');await click(page,'#refresh-rooms');await waitUntil(page,`[...document.querySelector('#room').options].some(o=>o.value==='R6')`);await click(page,'#open-room-cards');await waitUntil(page,`document.querySelector('[data-room-card-background] [data-source-image]')&&document.querySelector('[data-room-card-page] [data-source-raster-glyph="47"]')&&!document.querySelector('[data-room-card-next]').disabled`);await evaluate(page,`(async()=>{const img=new Image();img.src='/ui/regions/60/0.png';await img.decode()})()`);
 for(const[width,height,label]of [[800,600,'800'],[1920,1080,'1080p'],[3840,2160,'4k']]){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);await pause(180);if((await snapshot(page)).page==='2 / 2')await click(page,'[data-room-card-previous]');await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1},page);const first=await capture(page,label+'-first',width,height);await click(page,'[data-room-card-id="R6"]');assert.equal((await snapshot(page)).selected,'R6');await click(page,'[data-room-card-next]');await waitUntil(page,`document.querySelector('[data-room-card-page]').textContent==='2 / 2'`);await click(page,'[data-room-card-id="R17"]');await waitUntil(page,`document.querySelector('#room').value==='R17'`);await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1},page);const second=await capture(page,label+'-second',width,height);evidence.checks.push({name:label+' source background full image projection/alpha/clip and upper card/control hits; ordinary first/second paging and identity',first,second});}
 const before=await snapshot(page);let pending;server.kill('SIGSTOP');try{await click(page,'[data-room-card-refresh]');await waitUntil(page,`document.querySelector('[data-room-card-sort]').disabled`);pending=await snapshot(page);assert(pending.cards.every(c=>c.disabled));assert(pending.controls.every(c=>c.disabled));assert.equal(pending.selected,'R17');}finally{server.kill('SIGCONT');}await waitUntil(page,`!document.querySelector('[data-room-card-sort]').disabled`);assert.equal((await snapshot(page)).selected,'R17');await click(page,'[data-room-card-sort]');await waitUntil(page,`document.querySelector('[data-room-card-sort]').dataset.roomCardSortMode==='EMPTY'`);await click(page,'[data-room-card-sort]');await waitUntil(page,`document.querySelector('[data-room-card-sort]').dataset.roomCardSortMode==='ID'`);await click(page,'[data-room-card-next]');await waitUntil(page,`document.querySelector('[data-room-card-page]').textContent==='2 / 2'`);await click(page,'[data-room-card-id="R17"]');await waitUntil(page,`document.querySelector('#room').value==='R17'`);const cancelled=await returns(page,'create'),home=await returns(page,'home'),shop=await returns(page,'shop');evidence.checks.push({name:'background does not intercept refresh/busy/sorting or original create cancellation/Home/Shopping modal returns; page2/R17/focus/Chinese retained',before,pending,cancelled,home,shop});
 await click(page,'[data-room-card-id="R17"]');await press(page,'Tab','Tab');assert(await evaluate(page,`document.activeElement?.matches('[data-room-card-home]')`));await press(page,'Enter','Enter');await waitUntil(page,`document.querySelector('#home-inventory')?.open`);await press(page,'Escape','Escape');await waitUntil(page,`document.activeElement?.matches('[data-room-card-home]')`);const from=network.length;await click(page,'[data-room-card-join]');await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);const joined=network.slice(from).find(n=>n.page===page&&n.name==='Join'&&n.direction==='received');assert(joined?.success);const w=await world(page);assert.equal(w.roomId,'R17');assert.equal(w.playerId,joined.response.playerId);if(!await evaluate(page,`document.querySelector('dialog[data-waiting-room]')?.open`))await click(page,'[data-open-waiting-room]');await waitUntil(page,`document.querySelector('[data-waiting-close]')`);await click(page,'[data-waiting-close]');await waitUntil(page,`!(${worldExpression})`);evidence.checks.push({name:'trusted Tab/Enter source action remains usable above background; ordinary selected R17 Join reaches authoritative WAITING and Leave clears world',joined,world:w});
 await writeFile(output+'-pixel-input.json',JSON.stringify(captures));evidence.pixels=JSON.parse(execFileSync('recovery/.venv/bin/python',['tests/room-card-background-pixels.py',output+'-pixel-input.json'],{encoding:'utf8'}));evidence.status='PASS';console.log('PASS source background 3res pixels/layers and ordinary full directory entry/Join regression');
}catch(error){evidence.status='FAIL';evidence.error=error.stack??String(error);const session=pages[0]?.sessionId;if(session){evidence.failureState=await snapshot(session).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
}finally{for(const fixture of fixtures)await fixture.disconnect();if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3318,vite:5342,chrome:9542};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.captures=captures;evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);}
