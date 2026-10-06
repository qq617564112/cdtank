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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3208', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-friends-browser-'));
let server, chrome, vite, ws;
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const resume=process.argv.includes('--lifecycle-only');
const run=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-friends-'+run;
const evidence = {status: 'PASS', scope: 'M6-09-B three formal account pages, source Add/Remove/FriendTab, real private selection, room presence, disconnect, reload and actual server restart.', mode: resume?'lifecycle-only':'full', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},session);
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

try {
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3208', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {serverLog += String(data);});
  server.stderr.on('data', data => {serverLog += String(data);});
  const deadline = Date.now() + 15000;
  while (!serverLog.includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
  assert(serverLog.includes('Server started'), serverLog);
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    server: {port: 5368, strictPort: true, host: '127.0.0.1', hmr: false,
      proxy: {'/game': {target: 'ws://127.0.0.1:3208', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=9568', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9568/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
      if (result.service.name === 'Friends' || result.service.name === 'RoomWhisper' || result.service.name === 'Rematch' || result.service.name === 'RoomSnapshot' || result.service.name === 'LobbyWhisper' || result.service.name === 'DisplayName' || result.service.name === 'LobbyPlayers' || result.service.name === 'Leave' || result.service.name === 'LobbyChat' || result.service.name === 'Account' || result.service.name === 'PlayerInput' || result.service.name === 'RoomChat'
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
    await command('Page.navigate',{url:'http://127.0.0.1:5368'},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-lobby-player-list]')?.dataset.sourceFontReady==='true'&&localStorage.getItem('cdtank-account-token')`);
  }
  const [a,b,c]=pages.map(p=>p.sessionId);
  for(const [page,name] of [[a,'好友甲'],[b,'好友乙'],[c,'好友丙']]) {
    await waitUntil(page,`document.querySelector('#player-name')?.disabled===false`);
    await input(page,'#player-name',name);await click(page,'[data-lobby-name-save]');
    await waitUntil(page,`document.querySelector('[data-lobby-identity]')?.dataset.confirmedName===${JSON.stringify(name)}`);
  }
  const accountId=async page=>network.filter(n=>n.page===page&&n.name==='Account'&&n.direction==='received'&&n.success).at(-1)?.response.accountId;
  const ids=await Promise.all([a,b,c].map(accountId));assert(ids.every(Boolean));
  const row=id=>`[data-lobby-player-account="${id}"]`;
  const list=page=>evaluate(page,listExpression);
  const records=page=>network.filter(n=>n.page===page&&n.name==='Friends'&&n.direction==='received'&&n.success).at(-1)?.response.friends;
  async function profile(page,id,keyboard=false){
    await waitUntil(page,`document.querySelector(${JSON.stringify(row(id))})`);
    if(keyboard){await click(page,row(id));await command('Input.dispatchKeyEvent',{type:'keyDown',key:'F10',code:'F10',windowsVirtualKeyCode:121,modifiers:8},page);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'F10',code:'F10',windowsVirtualKeyCode:121,modifiers:8},page);}
    else{
      const point=await evaluate(page,`(()=>{const r=document.querySelector(${JSON.stringify(row(id))}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'right',clickCount:1,...point},page);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'right',clickCount:1,...point},page);
    }
    await waitUntil(page,`document.querySelector('[data-player-info-account="${id}"] [data-player-info-friend-action]')`);
  }
  const closeProfile=page=>click(page,'[data-player-info-close]');
  await waitUntil(a,`document.querySelector(${JSON.stringify(row(ids[1]))})`);
  await profile(a,ids[1]);
  assert.equal(await evaluate(a,`document.querySelector('[data-player-info-friend-action]').dataset.sourceControl`),'btnAddFriend');
  await click(a,'[data-player-info-friend-action]');
  await waitUntil(a,`document.querySelector('[data-player-info-friend-action]').dataset.sourceControl==='btnRemoveFriend'&&!document.querySelector('[data-player-info-friend-action]').disabled`);
  await closeProfile(a);await click(a,'[data-lobby-friend-tab]');
  await waitUntil(a,`document.querySelector(${JSON.stringify(row(ids[1]))})`);
  assert.deepEqual((await list(a)).map(r=>r.accountId),[ids[1]]);
  await click(a,'[data-lobby-friend-tab]');await pause(200);
  assert.equal((await list(a)).length,1);
  evidence.checks.push({name:'source-add-authoritative-single-row-refresh',friends:records(a)});
  if(!resume){
  for(const page of [b,c]){await click(page,'[data-lobby-friend-tab]');await pause(150);assert.deepEqual(await list(page),[]);}
  evidence.checks.push({name:'unilateral-target-and-third-owner-empty'});
  await click(a,'[data-lobby-player-tab]');await profile(a,ids[0],true);await click(a,'[data-player-info-friend-action]');
  await waitUntil(a,`document.querySelector('[data-player-info-status]').textContent.includes('自己')`);
  assert.equal(records(a).length,1);
  evidence.checks.push({name:'self-rejected-retains-list',status:await evaluate(a,`document.querySelector('[data-player-info-status]').textContent`)});
  await closeProfile(a);await click(a,'[data-lobby-friend-tab]');await click(a,row(ids[1]));await press(a,'Enter','Enter');
  await waitUntil(a,`document.querySelector('[data-lobby-whisper-target]')?.value==='好友乙'`);
  await input(a,chatInput,'好友名单密语');await press(a,'Enter','Enter');
  await waitUntil(b,`${logExpression}.some(text=>text.includes('好友名单密语'))`);
  assert(!(await evaluate(c,logExpression)).some(text=>text.includes('好友名单密语')));
  assert(network.some(n=>n.page===a&&n.name==='LobbyWhisper'&&n.direction==='sent'&&n.payload.targetAccountId===ids[1]));
  evidence.checks.push({name:'friend-row-Enter-whisper-accountId-target-private-delivery'});
  }
  await click(b,'[data-room-card-create]');await waitUntil(b,`document.querySelector('[data-map-selector-mode="4"]')`);
  await click(b,'[data-map-selector-mode="4"]');await click(b,'[data-map-selector-map="7"]');await click(b,'[data-map-selector-confirm]');
  await waitUntil(b,`document.querySelector('[data-room-create-name]')`);await input(b,'[data-room-create-name]','好友状态房');await click(b,'[data-room-create-confirm]');
  await waitUntil(b,`(${worldExpression})?.phase==='WAITING'`);
  await waitUntil(a,`document.querySelector(${JSON.stringify(row(ids[1]))})?.textContent.includes('对局中')`);
  evidence.checks.push({name:'ordinary-create-room-presence',friends:records(a)});
  await waitUntil(b,`(${worldExpression})?.mapLoaded&&document.querySelector('[data-waiting-close]')&&!document.querySelector('[data-waiting-close]').disabled`);
  await evaluate(b,`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  await pause(200);
  evidence.waitingCloseBefore=await evaluate(b,`(()=>{const e=document.querySelector('[data-waiting-close]'),r=e.getBoundingClientRect();return{rect:r.toJSON(),disabled:e.disabled,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')?.dataset.sourceControl,top:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,600)}})()`);
  await waitUntil(b,`(()=>{const e=document.querySelector('[data-waiting-close]'),r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e})()`);
  await click(b,'[data-waiting-close]');await waitUntil(b,`!(${worldExpression})?.roomId&&document.querySelector('[data-lobby-friend-tab]')`);
  assert(network.some(n=>n.page===b&&n.name==='Leave'&&n.direction==='received'&&n.success));
  await waitUntil(a,`document.querySelector(${JSON.stringify(row(ids[1]))})&&!document.querySelector(${JSON.stringify(row(ids[1]))}).textContent.includes('对局中')`);
  evidence.checks.push({name:'normal-leave-returns-online',friends:records(a)});
  await command('Page.navigate',{url:'about:blank'},b);
  await waitUntil(a,`document.querySelector(${JSON.stringify(row(ids[1]))})?.textContent.includes('离线')`);
  evidence.checks.push({name:'target-page-disconnect-offline-retained',friends:records(a)});
  await profile(a,ids[1]);assert.equal(await evaluate(a,`document.querySelector('[data-player-info-friend-action]').dataset.sourceControl`),'btnRemoveFriend');await closeProfile(a);
  await command('Page.reload',{},a);await waitUntil(a,`document.querySelector('[data-lobby-friend-tab]')&&localStorage.getItem('cdtank-account-token')`);
  await click(a,'[data-lobby-friend-tab]');await waitUntil(a,`document.querySelector(${JSON.stringify(row(ids[1]))})?.textContent.includes('离线')`);
  assert.equal(await accountId(a),ids[0]);evidence.checks.push({name:'browser-reload-authenticated-owner-restores-list',friends:records(a)});
  await profile(a,ids[1]);await stop(server);
  await waitUntil(a,`!document.querySelector('[data-player-info]')`);
  await waitUntil(a,`document.querySelector('[data-lobby-presence-status]')?.textContent.includes('断开')`);
  assert.deepEqual(await list(a),[]);
  evidence.checks.push({name:'actual-server-disconnect-clears-friend-list-and-profile'});
  const offset=serverLog.length;
  server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:'3208',ACCOUNT_DB_PATH:join(directory,'accounts.sqlite')},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',data=>{serverLog+=String(data);});server.stderr.on('data',data=>{serverLog+=String(data);});
  const deadlineRestart=Date.now()+15000;while(!serverLog.slice(offset).includes('Server started')&&Date.now()<deadlineRestart)await pause(20);
  assert(serverLog.slice(offset).includes('Server started'),serverLog);
  await command('Page.reload',{},a);await waitUntil(a,`document.querySelector('[data-lobby-friend-tab]')&&document.querySelector('#player-name')?.disabled===false`);
  await click(a,'[data-lobby-friend-tab]');await waitUntil(a,`document.querySelector(${JSON.stringify(row(ids[1]))})?.textContent.includes('离线')`);
  evidence.checks.push({name:'actual-server-restart-same-database-restores-unilateral-list',friends:records(a)});
  await profile(a,ids[1],true);await click(a,'[data-player-info-friend-action]');
  await waitUntil(a,`document.querySelector('[data-player-info-friend-action]').dataset.sourceControl==='btnAddFriend'&&!document.querySelector('[data-player-info-friend-action]').disabled`);
  assert.deepEqual(records(a),[]);await closeProfile(a);assert.deepEqual(await list(a),[]);
  evidence.checks.push({name:'source-remove-authoritative-empty-list'});
  await command('Page.reload',{},a);await waitUntil(a,`document.querySelector('[data-lobby-friend-tab]')&&document.querySelector('#player-name')?.disabled===false`);await click(a,'[data-lobby-friend-tab]');await pause(200);assert.deepEqual(await list(a),[]);
  evidence.checks.push({name:'removed-relationship-stays-absent-after-reload'});
  const screenshot=await command('Page.captureScreenshot',{format:'png'},a);await writeFile(output+'-final.png',Buffer.from(screenshot.data,'base64'));
  evidence.accountIds=ids;evidence.network=network;evidence.noInjectedState=true;
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');console.log('PASS three formal pages friends '+output);
}catch(error){await writeFile(output+'.json',JSON.stringify({...evidence,status:'FAIL',error:String(error),serverLog,network},null,2)+'\n');throw error;}
finally{
  if(ws?.readyState===WebSocket.OPEN){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true});
}
