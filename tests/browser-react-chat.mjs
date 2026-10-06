import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const {WsClient} = require('tsrpc');
const {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3272', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-source-chat-'));
let server, chrome, vite, ws;
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'E-R04-C React chat: ordinary dual-page public/team/IME/quick/emote/scroll/source-layout and cleanup.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  const point = await evaluate(session, `(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing control '+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect(),x=r.x+Math.min(r.width,e.closest('[data-chat-scrollbar]')?.getBoundingClientRect().width??r.width)/2,y=r.y+r.height/2;if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Obscured '+${JSON.stringify(selector)});return {x,y}})()`);
  await command('Input.dispatchMouseEvent', {type: 'mousePressed', button: 'left', clickCount: 1, ...point}, session);
  await command('Input.dispatchMouseEvent', {type: 'mouseReleased', button: 'left', clickCount: 1, ...point}, session);await evaluate(session,'new Promise(requestAnimationFrame)');
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
  await key(session, value, code, 'keyUp');await evaluate(session,'new Promise(requestAnimationFrame)');
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5302'}, sessionId);
  await ready(sessionId);

  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3272', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9502', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9502/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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

const finishedOnly=process.argv.includes('--finished-only');
const continuation=process.argv.includes('--continuation');
const run=new Date().toISOString().replace(/[:.]/g,'-');
const output=`recovery/output/react-chat-${run}${finishedOnly?'-finished':''}`;
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
  await waitUntil(session, `(${worldExpression})?.mapLoaded&&!document.querySelector('#leave').hidden&&(${worldExpression}).phase==='WAITING'&&!document.querySelector('.battle-chat').hidden&&window.teamChatBattle.players.resourcesReady`);
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
  if(await evaluate(session,`!document.querySelector('[data-source-chat-menu]').hidden`)){await press(session,'Escape','Escape');await waitUntil(session,`document.querySelector('[data-source-chat-menu]').hidden`);}
  await click(session,sourceButton(previous));evidence.checks.push({name:'Native source menu click observation',state:await evaluate(session,`(()=>{const e=document.querySelector('${sourceButton(previous)}'),r=e.getBoundingClientRect(),target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {menuHidden:document.querySelector('[data-source-chat-menu]').hidden,expanded:e.getAttribute('aria-expanded'),disabled:e.disabled,focus:document.activeElement?.outerHTML.slice(0,300),hit:target?.outerHTML.slice(0,300)}})()`)});await waitUntil(session,`!document.querySelector('[data-source-chat-menu]').hidden`);
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
  await command('Page.bringToFront',{},session);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:10,y:10},session);await evaluate(session,'new Promise(requestAnimationFrame)');const normal=await evaluate(session,`document.querySelector('${selector}').dataset.sourceAsset`);
  const point=await evaluate(session,`(()=>{const r=document.querySelector('${selector}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},session);await evaluate(session,'new Promise(requestAnimationFrame)');const hover=await evaluate(session,`document.querySelector('${selector}').dataset.sourceAsset`);
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point},session);await evaluate(session,'new Promise(requestAnimationFrame)');const pushed=await evaluate(session,`document.querySelector('${selector}').dataset.sourceAsset`);
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
  const sequences=await evaluate(a,`(async()=>{const data=await(await fetch('/chat-emote-sequences.json')).json();return data.sequences;})()`);
  const rendered=[];
  for(const page of [a,b]) {
    await waitUntil(page,`[...document.querySelector('[data-chat-log]').children].find(e=>e.dataset.chatText===${JSON.stringify(expected)})&&[...document.querySelector('[data-chat-log]').children].find(e=>e.dataset.chatText===${JSON.stringify(expected)}).querySelectorAll('img').length===${ids.length}&&[...[...document.querySelector('[data-chat-log]').children].find(e=>e.dataset.chatText===${JSON.stringify(expected)}).querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0)`);
    const dom=await evaluate(page,`(()=>{const row=[...document.querySelector('[data-chat-log]').children].find(e=>e.dataset.chatText===${JSON.stringify(expected)});const leaves=n=>n.nodeType===3||n.tagName==='IMG'?[n]:[...n.childNodes].flatMap(leaves);return {text:row.dataset.chatText,nodes:leaves(row).map(n=>n.nodeType===3?{text:n.textContent}:{id:Number(n.dataset.chatEmote),alt:n.alt,src:n.getAttribute('src'),frame:n.dataset.chatEmoteFrame,elapsed:Number(n.dataset.chatEmoteElapsed),width:n.naturalWidth,height:n.naturalHeight})}})()`);
    assert.deepEqual(dom.nodes.filter(n=>n.id).map(n=>n.id),ids);assert(dom.nodes.filter(n=>n.id).every(n=>n.alt===glyph(n.id)&&n.width>0&&n.height>0));
    for(const image of dom.nodes.filter(n=>n.id)){const sequence=sequences.find(s=>s.id===image.id);assert(sequence);if(image.frame!=='none'){const frame=sequence.frames[Number(image.frame)];assert(frame);assert.equal(image.src,'/'+frame.asset);}}
    assert.equal(dom.nodes.map(n=>n.text??n.alt).join(''),expected);rendered.push(dom);
  }
  evidence.checks.push({name:`Glyph source ${quick?'F5':'Enter'} channel${channel} authoritative binary message and decoded original sequence image DOM`,requests,response,events,rendered});
}

try {
  await launchServer();vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',plugins:[{name:'source-chat-readiness',transform(source,id){if(!id.endsWith('/src/match/battle.ts'))return;return source+`\nconst setQuickChats=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.teamChatBattle=this;return setQuickChats.call(this,value);};\n`;}}],server:{port:5302,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3272',ws:true,rewrite:()=> '/'}}}});await vite.listen();await launchBrowser();
  const sessions=[];for(const name of ['原聊天甲','原聊天乙']){const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);const session=await newPage(browserContextId);sessions.push(session);await input(session,'#player-name',name);}
  const [a,b]=sessions;
  if(finishedOnly){
    evidence.scope='E-R04-C actual natural CPU FINISHED chat and ordinary two-human rematch reentry only';
    const store=new AccountStore(join(directory,'accounts.sqlite'));
    try {
      const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(row=>row.tankId===1&&row.part===0);
      const fields=value=>new Map(Object.entries(value).map(([k,v])=>[Number(k),v]));
      for(const page of sessions){const owner=store.open(await evaluate(page,"localStorage.getItem('cdtank-account-token')")),equipment={name:'明确导入原战车',fields:fields(native.equipment)},base={name:'明确导入原宠物',fields:fields(native.base)};equipment.fields.set(0x1c,72);equipment.fields.set(0x24,1);equipment.fields.set(0x28,10011);equipment.fields.set(0x2c,10012);equipment.fields.set(0x30,10013);store.replaceRoleRecords(owner.accountId,{base:[base],equipment:[equipment]});const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa8,72,true);view.setUint32(0xa4,base.fields.get(0),true);store.replaceRoleProfile(owner.accountId,{bytes,strings:['','']});}
      evidence.fixture={native:'world-role-attributes-native.json tank1 part0',ownedInstance:72,scope:'Account source attributes only; ordinary autopilot and CPU simulate natural match, no combat state injection.'};
    }finally{store.close();}
    for(const page of sessions)evidence.checks.push({name:'UI viewport intact; 3D raster-only software budget',value:await evaluate(page,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1],{EngineStore}=await import(url),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world'));engine.setHardwareScalingLevel(6);engine.resize();return {viewport:[innerWidth,innerHeight],canvas:[engine.getRenderWidth(),engine.getRenderHeight()]}})()`)});
    const initial=await createRoom(a,4);await joinRoom(b,initial.roomId);
    for(let i=0;i<2;i++){await click(a,'[data-add-cpu]');await waitUntil(a,`(${worldExpression}).players.length===${i+3}`);}
    for(const page of sessions){await waitUntil(page,`window.teamChatBattle.players.resourcesReady`);await click(page,'[data-ready]');}
    for(const page of sessions)await waitUntil(page,`(${worldExpression}).phase==='PLAYING'`);
    for(const page of sessions){await click(page,'[data-autopilot]');await waitUntil(page,`(${worldExpression}).players.find(p=>p.id===(${worldExpression}).playerId).isAutopilot`);}
    const began=Date.now();let finished=false;
    while(Date.now()-began<180000){const pair=await Promise.all(sessions.map(world));if(pair.every(w=>w.phase==='FINISHED')){evidence.finishedWorlds=pair;finished=true;break;}await pause(500);}
    assert(finished,'Ordinary natural CPU/autopilot match must finish');assert(evidence.finishedWorlds.every(w=>w.mode===4&&w.match.targetScore===10));
    await waitUntil(a,`document.querySelector('.battle-chat').classList.contains('source-battle-chat')&&!document.querySelector('[data-rematch]').disabled`);
    await sourceSend(a,'自然结算后的普通中文',0,[a,b]);await screenshot(a,'finished');
    const oldRound=evidence.finishedWorlds[0].match.round;
    for(const page of sessions){await waitUntil(page,`!document.querySelector('[data-rematch]').disabled`);await click(page,'[data-rematch]');}
    for(const page of sessions)await waitUntil(page,`(${worldExpression}).phase==='PLAYING'&&(${worldExpression}).match.round===${oldRound+1}&&document.querySelector('.battle-chat').classList.contains('source-battle-chat')`);
    evidence.rematchWorlds=await Promise.all(sessions.map(world));
    await selectSource(a,0);await sourceSend(a,'普通再战后的中文',0,[a,b]);await screenshot(a,'rematch');
    evidence.checks.push({name:'Natural FINISHED dual-page acknowledged chat; ordinary both-human rematch new PLAYING menu/input and acknowledged chat',elapsedMs:Date.now()-began,oldRound,newRound:oldRound+1});
    evidence.status='PASS';console.log('PASS: natural FINISHED dual-page chat and ordinary rematch React lifecycle');
  }else{
  await click(a,'#open-quick-chat-settings');await input(a,'[data-quick-chat-key="F5"]','原界面当前队伍快捷');await click(a,'#quick-chat-settings-save');await click(a,'#quick-chat-settings-cancel');
  const initial=await createRoom(a);await joinRoom(b,initial.roomId);for(const page of sessions)await waitUntil(page,`(${worldExpression})?.players.length===2&&(${worldExpression}).renderedPlayers===2`);
  assert.equal(await evaluate(a,`document.querySelector('.battle-chat').classList.contains('source-battle-chat')`),false);
  if(!continuation)await confirmed(a,'等待房间普通中文',0,[a,b],[]);
  await setTeam(b,0);
  if(!continuation)await confirmed(a,'等待房间队伍中文',1,[a,b],[]);
  await selectValue(a,channelSelect,0);
  await click(a,'[data-add-cpu]');await waitUntil(a,`(${worldExpression}).players.length===3&&window.teamChatBattle.players.resourcesReady`);
  evidence.waitingWorlds=await Promise.all(sessions.map(world));
  for(const page of sessions)await click(page,'[data-ready]');for(const page of sessions)await waitUntil(page,`(${worldExpression})?.phase==='PLAYING'&&document.querySelector('.battle-chat').classList.contains('source-battle-chat')&&document.querySelector('[data-source-control="btnPublic"]')`);
  evidence.playingWorlds=await Promise.all(sessions.map(world));
  await evaluate(a,`window.sourcePending=[];new MutationObserver(()=>window.sourcePending.push(document.querySelector('[data-source-control="btnPublic"]').disabled)).observe(document.querySelector('[data-source-control="btnPublic"]'),{attributes:true,attributeFilter:['disabled']})`);
  if(!continuation){await geometry(a,1920,1080);await buttonPaint(a,sourceButton(0));
  await selectSource(a,1);await selectSource(a,0);await sourceSend(a,'原公共频道中文',0,[a,b]);
  await selectSource(a,1);await sourceSend(a,'原队伍频道中文',1,[a,b]);await sourceSend(a,'原界面当前队伍快捷',1,[a,b],true);
  await selectSource(a,0);await input(a,chatInput,'');await evaluate(a,`window.imeEvents=[];for(const type of ['compositionstart','compositionupdate','compositionend','input'])document.querySelector('${chatInput}').addEventListener(type,e=>window.imeEvents.push({type:e.type,data:e.data??null,inputType:e.inputType??null,isComposing:e.isComposing??null,value:e.target.value}));`);
  const composingFrom=network.length;await compose(a,'原界面中文候选');await press(a,'Enter','Enter');await noBusiness(a,composingFrom,'Original source input real composition Enter isolation');await command('Input.insertText',{text:'原界面中文候选'},a);
  const imeEvents=await evaluate(a,`window.imeEvents`);assert(imeEvents.some(e=>e.type==='compositionend'));evidence.checks.push({name:'Original edtChat actual Chromium composition',imeEvents});
  await sourceSend(a,'原界面中文候选',0,[a,b]);
  } else {evidence.reusedSourceEvidence='react-chat-2026-10-03T16-52-18-018Z.json:15 completed checks, overall FAIL retained';}
  await input(a,chatInput,'甲乙');await press(a,'ArrowLeft','ArrowLeft');
  await click(a,emoteButton);let draft='甲乙',caret=1;const pickerFrom=network.length;
  for(const id of [1,6,30]){await click(a,`[data-chat-emote-choice="${id}"]`);draft=draft.slice(0,caret)+glyph(id)+draft.slice(caret);caret++;assert.equal(await evaluate(a,`document.querySelector('${chatInput}').value`),draft);assert.equal(await evaluate(a,`document.querySelector('${chatInput}').selectionStart`),caret);assert.equal(await evaluate(a,`document.querySelector('[data-chat-emote-menu]').hidden`),false);}
  assert.equal(network.slice(pickerFrom).filter(r=>r.name==='RoomChat').length,0);
  await emoteSend(a,b,draft,[1,6,30]);
  await command('Page.bringToFront',{},a);
  const frames=await evaluate(a,`new Promise(resolve=>{const rows=[];let n=0;const sample=time=>{rows.push({time,images:[...document.querySelectorAll('[data-chat-emote]')].map(e=>({id:e.dataset.chatEmote,frame:e.dataset.chatEmoteFrame,elapsed:e.dataset.chatEmoteElapsed,src:e.getAttribute('src')}))});if(++n<12)requestAnimationFrame(sample);else resolve(rows)};requestAnimationFrame(sample)})`);
  evidence.checks.push({name:'Continuous picker caret insertion and natural original mixed emote animation',draft,caret,frames});
  assert(new Set(frames.flatMap(r=>r.images.map(i=>i.frame+':'+i.elapsed))).size>3);
  await press(a,'Escape','Escape');
  for(let i=0;i<14;i++)await sourceSend(a,'实际滚动历史'+i+'中文混排',0,[a,b]);
  const scrollState=async()=>evaluate(a,`(()=>{const l=document.querySelector('[data-chat-log]'),h=document.querySelector('[data-chat-scroll-thumb]');return {top:l.scrollTop,max:l.scrollHeight-l.clientHeight,now:Number(h.getAttribute('aria-valuenow')),thumb:h.getBoundingClientRect().height,track:document.querySelector('[data-chat-scroll-track]').getBoundingClientRect().height,rect:(()=>{const r=h.getBoundingClientRect(),b=document.querySelector('[data-chat-scrollbar]').getBoundingClientRect(),t=document.querySelector('[data-chat-scroll-track]').getBoundingClientRect(),l=document.querySelector('[data-chat-log]').getBoundingClientRect();return {x:r.x+b.width/2,y:r.y+r.height/2,travel:t.height-r.height,trackX:t.x+b.width/2,trackY:t.y,logX:l.x+l.width/2,logY:l.y+l.height/2}})()}})()`);
  const latest=await scrollState();assert(latest.max>0&&latest.thumb>0&&latest.thumb<latest.track);
  await click(a,'[data-chat-scroll-thumb]');await press(a,'Home','Home');await evaluate(a,'new Promise(requestAnimationFrame)');const oldest=await scrollState();assert.equal(oldest.top,0);
  await press(a,'ArrowDown','ArrowDown');const down=await scrollState();assert(down.top>0);await press(a,'End','End');const end=await scrollState();assert(Math.abs(end.top-end.max)<1);assert(Math.abs(end.now-end.top)<1);
  await click(a,'[data-chat-scroll-up]');const upArrow=await scrollState();assert(upArrow.top<end.top);await click(a,'[data-chat-scroll-down]');const downArrow=await scrollState();assert(downArrow.top>upArrow.top);
  await click(a,'[data-chat-scroll-thumb]');await press(a,'Home','Home');await press(a,'PageDown','PageDown');const pageDown=await scrollState();assert(pageDown.top>0);await press(a,'PageUp','PageUp');const pageUp=await scrollState();assert(pageUp.top<pageDown.top);
  await press(a,'Home','Home');const start=await scrollState();const target={x:start.rect.x,y:start.rect.y+start.rect.travel*.7};
  await command('Input.dispatchMouseEvent',{type:'mousePressed',x:start.rect.x,y:start.rect.y,button:'left',clickCount:1},a);await command('Input.dispatchMouseEvent',{type:'mouseMoved',...target,button:'left',buttons:1},a);await command('Input.dispatchMouseEvent',{type:'mouseReleased',...target,button:'left',clickCount:1},a);await evaluate(a,'new Promise(requestAnimationFrame)');const dragged=await scrollState();assert(dragged.top>start.max*.5&&dragged.top<start.max*.9);
  await command('Input.dispatchMouseEvent',{type:'mouseWheel',x:dragged.rect.logX,y:dragged.rect.logY,deltaX:0,deltaY:-80},a);await waitUntil(a,`document.querySelector('[data-chat-log]').scrollTop<${dragged.top}`);const wheel=await scrollState();
  evidence.checks.push({name:'Source scrollbar ordinary arrows/PageDown/PageUp/native pointer drag/wheel',upArrow,downArrow,pageDown,pageUp,dragged,wheel});
  await click(a,'[data-chat-scroll-thumb]');
  const neutralFrom=network.length;await press(a,'w','KeyW');await press(a,' ','Space');await pause(120);const inputs=network.slice(neutralFrom).filter(r=>r.name==='PlayerInput'&&r.direction==='sent'&&r.page===a);assert(inputs.every(r=>!r.payload.move&&!r.payload.turn&&!r.payload.aim&&!r.payload.fire));
  evidence.checks.push({name:'Real acknowledged history source scrollbar Home/ArrowDown/End and keyboard isolation',latest,oldest,down,end,inputs});
  await evaluate(a,`window.oldChatRoot=document.querySelector('.battle-chat');window.oldChatImages=[...document.querySelectorAll('[data-chat-emote]')];`);
  await screenshot(a,'1080p-public');await selectSource(a,1);await click(a,sourceButton(1));
  assert.equal(await evaluate(a,`[...document.querySelector('[data-source-chat-menu]').querySelectorAll('button:not([data-chat-source-channel])')].filter(b=>b.disabled).length`),3);await screenshot(a,'1080p-channel-menu');await press(a,'Escape','Escape');
  await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},a);await evaluate(a,'new Promise(requestAnimationFrame)');await geometry(a,3840,2160);await screenshot(a,'4k-team');
  await click(a,'#leave');await waitUntil(a,`!document.body.classList.contains('in-battle')`);assert.equal(await evaluate(a,`Boolean(document.querySelector('.battle-chat')?.classList.contains('source-battle-chat'))`),false);assert.equal(await evaluate(a,`document.querySelector('[data-source-chat-menu]')?.hidden??true`),true);assert.equal(await evaluate(a,`document.querySelector('${chatInput}')?.value??''`),'');assert.deepEqual(await evaluate(a,`[...(document.querySelector('[data-chat-log]')?.children??[])].map(e=>e.textContent)`),[]);
  const released=await evaluate(a,`({detached:!window.oldChatRoot.isConnected,hidden:window.oldChatRoot.hidden||getComputedStyle(window.oldChatRoot).display==='none',images:window.oldChatImages.map(i=>({connected:i.isConnected,frame:i.dataset.chatEmoteFrame,elapsed:i.dataset.chatEmoteElapsed}))})`);assert(released.detached||released.hidden);assert(released.images.every(i=>!i.connected));await pause(250);assert.deepEqual(await evaluate(a,`window.oldChatImages.map(i=>({connected:i.isConnected,frame:i.dataset.chatEmoteFrame,elapsed:i.dataset.chatEmoteElapsed}))`),released.images);evidence.checks.push({name:'Exit hides or unmounts React chat, detaches rich rows and original emote frames stop updating',released});
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},a);await createRoom(a,4);
  assert.equal(await evaluate(a,`document.querySelector('.battle-chat').classList.contains('source-battle-chat')`),false);assert.equal(await evaluate(a,`document.querySelector('${channelSelect}').value`),'0');await click(a,'[data-ready]');await waitUntil(a,`(${worldExpression})?.phase==='PLAYING'&&document.querySelector('.battle-chat').classList.contains('source-battle-chat')`);
  await selectSource(a,1);const refusalFrom=network.length;await input(a,chatInput,'个人模式原界面草稿');await press(a,'Enter','Enter');await waitUntil(a,`document.querySelector('${chatStatus}').textContent.includes('支持')&&!document.querySelector('${sourceButton(1)}').disabled`);
  const refusal=network.slice(refusalFrom).find(r=>r.page===a&&r.name==='RoomChat'&&r.direction==='received');assert(refusal&&!refusal.success);assert.equal(await evaluate(a,`document.querySelector('${chatInput}').value`),'个人模式原界面草稿');assert.deepEqual(await evaluate(a,logExpression),[]);evidence.checks.push({name:'Source team mode4 real rejection retains Chinese draft; leave resets source/menu/channel and WAITING',refusal});await screenshot(a,'1080p-personal-rejection');
  evidence.pending=await evaluate(a,`window.sourcePending`);assert(evidence.pending.includes(true)&&evidence.pending.includes(false));evidence.status='PASS';await rm(`${output}-failure.png`,{force:true});console.log('PASS: React dual-page public/team/IME/quick/emote/scroll/source-layout/rejection and lifecycle 1080p/4K');
  }
} catch(error){evidence.status='FAIL';evidence.error=String(error);const session=pages[0]?.sessionId;if(session){evidence.failureWorld=await world(session).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
} finally {if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3272,vite:5302,chrome:9502};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);console.log('Evidence: '+output+'.json');}
