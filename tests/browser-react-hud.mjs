import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const {WsClient} = require('tsrpc');
const {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3273', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-source-chat-'));
let server, chrome, vite, ws;
let serverLog = '';
const contexts = [], pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'E-R04-C React chat: ordinary dual-page public/team/IME/quick/emote/scroll/source-layout and cleanup.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  await command('Page.bringToFront', {}, session);
  const point = await evaluate(session, `(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing control '+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect(),x=r.x+Math.min(r.width,e.closest('[data-chat-scrollbar]')?.getBoundingClientRect().width??r.width)/2,y=r.y+r.height/2;if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Obscured '+${JSON.stringify(selector)});return {x,y}})()`);
  await command('Input.dispatchMouseEvent', {type: 'mousePressed', button: 'left', clickCount: 1, ...point}, session);
  await command('Input.dispatchMouseEvent', {type: 'mouseReleased', button: 'left', clickCount: 1, ...point}, session);await evaluate(session,'new Promise(requestAnimationFrame)');
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
const chatInput = '[data-chat-input]';
const chatStatus = '.battle-chat [role=status]';
const logExpression = `[...document.querySelector('[data-chat-log]').children].map(e=>e.textContent)`;
async function key(session, key, code, type = 'keyDown', options = {}) {
  await command('Input.dispatchKeyEvent', {type, key, code, ...(type === 'keyDown' && (key === 'Enter' || key.length === 1) ? {text: key === 'Enter' ? '\r' : key} : {}), ...options, windowsVirtualKeyCode: (/^F(?:[5-9]|1[0-2])$/.test(code) ? 111 + Number(code.slice(1)) : ({Enter: 13, Escape: 27, Home: 36, End: 35, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, ' ': 32})[key] ?? key.toUpperCase().charCodeAt(0))}, session);
}
async function press(session, value, code) {
  await key(session, value, code);
  await key(session, value, code, 'keyUp');await evaluate(session,'new Promise(requestAnimationFrame)');
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
const world = session => evaluate(session, worldExpression);
const chatRows = (from, session) => network.slice(from).filter(row => row.page === session && row.name === 'RoomChat' && row.direction === 'sent');
async function ready(session) {
  await waitUntil(session, `document.querySelector('#tank')?.options.length===21&&localStorage.getItem('cdtank-account-token')&&!document.querySelector('#create-room').disabled&&document.querySelector('#open-quick-chat-settings')`);
}
async function newPage(browserContextId, width = 1920, height = 1080) {
  const {targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  pages.push({targetId, sessionId});
  await command('Network.enable', {}, sessionId);
  await command('Page.enable', {}, sessionId);
  await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false}, sessionId);
  await command('Page.navigate', {url: 'http://127.0.0.1:5303'}, sessionId);
  await ready(sessionId);

  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3273', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9503', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9503/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['PlayerInput', 'RoomChat', 'Ready', 'CreateRoom', 'Join', 'ChangeTeam'].includes(result.service.name)
        || result.service.name === 'RoomEvent' && result.msg.type === 'chat') {
      network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent', kind: result.type, name: result.service.name,
        ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err} : {payload: result.msg ?? result.req})});
    }
  });
}

