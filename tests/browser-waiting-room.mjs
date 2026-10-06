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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3192', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-waiting-room-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-03-W source waiting-room dialog with two independent normal webpages, authoritative roster, ready/cancel and team changes.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
async function roster(session) {
  return evaluate(session,`[...document.querySelectorAll('${modal} [data-waiting-source-player]')].map(e=>({id:e.dataset.waitingSourcePlayer,team:Number(e.dataset.team),name:document.querySelector('${modal} [data-source-control="txtPlayerName'+e.dataset.sourceControl.slice(11)+'"]')?.textContent,ready:e.dataset.waitingPlayerReady,text:e.getAttribute('aria-label'),readyIconHidden:document.querySelector('${modal} [data-source-control="picReady'+e.dataset.sourceControl.slice(11)+'"]')?.hidden}))`);
}
async function verifyRoster(sessions) {
  const states=[];
  for(const session of sessions) {
    const snapshot=await world(session), rows=await roster(session);
    assert.equal(rows.length,snapshot.players.length);
    for(const player of snapshot.players) {
      const row=rows.find(row=>row.id===player.id);assert(row,'source card for '+player.id);
      assert.equal(row.team,player.team);assert.equal(row.name,player.name);
      assert.equal(row.ready,String(snapshot.match.readyPlayerIds.includes(player.id)));
      assert(row.text.includes(player.name));assert.equal(row.readyIconHidden,!snapshot.match.readyPlayerIds.includes(player.id));
    }
    states.push({session,snapshot,rows});
  }
  evidence.checks.push({name:'Both source rosters match authoritative names, teams and ready IDs',states});
}
async function verifySource(session,width,height) {
  const source=await evaluate(session,`(async()=>{
    const ui=await(await fetch('/ui.json')).json(),layout=ui.layouts.find(l=>l.path==='ui/layouts/room_main.xml');
    const d=document.querySelector('${modal}'),stage=d.querySelector('[data-waiting-room-stage]');
    function rectangle(w){const n=w.properties.AbsoluteRect.match(/-?[\\d.]+/g).map(Number);let left=n[0],top=n[1];for(let parent=w.parent;parent;){const owner=layout.windows.find(w=>w.name===parent),r=owner.properties.AbsoluteRect.match(/-?[\\d.]+/g).map(Number);left+=r[0];top+=r[1];parent=owner.parent;}return {left,top,width:n[2]-n[0],height:n[3]-n[1]};}
    function asset(ref){const m=/^set:(\\S+) image:(.+)$/.exec(ref);const sets=ui.imagesets.filter(s=>s.attributes.Name===m[1]),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return set.images.find(i=>i.Name===m[2]).asset;}
    const rows=[...stage.querySelectorAll('[data-source-control]')].map(e=>{const name=e.dataset.sourceControl,w=layout.windows.find(w=>w.name===name);if(!w)return null;const r=e.getBoundingClientRect();return {name,parent:w.parent,expected:rectangle(w),native:{left:parseFloat(e.style.left),top:parseFloat(e.style.top),width:parseFloat(e.style.width),height:parseFloat(e.style.height)},asset:e.dataset.sourceAsset,reference:w.properties.Image,buttonReferences:['NormalImage','HoverImage','PushedImage','DisabledImage'].map(k=>w.properties[k]).filter(Boolean),background:getComputedStyle([...e.querySelectorAll('[data-room-button-image]')].at(-1)??e).backgroundImage,hidden:e.hidden,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};}).filter(Boolean);
    const assets=[...new Set(rows.map(r=>r.asset).filter(Boolean))];
    const decoded=await Promise.all(assets.map(path=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve({asset:path,width:i.naturalWidth,height:i.naturalHeight});i.onerror=()=>reject(new Error(path));i.src='/'+path;})));
    for(const row of rows){if(row.reference)row.expectedAsset=asset(row.reference);row.expectedButtonAssets=row.buttonReferences.map(asset);}
    const snapshot=JSON.parse(document.querySelector('#battle-status').dataset.world);const tanks=[...stage.querySelectorAll('[data-waiting-source-player]')].map(panel=>{const player=snapshot.players.find(p=>p.id===panel.dataset.waitingSourcePlayer),name='picPlayerTank'+panel.dataset.sourceControl.slice(11),node=stage.querySelector('[data-source-control="'+name+'"]'),reference='set:tanke0 image:'+['data','ui','tanke',String(player.tankId).padStart(3,'0')+'.tga'].join(String.fromCharCode(92));return {playerId:player.id,tankId:player.tankId,asset:node.dataset.sourceAsset,expectedAsset:asset(reference)};});return {rows,decoded,tanks};
  })()`);
  for(let index=0;index<12;index++)assert(source.rows.some(row=>row.name==='PlayerPanel'+index),'all 12 source slots');
  for(const row of source.rows) {
    assert.deepEqual(row.native,row.expected,row.name+' source rectangle');
    if(row.expectedAsset&&row.asset)assert.equal(row.asset,row.expectedAsset,row.name+' exact fixed image');
    if(row.expectedButtonAssets.length&&row.asset)assert(row.expectedButtonAssets.includes(row.asset),row.name+' exact button image');
    if(row.asset)assert(row.background.includes('/'+row.asset),row.name+' source background');
    if(!row.hidden&&row.rect.width&&row.rect.height)assert(row.rect.x>=0&&row.rect.y>=0&&row.rect.x+row.rect.width<=width&&row.rect.y+row.rect.height<=height,row.name+' on screen');
  }
  for(const tank of source.tanks){assert.equal(tank.asset,tank.expectedAsset,'recovered tank icon '+tank.tankId);const png=source.decoded.find(row=>row.asset===tank.asset);assert.equal(png.width,32);assert.equal(png.height,32);}
  assert(source.decoded.length>0&&source.decoded.every(row=>row.width>0&&row.height>0));
  evidence.checks.push({name:'room_main rectangles, exact raw fixed images and decoded PNG at '+width+'x'+height,source});
}
async function toggleReady(session,sessions,expected,keyboard=false) {
  const before=await world(session),from=network.length;
  if(keyboard)await keyboardActivate(session,'[data-waiting-ready]');else await click(session,'[data-waiting-ready]');
  for(const page of sessions)await waitUntil(page,`(${worldExpression}).match.readyPlayerIds.includes(${JSON.stringify(before.playerId)})===${expected}`);
  await waitUntil(session,`!document.querySelector('[data-waiting-ready]').disabled&&document.activeElement?.matches('[data-waiting-ready]')`);
  assert(await evaluate(session,`document.activeElement?.matches('[data-waiting-ready]')`),'Ready keeps native focus');
  const rows=network.slice(from).filter(row=>row.page===session&&row.name==='Ready');
  assert.equal(rows.filter(row=>row.direction==='sent').length,1);assert(rows.some(row=>row.direction==='received'&&row.success));
  assert(await evaluate(session,`document.querySelector('[data-waiting-team="0"]').disabled&&document.querySelector('[data-waiting-team="1"]').disabled`)==expected||!expected);
  evidence.checks.push({name:'Ordinary Ready '+expected+' confirmed by both snapshots',rows});await verifyRoster(sessions);
}
async function changeTeam(session,sessions,team,keyboard=false) {
  const before=await world(session);
  if(before.players.find(p=>p.id===before.playerId).team===team)return;
  const from=network.length;
  await waitUntil(session,`!document.querySelector('[data-waiting-team="${team}"]').disabled`);
  if(keyboard)await keyboardActivate(session,'[data-waiting-team="'+team+'"]');else await click(session,'[data-waiting-team="'+team+'"]');
  for(const page of sessions)await waitUntil(page,`(${worldExpression}).players.find(p=>p.id===${JSON.stringify(before.playerId)}).team===${team}`);
  await waitUntil(session,`document.querySelector('[data-waiting-team="${team}"]').disabled&&!document.querySelector('[data-waiting-team="${1-team}"]').disabled`);
  assert(await evaluate(session,`document.activeElement?.matches('[data-waiting-ready]')`),'confirmed disabled team selection moves native focus to Ready');
  const rows=network.slice(from).filter(row=>row.page===session&&row.name==='ChangeTeam');
  assert.equal(rows.filter(row=>row.direction==='sent').length,1);assert(rows.some(row=>row.direction==='received'&&row.success));
  evidence.checks.push({name:'Ordinary team '+team+' confirmed by both snapshots with current team disabled',rows});await verifyRoster(sessions);
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
const output = 'recovery/output/browser-waiting-room';
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5227'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3192', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9297', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9297/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['CreateRoom', 'Join', 'Ready', 'ChangeTeam', 'Leave', 'PlayerInput', 'RoomChat', 'RoomSnapshot'].includes(result.service.name)) {
      network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent', kind: result.type, name: result.service.name,
        ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err} : {payload: result.msg ?? result.req})});
    }
  });
}
try {
  await launchServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5227,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3192',ws:true,rewrite:()=> '/'}}}});
  await vite.listen();await launchBrowser();
  const sessions=[];
  for(const name of ['等待甲','等待乙']) {
    const {browserContextId}=await command('Target.createBrowserContext');
    const page=await newPage(browserContextId);sessions.push(page);await input(page,'#player-name',name);
  }
  const [a,b]=sessions;
  await click(a,'#create-room-controls > summary');await input(a,'#room-name','等待面板验收');
  await select(a,'#room-mode',1);await select(a,'#room-map',7);await input(a,'#room-min-players',2);
  await click(a,'#create-room');await waitUntil(a,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);
  const initial=await world(a);
  await click(b,'#refresh-rooms');await waitUntil(b,`[...document.querySelector('#room').options].some(o=>o.value===${JSON.stringify(initial.roomId)}&&!o.disabled)`);
  await select(b,'#room',initial.roomId);await click(b,'#join');
  for(const page of sessions)await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).players.length===2`);
  assert((await world(a)).players.every(player=>!player.isCpu));
  for(const page of sessions)await open(page);
  await verifyRoster(sessions);await verifySource(a,1920,1080);await screenshot(a,'1080p');await screenshot(b,'1080p-peer');
  await evaluate(a,`window.waitingPending=[];new MutationObserver(()=>window.waitingPending.push([...document.querySelectorAll('${modal} [data-waiting-ready],${modal} [data-waiting-team]')].map(e=>({control:e.dataset.waitingTeam??'ready',disabled:e.disabled})))).observe(document.querySelector('${modal}'),{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']})`);
  const isolationFrom=network.length;await press(a,'w','KeyW');await press(a,' ','Space');await press(a,'5','Digit5');await pause(300);
  const blocked=network.slice(isolationFrom).filter(row=>row.page===a&&row.direction==='sent'&&['PlayerInput','RoomChat','Ready','ChangeTeam'].includes(row.name));
  assert.equal(blocked.length,0,'WAITING dialog keyboard keys send no gameplay or room action');
  evidence.checks.push({name:'Actual WAITING W/Space/Digit5 input isolation',blocked});
  await toggleReady(a,sessions,true,true);await screenshot(a,'ready');await toggleReady(a,sessions,false);
  const originalTeam=(await world(a)).players.find(p=>p.id===initial.playerId).team;
  await changeTeam(a,sessions,1-originalTeam,true);await changeTeam(a,sessions,originalTeam);
  await changeTeam(b,sessions,1-originalTeam);
  await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},a);
  await verifySource(a,3840,2160);await screenshot(a,'4k');
  await press(a,'Escape','Escape');assert.equal(await evaluate(a,`document.querySelector('${modal}').open`),false);
  assert.equal((await world(a)).phase,'WAITING');assert.equal((await world(a)).players.length,2);
  assert(await evaluate(a,`document.activeElement?.matches('[data-open-waiting-room]')`),'close restores opener focus');
  await keyboardActivate(a,'[data-open-waiting-room]');await waitUntil(a,`document.querySelector('${modal}').open`);
  const pendingStates=await evaluate(a,'window.waitingPending');
  assert(pendingStates.some(state=>state.length===3&&state.every(control=>control.disabled)),'pending disables ready and both team controls');
  evidence.checks.push({name:'Pending gate and Escape/reopen retains WAITING with native focus',pendingStates});
  await toggleReady(a,sessions,true);
  await click(b,'[data-waiting-ready]');
  for(const page of sessions)await waitUntil(page,`(${worldExpression})?.phase==='PLAYING'&&!document.querySelector('${modal}')?.open`);
  evidence.playingWorlds=await Promise.all(sessions.map(world));
  assert(evidence.playingWorlds.every(value=>value.match.readyPlayerIds.length===2&&value.players.length===2&&value.players.every(p=>!p.isCpu)));
  evidence.checks.push({name:'Two ordinary Ready requests naturally enter PLAYING and auto-close both source dialogs'});
  await screenshot(a,'playing');
  for(const page of sessions) {
    await click(page,'#leave');await waitUntil(page,`(${worldExpression})===null&&!document.querySelector('${modal}')?.open`);
    assert.equal((await roster(page)).length,0,'leave clears source roster');
  }
  evidence.checks.push({name:'Ordinary Leave clears both source views and world state'});
  evidence.status='PASS';await rm(`${output}-failure.png`,{force:true});console.log('PASS: source waiting-room geometry/assets, two normal webpages, ready/cancel/team confirmation, pending/input isolation/native focus and natural PLAYING/Leave, 1080p/4K');
} catch(error) {
  evidence.status='FAIL';evidence.error=error.stack??String(error);
  const session=pages[0]?.sessionId;if(session){evidence.failureWorld=await world(session).catch(()=>null);evidence.failureFocus=await evaluate(session,`document.activeElement?.outerHTML`).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
} finally {
  if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.isolation={server:3192,vite:5227,chrome:9297};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;
  await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);
}
