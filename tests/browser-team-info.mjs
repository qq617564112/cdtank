import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
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
const directory = await mkdtemp(join(tmpdir(), 'cdtank-team-info-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-05-T recovered team count HUD mapped to rebuilt authoritative teamLives.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
      if (await evaluate(session, expression)) return;
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
  const result = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`${output}-${name}.png`, Buffer.from(result.data, 'base64'));
}
const output = 'recovery/output/browser-team-info';
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5232'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3200', MATCH_TIME_LIMIT_SECONDS: '60', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9302', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9302/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
const teamSelector=`[data-source-layout="${layoutPath}"]`;
async function counts(page) {
  return evaluate(page,`(()=>{const w=${worldExpression};return {phase:w?.phase,tick:w?.tick,round:w?.match.round,team:w?.players.find(p=>p.id===w.playerId)?.team,lives:w?.match.teamLives,self:document.querySelector('${teamSelector}[data-source-control="txtSelfInfo"]')?.dataset.value,enemy:document.querySelector('${teamSelector}[data-source-control="txtEnemyInfo"]')?.dataset.value,selfHidden:document.querySelector('${teamSelector}[data-source-control="txtSelfInfo"]')?.hidden,glyphs:document.querySelectorAll('${teamSelector}[data-source-control="txtSelfInfo"] img,${teamSelector}[data-source-control="txtEnemyInfo"] img').length}})()`);
}
async function assertCounts(page,phase) {
  await waitUntil(page,`(()=>{const w=${worldExpression},team=w?.players.find(p=>p.id===w.playerId)?.team;return w?.phase===${JSON.stringify(phase)}&&document.querySelector('${teamSelector}[data-source-control="txtSelfInfo"]').dataset.value===String(w.match.teamLives[team])&&document.querySelector('${teamSelector}[data-source-control="txtEnemyInfo"]').dataset.value===String(w.match.teamLives[1-team])})()`);
  const state=await counts(page);assert(!state.selfHidden);assert(state.glyphs>0);return state;
}
async function verifyTeamSource(page,width,height) {
  const source=await evaluate(page,`(async()=>{
    const ui=await(await fetch('/ui.json')).json(),layout=ui.layouts.find(l=>l.path==='${layoutPath}'),font=ui.fonts.find(f=>f.attributes.Name==='BigHT'),fontset=ui.imagesets.find(s=>'data/'+s.path===font.attributes.Filename);
    function asset(ref){const m=/^set:(\\S+) image:(.+)$/.exec(ref),sets=ui.imagesets.filter(s=>s.attributes.Name===m[1]),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return set.images.find(i=>i.Name===m[2]).asset;}
    const rows=layout.windows.map(w=>{const e=document.querySelector('${teamSelector}[data-source-control="'+w.name+'"]');if(!e)throw new Error('Missing '+w.name);const n=w.properties.AbsoluteRect.match(/-?[\\d.]+/g).map(Number),r=e.getBoundingClientRect();return {name:w.name,native:{left:parseFloat(e.style.left),top:parseFloat(e.style.top),width:parseFloat(e.style.width),height:parseFloat(e.style.height)},expected:{left:n[0],top:n[1],width:n[2]-n[0],height:n[3]-n[1]},background:getComputedStyle(e).backgroundImage,asset:w.properties.Image?asset(w.properties.Image):undefined,hidden:e.hidden,rect:{x:r.x,y:r.y,width:r.width,height:r.height},value:e.dataset.value,glyphs:[...e.querySelectorAll(':scope > img')].map((i,index)=>{const character=e.dataset.value?.[index],mapping=font.mappings.find(m=>Number(m.Codepoint)===character?.codePointAt(0)),region=fontset.images.find(r=>r.Name===mapping?.Image);return {src:i.getAttribute('src'),width:i.naturalWidth,height:i.naturalHeight,expected:region?.asset,expectedWidth:Number(region?.Width),expectedHeight:Number(region?.Height)};})};});
    const icons=await Promise.all(rows.filter(r=>r.asset).map(r=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve({name:r.name,asset:r.asset,width:i.naturalWidth,height:i.naturalHeight});i.onerror=()=>reject(new Error(r.asset));i.src='/'+r.asset;})));
    return {rows,icons};
  })()`);
  assert.equal(source.rows.length,8);for(const row of source.rows){assert.deepEqual(row.native,row.expected,row.name+' source rectangle');if(row.asset)assert(row.background.includes('/'+row.asset));for(const glyph of row.glyphs){assert.equal(glyph.src,'/'+glyph.expected);assert.equal(glyph.width,glyph.expectedWidth);assert.equal(glyph.height,glyph.expectedHeight);}const r=row.rect;if(!row.hidden)assert(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height,row.name+' visible');}
  assert.equal(source.icons.length,2);assert(source.icons.every(r=>r.width>0&&r.height>0));assert(source.rows.find(r=>r.name==='lblTimes0').glyphs.length===1);assert(source.rows.find(r=>r.name==='txtSelfInfo').glyphs.length>0);evidence.checks.push({name:`all eight original controls, fixed blue/red PNG and exact BigHT multiplication/digit glyphs at ${width}x${height}`,source});
}
async function joinRoom(page,roomId) {await click(page,'#refresh-rooms');await waitUntil(page,`[...document.querySelector('#room').options].some(o=>o.value===${JSON.stringify(roomId)})&&!document.querySelector('#refresh-rooms').disabled`);await select(page,'#room',roomId);await click(page,'#join');await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);}
try {
  await launchServer();vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5232,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3200',ws:true,rewrite:()=> '/'}}}});await vite.listen();await launchBrowser();const sessions=[];
  for(const name of ['本队HUD甲','本队HUD乙']){const {browserContextId}=await command('Target.createBrowserContext');const page=await newPage(browserContextId);sessions.push(page);await input(page,'#player-name',name);}
  const [a,b]=sessions;await click(a,'#create-room-controls > summary');await select(a,'#room-mode',1);await select(a,'#room-map',7);await input(a,'#room-min-players',2);await click(a,'#create-room');await waitUntil(a,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);const initial=await world(a);await joinRoom(b,initial.roomId);
  for(const page of sessions)await waitUntil(page,`(${worldExpression}).players.length===2`);
  const waiting=await Promise.all(sessions.map(counts));assert(waiting.every(s=>s.selfHidden&&s.self===''&&s.enemy===''));evidence.checks.push({name:'WAITING hides and clears reconstructed counts',waiting});
  for(let cpu=0;cpu<2;cpu++){await click(a,'[data-add-cpu]');await waitUntil(a,`(${worldExpression}).players.filter(p=>p.isCpu).length===${cpu+1}&&!document.querySelector('[data-add-cpu]').disabled`);}
  for(const page of sessions)await waitUntil(page,`(${worldExpression}).renderedPlayers===4&&(${worldExpression}).renderedActions.length===4`,120000);
  const startedFrom=network.length;for(const page of [b,a]){await open(page);await keyboardActivate(page,'[data-waiting-ready]');await waitUntil(page,`(${worldExpression}).match.readyPlayerIds.includes((${worldExpression}).playerId)||(${worldExpression}).phase==='PLAYING'`);}
  const started=await Promise.all(sessions.map(page=>assertCounts(page,'PLAYING')));assert.notEqual(started[0].team,started[1].team);evidence.checks.push({name:'ordinary Add CPU twice and both Ready start mode1 with self/enemy mapping per local side',started});
  await verifyTeamSource(a,1920,1080);await screenshot(a,'1080p-start');await screenshot(b,'1080p-peer-start');
  const baseline=started[0].lives;await waitUntil(a,`(${worldExpression}).match.teamLives.some((life,index)=>life<${JSON.stringify(baseline)}[index])`,75000);
  const changed=await Promise.all(sessions.map(page=>assertCounts(page,'PLAYING')));evidence.checks.push({name:'natural CPU ordinary combat consumes team stock and recovered counts track authority in both browsers',changed,events:network.slice(startedFrom).filter(r=>r.name==='RoomEvent')});await screenshot(a,'1080p-changed');await screenshot(b,'1080p-peer-changed');
  const snapshotRows=network.slice(startedFrom).filter(r=>r.name==='RoomSnapshot'&&r.direction==='received'&&r.payload.match.teamLives.some((life,index)=>life<baseline[index]));const same=snapshotRows.find(left=>snapshotRows.some(right=>right.page!==left.page&&right.payload.tick===left.payload.tick&&JSON.stringify(right.payload.match.teamLives)===JSON.stringify(left.payload.match.teamLives)));assert(same);evidence.sameTick=[same,snapshotRows.find(right=>right.page!==same.page&&right.payload.tick===same.payload.tick)];
  await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},a);evidence.fourKUiRenderer=await evaluate(a,`(async()=>{const source=await(await fetch('/src/main.ts')).text(),url=source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1],{EngineStore}=await import(url);EngineStore.LastCreatedEngine.setHardwareScalingLevel(2);return {viewport:[innerWidth,innerHeight],canvas:[EngineStore.LastCreatedEngine.getRenderWidth(),EngineStore.LastCreatedEngine.getRenderHeight()]};})()`);await verifyTeamSource(a,3840,2160);await screenshot(a,'4k-hud');await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},a);await evaluate(a,`(async()=>{const source=await(await fetch('/src/main.ts')).text(),url=source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1],{EngineStore}=await import(url);EngineStore.LastCreatedEngine.setHardwareScalingLevel(1);})()`);
  const finished=await Promise.all(sessions.map(page=>assertCounts(page,'FINISHED')));evidence.checks.push({name:'normal 60-second server match limit reaches FINISHED with authoritative count display retained',finished});await screenshot(a,'1080p-finished');
  for(const page of [b,a])await click(page,'[data-rematch]');const rematch=await Promise.all(sessions.map(page=>assertCounts(page,'PLAYING')));assert(rematch.every(s=>s.round===2));evidence.checks.push({name:'ordinary rematch resets to round2 authoritative initial counts',rematch});
  for(const page of sessions){await click(page,'#leave');await waitUntil(page,`(${worldExpression})===null`);const cleared=await counts(page);assert.equal(cleared.self,undefined);assert.equal(cleared.enemy,undefined);assert.equal(cleared.glyphs,0);}
  await select(a,'#room-mode',4);await select(a,'#room-map',7);await click(a,'#create-room');await waitUntil(a,`(${worldExpression})?.mode===4&&(${worldExpression}).phase==='WAITING'&&document.querySelector('#battle-controls').hidden`);assert(await evaluate(a,`document.querySelector('${teamSelector}[data-source-control="SheetWindow"]').hidden`));await click(a,'#leave');await waitUntil(a,`(${worldExpression})===null`);
  evidence.checks.push({name:'Leave clears count values/glyphs; ordinary mode4 reentry hides team panel without old counts'});evidence.status='PASS';await rm(`${output}-failure.png`,{force:true});console.log('PASS: team HUD8 controls/PNG/BigHT, real dual team projection, natural CPU stock change, FINISHED/rematch/Leave and mode4 hidden;1080p/4K UI');
} catch(error){evidence.status='FAIL';evidence.error=error.stack??String(error);if(pages[0]){evidence.failureWorld=await world(pages[0].sessionId).catch(()=>null);evidence.failureCounts=await Promise.all(pages.map(p=>counts(p.sessionId).catch(()=>null)));await screenshot(pages[0].sessionId,'failure').catch(()=>{});}throw error;
} finally {if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3200,vite:5232,chrome:9302};evidence.noInjectedGameplayState=true;evidence.matchTimeLimitSeconds=60;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);}
