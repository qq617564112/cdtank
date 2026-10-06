import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AccountStore} from '../apps/server/src/account-store.ts';
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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3287', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-reload-draw-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-04-RELOAD-DRAW targeted 4K actual full visible source bar capture, ordinary Space and Leave.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function stop(process) {
  if (process?.exitCode === null && process.signalCode === null) {
    const ended = new Promise(resolve => process.once('exit', resolve));
    process.kill();
    await ended;
  }
}

const modal = 'dialog[data-waiting-room]';
const worldExpression = `JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')`;
const world = session => evaluate(session, worldExpression);
async function select(session, selector, value) {
  const index = await evaluate(session, `[...document.querySelector(${JSON.stringify(selector)}).options].filter(o=>!o.disabled).findIndex(o=>o.value===${JSON.stringify(String(value))})`);
  assert(index >= 0);
  await click(session, selector);await press(session,'Home','Home');
  for(let step=0;step<index;step++)await press(session,'ArrowDown','ArrowDown');
  await press(session,'Enter','Enter');
  assert.equal(await evaluate(session,`document.querySelector(${JSON.stringify(selector)}).value`),String(value));
}
async function input(session, selector, value) {
  await click(session,selector);
  await key(session,'a','KeyA','keyDown',{modifiers:2});await key(session,'a','KeyA','keyUp',{modifiers:2});
  await command('Input.insertText',{text:String(value)},session);
}
async function open(session) {
  await click(session,'[data-open-waiting-room]');
  await waitUntil(session,`document.querySelector('${modal}')?.open&&document.querySelector('[data-waiting-source-player]')`);
}
async function keyboardActivate(session, selector) {
  await command('Page.bringToFront',{},session);
  for(let step=0;step<40;step++) {
    if(await evaluate(session,`document.activeElement?.matches(${JSON.stringify(selector)})`)) {await press(session,'Enter','Enter');return;}
    await press(session,'Tab','Tab');
  }
  throw new Error('Keyboard could not reach '+selector);
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
async function waitUntil(session, expression, timeout = 90000) {
  const deadline = Date.now() + timeout;
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
function parseClientInput(bytes) {
  const envelope = TransportDataUtil.tsbuffer.decode(bytes, 'ServerInputData');
  assert(envelope.isSucc, envelope.errMsg);
  const service = decoder.serviceMap.id2Service[envelope.value.serviceId];
  const payload = decoder.tsbuffer.decode(envelope.value.buffer, service.type === 'api' ? service.reqSchemaId : service.msgSchemaId);
  assert(payload.isSucc, payload.errMsg);
  return {isSucc: true, result: {type: service.type, service, ...(service.type === 'api' ? {req: payload.value} : {msg: payload.value})}};
}
async function key(session, key, code, type = 'keyDown', options = {}) {
  await command('Input.dispatchKeyEvent', {type, key, code, ...(type === 'keyDown' && (key === 'Enter' || key.length === 1) ? {text: key === 'Enter' ? '\r' : key} : {}), ...options, windowsVirtualKeyCode: (/^F(?:[5-9]|1[0-2])$/.test(code) ? 111 + Number(code.slice(1)) : ({Tab: 9, Enter: 13, Escape: 27, Home: 36, End: 35, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, ' ': 32})[key] ?? key.toUpperCase().charCodeAt(0))}, session);
}
async function press(session, value, code) {
  await key(session, value, code);
  await key(session, value, code, 'keyUp');
}
async function screenshot(session, name) {
  await writeFile(`${output}-partial.json`,JSON.stringify(evidence,null,2)+'\n');
  const result = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`${output}-${name}.png`, Buffer.from(result.data, 'base64'));
}
const output = 'recovery/output/browser-reload-draw-fourk-'+new Date().toISOString().replace(/[:.]/g,'-');
await mkdir('recovery/output', {recursive: true});
async function ready(session) {
  await waitUntil(session, `document.querySelector('#tank')?.options.length===21&&localStorage.getItem('cdtank-account-token')&&!document.querySelector('#create-room').disabled&&document.querySelector('#room-min-players')`);
}
async function newPage(browserContextId, width = 1920, height = 1080) {
  const {targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  pages.push({targetId, sessionId});
  await command('Network.enable', {}, sessionId);
  await command('Page.enable', {}, sessionId);
  await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false}, sessionId);
  await command('Page.navigate', {url: 'http://127.0.0.1:5317'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3287', MATCH_TIME_LIMIT_SECONDS: '300', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9517', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9517/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['Account', 'CreateRoom', 'Join', 'Ready', 'ChangeTeam', 'Leave', 'PlayerInput', 'RoomChat', 'RoomEvent', 'ManageCpu', 'Rematch', 'RoomSnapshot'].includes(result.service.name)) {
      network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent', kind: result.type, name: result.service.name,
        ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err} : {payload: result.msg ?? result.req})});
    }
  });
}
const crossbar='[data-source-control="prgCrossbar"]';
async function sample(page){return evaluate(page,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world??'null'),p=w?.players.find(p=>p.id===w.playerId),e=document.querySelector('${crossbar}'),r=e.getBoundingClientRect(),root=document.querySelector('#original-battle-hud'),i=e.querySelector('.source-progress-image'),b=e.querySelector('.source-progress-background');return {at:performance.now(),viewport:{width:innerWidth,height:innerHeight},world:w,reload:p?.reload,alive:p?.alive,hidden:e.hidden,scale:root.getBoundingClientRect().width/800,rect:r.toJSON(),fraction:Number(e.dataset.sourceProgressFraction),extent:Number(e.dataset.sourceProgressExtent),colour:e.dataset.sourceProgressColour,opacity:getComputedStyle(e).opacity,format:e.dataset.progressFormat,clip:e.querySelector('.source-progress-fill').style.clipPath,image:{asset:getComputedStyle(i).backgroundImage,size:getComputedStyle(i).backgroundSize,width:getComputedStyle(i).width,height:getComputedStyle(i).height,repeat:getComputedStyle(i).backgroundRepeat,opacity:getComputedStyle(i).opacity},background:{asset:getComputedStyle(b).backgroundImage,size:getComputedStyle(b).backgroundSize},matrix:e.querySelector('feColorMatrix').getAttribute('values')};})()`);}
function verify(record){assert(!record.hidden);assert.equal(record.format,'Vertical');assert.equal(record.colour,'80FFFFFF');assert.equal(record.opacity,'0.6');assert.equal(record.image.opacity,'1');assert.equal(record.extent,Math.floor(Math.fround(37*record.scale)*record.fraction+.5));assert(record.image.asset.includes('/77/48.png'));assert(record.background.asset.includes('/77/47.png'));assert.equal(record.image.repeat,'repeat');assert(!record.clip.includes('%'));const scale=record.scale,viewport=record.viewport,expected=[(viewport.width-800*scale)/2+373*scale,(viewport.height-600*scale)/2+234*scale,50*scale,37*scale];assert([record.rect.x,record.rect.y,record.rect.width,record.rect.height].every((v,i)=>Math.abs(v-expected[i])<.05));const tile=record.image.size.split(/\s+/).map(Number.parseFloat);assert(Math.abs(tile[0]*scale-Math.round(Math.fround(50*Math.fround(scale))))<.001);assert(Math.abs(tile[1]*scale-Math.round(Math.fround(37*Math.fround(scale))))<.001);assert.equal(record.matrix.split(/\s+/).map(Number).filter((n,i)=>[0,6,12,18].includes(i)).join(','),'1,1,1,1');}
async function install(page){await evaluate(page,`window.reloadRows=[];window.reloadTimer=setInterval(()=>{const w=JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null'),p=w?.players.find(p=>p.id===w.playerId),e=document.querySelector('${crossbar}');if(!w||!e)return;const row={at:performance.now(),phase:w.phase,alive:p.alive,hp:p.hp,reload:p.reload,hidden:e.hidden,fraction:Number(e.dataset.sourceProgressFraction),extent:Number(e.dataset.sourceProgressExtent),colour:e.dataset.sourceProgressColour};if(JSON.stringify(row)!==JSON.stringify(window.reloadRows.at(-1)))window.reloadRows.push(row)},40)`);}
async function joinRoom(page,roomId) {await click(page,'#refresh-rooms');await waitUntil(page,`[...document.querySelector('#room').options].some(o=>o.value===${JSON.stringify(roomId)})&&!document.querySelector('#refresh-rooms').disabled`);await select(page,'#room',roomId);await click(page,'#join');await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);}
async function fire(page){await click(page,'#world');await key(page,' ','Space');await pause(80);await key(page,' ','Space','keyUp');}
try {
  await launchServer();vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5317,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3287',ws:true,rewrite:()=> '/'}}}});await vite.listen();await launchBrowser();const sessions=[];
  for(const name of ['消息面板甲','消息面板乙']){const {browserContextId}=await command('Target.createBrowserContext');const page=await newPage(browserContextId);sessions.push(page);await input(page,'#player-name',name);}
  const [a,b]=sessions;
  const store=new AccountStore(join(directory,'accounts.sqlite'));
  try{const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(r=>r.tankId===1&&r.part===0),fields=value=>new Map(Object.entries(value).map(([k,v])=>[Number(k),v]));for(const page of sessions){const owner=store.open(await evaluate(page,"localStorage.getItem('cdtank-account-token')")),equipment={name:'原战车属性',fields:fields(native.equipment)},base={name:'原宠物属性',fields:fields(native.base)};equipment.fields.set(0x1c,72);equipment.fields.set(0x24,1);equipment.fields.set(0x28,10011);equipment.fields.set(0x2c,10012);equipment.fields.set(0x30,10013);store.replaceRoleRecords(owner.accountId,{base:[base],equipment:[equipment]});const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa8,72,true);view.setUint32(0xa4,base.fields.get(0),true);store.replaceRoleProfile(owner.accountId,{bytes,strings:['','']});}}finally{store.close();}
  evidence.fixture={native:'world-role-attributes-native.json tank1/part0',scope:'Explicit original account role attributes; combat hit/death/respawn from ordinary CPU/autopilot, no combat state injection.'};
  for(const page of sessions)await evaluate(page,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1],{EngineStore}=await import(url),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world'));engine.setHardwareScalingLevel(6);engine.resize();return true})()`);
  await click(a,'#create-room-controls > summary');await select(a,'#room-mode',1);await select(a,'#room-map',7);await input(a,'#room-min-players',2);await click(a,'#create-room');await waitUntil(a,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);const initial=await world(a);await joinRoom(b,initial.roomId);
  for(let cpu=0;cpu<2;cpu++){await click(a,'[data-add-cpu]');await waitUntil(a,`(${worldExpression}).players.filter(p=>p.isCpu).length===${cpu+1}&&!document.querySelector('[data-add-cpu]').disabled`);}
  for(const page of sessions)await waitUntil(page,`(${worldExpression}).players.length===4&&(${worldExpression}).renderedPlayers===4&&(${worldExpression}).renderedActions.length===4`);
  for(const page of [b,a]){await open(page);await keyboardActivate(page,'[data-waiting-ready]');await waitUntil(page,`(${worldExpression}).match.readyPlayerIds.includes((${worldExpression}).playerId)||(${worldExpression}).phase==='PLAYING'`);}
  for(const page of sessions)await waitUntil(page,`(${worldExpression}).phase==='PLAYING'&&!document.querySelector('${modal}')`);
  for(const page of sessions)await install(page);
  const width=3840,height=2160;
  await command('Page.bringToFront',{},a);await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},a);await waitUntil(a,`Math.abs(document.querySelector('#original-battle-hud').getBoundingClientRect().width/800-3.6)<.0001`);
  evidence.captures=[];let accepted=false;
  for(let attempt=0;attempt<4;attempt++){
    await waitUntil(a,`(${worldExpression}).players.find(p=>p.id===(${worldExpression}).playerId).alive&&Number(document.querySelector('${crossbar}').dataset.sourceProgressFraction)===1`);
    const before=await sample(a);await fire(a);await waitUntil(a,`(${worldExpression}).players.find(p=>p.id===(${worldExpression}).playerId).reload.startedAt>0&&(${worldExpression}).players.find(p=>p.id===(${worldExpression}).playerId).reload.startedAt!==${before.reload.startedAt}`,3000);
    await waitUntil(a,`Number(document.querySelector('${crossbar}').dataset.sourceProgressFraction)<.95&&!document.querySelector('${crossbar}').hidden`,3000);
    await waitUntil(a,`Number(document.querySelector('${crossbar}').dataset.sourceProgressFraction)===1&&!document.querySelector('${crossbar}').hidden`);const full=await sample(a);verify(full);
    const r=full.rect,shot=await command('Page.captureScreenshot',{format:'png',clip:{x:r.x,y:r.y,width:r.width,height:r.height,scale:1}},a);const crop=output+'-attempt'+attempt+'-full-crop.png';await writeFile(crop,Buffer.from(shot.data,'base64'));const afterCrop=await sample(a);
    await screenshot(a,'attempt'+attempt+'-4k-full');const afterPage=await sample(a);
    const valid=afterCrop.alive&&!afterCrop.hidden&&afterCrop.fraction===1&&afterPage.alive&&!afterPage.hidden&&afterPage.fraction===1;
    evidence.captures.push({attempt,before,full,afterCrop,afterPage,crop,page:output+'-attempt'+attempt+'-4k-full.png',valid});if(valid){accepted=true;break;}
  }
  assert(accepted,'Actual 4K full source bar must stay visible throughout crop and whole-page capture');evidence.checks.push({name:'Ordinary 4K Space creates real reload then full original bar remains alive/visible/full across actual crop and page captures'});
  for(const page of sessions){await evaluate(page,'clearInterval(window.reloadTimer)');await click(page,'#leave');await waitUntil(page,`(${worldExpression})===null&&document.querySelector('#original-battle-hud')?.hidden`);const cleared=await sample(page);assert(cleared.hidden);assert.equal(cleared.fraction,1);}
  evidence.checks.push({name:'Both ordinary Leave clear reload and hide source HUD'});evidence.status='PASS';console.log('PASS: targeted actual visible/full 4K prgCrossbar capture and Leave; '+output);
} catch(error){evidence.status='FAIL';evidence.error=error.stack??String(error);if(pages[0]){evidence.failureWorld=await world(pages[0].sessionId).catch(()=>null);evidence.failureSample=await sample(pages[0].sessionId).catch(()=>null);await screenshot(pages[0].sessionId,'failure').catch(()=>{});}throw error;
} finally {if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3287,vite:5317,chrome:9517};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);}
