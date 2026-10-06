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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3207', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-chat-scrollbar-'));
let server, chrome, vite, ws;
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-12-L original battle chat scrollbar through real acknowledged messages and browser inputs.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  const point = await evaluate(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing control');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+Math.min(r.width,document.querySelector('[data-chat-scrollbar]')?.getBoundingClientRect().width??r.width)/2,y:r.y+r.height/2}})()`);
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
  await command('Input.dispatchKeyEvent', {type, key, code, ...(type === 'keyDown' && (key === 'Enter' || key.length === 1) ? {text: key === 'Enter' ? '\r' : key} : {}), ...options, windowsVirtualKeyCode: (/^F(?:[5-9]|1[0-2])$/.test(code) ? 111 + Number(code.slice(1)) : ({PageUp:33,PageDown:34,Enter: 13, Escape: 27, Home: 36, End: 35, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, ' ': 32})[key] ?? key.toUpperCase().charCodeAt(0))}, session);
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5239'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3207', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9309', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9309/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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

const output = 'recovery/output/browser-chat-scrollbar';
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
  await waitUntil(session, `(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'&&!document.querySelector('.battle-chat').hidden&&(${worldExpression}).renderedPlayers===(${worldExpression}).players.length`);
  return world(session);
}
async function joinRoom(session, roomId) {
  await click(session, '#refresh-rooms');
  await waitUntil(session, `[...document.querySelector('#room').options].some(o=>o.value===${JSON.stringify(roomId)}&&!o.disabled)&&!document.querySelector('#join').disabled`);
  await selectValue(session, '#room', roomId); await click(session, '#join');
  await waitUntil(session, `(${worldExpression})?.roomId===${JSON.stringify(roomId)}&&(${worldExpression}).renderedPlayers===(${worldExpression}).players.length`);
}
async function setTeam(session, team) {
  const before = await world(session);
  if (before.players.find(p=>p.id===before.playerId).team === team) return;
  await waitUntil(session, `!document.querySelector('[data-change-team="${team}"]').disabled`);
  await click(session, `[data-change-team="${team}"]`);
  await waitUntil(session, `(${worldExpression}).players.find(p=>p.id===(${worldExpression}).playerId).team===${team}`);
}

