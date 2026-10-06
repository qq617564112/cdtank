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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3211', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-chat-colour-'));
let server, chrome, vite, ws;
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-12-E-X-C actual received emote RGB/alpha modulation through real RoomChat.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const logExpression = `[...document.querySelector('[data-chat-log]').children].map(e=>e.dataset.chatText??e.textContent)`;
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5243'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3211', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9313', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9313/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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

const output = 'recovery/output/browser-chat-colour';
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
  const geometry=await evaluate(session, `['.source-chat-stage','[data-chat-log]','[data-chat-input]'].map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect();return {selector,x:r.x,y:r.y,width:r.width,height:r.height}})`);
  assert(geometry.every(r=>r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height),JSON.stringify(geometry));
  evidence.checks.push({name:`${width}x${height} original source chat stage/log/input visible`,geometry});
}
async function createRoom(session, mode = 1) {
  if (!await evaluate(session, `document.querySelector('#create-room-controls').open`)) await click(session, '#create-room-controls summary');
  await input(session, '#room-name', '彩色表情验收');
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

const colourFixtures = [
  {text:'<emote name=001 red=0 green=255 blue=0 alpha=255/>', rgba:[0,1,0,1]},
  {text:'<emote name=001 red=255 green=0 blue=0 alpha=255/>', rgba:[1,0,0,1]},
  {text:'<emote name=001 red=64 green=128 blue=192 alpha=128/>', rgba:[64/255,128/255,192/255,128/255]},
  {text:String.fromCharCode(0x2581), rgba:[1,1,1,1]},
  {text:'<emote name=001 red=255 green=255 blue=255 alpha=255/>', rgba:[1,1,1,1]},
  {text:'<emote name=001 red=255 green=0 blue=0 alpha=0/>', rgba:[1,0,0,0]},
  {text:'<emote name=001 red=0 green=255 blue=0 alpha=255/>'+String.fromCharCode(0x2581), rgba:[0,1,0,1], repeat:true},
];
async function send(session, other, text, channel) {
  assert(text.length<=72,'Player image fixtures use supported ordinary message length');
  const before = await world(session), sender = before.players.find(p=>p.id===before.playerId);
  const expected = `${channel === 1 ? '[队伍] ' : ''}${sender.name}: ${text}`, from = network.length;
  await selectSource(session, channel);
  await input(session, chatInput, text);
  await press(session, 'Enter', 'Enter');
  for (const page of [session, other]) await waitUntil(page, `${logExpression}.includes(${JSON.stringify(expected)})`);
  await waitUntil(session, `document.querySelector('${chatInput}').value===''&&!document.querySelector('${sourceButton(channel)}').disabled`);
  const rows = network.slice(from), requests = rows.filter(r=>r.page===session&&r.name==='RoomChat'&&r.direction==='sent');
  assert.equal(requests.length, 1); assert.equal(requests[0].payload.text, text); assert.equal(requests[0].payload.channel, channel);
  const response = rows.find(r=>r.page===session&&r.name==='RoomChat'&&r.direction==='received');
  assert(response?.success); assert.equal(response.response.playerId, sender.id);
  const events = rows.filter(r=>r.name==='RoomEvent');
  assert.equal(events.length, 2);
  assert(events.every(r=>r.payload.message===expected&&r.payload.playerId===sender.id&&r.payload.value===channel));
  evidence.checks.push({name:'Ordinary Enter authoritative RoomChat and identical actual sender text on both clients', requests, response, events});
  return expected;
}

async function emoteState(session, expected) {
  return evaluate(session, `(()=>{const row=[...document.querySelector('[data-chat-log]').children].find(e=>e.dataset.chatText===${JSON.stringify(expected)});const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {text:row.dataset.chatText,status:row.dataset.chatMarkupStatus,scale:document.querySelector('.source-chat-stage').getBoundingClientRect().width/301,images:[...row.querySelectorAll('img[data-chat-emote]')].map(img=>({src:img.getAttribute('src'),data:{...img.dataset},colour:img.parentElement.dataset.chatRichColour,opacity:getComputedStyle(img).opacity,filter:getComputedStyle(img).filter,rect:rect(img),item:rect(img.parentElement),logicalWidth:Number(img.parentElement.dataset.chatRichWidth),logicalHeight:Number(img.parentElement.dataset.chatRichHeight),loaded:img.complete&&img.naturalWidth>0}))}})()`);
}
async function pixelDiagnostic(session, expected, rgba, label) {
  // Move the actual received image to a white diagnostic board; retain its production filter/opacity.
  const state=await evaluate(session, `(()=>{const row=[...document.querySelector('[data-chat-log]').children].find(e=>e.dataset.chatText===${JSON.stringify(expected)}),img=row.querySelector('img[data-chat-emote]');const parent=img.parentElement,next=img.nextSibling,css=img.style.cssText;const host=document.createElement('div');Object.assign(host.style,{position:'fixed',left:'40px',top:'40px',width:img.style.width,height:img.style.height,background:'white',zIndex:'2147483647',padding:'0',margin:'0'});document.body.append(host);host.append(img);img.style.left='0px';window.__colourDiagnostic={img,parent,next,css,host};const r=img.getBoundingClientRect();return {src:img.getAttribute('src'),filter:getComputedStyle(img).filter,opacity:getComputedStyle(img).opacity,width:r.width,height:r.height,x:r.x,y:r.y,frame:img.dataset.chatEmoteFrame}})()`);
  try {
    await evaluate(session, `window.__colourDiagnostic.img.decode()`);
    const capture=await command('Page.captureScreenshot',{format:'png',clip:{x:state.x,y:state.y,width:state.width,height:state.height,scale:1}},session);
    await writeFile(`${output}-pixels-${label}.png`,Buffer.from(capture.data,'base64'));
    const pixels=await evaluate(session, `(async()=>{const source=new Image();source.src=${JSON.stringify(state.src)};await source.decode();const shot=new Image();shot.src='data:image/png;base64,${capture.data}';await shot.decode();const width=${state.width},height=${state.height};const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0,width,height);const original=ctx.getImageData(0,0,width,height).data;ctx.clearRect(0,0,width,height);ctx.drawImage(shot,0,0);const actual=ctx.getImageData(0,0,width,height).data;const rgba=${JSON.stringify(rgba)};let maxError=0,sumError=0,channels=0,visible=0,changedFromWhiteDefault=0;const samples=[];for(let i=0;i<original.length;i+=4){const alpha=original[i+3]/255*rgba[3];if(original[i+3]>200)visible++;for(let c=0;c<3;c++){const target=Math.round(original[i+c]*rgba[c]*alpha+255*(1-alpha)),error=Math.abs(actual[i+c]-target);maxError=Math.max(maxError,error);sumError+=error;channels++;const defaultColour=Math.round(original[i+c]*original[i+3]/255+255*(1-original[i+3]/255));if(Math.abs(actual[i+c]-defaultColour)>30)changedFromWhiteDefault++;}if(original[i+3]===255&&samples.length<8)samples.push({source:[...original.slice(i,i+4)],actual:[...actual.slice(i,i+4)]});}return {maxError,meanError:sumError/channels,visible,changedFromWhiteDefault,samples,width:shot.naturalWidth,height:shot.naturalHeight}})()`);
    assert(pixels.visible>0,'Recovered source PNG contains actual visible colour');
    assert(pixels.maxError<=6&&pixels.meanError<1.5,`Screen pixels follow source × RGBA: ${JSON.stringify(pixels)}`);
    if(rgba.some((value,index)=>index<3&&value!==1)&&rgba[3]>0)assert(pixels.changedFromWhiteDefault>0,'Colour filter visibly changes source pixels');
    evidence.checks.push({name:'Actual received img screen pixels match recovered PNG multiplied by RGBA over white diagnostic background',label,rgba,state,pixels});
  } finally {
    await evaluate(session, `(()=>{const d=window.__colourDiagnostic;d.img.style.cssText=d.css;d.parent.insertBefore(d.img,d.next);d.host.remove();delete window.__colourDiagnostic})()`);
  }
}
async function observeColourAnimation(session) {
  await command('Page.bringToFront',{},session);
  const samples=await evaluate(session, `new Promise(resolve=>{const samples=[];function take(time){samples.push({time,images:[...document.querySelectorAll('img[data-chat-emote]')].map(img=>({frame:img.dataset.chatEmoteFrame,elapsed:img.dataset.chatEmoteElapsed,src:img.getAttribute('src'),colour:img.parentElement.dataset.chatRichColour,filter:getComputedStyle(img).filter,opacity:getComputedStyle(img).opacity}))});if(samples.length===90)resolve(samples);else requestAnimationFrame(take)}requestAnimationFrame(take)})`);
  for(const sample of samples){const first=sample.images[0];assert(sample.images.every(img=>img.frame===first.frame&&img.elapsed===first.elapsed&&img.src===first.src),'All emote001 instances share provider phase');}
  assert(new Set(samples.map(sample=>sample.images[0].frame)).size>1,'Real received emote naturally advances frames');
  for(let i=0;i<samples[0].images.length;i++)assert(samples.every(sample=>sample.images[i].colour===samples[0].images[i].colour&&sample.images[i].filter===samples[0].images[i].filter&&sample.images[i].opacity===samples[0].images[i].opacity),'New native frames retain each instance colour and alpha');
  evidence.checks.push({name:'Repeated shared-provider emote001 advances real frames with stable instance RGB and alpha',samples});
}
async function verifyColours(sessions) {
  const [a,b]=sessions;
  const received=[];
  for(let index=0;index<colourFixtures.length;index++){
    const fixture=colourFixtures[index],sender=index%2?b:a,receiver=index%2?a:b;
    const raw=await send(sender,receiver,fixture.text,index%2);
    received.push(raw);
    for(const page of sessions){
      await waitUntil(page, `[...document.querySelector('[data-chat-log]').children].find(e=>e.dataset.chatText===${JSON.stringify(raw)})?.querySelector('img[data-chat-emote]')?.complete`);
      const row=await emoteState(page,raw);assert.equal(row.status,'parsed');assert.equal(row.images.length,fixture.repeat?2:1);
      const image=row.images[0],colour=image.colour.split(',').map(Number);
      assert(colour.every((value,channel)=>Math.abs(value-fixture.rgba[channel])<1e-6));
      assert(Math.abs(Number(image.opacity)-fixture.rgba[3])<1e-6);
      assert(Math.abs(image.rect.x-image.item.x-row.scale)<0.2,'Original one pixel emote inset');
      assert(Math.abs(image.rect.width-(image.logicalWidth-1)*row.scale)<0.2,'Original source width minus one paint');
      assert(Math.abs(image.rect.height-image.logicalHeight*row.scale)<0.2);
      if(fixture.repeat){assert.equal(row.images[0].data.chatEmoteElapsed,row.images[1].data.chatEmoteElapsed);assert.equal(row.images[0].src,row.images[1].src);assert.equal(row.images[1].colour,'1,1,1,1');}
      evidence.checks.push({name:'Actual received row preserves source geometry and individual colour',fixture,page,row});
      await pixelDiagnostic(page,raw,fixture.rgba,`1080p-${index}-${page===a?'a':'b'}`);
    }
  }
  await observeColourAnimation(a);await observeColourAnimation(b);
  for(const page of sessions){
    await command('Page.bringToFront',{},page);
    await waitUntil(page, `[...document.querySelector('[data-chat-log]').children].find(e=>e.dataset.chatText===${JSON.stringify(received[0])})?.querySelector('img[data-chat-emote]')?.dataset.chatEmoteFrame==='1'`);
    await pixelDiagnostic(page,received[0],colourFixtures[0].rgba,`1080p-green-new-frame-${page===a?'a':'b'}`);
  }
  await screenshot(a,'1080p');await screenshot(b,'1080p-peer');
  await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},a);await pause(200);
  await assertLayout(a,3840,2160);
  for(let index=0;index<received.length;index++)await pixelDiagnostic(a,received[index],colourFixtures[index].rgba,`4k-${index}`);
  await observeColourAnimation(a);await screenshot(a,'4k');
  evidence.render=await evaluate(a, `(()=>{const c=document.querySelector('canvas');return {uiViewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},canvas:{width:c.width,height:c.height},phase:(${worldExpression}).phase}})()`);
}