const finishedOnly=true;
const run=new Date().toISOString().replace(/[:.]/g,'-');
const output=`recovery/output/react-hud-${run}`;
const channelSelect = '[data-chat-channel]';
async function selectValue(session, selector, value) {
  const index = await evaluate(session, `[...document.querySelector(${JSON.stringify(selector)}).options].findIndex(o=>o.value===${JSON.stringify(String(value))})`);
  assert(index >= 0, `${selector} option ${value}`);
  await click(session, selector); await press(session, 'Home', 'Home');
  for (let step = 0; step < index; step++) await press(session, 'ArrowDown', 'ArrowDown');
  await press(session, 'Enter', 'Enter');
  assert.equal(await evaluate(session, `document.querySelector(${JSON.stringify(selector)}).value`), String(value));
}
async function createRoom(session, mode = 1) {
  if (!await evaluate(session, `document.querySelector('#create-room-controls').open`)) await click(session, '#create-room-controls summary');
  await input(session, '#room-name', '队伍聊天验收');
  await selectValue(session, '#room-mode', mode);
  await waitUntil(session, `[...document.querySelector('#room-map').options].some(o=>o.value==='7')`);
  await selectValue(session, '#room-map', 7);
  await input(session, '#room-min-players', mode===4?'1':'2');
  await click(session, '#create-room');
  await waitUntil(session, `(${worldExpression})?.mapLoaded&&!document.querySelector('#leave').hidden&&(${worldExpression}).phase==='WAITING'&&!document.querySelector('.battle-chat').hidden&&window.teamChatBattle.players.resourcesReady`);
  return world(session);
}
async function joinRoom(session, roomId) {
  await click(session, '#refresh-rooms');
  await waitUntil(session, `[...document.querySelector('#room').options].some(o=>o.value===${JSON.stringify(roomId)}&&!o.disabled)&&!document.querySelector('#join').disabled`);
  await selectValue(session, '#room', roomId); await click(session, '#join');
  await waitUntil(session, `(${worldExpression})?.roomId===${JSON.stringify(roomId)}&&window.teamChatBattle.players.resourcesReady`);
}
async function installHudObserver(page){
 await evaluate(page,`window.hudObserved=[];window.hudObserverStart=performance.now();window.hudObserver=setInterval(()=>{const world=JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null'),local=world?.players.find(p=>p.id===world.playerId),root=document.querySelector('#original-battle-hud');if(!local||!root)return;const bar=root.querySelector('[data-source-control="prgLife"]'),reload=root.querySelector('[data-source-control="prgCrossbar"]'),icon=root.querySelector('[data-tank-id][data-source-control^="picPlayerIcon"]');const row={time:performance.now(),phase:world.phase,round:world.match.round,hp:local.hp,maxHp:local.maxHp,alive:local.alive,reload:local.reload,hudHp:bar?.getAttribute('aria-valuenow'),lifeColour:bar?.dataset.sourceProgressColour,lifeExtent:Number(bar?.dataset.sourceProgressExtent),lifePixelWidth:bar?.getBoundingClientRect().width,lifeClip:bar?.querySelector('.source-progress-fill')?.style.clipPath,reloadHidden:reload?.hidden,reloadValue:reload?.getAttribute('aria-valuenow'),reloadClip:reload?.querySelector('.source-progress-fill')?.style.clipPath,portrait:icon?.dataset.expression,portraitAsset:icon?.style.backgroundImage};if(!window.hudObserved.length||JSON.stringify({...row,time:0})!==JSON.stringify({...window.hudObserved.at(-1),time:0}))window.hudObserved.push(row)},25);`);
}
async function hudLayout(page,width,height){
 await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);await evaluate(page,'new Promise(requestAnimationFrame)');
 const value=await evaluate(page,`(async()=>{const root=document.querySelector('#original-battle-hud'),bar=root.querySelector('[data-source-control="prgLife"]'),timer=[...root.querySelectorAll('[data-source-control="txtRemainTime"]')].find(e=>e.getAttribute('aria-label')&&e.getBoundingClientRect().width>0),rect=bar.getBoundingClientRect();await Promise.all([...timer.querySelectorAll('img')].map(i=>i.decode()));return {viewport:[innerWidth,innerHeight],rect:[rect.x,rect.y,rect.width,rect.height],format:bar.dataset.progressFormat,timer:timer.getAttribute('aria-label'),glyphs:timer.querySelectorAll('img').length,assets:[...timer.querySelectorAll('img')].map(i=>i.getAttribute('src'))}})()`);
 const scale=Math.min(width/800,height/600),expected=[(width-800*scale)/2+311*scale,563*scale,179*scale,28*scale];assert(value.rect.every((v,i)=>Math.abs(v-expected[i])<1),'HUD source life rect actual scale');assert(value.glyphs>0&&/^\d+:\d\d$/.test(value.timer));evidence.checks.push({name:'Source HUD life geometry and original decoded bitmap timer '+width,value});
}