const bar = '[data-chat-scrollbar]', track = '[data-chat-scroll-track]', thumb = '[data-chat-scroll-thumb]';
const near = (actual, expected, label) => assert(Math.abs(actual-expected)<1, `${label}: ${actual} != ${expected}`);
async function state(session) {
  return evaluate(session, `(()=>{const l=document.querySelector('[data-chat-log]'),b=document.querySelector('${bar}'),t=document.querySelector('${track}'),h=document.querySelector('${thumb}');const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {top:l.scrollTop,max:l.scrollHeight-l.clientHeight,height:l.clientHeight,scrollHeight:l.scrollHeight,log:rect(l),bar:rect(b),track:rect(t),thumb:rect(h),role:h.getAttribute('role'),tabIndex:h.tabIndex,aria:{min:h.getAttribute('aria-valuemin'),max:h.getAttribute('aria-valuemax'),now:h.getAttribute('aria-valuenow')},rows:[...l.children].map(e=>e.textContent),visibleRows:[...l.children].filter(e=>{const r=e.getBoundingClientRect(),v=l.getBoundingClientRect();return r.top<v.bottom&&r.bottom>v.top}).map(e=>e.textContent)}})()`);
}
async function scrollKey(session, keyValue) {
  await press(session,keyValue,keyValue); await pause(100);
}
async function pointer(session, type, point, more = {}) {
  await command('Input.dispatchMouseEvent',{type,...point,...more},session);
}
async function send(session, other, text) {
  const sender = await world(session), player = sender.players.find(p=>p.id===sender.playerId), expected = `${player.name}: ${text}`;
  const from = network.length;
  await input(session,chatInput,text); await press(session,'Enter','Enter');
  for(const p of [session,other]) await waitUntil(p,`${logExpression}.filter(s=>s===${JSON.stringify(expected)}).length===1`);
  await waitUntil(session,`document.querySelector('${chatInput}').value===''&&!document.querySelector('${channelSelect}').disabled`);
  const rows = network.slice(from), requests = rows.filter(r=>r.page===session&&r.direction==='sent'&&r.name==='RoomChat');
  assert.equal(requests.length,1,'Ordinary Enter sends exactly one RoomChat'); assert.equal(requests[0].payload.text,text); assert.equal(requests[0].payload.channel,0);
  const response=rows.find(r=>r.page===session&&r.direction==='received'&&r.name==='RoomChat');assert(response?.success);assert.equal(response.response.playerId,sender.playerId);
  const events=rows.filter(r=>r.direction==='received'&&r.name==='RoomEvent');assert.equal(events.length,2);assert(events.every(r=>r.payload.message===expected&&r.payload.playerId===sender.playerId&&r.payload.value===0));
  evidence.delivery.push({text,senderId:sender.playerId,requests,response,events});
}
async function geometry(session,width,height) {
  const s=await state(session),scale=Math.min(width/800,height/600);
  assert(s.max>0,'Real chat messages overflow log');assert(s.thumb.height>0&&s.thumb.height<s.track.height,'Proportional thumb occupies part of track');
  near(s.bar.width,14.3*scale,'Source 5 percent scrollbar width');near(s.bar.height,94*scale,'Source edtDisplayBox height');near(s.bar.x,s.log.x+s.log.width-s.bar.width,'Scrollbar right alignment');near(s.track.height,42*scale,'Source track uses twice decrement height');near(s.thumb.height,Math.max(40,42*s.height/s.scrollHeight)*scale,'Source minimum 40 and proportional thumb');
  near(s.thumb.x,s.track.x,'Thumb track horizontal origin');near(s.thumb.width,28*scale,'Original thumb fixed width');
  const travel=s.track.height-s.thumb.height;near(s.thumb.y-s.track.y,travel*s.top/s.max,'Thumb follows actual scroll ratio');
  assert(s.bar.x>=0&&s.bar.y>=0&&s.bar.x+s.bar.width<=width&&s.bar.y+s.bar.height<=height,'Scrollbar lies within viewport');
  const data=await evaluate(session,`(async()=>{const selectors=['${bar}','[data-chat-scroll-up]','[data-chat-scroll-down]','${track}','${thumb}'];return Promise.all(selectors.map(async selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect(),asset=e.dataset.sourceAsset;const paths=[...new Set([e.dataset.sourceAsset,...[...e.querySelectorAll('[data-source-asset]')].map(n=>n.dataset.sourceAsset)].filter(Boolean))];const decoded=await Promise.all(paths.map(async src=>{const i=new Image();i.src='/'+src;await i.decode();return {src,width:i.naturalWidth,height:i.naturalHeight}}));return {selector,slices:[...e.children].filter(c=>c.dataset.sourceAsset).map(c=>({height:c.getBoundingClientRect().height,width:c.getBoundingClientRect().width,backgroundSize:getComputedStyle(c).backgroundSize,repeat:getComputedStyle(c).backgroundRepeat})),sourceControl:e.dataset.sourceControl,sourceLayout:e.dataset.sourceLayout,asset,rect:{x:r.x,y:r.y,width:r.width,height:r.height},style:{left:e.style.left,top:e.style.top,width:e.style.width,height:e.style.height},background:getComputedStyle(e).backgroundImage,backgroundSize:getComputedStyle(e).backgroundSize,backgroundRepeat:getComputedStyle(e).backgroundRepeat,overflow:getComputedStyle(e).overflow,decoded}}));})()`);
  const rootControl=data.find(c=>c.selector===bar);assert.equal(rootControl.backgroundSize,'28px 21px');assert.equal(rootControl.backgroundRepeat,'repeat');assert.equal(rootControl.overflow,'hidden');
  const upControl=data.find(c=>c.selector==='[data-chat-scroll-up]'),downControl=data.find(c=>c.selector==='[data-chat-scroll-down]');near(upControl.rect.width,28*scale,'Original decrement width');near(upControl.rect.height,26*scale,'Original decrement height');near(downControl.rect.width,28*scale,'Original increment width');near(downControl.rect.height,27*scale,'Original increment height');near(downControl.rect.y-s.bar.y,67*scale,'Original increment bottom alignment');
  const slices=data.find(c=>c.selector===thumb).slices;near(slices[0].height,28*scale,'Source thumb upper frame height');near(slices[2].height,17*scale,'Source thumb lower frame height');
  assert.equal(s.role,'scrollbar');assert(s.tabIndex>=0);near(Number(s.aria.now),s.top,'ARIA current');near(Number(s.aria.max),s.max,'ARIA maximum');assert.equal(Number(s.aria.min),0);
  evidence.checks.push({name:`${width}x${height} proportional scroll geometry and decoded source images`,scale,state:s,controls:data});
}
async function sourceAssets(session) {
  const data=await evaluate(session,`(async()=>{const ui=await(await fetch('/ui.json')).json(),p=ui.layouts.find(l=>l.path.endsWith('game_main_chat_shrinked.xml')).windows.find(c=>c.name==='edtDisplayBox').properties;const asset=property=>{const [,name,image]=/^set:(\\S+) image:(.+)$/.exec(p[property]),sets=ui.imagesets.filter(s=>s.attributes.Name===name),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return set.images.find(i=>i.Name===image).asset};return {expected:Object.fromEntries(Object.keys(p).filter(k=>k.startsWith('VertScrollbar')&&p[k].startsWith('set:')).map(k=>[k,asset(k)])),track:document.querySelector('${bar}').dataset.sourceAsset,thumb:[...document.querySelector('${thumb}').children].map(e=>e.dataset.sourceAsset)}})()`);
  assert.equal(data.track,data.expected.VertScrollbarBackgroundImage);assert.deepEqual(data.thumb,[data.expected.VertScrollbarThumbNormalTopFrameImage,data.expected.VertScrollbarThumbBackgroundImage,data.expected.VertScrollbarThumbNormalBottomFrameImage]);
  for(const [selector,prefix] of [['[data-chat-scroll-up]','VertScrollbarDecButton'],['[data-chat-scroll-down]','VertScrollbarIncButton']]){
    await click(session,thumb);await scrollKey(session,'Home');await scrollKey(session,'PageDown');
    await pointer(session,'mouseMoved',{x:10,y:10});const normal=await evaluate(session,`document.querySelector('${selector}').dataset.sourceAsset`);
    const point=await evaluate(session,`(()=>{const r=document.querySelector('${selector}').getBoundingClientRect();return {x:r.x+Math.min(r.width,document.querySelector('[data-chat-scrollbar]')?.getBoundingClientRect().width??r.width)/2,y:r.y+r.height/2}})()`);
    await pointer(session,'mouseMoved',point);const hover=await evaluate(session,`document.querySelector('${selector}').dataset.sourceAsset`);
    await pointer(session,'mousePressed',point,{button:'left',clickCount:1});const pushed=await evaluate(session,`document.querySelector('${selector}').dataset.sourceAsset`);await pointer(session,'mouseReleased',point,{button:'left',clickCount:1});
    assert.deepEqual([normal,hover,pushed],['Normal','Hover','Pushed'].map(state=>data.expected[prefix+state+'Image']));evidence.checks.push({name:selector+' exact source Normal Hover Pushed PNG',normal,hover,pushed});
  }
  evidence.checks.push({name:'Original edtDisplayBox track and three thumb source image properties',...data});
  await click(session,thumb);await scrollKey(session,'End');
}
async function inputIsolation(session) {
  await click(session,thumb);await pause(100);const from=network.length;
  for(const [value,code] of [['w','KeyW'],[' ','Space'],['5','Digit5']])await press(session,value,code);
  await pause(150);const inputs=network.slice(from).filter(r=>r.page===session&&r.direction==='sent'&&r.name==='PlayerInput');
  assert(inputs.every(r=>r.payload.move===0&&r.payload.turn===0&&r.payload.aim===0&&!r.payload.fire&&!r.payload.useItem),'Focused scrollbar isolates W Space Digit5 from battle actions');
  assert.equal(network.slice(from).filter(r=>r.page===session&&r.direction==='sent'&&r.name==='RoomChat').length,0);
  evidence.checks.push({name:'Focused thumb isolates W Space Digit5, permits neutral PlayerInput cadence',inputs});
}
async function interactions(session) {
  await click(session,'[data-chat-scroll-up]');const up=await state(session);assert(up.top<up.max,'Up arrow scrolls into history');
  await click(session,'[data-chat-scroll-down]');const down=await state(session);assert(down.top>up.top,'Down arrow scrolls toward latest');
  await click(session,thumb);await scrollKey(session,'Home');const home=await state(session);near(home.top,0,'Home');assert(home.visibleRows.some(s=>s.includes('真实历史01')),'Oldest real message visible at Home');
  await scrollKey(session,'ArrowDown');const arrowDown=await state(session);assert(arrowDown.top>0);await scrollKey(session,'ArrowUp');const arrowUp=await state(session);assert(arrowUp.top<arrowDown.top);
  await scrollKey(session,'PageDown');const pageDown=await state(session);assert(pageDown.top>arrowUp.top);await scrollKey(session,'PageUp');const pageUp=await state(session);assert(pageUp.top<pageDown.top);
  await scrollKey(session,'End');const end=await state(session);near(end.top,end.max,'End');
  const point={x:end.track.x+end.track.width/2,y:end.track.y+0.5};await pointer(session,'mousePressed',point,{button:'left',clickCount:1});await pointer(session,'mouseReleased',point,{button:'left',clickCount:1});await pause(100);const trackUp=await state(session);assert(trackUp.top<end.top,'Track pages upwards');
  await click(session,thumb);await scrollKey(session,'Home');const start=await state(session);const thumbPoint={x:start.thumb.x+start.bar.width/2,y:start.thumb.y+start.thumb.height/2};
  await pointer(session,'mousePressed',thumbPoint,{button:'left',clickCount:1});await pointer(session,'mouseMoved',{x:thumbPoint.x,y:thumbPoint.y+(start.track.height-start.thumb.height)*0.7},{button:'left',buttons:1});await pointer(session,'mouseReleased',{x:thumbPoint.x,y:thumbPoint.y+(start.track.height-start.thumb.height)*0.7},{button:'left',clickCount:1});await pause(100);const dragged=await state(session);assert(dragged.top>start.max*0.5&&dragged.top<start.max*0.9,'Pointer drag selects real history');
  await evaluate(session,`window.chatWheelEvents=[];document.addEventListener('wheel',e=>{queueMicrotask(()=>window.chatWheelEvents.push({delta:e.deltaY,target:e.target.tagName,defaultPrevented:e.defaultPrevented}))},{capture:true,passive:true});`);const logPoint={x:dragged.log.x+dragged.log.width/2,y:dragged.log.y+dragged.log.height/2};await pointer(session,'mouseMoved',logPoint);await pause(100);await pointer(session,'mouseWheel',logPoint,{deltaX:0,deltaY:-80});for(let i=0;i<20;i++){await pause(100);if((await state(session)).top<dragged.top)break;}const wheelUp=await state(session);evidence.checks.push({name:'Real wheel event and received-message scroll extent',dragged,wheelUp,events:await evaluate(session,`window.chatWheelEvents`),hit:await evaluate(session,`(()=>{const e=document.elementFromPoint(${logPoint.x},${logPoint.y});return {tag:e.tagName,classes:e.className,html:e.outerHTML.slice(0,200)}})()`)});assert(wheelUp.top<dragged.top,'Actual log wheel upwards');await pointer(session,'mouseWheel',logPoint,{deltaX:0,deltaY:80});for(let i=0;i<20;i++){await pause(100);if((await state(session)).top>wheelUp.top)break;}const wheelDown=await state(session);assert(wheelDown.top>wheelUp.top,'Actual log wheel downwards');
  evidence.checks.push({name:'Real pointers arrows/track/drag/wheel and Home End PageUp PageDown ArrowUp ArrowDown',up,down,home,arrowDown,arrowUp,pageDown,pageUp,end,trackUp,start,dragged,wheelUp,wheelDown});
}
try {
  await launchServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'chat-scrollbar-ui-render-budget',transform(source,id){if(id.endsWith('/src/main.ts'))return source.replace('const scene = new Scene(engine);','engine.setHardwareScalingLevel(8);\nconst scene = new Scene(engine);');}}],server:{port:5239,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3207',ws:true,rewrite:()=> '/'}}}});await vite.listen();await launchBrowser();
  const sessions=[];for(const name of ['历史聊天甲','历史聊天乙']){const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);const session=await newPage(browserContextId);sessions.push(session);await input(session,'#player-name',name);}
  const [a,b]=sessions;const initial=await createRoom(a);await joinRoom(b,initial.roomId);for(const p of sessions)await waitUntil(p,`(${worldExpression}).players.length===2&&(${worldExpression}).renderedPlayers===2`);await setTeam(b,0);await click(a,'[data-add-cpu]');for(const p of sessions)await waitUntil(p,`(${worldExpression}).players.length===3&&(${worldExpression}).renderedPlayers===3`);
  for(const p of sessions)assert.equal(await evaluate(p,`(()=>{const e=document.querySelector('${bar}');return !!e&&!e.hidden&&getComputedStyle(e).display!=='none'})()`),false,'WAITING hides source scrollbar');
  evidence.waitingWorlds=await Promise.all(sessions.map(world));
  for(const p of sessions)await click(p,'[data-ready]');for(const p of sessions)await waitUntil(p,`(${worldExpression}).phase==='PLAYING'&&document.querySelector('.battle-chat').classList.contains('source-battle-chat')&&document.querySelector('${bar}')`);
  evidence.playingWorlds=await Promise.all(sessions.map(world));evidence.delivery=[];
  for(let i=1;i<=24;i++)await send(a,b,`真实历史${String(i).padStart(2,'0')} 公共中文消息`);
  assert.deepEqual(await evaluate(a,logExpression),await evaluate(b,logExpression),'Both real clients receive identical history');
  await inputIsolation(a);await sourceAssets(a);await geometry(a,1920,1080);await screenshot(a,'1080p-latest');await interactions(a);await geometry(a,1920,1080);await screenshot(a,'1080p-history');
  const businessFrom=network.length;await click(a,thumb);await scrollKey(a,'Home');await scrollKey(a,'End');await pause(100);assert.equal(network.slice(businessFrom).filter(r=>r.page===a&&r.direction==='sent'&&r.name==='RoomChat').length,0,'Scrollbar keys do not send chat');
  await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},a);await pause(200);await geometry(a,3840,2160);await screenshot(a,'4k-latest');await interactions(a);await geometry(a,3840,2160);await screenshot(a,'4k-history');
  await click(a,thumb);await scrollKey(a,'Home');const beforeArrival=await state(a);await send(b,a,'历史到达保持原滚动策略');const afterArrival=await state(a);near(afterArrival.top,Math.min(beforeArrival.top+beforeArrival.height+16,afterArrival.max),'Original incoming message advances page plus line from history');evidence.checks.push({name:'Real remote message while Home advances original page plus line spacing',before:beforeArrival,after:afterArrival});
  await click(a,'canvas');await key(a,'w','KeyW');await pause(150);await send(b,a,'远端消息不打断移动');const heldFrom=network.length;await pause(200);const heldInputs=network.slice(heldFrom).filter(r=>r.page===a&&r.direction==='sent'&&r.name==='PlayerInput');await key(a,'w','KeyW','keyUp');assert(heldInputs.some(r=>r.payload.move!==0),'Remote chat delivery does not release user-held movement');evidence.checks.push({name:'Actual held W remains active after remote ordinary Enter delivery',heldInputs});
  evidence.render=await evaluate(a,`(()=>{const c=document.querySelector('canvas');return {uiViewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},canvas:{width:c.width,height:c.height},phase:(${worldExpression}).phase}})()`);
  await click(a,'#leave');await waitUntil(a,`!document.body.classList.contains('in-battle')`);assert.deepEqual(await evaluate(a,logExpression),[]);assert.equal(await evaluate(a,`(()=>{const e=document.querySelector('${bar}');return !!e&&!e.hidden&&getComputedStyle(e).display!=='none'})()`),false);
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},a);await createRoom(a,4);assert.deepEqual(await evaluate(a,logExpression),[]);assert.equal(await evaluate(a,`(()=>{const e=document.querySelector('${bar}');return !!e&&!e.hidden&&getComputedStyle(e).display!=='none'})()`),false);await screenshot(a,'1080p-waiting-cleared');evidence.checks.push({name:'Leave clears history and scrollbar; ordinary new WAITING room hides source scrollbar'});
  evidence.status='PASS';await rm(`${output}-failure.png`,{force:true});console.log('PASS: source scrollbar real 24-message delivery, history pointers/keys/wheel,1080p/4K geometry and phase cleanup');
} catch(error){evidence.status='FAIL';evidence.error=String(error);const session=pages[0]?.sessionId;if(session){evidence.failureWorld=await world(session).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
} finally {if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3207,vite:5239,chrome:9309};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);}
