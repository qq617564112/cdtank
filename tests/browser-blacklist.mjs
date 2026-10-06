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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3210', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-blacklist-browser-'));
let server, chrome, vite, ws;
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const playingOnly=process.argv.includes('--playing-only');
const resume=process.argv.includes('--lifecycle-only')||playingOnly;
const run=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-blacklist-'+run;
const evidence = {status: 'PASS', scope: 'M6-09-K three formal account pages, source Add/Remove blacklist, lobby/room whisper refusal and draft retention, unblock and actual SQLite server restart.', mode: playingOnly?'playing-only':resume?'lifecycle-only':'full', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
    env: {...process.env, PORT: '3210', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite'), MATCH_TIME_LIMIT_SECONDS:'8'}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {serverLog += String(data);});
  server.stderr.on('data', data => {serverLog += String(data);});
  const deadline = Date.now() + 15000;
  while (!serverLog.includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
  assert(serverLog.includes('Server started'), serverLog);
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    plugins:[{name:'blacklist-readiness-observer',transform(source,id){if(playingOnly&&id.endsWith('/src/match/battle.ts'))return source+'\nconst original=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.blacklistBattle=this;return original.call(this,value);};';}}],
    server: {port: 5370, strictPort: true, host: '127.0.0.1', hmr: false,
      proxy: {'/game': {target: 'ws://127.0.0.1:3210', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=9570', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9570/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
      if (result.service.name === 'Blacklist' || result.service.name === 'Friends' || result.service.name === 'RoomWhisper' || result.service.name === 'Rematch' || result.service.name === 'RoomSnapshot' || result.service.name === 'LobbyWhisper' || result.service.name === 'DisplayName' || result.service.name === 'LobbyPlayers' || result.service.name === 'Leave' || result.service.name === 'LobbyChat' || result.service.name === 'Account' || result.service.name === 'PlayerInput' || result.service.name === 'RoomChat'
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
    await command('Page.navigate',{url:'http://127.0.0.1:5370'},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-lobby-player-list]')?.dataset.sourceFontReady==='true'&&localStorage.getItem('cdtank-account-token')`);
  }
  const [a,b,c]=pages.map(p=>p.sessionId);
  for(const [page,name] of [[a,'屏蔽甲'],[b,'屏蔽乙'],[c,'屏蔽丙']]) {
    await waitUntil(page,`document.querySelector('#player-name')?.disabled===false`);
    await input(page,'#player-name',name);await click(page,'[data-lobby-name-save]');
    await waitUntil(page,`document.querySelector('[data-lobby-identity]')?.dataset.confirmedName===${JSON.stringify(name)}`);
  }
  const accountId=async page=>network.filter(n=>n.page===page&&n.name==='Account'&&n.direction==='received'&&n.success).at(-1)?.response.accountId;
  const ids=await Promise.all([a,b,c].map(accountId));assert(ids.every(Boolean));
  const row=id=>`[data-lobby-player-account="${id}"]`;
  const action='[data-player-info-blacklist-action]';
  async function profile(page,id){await waitUntil(page,`document.querySelector(${JSON.stringify(row(id))})`);const point=await evaluate(page,`(()=>{const r=document.querySelector(${JSON.stringify(row(id))}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'right',clickCount:1,...point},page);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'right',clickCount:1,...point},page);await waitUntil(page,`document.querySelector('[data-player-info-account="${id}"] ${action}')`);}
  async function change(page,source,after){await waitUntil(page,`document.querySelector('${action}').dataset.sourceControl===${JSON.stringify(source)}&&!document.querySelector('${action}').disabled`);await click(page,action);await waitUntil(page,`document.querySelector('${action}').dataset.sourceControl===${JSON.stringify(after)}&&!document.querySelector('${action}').disabled`);}
  const closeProfile=page=>click(page,'[data-player-info-close]');
  const messages=()=>network.filter(n=>n.direction==='received'&&n.kind==='msg'&&['LobbyWhisper','RoomWhisper'].includes(n.name)).length;
  async function sendLobby(text,blocked){await click(a,row(ids[1]));await press(a,'Enter','Enter');await waitUntil(a,`document.querySelector('[data-lobby-whisper-target]')?.value==='屏蔽乙'`);const before=messages();await input(a,chatInput,text);await press(a,'Enter','Enter');if(blocked){await waitUntil(a,`document.querySelector('${chatStatus}').textContent.includes('屏蔽')`);assert.equal(await evaluate(a,`document.querySelector('${chatInput}').value`),text);await pause(100);assert.equal(messages(),before);assert(network.some(n=>n.page===a&&n.name==='LobbyWhisper'&&n.direction==='received'&&!n.success&&n.response.code==='WHISPER_BLOCKED'));}else{await waitUntil(b,`${logExpression}.some(t=>t.includes(${JSON.stringify(text)}))`);await waitUntil(a,`document.querySelector('${chatInput}').value===''`);assert(!(await evaluate(c,logExpression)).some(t=>t.includes(text)));}evidence.checks.push({name:blocked?'source-lobby-whisper-blocked-draft-retained-no-delivery':'source-lobby-whisper-unblocked-delivery',text});}
  if(playingOnly){await profile(b,ids[0]);await click(b,'[data-player-info-friend-action]');await waitUntil(b,`document.querySelector('[data-player-info-friend-action]').dataset.sourceControl==='btnRemoveFriend'&&!document.querySelector('[data-player-info-friend-action]').disabled`);await closeProfile(b);}
  await profile(b,ids[0]);await change(b,'btnAddBlacklist','btnRemoveBlacklist');await closeProfile(b);
  evidence.checks.push({name:'source-blacklist-add-confirmed',blocked:network.filter(n=>n.page===b&&n.name==='Blacklist'&&n.direction==='received'&&n.success).at(-1)?.response.blocked});
  if(!resume){
  await sendLobby('大厅拒绝草稿',true);
  await profile(b,ids[0]);await change(b,'btnRemoveBlacklist','btnAddBlacklist');await closeProfile(b);await sendLobby('解除大厅成功',false);
  await profile(b,ids[0]);await change(b,'btnAddBlacklist','btnRemoveBlacklist');await closeProfile(b);
  }
  await click(a,'[data-room-card-create]');await waitUntil(a,`document.querySelector('[data-map-selector-mode="4"]')`);await click(a,'[data-map-selector-mode="4"]');await click(a,'[data-map-selector-map="7"]');await click(a,'[data-map-selector-confirm]');await waitUntil(a,`document.querySelector('[data-room-create-name]')`);await input(a,'[data-room-create-name]','黑名单验收');await click(a,'[data-room-create-confirm]');
  await waitUntil(a,`(${worldExpression})?.mapLoaded&&(${worldExpression})?.phase==='WAITING'&&document.querySelector('[data-chat-channel]')`);
  async function privateMode(page){
    if(await evaluate(page,`document.querySelector('.source-battle-chat')!==null`)){
      const value=await evaluate(page,`document.querySelector('[data-chat-channel]').value`);await click(page,`[data-source-control="${value==='2'?'btnPrivate':value==='1'?'btnTeam':'btnPublic'}"]`);await waitUntil(page,`!document.querySelector('[data-source-chat-menu]').hidden`);await click(page,'[data-chat-source-channel="2"]');
    }else{await click(page,'[data-chat-channel]');await press(page,'Home','Home');await press(page,'ArrowDown','ArrowDown');await press(page,'ArrowDown','ArrowDown');await press(page,'Enter','Enter');}
    await waitUntil(page,`document.querySelector('[data-chat-whisper-target]')`);
  }
  await privateMode(a);
  await input(a,'[data-chat-whisper-target]','屏蔽乙');
  async function roomSend(text,blocked){const before=messages();await input(a,'[data-chat-input]',text);await press(a,'Enter','Enter');if(blocked){await waitUntil(a,`document.querySelector('.battle-chat [role=status]')?.textContent.includes('屏蔽')`);assert.equal(await evaluate(a,`document.querySelector('[data-chat-input]').value`),text);await pause(100);assert.equal(messages(),before);assert(network.some(n=>n.page===a&&n.name==='RoomWhisper'&&n.direction==='received'&&!n.success&&n.response.code==='WHISPER_BLOCKED'));}else{await waitUntil(b,`${logExpression}.some(t=>t.includes(${JSON.stringify(text)}))`);await waitUntil(a,`document.querySelector('[data-chat-input]').value===''`);assert(!(await evaluate(c,logExpression)).some(t=>t.includes(text)));}evidence.checks.push({name:blocked?'source-room-whisper-blocked-draft-retained-no-delivery':'source-room-whisper-unblocked-cross-lobby-delivery',text});}
  if(playingOnly){
    await evaluate(a,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1],{EngineStore}=await import(url),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world'));engine.setHardwareScalingLevel(8);engine.resize()})()`);
    for(let i=0;i<2;i++){await click(a,'[data-add-cpu]');await waitUntil(a,`(${worldExpression}).players.length===${i+2}`);}
    await waitUntil(a,`window.blacklistBattle?.players.resourcesReady&&document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await click(a,'[data-waiting-ready]');await waitUntil(a,`(${worldExpression}).phase==='PLAYING'&&document.querySelector('.source-battle-chat')`);
    evidence.playingBeforeBlock=await evaluate(a,worldExpression);await roomSend('战斗屏蔽草稿',true);
    await click(b,'[data-lobby-friend-tab]');await profile(b,ids[0]);await change(b,'btnRemoveBlacklist','btnAddBlacklist');await closeProfile(b);await roomSend('战斗解除成功',false);evidence.phaseAfterUnblock=await evaluate(a,`(${worldExpression}).phase`);
  }else{
  await roomSend('房间拒绝草稿',true);
  // Return the sender through the ordinary source Close so the receiver can open its lobby profile.
  await waitUntil(a,`document.querySelector('[data-waiting-close]')&&!document.querySelector('[data-waiting-close]').disabled&&(()=>{const e=document.querySelector('[data-waiting-close]'),r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e})()`);await click(a,'[data-waiting-close]');await waitUntil(a,`!(${worldExpression})?.roomId`);
  await profile(b,ids[0]);await change(b,'btnRemoveBlacklist','btnAddBlacklist');await closeProfile(b);
  await click(a,'[data-room-card-create]');await waitUntil(a,`document.querySelector('[data-map-selector-mode="4"]')`);await click(a,'[data-map-selector-mode="4"]');await click(a,'[data-map-selector-map="7"]');await click(a,'[data-map-selector-confirm]');await waitUntil(a,`document.querySelector('[data-room-create-name]')`);await input(a,'[data-room-create-name]','解除屏蔽房');await click(a,'[data-room-create-confirm]');await waitUntil(a,`(${worldExpression})?.mapLoaded&&(${worldExpression})?.phase==='WAITING'&&document.querySelector('[data-chat-channel]')`);
  await privateMode(a);await input(a,'[data-chat-whisper-target]','屏蔽乙');await roomSend('解除房间成功',false);
  await waitUntil(a,`document.querySelector('[data-waiting-close]')&&!document.querySelector('[data-waiting-close]').disabled&&(()=>{const e=document.querySelector('[data-waiting-close]'),r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e})()`);await click(a,'[data-waiting-close]');await waitUntil(a,`!(${worldExpression})?.roomId`);
  await profile(b,ids[0]);await change(b,'btnAddBlacklist','btnRemoveBlacklist');await closeProfile(b);
  await stop(server);const offset=serverLog.length;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:'3210',ACCOUNT_DB_PATH:join(directory,'accounts.sqlite')},stdio:['ignore','pipe','pipe']});server.stdout.on('data',d=>{serverLog+=String(d);});server.stderr.on('data',d=>{serverLog+=String(d);});const restartDeadline=Date.now()+15000;while(!serverLog.slice(offset).includes('Server started')&&Date.now()<restartDeadline)await pause(20);assert(serverLog.slice(offset).includes('Server started'));
  for(const page of [a,b,c]){await command('Page.reload',{},page);await waitUntil(page,`document.querySelector('#player-name')?.disabled===false&&document.querySelector('[data-lobby-player-list]')?.dataset.sourceFontReady==='true'`);}
  assert.equal(await accountId(a),ids[0]);assert.equal(await accountId(b),ids[1]);
  await profile(b,ids[0]);assert.equal(await evaluate(b,`document.querySelector('${action}').dataset.sourceControl`),'btnRemoveBlacklist');await closeProfile(b);
  evidence.checks.push({name:'actual-server-restart-restores-blacklist-source-remove-state'});
  await sendLobby('重启屏蔽草稿',true);await profile(b,ids[0]);await change(b,'btnRemoveBlacklist','btnAddBlacklist');await closeProfile(b);await sendLobby('重启解除成功',false);
  }
  const shot=await command('Page.captureScreenshot',{format:'png'},b);await writeFile(output+'-final.png',Buffer.from(shot.data,'base64'));evidence.accountIds=ids;evidence.network=network;evidence.noInjectedState=true;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');console.log('PASS three formal blacklist pages '+output);
}catch(error){await writeFile(output+'.json',JSON.stringify({...evidence,status:'FAIL',error:String(error),serverLog,network},null,2)+'\n');throw error;}
finally{if(ws?.readyState===WebSocket.OPEN){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true});}
