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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3206', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-lobby-presence-'));
let server, chrome, vite, ws;
const auxiliary=[];
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const exitOnly=process.argv.includes('--exit-only');
const waitingOnly=process.argv.includes('--waiting-only');
const cleanupOnly=process.argv.includes('--cleanup-only');
const resume=process.argv.includes('--lifecycle-only')||cleanupOnly||waitingOnly||exitOnly;
const run=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-room-whisper-'+run;
const evidence = {status: 'PASS', scope: 'M6-08-WR three formal pages ordinary room private controls, lifecycle and cross-lobby delivery; 8-second test deadline.', mode: waitingOnly?'waiting-only':exitOnly?'exit-only':cleanupOnly?'cleanup-only':resume?'lifecycle-only':'full', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const chatInput = '[data-lobby-chat-input]';
const chatStatus = '[data-lobby-chat-status]';
const logExpression = `[...document.querySelector('[data-lobby-chat-log]').children].map(e=>e.textContent)`;
async function key(session, key, code, type = 'keyDown') {
  await command('Input.dispatchKeyEvent', {type, key, code, ...(type === 'keyDown' && (key === 'Enter' || key.length === 1) ? {text: key === 'Enter' ? '\r' : key} : {}), windowsVirtualKeyCode: ({Enter: 13, Escape: 27, Home: 36, End: 35, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, ' ': 32})[key] ?? key.toUpperCase().charCodeAt(0)}, session);
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
async function submit(session, text) {
  await input(session, chatInput, text);
  await press(session, 'Enter', 'Enter');
}
try {
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3206', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite'), MATCH_TIME_LIMIT_SECONDS:'8'}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {serverLog += String(data);});
  server.stderr.on('data', data => {serverLog += String(data);});
  const deadline = Date.now() + 15000;
  while (!serverLog.includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
  assert(serverLog.includes('Server started'), serverLog);
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    plugins:[{name:'readiness-observer',transform(source,id){if(id.endsWith('/src/match/battle.ts'))return source+'\nconst old=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.roomWhisperBattle=this;return old.call(this,value);};';}}],
    server: {port: 5366, strictPort: true, host: '127.0.0.1', hmr: false,
      proxy: {'/game': {target: 'ws://127.0.0.1:3206', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=9566', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9566/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
  }
  assert(endpoint, 'Dedicated Chrome failed to start');
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
  ws.on('message', raw => {
    const message = JSON.parse(String(raw));
    const callback = pending.get(message.id);
    if (callback) {
      pending.delete(message.id);
      message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
    }
    if (['Network.webSocketFrameReceived', 'Network.webSocketFrameSent'].includes(message.method)) {
      const frame = message.params.response;
      if (frame.opcode !== 2) return;
      const bytes = new Uint8Array(Buffer.from(frame.payloadData, 'base64'));
      if (bytes.length === 1 && bytes[0] === 0) return;
      const received = message.method.endsWith('Received');
      const parsed = received ? TransportDataUtil.parseServerOutout(decoder.tsbuffer, decoder.serviceMap, bytes)
        : parseClientInput(bytes);
      assert(parsed.isSucc, parsed.errMsg);
      const result = parsed.result;
      if (result.service.name === 'RoomWhisper' || result.service.name === 'Rematch' || result.service.name === 'RoomSnapshot' || result.service.name === 'LobbyWhisper' || result.service.name === 'DisplayName' || result.service.name === 'LobbyPlayers' || result.service.name === 'Leave' || result.service.name === 'LobbyChat' || result.service.name === 'Account' || result.service.name === 'PlayerInput' || result.service.name === 'RoomChat'
          || result.service.name === 'Ready' || result.service.name === 'CreateRoom'
          || result.service.name === 'Join'
          || result.service.name === 'RoomEvent' && result.msg.type === 'chat') {
        network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent',
          kind: result.type, name: result.service.name,
          ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err}
            : {payload: result.msg ?? result.req})});
      }
    }
  });
  const listExpression = `[...document.querySelectorAll('[data-lobby-player-account]')].map(row=>({accountId:row.dataset.lobbyPlayerAccount,name:row.textContent}))`;
  for (let index=0;index<3;index++) {
    const {browserContextId}=await command('Target.createBrowserContext'); contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await command('Page.navigate',{url:'http://127.0.0.1:5366'},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-lobby-player-list]')?.dataset.sourceFontReady==='true'&&localStorage.getItem('cdtank-account-token')`);
  }
  const [a,b,c]=pages.map(p=>p.sessionId);
  for(const [page,name] of [[a,'私聊甲'],[b,'私聊乙'],[c,'大厅丙']]) {
    await waitUntil(page,`document.querySelector('#player-name')?.disabled===false`);
    await input(page,'#player-name',name);await click(page,'[data-lobby-name-save]');
    await waitUntil(page,`document.querySelector('[data-lobby-identity]')?.dataset.confirmedName===${JSON.stringify(name)}`);
  }
  const roomWorld=page=>evaluate(page,worldExpression);
  async function selectValue(page,selector,value) {
    await click(page,selector);await press(page,'Home','Home');
    const index=await evaluate(page,`[...document.querySelector(${JSON.stringify(selector)}).options].findIndex(o=>o.value===${JSON.stringify(String(value))})`);
    assert(index>=0);for(let i=0;i<index;i++)await press(page,'ArrowDown','ArrowDown');await press(page,'Enter','Enter');
  }
  async function joinRoom(page,id) {
    await waitUntil(page,`document.querySelector('[data-room-card-id="${id}"]')&&!document.querySelector('[data-room-card-id="${id}"]').disabled`);
    const point=await evaluate(page,`(()=>{const e=document.querySelector('[data-room-card-id="${id}"]'),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...point},page);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...point},page);
    await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression})?.roomId===${JSON.stringify(id)}`);
  }
  await click(a,'[data-room-card-create]');await waitUntil(a,`document.querySelector('[data-map-selector-mode="4"]')`);
  await click(a,'[data-map-selector-mode="4"]');await click(a,'[data-map-selector-map="7"]');await click(a,'[data-map-selector-confirm]');
  await waitUntil(a,`document.querySelector('[data-room-create-name]')`);await input(a,'[data-room-create-name]','密语验收');await click(a,'[data-room-create-confirm]');
  await waitUntil(a,`(${worldExpression})?.mapLoaded&&(${worldExpression})?.phase==='WAITING'`);
  const roomId=(await roomWorld(a)).roomId;await joinRoom(b,roomId);
  await waitUntil(a,`(${worldExpression}).players.length===2`);
  async function privateMode(page) {
    if(await evaluate(page,`document.querySelector('.source-battle-chat')!==null`)) {
      const current=await evaluate(page,`document.querySelector('[data-chat-channel]').value`);
      await click(page,`[data-source-control="${current==='2'?'btnPrivate':current==='1'?'btnTeam':'btnPublic'}"]`);
      await waitUntil(page,`!document.querySelector('[data-source-chat-menu]').hidden`);
      await click(page,'[data-chat-source-channel="2"]');
    }else await selectValue(page,'[data-chat-channel]',2);
    await waitUntil(page,`document.querySelector('[data-chat-whisper-target]')`);
  }
  const roomRows=`[...document.querySelector('[data-chat-log]').children].map(e=>e.dataset.chatText??e.textContent)`;
    async function privateGeometry() {
    for(const viewport of [{width:800,height:600},{width:1920,height:1080},{width:3840,height:2160}]) {
      const scale=Math.min(viewport.width/800,viewport.height/600);
      await command('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false},a);
      await waitUntil(a,`innerWidth===${viewport.width}&&innerHeight===${viewport.height}&&Math.abs(document.querySelector('.source-chat-stage').getBoundingClientRect().width-${301}*${scale})<.1&&Math.abs(document.querySelector('.battle-chat').getBoundingClientRect().x-${(viewport.width-800*scale)/2})<.1`);
      const geometry=await evaluate(a,`(async()=>{const ui=await(await fetch('/ui.json')).json(),layout=ui.layouts.find(l=>l.path.endsWith('game_main_chat_shrinked.xml'));const rect=n=>{const e=layout.windows.find(w=>w.name===n),b=e.properties.AbsoluteRect.match(/-?\\d+(?:\\.\\d+)?/g).map(Number);let x=b[0],y=b[1];for(let p=e.parent;p;){const owner=layout.windows.find(w=>w.name===p),r=owner.properties.AbsoluteRect.match(/-?\\d+(?:\\.\\d+)?/g).map(Number);x+=r[0];y+=r[1];p=owner.parent;}return {x,y,width:b[2]-b[0],height:b[3]-b[1]};};return ['edtIntimateNameInput','edtIntimateChatInput','btnPrivate'].map(name=>{const e=document.querySelector('[data-source-control="'+name+'"]'),r=e.getBoundingClientRect();return {name,source:rect(name),actual:{x:r.x,y:r.y,width:r.width,height:r.height},asset:e.dataset.sourceAsset??null}})})()`);
      for(const row of geometry){const expected={x:(viewport.width-800*scale)/2+row.source.x*scale,y:(viewport.height-600*scale)/2+row.source.y*scale,width:row.source.width*scale,height:row.source.height*scale};for(const axis of ['x','y','width','height'])assert(Math.abs(row.actual[axis]-expected[axis])<.2,JSON.stringify({row,expected}));row.expected=expected;}
      await screenshot(a,viewport.width+'-private-verified');evidence.checks.push({name:'source private rectangles match source geometry after committed resize',viewport,geometry});
    }
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},a);
    await waitUntil(a,`Math.abs(document.querySelector('.source-chat-stage').getBoundingClientRect().width-301*1.8)<.1`);
  }
  async function send(text,target='私聊乙',phase) {
  await privateMode(a);await input(a,'[data-chat-whisper-target]',target);await input(a,'[data-chat-input]',text);
    const from=network.length;await press(a,'Enter','Enter');
    await waitUntil(a,`document.querySelector('[data-chat-input]').value===''`);
    const observers=target==='大厅丙'?[a,c]:[a,b];
    for(const page of observers)await waitUntil(page,`${page===c?logExpression:roomRows}.some(t=>t.includes(${JSON.stringify(text)}))`);
    const requests=network.slice(from).filter(e=>e.name==='RoomWhisper'&&e.direction==='sent');assert.equal(requests.length,1);
    const deliveries=network.slice(from).filter(e=>e.name==='RoomWhisper'&&e.kind==='msg'&&e.direction==='received');
    assert.equal(deliveries.length,2);assert(deliveries.every(e=>observers.includes(e.page)));
    evidence.checks.push({name:'ordinary '+phase+' whisper only sender/target',target,requests,deliveries});
  }
  if(!resume) {
  await privateMode(a);await input(a,'[data-chat-input]','空对象草稿');await press(a,'Enter','Enter');
  await waitUntil(a,`document.querySelector('.battle-chat [role=status]').textContent.includes('对象')`);
  assert.equal(await evaluate(a,`document.querySelector('[data-chat-input]').value`),'空对象草稿');
  for(const [target,text,word] of [['私聊甲','自己拒绝','自己'],['不在线','离线拒绝','在线']]) {
    await input(a,'[data-chat-whisper-target]',target);await input(a,'[data-chat-input]',text);await press(a,'Enter','Enter');
    await waitUntil(a,`document.querySelector('.battle-chat [role=status]').textContent.includes(${JSON.stringify(word)})`);
    assert.equal(await evaluate(a,`document.querySelector('[data-chat-input]').value`),text);
  }
  await input(c,'#player-name','私聊乙');await click(c,'[data-lobby-name-save]');await waitUntil(c,`document.querySelector('[data-lobby-identity]').dataset.confirmedName==='私聊乙'`);
  await input(a,'[data-chat-whisper-target]','私聊乙');await input(a,'[data-chat-input]','同名拒绝');await press(a,'Enter','Enter');
  await waitUntil(a,`document.querySelector('.battle-chat [role=status]').textContent.includes('多名')`);
  assert.equal(await evaluate(a,`document.querySelector('[data-chat-input]').value`),'同名拒绝');
  await input(c,'#player-name','大厅丙');await click(c,'[data-lobby-name-save]');await waitUntil(c,`document.querySelector('[data-lobby-identity]').dataset.confirmedName==='大厅丙'`);
  evidence.checks.push({name:'ordinary missing/self/offline/ambiguous target refusals retain drafts'});
  await input(a,'[data-chat-whisper-target]','私聊乙');await input(a,'[data-chat-input]','输入法确认');
  const imeFrom=network.length;await command('Input.imeSetComposition',{text:'中文',selectionStart:2,selectionEnd:2},a);
  await press(a,'Enter','Enter');await pause(200);assert.equal(network.slice(imeFrom).filter(e=>e.name==='RoomWhisper'&&e.direction==='sent').length,0);
  await command('Input.insertText',{text:'中文'},a);
  await send('等待阶段中文密语','私聊乙','WAITING');
  await send('跨界面大厅密语','大厅丙','WAITING to lobby');
  }
  if(waitingOnly) {
    for(const viewport of [{width:800,height:600},{width:1920,height:1080},{width:3840,height:2160}]) {
      await command('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false},a);await pause(200);
      const expectedScale=Math.max(.25,Math.min((viewport.width-64)/615,(viewport.height-180)/391,2));
      await waitUntil(a,`Math.abs(document.querySelector('.waiting-room-stage').getBoundingClientRect().width-615*${expectedScale})<.2`);
      const geometry=await evaluate(a,`(()=>{const d=document.querySelector('[data-waiting-room]'),rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {dialog:rect(d),stage:rect(d.querySelector('.waiting-room-stage')),viewport:rect(d.querySelector('.waiting-room-viewport')),ancestors:[d,...(()=>{const out=[];for(let e=d.parentElement;e;e=e.parentElement)out.push(e);return out})()].map(e=>({tag:e.tagName,class:e.className,transform:getComputedStyle(e).transform,position:getComputedStyle(e).position})),modal:d.matches(':modal'),open:d.open}})()`);
      assert(geometry.open&&!geometry.modal);assert(Math.abs(geometry.dialog.x+geometry.dialog.width/2-viewport.width/2)<1&&Math.abs(geometry.dialog.y+geometry.dialog.height/2-viewport.height/2)<1);assert(Math.abs(geometry.stage.width-615*expectedScale)<.2&&Math.abs(geometry.stage.height-391*expectedScale)<.2);
      await screenshot(a,viewport.width+'-formal-waiting');evidence.checks.push({name:'formal nonmodal waiting source stage scale and centered complete dialog',viewport,geometry});
    }
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},a);
    if(waitingOnly){evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');console.log('PASS waiting geometry diagnostic '+output);}
  }
  if(!waitingOnly) {
  if(!exitOnly) {
  // Only raster cost is reduced; source UI rectangles, camera and input remain unchanged.
  for(const page of [a,b])await evaluate(page,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1],{EngineStore}=await import(url),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world'));engine.setHardwareScalingLevel(8);engine.resize()})()`);
  for(let i=0;i<2;i++){await click(a,'[data-add-cpu]');await waitUntil(a,`(${worldExpression}).players.length===${i+3}`);}
  for(const page of [a,b]){await waitUntil(page,`window.roomWhisperBattle?.players.resourcesReady`);await click(page,'[data-waiting-ready]');}
  for(const page of [a,b])await waitUntil(page,`(${worldExpression}).phase==='PLAYING'&&(${worldExpression}).renderedPlayers===4`);
  if(!cleanupOnly) {
  evidence.playing=await roomWorld(a);
  await send('战斗原密语按钮','私聊乙','PLAYING');
  await waitUntil(a,`(${worldExpression}).phase==='FINISHED'`);await waitUntil(b,`(${worldExpression}).phase==='FINISHED'`);
  evidence.finished=await roomWorld(a);assert.equal(evidence.finished.match.result.reason,'TIME_LIMIT');
  await send('结算仍可密语','私聊乙','FINISHED');
  await privateGeometry();
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},a);
  for(const page of [a,b])await click(page,'[data-rematch]');
  for(const page of [a,b])await waitUntil(page,`(${worldExpression}).match.round===2&&(${worldExpression}).phase==='PLAYING'`);
  await send('再战新局密语','私聊乙','round2');
  }else {await waitUntil(a,`(${worldExpression}).phase==='FINISHED'`);await privateMode(a);await privateGeometry();}
  if(cleanupOnly) {
    await input(a,'[data-chat-input]','目标候选确认文本');await click(a,'[data-chat-whisper-target]');
    const from=network.length;await command('Input.imeSetComposition',{text:'私聊',selectionStart:2,selectionEnd:2},a);await press(a,'Enter','Enter');await pause(200);
    assert.equal(network.slice(from).filter(e=>e.name==='RoomWhisper'&&e.direction==='sent').length,0);
    await command('Input.insertText',{text:'私聊'},a);await input(a,'[data-chat-whisper-target]','私聊乙');await input(a,'[data-chat-input]','目标输入法后正常密语');
    await press(a,'Enter','Enter');await waitUntil(a,`document.querySelector('[data-chat-input]').value===''`);
    await waitUntil(b,`${roomRows}.some(t=>t.includes('目标输入法后正常密语'))`);
    evidence.checks.push({name:'target IME candidate Enter sends nothing; committed name and normal message Enter reach target',requests:network.slice(from).filter(e=>e.name==='RoomWhisper')});
  }
  }else {await privateMode(a);}
  await input(a,'[data-chat-input]','离开草稿');await click(a,exitOnly?'[data-waiting-close]':'[data-leave-room]');await waitUntil(a,`document.querySelector('[data-lobby-chat-input]')`);
  await joinRoom(a,roomId);await waitUntil(a,`document.querySelector('[data-chat-input]')&&document.querySelector('[data-chat-log]')`);assert.equal(await evaluate(a,`document.querySelector('[data-chat-input]').value`),'');
  assert.equal(await evaluate(a,`document.querySelector('[data-chat-whisper-target]')===null`),true);
  assert.deepEqual(await evaluate(a,roomRows),[]);evidence.checks.push({name:'ordinary Leave/rejoin clears channel target draft and logs'});
  assert.equal(network.filter(e=>e.name==='PlayerInput'&&e.direction==='sent'&&e.payload?.fire).length,0);
  await stop(server);for(const page of [a,b])await waitUntil(page,`document.querySelector('#battle-status')?.value.includes('断开')||document.querySelector('.battle-chat [role=status]')?.textContent.includes('断开')`);
  evidence.checks.push({name:'actual disconnect visible; focused IME/chat sends no fire'});
  evidence.network=network;evidence.noInjectedState=true;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  console.log('PASS actual three-page room whisper lifecycle '+output);
  }
} catch(error) {
  await writeFile(output+'.json',JSON.stringify({...evidence,status:'FAIL',error:String(error),serverLog,network},null,2)+'\n');throw error;
} finally {
  if(ws?.readyState===WebSocket.OPEN){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true});
}
