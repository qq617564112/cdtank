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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3210', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-chat-image-'));
let server, chrome, vite, ws;
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-12-E-X-I original received image resource lookup through real RoomChat.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5242'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3210', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9312', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9312/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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

const output = 'recovery/output/browser-chat-image';
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

const glyph = id => String.fromCharCode(0x2580 + id);
const imageTag = name => `<image set=gy0 name=data\\ui\\gy\\${name}.tga/>`;
const imageFixtures = [
  {input:`甲${imageTag('lt1')}乙`,channel:0,names:['lt1']},
  {input:`中文ABC${glyph(1)}${imageTag('lt8')}甲乙${glyph(1)}继续混排`,channel:1,names:['lt8']},
  {input:`${imageTag('lt1')}中文${glyph(1)}尾`,channel:0,names:['lt1']},
  {input:`<image set=gy0 name=data\\ui\\gy\\lt1.tga width=1 red=0 alpha=0/>`,channel:1,names:['lt1']},
  {input:`<colour alpha=0>${imageTag('lt8')}</colour>`,channel:0,names:['lt8']},
  {input:'<image set=missing name=missing/>',channel:1,missing:true},
  {input:'<image set=gy0 name=missing/>',channel:0,missing:true},
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

async function rowState(session, expected) {
  return evaluate(session, `(()=>{const row=[...document.querySelector('[data-chat-log]').children].find(e=>e.dataset.chatText===${JSON.stringify(expected)});const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {text:row.dataset.chatText,data:{...row.dataset},rect:rect(row),scale:document.querySelector('.source-chat-stage').getBoundingClientRect().width/301,lines:[...row.querySelectorAll('[data-chat-rich-line]')].map(line=>({data:{...line.dataset},rect:rect(line),items:[...line.querySelectorAll('[data-chat-rich-item]')].map(item=>({data:{...item.dataset},rect:rect(item),text:item.textContent,color:getComputedStyle(item).color,image:item.querySelector('img')?{data:{...item.querySelector('img').dataset},src:item.querySelector('img').getAttribute('src'),width:item.querySelector('img').width,height:item.querySelector('img').height,alt:item.querySelector('img').alt,complete:item.querySelector('img').complete,naturalWidth:item.querySelector('img').naturalWidth,naturalHeight:item.querySelector('img').naturalHeight,opacity:getComputedStyle(item.querySelector('img')).opacity,rect:rect(item.querySelector('img'))}:null}))}))}})()`);
}
async function observeRows(sessions, expected, displayed = expected) {
  const rows = await Promise.all(sessions.map(page=>rowState(page, expected)));
  assert(rows.every(row=>row.text===expected));
  assert(rows.every(row=>row.data.chatMarkupStatus==='parse-error'?row.lines.length===0:row.lines.length>0));
  for (const row of rows) {
    const near = (value,expected,label)=>assert(Math.abs(value-expected)<0.2,`${label}: ${value} != ${expected}`);
    const width=Number(row.data.chatRichWidth),height=Number(row.data.chatRichLineHeight),scale=row.scale;
    assert.equal(height,16);
    near(row.rect.height,row.lines.length*height*scale,'Rich row accumulated height');
    for (let index=0;index<row.lines.length;index++) {
      const line=row.lines[index]; assert.equal(Number(line.data.chatRichLine),index);
      near(line.rect.y-row.rect.y,index*height*scale,'Original fixed text line advance');
      near(line.rect.x,row.rect.x,'Line starts at received row origin');
      near(line.rect.width,width*scale,'Available original source width');
      let advance=0;
      for(const item of line.items) {
        near(Number(item.data.chatRichX),advance,'Item logical advance accumulation');
        near(item.rect.x-line.rect.x,Number(item.data.chatRichX)*scale,'Original item pixel advance');
        near(item.rect.y,line.rect.y,'Top-aligned original text and image');
        near(item.rect.width,Number(item.data.chatRichWidth)*scale,'Logical source item extent');
        if(item.image) {
          const source=item.image.data.chatSourceImage ? evidence.images.find(image=>image.set===item.image.data.chatSourceImageset&&image.name===item.image.data.chatSourceImage) : evidence.sequences.sequences.find(d=>d.id===Number(item.image.data.chatEmote)).frames[0];
          assert(source,'Every rendered image has the recovered source crop');
          assert.equal(Number(item.data.chatRichWidth),source.width); assert.equal(Number(item.data.chatRichHeight),source.height);
          const isStatic=Boolean(item.image.data.chatSourceImage);
          near(item.image.rect.x-item.rect.x,isStatic?0:scale,'Original image paint inset');
          near(item.image.rect.width,(source.width-(isStatic?0:1))*scale,'Original image paint right edge');
          near(item.image.rect.height,source.height*scale,'Original image paint height');
        } else assert.equal(Number(item.data.chatRichHeight),0);
        advance=Math.fround(advance+Number(item.data.chatRichWidth));
      }
      near(Number(line.data.chatRichAdvance),advance,'Line original advance metadata');
    }
    const reconstructed = row.lines.flatMap(line=>line.items).map(item=>item.image?.alt??item.text).join('');
    assert.equal(reconstructed,displayed,'Rich lines display native parsed text while received identity stays intact');
    const providers = new Map();
    for (const image of row.lines.flatMap(line=>line.items).filter(item=>item.image?.data.chatEmote).map(item=>item.image)) {
      const id = Number(image.data.chatEmote), previous = providers.get(id);
      if (previous) {
        assert.equal(image.data.chatEmoteElapsed,previous.data.chatEmoteElapsed,'Repeated same-provider images share original phase across lines');
        assert.equal(image.data.chatEmoteFrame,previous.data.chatEmoteFrame);
        assert.equal(image.src,previous.src);
      } else providers.set(id,image);
    }
  }
  evidence.checks.push({name:'Both actual received rows have original rich line/item geometry',expected,rows});
  if(rows.length===2) {
    const layout=row=>row.lines.map(line=>({advance:line.data.chatRichAdvance,items:line.items.map(item=>({kind:item.data.chatRichKind,text:item.data.chatRichText,x:item.data.chatRichX,width:item.data.chatRichWidth,height:item.data.chatRichHeight}))}));
    assert.deepEqual(layout(rows[0]),layout(rows[1]),'Both actual identities use identical source width and Web font layout');
  }
  return rows;
}
async function scrollState(session) {
  return evaluate(session, `(()=>{const log=document.querySelector('[data-chat-log]'),rect=log.getBoundingClientRect();return {top:log.scrollTop,max:log.scrollHeight-log.clientHeight,scrollHeight:log.scrollHeight,clientHeight:log.clientHeight,richHeight:[...log.children].reduce((sum,row)=>sum+parseFloat(row.style.height),0),visible:[...log.children].filter(row=>{const r=row.getBoundingClientRect();return r.top<rect.bottom&&r.bottom>rect.top}).map(row=>row.dataset.chatText)}})()`);
}
async function scrollTo(session, value) {
  await command('Page.bringToFront',{},session);
  const point=await evaluate(session, `(()=>{const thumb=document.querySelector('[data-chat-scroll-thumb]').getBoundingClientRect(),bar=document.querySelector('[data-chat-scrollbar]').getBoundingClientRect();return {x:thumb.x+bar.width/2,y:thumb.y+thumb.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point},session);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point},session);
  const from=network.length;
  await press(session,value,value); await pause(100);
  assert.equal(network.slice(from).filter(row=>row.name==='RoomChat'&&row.direction==='sent').length,0);
  return scrollState(session);
}
async function observeAnimation(session) {
  await command('Page.bringToFront', {}, session);
  const samples = await evaluate(session, `new Promise(resolve=>{const samples=[];function take(time){const images=[...document.querySelectorAll('[data-chat-emote]')].map(img=>({id:Number(img.dataset.chatEmote),frame:img.dataset.chatEmoteFrame,elapsed:Number(img.dataset.chatEmoteElapsed),src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0,visibility:img.style.visibility}));samples.push({time,images});if(samples.length===60)resolve(samples);else requestAnimationFrame(take)}requestAnimationFrame(take)})`);
  let loaded = 0;
  for (const sample of samples) {
    const byId = new Map();
    for (const image of sample.images) {
      const sequence = evidence.sequences.sequences.find(value=>value.id===image.id);
      assert(sequence, 'Rendered emote has original source sequence');
      let elapsed = 0, index;
      for (let frame=0;frame<sequence.frames.length;frame++) {
        elapsed = Math.fround(elapsed+Math.fround(sequence.frames[frame].duration));
        if (elapsed>=image.elapsed) {index=frame;break;}
      }
      assert.equal(image.frame, index===undefined?'none':String(index));
      if (index!==undefined) {assert.equal(image.src,'/'+sequence.frames[index].asset);if(image.loaded)loaded++;}
      else assert.equal(image.visibility,'hidden');
      const previous = byId.get(image.id);
      if (previous) {assert.equal(image.elapsed,previous.elapsed);assert.equal(image.frame,previous.frame);assert.equal(image.src,previous.src);}
      else byId.set(image.id,image);
    }
  }
  assert(loaded>0, 'Original parsed emote frames decode');
  const frames = new Set(samples.flatMap(sample=>sample.images.filter(image=>image.id===1).map(image=>image.frame)));
  assert(frames.has('0')&&frames.has('1'),'Parsed emote001 naturally visits both native frames');
  evidence.checks.push({name:'Actual parsed and glyph emotes use native shared provider frame clock',samples});
}

async function verifyNativeImages(sessions) {
  const [a,b]=sessions;
  const ui=await evaluate(a, `fetch('/ui.json').then(r=>r.json())`);
  const gy0=ui.imagesets.filter(set=>set.attributes.Name==='gy0').sort((left,right)=>Number(right.path.includes('imagesets_dds/'))-Number(left.path.includes('imagesets_dds/')))[0];
  assert(gy0,'Actual exported original gy0 imageset');
  evidence.images=gy0.images.filter(image=>['data\\ui\\gy\\lt1.tga','data\\ui\\gy\\lt8.tga'].includes(image.Name)).map(image=>({set:'gy0',name:image.Name,width:Number(image.Width),height:Number(image.Height),asset:image.asset}));
  assert.equal(evidence.images.length,2);
  evidence.decodedImages=await evaluate(a, `Promise.all(${JSON.stringify(evidence.images)}.map(async source=>{const img=new Image();img.src='/'+source.asset;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;const alpha=[];for(let n=3;n<data.length;n+=4)alpha.push(data[n]);return {...source,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,alphaMin:Math.min(...alpha),alphaMax:Math.max(...alpha),transparentPixels:alpha.filter(x=>x===0).length,opaquePixels:alpha.filter(x=>x===255).length}}))`);
  for(const image of evidence.decodedImages) {assert.equal(image.naturalWidth,image.width);assert.equal(image.naturalHeight,image.height);assert(image.alphaMin<255&&image.alphaMax>0,'Actual PNG crop preserves source alpha and visible pixels');}
  assert(evidence.decodedImages.some(image=>image.transparentPixels>0),'Original corner crop contains fully transparent pixels');
  let first,firstDisplayed;
  for(let index=0;index<imageFixtures.length;index++) {
    const fixture=imageFixtures[index],sender=index%2?a:b,receiver=index%2?b:a;
    const raw=await send(sender,receiver,fixture.input,fixture.channel);
    const senderWorld=await world(sender);
    const prefix=`${fixture.channel===1?'[队伍] ':''}${senderWorld.players.find(p=>p.id===senderWorld.playerId).name}: `;
    const displayed=fixture.missing?raw:prefix+fixture.input.replace(/<image[^>]*\/>/g,'').replace(/<\/?colour[^>]*>/g,'');
    const rows=await observeRows(sessions,raw,displayed);
    for(const row of rows) {
      const items=row.lines.flatMap(line=>line.items),staticImages=items.filter(item=>item.data.chatRichKind==='image');
      if(fixture.missing) {
        assert.equal(row.data.chatMarkupStatus,'unsupported-source');assert.equal(staticImages.length,0);
        evidence.checks.push({name:'Unavailable catalog reference is explicitly marked unsupported; no native exception rendering claim',raw,status:row.data.chatMarkupStatus});
      } else {
        assert.equal(row.data.chatMarkupStatus,'parsed');assert.deepEqual(staticImages.map(item=>item.image.data.chatSourceImage),fixture.names.map(name=>`data\\ui\\gy\\${name}.tga`));
        for(const item of staticImages) {
          const img=item.image,source=evidence.images.find(value=>value.name===img.data.chatSourceImage);
          assert.equal(img.data.chatSourceImageset,'gy0');assert.equal(img.src,'/'+source.asset);assert.equal(img.alt,'');
          assert.equal(img.width,source.width);assert.equal(img.height,source.height);assert.equal(img.naturalWidth,source.width);assert.equal(img.naturalHeight,source.height);assert(img.complete);
          assert.equal(item.data.chatRichColour,'1,1,1,1');assert.equal(img.opacity,'1');assert.equal(img.data.chatEmote,undefined);
        }
      }
    }
    if(!first){first=raw;firstDisplayed=displayed;}
    evidence.checks.push({name:'Native static image source lookup and mixed parsed display preserve authoritative identity',fixture,raw,displayed});
  }
  // Enough ordinary received rows for native history and latest positions.
  for(let index=0;index<8;index++) await send(index%2?a:b,index%2?b:a,`历史${index}${imageTag(index%2?'lt1':'lt8')}${glyph(1)}${glyph(1)}结束`,index%2);
  await observeAnimation(a);
  const staticFrames=await evaluate(a, `new Promise(resolve=>{const samples=[];function take(){samples.push([...document.querySelectorAll('[data-chat-source-image]')].map(img=>({name:img.dataset.chatSourceImage,src:img.getAttribute('src'),data:{...img.dataset},complete:img.complete,naturalWidth:img.naturalWidth})));if(samples.length===12)resolve(samples);else requestAnimationFrame(take)}requestAnimationFrame(take)})`);
  assert.deepEqual(staticFrames[0],staticFrames.at(-1),'Native static image remains stable while shared sequence providers tick');
  evidence.checks.push({name:'Static source image identity stays stable alongside shared animated emote providers',samples:staticFrames});
  const history=await scrollTo(a,'Home');assert.equal(history.top,0);assert(history.visible.includes(first));await screenshot(a,'1080p-history');
  const latest=await scrollTo(a,'End');assert(Math.abs(latest.top-latest.max)<1);assert(latest.max>0);await screenshot(a,'1080p-latest');
  evidence.checks.push({name:'DPR1 1080p source scrollbar preserves static image history/latest',history,latest});
  await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},a);await pause(200);
  await observeRows([a],first,firstDisplayed);
  const highHistory=await scrollTo(a,'Home');assert.equal(highHistory.top,0);assert(highHistory.visible.includes(first));await screenshot(a,'4k-history');
  const highLatest=await scrollTo(a,'End');assert(Math.abs(highLatest.top-highLatest.max)<1);await screenshot(a,'4k-latest');
  evidence.checks.push({name:'DPR1 4K source image original geometry and history/latest scroll',history:highHistory,latest:highLatest});
  evidence.render=await evaluate(a, `(()=>{const c=document.querySelector('canvas');return {uiViewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},canvas:{width:c.width,height:c.height},phase:(${worldExpression}).phase}})()`);
}

try {
  await launchServer();
  vite = await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'image-chat-ui-render-budget',transform(source,id){if(id.endsWith('/src/main.ts'))return source.replace('const scene = new Scene(engine);','engine.setHardwareScalingLevel(8);\nconst scene = new Scene(engine);');}}],server:{port:5242,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3210',ws:true,rewrite:()=> '/'}}}});
  await vite.listen(); await launchBrowser();
  const sessions = [];
  for (const name of ['图像甲', '图像乙']) {
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
  await verifyNativeImages(sessions);
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
  console.log('PASS: actual two-account original received image resources at DPR1 1080p/4K');
} catch (error) {
  evidence.status='FAIL'; evidence.error=String(error);
  const page=pages[0]?.sessionId;
  if(page){evidence.failureWorld=await world(page).catch(()=>null);await screenshot(page,'failure').catch(()=>{});}
  throw error;
} finally {
  if(ws?.readyState===WebSocket.OPEN)ws.close();
  await vite?.close(); await stop(server); await stop(chrome);
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.isolation={server:3210,vite:5242,chrome:9312};
  evidence.noInjectedGameplayState=true;
  evidence.renderScope='DPR1 1080p/4K UI and original image geometry; 3D hardware scaling8; no FPS claim.';
  evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};
  evidence.network=network;
  await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');
  await writeFile(`${output}.log`,serverLog);
}