try {
  await launchServer();vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',plugins:[{name:'source-chat-readiness',transform(source,id){if(!id.endsWith('/src/match/battle.ts'))return;return source+`\nconst setQuickChats=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.teamChatBattle=this;return setQuickChats.call(this,value);};\n`;}}],server:{port:5303,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3273',ws:true,rewrite:()=> '/'}}}});await vite.listen();await launchBrowser();
  const sessions=[];for(const name of ['原聊天甲','原聊天乙']){const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);const session=await newPage(browserContextId);sessions.push(session);await input(session,'#player-name',name);}
  const [a,b]=sessions;
  if(finishedOnly){
    evidence.scope='E-R05-H actual React HUD ordinary fire/reload/hit/death/revive/FINISHED/rematch and cleanup';
    const store=new AccountStore(join(directory,'accounts.sqlite'));
    try {
      const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(row=>row.tankId===1&&row.part===0);
      const fields=value=>new Map(Object.entries(value).map(([k,v])=>[Number(k),v]));
      for(const page of sessions){const owner=store.open(await evaluate(page,"localStorage.getItem('cdtank-account-token')")),equipment={name:'明确导入原战车',fields:fields(native.equipment)},base={name:'明确导入原宠物',fields:fields(native.base)};equipment.fields.set(0x1c,72);equipment.fields.set(0x24,1);equipment.fields.set(0x28,10011);equipment.fields.set(0x2c,10012);equipment.fields.set(0x30,10013);store.replaceRoleRecords(owner.accountId,{base:[base],equipment:[equipment]});const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa8,72,true);view.setUint32(0xa4,base.fields.get(0),true);store.replaceRoleProfile(owner.accountId,{bytes,strings:['','']});}
      evidence.fixture={native:'world-role-attributes-native.json tank1 part0',ownedInstance:72,scope:'Account source attributes only; ordinary autopilot and CPU simulate natural match, no combat state injection.'};
    }finally{store.close();}
    for(const page of sessions)evidence.checks.push({name:'UI viewport intact; 3D raster-only software budget',value:await evaluate(page,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1],{EngineStore}=await import(url),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world'));engine.setHardwareScalingLevel(6);engine.resize();return {viewport:[innerWidth,innerHeight],canvas:[engine.getRenderWidth(),engine.getRenderHeight()]}})()`)});
    const initial=await createRoom(a,4);await joinRoom(b,initial.roomId);
    for(let i=0;i<2;i++){await click(a,'[data-add-cpu]');await waitUntil(a,`(${worldExpression}).players.length===${i+3}`);}
    for(const page of sessions){await waitUntil(page,`window.teamChatBattle.players.resourcesReady`);await click(page,'[data-ready]');}
    for(const page of sessions)await waitUntil(page,`(${worldExpression}).phase==='PLAYING'`);
    for(const page of sessions)await installHudObserver(page);
    await click(a,'#world');const before=await world(a);await key(a,' ','Space');await pause(800);await key(a,' ','Space','keyUp');
    await waitUntil(a,`window.hudObserved.some(r=>r.reload?.startedAt>0&&Number(r.reloadValue)<100)`);
    await hudLayout(a,1920,1080);await hudLayout(a,3840,2160);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},a);await evaluate(a,'new Promise(requestAnimationFrame)');
    evidence.normalFire={before,after:await world(a),rows:await evaluate(a,'window.hudObserved')};
    const fireRows=evidence.normalFire.rows.filter(r=>r.reload?.startedAt>0&&!r.reloadHidden);assert(new Set(fireRows.map(r=>r.reloadValue)).size>1,'Real reload advances displayed fraction');assert(fireRows.every(r=>r.reloadClip.startsWith('inset(')),'Reload uses source vertical clipping');const starts=[...new Set(fireRows.map(r=>r.reload.startedAt))].sort((a,b)=>a-b);for(let i=1;i<starts.length;i++)assert(starts[i]-starts[i-1]>=fireRows.find(r=>r.reload.startedAt===starts[i-1]).reload.duration-.1,'Held fire cannot bypass reload duration');
    for(const page of sessions){await click(page,'[data-autopilot]');await waitUntil(page,`(${worldExpression}).players.find(p=>p.id===(${worldExpression}).playerId).isAutopilot`);}
    const began=Date.now();let finished=false;
    while(Date.now()-began<180000){const pair=await Promise.all(sessions.map(world));if(pair.every(w=>w.phase==='FINISHED')){evidence.finishedWorlds=pair;finished=true;break;}await pause(500);}
    assert(finished,'Ordinary natural CPU/autopilot match must finish');assert(evidence.finishedWorlds.every(w=>w.mode===4&&w.match.targetScore===10));
    await waitUntil(a,`document.querySelector('.battle-chat').classList.contains('source-battle-chat')&&!document.querySelector('[data-rematch]').disabled`);
    await screenshot(a,'finished');
    evidence.hudRows=await Promise.all(sessions.map(p=>evaluate(p,'window.hudObserved')));
    const rows=evidence.hudRows.flat();assert(rows.some(r=>!r.alive&&r.portrait==='dead'&&r.reloadHidden),'Natural death has source dead portrait and reload hidden');assert(rows.some((r,i)=>i>0&&r.alive&&rows[i-1].alive===false),'Actual natural revive');assert(rows.some(r=>r.hp>0&&r.hp<r.maxHp&&Number(r.hudHp)===r.hp&&r.lifeClip.includes('px')),'Actual damage HUD HP/fraction clipping');const colourRows=rows.filter(r=>r.hp>0&&r.hp<r.maxHp&&r.lifeColour);assert(colourRows.length);evidence.lifeColours=[...new Set(colourRows.map(r=>r.lifeColour))];const ui=JSON.parse(await readFile('recovery/output/web-assets/ui.json','utf8')),props=ui.layouts.find(l=>l.path.endsWith('game_main_common.xml'))?.windows.find(w=>w.name==='prgLife')?.properties??ui.layouts.flatMap(l=>l.windows).find(w=>w.name==='prgLife').properties;for(const row of colourRows.filter(r=>Number(r.hudHp)===r.hp)){const f=Math.max(0,Math.min(1,Math.fround(Math.fround(row.hp)/row.maxHp))),band=f<Math.fround(.34)?0:f<Math.fround(.67)?1:2;assert.equal(row.lifeColour,props[['ProgressLowBoundColour','ProgressMediumColour','ProgressHighBoundColour'][band]]);assert.equal(row.lifeExtent,Math.floor(row.lifePixelWidth*f+.5));}assert(rows.some(r=>r.portrait==='wound'),'Real hit source wound portrait');assert(rows.some(r=>r.phase==='FINISHED'&&r.reloadHidden),'FINISHED resets reload visibility');
    const oldRound=evidence.finishedWorlds[0].match.round;
    for(const page of sessions){await waitUntil(page,`!document.querySelector('[data-rematch]').disabled`);await click(page,'[data-rematch]');}
    for(const page of sessions)await waitUntil(page,`(${worldExpression}).phase==='PLAYING'&&(${worldExpression}).match.round===${oldRound+1}&&document.querySelector('.battle-chat').classList.contains('source-battle-chat')`);
    evidence.rematchWorlds=await Promise.all(sessions.map(world));
    await waitUntil(a,`window.hudObserved.some(r=>r.round===${oldRound+1}&&r.alive&&Number(r.hudHp)===r.hp)`);await screenshot(a,'rematch');
    await click(a,'#leave');await waitUntil(a,`!(${worldExpression})&&(!document.querySelector('#original-battle-hud')||document.querySelector('#original-battle-hud').hidden)`);await createRoom(a,4);await waitUntil(a,`document.querySelector('#original-battle-hud')`);evidence.reentry={world:await world(a),hud:await evaluate(a,'document.querySelector(\"#original-battle-hud\").outerHTML.slice(0,500)')};
    evidence.checks.push({name:'Natural HUD hit/death/revive/FINISHED and ordinary both-human rematch/exit/reentry',elapsedMs:Date.now()-began,oldRound,newRound:oldRound+1});
    evidence.status='PASS';console.log('PASS: React HUD ordinary fire/reload, natural hit/death/revive, finish/rematch and reentry');
  }
} catch(error){evidence.status='FAIL';evidence.error=String(error);const session=pages[0]?.sessionId;if(session){evidence.failureWorld=await world(session).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
} finally {if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3273,vite:5303,chrome:9503};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);console.log('Evidence: '+output+'.json');}
