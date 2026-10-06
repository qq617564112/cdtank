import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const {WsClient} = require('tsrpc');
const {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3338', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', continuation: process.argv.includes('--continuation'), scope: 'M5-04-R-F lobby and live battle friend source channel, IME/menu/focus and actual recipients.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  await waitUntil(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)return false;const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&r.height>0&&(e===hit||e.contains(hit))})()`);
  await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
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
async function key(session, key, code, type = 'keyDown', options = {}) {
  await command('Input.dispatchKeyEvent', {type, key, code, ...(type === 'keyDown' && (key === 'Enter' || key.length === 1) ? {text: key === 'Enter' ? '\r' : key} : {}), ...options, windowsVirtualKeyCode: (/^F(?:[5-9]|1[0-2])$/.test(code) ? 111 + Number(code.slice(1)) : ({Enter: 13, Escape: 27, Home: 36, End: 35, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, ' ': 32})[key] ?? key.toUpperCase().charCodeAt(0))}, session);
}
async function press(session, value, code) {
  await key(session, value, code);
  await key(session, value, code, 'keyUp');
}
async function screenshot(session, name) {
  const result = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`${output}-${name}.png`, Buffer.from(result.data, 'base64'));
}
const output = `recovery/output/browser-battle-play-page-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
await mkdir('recovery/output', {recursive: true});
const world = session => evaluate(session, worldExpression);
async function ready(session){await waitUntil(session,`document.querySelector('[data-lobby-background] [data-source-image]')&&document.querySelector('[data-room-card-id="R1"]')&&!document.querySelector('[data-room-card-create]').disabled`);}
async function newPage(browserContextId, width = 1920, height = 1080) {
  const {targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  pages.push({targetId, sessionId});
  await command('Network.enable', {}, sessionId);
  await command('Page.enable', {}, sessionId);
  await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false}, sessionId);
  await command('Page.navigate', {url: 'http://127.0.0.1:5364'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3338', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9564', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9564/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['Friends', 'FriendChat', 'Join', 'Ready', 'Leave', 'Cpu', 'Autopilot', 'RoomChat', 'CreateRoom'].includes(result.service.name)) {
      network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent', kind: result.type, name: result.service.name,
        ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err} : {payload: result.msg ?? result.req})});
    }
  });
}



const playing=`(${worldExpression})?.phase==='PLAYING'&&document.querySelector('[data-formal-battle-page] [data-source-control="btnExit"]')`;
const inputSelector='.source-battle-chat [data-source-control="edtChat"]';
try {
 await launchServer();vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'page-readiness',transform(source,id){if(id.endsWith('/src/match/battle.ts'))return source+'\nconst old=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.pageReadinessBattle=this;return old.call(this,value);};';}}],server:{port:5364,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3338',ws:true,rewrite:()=> '/'}}}});await vite.listen();await launchBrowser();
 const c1=(await command('Target.createBrowserContext')).browserContextId,c2=(await command('Target.createBrowserContext')).browserContextId,a=await newPage(c1),b=await newPage(c2);
 await click(a,'[data-room-card-create]');await waitUntil(a,`document.querySelector('[data-map-selector-mode="4"]')`);await click(a,'[data-map-selector-mode="4"]');await click(a,'[data-map-selector-map="7"]');await click(a,'[data-map-selector-confirm]');await waitUntil(a,`document.querySelector('[data-room-create-name]')`);await input(a,'[data-room-create-name]','正式战斗整页');await click(a,'[data-room-create-confirm]');await waitUntil(a,`(${worldExpression})?.mapLoaded&&document.querySelector('[data-waiting-ready]')`);
 const room=(await world(a)).roomId;await waitUntil(b,`document.querySelector('[data-room-card-id="${room}"]')`);await click(b,`[data-room-card-id="${room}"]`);await click(b,'[data-room-card-express]');await waitUntil(b,`(${worldExpression})?.mapLoaded&&document.querySelector('[data-waiting-ready]')`);
 for(let i=0;i<2;i++){await click(a,'[data-add-cpu]');await waitUntil(a,`(${worldExpression}).players.length===${i+3}`);}
 for(const p of [a,b]) {
   await evaluate(p,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1],{EngineStore}=await import(url),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world'));engine.setHardwareScalingLevel(8);engine.resize()})()`);
   await waitUntil(p,`window.pageReadinessBattle?.players.resourcesReady`);await click(p,'[data-waiting-ready]');
 }
 for(const p of [a,b])await waitUntil(p,playing);evidence.checks.push({name:'two ordinary humans and two managed CPU enter real PLAYING source page',room,players:(await world(a)).players.map(p=>({id:p.id,isCpu:p.isCpu}))});
 for(const [width,height] of (process.argv.includes('--continuation') ? [] : [[800,600],[1920,1080],[3840,2160]])) {
   await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},a);const scale=Math.min(width/800,height/600);
   await waitUntil(a,`Math.abs(document.querySelector('[data-battle-play-stage]').getBoundingClientRect().width-800*${scale})<.2`);await evaluate(a,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
   const state=await evaluate(a,`(async()=>{const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}},stage=box(document.querySelector('[data-battle-play-stage]')),hud=box(document.querySelector('#original-battle-hud')),exit=document.querySelector('[data-leave-room]'),source=box(exit),summary=document.querySelector('[data-battle-play-summary]'),tools=document.querySelector('[data-battle-play-tools]'),targets=[...document.querySelectorAll('#original-battle-hud [data-source-control="edtBattleInfo"],#original-battle-hud [data-source-control="prgLife"],#original-battle-hud [data-source-control="prgCrossbar"],#original-battle-hud [data-player-id]')].filter(e=>!e.hidden),hits=targets.map(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,h=document.elementFromPoint(x,y);return {name:e.dataset.sourceControl,rect:box(e),blockedByManagement:!!h?.closest('[data-formal-battle-page]')}}),asset=exit.dataset.sourceAsset,i=new Image();i.src='/'+asset;await i.decode();return {stage,hud,source,asset,image:[i.naturalWidth,i.naturalHeight],tools:box(tools),open:tools.open,temporaryPanels:document.querySelectorAll('.battle-match[data-phase="PLAYING"]').length,hits,exitHit:document.elementFromPoint(source.x+source.width/2,source.y+source.height/2)?.closest('[data-leave-room]')===exit}})()`);
   assert.equal(state.temporaryPanels,0);assert.equal(state.open,false);assert.equal(state.exitHit,true);assert(state.image[0]>0&&state.image[1]>0);assert.deepEqual(state.stage,state.hud);
   for(const [actual,expected] of [[state.source.x-state.stage.x,747*scale],[state.source.y-state.stage.y,0],[state.source.width,46*scale],[state.source.height,46*scale]])assert(Math.abs(actual-expected)<.2);
   assert(state.hits.length>=7);assert(state.hits.every(h=>!h.blockedByManagement));await screenshot(a,'playing-'+width);evidence.checks.push({name:'source PLAYING full page '+width+'×'+height+' with original HUD unobstructed',scale,state});
   await click(a,'[data-battle-play-summary]');await waitUntil(a,`document.querySelector('[data-battle-play-tools]').open`);
   const expanded=await evaluate(a,`(()=>{const e=document.querySelector('[data-battle-play-tools]'),r=e.getBoundingClientRect(),s=document.querySelector('[data-battle-play-stage]').getBoundingClientRect();return {x:(r.x-s.x)/${scale},y:(r.y-s.y)/${scale},width:r.width/${scale},height:r.height/${scale}}})()`);assert(Math.abs(expanded.x-309)<.2);assert(expanded.y>=407.8&&expanded.y+expanded.height<=556.2);assert(Math.abs(expanded.width-287)<.2);
   await screenshot(a,'controls-'+width);await press(a,'Escape','Escape');assert.equal(await evaluate(a,`document.querySelector('[data-battle-play-tools]').open`),false);assert.equal(await evaluate(a,`document.activeElement===document.querySelector('[data-battle-play-summary]')`),true);
   evidence.checks.push({name:'ordinary tools expand and Escape restores summary focus '+width,expanded});
 }
 if(process.argv.includes('--continuation')) {await click(a,'[data-battle-play-summary]');await press(a,'Escape','Escape');}
 await press(a,'Enter','Enter');await waitUntil(a,`document.querySelector('[data-battle-play-tools]').open`);await click(a,'[data-autopilot]');await waitUntil(a,`document.querySelector('[data-autopilot]').getAttribute('aria-pressed')==='true'`);const autopilotWorld=await world(a);assert(autopilotWorld.players.find(p=>p.id===autopilotWorld.playerId)?.isAutopilot);
 await click(a,'[data-autopilot]');await waitUntil(a,`document.querySelector('[data-autopilot]').getAttribute('aria-pressed')==='false'`);await press(a,'Escape','Escape');assert.equal(await evaluate(a,`document.querySelector('[data-battle-play-tools]').open`),false);assert.equal(await evaluate(a,`document.activeElement===document.querySelector('[data-battle-play-summary]')`),true);evidence.checks.push({name:'summary keyboard Enter opens, ordinary autopilot on/off confirms then Escape closes'});
 await input(a,inputSelector,'正式整页中文聊天');await press(a,'Enter','Enter');await waitUntil(b,`document.querySelector('[data-chat-log]').textContent.includes('正式整页中文聊天')`);assert.equal(await evaluate(a,`document.querySelector('[data-battle-play-tools]').open`),false);evidence.checks.push({name:'ordinary Chinese room chat stays focused and does not toggle management'});
 await click(a,'[data-leave-room]');await waitUntil(a,`(${worldExpression})===null&&document.querySelector('[data-lobby-page]')?.hidden===false&&!document.querySelector('[data-formal-battle-page]')`);
 await click(b,'[data-leave-room]');await waitUntil(b,`(${worldExpression})===null`);evidence.checks.push({name:'source Exit confirms ordinary Leave on both pages and unmounts controls/HUD state'});
 await waitUntil(a,`document.querySelector('[data-room-card-id="R4"]')`);await click(a,'[data-room-card-id="R4"]');await click(a,'[data-room-card-express]');await waitUntil(a,`(${worldExpression})?.mapLoaded&&document.querySelector('[data-waiting-ready]')`);assert.equal(await evaluate(a,`!!document.querySelector('[data-formal-battle-page]')`),false);await click(a,'[data-waiting-close]');await waitUntil(a,`(${worldExpression})===null`);evidence.checks.push({name:'normal R4 waiting reentry has no stale play controls and source Close returns lobby'});
 evidence.status='PASS';console.log('PASS formal battle source whole page/HUD/ordinary controls/keyboard/exit/reentry');
}catch(error){evidence.status='FAIL';evidence.error=error.stack??String(error);await screenshot(pages[0]?.sessionId,'failure').catch(()=>{});throw error;
}finally{if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3338,vite:5364,chrome:9564};evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);}
