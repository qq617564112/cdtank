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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3286', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-team-info-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-04-LIFE-DRAW original progress colours/texture/pixel clip, real CPU ordinary hit/death/respawn, source 800/1080p/4K and Leave.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = 'recovery/output/browser-life-draw-'+new Date().toISOString().replace(/[:.]/g,'-');
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5316'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3286', MATCH_TIME_LIMIT_SECONDS: '300', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9516', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9516/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
}const layoutPath='ui/layouts/game_main_info_team.xml';
async function installObserver(session){await evaluate(session,`window.lifeRows=[];window.lifeTimer=setInterval(()=>{const w=JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null');if(!w)return;const bars=[...document.querySelectorAll('#original-battle-hud [role=progressbar][data-source-progress-fraction]')].map(e=>{const id=e.dataset.sourceControl==='prgLife'?w.playerId:e.closest('[data-player-id]')?.dataset.playerId,p=w.players.find(p=>p.id===id);return {name:e.dataset.sourceControl,id,hp:p?.hp,maxHp:p?.maxHp,alive:p?.alive,value:Number(e.getAttribute('aria-valuenow')),fraction:Number(e.dataset.sourceProgressFraction),extent:Number(e.dataset.sourceProgressExtent),colour:e.dataset.sourceProgressColour,clip:e.querySelector('.source-progress-fill').style.clipPath};}).filter(r=>r.hp!==undefined&&r.hp===r.value);const row={phase:w.phase,round:w.match.round,bars};if(JSON.stringify(row)!==JSON.stringify(window.lifeRows.at(-1)))window.lifeRows.push(row)},40)`);}
async function bars(session){return evaluate(session,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world),root=document.querySelector('#original-battle-hud'),scale=root.getBoundingClientRect().width/800;return {world:w,scale,rows:[...root.querySelectorAll('[data-source-progress-fraction]')].map(e=>{const id=e.dataset.sourceControl==='prgLife'?w.playerId:e.closest('[data-player-id]')?.dataset.playerId,p=w.players.find(p=>p.id===id),r=e.getBoundingClientRect(),i=e.querySelector('.source-life-image');return {name:e.dataset.sourceControl,id,hp:p?.hp,maxHp:p?.maxHp,value:Number(e.getAttribute('aria-valuenow')),fraction:Number(e.dataset.sourceProgressFraction),extent:Number(e.dataset.sourceProgressExtent),colour:e.dataset.sourceProgressColour,format:e.dataset.progressFormat,clip:e.querySelector('.source-progress-fill').style.clipPath,rect:r.toJSON(),image:{background:getComputedStyle(i).backgroundImage,size:getComputedStyle(i).backgroundSize,repeat:getComputedStyle(i).backgroundRepeat,width:getComputedStyle(i).width,height:getComputedStyle(i).height,filter:getComputedStyle(i).filter},matrix:e.querySelector('feColorMatrix').getAttribute('values'),stack:document.elementsFromPoint(r.x+r.width/2,r.y+r.height/2).map(n=>({tag:n.tagName,class:n.className,source:n.dataset.sourceControl}))};}).filter(r=>r.hp!==undefined)};})()`);}
function verifyBars(record){assert(record.rows.length>=5);for(const r of record.rows){assert.equal(r.value,r.hp);const f=Math.max(0,Math.min(1,Math.fround(Math.fround(r.hp)/r.maxHp)));assert.equal(r.fraction,f);const dimension=r.format==='Vertical'?33:179,extent=Math.floor(Math.fround(dimension*record.scale)*f+.5);assert.equal(r.extent,extent);const colour=r.name==='prgLife'?(f<Math.fround(.34)?'FFFF0000':f<Math.fround(.67)?'FFFFFF00':'FF00FF00'):'FFFFFFFF';assert.equal(r.colour,colour);const m=r.matrix.split(/\s+/).map(Number),rgb=[2,4,6].map(o=>parseInt(colour.slice(o,o+2),16)/255);assert.equal(m[0],rgb[0]);assert.equal(m[6],rgb[1]);assert.equal(m[12],rgb[2]);assert.equal(m[18],1);assert(r.image.background.includes(r.name==='prgLife'?'/ui/regions/77/21.png':Number(r.name.replace('prgPlayerLife',''))<6?'/ui/regions/77/105.png':'/ui/regions/77/107.png'));assert.equal(r.image.repeat,'repeat');assert(r.clip.includes('px'));}}
async function joinRoom(page,roomId) {await click(page,'#refresh-rooms');await waitUntil(page,`[...document.querySelector('#room').options].some(o=>o.value===${JSON.stringify(roomId)})&&!document.querySelector('#refresh-rooms').disabled`);await select(page,'#room',roomId);await click(page,'#join');await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);}
try {
  await launchServer();vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5316,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3286',ws:true,rewrite:()=> '/'}}}});await vite.listen();await launchBrowser();const sessions=[];
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
  for(const page of sessions){await command('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:1,mobile:false},page);await installObserver(page);await click(page,'[data-autopilot]');await waitUntil(page,`(${worldExpression}).players.find(p=>p.id===(${worldExpression}).playerId).isAutopilot`);}
  evidence.checks.push({name:'Two ordinary humans plus two CPUs Ready and ordinary autopilot reach real PLAYING',worlds:await Promise.all(sessions.map(world))});
  evidence.naturalBandScreenshots=[];
  const captured=new Set(),deadline=Date.now()+150000;
  while(Date.now()<deadline){
    for(const [index,page] of sessions.entries()){
      const record=await bars(page),local=record.rows.find(r=>r.name==='prgLife');
      if(local.value!==local.hp||local.extent<15||captured.has(local.colour))continue;
      const name='natural-'+local.colour+'-page'+index;
      await screenshot(page,name);
      const after=(await bars(page)).rows.find(r=>r.name==='prgLife');
      if(after.extent!==local.extent||after.colour!==local.colour)continue;
      verifyBars(record);captured.add(local.colour);evidence.naturalBandScreenshots.push({file:output+'-'+name+'.png',record});
    }
    const complete=await evaluate(a,`window.lifeRows.some((r,i)=>r.bars.some(b=>b.name==='prgLife'&&b.alive&&b.hp===b.maxHp&&window.lifeRows.slice(0,i).some(old=>old.bars.some(p=>p.id===b.id&&!p.alive))))`);
    if(captured.size===3&&complete)break;
    await pause(100);
  }
  assert.equal(captured.size,3,'Natural local HP must render real red/yellow/green screenshots');
  assert(await evaluate(a,`window.lifeRows.some((r,i)=>r.bars.some(b=>b.name==='prgLife'&&b.alive&&b.hp===b.maxHp&&window.lifeRows.slice(0,i).some(old=>old.bars.some(p=>p.id===b.id&&!p.alive))))`),'local human naturally dies and respawns');
  await writeFile(output+'-pixel-input.json',JSON.stringify(evidence.naturalBandScreenshots));
  evidence.pixels=JSON.parse(execFileSync('recovery/.venv/bin/python',['tests/life-draw-pixels.py',output+'-pixel-input.json'],{encoding:'utf8'}));
  evidence.lifeRows=await Promise.all(sessions.map(page=>evaluate(page,'window.lifeRows')));assert(network.some(r=>r.name==='RoomEvent'&&r.payload?.type==='hit'));assert(network.some(r=>r.name==='RoomEvent'&&r.payload?.type==='destroy'));assert(network.some(r=>r.name==='RoomEvent'&&r.payload?.type==='respawn'));evidence.checks.push({name:'Natural authoritative CPU combat hit/death/full-health respawn drive actual local and remote progress consumers',rowCount:evidence.lifeRows.map(r=>r.length)});
  for(const [width,height,label] of [[800,600,'800x600'],[1920,1080,'1080p'],[3840,2160,'4k']]){
    await command('Page.bringToFront',{},a);await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},a);await waitUntil(a,`Math.abs(document.querySelector('#original-battle-hud').getBoundingClientRect().width/800-${Math.min(width/800,height/600)})<.0001`);
    await waitUntil(a,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world);return [...document.querySelectorAll('[data-source-progress-fraction]')].filter(e=>e.dataset.sourceControl==='prgLife'||e.closest('[data-player-id]')).every(e=>{const id=e.dataset.sourceControl==='prgLife'?w.playerId:e.closest('[data-player-id]').dataset.playerId;return Number(e.getAttribute('aria-valuenow'))===w.players.find(p=>p.id===id)?.hp})})()`);
    const record=await bars(a);verifyBars(record);evidence.checks.push({name:'Original native colour/texture/tile/pixel clip and source HUD geometry '+label,record});await screenshot(a,label+'-life');
  }
  for(const page of sessions){await evaluate(page,'clearInterval(window.lifeTimer)');await click(page,'#leave');await waitUntil(page,`(${worldExpression})===null&&document.querySelector('#original-battle-hud')?.hidden`);}
  evidence.checks.push({name:'Ordinary Leave hides and clears both actual source life consumers'});evidence.status='PASS';console.log('PASS: original life draw, natural CPU hit/death/respawn, source 800/1080p/4K and Leave; '+output);
} catch(error){evidence.status='FAIL';evidence.error=error.stack??String(error);if(pages[0]){evidence.failureWorld=await world(pages[0].sessionId).catch(()=>null);evidence.failureCounts=await Promise.all(pages.map(p=>bars(p.sessionId).catch(()=>null)));await screenshot(pages[0].sessionId,'failure').catch(()=>{});}throw error;
} finally {if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3286,vite:5316,chrome:9516};evidence.noInjectedGameplayState=true;evidence.matchTimeLimitSeconds=300;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);}
