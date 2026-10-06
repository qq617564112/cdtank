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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3314', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-02-C-SORTBUTTON original sort button imagery and real rebuilt sorting lifecycle.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = `recovery/output/browser-room-card-sort-button-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5338'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3314', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9538', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9538/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['CreateRoom', 'Join', 'Leave', 'ListRooms', 'ListMaps', 'RoomSnapshot'].includes(result.service.name)) {
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
  const client = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3314', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
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
const modal='dialog[data-room-cards]';const captures=[];
async function snapshot(session){return evaluate(session,`(()=>{const d=document.querySelector('${modal}'),stage=d.querySelector('[data-room-card-stage]'),e=d.querySelector('[data-room-card-sort]'),r=e.getBoundingClientRect(),s=stage.getBoundingClientRect();return {stage:{x:s.x,y:s.y,width:s.width,height:s.height},sort:e.dataset.roomCardSortMode,source:e.dataset.sourceControl,state:e.dataset.sourceButtonState,label:e.getAttribute('aria-label'),title:e.title,disabled:e.disabled,left:e.style.left,top:e.style.top,width:e.style.width,height:e.style.height,rect:{x:r.x,y:r.y,width:r.width,height:r.height},hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e,images:[...e.querySelectorAll('[data-room-button-image]')].map(i=>({property:i.dataset.roomButtonImage,asset:i.dataset.sourceAsset,opacity:getComputedStyle(i).opacity,pointer:getComputedStyle(i).pointerEvents})),selected:document.querySelector('#room').value,directory:[...document.querySelector('#room').options].filter(o=>o.value).map(o=>o.value),cards:[...d.querySelectorAll('[data-room-card-id]')].map(card=>({id:card.dataset.roomCardId,label:card.getAttribute('aria-label'),idText:card.querySelector('[data-source-control=txtRoomID]').textContent,idViewport:card.querySelector('[data-source-control=txtRoomID]').dataset.sourceFontViewport,glyphs:card.querySelectorAll('[data-source-control=txtRoomID] [data-source-raster-glyph]').length})),page:d.querySelector('[data-room-card-page]').textContent,pageFont:d.querySelector('[data-room-card-page]').dataset.sourceFont,pageGlyphs:[...d.querySelectorAll('[data-room-card-page] [data-source-raster-glyph]')].map(g=>Number(g.dataset.sourceRasterGlyph)),playerName:document.querySelector('#player-name').value,activeSort:document.activeElement===e}})()`);}
let nativeControls;
async function verify(session,width,height,sort,state){const value=await snapshot(session),scale=value.stage.width/615;assert.equal(value.sort,sort);assert.equal(value.source,sort==='ID'?'btnSortByEmpty':'btnSortByID');assert.equal(value.state,state);assert.equal(value.label,sort==='ID'?'空房间优先排序':'编号排序');assert.equal(value.disabled,false);assert.deepEqual([value.left,value.top,value.width,value.height],['391px','355px','91px','42px']);assert(Math.abs(value.rect.x-(value.stage.x+391*scale))<.15);assert(Math.abs(value.rect.y-(value.stage.y+271*scale))<.15);assert(Math.abs(value.rect.width-91*scale)<.15);assert(Math.abs(value.rect.height-42*scale)<.15);assert(value.rect.x>=0&&value.rect.y>=0&&value.rect.x+value.rect.width<=width+1&&value.rect.y+value.rect.height<=height+1);assert(value.hit);assert.equal(value.images.length,1);assert.equal(value.images[0].property,state+'Image');assert.equal(value.images[0].opacity,'1');assert.equal(value.images[0].pointer,'none');const control=nativeControls.find(c=>c.name===value.source);assert.equal(value.images[0].asset,control[state+'Image']);assert.equal(value.playerName,'排序中文玩家');assert.equal(value.pageFont,'SIMSUN');assert(value.pageGlyphs.includes(47));for(const card of value.cards){assert.equal(card.idText,card.id);assert.equal(card.idViewport,'800,600');assert(card.label.startsWith(card.id+' '));assert(card.glyphs>0);}return value;}
async function capture(session,label,width,height,sort,state){const value=await verify(session,width,height,sort,state);await screenshot(session,label);captures.push({file:output+'-'+label+'.png',label,state:value});return value;}
async function statePoint(session){const s=await snapshot(session);return {x:s.rect.x+s.rect.width/2,y:s.rect.y+s.rect.height/2};}
function expectedOrder(rooms,sort){return [...rooms].sort((a,b)=>{if(sort==='EMPTY'){const available=Number(b.phase!=='PLAYING'&&b.playerCount<b.maxPlayers)-Number(a.phase!=='PLAYING'&&a.playerCount<a.maxPlayers);if(available)return available;const spaces=(b.maxPlayers-b.playerCount)-(a.maxPlayers-a.playerCount);if(spaces)return spaces;if(a.playerCount!==b.playerCount)return a.playerCount-b.playerCount;}return Number(a.id.slice(1))-Number(b.id.slice(1));}).map(room=>room.id);}
try{
 await launchServer();vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5338,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3314',ws:true,rewrite:()=> '/'}}}});await vite.listen();
 for(let id=6;id<=17;id++){const owner=await fixtureClient();const created=await owner.callApi('CreateRoom',{mode:1,mapId:7,minPlayers:2,maxPlayers:id%2===0?6:4,roomName:'排序房'+id,name:'房主'+id,tankId:1});assert(created.isSucc,JSON.stringify(created));assert.equal(created.res.room.id,'R'+id);}
 const listed=await fixtures[0].callApi('ListRooms',{});assert(listed.isSucc);const rooms=listed.res.rooms;assert.equal(rooms.length,17);
 await launchBrowser();const page=await newPage();await input(page,'#player-name','排序中文玩家');await click(page,'#refresh-rooms');await waitUntil(page,`[...document.querySelector('#room').options].some(o=>o.value==='R6')`);await click(page,'#open-room-cards');await waitUntil(page,`document.querySelector('${modal}').open&&document.querySelector('[data-room-card-sort]')&&document.querySelector('[data-room-card-page] [data-source-raster-glyph="47"]')`);
 nativeControls=await evaluate(page,`(async()=>{const u=await(await fetch('/ui.json')).json();return ['btnSortByID','btnSortByEmpty'].map(name=>{const c=u.layouts.find(l=>l.path.endsWith('roomlist.xml')).windows.find(c=>c.name===name);const row={name};for(const key of ['NormalImage','HoverImage','PushedImage']){const[setName,imageName]=c.properties[key].slice(4).split(' image:');const sets=u.imagesets.filter(s=>s.attributes.Name===setName);row[key]=(sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0]).images.find(i=>i.Name===imageName).asset;}return row})})()`);
 await evaluate(page,`(()=>{window.sortEvents=[];for(const name of ['pointerdown','keydown'])document.addEventListener(name,e=>{if(e.target.matches('[data-room-card-sort]'))window.sortEvents.push({type:e.type,isTrusted:e.isTrusted,key:e.key,source:e.target.dataset.sourceControl,mode:e.target.dataset.roomCardSortMode})},true)})()`);
 if(!process.argv.includes('--operation-only'))for(const[width,height,label]of [[800,600,'800'],[1920,1080,'1080p'],[3840,2160,'4k']]){
  await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);await pause(180);await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1},page);let first=await capture(page,label+'-empty-normal',width,height,'ID','Normal');assert.deepEqual(first.directory,expectedOrder(rooms,'ID').slice(0,10));await click(page,'[data-room-card-id="R6"]');
  let p=await statePoint(page);await command('Input.dispatchMouseEvent',{type:'mouseMoved',...p},page);await pause(25);await capture(page,label+'-empty-hover',width,height,'ID','Hover');await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...p},page);await pause(25);await capture(page,label+'-empty-pushed',width,height,'ID','Pushed');await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...p},page);await waitUntil(page,`document.querySelector('[data-room-card-sort]').dataset.roomCardSortMode==='EMPTY'`);await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1},page);await pause(25);const empty=await capture(page,label+'-id-normal',width,height,'EMPTY','Normal');assert.deepEqual(empty.directory,expectedOrder(rooms,'EMPTY').slice(0,10));assert.equal(empty.selected,'R6');assert(empty.cards.some(c=>c.id==='R6'));
  p=await statePoint(page);await command('Input.dispatchMouseEvent',{type:'mouseMoved',...p},page);await pause(25);await capture(page,label+'-id-hover',width,height,'EMPTY','Hover');await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...p},page);await pause(25);await capture(page,label+'-id-pushed',width,height,'EMPTY','Pushed');await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...p},page);await waitUntil(page,`document.querySelector('[data-room-card-sort]').dataset.roomCardSortMode==='ID'`);assert.deepEqual((await snapshot(page)).directory,expectedOrder(rooms,'ID').slice(0,10));assert.equal((await snapshot(page)).selected,'R6');evidence.checks.push({name:label+' both original source sort actions Normal/Hover/Pushed, actual ordinary sorting and selection identity',first,empty});
 }
 await click(page,'[data-room-card-id="R6"]');for(let i=0;i<30&&!(await snapshot(page)).activeSort;i++)await press(page,'Tab','Tab');assert((await snapshot(page)).activeSort);await press(page,'Enter','Enter');assert.equal((await snapshot(page)).sort,'EMPTY');assert((await snapshot(page)).activeSort);await press(page,' ','Space');assert.equal((await snapshot(page)).sort,'ID');assert((await snapshot(page)).activeSort);const beforeBusy=await snapshot(page);server.kill('SIGSTOP');let pendingBusy;try{await click(page,'[data-room-card-refresh]');await waitUntil(page,`document.querySelector('[data-room-card-sort]').disabled`);pendingBusy=await snapshot(page);assert.equal(pendingBusy.state,'Disabled');assert.equal(pendingBusy.images.length,0);await screenshot(page,'busy-disabled');await click(page,'[data-room-card-sort]');assert.equal((await snapshot(page)).sort,beforeBusy.sort);}finally{server.kill('SIGCONT');}await waitUntil(page,`!document.querySelector('[data-room-card-sort]').disabled`);assert.equal((await snapshot(page)).selected,'R6');evidence.checks.push({name:'ordinary refresh pending disables source sort; zero original DisabledImage draw and trusted click does not change mode; source control resumes',before:beforeBusy,pending:pendingBusy,file:output+'-busy-disabled.png'});
 await click(page,'[data-room-card-next]');await waitUntil(page,`document.querySelector('[data-room-card-page]').textContent==='2 / 2'`);await click(page,'[data-room-card-id="R17"]');await waitUntil(page,`document.querySelector('#room').value==='R17'`);evidence.selectedSecondPage=await snapshot(page);await click(page,'[data-room-card-sort]');await waitUntil(page,`document.querySelector('[data-room-card-sort]').dataset.roomCardSortMode==='EMPTY'`);let sorted=await snapshot(page);assert.equal(sorted.page,'1 / 2');assert(sorted.cards.some(c=>c.id===sorted.selected));await click(page,'[data-room-card-sort]');await waitUntil(page,`document.querySelector('[data-room-card-sort]').dataset.roomCardSortMode==='ID'`);sorted=await snapshot(page);assert.equal(sorted.page,'1 / 2');assert(sorted.cards.some(c=>c.id===sorted.selected));assert.equal(await world(page),null);const events=await evaluate(page,'window.sortEvents');assert(events.some(e=>e.isTrusted&&e.key==='Enter'));assert(events.some(e=>e.isTrusted&&e.key===' '));evidence.checks.push({name:'trusted Tab/Enter/Space keep source button focus; refresh preserves R6; second-page sort resets to first page and preserves or selects legal visible identity; Chinese draft and world unchanged',events,state:await snapshot(page)});
 if(captures.length){await writeFile(output+'-pixel-input.json',JSON.stringify(captures));evidence.pixels=JSON.parse(execFileSync('recovery/.venv/bin/python',['tests/room-card-sort-button-pixels.py',output+'-pixel-input.json'],{encoding:'utf8'}));}evidence.status='PASS';console.log('PASS: both original sort button source states, three actual viewports and trusted sorting lifecycle');
}catch(error){evidence.status='FAIL';evidence.error=error.stack??String(error);const session=pages[0]?.sessionId;if(session){evidence.failureState=await snapshot(session).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
}finally{for(const fixture of fixtures)await fixture.disconnect();if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3314,vite:5338,chrome:9538};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.captures=captures;evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);}
