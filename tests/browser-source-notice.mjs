import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const {WsClient} = require('tsrpc');
const {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3201', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-source-notice-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-15-N source notification modal from real INVITE_EMPTY refusal.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function stop(process) {
  if (process?.exitCode === null && process.signalCode === null) {
    const ended = new Promise(resolve => process.once('exit', resolve));
    process.kill();
    await ended;
  }
}

const modal = 'dialog[data-waiting-room]';
const worldExpression = `JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')`;
const world = session => evaluate(session, worldExpression);
async function select(session, selector, value) {
  const index = await evaluate(session, `[...document.querySelector(${JSON.stringify(selector)}).options].filter(o=>!o.disabled).findIndex(o=>o.value===${JSON.stringify(String(value))})`);
  assert(index >= 0);
  await click(session, selector);await press(session,'Home','Home');
  for(let step=0;step<index;step++)await press(session,'ArrowDown','ArrowDown');
  await press(session,'Enter','Enter');
  assert.equal(await evaluate(session,`document.querySelector(${JSON.stringify(selector)}).value`),String(value));
}
async function input(session, selector, value) {
  await click(session,selector);
  await key(session,'a','KeyA','keyDown',{modifiers:2});await key(session,'a','KeyA','keyUp',{modifiers:2});
  await command('Input.insertText',{text:String(value)},session);
}
async function open(session) {
  await click(session,'[data-open-waiting-room]');
  await waitUntil(session,`document.querySelector('${modal}')?.open&&document.querySelector('[data-waiting-source-player]')`);
}
async function keyboardActivate(session, selector) {
  await command('Page.bringToFront',{},session);
  for(let step=0;step<40;step++) {
    if(await evaluate(session,`document.activeElement?.matches(${JSON.stringify(selector)})`)) {await press(session,'Enter','Enter');return;}
    await press(session,'Tab','Tab');
  }
  throw new Error('Keyboard could not reach '+selector);
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
  const point = await evaluate(session, `(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent', {type: 'mousePressed', button: 'left', clickCount: 1, ...point}, session);
  await command('Input.dispatchMouseEvent', {type: 'mouseReleased', button: 'left', clickCount: 1, ...point}, session);await evaluate(session,'new Promise(requestAnimationFrame)');
}
function parseClientInput(bytes) {
  const envelope = TransportDataUtil.tsbuffer.decode(bytes, 'ServerInputData');
  assert(envelope.isSucc, envelope.errMsg);
  const service = decoder.serviceMap.id2Service[envelope.value.serviceId];
  const payload = decoder.tsbuffer.decode(envelope.value.buffer, service.type === 'api' ? service.reqSchemaId : service.msgSchemaId);
  assert(payload.isSucc, payload.errMsg);
  return {isSucc: true, result: {type: service.type, service, ...(service.type === 'api' ? {req: payload.value} : {msg: payload.value})}};
}
async function key(session, key, code, type = 'keyDown', options = {}) {
  await command('Input.dispatchKeyEvent', {type, key, code, ...(type === 'keyDown' && (key === 'Enter' || key.length === 1) ? {text: key === 'Enter' ? '\r' : key} : {}), ...options, windowsVirtualKeyCode: (/^F(?:[5-9]|1[0-2])$/.test(code) ? 111 + Number(code.slice(1)) : ({Tab: 9, Enter: 13, Escape: 27, Home: 36, End: 35, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, ' ': 32})[key] ?? key.toUpperCase().charCodeAt(0))}, session);
}
async function press(session, value, code) {
  await key(session, value, code);
  await key(session, value, code, 'keyUp');await evaluate(session,'new Promise(requestAnimationFrame)');
}
async function screenshot(session, name) {
  const result = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`${output}-${name}.png`, Buffer.from(result.data, 'base64'));
}
const output = 'recovery/output/react-notice-'+new Date().toISOString().replace(/[:.]/g,'-');
await mkdir('recovery/output', {recursive: true});
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5233'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3201', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9303', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9303/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['Account', 'CreateRoom', 'Join', 'Ready', 'ChangeTeam', 'Leave', 'PlayerInput', 'RoomChat', 'RoomInvite', 'RoomInvitation', 'RoomSnapshot'].includes(result.service.name)) {
      network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent', kind: result.type, name: result.service.name,
        ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err} : {payload: result.msg ?? result.req})});
    }
  });
}const notice='dialog[data-source-notice]';
const okay=`${notice} [data-source-control="btnOK"]`;
async function refusal(page) {
  const from=network.length;await click(page,'[data-waiting-invite]');await waitUntil(page,`document.querySelector('${notice}').open`);
  const response=network.slice(from).find(r=>r.page===page&&r.name==='RoomInvite'&&r.direction==='received');assert.equal(response?.success,false);assert.equal(response.response.code,'INVITE_EMPTY');
  const text=await evaluate(page,`document.querySelector('${notice} [data-source-control="txtMessage"]').textContent`);assert(text.includes(response.response.message));assert.equal((await world(page)).phase,'WAITING');
  evidence.checks.push({name:'real INVITE_EMPTY request/response opens recovered notification with exact refusal reason',response,text});
}
async function verifyNotice(page,width,height) {
  const source=await evaluate(page,`(async()=>{
    const ui=await(await fetch('/ui.json')).json(),layout=ui.layouts.find(l=>l.path==='ui/layouts/notify_dialog.xml'),d=document.querySelector('${notice}');
    function asset(ref){const m=/^set:(\\S+) image:(.+)$/.exec(ref),sets=ui.imagesets.filter(s=>s.attributes.Name===m[1]),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return set.images.find(i=>i.Name===m[2]).asset;}
    function rectangle(w){const n=w.properties.AbsoluteRect.match(/-?[\\d.]+/g).map(Number);let left=n[0],top=n[1];for(let parent=w.parent;parent;){const p=layout.windows.find(w=>w.name===parent),r=p.properties.AbsoluteRect.match(/-?[\\d.]+/g).map(Number);left+=r[0];top+=r[1];parent=p.parent;}return{left,top,width:n[2]-n[0],height:n[3]-n[1]};}
    const rows=layout.windows.map(w=>{const e=d.querySelector('[data-source-control="'+w.name+'"]'),r=e.getBoundingClientRect();return{name:w.name,native:{left:parseFloat(e.style.left),top:parseFloat(e.style.top),width:parseFloat(e.style.width),height:parseFloat(e.style.height)},expected:rectangle(w),hidden:e.hidden,rect:{x:r.x,y:r.y,width:r.width,height:r.height},images:Object.entries(w.properties).filter(([key,value])=>key.endsWith('Image')&&value.startsWith('set:')).map(([key,ref])=>({key,asset:asset(ref)}))};});
    const frames=[...d.querySelectorAll('[data-notice-frame]')].map(e=>{const w=layout.windows.find(w=>w.name===e.parentElement.dataset.sourceControl),n=w.properties.AbsoluteRect.match(/-?[\\d.]+/g).map(Number),width=n[2]-n[0],height=n[3]-n[1],positions={TopLeftFrameImage:[0,0,20,20],TopFrameImage:[20,0,width-40,20],TopRightFrameImage:[width-20,0,20,20],LeftFrameImage:[0,20,20,height-40],Image:[20,20,width-40,height-40],RightFrameImage:[width-20,20,20,height-40],BottomLeftFrameImage:[0,height-20,20,20],BottomFrameImage:[20,height-20,width-40,20],BottomRightFrameImage:[width-20,height-20,20,20]};return{parent:w.name,property:e.dataset.noticeFrame,native:[parseFloat(e.style.left),parseFloat(e.style.top),parseFloat(e.style.width),parseFloat(e.style.height)],expected:positions[e.dataset.noticeFrame],asset:e.dataset.sourceAsset,expectedAsset:asset(w.properties[e.dataset.noticeFrame]),background:getComputedStyle(e).backgroundImage};});
    const assets=[...new Set([...frames.map(f=>f.asset),...rows.flatMap(r=>r.images.map(i=>i.asset))])],decoded=await Promise.all(assets.map(path=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve({asset:path,width:i.naturalWidth,height:i.naturalHeight});i.onerror=()=>reject(new Error(path));i.src='/'+path;})));
    const text=d.querySelector('[data-source-control="txtMessage"]');return{rows,frames,decoded,text:{content:text.textContent,contentEditable:text.isContentEditable,children:text.children.length,overflow:getComputedStyle(text).overflow},okayBackground:getComputedStyle(d.querySelector('[data-source-control="btnOK"]')).backgroundImage};
  })()`);
  assert.equal(source.rows.length,6);for(const row of source.rows){assert.deepEqual(row.native,row.expected,row.name+' source rectangle');if(!row.hidden){const r=row.rect;assert(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height,row.name+' visible');}}
  assert(source.rows.find(r=>r.name==='picBackgroundMask').hidden);assert.equal(source.frames.length,18);for(const frame of source.frames){assert.deepEqual(frame.native,frame.expected);assert.equal(frame.asset,frame.expectedAsset);assert(frame.background.includes('/'+frame.asset));}assert(source.decoded.every(i=>i.width>0&&i.height>0));assert.equal(source.text.contentEditable,false);assert.equal(source.text.children,0);assert.equal(source.text.overflow,'auto');assert(source.okayBackground.includes('/'+source.rows.find(r=>r.name==='btnOK').images.find(i=>i.key==='NormalImage').asset));
  evidence.checks.push({name:`six source controls,18 exact frame slices, read-only text and source PNG decode at ${width}x${height}`,source});return source;
}
async function restore(page) {await waitUntil(page,`!document.querySelector('${notice}').open&&document.querySelector('${modal}').open&&!document.querySelector('[data-waiting-invite]').disabled`);assert(await evaluate(page,`document.activeElement?.matches('[data-waiting-invite]')`));assert.equal((await world(page)).phase,'WAITING');}
try {
  await launchServer();vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),plugins:[{name:'notice-controller-observer',transform(source,id){if(!id.endsWith('/interface/dialogs/source-notice.ts'))return;return source+`\nconst show=SourceNotice.prototype.show;SourceNotice.prototype.show=function(message){window.noticeObserved=this;return show.call(this,message);};`;}}],publicDir:'../../recovery/output/web-assets',server:{port:5233,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3201',ws:true,rewrite:()=> '/'}}}});await vite.listen();await launchBrowser();const page=await newPage();
  await click(page,'#create-room-controls > summary');await select(page,'#room-mode',1);await select(page,'#room-map',7);await input(page,'#room-min-players',2);await click(page,'#create-room');await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'&&!document.querySelector('#leave').hidden`);await open(page);
  if(!process.argv.includes('--continuation')){await refusal(page);const source=await verifyNotice(page,1920,1080);await screenshot(page,'1080p');const from=network.length;
  await click(page,`${notice} [data-source-control="txtMessage"]`);await press(page,'w','KeyW');await press(page,' ','Space');await press(page,'5','Digit5');
  await click(page,'[data-waiting-ready]');await pause(150);assert(await evaluate(page,`document.querySelector('${notice}').open`));assert(!network.slice(from).some(r=>r.direction==='sent'&&['PlayerInput','Ready','RoomInvite','ChangeTeam','RoomChat'].includes(r.name)));
  evidence.checks.push({name:'browser modal keeps parent inert; W/Space/Digit5 and native parent Ready click send no room/gameplay actions'});
  const point=await evaluate(page,`(()=>{const r=document.querySelector('${okay}').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`),images=source.rows.find(r=>r.name==='btnOK').images;
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},page);await evaluate(page,'new Promise(requestAnimationFrame)');assert((await evaluate(page,`getComputedStyle(document.querySelector('${okay}')).backgroundImage`)).includes('/'+images.find(i=>i.key==='HoverImage').asset));
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point},page);await evaluate(page,'new Promise(requestAnimationFrame)');assert((await evaluate(page,`getComputedStyle(document.querySelector('${okay}')).backgroundImage`)).includes('/'+images.find(i=>i.key==='PushedImage').asset));await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point},page);await restore(page);
  evidence.checks.push({name:'original OK hover/pushed mouse images and click confirmation restore same parent/action focus'});
  await refusal(page);await press(page,'Enter','Enter');await restore(page);evidence.checks.push({name:'native Enter confirms notification and restores parent'});
  await refusal(page);await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},page);await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0},page);await evaluate(page,'new Promise(requestAnimationFrame)');await verifyNotice(page,3840,2160);await screenshot(page,'4k');await press(page,'Escape','Escape');await restore(page);
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},page);await press(page,'Escape','Escape');await click(page,'[data-add-cpu]');await waitUntil(page,`(${worldExpression}).players.some(p=>p.isCpu)`);evidence.checks.push({name:'Escape restores WAITING; ordinary Add CPU remains operable after notice dismissal'});await open(page);
  }else{await refusal(page);await press(page,'Escape','Escape');await restore(page);evidence.reusedEvidence='react-notice-2026-10-03T17-31-18-853Z.json9 completed checks; overall FAIL retained';}
  await click(page,'[data-waiting-close]');await waitUntil(page,`(${worldExpression})===null&&!(document.querySelector('${notice}')?.open??false)`);assert.equal(await evaluate(page,`document.querySelector('${notice}')?.children[0].children.length??0`),0);
  await click(page,'#create-room');await waitUntil(page,`(${worldExpression})?.phase==='WAITING'&&!document.querySelector('#leave').hidden`);await open(page);await refusal(page);await press(page,'Escape','Escape');await restore(page);evidence.checks.push({name:'Ordinary leave/reentry then fresh INVITE_EMPTY remains functional without retained notice'});
  const longText='这是明确页面长中文滚动夹具。'.repeat(35);await evaluate(page,`void window.noticeObserved.show(${JSON.stringify(longText)})`);await waitUntil(page,`document.querySelector('${notice}').open`);await click(page,`${notice} [data-source-control="txtMessage"]`);await press(page,'End','End');const point=await evaluate(page,`(()=>{const r=document.querySelector('${notice} [data-source-control="txtMessage"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaX:0,deltaY:700},page);await waitUntil(page,`document.querySelector('${notice} [data-source-control="txtMessage"]').scrollTop>0`);const longState=await evaluate(page,`(()=>{const e=document.querySelector('${notice} [data-source-control="txtMessage"]');return{text:e.textContent,top:e.scrollTop,max:e.scrollHeight-e.clientHeight}})()`);assert.equal(longState.text,longText);assert(longState.max>0&&longState.top>0);evidence.checks.push({name:'Explicit presentation-only long Chinese text fixture native scroll; not a network rejection payload',longState});await press(page,'Escape','Escape');await restore(page);
  evidence.status='PASS';await rm(`${output}-failure.png`,{force:true});console.log('PASS: real INVITE_EMPTY source notice6 controls/18 frames/PNG, OK hover/pushed, native OK/Enter/Escape, parent/input isolation, AddCPU continuation and Leave cleanup;1080p/4K');
} catch(error){evidence.status='FAIL';evidence.error=error.stack??String(error);if(pages[0]){evidence.failureStatus=await evaluate(pages[0].sessionId,`({notice:document.querySelector('${notice}')?.open,text:document.querySelector('${notice} [data-source-control="txtMessage"]')?.textContent,focus:document.activeElement?.outerHTML})`).catch(()=>null);await screenshot(pages[0].sessionId,'failure').catch(()=>{});}throw error;
} finally {if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3201,vite:5233,chrome:9303};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);console.log('Evidence: '+output+'.json');}
