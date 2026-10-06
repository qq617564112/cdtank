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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3316', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-02-C-CREATEENTRY original source entry opens existing React creation and returns focus/identity or authoritative WAITING.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = `recovery/output/browser-room-card-home-entry-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5340'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3316', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9540', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9540/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['CreateRoom', 'Join', 'Leave', 'ListRooms', 'ListMaps', 'RoomSnapshot', 'Inventory', 'Kitbag'].includes(result.service.name)) {
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
  const client = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3316', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
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
async function snapshot(session){return evaluate(session,`(()=>{const d=document.querySelector('${modal}'),e=d.querySelector('[data-room-card-home]'),r=e.getBoundingClientRect(),s=d.querySelector('[data-room-card-stage]').getBoundingClientRect();return {stage:{x:s.x,y:s.y,width:s.width,height:s.height},source:e.dataset.sourceControl,state:e.dataset.sourceButtonState,disabled:e.disabled,left:e.style.left,top:e.style.top,width:e.style.width,height:e.style.height,rect:{x:r.x,y:r.y,width:r.width,height:r.height},hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e,images:[...e.querySelectorAll('[data-room-button-image]')].map(i=>({property:i.dataset.roomButtonImage,asset:i.dataset.sourceAsset,opacity:getComputedStyle(i).opacity,pointer:getComputedStyle(i).pointerEvents})),selected:document.querySelector('#room').value,page:d.querySelector('[data-room-card-page]').textContent,sort:d.querySelector('[data-room-card-sort]').dataset.roomCardSortMode,cardsOpen:d.open,homeOpen:document.querySelector('#home-inventory')?.open??false,activeHome:document.activeElement===e,playerName:document.querySelector('#player-name').value}})()`);}
let assets;
async function capture(session,label,width,height,state){const s=await snapshot(session),scale=s.stage.width/615;assert.equal(s.source,'btnMyHome');assert.equal(s.state,state);assert.equal(s.disabled,false);assert.deepEqual([s.left,s.top,s.width,s.height],['4px','360px','81px','38px']);assert(Math.abs(s.rect.x-(s.stage.x+4*scale))<.15);assert(Math.abs(s.rect.y-(s.stage.y+276*scale))<.15);assert(Math.abs(s.rect.width-81*scale)<.15);assert(Math.abs(s.rect.height-38*scale)<.15);assert(s.rect.x>=0&&s.rect.y>=0&&s.rect.x+s.rect.width<=width+1&&s.rect.y+s.rect.height<=height+1);assert(s.hit);assert.equal(s.images.length,1);assert.equal(s.images[0].property,state+'Image');assert.equal(s.images[0].asset,assets[state+'Image']);assert.equal(s.images[0].opacity,'1');assert.equal(s.images[0].pointer,'none');assert.equal(s.selected,'R17');assert.equal(s.page,'2 / 2');await screenshot(session,label);captures.push({file:output+'-'+label+'.png',label,state:s});return s;}
async function homeReady(session,from){await waitUntil(session,`document.querySelector('#home-inventory')?.open&&document.querySelector('#home-inventory').getAttribute('aria-busy')==='false'&&document.querySelector('[data-home-close]')`);const response=network.slice(from).find(n=>n.page===session&&n.name==='Inventory'&&n.direction==='received');assert(response?.success,JSON.stringify(response));assert(Array.isArray(response.response.records));return response;}
async function closeHome(session,escape){if(escape)await press(session,'Escape','Escape');else await click(session,'[data-home-close]');await waitUntil(session,`!document.querySelector('#home-inventory')?.open&&document.activeElement?.matches('[data-room-card-home]')`);const s=await snapshot(session);assert.equal(s.cardsOpen,true);assert.equal(s.selected,'R17');assert.equal(s.page,'2 / 2');assert.equal(s.sort,'ID');assert.equal(s.playerName,'家园中文玩家');return s;}
try{
 await launchServer();vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5340,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3316',ws:true,rewrite:()=> '/'}}}});await vite.listen();
 for(let id=6;id<=17;id++){const owner=await fixtureClient();const created=await owner.callApi('CreateRoom',{mode:1,mapId:7,minPlayers:2,maxPlayers:6,roomName:'家园房'+id,name:'房主'+id,tankId:1});assert(created.isSucc);assert.equal(created.res.room.id,'R'+id);}
 await launchBrowser();const page=await newPage();await input(page,'#player-name','家园中文玩家');await click(page,'#refresh-rooms');await waitUntil(page,`[...document.querySelector('#room').options].some(o=>o.value==='R6')`);await click(page,'#open-room-cards');await waitUntil(page,`document.querySelector('${modal}').open&&document.querySelector('[data-room-card-home]')&&!document.querySelector('[data-room-card-home]').disabled`);await click(page,'[data-room-card-next]');await waitUntil(page,`document.querySelector('[data-room-card-page]').textContent==='2 / 2'`);await click(page,'[data-room-card-id="R17"]');await waitUntil(page,`document.querySelector('#room').value==='R17'`);
 assets=await evaluate(page,`(async()=>{const u=await(await fetch('/ui.json')).json(),c=u.layouts.find(l=>l.path.endsWith('roomlist.xml')).windows.find(c=>c.name==='btnMyHome'),row={};for(const key of ['NormalImage','HoverImage','PushedImage']){const[setName,imageName]=c.properties[key].slice(4).split(' image:');const sets=u.imagesets.filter(s=>s.attributes.Name===setName);row[key]=(sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0]).images.find(i=>i.Name===imageName).asset;}return row})()`);
 await evaluate(page,`(()=>{window.homeEvents=[];for(const name of ['pointerdown','keydown'])document.addEventListener(name,e=>{if(e.target.matches('[data-room-card-home]'))window.homeEvents.push({type:e.type,isTrusted:e.isTrusted,key:e.key})},true)})()`);
 let pending;server.kill('SIGSTOP');try{await click(page,'[data-room-card-refresh]');await waitUntil(page,`document.querySelector('[data-room-card-home]').disabled`);pending=await snapshot(page);assert.equal(pending.state,'Disabled');assert.equal(pending.images.length,0);await screenshot(page,'busy-disabled');await click(page,'[data-room-card-home]');assert.equal((await snapshot(page)).homeOpen,false);}finally{server.kill('SIGCONT');}await waitUntil(page,`!document.querySelector('[data-room-card-home]').disabled`);evidence.checks.push({name:'ordinary refresh pending disables source Home/no DisabledImage and cannot open inventory; response resumes',pending,file:output+'-busy-disabled.png'});
 for(const[width,height,label]of [[800,600,'800'],[1920,1080,'1080p'],[3840,2160,'4k']]){
  await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);await pause(180);await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1},page);const normal=await capture(page,label+'-normal',width,height,'Normal');const p={x:normal.rect.x+normal.rect.width/2,y:normal.rect.y+normal.rect.height/2};await command('Input.dispatchMouseEvent',{type:'mouseMoved',...p},page);await pause(25);await capture(page,label+'-hover',width,height,'Hover');await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...p},page);await pause(25);await capture(page,label+'-pushed',width,height,'Pushed');const from=network.length;await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...p},page);const inventory=await homeReady(page,from);await screenshot(page,label+'-inventory');assert((await snapshot(page)).cardsOpen);const stateBefore=await snapshot(page);await press(page,'ArrowRight','ArrowRight');await press(page,'a','KeyA');const isolated=await snapshot(page);assert.equal(isolated.selected,stateBefore.selected);assert.equal(isolated.page,stateBefore.page);assert.equal(isolated.sort,stateBefore.sort);assert.equal(await world(page),null);const returned=await closeHome(page,label==='1080p');evidence.checks.push({name:label+' original Home N/H/P actual images and ordinary confirmed inventory; modal keys isolated; close/Escape restores source focus and directory',normal,inventory,returned,file:output+'-'+label+'-inventory.png'});
 }
 const from=network.length;await press(page,'Enter','Enter');await homeReady(page,from);await closeHome(page,true);const spaceFrom=network.length;await press(page,' ','Space');await homeReady(page,spaceFrom);await closeHome(page,false);const events=await evaluate(page,'window.homeEvents');assert(events.some(e=>e.isTrusted&&e.type==='pointerdown'));assert(events.some(e=>e.isTrusted&&e.key==='Enter'));assert(events.some(e=>e.isTrusted&&e.key===' '));assert.equal(network.filter(n=>n.page===page&&n.name==='Kitbag'&&n.direction==='sent').length,0);evidence.checks.push({name:'trusted Enter/Space reopen inventory with real query each time and source focus return; no inventory mutation/gameplay state',events,state:await snapshot(page),world:await world(page)});
 await writeFile(output+'-pixel-input.json',JSON.stringify(captures));evidence.pixels=JSON.parse(execFileSync('recovery/.venv/bin/python',['tests/room-card-home-entry-pixels.py',output+'-pixel-input.json'],{encoding:'utf8'}));evidence.status='PASS';console.log('PASS: original card Home entry and ordinary inventory, modal isolation/focus/identity, three actual viewport states');
}catch(error){evidence.status='FAIL';evidence.error=error.stack??String(error);const session=pages[0]?.sessionId;if(session){evidence.failureState=await snapshot(session).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
}finally{for(const fixture of fixtures)await fixture.disconnect();if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3316,vite:5340,chrome:9540};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.captures=captures;evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);}
