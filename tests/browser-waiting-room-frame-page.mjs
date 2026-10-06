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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3332', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-03-R-FRAME full waiting original outer and roster regions, ordinary Ready/team/Leave.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = `recovery/output/browser-waiting-room-frame-page-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5356'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3332', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9556', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9556/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['Join', 'Ready', 'ChangeTeam', 'Leave'].includes(result.service.name)) {
      network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent', kind: result.type, name: result.service.name,
        ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err} : {payload: result.msg ?? result.req})});
    }
  });
}



async function contextMenu(session, selector) {
  const point=await evaluate(session,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'right',clickCount:1,...point},session);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'right',clickCount:1,...point},session);
}


async function snapshot(page){return evaluate(page,`(()=>{const d=document.querySelector('[data-waiting-room]'),box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {dialog:box(d),viewport:box(d.querySelector('.waiting-room-viewport')),stage:box(d.querySelector('[data-waiting-room-stage]')),roots:['ditu','maogouditu','maogouditu2'].map(name=>{const e=d.querySelector('[data-source-control="'+name+'"]');return {name,box:box(e),frames:e.querySelectorAll('[data-source-frame]').length,asset:e.querySelector('[data-source-image]').dataset.sourceAsset}}),ready:d.querySelector('[data-waiting-ready]').getAttribute('aria-pressed'),focus:document.activeElement.dataset.waitingControl,players:[...d.querySelectorAll('[data-waiting-source-player]')].map(e=>({id:e.dataset.waitingSourcePlayer,team:e.dataset.team}))}})()`)}
try{
 await launchServer();vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'waiting-readiness',transform(source,id){if(id.endsWith('/src/match/battle.ts'))return source+'\nconst old=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.waitingFrameBattle=this;return old.call(this,value);};';}}],server:{port:5356,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3332',ws:true,rewrite:()=> '/'}}}});await vite.listen();await launchBrowser();const humans=[];for(let n=0;n<4;n++){const cx=(await command('Target.createBrowserContext')).browserContextId;humans.push(await newPage(cx));}const a=humans[0];
 for(const p of humans){await click(p,'[data-room-card-id="R1"]');await click(p,'[data-room-card-express]');await waitUntil(p,`(${worldExpression})?.mapLoaded&&document.querySelector('[data-waiting-ready]')`);await evaluate(p,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1],{EngineStore}=await import(url),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world'));engine.setHardwareScalingLevel(8);engine.resize()})()`);}
 for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},a);const scale=Math.max(.25,Math.min((width-64)/615,(height-180)/391,2));await waitUntil(a,`Math.abs(document.querySelector('[data-waiting-room-stage]').getBoundingClientRect().width-615*${scale})<.2`);const state=await snapshot(a);assert.equal(state.players.length,4);assert.deepEqual(state.roots.map(e=>e.frames),[8,8,8]);assert(Math.abs(state.roots[0].box.height-400*scale)<.2);assert(state.viewport.x>=0&&state.viewport.y>=0&&state.viewport.x+state.viewport.width<=width+.2&&state.viewport.y+state.viewport.height<=height+.2);await screenshot(a,String(width));evidence.checks.push({name:'complete original outer and two roster regions '+width+'×'+height,scale,state});}
 await click(a,'[data-waiting-ready]');await waitUntil(a,`document.querySelector('[data-waiting-ready]').getAttribute('aria-pressed')==='true'&&!document.querySelector('[data-waiting-ready]').disabled`);await click(a,'[data-waiting-ready]');await waitUntil(a,`document.querySelector('[data-waiting-ready]').getAttribute('aria-pressed')==='false'&&!document.querySelector('[data-waiting-ready]').disabled`);assert.equal(await evaluate(a,`document.activeElement.dataset.waitingControl`),'ready');
 const originalTeam=await evaluate(a,`document.querySelector('[data-waiting-team="0"]').getAttribute('aria-pressed')==='true'?0:1`);await click(a,'[data-waiting-team="'+(1-originalTeam)+'"]');await waitUntil(a,`document.querySelector('[data-waiting-team="${1-originalTeam}"]').getAttribute('aria-pressed')==='true'`);await click(a,'[data-waiting-team="'+originalTeam+'"]');await waitUntil(a,`document.querySelector('[data-waiting-team="${originalTeam}"]').getAttribute('aria-pressed')==='true'`);
 await press(a,'Escape','Escape');assert.equal(await evaluate(a,`document.querySelector('[data-waiting-room]').open`),true);evidence.checks.push({name:'ordinary Ready/cancel server state and focus, opposite team/back and Escape preserve formal page'});
 for(const p of humans){await waitUntil(p,`window.waitingFrameBattle?.players.resourcesReady`);await click(p,'[data-waiting-ready]');}for(const p of humans)await waitUntil(p,`(${worldExpression}).phase==='PLAYING'&&!document.querySelector('[data-waiting-room]')`);evidence.checks.push({name:'all four ordinary players Ready removes waiting root at actual PLAYING'});
 for(const p of humans){await click(p,'[data-leave-room]');await waitUntil(p,`!(${worldExpression})&&!document.querySelector('[data-lobby-page]').hidden`);}evidence.checks.push({name:'ordinary PLAYING Leave restores formal lobby and no old waiting frame'});
 await click(a,'[data-room-card-id="R2"]');await click(a,'[data-room-card-express]');await waitUntil(a,`document.querySelector('[data-waiting-room]')?.open&&document.querySelector('[data-source-control="ditu"]')`);await click(a,'[data-waiting-close]');await waitUntil(a,`!(${worldExpression})&&!document.querySelector('[data-waiting-room]')&&!document.querySelector('[data-lobby-page]').hidden`);evidence.checks.push({name:'next room automatically restores complete source root and sourceClose Leave clears again'});evidence.status='PASS';console.log('PASS complete waiting outer/roster regions and ordinary page lifecycle');
}catch(error){evidence.status='FAIL';evidence.error=error.stack??String(error);await screenshot(pages[0]?.sessionId,'failure').catch(()=>{});throw error;
}finally{if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3332,vite:5356,chrome:9556};evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);}
