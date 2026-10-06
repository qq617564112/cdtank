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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3204', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-lobby-presence-'));
let server, chrome, vite, ws;
const auxiliary=[];
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'PASS', scope: 'M6-08-W ordinary three formal pages public/private source controls, name/account targets, ambiguity/offline/self refusals and lobby lifecycle.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  await writeFile(`recovery/output/browser-lobby-whisper-${name}.png`, Buffer.from(result.data, 'base64'));
}
async function submit(session, text) {
  await input(session, chatInput, text);
  await press(session, 'Enter', 'Enter');
}
try {
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3204', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {serverLog += String(data);});
  server.stderr.on('data', data => {serverLog += String(data);});
  const deadline = Date.now() + 15000;
  while (!serverLog.includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
  assert(serverLog.includes('Server started'), serverLog);
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    server: {port: 5364, strictPort: true, host: '127.0.0.1', hmr: false,
      proxy: {'/game': {target: 'ws://127.0.0.1:3204', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=9564', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9564/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
      if (result.service.name === 'LobbyWhisper' || result.service.name === 'DisplayName' || result.service.name === 'LobbyPlayers' || result.service.name === 'Leave' || result.service.name === 'LobbyChat' || result.service.name === 'Account' || result.service.name === 'PlayerInput' || result.service.name === 'RoomChat'
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
    await command('Page.navigate',{url:'http://127.0.0.1:5364'},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-lobby-player-list]')?.dataset.sourceFontReady==='true'&&localStorage.getItem('cdtank-account-token')`);
  }
  const [a,b,c]=pages.map(p=>p.sessionId);
  const names=['密语甲','同名对象','同名对象'];
  for(let index=0;index<3;index++) {
    const page=[a,b,c][index];
    await waitUntil(page, `document.querySelector('#player-name')?.disabled===false`);
    await input(page,'#player-name',names[index]);await click(page,'[data-lobby-name-save]');
    await waitUntil(page,`document.querySelector('[data-lobby-identity]')?.dataset.confirmedName===${JSON.stringify(names[index])}`);
  }
  for(const page of [a,b,c])await waitUntil(page,`(${listExpression}).length===3&&(${listExpression}).filter(p=>p.name==='同名对象').length===2`);
  const accountB=network.find(e=>e.name==='Account'&&e.direction==='received'&&e.success&&e.page===b).response.accountId;
  const accountA=network.find(e=>e.name==='Account'&&e.direction==='received'&&e.success&&e.page===a).response.accountId;
  await submit(a,'公共仍可发送');
  for(const page of [a,b,c])await waitUntil(page,`${logExpression}.some(text=>text.includes('密语甲: 公共仍可发送'))`);
  evidence.checks.push({name:'three normal pages preserve public broadcast and authoritative identity'});
  async function channel(value) {
    await waitUntil(a,`document.querySelector('[data-lobby-channel-toggle]')?.disabled===false`);
    await click(a,'[data-lobby-channel-toggle]');
    await waitUntil(a,`document.querySelector('[data-lobby-channel-menu]')`);
    await click(a,`[data-lobby-channel="${value}"]`);
  }
  await channel('whisper');
  await input(a,chatInput,'没有对象仍保草稿');await press(a,'Enter','Enter');
  await waitUntil(a,`document.querySelector('[data-lobby-chat-status]')?.textContent==='请填写密语对象'`);
  assert.equal(await evaluate(a,`document.querySelector('[data-lobby-chat-input]').value`),'没有对象仍保草稿');
  await input(a,'[data-lobby-whisper-target]','同名对象');await submit(a,'同名拒绝保草稿');
  await waitUntil(a,`document.querySelector('[data-lobby-chat-status]')?.textContent.includes('多名')`);
  assert.equal(await evaluate(a,`document.querySelector('[data-lobby-chat-input]').value`),'同名拒绝保草稿');
  assert.equal(network.filter(e=>e.name==='LobbyWhisper'&&e.direction==='received'&&e.kind==='msg').length,0);
  evidence.checks.push({name:'source whisper mode missing/ambiguous name refuses visibly and retains draft without broadcast'});
  await click(a,`[data-lobby-player-account="${accountB}"]`);await press(a,'Enter','Enter');
  await waitUntil(a,`document.querySelector('[data-lobby-whisper-target]')?.dataset.targetAccount===${JSON.stringify(accountB)}`);
  await input(a,chatInput,'只给选中的账户中文密语');
  const before=network.filter(e=>e.name==='LobbyWhisper'&&e.direction==='sent').length;
  await command('Input.imeSetComposition',{text:'中文',selectionStart:2,selectionEnd:2},a);
  await key(a,'Enter','Enter');await key(a,'Enter','Enter','keyUp');await pause(200);
  assert.equal(network.filter(e=>e.name==='LobbyWhisper'&&e.direction==='sent').length,before);
  await command('Input.insertText',{text:'中文'},a);
  await input(a,chatInput,'只给选中的账户中文密语');await press(a,'Enter','Enter');
  for(const page of [a,b])await waitUntil(page,`${logExpression}.some(text=>text.includes('[密语] 密语甲 → 同名对象: 只给选中的账户中文密语'))`);
  await waitUntil(a,`document.querySelector('[data-lobby-chat-input]').value===''`);
  assert(!await evaluate(c,`${logExpression}.some(text=>text.includes('只给选中的账户中文密语'))`));
  assert.equal(network.filter(e=>e.name==='LobbyWhisper'&&e.direction==='sent').length,before+1);
  assert.equal(network.filter(e=>e.name==='LobbyWhisper'&&e.direction==='received'&&e.kind==='msg'&&e.page===c).length,0);
  evidence.checks.push({name:'ordinary list Enter resolves same-name account; IME gates; exactly one accepted Chinese whisper shown only in sender/target pages'});
  // Editing the target clears account binding and uses authoritative exact-name resolution.
  await input(a,'[data-lobby-whisper-target]','密语甲');await submit(a,'自己拒绝');
  await waitUntil(a,`document.querySelector('[data-lobby-chat-status]')?.textContent.includes('自己')`);
  assert.equal(await evaluate(a,`document.querySelector('[data-lobby-chat-input]').value`),'自己拒绝');
  await input(b,'#player-name','唯一对象乙');await click(b,'[data-lobby-name-save]');
  await waitUntil(b,`document.querySelector('[data-lobby-identity]')?.dataset.confirmedName==='唯一对象乙'`);
  await input(a,'[data-lobby-whisper-target]',' 唯一对象乙 ');await submit(a,'通过对象昵称发送');
  for(const page of [a,b])await waitUntil(page,`${logExpression}.some(text=>text.includes('唯一对象乙: 通过对象昵称发送'))`);
  assert(!await evaluate(c,`${logExpression}.some(text=>text.includes('通过对象昵称发送'))`));
  evidence.checks.push({name:'ordinary name edit clears ID; self rejects; trimmed unique saved name reaches only correct page'});
  for(const viewport of [{width:800,height:600},{width:1920,height:1080},{width:3840,height:2160}]) {
    await command('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false},a);
    await waitUntil(a,`Math.abs(document.querySelector('[data-lobby-stage]').getBoundingClientRect().width-${Math.min(viewport.width / 800, viewport.height / 600) * 800})<1`);
    const geometry=await evaluate(a,`(()=>{const s=Math.min(innerWidth/800,innerHeight/600),r=document.querySelector('[data-lobby-stage]').getBoundingClientRect();return [...document.querySelectorAll('[data-lobby-whisper-target],[data-lobby-chat-input],[data-lobby-channel-toggle]')].map(e=>{const b=e.getBoundingClientRect();return {source:e.dataset.sourceControl,asset:e.dataset.sourceAsset,x:(b.x-r.x)/s,y:(b.y-r.y)/s,width:b.width/s,height:b.height/s}})})()`);
    const target=geometry.find(g=>g.source==='edtIntimateNameInput');assert(Math.abs(target.x-92)<.1&&Math.abs(target.y-571)<.1&&Math.abs(target.width-100)<.1);
    const message=geometry.find(g=>g.source==='edtIntimateChatInput');assert(Math.abs(message.x-203)<.1&&Math.abs(message.y-572)<.1&&Math.abs(message.width-367)<.1);
    assert(geometry.find(g=>g.source==='btnPrivateChannel').asset);
    await screenshot(a,`${viewport.width}-source-whisper`);evidence.checks.push({name:'actual new whisper controls use source rectangles and original channel resource',viewport,geometry});
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},a);
  const joinedRooms = new Set();
  async function ordinaryJoin(page) {
    await waitUntil(page,`document.querySelector('[data-room-card-id]')&&!document.querySelector('[data-room-card-id]').disabled`);
    const point=await evaluate(page,`(()=>{const e=[...document.querySelectorAll('[data-room-card-id]')].find(e=>!e.disabled&&!${JSON.stringify([...joinedRooms])}.includes(e.dataset.roomCardId));if(!e)throw new Error('No unvisited room');const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,roomId:e.dataset.roomCardId}})()`);
    joinedRooms.add(point.roomId);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,x:point.x,y:point.y},page);
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,x:point.x,y:point.y},page);
    await waitUntil(page,`(${worldExpression})?.mapLoaded&&document.querySelector('[data-waiting-room]')?.open&&document.querySelector('[data-waiting-close]')?.disabled===false`);
  }
  await ordinaryJoin(b);
  await submit(a,'对象在房间暂不可收');
  await waitUntil(a,`document.querySelector('[data-lobby-chat-status]')?.textContent.includes('当前不在大厅')`);
  assert.equal(await evaluate(a,`document.querySelector('[data-lobby-chat-input]').value`),'对象在房间暂不可收');
  await click(b,'[data-waiting-close]');await waitUntil(b,`!document.querySelector('[data-lobby-page]').hidden`);
  await press(a,'Enter','Enter');
  for(const page of [a,b])await waitUntil(page,`${logExpression}.some(text=>text.includes('对象在房间暂不可收'))`);
  evidence.checks.push({name:'normal target Join rejects without losing draft; source Leave restores eligibility and Enter retries ordinary message'});
  await ordinaryJoin(a);
  await waitUntil(a,`!document.querySelector('[data-lobby-chat-input]')`);
  await click(a,'[data-waiting-close]');await waitUntil(a,`!document.querySelector('[data-lobby-page]').hidden&&document.querySelector('[data-lobby-chat-input]')`);
  assert.equal(await evaluate(a,`document.querySelector('[data-lobby-chat-input]').value`),'');
  assert.equal(await evaluate(a,`document.querySelectorAll('[data-lobby-chat-log] li').length`),0);
  assert.equal(await evaluate(a,`document.querySelector('[data-lobby-whisper-target]')===null`),true);
  evidence.checks.push({name:'normal sender Join/Leave clears messages/target/draft and returns public channel without stale UI'});
  assert.equal(network.filter(e=>e.name==='PlayerInput'&&e.direction==='sent'&&e.payload?.fire).length,0);
  await stop(server);
  for(const page of [a,b,c])await waitUntil(page,`document.querySelector('[data-lobby-chat-status]')?.textContent.includes('连接已断开')&&document.querySelectorAll('[data-lobby-chat-log] li').length===0`);
  evidence.checks.push({name:'actual disconnect clears all session logs and shows status; focus and IME produced no battle fire'});
  evidence.network=network;evidence.noInjectedState=true;
  await writeFile('recovery/output/browser-lobby-whisper.json',JSON.stringify(evidence,null,2)+'\n');
  console.log('PASS M6-08-W three actual formal pages ordinary whisper success/refusal/isolation/lifecycle');
} catch (error) {
  await writeFile('recovery/output/browser-lobby-whisper.json', JSON.stringify({...evidence, status: 'FAIL', error: String(error), serverLog, network}, null, 2) + '\n');
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
