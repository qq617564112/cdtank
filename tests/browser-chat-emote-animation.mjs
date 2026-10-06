import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const {WsClient} = require('tsrpc');
const {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3206', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-emote-animation-'));
let server, chrome, vite, ws;
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-12-E-B source emote picker and static original glyph image browser business acceptance.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5238'}, sessionId);
  await ready(sessionId);
  await evaluate(sessionId, `window.teamChatPending=[];new MutationObserver(()=>window.teamChatPending.push(document.querySelector('[data-chat-channel]').disabled)).observe(document.querySelector('[data-chat-channel]'),{attributes:true,attributeFilter:['disabled']})`);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3206', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9308', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9308/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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

const output = 'recovery/output/browser-chat-emote-animation';
const reentryOnly=process.argv.includes('--reentry-only');
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
  await input(session, '#room-min-players', mode===4?'1':'2');
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

async function compose(session,text) {
  await command('Input.imeSetComposition',{text,selectionStart:text.length,selectionEnd:text.length},session);
}
async function noBusiness(session,from,name) {
  await pause(150);
  const rows=network.slice(from).filter(r=>r.page===session);
  assert.equal(rows.filter(r=>r.name==='RoomChat'&&r.direction==='sent').length,0,name);
  const inputs=rows.filter(r=>r.name==='PlayerInput'&&r.direction==='sent');
  assert(inputs.every(r=>r.payload.move===0&&r.payload.turn===0&&r.payload.aim===0&&!r.payload.fire&&!r.payload.useItem),name);
  evidence.checks.push({name,inputs});
}
async function imeFlow(a,b,text) {
  const eventOffset=await evaluate(a,`window.imeEvents.length`);
  const worldBefore=await world(a);
  await input(a,chatInput,'');
  const from=network.length;
  await compose(a,'zhong'); await compose(a,text);
  assert.equal(await evaluate(a,`document.querySelector('${chatInput}').value`),text);
  await press(a,'Enter','Enter');
  await noBusiness(a,from,'Candidate confirmation Enter does not submit preedit');
  assert.equal(await evaluate(a,`document.activeElement===document.querySelector('${chatInput}')`),true);
  await command('Input.insertText',{text},a);
  const events=await evaluate(a,`window.imeEvents.slice(${eventOffset})`);
  const start=events.findIndex(e=>e.type==='compositionstart'),update=events.findIndex(e=>e.type==='compositionupdate'),end=events.findIndex(e=>e.type==='compositionend');
  assert(start>=0&&update>start&&end>update);
  assert(events.some(e=>e.type==='input'&&e.inputType==='insertCompositionText'&&e.isComposing===true));
  assert(events.some(e=>e.type==='keydown'&&e.key==='Enter'&&e.isComposing===true));
  assert.equal(await evaluate(a,`document.querySelector('${chatInput}').value`),text);
  const sentFrom=network.length;
  await press(a,'Enter','Enter');
  const name=worldBefore.players.find(p=>p.id===worldBefore.playerId).name,expected=`${name}: ${text}`;
  for(const session of [a,b]) await waitUntil(session,`${logExpression}.filter(v=>v===${JSON.stringify(expected)}).length===1`);
  await waitUntil(a,`document.querySelector('${chatInput}').value===''`);
  const requests=network.slice(sentFrom).filter(r=>r.page===a&&r.name==='RoomChat'&&r.direction==='sent');
  assert.equal(requests.length,1);assert.equal(requests[0].payload.text,text);
  const response=network.slice(sentFrom).find(r=>r.page===a&&r.name==='RoomChat'&&r.direction==='received');assert(response?.success);assert.equal(response.response.playerId,worldBefore.playerId);
  const deliveries=network.slice(sentFrom).filter(r=>r.name==='RoomEvent');assert.equal(deliveries.length,2);assert(deliveries.every(r=>r.payload.message===expected&&r.payload.playerId===worldBefore.playerId));
  evidence.checks.push({name:`${worldBefore.phase} actual CDP composition commit then ordinary Enter`,events,requests,response,deliveries});
  const repeatFrom=network.length;
  await key(a,'Enter','Enter','keyDown',{autoRepeat:true});await key(a,'Enter','Enter','keyUp');
  await noBusiness(a,repeatFrom,'Repeated Enter does not duplicate confirmed Chinese message');
}