try {
  await launchServer();
  vite = await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'image-chat-ui-render-budget',transform(source,id){if(id.endsWith('/src/main.ts'))return source.replace('const scene = new Scene(engine);','engine.setHardwareScalingLevel(8);\nconst scene = new Scene(engine);');}}],server:{port:5243,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3211',ws:true,rewrite:()=> '/'}}}});
  await vite.listen(); await launchBrowser();
  const sessions = [];
  for (const name of ['彩色甲', '彩色乙']) {
    const {browserContextId} = await command('Target.createBrowserContext');
    contexts.push(browserContextId);
    const page = await newPage(browserContextId); sessions.push(page);
    await input(page, '#player-name', name);
  }
  const [a,b] = sessions, initial = await createRoom(a);
  await joinRoom(b, initial.roomId);
  for (const page of sessions) await waitUntil(page, `(${worldExpression}).players.length===2&&(${worldExpression}).renderedPlayers===2`);
  await setTeam(b,0); await click(a,'[data-add-cpu]');
  for (const page of sessions) await waitUntil(page, `(${worldExpression}).players.length===3&&(${worldExpression}).renderedPlayers===3`);
  evidence.waitingWorlds = await Promise.all(sessions.map(world));
  for (const page of sessions) await click(page,'[data-ready]');
  for (const page of sessions) await waitUntil(page, `(${worldExpression}).phase==='PLAYING'&&document.querySelector('.battle-chat').classList.contains('source-battle-chat')`);
  evidence.playingWorlds = await Promise.all(sessions.map(world));
  evidence.sequences = await evaluate(a, `fetch('/chat-emote-sequences.json').then(r=>r.json())`);
  await assertLayout(a,1920,1080); await verifyColours(sessions);
  await click(a,'#leave'); await waitUntil(a,`!document.body.classList.contains('in-battle')`);
  assert.equal(await evaluate(a,`document.querySelectorAll('[data-chat-rich-line], [data-chat-rich-item], [data-chat-emote], [data-chat-source-image]').length`),0);
  const waiting=await createRoom(a);
  assert.equal(waiting.phase,'WAITING');
  assert.equal(await evaluate(a,`document.querySelectorAll('[data-chat-rich-line], [data-chat-rich-item], [data-chat-emote], [data-chat-source-image]').length`),0);
  assert.equal(await evaluate(a,`document.querySelector('.battle-chat').classList.contains('source-battle-chat')`),false);
  evidence.checks.push({name:'Normal leave clears rich rows; new WAITING has no retained source rich geometry or providers',waiting});
  await click(a,'#leave'); await waitUntil(a,`!document.body.classList.contains('in-battle')`);
  evidence.status = 'PASS';
  await rm(`${output}-failure.png`,{force:true});
  console.log('PASS: actual two-account coloured emote screen pixels at DPR1 1080p/4K');
} catch (error) {
  evidence.status='FAIL'; evidence.error=String(error);
  const page=pages[0]?.sessionId;
  if(page){evidence.failureWorld=await world(page).catch(()=>null);await screenshot(page,'failure').catch(()=>{});}
  throw error;
} finally {
  if(ws?.readyState===WebSocket.OPEN)ws.close();
  await vite?.close(); await stop(server); await stop(chrome);
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.isolation={server:3211,vite:5243,chrome:9313};
  evidence.noInjectedGameplayState=true;
  evidence.renderScope='DPR1 1080p/4K ordinary actual received emotes and original image geometry; screen pixel diagnostic uses actual img on white board, recovered PNG × RGBA; 3D hardware scaling8; no original Windows pixel equivalence or FPS claim.';
  evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};
  evidence.network=network;
  await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');
  await writeFile(`${output}.log`,serverLog);
}
