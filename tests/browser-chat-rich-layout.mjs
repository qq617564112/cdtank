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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3208', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-chat-rich-layout-'));
let server, chrome, vite, ws;
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-12-E-R original received mixed Chinese/ASCII/emote rich layout through real RoomChat.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5240'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3208', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9310', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9310/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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

const output = 'recovery/output/browser-chat-rich-layout';
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
async function send(session, other, text, channel) {
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
  return evaluate(session, `(()=>{const row=[...document.querySelector('[data-chat-log]').children].find(e=>e.dataset.chatText===${JSON.stringify(expected)});const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {text:row.dataset.chatText,data:{...row.dataset},rect:rect(row),scale:document.querySelector('.source-chat-stage').getBoundingClientRect().width/301,lines:[...row.querySelectorAll('[data-chat-rich-line]')].map(line=>({data:{...line.dataset},rect:rect(line),items:[...line.querySelectorAll('[data-chat-rich-item]')].map(item=>({data:{...item.dataset},rect:rect(item),text:item.textContent,image:item.querySelector('img')?{data:{...item.querySelector('img').dataset},src:item.querySelector('img').getAttribute('src'),width:item.querySelector('img').width,height:item.querySelector('img').height,alt:item.querySelector('img').alt,rect:rect(item.querySelector('img'))}:null}))}))}})()`);
}
async function observeRows(sessions, expected) {
  const rows = await Promise.all(sessions.map(page=>rowState(page, expected)));
  assert(rows.every(row=>row.text===expected));
  assert(rows.every(row=>row.lines.length>0));
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
          const definition=evidence.sequences.sequences.find(d=>d.id===Number(item.image.data.chatEmote)),source=definition.frames[0];
          assert.equal(Number(item.data.chatRichWidth),source.width); assert.equal(Number(item.data.chatRichHeight),source.height);
          near(item.image.rect.x-item.rect.x,scale,'Original image paint inset');
          near(item.image.rect.width,(source.width-1)*scale,'Original image paint right edge');
          near(item.image.rect.height,source.height*scale,'Original image paint height');
        } else assert.equal(Number(item.data.chatRichHeight),0);
        advance=Math.fround(advance+Number(item.data.chatRichWidth));
      }
      near(Number(line.data.chatRichAdvance),advance,'Line original advance metadata');
    }
    const reconstructed = row.lines.flatMap(line=>line.items).map(item=>item.image?.alt??item.text).join('');
    assert.equal(reconstructed,expected,'Rich line splitting retains every received glyph and literal text');
    const providers = new Map();
    for (const image of row.lines.flatMap(line=>line.items).filter(item=>item.image).map(item=>item.image)) {
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
try {
  await launchServer();
  vite = await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'rich-chat-ui-render-budget',transform(source,id){if(id.endsWith('/src/main.ts'))return source.replace('const scene = new Scene(engine);','engine.setHardwareScalingLevel(8);\nconst scene = new Scene(engine);');}}],server:{port:5240,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3208',ws:true,rewrite:()=> '/'}}}});
  await vite.listen(); await launchBrowser();
  const sessions = [];
  for (const name of ['混排甲', '混排乙']) {
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
  const mixed = `中文ABC${glyph(1)}甲乙${glyph(26)}继续xyz${glyph(6)}换行测试${glyph(1)}中文ASCII${glyph(30)}末尾${glyph(1)}收到混排完成`;
  const expected = await send(a,b,mixed,0);
  const mixedRows=await observeRows(sessions,expected);
  assert(mixedRows.every(row=>row.lines.length>1));
  assert(mixedRows.every(row=>new Set(row.lines.map((line,index)=>line.items.some(item=>item.image?.data.chatEmote==='1')?index:null).filter(v=>v!==null)).size>1),'Same provider appears across actual wrapped lines');
  const boundary=await evaluate(a, `(()=>{const style=getComputedStyle(document.querySelector('[data-chat-log]')),canvas=document.createElement('canvas'),c=canvas.getContext('2d');c.font=style.fontSize+' '+style.fontFamily;const state=${worldExpression},prefix=state.players.find(p=>p.id===state.playerId).name+': ',row=document.querySelector('.chat-rich-row'),width=Number(row.dataset.chatRichWidth),imageWidth=${evidence.sequences.sequences.find(d=>d.id===26).frames[0].width};let n=0;while(c.measureText(prefix+'W'.repeat(n+1)).width+imageWidth<=width)n++;return {n,width,imageWidth,font:c.font,prefixAdvance:c.measureText(prefix).width,below:c.measureText(prefix+'W'.repeat(n)).width+imageWidth,above:c.measureText(prefix+'W'.repeat(n+1)).width+imageWidth}})()`);
  assert(boundary.n>0&&boundary.n+2<80); assert(boundary.below<=boundary.width&&boundary.above>boundary.width);
  evidence.checks.push({name:'Actual Web font and original image source width define adjacent ordinary input boundary',...boundary});
  const below=await send(a,b,'W'.repeat(boundary.n)+glyph(26),0),belowRows=await observeRows(sessions,below);
  const above=await send(a,b,'W'.repeat(boundary.n+1)+glyph(26),0),aboveRows=await observeRows(sessions,above);
  assert(belowRows.every(row=>row.lines[0].items.some(item=>item.image?.data.chatEmote==='26')));
  assert(aboveRows.every(row=>!row.lines[0].items.some(item=>item.image?.data.chatEmote==='26')&&row.lines[1].items.some(item=>item.image?.data.chatEmote==='26')));
  const literal = await send(b,a,'收到<emote name=001/>未知<tag>中文ABC字面',1);
  const literalRows = await observeRows(sessions,literal);
  assert(literalRows.every(row=>row.lines.flatMap(line=>line.items).every(item=>!item.image)));
  for (const page of sessions) assert.equal(await evaluate(page, `document.querySelector('[data-chat-log] emote, [data-chat-log] tag')===null`),true);
  const history=await scrollTo(a,'Home'); assert.equal(history.top,0); assert(history.visible.includes(expected));
  await screenshot(a,'1080p-mixed');
  const latest=await scrollTo(a,'End'); assert(Math.abs(latest.top-latest.max)<1); assert(latest.visible.includes(literal)); assert(latest.max>0);
  assert(latest.scrollHeight>=latest.richHeight,'Scrollbar range includes actual rich line heights');
  evidence.checks.push({name:'Original scrollbar Home/End includes rich accumulated line heights and latest literal message',history,latest});
  await screenshot(a,'1080p-latest');
  await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},a);
  await pause(200); await observeRows([a],expected);
  const highHistory=await scrollTo(a,'Home'); assert.equal(highHistory.top,0); assert(highHistory.visible.includes(expected)); await screenshot(a,'4k-mixed');
  const highLatest=await scrollTo(a,'End'); assert(Math.abs(highLatest.top-highLatest.max)<1); assert(highLatest.visible.includes(literal)); await screenshot(a,'4k-latest');
  evidence.checks.push({name:'DPR1 4K rich source history/latest scrollbar',history:highHistory,latest:highLatest});
  evidence.render = await evaluate(a, `(()=>{const c=document.querySelector('canvas');return {uiViewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},canvas:{width:c.width,height:c.height},phase:(${worldExpression}).phase}})()`);
  await click(a,'#leave'); await waitUntil(a,`!document.body.classList.contains('in-battle')`);
  assert.equal(await evaluate(a,`document.querySelectorAll('[data-chat-rich-line], [data-chat-rich-item], [data-chat-emote]').length`),0);
  const waiting=await createRoom(a);
  assert.equal(waiting.phase,'WAITING');
  assert.equal(await evaluate(a,`document.querySelectorAll('[data-chat-rich-line], [data-chat-rich-item], [data-chat-emote]').length`),0);
  assert.equal(await evaluate(a,`document.querySelector('.battle-chat').classList.contains('source-battle-chat')`),false);
  evidence.checks.push({name:'Normal leave clears rich rows; new WAITING has no retained source rich geometry or providers',waiting});
  await click(a,'#leave'); await waitUntil(a,`!document.body.classList.contains('in-battle')`);
  evidence.status = 'PASS';
  await rm(`${output}-failure.png`,{force:true});
  console.log('PASS: actual two-account Chinese/ASCII/multiple-emote mixed received chat and plain unknown markup at DPR1 1080p/4K');
} catch (error) {
  evidence.status='FAIL'; evidence.error=String(error);
  const page=pages[0]?.sessionId;
  if(page){evidence.failureWorld=await world(page).catch(()=>null);await screenshot(page,'failure').catch(()=>{});}
  throw error;
} finally {
  if(ws?.readyState===WebSocket.OPEN)ws.close();
  await vite?.close(); await stop(server); await stop(chrome);
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.isolation={server:3208,vite:5240,chrome:9310};
  evidence.noInjectedGameplayState=true;
  evidence.renderScope='DPR1 1080p/4K UI and original image geometry; 3D hardware scaling8; no FPS claim.';
  evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};
  evidence.network=network;
  await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');
  await writeFile(`${output}.log`,serverLog);
}
