import assert from 'node:assert/strict';
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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3302', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-02-C-TEXT four original card text consumers, real counts and ordinary Join.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  const deadline = Date.now() + 90000;
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
async function key(session, key, code, type = 'keyDown', options = {}) {
  await command('Input.dispatchKeyEvent', {type, key, code, ...(type === 'keyDown' && (key === 'Enter' || key.length === 1) ? {text: key === 'Enter' ? '\r' : key} : {}), ...options, windowsVirtualKeyCode: (/^F(?:[5-9]|1[0-2])$/.test(code) ? 111 + Number(code.slice(1)) : ({Enter: 13, Escape: 27, Home: 36, End: 35, ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, ' ': 32})[key] ?? key.toUpperCase().charCodeAt(0))}, session);
}
async function press(session, value, code) {
  await key(session, value, code);
  await key(session, value, code, 'keyUp');
}
async function screenshot(session, name) {
  const result = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`${output}-${name}.png`, Buffer.from(result.data, 'base64'));
}
const output = `recovery/output/browser-room-card-text-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
await mkdir('recovery/output', {recursive: true});
const world = session => evaluate(session, worldExpression);
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5330'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3302', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9530', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9530/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['CreateRoom', 'Join', 'ListRooms', 'ListMaps', 'RoomSnapshot'].includes(result.service.name)) {
      network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent', kind: result.type, name: result.service.name,
        ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err} : {payload: result.msg ?? result.req})});
    }
  });
}

async function select(session, selector, value) {
  const index = await evaluate(session, `Array.from(document.querySelector(${JSON.stringify(selector)}).options).filter(o=>!o.disabled).findIndex(o=>o.value===${JSON.stringify(String(value))})`);
  assert(index >= 0, `${selector} option ${value}`);
  await click(session, selector);
  await press(session, 'Home', 'Home');
  for (let step = 0; step < index; step++) await press(session, 'ArrowDown', 'ArrowDown');
  await press(session, 'Enter', 'Enter');
  assert.equal(await evaluate(session, `document.querySelector(${JSON.stringify(selector)}).value`), String(value));
}
async function fixtureClient() {
  const client = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3302', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
  fixtures.push(client);
  assert((await client.connect()).isSucc);
  assert((await client.callApi('Account', {})).isSucc);
  return client;
}
async function fixtureJoin(roomId, name) {
  const client = await fixtureClient();
  const result = await client.callApi('Join', {roomId, clientId: name, name, tankId: 1});
  assert(result.isSucc, JSON.stringify(result));
  return client;
}
const modal = 'dialog[data-room-cards]';
const card = id => `[data-room-card-id="${id}"]`;
async function refreshCards(session) {
  const from = network.length;
  await click(session, '[data-room-card-refresh]');
  for (let attempt=0;attempt<150&&!network.slice(from).some(n=>n.page===session&&n.name==='ListRooms'&&n.direction==='received');attempt++) await pause(50);
  const listed=network.slice(from).find(n=>n.page===session&&n.name==='ListRooms'&&n.direction==='received');
  assert(listed?.success);return listed.response.rooms;
}
async function textState(session) {
  return evaluate(session, `(()=>{const names=['txtRoomName','txtTeam0PlayerNumber','txtTeam1PlayerNumber','txtPlayerNumber'];return [...document.querySelectorAll('[data-room-card-id]')].map(card=>({id:card.dataset.roomCardId,fields:[...card.querySelectorAll('.source-static-text')].filter(e=>names.includes(e.dataset.sourceControl)).map(e=>{const c=e.querySelector('[data-source-text-content]'),r=e.getBoundingClientRect();return {name:e.dataset.sourceControl,text:e.textContent,hidden:e.hidden,font:e.dataset.sourceFont,colour:e.dataset.sourceTextColour,horizontal:e.dataset.sourceHorzFormat,vertical:e.dataset.sourceVertFormat,clip:e.dataset.sourceTextClip,overflow:getComputedStyle(e).overflow,align:getComputedStyle(c).textAlign,color:getComputedStyle(c).color,fontFamily:getComputedStyle(c).fontFamily,extent:c.dataset.sourceRasterExtent,width:e.style.width,height:e.style.height,left:e.style.left,top:e.style.top,contentTop:c.style.top,lineHeight:c.style.height,glyphs:[...c.querySelectorAll('[data-source-raster-glyph]')].map(g=>({codepoint:g.dataset.sourceRasterGlyph,left:g.style.left,width:g.style.width,asset:getComputedStyle(g).backgroundImage,rect:(()=>{const r=g.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()})),screen:{x:r.x,y:r.y,width:r.width,height:r.height},scrollWidth:c.scrollWidth}})}))})()`);
}
const field=(states,id,name)=>states.find(c=>c.id===id).fields.find(f=>f.name===name);
try {
  await launchServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5330,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3302',ws:true,rewrite:()=> '/'}}}});
  await vite.listen();
  const owners=[];
  for(const [mode,roomName,password] of [[1,'中文房名1234',undefined],[1,'密码房间','cards-pass'],[4,'个人房间',undefined]]) {
    const client=await fixtureClient();owners.push(client);
    const result=await client.callApi('CreateRoom',{mode,mapId:7,minPlayers:2,maxPlayers:6,roomName,name:'房主',tankId:1,...(password?{password}:{})});
    assert(result.isSucc,JSON.stringify(result));
  }
  const occupant=await fixtureJoin('R6','队友');
  const fullOwner=await fixtureClient();assert((await fullOwner.callApi('CreateRoom',{mode:1,mapId:7,minPlayers:2,maxPlayers:2,roomName:'人数满房',name:'满房主',tankId:1})).isSucc);await fixtureJoin('R9','满房客');
  const playingOwner=await fixtureClient();assert((await playingOwner.callApi('CreateRoom',{mode:1,mapId:7,minPlayers:2,maxPlayers:2,roomName:'对战房间',name:'战房主',tankId:1})).isSucc);const playingGuest=await fixtureJoin('R10','战房客');for(const client of [playingOwner,playingGuest])assert((await client.callApi('Ready',{round:1,isReady:true})).isSucc);
  await launchBrowser();const page=await newPage();
  await input(page,'#player-name','卡片玩家');await click(page,'#refresh-rooms');
  await waitUntil(page,`[...document.querySelector('#room').options].some(o=>o.value==='R6')&&!document.querySelector('#refresh-rooms').disabled`);
  await click(page,'#open-room-cards');await waitUntil(page,`document.querySelector('${modal}').open&&document.querySelector('${card('R6')} .source-static-text')`);
  let rooms=await refreshCards(page);
  assert.deepEqual(rooms.find(r=>r.id==='R6').teamPlayerCounts,[1,1]);
  await waitUntil(page,`document.querySelector('${card('R6')} [data-source-control=txtTeam0PlayerNumber] [data-source-raster-glyph]')`);
  await command('Emulation.setDeviceMetricsOverride',{width:800,height:440,deviceScaleFactor:1,mobile:false},page);await pause(200);
  const samples=[];await click(page,card('R7'));
  const assetsByState={normal:'fj0.tga',hover:'fj1.tga',down:'fj3.tga',selected:'fj3.tga'};
  const position=await evaluate(page,`(()=>{const r=document.querySelector('${card('R6')}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  for(const stateName of ['normal','hover','down','selected','disabled-full','disabled-playing']) {
    if(stateName==='normal')await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1},page);
    if(stateName==='hover')await command('Input.dispatchMouseEvent',{type:'mouseMoved',...position},page);
    if(stateName==='down')await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...position},page);
    if(stateName==='selected')await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...position},page);
    const id=stateName==='disabled-full'?'R9':stateName==='disabled-playing'?'R10':'R6';
    if(id!=='R6')assert.equal(await evaluate(page,`document.querySelector('${card(id)}').disabled`),true);
    const visual=await evaluate(page,`(()=>{const e=document.querySelector('${card(id)}');return {selected:e.getAttribute('aria-pressed'),asset:e.dataset.sourceAsset,opacity:Number(getComputedStyle(e).opacity)}})()`);
    if(id==='R6'){assert.equal(visual.selected,stateName==='selected'?'true':'false');const source=await evaluate(page,`(async()=>{const u=await(await fetch('/ui.json')).json();return (u.imagesets.find(s=>s.attributes.Name==='lobby_ditu20'&&s.path.includes('imagesets_dds/'))??u.imagesets.find(s=>s.attributes.Name==='lobby_ditu20')).images.find(i=>i.Name.endsWith('${assetsByState[stateName]}'))?.asset})()`);assert.equal(visual.asset,source);}
    await pause(40);const texts=await textState(page);const count=field(texts,id,'txtTeam0PlayerNumber');assert.equal(count.color,'rgb(255, 255, 255)');assert.equal(count.glyphs.length,1);
    await screenshot(page,`native-${stateName}`);samples.push({file:`${output}-native-${stateName}.png`,state:stateName,field:count,opacity:visual.opacity,visual});
  }
  await writeFile(`${output}-pixel-input.json`,JSON.stringify(samples));
  evidence.pixels=JSON.parse(execFileSync('recovery/.venv/bin/python',['tests/room-card-text-pixels.py',`${output}-pixel-input.json`],{encoding:'utf8'}));
  evidence.checks.push({name:'actual original mono digit pixels, source clip and normal/hover/down/selected/disabled text regression at existing scale 1',samples,pixels:evidence.pixels});
  for(const [width,height,label] of [[800,600,'800'],[1920,1080,'1080p'],[3840,2160,'4k']]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);
    await pause(200);
    const state=await textState(page);
    for(const id of ['R6','R7','R8'])for(const text of state.find(c=>c.id===id).fields) {
      assert.equal(text.font,'SIMSUN');assert.equal(text.colour,'FFFFFFFF');assert.equal(text.horizontal,'HorzCentred');assert.equal(text.vertical,'VertCentred');
      assert.equal(text.align,'center');assert.equal(text.color,'rgb(255, 255, 255)');assert.equal(text.overflow,'hidden');assert.equal(text.clip,'text-area-intersect-window');
      if(!text.hidden)assert(text.screen.x>=0&&text.screen.y>=0&&text.screen.x+text.screen.width<=width+1&&text.screen.y+text.screen.height<=height+1);
      assert.equal(text.width,text.name==='txtRoomName'?'95px':'30px');assert.equal(text.height,text.name==='txtRoomName'?'16px':'12px');
    }
    const long=field(state,'R6','txtRoomName');assert.equal(long.text,rooms.find(r=>r.id==='R6').name);assert(long.text.length>8);
    assert.equal(field(state,'R6','txtTeam0PlayerNumber').text,'1');assert.equal(field(state,'R6','txtTeam1PlayerNumber').text,'1');
    assert.equal(field(state,'R8','txtPlayerNumber').text,'1');assert.equal(field(state,'R8','txtPlayerNumber').hidden,false);assert.equal(field(state,'R8','txtTeam0PlayerNumber').hidden,true);
    const count=field(state,'R6','txtTeam0PlayerNumber');assert.equal(count.glyphs.length,1);assert.equal(count.glyphs[0].codepoint,'49');assert(count.glyphs[0].asset.includes('SIMSUN-mono-'));
    const scale=count.screen.width/30;const extent=Number(count.extent);const inkLeft=parseFloat(count.glyphs[0].left);assert(extent>0&&inkLeft>0&&inkLeft<30/2);
    const assets=await evaluate(page,`(async()=>{const refs=[...new Set([...document.querySelectorAll('[data-room-card-id] [data-source-raster-glyph]')].map(e=>getComputedStyle(e).backgroundImage.slice(5,-2)))];return Promise.all(refs.map(async src=>{const i=new Image();i.src=src;await i.decode();return {src,width:i.naturalWidth,height:i.naturalHeight}}))})()`);assert(assets.every(a=>a.width>0&&a.height>0));
    await click(page,card('R6'));await screenshot(page,`${label}-cards`);
    evidence.checks.push({name:`${label} four source text defaults, geometry, original digit atlas, full directory name and clipping`,state,scale,assets});
  }
  assert((await occupant.callApi('ChangeTeam',{round:1,team:0})).isSucc);
  rooms=await refreshCards(page);assert.deepEqual(rooms.find(r=>r.id==='R6').teamPlayerCounts,[2,0]);
  let state=await textState(page);assert.equal(field(state,'R6','txtTeam0PlayerNumber').text,'2');assert.equal(field(state,'R6','txtTeam1PlayerNumber').text,'0');
  evidence.checks.push({name:'real ChangeTeam and ordinary refresh update both source counts',state});
  await click(page,card('R7'));await press(page,'Enter','Enter');assert.equal(await evaluate(page,`document.querySelector('#room').value`),'R7');
  await click(page,'[data-room-card-close]');await input(page,'#join-password','wrong-pass');await click(page,'#open-room-cards');
  const rejectedFrom=network.length;await click(page,'[data-room-card-join]');
  await waitUntil(page,`document.querySelector('#battle-status').value.includes('密码')&&!document.querySelector('#join').disabled`);
  const rejected=network.slice(rejectedFrom).find(n=>n.page===page&&n.name==='Join'&&n.direction==='received');assert.equal(rejected?.success,false);assert.equal(await world(page),null);
  await click(page,'#open-room-cards');assert.equal(await evaluate(page,`document.querySelector('#room').value`),'R7');assert.equal(await evaluate(page,`document.querySelector('#join-password').value`),'wrong-pass');assert.equal(await evaluate(page,`document.querySelector('${card('R7')}').getAttribute('aria-pressed')`),'true');
  evidence.checks.push({name:'native card selection, ordinary password rejection and retained identity/draft',rejected,state:await textState(page)});
  await screenshot(page,'4k-rejected-reopened');
  await click(page,'[data-room-card-close]');await input(page,'#join-password','cards-pass');await click(page,'#open-room-cards');
  const from=network.length;await click(page,'[data-room-card-join]');await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);
  const joined=network.slice(from).find(n=>n.page===page&&n.name==='Join'&&n.direction==='received');assert(joined?.success);const value=await world(page);assert.equal(value.roomId,'R7');assert.equal(value.playerId,joined.response.playerId);
  await screenshot(page,'4k-waiting');await click(page,'#leave');await waitUntil(page,`!(${worldExpression})`);
  evidence.checks.push({name:'ordinary correct Join reaches same authoritative WAITING and normal Leave clears world',joined,world:value});
  evidence.status='PASS';console.log('PASS: original card text and real directory/count/password/Join/Leave loop');
} catch(error) {
  evidence.status='FAIL';evidence.error=error.stack??String(error);const session=pages[0]?.sessionId;
  if(session){evidence.failureState=await textState(session).catch(()=>null);evidence.failureStatus=await evaluate(session,`document.querySelector('#battle-status')?.value`).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
} finally {
  for(const fixture of fixtures)await fixture.disconnect();if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.isolation={server:3302,vite:5330,chrome:9530};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;
  await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);
}