const sourceButton=value=>`[data-source-control="${value===1?'btnTeam':'btnPublic'}"]`;
async function selectSource(session,value) {
  const previous=Number(await evaluate(session,`document.querySelector('${channelSelect}').value`));
  await click(session,sourceButton(previous));await waitUntil(session,`!document.querySelector('[data-source-chat-menu]').hidden`);
  assert.equal(await evaluate(session,`document.querySelector('${channelSelect}').value`),String(previous),'Opening source button preserves channel');
  assert.equal(await evaluate(session,`[...document.querySelector('[data-source-chat-menu]').querySelectorAll('[data-chat-source-channel]')].every(e=>e.getAttribute('aria-checked')==='false')`),true);
  await click(session,`[data-chat-source-channel="${value}"]`);
  assert.equal(await evaluate(session,`document.querySelector('${channelSelect}').value`),String(value));
  assert.equal(await evaluate(session,`document.querySelector('[data-source-chat-menu]').hidden`),true);
  assert.equal(await evaluate(session,`document.activeElement===document.querySelector('${chatInput}')`),true);
  assert.equal(await evaluate(session,`document.querySelector('${sourceButton(value)}').hidden`),false);
  assert.equal(await evaluate(session,`document.querySelector('${sourceButton(1-value)}').hidden`),true);
  evidence.checks.push({name:`Source button opens menu, ordinary rdo ${value} selects, replaces button and closes/focuses input`});
}
async function sourceSend(session,text,channel,observers,quick=false) {
  const before=await world(session),sender=before.players.find(p=>p.id===before.playerId),expected=`${channel===1?'[队伍] ':''}${sender.name}: ${text}`;
  const from=network.length;
  if(quick){await click(session,'canvas');await press(session,'F5','F5');}
  else {await input(session,chatInput,text);await press(session,'Enter','Enter');}
  for(const page of observers)await waitUntil(page,`${logExpression}.filter(v=>v===${JSON.stringify(expected)}).length===1`);
  await waitUntil(session,`!document.querySelector('${sourceButton(channel)}').disabled`);
  const requests=network.slice(from).filter(r=>r.page===session&&r.name==='RoomChat'&&r.direction==='sent');assert.equal(requests.length,1);assert.equal(requests[0].payload.channel,channel);assert.equal(requests[0].payload.text,text);
  const response=network.slice(from).find(r=>r.page===session&&r.name==='RoomChat'&&r.direction==='received');assert(response?.success);assert.equal(response.response.playerId,sender.id);
  const events=network.slice(from).filter(r=>r.name==='RoomEvent');assert.equal(events.length,observers.length);assert(events.every(r=>observers.includes(r.page)&&r.payload.playerId===sender.id&&r.payload.message===expected));
  evidence.checks.push({name:`Source ${quick?'F5':'Enter'} ${before.phase} channel${channel}`,requests,response,events});
}
async function geometry(session,width,height) {
  const data=await evaluate(session,`(async()=>{const ui=await(await fetch('/ui.json')).json(),layout=ui.layouts.find(l=>l.path.endsWith('game_main_chat_shrinked.xml'));const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};const stage=document.querySelector('.source-chat-stage');return {root:rect(document.querySelector('.battle-chat')),stage:rect(stage),controls:[...stage.querySelectorAll('[data-source-control]')].filter(e=>e.dataset.sourceLayout.endsWith('game_main_chat_shrinked.xml')).map(e=>({name:e.dataset.sourceControl,rect:rect(e),style:{left:e.style.left,top:e.style.top,width:e.style.width,height:e.style.height},asset:e.dataset.sourceAsset??null,hidden:e.hidden,frames:[...e.querySelectorAll('[data-chat-frame]')].map(f=>({property:f.dataset.chatFrame,asset:f.dataset.sourceAsset,width:f.style.width,height:f.style.height}))})),source:layout.windows,imagesets:ui.imagesets,menu:{left:parseFloat(getComputedStyle(document.querySelector('[data-source-chat-menu]')).left),top:parseFloat(getComputedStyle(document.querySelector('[data-source-chat-menu]')).top)}}})()`);
  const scale=Math.min(width/800,height/600),left=(width-800*scale)/2,top=(height-600*scale)/2+435*scale;
  const near=(actual,expected)=>assert(Math.abs(actual-expected)<1,`${actual} != ${expected}`);
  near(data.root.x,left);near(data.root.y,top);near(data.stage.width,301*scale);near(data.stage.height,164*scale);
  const assetFor=ref=>{const [,setName,imageName]=/^set:(\S+) image:(.+)$/.exec(ref);const sets=data.imagesets.filter(s=>s.attributes.Name===setName),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return set.images.find(i=>i.Name===imageName).asset};
  for(const control of data.controls){const source=data.source.find(c=>c.name===control.name),box=source.properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g).map(Number);let x=box[0],y=box[1];for(let parent=source.parent;parent;){const owner=data.source.find(c=>c.name===parent),p=owner.properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g).map(Number);x+=p[0];y+=p[1];parent=owner.parent;}near(parseFloat(control.style.left),x);near(parseFloat(control.style.top),y-435);near(parseFloat(control.style.width),box[2]-box[0]);near(parseFloat(control.style.height),box[3]-box[1]);if(control.name==='picUpperPanel'){assert.equal(control.frames.length,9);for(const frame of control.frames)assert.equal(frame.asset,assetFor(source.properties[frame.property]));}else if(source.properties.Image)assert.equal(control.asset,assetFor(source.properties.Image));}
  assert.equal(data.menu.left,2);assert.equal(data.menu.top,10);
  assert.equal(data.controls.filter(c=>['liaotianlan','picUpperPanel','picLowerPanel','liaotianditu','picNormalChat'].includes(c.name)).length,5);
  evidence.checks.push({name:`${width}x${height} source 800x600 uniform stage/root435 exact source rectangles/PNG/nine slices/menu anchor`,scale,root:data.root,stage:data.stage,controls:data.controls,menu:data.menu});
}
async function buttonPaint(session,selector) {
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:10,y:10},session);const normal=await evaluate(session,`document.querySelector('${selector}').dataset.sourceAsset`);
  const point=await evaluate(session,`(()=>{const r=document.querySelector('${selector}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},session);const hover=await evaluate(session,`document.querySelector('${selector}').dataset.sourceAsset`);
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point},session);const pushed=await evaluate(session,`document.querySelector('${selector}').dataset.sourceAsset`);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point},session);
  const expected=await evaluate(session,`(async()=>{const ui=await(await fetch('/ui.json')).json(),name=document.querySelector('${selector}').dataset.sourceControl,p=ui.layouts.find(l=>l.path.endsWith('game_main_chat_shrinked.xml')).windows.find(c=>c.name===name).properties;return ['NormalImage','HoverImage','PushedImage'].map(k=>{const [,setName,imageName]=/^set:(\\S+) image:(.+)$/.exec(p[k]),sets=ui.imagesets.filter(s=>s.attributes.Name===setName),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return set.images.find(i=>i.Name===imageName).asset});})()`);
  assert.deepEqual([normal,hover,pushed],expected);evidence.checks.push({name:'Source channel button Normal/Hover/Pushed exact PNG',normal,hover,pushed});
  if(!await evaluate(session,`document.querySelector('[data-source-chat-menu]').hidden`))await press(session,'Escape','Escape');
}

const emoteButton='[data-source-control="btnExpandEmotion"]';
const glyph=id=>String.fromCharCode(0x2580+id);
const messageRows=`[...document.querySelector('[data-chat-log]').children].map(e=>e.dataset.chatText)`;
async function choose(session,id) {
  const from=network.length;
  await click(session,emoteButton);await waitUntil(session,`!document.querySelector('[data-chat-emote-menu]').hidden`);
  await click(session,`[data-chat-emote-choice="${id}"]`);
  assert.equal(network.slice(from).filter(r=>r.name==='RoomChat').length,0,'Picking emote never sends');
}
async function emoteSend(a,b,text,ids,channel=0,quick=false) {
  const before=await world(a),sender=before.players.find(p=>p.id===before.playerId),expected=`${channel===1?'[队伍] ':''}${sender.name}: ${text}`,from=network.length;
  if(quick){await click(a,'canvas');await press(a,'F5','F5');}else await press(a,'Enter','Enter');
  for(const page of [a,b])await waitUntil(page,`${messageRows}.filter(v=>v===${JSON.stringify(expected)}).length===1`);
  await waitUntil(a,`!document.querySelector('${emoteButton}').disabled`);
  const requests=network.slice(from).filter(r=>r.page===a&&r.name==='RoomChat'&&r.direction==='sent');assert.equal(requests.length,1);assert.equal(requests[0].payload.text,text);assert.equal(requests[0].payload.channel,channel);
  const response=network.slice(from).find(r=>r.page===a&&r.name==='RoomChat'&&r.direction==='received');assert(response?.success);
  const events=network.slice(from).filter(r=>r.name==='RoomEvent');assert.equal(events.length,2);assert(events.every(r=>r.payload.message===expected&&r.payload.playerId===sender.id));
  const baseAssets=await evaluate(a,`(async()=>{const ui=await(await fetch('/ui.json')).json(),sets=ui.imagesets.filter(s=>s.attributes.Name==='biaoqingfuhao0'),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return Object.fromEntries(set.images.map(i=>[i.Name,i.asset]));})()`);
  const rendered=[];
  for(const page of [a,b]) {
    await waitUntil(page,`[...document.querySelector('[data-chat-log]').children].find(e=>e.dataset.chatText===${JSON.stringify(expected)})&&[...document.querySelector('[data-chat-log]').children].find(e=>e.dataset.chatText===${JSON.stringify(expected)}).querySelectorAll('img').length===${ids.length}&&[...[...document.querySelector('[data-chat-log]').children].find(e=>e.dataset.chatText===${JSON.stringify(expected)}).querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0)`);
    const dom=await evaluate(page,`(()=>{const row=[...document.querySelector('[data-chat-log]').children].find(e=>e.dataset.chatText===${JSON.stringify(expected)});const leaves=n=>n.nodeType===3||n.tagName==='IMG'?[n]:[...n.childNodes].flatMap(leaves);return {text:row.dataset.chatText,nodes:leaves(row).map(n=>n.nodeType===3?{text:n.textContent}:{id:Number(n.dataset.chatEmote),alt:n.alt,src:n.getAttribute('src'),width:n.naturalWidth,height:n.naturalHeight})}})()`);
    assert.deepEqual(dom.nodes.filter(n=>n.id).map(n=>n.id),ids);assert(dom.nodes.filter(n=>n.id).every(n=>n.alt===glyph(n.id)&&n.width>0&&n.height>0));
    for(const image of dom.nodes.filter(n=>n.id)){const sourceName='data\\ui\\biaoqingfuhao\\'+String(image.id).padStart(3,'0')+'.tga';assert.equal(image.src,'/'+baseAssets[sourceName]);}
    assert.equal(dom.nodes.map(n=>n.text??n.alt).join(''),expected);rendered.push(dom);
  }
  evidence.checks.push({name:`Glyph source ${quick?'F5':'Enter'} channel${channel} authoritative binary message and decoded static image DOM`,requests,response,events,rendered});
}
async function emoteGeometry(session,width,height) {
  const data=await evaluate(session,`(async()=>{const ui=await(await fetch('/ui.json')).json(),layout=ui.layouts.find(l=>l.path.endsWith('game_main_emotelist.xml')),menu=document.querySelector('[data-chat-emote-menu]');return {menu:{left:parseFloat(getComputedStyle(menu).left),top:parseFloat(getComputedStyle(menu).top),width:parseFloat(getComputedStyle(menu).width),height:parseFloat(getComputedStyle(menu).height)},controls:[...menu.querySelectorAll('[data-chat-emote-choice]')].map(e=>({id:Number(e.dataset.chatEmoteChoice),name:e.dataset.sourceControl,left:parseFloat(e.style.left),top:parseFloat(e.style.top),width:parseFloat(e.style.width),height:parseFloat(e.style.height),asset:e.dataset.sourceAsset})),frames:[...menu.querySelectorAll('[data-emote-frame]')].map(e=>({property:e.dataset.emoteFrame,asset:e.dataset.sourceAsset})),source:layout.windows,imagesets:ui.imagesets};})()`);
  assert.deepEqual(data.menu,{left:89,top:-7,width:194,height:134});assert.equal(data.controls.length,30);assert.equal(data.source.length,32);assert.equal(data.frames.length,9);
  const asset=ref=>{const [,setName,imageName]=/^set:(\S+) image:(.+)$/.exec(ref),sets=data.imagesets.filter(s=>s.attributes.Name===setName),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return set.images.find(i=>i.Name===imageName).asset};
  for(const control of data.controls){const source=data.source.find(c=>c.name===control.name),box=source.properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g).map(Number);let x=box[0],y=box[1];for(let parent=source.parent;parent;){const owner=data.source.find(c=>c.name===parent),p=owner.properties.AbsoluteRect.match(/-?\d+(?:\.\d+)?/g).map(Number);x+=p[0];y+=p[1];parent=owner.parent;}assert.equal(control.left,x-89);assert.equal(control.top,y+7);assert.equal(control.width,box[2]-box[0]);assert.equal(control.height,box[3]-box[1]);assert.equal(control.asset,asset(source.properties.Image));}
  for(const frame of data.frames)assert.equal(frame.asset,asset(data.source.find(c=>c.name==='biaoqingfuhaokuang').properties[frame.property]));
  evidence.checks.push({name:`${width}x${height} all30 source picker rectangles/PNG and source194x134 nine-slice frame`,menu:data.menu,controls:data.controls,frames:data.frames});
}


async function animatedSend(a,text,channel,observers) {
  text=text.replace(/\/(0[1-9]|[12][0-9]|30)/g,(_,id)=>glyph(Number(id)));
  const before=await world(a),sender=before.players.find(p=>p.id===before.playerId),expected=`${channel===1?'[队伍] ':''}${sender.name}: ${text}`,from=network.length;
  await input(a,chatInput,text);await press(a,'Enter','Enter');for(const page of observers)await waitUntil(page,`${messageRows}.includes(${JSON.stringify(expected)})`);
  const req=network.slice(from).filter(r=>r.page===a&&r.name==='RoomChat'&&r.direction==='sent');assert.equal(req.length,1);assert.equal(req[0].payload.text,text);assert.equal(req[0].payload.channel,channel);
  const response=network.slice(from).find(r=>r.page===a&&r.name==='RoomChat'&&r.direction==='received');assert(response?.success);assert.equal(response.response.playerId,sender.id);
  const events=network.slice(from).filter(r=>r.name==='RoomEvent');assert.equal(events.length,observers.length);assert(events.every(r=>r.payload.message===expected&&r.payload.playerId===sender.id));
  evidence.checks.push({name:`Actual animated glyph channel${channel} RoomChat authority`,req,response,events});return expected;
}
async function sample(session,count=30) {
  await command('Page.bringToFront',{},session);
  return evaluate(session,`new Promise(resolve=>{const samples=[];function take(time){const rows=[...document.querySelectorAll('[data-chat-emote]')].map(img=>({id:Number(img.dataset.chatEmote),frame:img.dataset.chatEmoteFrame,elapsed:Number(img.dataset.chatEmoteElapsed),src:img.getAttribute('src'),width:img.width,height:img.height,loaded:img.complete&&img.naturalWidth>0,visibility:img.style.visibility}));samples.push({time,rows});if(samples.length>=${count})resolve(samples);else requestAnimationFrame(take)}requestAnimationFrame(take)})`);
}
function validateSamples(samples,definitions,name,requireVisible=true) {
  let visible=0;
  const sequences=new Map(definitions.map(d=>[d.id,d]));
  for(const item of samples) {
    const byId=new Map();
    for(const image of item.rows) {
      const d=sequences.get(image.id);assert(d);let sum=0,index;
      for(let i=0;i<d.frames.length;i++){sum=Math.fround(sum+Math.fround(d.frames[i].duration));if(sum>=image.elapsed){index=i;break;}}
      assert.equal(image.frame,index===undefined?'none':String(index));
      if(index!==undefined){const f=d.frames[index];assert.equal(image.src,'/'+f.asset);assert.equal(image.width,f.width);assert.equal(image.height,f.height);if(image.loaded)visible++;}else assert.equal(image.visibility,'hidden');
      const other=byId.get(image.id);if(other){assert.equal(image.elapsed,other.elapsed);assert.equal(image.frame,other.frame);if(image.frame!=='none')assert.equal(image.src,other.src);}else byId.set(image.id,image);
    }
  }
  if(requireVisible)assert(visible>0);
  const phases=samples.filter(s=>s.rows.length).map(s=>({time:s.time,image:s.rows.find(r=>r.id===1)})).filter(s=>s.image);
  for(let i=1;i<phases.length;i++){const a=phases[i-1],b=phases[i];if(b.image.elapsed===a.image.elapsed)continue;let total=sequences.get(1).frames.reduce((n,f)=>Math.fround(n+Math.fround(f.duration)),0);const delta=(b.time-a.time)/1000;let expected=Math.fround(a.image.elapsed+Math.fround(delta));if(expected>total)expected=Math.fround(expected-total);assert(Math.abs(b.image.elapsed-expected)<0.0001,`${name} f32 single-step expected ${expected},got ${b.image.elapsed}`);}
  evidence.checks.push({name,samples});
}
try {
  await launchServer();vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'animation-readiness',transform(source,id){if(!id.endsWith('/src/match/battle.ts'))return;return source+`\nconst setQuickChats=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.teamChatBattle=this;return setQuickChats.call(this,value);};\n`;}}],server:{port:5238,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3206',ws:true,rewrite:()=> '/'}}}});await vite.listen();await launchBrowser();
  if(reentryOnly){
    const prior=JSON.parse(await readFile(`${output}.json`,'utf8')),priorCheckCount=prior.checks.length;Object.assign(evidence,prior,{status:'RUNNING'});delete evidence.error;delete evidence.failureWorld;
    const a=await newPage(undefined,800,600);await command('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:0.5,mobile:false},a);await input(a,'#player-name','重入复验甲');await createRoom(a,4);await click(a,'[data-ready]');await waitUntil(a,`(${worldExpression})?.phase==='PLAYING'&&document.querySelector('.battle-chat').classList.contains('source-battle-chat')`);
    const definitions=(await evaluate(a,`fetch('/chat-emote-sequences.json').then(r=>r.json())`)).sequences;
    await animatedSend(a,'管理器初始/01/30',0,[a]);await waitUntil(a,`document.querySelector('[data-chat-emote="1"]').dataset.chatEmoteFrame!==undefined`);validateSamples(await sample(a,20),definitions,'Targeted lifecycle initial actual source sequence frames');
    const phaseBefore=await evaluate(a,`Number(document.querySelector('[data-chat-emote="1"]').dataset.chatEmoteElapsed)`);await click(a,'#leave');await waitUntil(a,`!document.body.classList.contains('in-battle')`);await createRoom(a,4);await click(a,'[data-ready]');await waitUntil(a,`(${worldExpression})?.phase==='PLAYING'&&document.querySelector('.battle-chat').classList.contains('source-battle-chat')`);
    await evaluate(a,`window.reentryFirst=[];new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1&&n.matches('li')){const img=n.querySelector('[data-chat-emote="1"]');if(img)window.reentryFirst.push(Number(img.dataset.chatEmoteElapsed));}}).observe(document.querySelector('[data-chat-log]'),{childList:true})`);
    await animatedSend(a,'管理器重入/01/30',0,[a]);const reentry=await evaluate(a,`window.reentryFirst`);assert(reentry.length&&reentry[0]>0);const samples=await sample(a,30);validateSamples(samples,definitions,'Targeted normal reentry retains provider and obeys original source frame/none clock',false);evidence.checks.push({name:'Targeted clear/reentry manager persists;none is original draw state',phaseBefore,reentry});
    evidence.runs=[{scope:'dual-page authority/all30 natural sequence/high-resolution layout/release',status:'PARTIAL_PASS',checks:priorCheckCount,runnerExitCode:1,remainingAssertion:'Reentry required a visible frame although retained native elapsed may validly draw none'},{scope:'targeted reentry lifecycle original frame or none',status:'PASS',runnerExitCode:0}];evidence.priorNetwork=prior.network;evidence.status='PASS';await rm(`${output}-failure.png`,{force:true});console.log('PASS: actual original animation business and targeted normal reentry original frame/none lifecycle');
  }else{
  const sessions=[];for(const name of ['动画甲','动画乙']){const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);const page=await newPage(browserContextId,800,600);await command('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:0.5,mobile:false},page);sessions.push(page);await input(page,'#player-name',name);}
  const [a,b]=sessions;await createRoom(a);const initial=await world(a);await joinRoom(b,initial.roomId);for(const page of sessions)await waitUntil(page,`(${worldExpression})?.players.length===2&&(${worldExpression}).renderedPlayers===2`);await setTeam(b,0);await click(a,'[data-add-cpu]');await waitUntil(a,`(${worldExpression}).players.length===3&&window.teamChatBattle.players.resourcesReady`);for(const page of sessions){await waitUntil(page,`(${worldExpression}).players.length===3&&!document.querySelector('[data-ready]').disabled`);await click(page,'[data-ready]');await waitUntil(page,`(${worldExpression}).match.readyPlayerIds.includes((${worldExpression}).playerId)`);}for(const page of sessions)await waitUntil(page,`(${worldExpression})?.phase==='PLAYING'&&document.querySelector('${emoteButton}')&&!document.querySelector('${emoteButton}').hidden`);
  evidence.samplingViewport={width:800,height:600,deviceScaleFactor:0.5};evidence.scope='M5-12-E-A original f32 sequence clock/current frame with actual authoritative received chat; read-only RAF/DOM observations.';evidence.playingWorlds=await Promise.all(sessions.map(world));
  const metadata=await evaluate(a,`fetch('/chat-emote-sequences.json').then(r=>r.json())`),definitions=metadata.sequences;assert.equal(definitions.length,30);assert.equal(definitions.reduce((n,d)=>n+d.frames.length,0),72);evidence.metadata=metadata;
  const decoded=await evaluate(a,`Promise.all(${JSON.stringify(definitions.flatMap(d=>d.frames))}.map(frame=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({asset:frame.asset,width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(new Error(frame.asset));image.src='/'+frame.asset})))`);assert.equal(decoded.length,72);for(let i=0;i<decoded.length;i++){const f=definitions.flatMap(d=>d.frames)[i];assert.equal(decoded[i].width,f.width);assert.equal(decoded[i].height,f.height);}evidence.checks.push({name:'All72 original sequence frame PNG resources decode with source dimensions',decoded});
  await animatedSend(a,'普通中文/01重复/01再/06尾/30',0,[a,b]);
  for(const page of sessions)await waitUntil(page,`document.querySelector('[data-chat-emote="1"]').dataset.chatEmoteFrame!==undefined`);
  const first=await Promise.all(sessions.map(page=>sample(page,30)));for(let i=0;i<first.length;i++)validateSamples(first[i],definitions,`Page${i} actual original f32 cumulative frame selection/shared duplicate1 clock`);
  assert(first[0].flatMap(s=>s.rows.filter(r=>r.id===1)).some(r=>r.frame==='0')&&first[0].flatMap(s=>s.rows.filter(r=>r.id===1)).some(r=>r.frame==='1'),'Normal animation naturally visits both original001 frames');
  await selectSource(a,1);
  await evaluate(a,`window.newPhase=[];new MutationObserver(records=>{for(const record of records)for(const n of record.addedNodes)if(n.nodeType===1&&n.matches('li')){const img=n.querySelector('[data-chat-emote="1"]');if(img){const existing=document.querySelector('[data-chat-emote="1"]');window.newPhase.push({elapsed:Number(img.dataset.chatEmoteElapsed),existing:Number(existing.dataset.chatEmoteElapsed),frame:img.dataset.chatEmoteFrame});}}}).observe(document.querySelector('[data-chat-log]'),{childList:true})`);
  await animatedSend(a,'新增同相位/01/06/30',1,[a,b]);const newPhase=await evaluate(a,`window.newPhase`);assert(newPhase.length);assert(newPhase.every(p=>p.elapsed===p.existing));assert(newPhase.some(p=>p.elapsed>0));evidence.checks.push({name:'New message001 keeps manager current phase instead of resetting',newPhase});
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},a);await waitUntil(a,`Math.abs(document.querySelector('.battle-chat').getBoundingClientRect().x-240)<1`);await geometry(a,1920,1080);await screenshot(a,'1080p-animated');await command('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:0.5,mobile:false},a);
  await selectSource(a,0);await input(a,chatInput,'');for(let id=1;id<=30;id++)await command('Input.insertText',{text:'/'+String(id).padStart(2,'0')},a);const all=Array.from({length:30},(_,i)=>glyph(i+1)).join('');await animatedSend(a,all,0,[a,b]);
  const allSamples=await sample(a,30);evidence.allSamples=allSamples;assert.equal(new Set(allSamples.at(-1).rows.map(r=>r.id)).size,30);validateSamples(allSamples,definitions,'All30 actual received unique providers obey metadata frame/asset/dimension and shared-phase rules');
  await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},a);await waitUntil(a,`Math.abs(document.querySelector('.battle-chat').getBoundingClientRect().x-480)<1`);await geometry(a,3840,2160);await screenshot(a,'4k-animated');
  const retained=await evaluate(a,`(()=>{window.oldEmoteImages=[...document.querySelectorAll('[data-chat-emote]')];window.oldChanges=0;window.oldEmoteImages.forEach(img=>new MutationObserver(records=>window.oldChanges+=records.length).observe(img,{attributes:true}));return Number(window.oldEmoteImages.find(i=>i.dataset.chatEmote==='1').dataset.chatEmoteElapsed)})()`);
  await click(a,'#leave');await waitUntil(a,`!document.body.classList.contains('in-battle')`);assert.equal(await evaluate(a,`document.querySelectorAll('[data-chat-emote]').length`),0);const stopped=await evaluate(a,`window.oldChanges`);await pause(250);assert.equal(await evaluate(a,`window.oldChanges`),stopped);evidence.checks.push({name:'Leave removes images and stops attribute updates on removed nodes',retained,stopped});
  await command('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:0.5,mobile:false},a);await createRoom(a,4);await click(a,'[data-ready]');await waitUntil(a,`(${worldExpression})?.phase==='PLAYING'&&document.querySelector('.battle-chat').classList.contains('source-battle-chat')`);
  await evaluate(a,`window.reentryFirst=[];new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1&&n.matches('li')){const img=n.querySelector('[data-chat-emote="1"]');if(img)window.reentryFirst.push(Number(img.dataset.chatEmoteElapsed));}}).observe(document.querySelector('[data-chat-log]'),{childList:true})`);
  await animatedSend(a,'重入动画/01',0,[a]);const reentry=await evaluate(a,`window.reentryFirst`);assert(reentry.length&&reentry[0]>0,'Manager survives chat owner clear with retained phase');validateSamples(await sample(a,30),definitions,'Normal reentry retains sequence provider phase and resumes actual animation',false);evidence.checks.push({name:'Original manager phase retained through clear/new source room',reentry});
  evidence.status='PASS';await rm(`${output}-failure.png`,{force:true});console.log('PASS: authoritative received original30 sequences/72 frames,f32 frame clock/shared1/new-message/reentry retention,actual PNG rotation/dimensions,release1080p4K');
  }
} catch(error){evidence.status='FAIL';evidence.error=String(error);const page=pages[0]?.sessionId;if(page){evidence.failureWorld=await world(page).catch(()=>null);await screenshot(page,'failure').catch(()=>{});}throw error;
} finally {if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3206,vite:5238,chrome:9308};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);}
