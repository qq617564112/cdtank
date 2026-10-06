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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3202', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-chat-ime-'));
let server, chrome, vite, ws;
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-16-C Chromium IME composition and ordinary chat submission in real WAITING/PLAYING rooms.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5234'}, sessionId);
  await ready(sessionId);
  await evaluate(sessionId, `window.teamChatPending=[];new MutationObserver(()=>window.teamChatPending.push(document.querySelector('[data-chat-channel]').disabled)).observe(document.querySelector('[data-chat-channel]'),{attributes:true,attributeFilter:['disabled']})`);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3202', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9304', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9304/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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

const output = 'recovery/output/browser-chat-ime';
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
try {
  await launchServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'ime-readiness-observer',transform(source,id){if(!id.endsWith('/src/match/battle.ts'))return;return source+`\nconst setQuickChats=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.teamChatBattle=this;return setQuickChats.call(this,value);};\n`;}}],server:{port:5234,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3202',ws:true,rewrite:()=> '/'}}}});
  await vite.listen();await launchBrowser();
  const sessions=[];
  for(const name of ['中文输入甲','中文输入乙']) {
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const session=await newPage(browserContextId);sessions.push(session);await input(session,'#player-name',name);
    await evaluate(session,`window.imeEvents=[];for(const type of ['compositionstart','compositionupdate','compositionend','input','keydown','keyup'])document.querySelector('${chatInput}').addEventListener(type,event=>window.imeEvents.push({type:event.type,data:event.data??null,inputType:event.inputType??null,isComposing:event.isComposing??null,key:event.key??null,keyCode:event.keyCode??null,value:event.target.value,at:performance.now()}));`);
  }
  const [a,b]=sessions;
  await click(a,'#open-quick-chat-settings');await input(a,'[data-quick-chat-key="F5"]','组合时不能快捷发送');await click(a,'#quick-chat-settings-save');await click(a,'#quick-chat-settings-cancel');
  const initial=await createRoom(a);await joinRoom(b,initial.roomId);
  for(const session of sessions)await waitUntil(session,`(${worldExpression})?.players.length===2&&(${worldExpression}).renderedPlayers===2`);
  evidence.initialWorlds=await Promise.all(sessions.map(world));
  await imeFlow(a,b,'等待阶段中文确认');
  await assertLayout(a,1920,1080);await screenshot(a,'1080p-waiting');
  for(const session of sessions)await click(session,'[data-ready]');
  for(const session of sessions)await waitUntil(session,`(${worldExpression})?.phase==='PLAYING'`);
  evidence.playingWorlds=await Promise.all(sessions.map(world));
  await imeFlow(a,b,'战斗阶段中文确认');
  await input(a,chatInput,'');await compose(a,'中文候选');
  const isolatedFrom=network.length;
  await press(a,'w','KeyW');await press(a,' ','Space');await press(a,'5','Digit5');await press(a,'F5','F5');
  await noBusiness(a,isolatedFrom,'Composition W Space Digit5 F5 produce no chat/movement/fire/item action');
  await press(a,'Escape','Escape');
  assert.equal(await evaluate(a,`document.activeElement===document.querySelector('${chatInput}')`),true,'Composition Escape must remain in chat');
  await compose(a,'');
  await press(a,'Escape','Escape');
  assert.equal(await evaluate(a,`document.activeElement.tagName`),'CANVAS','After candidate cancel ordinary Escape returns canvas');
  evidence.checks.push({name:'Candidate Escape stays in input, imeSetComposition empty cancels, ordinary Escape returns canvas'});
  await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},a);
  await input(a,chatInput,'');await compose(a,'四Ｋ中文候选');await assertLayout(a,3840,2160);await screenshot(a,'4k-playing-preedit');
  await click(a,'#leave');await waitUntil(a,`!document.body.classList.contains('in-battle')`);
  assert.equal(await evaluate(a,`document.querySelector('${chatInput}').value`),'');assert.deepEqual(await evaluate(a,logExpression),[]);
  await waitUntil(b,`(${worldExpression})?.phase==='FINISHED'`);await joinRoom(a,initial.roomId);
  assert.equal(await evaluate(a,`document.querySelector('${chatInput}').value`),'');
  await imeFlow(a,b,'重新入房中文确认');
  evidence.checks.push({name:'Leave during real composition then ordinary reentry resets draft/log/composition state'});
  await click(a,'#leave');await waitUntil(a,`!document.body.classList.contains('in-battle')&&!document.querySelector('#create-room').disabled`);
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},a);
  await createRoom(a,4);await selectValue(a,channelSelect,1);
  await input(a,chatInput,'');await compose(a,'拒绝后中文草稿');await command('Input.insertText',{text:'拒绝后中文草稿'},a);
  const failureFrom=network.length;await press(a,'Enter','Enter');
  await waitUntil(a,`document.querySelector('${chatStatus}').textContent.includes('支持')&&!document.querySelector('${channelSelect}').disabled`);
  const refusal=network.slice(failureFrom).find(r=>r.page===a&&r.name==='RoomChat'&&r.direction==='received');assert(refusal&&!refusal.success);
  assert.equal(await evaluate(a,`document.querySelector('${chatInput}').value`),'拒绝后中文草稿');assert.deepEqual(await evaluate(a,logExpression),[]);
  evidence.checks.push({name:'Real personal-mode channel rejection preserves committed Chinese draft',refusal});await screenshot(a,'1080p-rejected-draft');
  evidence.compositionEvents=await Promise.all(sessions.map(session=>evaluate(session,`window.imeEvents`)));
  evidence.status='PASS';await rm(`${output}-failure.png`,{force:true});console.log('PASS: actual Chromium composition events, candidate Enter isolation, Chinese WAITING/PLAYING/reentry submission, focus keys/Escape/repeat isolation, real refusal retains draft,1080p/4K');
} catch(error){evidence.status='FAIL';evidence.error=String(error);const session=pages[0]?.sessionId;if(session){evidence.failureWorld=await world(session).catch(()=>null);evidence.compositionEvents=await evaluate(session,`window.imeEvents`).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
} finally {
  if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.isolation={server:3202,vite:5234,chrome:9304};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);
}
