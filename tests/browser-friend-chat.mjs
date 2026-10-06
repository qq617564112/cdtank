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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3212', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-friend-chat-browser-'));
let server, chrome, vite, ws;
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const resume=process.argv.includes('--lifecycle-only');
const run=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-friend-chat-'+run;
const evidence = {status: 'PASS', scope: 'M6-08-F three formal pages ordinary friend channel, unilateral recipients/block exclusion, IME, WAITING/PLAYING/FINISHED/rematch and lifecycle cleanup.', mode: resume?'lifecycle-only':'full', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
    env: {...process.env, PORT: '3212', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite'), MATCH_TIME_LIMIT_SECONDS:'15'}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {serverLog += String(data);});
  server.stderr.on('data', data => {serverLog += String(data);});
  const deadline = Date.now() + 15000;
  while (!serverLog.includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
  assert(serverLog.includes('Server started'), serverLog);
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    plugins:[{name:'friend-channel-readiness-observer',transform(source,id){if(id.endsWith('/src/match/battle.ts'))return source+'\nconst original=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.friendChannelBattle=this;return original.call(this,value);};';}}],
    server: {port: 5372, strictPort: true, host: '127.0.0.1', hmr: false,
      proxy: {'/game': {target: 'ws://127.0.0.1:3212', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=9572', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9572/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
      if (result.service.name === 'FriendChat' || result.service.name === 'Blacklist' || result.service.name === 'Friends' || result.service.name === 'RoomWhisper' || result.service.name === 'Rematch' || result.service.name === 'RoomSnapshot' || result.service.name === 'LobbyWhisper' || result.service.name === 'DisplayName' || result.service.name === 'LobbyPlayers' || result.service.name === 'Leave' || result.service.name === 'LobbyChat' || result.service.name === 'Account' || result.service.name === 'PlayerInput' || result.service.name === 'RoomChat'
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
    await command('Page.navigate',{url:'http://127.0.0.1:5372'},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-lobby-player-list]')?.dataset.sourceFontReady==='true'&&localStorage.getItem('cdtank-account-token')`);
  }
  const [a,b,c]=pages.map(p=>p.sessionId);
  for(const [page,name] of [[a,'频道甲'],[b,'频道乙'],[c,'频道丙']]) {
    await waitUntil(page,`document.querySelector('#player-name')?.disabled===false`);
    await input(page,'#player-name',name);await click(page,'[data-lobby-name-save]');
    await waitUntil(page,`document.querySelector('[data-lobby-identity]')?.dataset.confirmedName===${JSON.stringify(name)}`);
  }
  const ids=pages.map(p=>network.filter(n=>n.page===p.sessionId&&n.name==='Account'&&n.direction==='received'&&n.success).at(-1)?.response.accountId);assert(ids.every(Boolean));
  const row=id=>`[data-lobby-player-account="${id}"]`;
  async function profile(page,id){await waitUntil(page,`document.querySelector(${JSON.stringify(row(id))})`);const point=await evaluate(page,`(()=>{const r=document.querySelector(${JSON.stringify(row(id))}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'right',clickCount:1,...point},page);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'right',clickCount:1,...point},page);await waitUntil(page,`document.querySelector('[data-player-info-account="${id}"] [data-player-info-friend-action]')`);}
  async function friend(target){await profile(a,ids[target]);await click(a,'[data-player-info-friend-action]');await waitUntil(a,`document.querySelector('[data-player-info-friend-action]').dataset.sourceControl==='btnRemoveFriend'&&!document.querySelector('[data-player-info-friend-action]').disabled`);await click(a,'[data-player-info-close]');}
  const roomRows=`[...document.querySelector('[data-chat-log]').children].map(e=>e.dataset.chatText??e.textContent)`;
  async function friendChannel(page,room=false){if(room)await waitUntil(page,`document.querySelector('[data-chat-channel]')`);if(!room){await click(page,'[data-lobby-channel-toggle]');await waitUntil(page,`document.querySelector('[data-lobby-channel="friend"]')`);await click(page,'[data-lobby-channel="friend"]');}
    else if(await evaluate(page,`document.querySelector('.source-battle-chat')!==null`)){const value=await evaluate(page,`document.querySelector('[data-chat-channel]').value`);await click(page,`[data-source-control="${value==='3'?'btnFriend':value==='2'?'btnPrivate':value==='1'?'btnTeam':'btnPublic'}"]`);await waitUntil(page,`!document.querySelector('[data-source-chat-menu]').hidden`);await click(page,'[data-chat-source-channel="3"]');}
    else{await click(page,'[data-chat-channel]');await press(page,'Home','Home');for(let i=0;i<3;i++)await press(page,'ArrowDown','ArrowDown');await press(page,'Enter','Enter');} }
  async function send(page,text,recipientPages,room=false,phase='LOBBY'){const from=network.length;const selector=room?'[data-chat-input]':chatInput;await input(page,selector,text);await press(page,'Enter','Enter');if(!recipientPages.length){await waitUntil(page,`${room?"document.querySelector('.battle-chat [role=status]')":"document.querySelector('[data-lobby-chat-status]')"}?.textContent.includes('在线好友')`);assert.equal(await evaluate(page,`document.querySelector('${selector}').value`),text);await pause(100);assert.equal(network.slice(from).filter(n=>n.name==='FriendChat'&&n.kind==='msg'&&n.direction==='received').length,0);}else{await waitUntil(page,`document.querySelector('${selector}').value===''`);for(const target of [page,...recipientPages])await waitUntil(target,`${target===a&&room?roomRows:logExpression}.some(t=>t.includes(${JSON.stringify(text)}))`);const delivered=network.slice(from).filter(n=>n.name==='FriendChat'&&n.kind==='msg'&&n.direction==='received');assert.equal(delivered.length,recipientPages.length+1);assert(delivered.every(n=>[page,...recipientPages].includes(n.page)));}evidence.checks.push({name:phase+(recipientPages.length?' friend success only intended accounts':' no recipients refusal retains draft'),text,requests:network.slice(from).filter(n=>n.name==='FriendChat'&&n.direction==='sent'),deliveries:network.slice(from).filter(n=>n.name==='FriendChat'&&n.kind==='msg'&&n.direction==='received')});}
  if(!resume){await friendChannel(a);await send(a,'无好友草稿',[]);await friend(1);await send(a,'中文好友消息',[b]);
  await friendChannel(b);await send(b,'单向无好友草稿',[]);
  await profile(b,ids[0]);await click(b,'[data-player-info-blacklist-action]');await waitUntil(b,`document.querySelector('[data-player-info-blacklist-action]').dataset.sourceControl==='btnRemoveBlacklist'&&!document.querySelector('[data-player-info-blacklist-action]').disabled`);await click(b,'[data-player-info-close]');await send(a,'屏蔽好友保稿',[]);
  await friend(2);await send(a,'排除屏蔽只送丙',[c]);
  await profile(b,ids[0]);await click(b,'[data-player-info-blacklist-action]');await waitUntil(b,`document.querySelector('[data-player-info-blacklist-action]').dataset.sourceControl==='btnAddBlacklist'&&!document.querySelector('[data-player-info-blacklist-action]').disabled`);await click(b,'[data-player-info-close]');await send(a,'两个单向好友',[b,c]);
  await input(a,chatInput,'输入法草稿');const imeFrom=network.length;await command('Input.imeSetComposition',{text:'中文',selectionStart:2,selectionEnd:2},a);await press(a,'Enter','Enter');await pause(100);assert.equal(network.slice(imeFrom).filter(n=>n.name==='FriendChat'&&n.direction==='sent').length,0);await command('Input.insertText',{text:'中文'},a);evidence.checks.push({name:'lobby IME candidate Enter does not send'});await send(a,'确认输入法好友',[b,c]);
  }else{await friend(1);await friend(2);}
  await click(a,'[data-room-card-create]');await waitUntil(a,`document.querySelector('[data-map-selector-mode="4"]')`);await click(a,'[data-map-selector-mode="4"]');await click(a,'[data-map-selector-map="7"]');await click(a,'[data-map-selector-confirm]');await waitUntil(a,`document.querySelector('[data-room-create-name]')`);await input(a,'[data-room-create-name]','好友频道房');await click(a,'[data-room-create-confirm]');await waitUntil(a,`(${worldExpression})?.mapLoaded&&(${worldExpression})?.phase==='WAITING'`);
  await friendChannel(a,true);await send(a,'WAITING好友频道',[b,c],true,'WAITING');
  await evaluate(a,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1],{EngineStore}=await import(url),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world'));engine.setHardwareScalingLevel(8);engine.resize()})()`);
  for(let i=0;i<2;i++){await click(a,'[data-add-cpu]');await waitUntil(a,`(${worldExpression}).players.length===${i+2}`);}await waitUntil(a,`window.friendChannelBattle?.players.resourcesReady&&!document.querySelector('[data-waiting-ready]')?.disabled`);await click(a,'[data-waiting-ready]');await waitUntil(a,`(${worldExpression}).phase==='PLAYING'&&document.querySelector('.source-battle-chat')`);await friendChannel(a,true);await send(a,'PLAYING源好友',[b,c],true,'PLAYING');
  await input(a,'[data-chat-input]','战斗IME');const battleIme=network.length;await command('Input.imeSetComposition',{text:'战斗',selectionStart:2,selectionEnd:2},a);await press(a,'Enter','Enter');await pause(100);assert.equal(network.slice(battleIme).filter(n=>n.name==='FriendChat'&&n.direction==='sent').length,0);await command('Input.insertText',{text:'战斗'},a);evidence.checks.push({name:'PLAYING IME candidate Enter does not send'});
  await waitUntil(a,`(${worldExpression}).phase==='FINISHED'`);await send(a,'FINISHED好友频道',[b,c],true,'FINISHED');
  await click(a,'[data-rematch]');await waitUntil(a,`(${worldExpression}).match.round===2`);await send(a,'再战当前局好友',[b,c],true,'ROUND2');assert.equal(evidence.checks.at(-1).requests[0].payload.round,2);
  await input(a,'[data-chat-input]','离房旧草稿');await click(a,'[data-leave-room]');await waitUntil(a,`!(${worldExpression})?.roomId&&document.querySelector('[data-lobby-chat-input]')`);assert.equal(await evaluate(a,`document.querySelector('${chatInput}').value`),'');assert.deepEqual(await evaluate(a,logExpression),[]);evidence.checks.push({name:'ordinary Leave clears old room draft/log and restores lobby'});
  await friendChannel(a);await input(a,chatInput,'断线草稿');await stop(server);await waitUntil(a,`document.querySelector('${chatStatus}').textContent.includes('断开')`);assert.equal(await evaluate(a,`document.querySelector('${chatInput}').value`),'');assert.deepEqual(await evaluate(a,logExpression),[]);evidence.checks.push({name:'actual disconnect clears friend draft/log'});
  evidence.accountIds=ids;evidence.network=network;evidence.noInjectedState=true;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');console.log('PASS formal friend channel '+output);
}catch(error){await writeFile(output+'.json',JSON.stringify({...evidence,status:'FAIL',error:String(error),serverLog,network},null,2)+'\n');throw error;}
finally{if(ws?.readyState===WebSocket.OPEN){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true});}
