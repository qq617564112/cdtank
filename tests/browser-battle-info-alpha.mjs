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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3285', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-team-info-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-04-BATTLEINFO-ALPHA ordinary dual PLAYING player chat event resets source pane alpha, real eight-second update clock and edtBattleInfo hover, three viewport source geometry and Leave.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = 'recovery/output/browser-battle-info-alpha-'+new Date().toISOString().replace(/[:.]/g,'-');
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5315'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3285', MATCH_TIME_LIMIT_SECONDS: '300', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9515', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9515/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
const paneSelector='[data-source-layout="ui/layouts/game_main.xml"][data-source-control="picBattleInfoPanel"]';
const readingSelector='[data-source-layout="ui/layouts/game_main.xml"][data-source-control="edtBattleInfo"]';
async function pane(session){return evaluate(session,`(()=>{const p=document.querySelector('${paneSelector}'),e=document.querySelector('${readingSelector}'),r=e.getBoundingClientRect(),s=document.querySelector('#original-battle-hud').getBoundingClientRect();return {opacity:Number(getComputedStyle(p).opacity),text:e.textContent,panel:{left:parseFloat(p.style.left),top:parseFloat(p.style.top),width:parseFloat(p.style.width),height:parseFloat(p.style.height),background:getComputedStyle(p).backgroundImage,pointer:getComputedStyle(p).pointerEvents},reading:{left:parseFloat(e.style.left),top:parseFloat(e.style.top),width:parseFloat(e.style.width),height:parseFloat(e.style.height),pointer:getComputedStyle(e).pointerEvents},rect:r.toJSON(),scale:s.width/800,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.getAttribute('data-source-control'),hitElement:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,500),stack:document.elementsFromPoint(r.x+r.width/2,r.y+r.height/2).map(e=>({tag:e.tagName,class:e.className,source:e.dataset.sourceControl,rect:e.getBoundingClientRect().toJSON(),z:getComputedStyle(e).zIndex})),viewport:[innerWidth,innerHeight]};})()`);}
async function move(session,inside){await command('Page.bringToFront',{},session);const p=inside?(await pane(session)).rect:{x:2,y:2,width:0,height:0};await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+p.width/2,y:p.y+p.height/2},session);}
async function joinRoom(page,roomId) {await click(page,'#refresh-rooms');await waitUntil(page,`[...document.querySelector('#room').options].some(o=>o.value===${JSON.stringify(roomId)})&&!document.querySelector('#refresh-rooms').disabled`);await select(page,'#room',roomId);await click(page,'#join');await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);}
try {
  await launchServer();vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5315,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3285',ws:true,rewrite:()=> '/'}}}});await vite.listen();await launchBrowser();const sessions=[];
  for(const name of ['消息面板甲','消息面板乙']){const {browserContextId}=await command('Target.createBrowserContext');const page=await newPage(browserContextId);sessions.push(page);await input(page,'#player-name',name);}
  const [a,b]=sessions;await click(a,'#create-room-controls > summary');await select(a,'#room-mode',1);await select(a,'#room-map',7);await input(a,'#room-min-players',2);await click(a,'#create-room');await waitUntil(a,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);const initial=await world(a);await joinRoom(b,initial.roomId);
  for(const page of sessions)await waitUntil(page,`(${worldExpression}).players.length===2&&(${worldExpression}).renderedPlayers===2&&(${worldExpression}).renderedActions.length===2`);
  for(const page of [b,a]){await open(page);await keyboardActivate(page,'[data-waiting-ready]');await waitUntil(page,`(${worldExpression}).match.readyPlayerIds.includes((${worldExpression}).playerId)||(${worldExpression}).phase==='PLAYING'`);}
  for(const page of sessions)await waitUntil(page,`(${worldExpression}).phase==='PLAYING'&&!document.querySelector('${modal}')`);
  evidence.checks.push({name:'Two ordinary humans create/join/Ready reach actual PLAYING without injected combat state',worlds:await Promise.all(sessions.map(world))});
  for(const [width,height,label] of [[800,600,'800x600'],[1920,1080,'1080p'],[3840,2160,'4k']]){
    await command('Page.bringToFront',{},a);await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},a);
    await waitUntil(a,`innerWidth===${width}&&innerHeight===${height}&&Math.abs(document.querySelector('#original-battle-hud').getBoundingClientRect().width/800-${Math.min(width/800,height/600)})<.0001`);
    const geometry=await pane(a);assert.deepEqual([geometry.panel.left,geometry.panel.top,geometry.panel.width,geometry.panel.height],[309,0,263,93]);assert(geometry.panel.background.includes('/ui/regions/77/2.png'));assert.equal(geometry.panel.pointer,'none');assert.equal(geometry.reading.pointer,'auto');if(geometry.hit!=='edtBattleInfo'){evidence.blockedHit=geometry;await writeFile(`${output}-blocked-hit.json`,JSON.stringify(geometry,null,2)+'\n');}assert.equal(geometry.hit,'edtBattleInfo','actual source text hover target unobstructed');evidence.checks.push({name:'Original pane geometry/image and actual text hit '+label,geometry});
    await move(a,false);const text='原消息反馈 '+label,from=network.length;
    await input(a,'[data-chat-input]',text);await press(a,'Enter','Enter');
    for(const page of sessions)await waitUntil(page,`document.querySelector('${readingSelector}').textContent.includes(${JSON.stringify(text)})&&Math.abs(Number(getComputedStyle(document.querySelector('${paneSelector}')).opacity)-1)<.00001`);
    const rows=network.slice(from);assert(rows.some(r=>r.page===a&&r.name==='RoomChat'&&r.direction==='sent'));assert(rows.some(r=>r.name==='RoomEvent'&&r.payload?.type==='chat'&&r.payload.message.includes(text)));evidence.checks.push({name:'Ordinary player RoomChat and authoritative RoomEvent reset both actual source panes '+label,panes:await Promise.all(sessions.map(pane)),rows});await screenshot(a,label+'-message-alpha1');
    await move(a,false);await waitUntil(a,`Math.abs(Number(getComputedStyle(document.querySelector('${paneSelector}')).opacity)-Math.fround(.2))<.00001`);evidence.checks.push({name:'Real update clock reaches original eight-second faded alpha '+label,pane:await pane(a)});await screenshot(a,label+'-elapsed-alpha02');
    await move(a,true);await waitUntil(a,`Number(getComputedStyle(document.querySelector('${paneSelector}')).opacity)===1`);evidence.checks.push({name:'Ordinary source text mouse enter restores alpha1 '+label,pane:await pane(a)});await screenshot(a,label+'-hover-alpha1');await move(a,false);await waitUntil(a,`Math.abs(Number(getComputedStyle(document.querySelector('${paneSelector}')).opacity)-Math.fround(.2))<.00001`);evidence.checks.push({name:'Ordinary source text mouse leave after eight seconds restores alpha02 '+label,pane:await pane(a)});
  }
  for(const page of sessions){await click(page,'#leave');await waitUntil(page,`(${worldExpression})===null&&document.querySelector('#original-battle-hud')?.hidden`);assert.equal(await evaluate(page,`document.querySelector('${readingSelector}')?.textContent??''`),'');}
  evidence.checks.push({name:'Ordinary Leave clears source message consumers in both real pages'});evidence.status='PASS';console.log('PASS: battle info real message/8s/hover alpha, source geometry and Leave 800/1080p/4K; '+output);
} catch(error){evidence.status='FAIL';evidence.error=error.stack??String(error);if(pages[0]){evidence.failureWorld=await world(pages[0].sessionId).catch(()=>null);evidence.failureCounts=await Promise.all(pages.map(p=>pane(p.sessionId).catch(()=>null)));await screenshot(pages[0].sessionId,'failure').catch(()=>{});}throw error;
} finally {if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3285,vite:5315,chrome:9515};evidence.noInjectedGameplayState=true;evidence.matchTimeLimitSeconds=300;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);}
