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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3328', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-13-R-K source player info blacklist state, ordinary BLOCK/UNBLOCK and action focus.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = `recovery/output/browser-player-info-blacklist-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5352'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3328', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9552', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9552/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['Blacklist', 'Friends', 'ListLobbyPlayers'].includes(result.service.name)) {
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

async function state(session) {
  return evaluate(session,`(()=>{const d=document.querySelector('[data-player-info]'),b=d.querySelector('[data-player-info-blacklist-action]'),r=b.getBoundingClientRect();return {account:d.dataset.playerInfoAccount,name:d.querySelector('[data-source-control=txtPlayerName]').textContent,source:b.dataset.sourceControl,asset:b.dataset.sourceAsset,disabled:b.disabled,buttonState:b.dataset.sourceButtonState,focus:document.activeElement.dataset.sourceControl,status:d.querySelector('[data-player-info-status]').value,box:{x:r.x,y:r.y,width:r.width,height:r.height}}})()`);
}
try {
  await launchServer();vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5352,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3328',ws:true,rewrite:()=> '/'}}}});await vite.listen();await launchBrowser();
  const contexts=[];for(let i=0;i<2;i++)contexts.push((await command('Target.createBrowserContext')).browserContextId);
  const owner=await newPage(contexts[0]),target=await newPage(contexts[1]);await waitUntil(owner,`document.querySelectorAll('[data-lobby-player-account]').length===2`);
  const targetName=await evaluate(target,`document.querySelector('[data-lobby-identity] input').value`);
  const otherId=await evaluate(owner,`[...document.querySelectorAll('[data-lobby-player-account]')].find(e=>e.textContent===${JSON.stringify(targetName)})?.dataset.lobbyPlayerAccount`);assert(otherId);
  const row='[data-lobby-player-account="'+otherId+'"]';await click(owner,row);await contextMenu(owner,row);
  await waitUntil(owner,`document.querySelector('[data-player-info]')?.open&&document.querySelector('[data-player-info-blacklist-action]')&&!document.querySelector('[data-player-info-blacklist-action]').disabled`);
  const before=await state(owner);assert.equal(before.source,'btnAddBlacklist');
  await click(owner,'[data-player-info-blacklist-action]');await waitUntil(owner,`document.querySelector('[data-player-info-blacklist-action]').dataset.sourceControl==='btnRemoveBlacklist'&&!document.querySelector('[data-player-info-blacklist-action]').disabled`);
  assert.equal(await evaluate(owner,`document.activeElement.hasAttribute('data-player-info-blacklist-action')`),true);
  evidence.checks.push({name:'ordinary real player source BLOCK confirms RemoveBlacklist and blacklist focus',before,after:await state(owner)});
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},owner);const scale=Math.min(width/800,height/600);
    await waitUntil(owner,`Math.abs(document.querySelector('[data-player-info-stage]').getBoundingClientRect().width-405*${scale})<.2`);
    const current=await state(owner);assert.equal(current.source,'btnRemoveBlacklist');assert.equal(current.account,otherId);assert.equal(current.name,targetName);
    assert(Math.abs(current.box.width-81*scale)<.2);assert(Math.abs(current.box.height-42*scale)<.2);assert.equal(current.focus,'btnRemoveBlacklist');
    await screenshot(owner,'blocked-'+width);evidence.checks.push({name:'blocked source full page '+width+'×'+height,scale,state:current});
  }
  const blocked=await state(owner);await press(owner,'Enter','Enter');await waitUntil(owner,`document.querySelector('[data-player-info-blacklist-action]').dataset.sourceControl==='btnAddBlacklist'&&!document.querySelector('[data-player-info-blacklist-action]').disabled`);
  const unblocked=await state(owner);assert.equal(unblocked.focus,'btnAddBlacklist');assert.deepEqual(unblocked.box,blocked.box);
  await screenshot(owner,'unblocked-3840');evidence.checks.push({name:'trusted Enter UNBLOCK confirms AddBlacklist exact-position blacklist focus',blocked,unblocked});
  await click(owner,'[data-player-info-close]');await waitUntil(owner,`!document.querySelector('[data-player-info]')`);assert.equal(await evaluate(owner,`document.activeElement.dataset.lobbyPlayerAccount`),otherId);
  evidence.checks.push({name:'source Close restores original player row after blacklist operation'});
  const sent=network.filter(n=>n.name==='Blacklist'&&n.direction==='sent');assert(sent.some(n=>n.payload?.operation==='ADD'||n.payload?.operation==='BLOCK'));assert(sent.some(n=>n.payload?.operation==='REMOVE'||n.payload?.operation==='UNBLOCK'));assert(sent.filter(n=>n.payload?.operation!=='QUERY').every(n=>n.payload.targetAccountId===otherId));
  evidence.status='PASS';console.log('PASS source player info blacklist state and ordinary BLOCK/UNBLOCK focus');
} catch(error) {evidence.status='FAIL';evidence.error=error.stack??String(error);await screenshot(pages[0]?.sessionId,'failure').catch(()=>{});throw error;
} finally {if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3328,vite:5352,chrome:9552};evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);}
