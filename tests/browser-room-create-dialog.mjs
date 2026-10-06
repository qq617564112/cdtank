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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3194', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-create-dialog-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-02-CR original room-create dialog and ordinary authoritative create/join.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  await key(session, value, code, 'keyUp');
}
async function screenshot(session, name) {
  const result = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`${output}-${name}.png`, Buffer.from(result.data, 'base64'));
}
const output = 'recovery/output/browser-room-create-dialog';
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5229'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3194', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9299', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9299/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['CreateRoom', 'Join', 'ListRooms', 'ListMaps', 'RoomSnapshot'].includes(result.service.name)) {
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
const modal = 'dialog[data-room-create-dialog]';
const nameInput = '[data-room-create-name]';
const passwordInput = '[data-room-create-password]';
const control = name => `${modal} [data-source-control="${name}"]`;
const worldExpression = `JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')`;
const form = session => evaluate(session, `({mode:Number(document.querySelector('#room-mode').value),map:Number(document.querySelector('#room-map').value),min:Number(document.querySelector('#room-min-players').value),max:Number(document.querySelector('#room-max-players').value),name:document.querySelector('#room-name').value,password:document.querySelector('#create-password').value,friendlyFire:document.querySelector('#room-friendly-fire').checked})`);
const modalState = session => evaluate(session, `(()=>{const d=document.querySelector('${modal}');return {open:!!d?.open,name:d?.querySelector('${nameInput}')?.value,password:d?.querySelector('${passwordInput}')?.value,min:Number(d?.querySelector('[data-source-control="txtLowBound"]')?.textContent),max:Number(d?.querySelector('[data-source-control="txtHighBound"]')?.textContent),friendlyFire:d?.querySelector('[data-room-create-friendly="true"]')?.getAttribute('aria-pressed')==='true',status:d?.querySelector('[data-room-create-status]')?.textContent,focused:document.activeElement?.dataset.sourceControl}})()`);
async function input(session, selector, value) {
  await click(session, selector);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},session);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},session);
  await command('Input.insertText',{text:String(value)},session);
}
async function open(session) {
  await click(session,'#open-room-create-dialog');
  await waitUntil(session,`document.querySelector('${modal}')?.open&&document.querySelector('[data-room-create-confirm]')`);
}
async function keyboardActivate(session,selector) {
  for(let step=0;step<35;step++) {
    if(await evaluate(session,`document.activeElement?.matches(${JSON.stringify(selector)})`)) {await press(session,'Enter','Enter');return;}
    await press(session,'Tab','Tab');
  }
  throw new Error('Keyboard could not reach '+selector);
}
async function verifySource(session,width,height) {
  const result=await evaluate(session,`(async()=>{
    const ui=await(await fetch('/ui.json')).json(),d=document.querySelector('${modal}'),layout=ui.layouts.find(l=>l.path==='ui/layouts/createroom.xml');
    function absolute(w){const n=w.properties.AbsoluteRect.match(/-?[\\d.]+/g).map(Number);let left=n[0],top=n[1];for(let p=w.parent;p;){const a=layout.windows.find(w=>w.name===p),b=a.properties.AbsoluteRect.match(/-?[\\d.]+/g).map(Number);left+=b[0];top+=b[1];p=a.parent;}return {left:left-248+2,top:top-140+10,width:n[2]-n[0],height:n[3]-n[1]};}
    function asset(reference){const m=/^set:(\\S+) image:(.+)$/.exec(reference),sets=ui.imagesets.filter(s=>s.attributes.Name===m[1]),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return set.images.find(i=>i.Name===m[2]).asset;}
    const rows=layout.windows.filter(w=>!['all','zhezhaoditu','heseditu','quxiaoditu'].includes(w.name)&&(!w.name.startsWith('rdoNonCat')||!!d.querySelector('[data-source-control="rdoNonCatVsDog"]'))&&(!w.name.startsWith('rdoCat')||!!d.querySelector('[data-source-control="rdoCatVsDog"]'))).map(w=>{const e=d.querySelector('[data-source-control="'+w.name+'"]');if(!e)throw new Error('Missing '+w.name);const r=e.getBoundingClientRect();return {name:w.name,native:{left:parseFloat(e.style.left),top:parseFloat(e.style.top),width:parseFloat(e.style.width),height:parseFloat(e.style.height)},expected:absolute(w),rect:{x:r.x,y:r.y,width:r.width,height:r.height},background:getComputedStyle(e).backgroundImage,asset:e.dataset.sourceAsset,references:Object.entries(w.properties).filter(([key,value])=>key.endsWith('Image')&&value.startsWith('set:')).map(([key,reference])=>({key,reference,asset:asset(reference)}))};});
    const assets=[...new Set(rows.flatMap(r=>r.references.map(a=>a.asset)))],decoded=await Promise.all(assets.map(path=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve({asset:path,width:i.naturalWidth,height:i.naturalHeight});i.onerror=()=>reject(new Error(path));i.src='/'+path;})));
    const stage=d.querySelector('[data-room-create-stage]');return {rows,decoded,stage:{width:parseFloat(getComputedStyle(stage).width),height:parseFloat(getComputedStyle(stage).height)},name:{type:d.querySelector('${nameInput}').type,maxLength:d.querySelector('${nameInput}').maxLength},password:{type:d.querySelector('${passwordInput}').type,maxLength:d.querySelector('${passwordInput}').maxLength}};
  })()`);
  for(const row of result.rows) {
    assert.deepEqual(row.native,row.expected,row.name+' sheet-normalized rectangle');
    const r=row.rect;assert(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height,row.name+' visible');
    if(row.references.some(a=>a.key==='Image')&&row.name!=='picGameMode')assert(row.background.includes('/'+row.references.find(a=>a.key==='Image').asset),row.name+' source image');
  }
  assert.deepEqual(result.name,{type:'text',maxLength:32});assert.deepEqual(result.password,{type:'password',maxLength:64});
  assert.deepEqual(result.stage,{width:310,height:328});
  assert(result.decoded.every(i=>i.width>0&&i.height>0));
  evidence.checks.push({name:`original control geometry, source PNG decoding and masked password at ${width}x${height}`,result});
  return result;
}
async function verifyButtonImages(session,source) {
  const row=source.rows.find(r=>r.name==='btnOK'),selector=control('btnOK');
  const point=await evaluate(session,`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},session);
  let image=await evaluate(session,`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).backgroundImage`);
  assert(image.includes('/'+row.references.find(r=>r.key==='HoverImage').asset));
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point},session);
  image=await evaluate(session,`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).backgroundImage`);
  assert(image.includes('/'+row.references.find(r=>r.key==='PushedImage').asset));
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x-100,y:point.y-80},session);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:point.x-100,y:point.y-80},session);
  evidence.checks.push({name:'OK native hover and held pointer use original HoverImage/PushedImage'});
}
try {
  await launchServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5229,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3194',ws:true,rewrite:()=> '/'}}}});
  await vite.listen();await launchBrowser();
  const page=await newPage(),maps=network.find(r=>r.page===page&&r.name==='ListMaps'&&r.direction==='received').response.maps;
  await click(page,'#create-room-controls > summary');
  await input(page,'#player-name','创建房主');
  await input(page,'#room-name','外层房间');await input(page,'#create-password','outer-pass');
  const initial=await form(page);
  await open(page);let state=await modalState(page);
  assert.equal(state.name,initial.name);assert.equal(state.password,initial.password);assert.equal(state.min,initial.min);assert.equal(state.max,initial.max);
  const source=await verifySource(page,1920,1080);await verifyButtonImages(page,source);await screenshot(page,'1080p');
  await input(page,nameInput,'取消草稿');await input(page,passwordInput,'cancel-pass');
  await click(page,'[data-room-create-low="1"]');await click(page,'[data-room-create-friendly="true"]');
  await keyboardActivate(page,'[data-room-create-cancel]');assert.equal((await modalState(page)).open,false);assert.deepEqual(await form(page),initial);
  assert(await evaluate(page,`document.activeElement?.id==='open-room-create-dialog'`), await evaluate(page,`document.activeElement?.outerHTML`));
  await open(page);await input(page,nameInput,'Esc草稿');await press(page,'Escape','Escape');assert.deepEqual(await form(page),initial);
  await open(page);await input(page,passwordInput,'close-pass');await click(page,'[data-room-create-close]');assert.deepEqual(await form(page),initial);
  evidence.checks.push({name:'cancel button by native keyboard, Escape and original close preserve ordinary form and restore launcher focus',initial});
  await select(page,'#room-mode',4);await open(page);
  assert(await evaluate(page,`document.querySelector('[data-room-create-friendly="true"]').disabled`));
  assert.equal((await modalState(page)).friendlyFire,false);await press(page,'Escape','Escape');
  await select(page,'#room-mode',1);
  const outer=await form(page),chosen=maps.find(m=>m.mapId===outer.map);
  assert(chosen);await open(page);
  for(let i=0;i<chosen.maxPlayers+2;i++)await click(page,'[data-room-create-low="1"]');
  state=await modalState(page);assert.equal(state.min,state.max);assert(state.max<=chosen.maxPlayers);
  assert(await evaluate(page,`document.querySelector('[data-room-create-low="1"]').disabled`));
  for(let i=0;i<chosen.maxPlayers+2;i++)await click(page,'[data-room-create-low="-1"]');
  state=await modalState(page);assert.equal(state.min,chosen.sourceMinPlayers);
  for(let i=0;i<chosen.maxPlayers+2;i++)await click(page,'[data-room-create-high="-1"]');
  state=await modalState(page);assert.equal(state.max,state.min);
  for(let i=0;i<chosen.maxPlayers+2;i++)await click(page,'[data-room-create-high="1"]');
  state=await modalState(page);assert.equal(state.max,chosen.maxPlayers);
  await keyboardActivate(page,'[data-room-create-low="1"]');
  state=await modalState(page);assert.equal(state.min,Math.min(chosen.sourceMinPlayers+1,state.max));
  await click(page,'[data-room-create-friendly="true"]');
  state=await modalState(page);assert.equal(state.friendlyFire,true);
  const check=source.rows.find(r=>r.name==='rdoFriendlyFireOn').references.find(r=>r.key==='CheckMarkImage').asset;
  assert((await evaluate(page,`getComputedStyle(document.querySelector('[data-room-create-friendly="true"]')).backgroundImage`)).includes('/'+check));
  evidence.checks.push({name:'native arrows clamp to real map limits and min≤max; keyboard increment retains focus; friendly-fire source checkmark',chosen,state});
  await input(page,nameInput,'原版创建房间');await input(page,passwordInput,'reject\tpass');
  assert.equal((await modalState(page)).password,'reject\tpass','native password insertion preserves server-rejected tab');
  const draft=await modalState(page),refusedFrom=network.length;
  await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},page);
  await verifySource(page,3840,2160);await screenshot(page,'4k');
  await keyboardActivate(page,'[data-room-create-confirm]');
  await waitUntil(page,`document.querySelector('[data-room-create-status]').textContent.length>0&&!document.querySelector('[data-room-create-confirm]').disabled`);
  const rejected=network.slice(refusedFrom).find(r=>r.page===page&&r.name==='CreateRoom'&&r.direction==='received');
  assert.equal(rejected?.success,false,JSON.stringify(rejected));assert.equal(rejected.response.code,'ROOM_CONFLICT');
  state=await modalState(page);assert(state.open);for(const field of ['name','password','min','max','friendlyFire'])assert.equal(state[field],draft[field]);
  assert.equal(await evaluate(page,worldExpression),null);assert.deepEqual(await form(page),outer);
  assert(await evaluate(page,`document.activeElement?.matches('${passwordInput}')`),'rejected password field focus');
  evidence.checks.push({name:'real CreateRoom tab-password server refusal retains all dialog drafts and focuses rejected field',draft,rejected,state});await screenshot(page,'4k-rejected');
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},page);
  await input(page,passwordInput,'create-pass');const from=network.length;await click(page,'[data-room-create-confirm]');
  await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'&&!document.querySelector('${modal}')?.open`);
  assert.equal((await modalState(page)).open,false);
  const ownerWorld=await evaluate(page,worldExpression),request=network.slice(from).find(r=>r.page===page&&r.name==='CreateRoom'&&r.direction==='sent'),response=network.slice(from).find(r=>r.page===page&&r.name==='CreateRoom'&&r.direction==='received');
  assert(response?.success,JSON.stringify(response));assert.equal(request.payload.roomName,draft.name);assert.equal(request.payload.password,'create-pass');assert.equal(request.payload.minPlayers,draft.min);assert.equal(request.payload.maxPlayers,draft.max);assert.equal(request.payload.friendlyFire,true);
  assert.equal(ownerWorld.mapId,chosen.mapId);assert.equal(ownerWorld.mode,1);assert.equal(ownerWorld.match.minPlayers,draft.min);assert.equal(ownerWorld.match.maxPlayers,draft.max);assert.equal(ownerWorld.match.friendlyFire,true);
  evidence.checks.push({name:'corrected draft uses ordinary CreateRoom and enters authoritative WAITING with selected limits and friendly fire',request,response,world:ownerWorld});await screenshot(page,'1080p-waiting');
  const {browserContextId}=await command('Target.createBrowserContext');const peer=await newPage(browserContextId);
  await input(peer,'#player-name','创建访客');await click(peer,'#refresh-rooms');await waitUntil(peer,`[...document.querySelector('#room').options].some(o=>o.value===${JSON.stringify(ownerWorld.roomId)})&&!document.querySelector('#refresh-rooms').disabled`);await select(peer,'#room',ownerWorld.roomId);await input(peer,'#join-password','wrong-pass');
  const peerFrom=network.length;await click(peer,'#join');
  await waitUntil(peer,`document.querySelector('#battle-status').value.includes('密码')&&!document.querySelector('#join').disabled`);
  const wrong=network.slice(peerFrom).find(r=>r.page===peer&&r.name==='Join'&&r.direction==='received');assert.equal(wrong?.success,false);assert.equal(wrong.response.code,'ROOM_JOIN_REJECTED');assert.equal(await evaluate(peer,worldExpression),null);
  await input(peer,'#join-password','create-pass');await click(peer,'#join');
  await waitUntil(peer,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);
  const peerWorld=await evaluate(peer,worldExpression);assert.equal(peerWorld.roomId,ownerWorld.roomId);assert.equal(peerWorld.match.minPlayers,draft.min);assert.equal(peerWorld.match.maxPlayers,draft.max);assert.equal(peerWorld.match.friendlyFire,true);
  evidence.checks.push({name:'second ordinary browser wrong password rejects; correct password joins same authoritative WAITING room',wrong,world:peerWorld});
  await click(peer,'#leave');await click(page,'#leave');
  evidence.status='PASS';await rm(`${output}-failure.png`,{force:true});console.log('PASS: original room-create controls/PNG geometry, native cancel/limits/friendly fire, real server refusal, ordinary create and password join, 1080p/4K');
} catch(error) {
  evidence.status='FAIL';evidence.error=error.stack??String(error);const session=pages[0]?.sessionId;
  if(session){evidence.failureFocus=await evaluate(session,`document.activeElement?.outerHTML`).catch(()=>null);evidence.failureState=await modalState(session).catch(()=>null);evidence.failureStatus=await evaluate(session,`document.querySelector('#battle-status')?.value`).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
} finally {
  if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.isolation={server:3194,vite:5229,chrome:9299};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;
  await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);
}
