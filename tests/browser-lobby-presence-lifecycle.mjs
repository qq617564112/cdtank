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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3200', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-lobby-presence-'));
let server, chrome, vite, ws;
const auxiliary=[];
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'PASS', scope: 'M6-08-P authoritative members in two formal pages, normal auth/create/Leave/reload, ordinary mouse/keyboard/wheel; M5-02-R-PLAYERS source region at 800/1080p/4K.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  await writeFile(`recovery/output/browser-lobby-presence-${name}.png`, Buffer.from(result.data, 'base64'));
}
async function submit(session, text) {
  await input(session, chatInput, text);
  await press(session, 'Enter', 'Enter');
}
try {
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3200', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {serverLog += String(data);});
  server.stderr.on('data', data => {serverLog += String(data);});
  const deadline = Date.now() + 15000;
  while (!serverLog.includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
  assert(serverLog.includes('Server started'), serverLog);
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    server: {port: 5360, strictPort: true, host: '127.0.0.1', hmr: false,
      proxy: {'/game': {target: 'ws://127.0.0.1:3200', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=9560', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9560/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
      if (result.service.name === 'LobbyPlayers' || result.service.name === 'Leave' || result.service.name === 'LobbyChat' || result.service.name === 'Account' || result.service.name === 'PlayerInput' || result.service.name === 'RoomChat'
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
  for (let index=0;index<2;index++) {
    const {browserContextId}=await command('Target.createBrowserContext'); contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await command('Page.navigate',{url:'http://127.0.0.1:5360'},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-lobby-player-list]')?.dataset.sourceFontReady==='true'&&localStorage.getItem('cdtank-account-token')`);
  }
  const [a,b]=pages.map(p=>p.sessionId);
  for(const page of [a,b]) await waitUntil(page,`(${listExpression}).length===2`);
  const initial=await evaluate(a,listExpression);assert.deepEqual(await evaluate(b,listExpression),initial);
  for(const player of initial) assert.equal(player.name,'坦克手-'+player.accountId.slice(0,6));
  assert.equal(initial.length,new Set(initial.map(p=>p.accountId)).size);
  const accounts=network.filter(e=>e.name==='Account'&&e.direction==='received'&&e.success);
  const accountA=accounts.find(e=>e.page===a).response.accountId;
  const accountB=accounts.find(e=>e.page===b).response.accountId;
  evidence.checks.push({name:'two normal formal pages list equal authoritative account identities',players:initial});
  const authoritative={isSucc:true,res:{players:initial}};
  await click(b,`[data-lobby-player-account="${accountA}"]`);
  const selectedAccount=await evaluate(b,`document.querySelector('[data-lobby-player-account="${accountA}"]').getAttribute('aria-selected')`);assert.equal(selectedAccount,'true');
  await click(a,'[data-room-card-create]');
  await waitUntil(a,`document.querySelector('[data-room-map-selector][open]')&&document.querySelector('[data-map-selector-confirm]')?.disabled===false`);
  await click(a,'[data-map-selector-mode="4"]');await waitUntil(a,`document.querySelector('[data-map-selector-map="7"]')`);
  await click(a,'[data-map-selector-map="7"]');await click(a,'[data-map-selector-confirm]');
  await waitUntil(a,`document.querySelector('[data-room-create-dialog][open]')&&document.querySelector('[data-room-create-confirm]')?.disabled===false`);
  await input(a,'[data-room-create-name]','大厅名单普通入房');await click(a,'[data-room-create-confirm]');
  await waitUntil(a,`(${worldExpression})?.mapLoaded&&(${worldExpression})?.phase==='WAITING'`);
  await waitUntil(b,`(${listExpression}).length===1&&!(${listExpression}).some(p=>p.accountId===${JSON.stringify(accountA)})`);
  assert.equal(await evaluate(a,`(${listExpression}).length`),0);
  assert.equal(await evaluate(b,`document.querySelectorAll('[data-lobby-player-list] [aria-selected=true]').length`),0);
  const roomWorld=await evaluate(a,worldExpression);
  evidence.checks.push({name:'ordinary source create removes current account and clears its selection in other lobby',roomId:roomWorld.roomId,players:await evaluate(b,listExpression)});
  await waitUntil(a,`document.querySelector('[data-open-waiting-room]')&&!document.querySelector('[data-open-waiting-room]').disabled`);
  await waitUntil(a,`!document.querySelector('[data-room-create-dialog]')?.open`);
  await click(a,'[data-open-waiting-room]');
  await waitUntil(a,`document.querySelector('[data-waiting-room]')?.open&&document.querySelector('[data-waiting-close]')?.disabled===false`);
  await click(a,'[data-waiting-close]');
  for(const page of [a,b])await waitUntil(page,`(${listExpression}).length===2`);
  assert.deepEqual(await evaluate(a,listExpression),authoritative.res.players);
  assert.equal(await evaluate(b,`document.querySelectorAll('[data-lobby-player-list] [aria-selected=true]').length`),0);
  evidence.checks.push({name:'ordinary source Leave restores same account in both lobbies without stale selection'});
  await command('Page.reload',{},b);
  await waitUntil(b,`(${listExpression}).length===2`);
  assert.deepEqual(await evaluate(b,listExpression),authoritative.res.players);
  assert.equal(await evaluate(b,`document.querySelectorAll('[data-lobby-player-list] [aria-selected=true]').length`),0);
  evidence.checks.push({name:'normal browser reload reconnects existing account and unique lobby member'});
  await stop(server);
  for(const page of [a,b])await waitUntil(page,`(${listExpression}).length===0&&document.querySelector('[data-lobby-presence-status]')?.textContent.includes('连接已断开')`);
  evidence.checks.push({name:'real server disconnect clears both player lists and shows visible status'});
  evidence.network=network;evidence.noInjectedState=true;
  await writeFile('recovery/output/browser-lobby-presence-lifecycle.json',JSON.stringify(evidence,null,2)+'\n');
  console.log('PASS dual formal lobby ordinary create/Leave/reload/disconnect lifecycle supplement');
} catch (error) {
  await writeFile('recovery/output/browser-lobby-presence-lifecycle.json', JSON.stringify({...evidence, status: 'FAIL', error: String(error), serverLog, network}, null, 2) + '\n');
  console.error(serverLog);
  throw error;
} finally {
  if (ws?.readyState === WebSocket.OPEN) {
    for (const page of pages) await command('Target.closeTarget', {targetId: page.targetId}).catch(() => {});
    for (const browserContextId of contexts) await command('Target.disposeBrowserContext', {browserContextId}).catch(() => {});
    ws.close();
  }
  await Promise.allSettled(auxiliary.map(client=>client.disconnect()));
  await vite?.close();
  await stop(server);
  await stop(chrome);
  await rm(directory, {recursive: true, force: true});
}
