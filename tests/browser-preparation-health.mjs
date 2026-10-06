import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {readOwnedRolePairMessage} from '../recovery/evidence/roles/role-owned-sources.ts';
import {readFile} from 'node:fs/promises';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const {WsClient} = require('tsrpc');
const {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3217', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-lobby-presence-'));
let server, chrome, vite, ws;
const auxiliary=[];
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const exitOnly=process.argv.includes('--exit-only');
const waitingOnly=process.argv.includes('--waiting-only');
const cleanupOnly=process.argv.includes('--cleanup-only');
const resume=process.argv.includes('--lifecycle-only')||cleanupOnly||waitingOnly||exitOnly;
const run=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-preparation-health';
const evidence = {status: 'PASS', scope: 'M2-01-PREP formal equipment mouse controls, mode4/map7 WAITING health, ordinary Ready, two natural20s rounds/Rematch/Leave; existing native owned account fixture.', mode: waitingOnly?'waiting-only':exitOnly?'exit-only':cleanupOnly?'cleanup-only':resume?'lifecycle-only':'full', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  await writeFile(`${output}-${name}.png`, Buffer.from(result.data, 'base64'));
}
async function submit(session, text) {
  await input(session, chatInput, text);
  await press(session, 'Enter', 'Enter');
}
try {
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3217', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite'), MATCH_TIME_LIMIT_SECONDS:'20'}, stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => {serverLog += String(data);});
  server.stderr.on('data', data => {serverLog += String(data);});
  const deadline = Date.now() + 15000;
  while (!serverLog.includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
  assert(serverLog.includes('Server started'), serverLog);
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets',
    plugins:[{name:'readiness-observer',transform(source,id){if(id.endsWith('/src/match/battle.ts'))return source+'\nconst old=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.roomWhisperBattle=this;return old.call(this,value);};';}}],
    server: {port: 5377, strictPort: true, host: '127.0.0.1', hmr: false,
      proxy: {'/game': {target: 'ws://127.0.0.1:3217', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome', [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--remote-debugging-port=9577', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9577/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
      if (result.service.name === 'RoomWhisper' || result.service.name === 'Rematch' || result.service.name === 'RoomSnapshot' || result.service.name === 'LobbyWhisper' || result.service.name === 'DisplayName' || result.service.name === 'LobbyPlayers' || result.service.name === 'Leave' || result.service.name === 'LobbyChat' || result.service.name === 'Account' || result.service.name === 'PlayerInput' || result.service.name === 'RoomChat'
          || result.service.name === 'Ready' || result.service.name === 'CreateRoom'
          || result.service.name === 'Join'
          || result.service.name === 'RoomEvent' || result.service.name === 'Cpu' || result.service.name === 'Autopilot' || result.service.name === 'ChangeTeam' || result.service.name === 'Equipment' || result.service.name === 'Inventory') {
        network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent',
          kind: result.type, name: result.service.name,
          ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err}
            : {payload: result.msg ?? result.req})});
      }
    }
  });
  for(let i=0;i<2;i++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5377'},sessionId);await waitUntil(sessionId,`document.querySelector('[data-lobby-player-list]')?.dataset.sourceFontReady==='true'&&localStorage.getItem('cdtank-account-token')`);
  }
  const [a,b]=pages.map(p=>p.sessionId),state=page=>evaluate(page,worldExpression);
  for(const [page,name] of [[a,'装备甲'],[b,'装备乙']]){await waitUntil(page,`document.querySelector('#player-name')?.disabled===false`);await input(page,'#player-name',name);await click(page,'[data-lobby-name-save]');await waitUntil(page,`document.querySelector('[data-lobby-identity]')?.dataset.confirmedName===${JSON.stringify(name)}`);}
  const store=new AccountStore(join(directory,'accounts.sqlite'));try{
    const token=await evaluate(a,`localStorage.getItem('cdtank-account-token')`),owner=store.open(token),fixture=JSON.parse(await readFile('recovery/output/role-owned-pair-native.json','utf8')).rows[0],pair=readOwnedRolePairMessage(new Uint8Array(fixture.raw),fixture.alignment,()=> '原角色');const base={name:'测试宠物',fields:new Map(pair.base.fields)},tank={name:'测试战车',fields:new Map(pair.equipment.fields)};base.fields.set(0,71);base.fields.set(8,1);tank.fields.set(0x1c,72);tank.fields.set(0x24,2);tank.fields.set(0x28,20011);tank.fields.set(0x2c,20012);tank.fields.set(0x30,20013);tank.fields.set(0x6c,3);for(const offset of [0x58,0x5c,0x60])tank.fields.set(offset,0);for(let slot=0;slot<6;slot++){base.fields.set(0x44+slot*4,0);base.fields.set(0x5c+slot*4,0);}store.replaceRoleRecords(owner.accountId,{base:[base],equipment:[tank]});const profile={bytes:new Uint8Array(0x170),strings:['角色名','资料']};const view=new DataView(profile.bytes.buffer);view.setUint32(0xa4,71,true);view.setUint32(0xa8,72,true);store.replaceRoleProfile(owner.accountId,profile);store.replaceInventory(owner.accountId,[13001,13002,14001,10001,10002,12001].map((itemTableId,index)=>({instanceId:81+index,itemTableId,ownedQuantity:1,battleQuantity:1,state:0,field8:0,float24Bits:0,float28Bits:0,float2cBits:0})));
    evidence.fixture={source:'role-owned-pair-native.json rows0;existing browser-home-equipment seed',petInstanceId:71,tankInstanceId:72,tankId:2,inventoryInstances:[81,82,83,84,85,86]};
  }finally{store.close();}
  await click(a,'[data-room-card-home]');await waitUntil(a,`document.querySelector('#home-inventory[open]')`);await waitUntil(a,`document.querySelector('#open-equipment')?.matches(':enabled')`);await click(a,'#open-equipment');await waitUntil(a,`document.querySelector('[data-equipment-item="83"]')&&document.querySelector('#home-equipment [data-role-preview]')?.dataset.renderedTankId==='2'`);
  await click(a,'[data-equipment-item="83"]');await click(a,'[data-equipment-slot="1"]');await waitUntil(a,`document.querySelector('#home-equipment > output')?.value==='部件已保存'&&document.querySelector('[data-equipment-slot="1"]').dataset.instanceId==='83'`);await screenshot(a,'equipped');await click(a,'[data-equipment-close]');await waitUntil(a,`!document.querySelector('#home-equipment[open]')`);
  await click(a,'[data-room-card-create]');await waitUntil(a,`document.querySelector('[data-map-selector-mode="4"]')`);await click(a,'[data-map-selector-mode="4"]');await click(a,'[data-map-selector-map="7"]');await click(a,'[data-map-selector-confirm]');await waitUntil(a,`document.querySelector('[data-room-create-name]')`);await input(a,'[data-room-create-name]','装备生命验收');await click(a,'[data-room-create-confirm]');await waitUntil(a,`(${worldExpression})?.mapLoaded&&(${worldExpression})?.phase==='WAITING'`);
  const waiting=await state(a),roomId=waiting.roomId,ownerId=waiting.playerId,owner=waiting.players.find(p=>p.id===ownerId);assert.equal(owner.tankId,2);assert.equal(owner.hp,owner.maxHp);assert(owner.hp>=0);evidence.waiting=waiting;await screenshot(a,'waiting');
  await waitUntil(b,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);const point=await evaluate(b,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...point},b);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...point},b);await waitUntil(b,`(${worldExpression})?.mapLoaded&&(${worldExpression})?.roomId===${JSON.stringify(roomId)}`);
  for(let i=0;i<2;i++){await click(a,'[data-add-cpu]');await waitUntil(a,`(${worldExpression}).players.length===${i+3}`);}
  for(const page of [a,b]){await evaluate(page,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1],{EngineStore}=await import(url),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world'));engine.setHardwareScalingLevel(8);engine.resize()})()`);await waitUntil(page,`window.roomWhisperBattle?.players.resourcesReady`);await click(page,'[data-autopilot]');}
  for(const page of [a,b])await click(page,'[data-waiting-ready]');for(const page of [a,b])await waitUntil(page,`(${worldExpression}).phase==='PLAYING'&&(${worldExpression}).renderedPlayers===4`);evidence.initial=await state(a);await screenshot(a,'playing');
  for(const page of [a,b])await waitUntil(page,`(${worldExpression}).phase==='FINISHED'`);evidence.finished=await state(a);assert.equal(evidence.finished.match.result.reason,'TIME_LIMIT');await screenshot(a,'finished');
  const first=network.filter(e=>e.page===a&&e.direction==='received'&&e.name==='RoomSnapshot'&&e.payload.match?.round===1).map(e=>e.payload),firstPlaying=first.find(s=>s.phase==='PLAYING'),initialOwner=firstPlaying.players.find(p=>p.id===ownerId);assert.equal(initialOwner.hp,initialOwner.maxHp);for(const snapshot of first)for(const p of snapshot.players)assert(p.hp>=0&&p.hp<=p.maxHp);assert(network.some(e=>e.name==='RoomEvent'&&e.direction==='received'&&e.payload.type==='hit'));
  for(const page of [a,b])await click(page,'[data-rematch]');for(const page of [a,b])await waitUntil(page,`(${worldExpression}).match.round===2&&(${worldExpression}).phase==='PLAYING'`);evidence.rematch=await state(a);const round2=network.filter(e=>e.page===a&&e.direction==='received'&&e.name==='RoomSnapshot'&&e.payload.match?.round===2).map(e=>e.payload),reset=round2.find(s=>s.phase==='PLAYING').players.find(p=>p.id===ownerId);assert.equal(reset.hp,reset.maxHp);await screenshot(b,'round2');
  for(const page of [a,b])await waitUntil(page,`(${worldExpression}).match.round===2&&(${worldExpression}).phase==='FINISHED'`);evidence.round2Finished=await state(a);assert.equal(evidence.round2Finished.match.result.reason,'TIME_LIMIT');for(const page of [a,b]){await click(page,'[data-leave-room]');await waitUntil(page,`document.querySelector('[data-lobby-chat-input]')&&!document.querySelector('#battle-status')?.dataset.world`);}
  evidence.checks.push({name:'normal owned equipment WAITING→Ready→two natural rounds→Rematch/Leave',waitingHealth:{hp:owner.hp,maxHp:owner.maxHp},initialHealth:{hp:initialOwner.hp,maxHp:initialOwner.maxHp},rematchHealth:{hp:reset.hp,maxHp:reset.maxHp}});evidence.network=network;evidence.noInjectedBattleState=true;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({status:'PASS',waitingHp:owner.hp,waitingMaxHp:owner.maxHp,firstRound:evidence.finished.match.result.reason,round2:evidence.round2Finished.match.result.reason}));
}catch(error){await writeFile(output+'.json',JSON.stringify({...evidence,status:'FAIL',error:String(error),diagnostics:await Promise.all(pages.map(async p=>({session:p.sessionId,state:await evaluate(p.sessionId,`({equipment:document.querySelector('#home-equipment')?.outerHTML,inventory:document.querySelector('#home-inventory')?.outerHTML})`).catch(e=>String(e))}))),serverLog,network},null,2)+'\n');throw error;}
finally{if(ws?.readyState===WebSocket.OPEN){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await writeFile(output+'.log',serverLog);await rm(directory,{recursive:true,force:true});}
