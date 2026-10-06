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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3202', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-lobby-presence-'));
let server, chrome, vite, ws;
const auxiliary=[];
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'PASS', scope: 'M6-05-N formal nickname confirm/refusal, two pages list/chat/room authority, normal Leave, reload and actual restart.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  await writeFile(`recovery/output/browser-display-name-${name}.png`, Buffer.from(result.data, 'base64'));
}
async function submit(session, text) {
  await input(session, chatInput, text);
  await press(session, 'Enter', 'Enter');
}
try {
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3202', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {serverLog += String(data);});
  server.stderr.on('data', data => {serverLog += String(data);});
  const deadline = Date.now() + 15000;
  while (!serverLog.includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
  assert(serverLog.includes('Server started'), serverLog);
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    server: {port: 5362, strictPort: true, host: '127.0.0.1', hmr: false,
      proxy: {'/game': {target: 'ws://127.0.0.1:3202', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=9562', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9562/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
      if (result.service.name === 'DisplayName' || result.service.name === 'LobbyPlayers' || result.service.name === 'Leave' || result.service.name === 'LobbyChat' || result.service.name === 'Account' || result.service.name === 'PlayerInput' || result.service.name === 'RoomChat'
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
    await command('Page.navigate',{url:'http://127.0.0.1:5362'},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-lobby-player-list]')?.dataset.sourceFontReady==='true'&&localStorage.getItem('cdtank-account-token')`);
  }
  const [a,b]=pages.map(p=>p.sessionId);
  for(const page of [a,b]) await waitUntil(page,`(${listExpression}).length===2`);
  const initial=await evaluate(a,listExpression);assert.deepEqual(await evaluate(b,listExpression),initial);
  const names=['中文坦克手甲','中文坦克手乙'];
  for(let index=0;index<2;index++) {
    const page=[a,b][index];
    await waitUntil(page, `document.querySelector('#player-name')?.disabled===false`);
    await input(page,'#player-name',names[index]);
    await click(page,'[data-lobby-name-save]');
    await waitUntil(page,`document.querySelector('[data-lobby-identity]')?.dataset.confirmedName===${JSON.stringify(names[index])}`);
  }
  for(const page of [a,b])await waitUntil(page,`(${listExpression}).some(p=>p.name===${JSON.stringify(names[0])})&&(${listExpression}).some(p=>p.name===${JSON.stringify(names[1])})`);
  evidence.checks.push({name:'ordinary Chinese confirmation updates both authoritative lists',players:await evaluate(b,listExpression)});
  const before=network.filter(e=>e.name==='DisplayName'&&e.direction==='sent'&&e.payload?.name!==undefined).length;
  await input(a,'#player-name','组合输入');
  await command('Input.imeSetComposition',{text:'中文',selectionStart:2,selectionEnd:2},a);
  await key(a,'Enter','Enter');await key(a,'Enter','Enter','keyUp');await pause(200);
  assert.equal(network.filter(e=>e.name==='DisplayName'&&e.direction==='sent'&&e.payload?.name!==undefined).length,before);
  await command('Input.insertText',{text:'中文'},a);
  await input(a,'#player-name','');await click(a,'[data-lobby-name-save]');
  await waitUntil(a,`document.querySelector('[data-lobby-name-status]')?.textContent.includes('1至16')`);
  assert.equal(await evaluate(a,`document.querySelector('#player-name').value`),'');
  assert.equal(await evaluate(a,`document.querySelector('[data-lobby-identity]').dataset.confirmedName`),names[0]);
  await input(a,'#player-name',names[0]);await press(a,'Enter','Enter');
  await waitUntil(a,`document.querySelector('[data-lobby-name-status]')?.textContent==='昵称已保存'`);
  evidence.checks.push({name:'IME Enter sends no request; rejected empty draft retained; normal Enter confirms'});
  await submit(a,'昵称同步消息');
  for(const page of [a,b])await waitUntil(page,`${logExpression}.some(text=>text.includes('中文坦克手甲: 昵称同步消息'))`);
  evidence.checks.push({name:'ordinary typed public message shows saved authoritative Chinese name on both pages'});
  const accounts=network.filter(e=>e.name==='Account'&&e.direction==='received'&&e.success);
  const accountA=accounts.find(e=>e.page===a).response.accountId;
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
  assert.equal(roomWorld.players.find(player=>!player.isCpu).name,names[0]);
  await waitUntil(a,`!document.querySelector('[data-room-create-dialog]')?.open`);
  await waitUntil(a,`document.querySelector('[data-waiting-room]')?.open&&document.querySelector('[data-waiting-close]')?.disabled===false`);
  await screenshot(a,'waiting');
  await click(a,'[data-waiting-close]');
  for(const page of [a,b])await waitUntil(page,`(${listExpression}).length===2`);
  evidence.checks.push({name:'ordinary source create uses confirmed name; automatic formal waiting and source Leave restore named lobby',roomId:roomWorld.roomId});
  await command('Page.reload',{},b);
  await waitUntil(b,`document.querySelector('[data-lobby-identity]')?.dataset.confirmedName===${JSON.stringify(names[1])}`);
  evidence.checks.push({name:'browser reload restores same account saved Chinese name'});
  await stop(server);
  for(const page of [a,b])await waitUntil(page,`(${listExpression}).length===0&&document.querySelector('[data-lobby-presence-status]')?.textContent.includes('连接已断开')`);
  serverLog='';
  server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:'3202',ACCOUNT_DB_PATH:join(directory,'accounts.sqlite')},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',data=>{serverLog+=String(data);});server.stderr.on('data',data=>{serverLog+=String(data);});
  for(let attempt=0;attempt<300&&!serverLog.includes('Server started');attempt++)await pause(50);
  assert(serverLog.includes('Server started'),serverLog);
  for(let index=0;index<2;index++) {
    const page=[a,b][index];await command('Page.reload',{},page);
    await waitUntil(page,`document.querySelector('[data-lobby-identity]')?.dataset.confirmedName===${JSON.stringify(names[index])}`);
  }
  for(const page of [a,b])await waitUntil(page,`(${listExpression}).length===2&&(${listExpression}).some(p=>p.name===${JSON.stringify(names[0])})`);
  await screenshot(a,'restored');
  evidence.checks.push({name:'actual server restart with same SQLite and browser tokens restores both names and authoritative list'});
  evidence.network=network;evidence.noInjectedState=true;
  await writeFile('recovery/output/browser-display-name-lifecycle.json',JSON.stringify(evidence,null,2)+'\n');
  console.log('PASS M6-05-N actual formal Chinese name, refusal, identity and restart');
} catch (error) {
  await writeFile('recovery/output/browser-display-name-lifecycle.json', JSON.stringify({...evidence, status: 'FAIL', error: String(error), serverLog, network}, null, 2) + '\n');
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
