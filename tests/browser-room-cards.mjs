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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3189', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-02-C native source room cards, real directory state and ordinary Join.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = 'recovery/output/browser-room-cards';
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5224'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3189', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9294', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9294/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
  const client = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3189', logger: undefined});
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
const keyboardOnly=process.env.CDTANK_ROOM_CARDS_KEYBOARD_ONLY==='1';
if(keyboardOnly)evidence.scope='M5-02-C fresh native keyboard card selection and focus retention';
const modal = 'dialog[data-room-cards]';
const card = id => `[data-room-card-id="${id}"]`;
const modalState = session => evaluate(session, `(()=>{const d=document.querySelector('${modal}');return {open:d.open,sort:d.querySelector('[data-room-card-sort]').dataset.roomCardSortMode,page:d.querySelector('[data-room-card-page]').textContent,selected:document.querySelector('#room').value,password:document.querySelector('#join-password').value,cards:[...d.querySelectorAll('[data-room-card-id]')].map(e=>({id:e.dataset.roomCardId,selected:e.getAttribute('aria-pressed'),disabled:e.disabled,background:getComputedStyle(e).backgroundImage,controls:[...e.querySelectorAll('[data-source-control]')].map(c=>({name:c.dataset.sourceControl,text:c.textContent,hidden:c.hidden,display:getComputedStyle(c).display,src:c.getAttribute('src'),background:getComputedStyle(c).backgroundImage,loaded:c instanceof HTMLImageElement?c.complete&&c.naturalWidth>0:null}))}))}})()`);
async function refreshCards(session) {
  const from=network.length;
  await click(session,'[data-room-card-refresh]');
  await waitUntil(session,`!document.querySelector('[data-room-card-refresh]').disabled`);
  for(let attempt=0;attempt<100&&!network.slice(from).some(row=>row.page===session&&row.name==='ListRooms'&&row.direction==='received');attempt++)await pause(50);
  const listed=network.slice(from).find(row=>row.page===session&&row.name==='ListRooms'&&row.direction==='received');
  assert(listed?.success,JSON.stringify(listed));
  return listed.response.rooms;
}
async function geometry(session,width,height) {
  const result=await evaluate(session,`(()=>{const d=document.querySelector('${modal}'),s=d.querySelector('[data-room-card-stage]');return {dialog:(()=>{const r=d.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})(),stage:(()=>{const r=s.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})(),cards:[...s.querySelectorAll('[data-room-card-id]')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})}})()`);
  assert(result.dialog.x>=0&&result.dialog.y>=0&&result.dialog.x+result.dialog.width<=width+1&&result.dialog.y+result.dialog.height<=height+1);
  assert(Math.abs(result.stage.width/result.stage.height-615/280)<0.01);
  assert(result.cards.every(r=>r.width>0&&r.height>0&&r.x>=result.stage.x-1&&r.x+r.width<=result.stage.x+result.stage.width+1&&r.y>=result.stage.y-1&&r.y+r.height<=result.stage.y+result.stage.height+1));
  return result;
}
try {
  await launchServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5224,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3189',ws:true,rewrite:()=> '/'}}}});
  await vite.listen();
  const owners=new Map();
  const literal='<b>卡片名</b>';
  for(let id=6;id<=(keyboardOnly?7:17);id++) {
    const owner=await fixtureClient();
    const created=await owner.callApi('CreateRoom',{mode:id===9?4:1,mapId:7,minPlayers:2,maxPlayers:id===8?2:4,roomName:id===6?literal:`卡片房间${id}`,name:`房主${id}`,tankId:1,...(id===7?{password:'cards-pass'}:{})});
    assert(created.isSucc,JSON.stringify(created));assert.equal(created.res.room.id,`R${id}`);owners.set(id,owner);
  }
  const teamOccupant=await fixtureJoin('R6','队友计数');
  if(!keyboardOnly){const opponent=await fixtureJoin('R8','满员对手');
  for(const client of [owners.get(8),opponent])assert((await client.callApi('Ready',{round:1,isReady:true})).isSucc);}
  await launchBrowser();
  const page=await newPage();
  await input(page,'#player-name','卡片玩家');
  await click(page,'#refresh-rooms');
  await waitUntil(page,`!document.querySelector('#refresh-rooms').disabled&&[...document.querySelector('#room').options].some(o=>o.value==='R6')`);
  await click(page,'#open-room-cards');
  await waitUntil(page,`document.querySelector('${modal}').open`);
  let rooms=await refreshCards(page);
  if(keyboardOnly){
    await click(page,'[data-room-card-close]');await click(page,'#open-room-cards');
    for(let step=0;step<30&&await evaluate(page,`document.activeElement?.dataset.roomCardId!=='R6'`);step++)await press(page,'Tab','Tab');
    assert.equal(await evaluate(page,'document.activeElement?.dataset.roomCardId'),'R6');
    await press(page,'Enter','Enter');
    assert.equal((await modalState(page)).selected,'R6');
    assert.equal(await evaluate(page,'document.activeElement?.dataset.roomCardId'),'R6');
    await press(page,'Tab','Tab');assert.equal(await evaluate(page,'document.activeElement?.dataset.roomCardId'),'R7');
    await press(page,' ','Space');assert.equal((await modalState(page)).selected,'R7');assert.equal(await evaluate(page,'document.activeElement?.dataset.roomCardId'),'R7');assert.equal((await modalState(page)).cards.find(c=>c.id==='R7').selected,'true');
    evidence.checks.push({name:'fresh source cards native Tab/Enter then Tab/Space select rooms and retain keyboard focus after replacement',state:await modalState(page)});
  }else{
  const real=rooms.find(r=>r.id==='R6');assert.deepEqual(real.teamPlayerCounts,[1,1]);
  assert.equal(rooms.find(r=>r.id==='R8').phase,'PLAYING');
  let state=await modalState(page);
  assert.equal(state.cards.length,10);
  const literalCard=state.cards.find(c=>c.id==='R6');assert(literalCard.controls.some(c=>c.text===real.name));
  assert.equal(await evaluate(page,`document.querySelector('${card('R6')} [data-source-control=txtRoomName]').children.length`),0);
  const field=(entry,name)=>entry.controls.find(c=>c.name===name);
  const full=state.cards.find(c=>c.id==='R8');assert(full.disabled);
  assert.equal(field(literalCard,'txtTeam0PlayerNumber').text,'1');assert.equal(field(literalCard,'txtTeam1PlayerNumber').text,'1');
  assert.equal(field(literalCard,'picLock').hidden,true);assert.equal(field(literalCard,'picStarted').hidden,true);
  assert.equal(field(state.cards.find(c=>c.id==='R7'),'picLock').hidden,false);assert.equal(field(full,'picStarted').hidden,false);
  const personal=state.cards.find(c=>c.id==='R9');assert.equal(field(personal,'txtPlayerNumber').text,'1');assert.equal(field(personal,'picModeNormal').hidden,true);assert.equal(field(personal,'picModeMelee').hidden,false);
  assert(state.cards.every(c=>c.controls.filter(n=>n.loaded!==null&&!n.hidden&&n.display!=='none').every(n=>n.loaded)));
  const assets=await evaluate(page,`(async()=>{const urls=[...document.querySelectorAll('[data-room-card-id], [data-room-card-id] [data-source-control]')].map(e=>getComputedStyle(e).backgroundImage).filter(v=>v!=='none').map(v=>v.slice(5,-2));return Promise.all([...new Set(urls)].map(src=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve({src,width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>resolve({src,width:0,height:0});image.src=src})))})()`);assert(assets.length>0&&assets.every(a=>a.width>0&&a.height>0));
  evidence.checks.push({name:'source asset images decode successfully',assets});
  const hoverPoint=await evaluate(page,`(()=>{const r=document.querySelector('${card('R7')}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const normal=(await modalState(page)).cards.find(c=>c.id==='R7').background;
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...hoverPoint},page);
  const hover=(await modalState(page)).cards.find(c=>c.id==='R7').background;assert.notEqual(hover,normal);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1},page);
  assert.equal((await modalState(page)).cards.find(c=>c.id==='R7').background,normal);
  evidence.checks.push({name:'original card normal and hover imagery responds to native pointer',normal,hover});
  evidence.checks.push({name:'source card fields and actual team counts, locked/playing/full rooms; literal room name and loaded assets',rooms,state});
  const changed=await teamOccupant.callApi('ChangeTeam',{round:1,team:0});assert(changed.isSucc,JSON.stringify(changed));
  rooms=await refreshCards(page);state=await modalState(page);assert.deepEqual(rooms.find(r=>r.id==='R6').teamPlayerCounts,[2,0]);
  assert.equal(field(state.cards.find(c=>c.id==='R6'),'txtTeam0PlayerNumber').text,'2');assert.equal(field(state.cards.find(c=>c.id==='R6'),'txtTeam1PlayerNumber').text,'0');
  evidence.checks.push({name:'normal team change updates authoritative counts on modal refresh',state});
  await click(page,card('R6'));
  state=await modalState(page);assert.equal(state.selected,'R6');assert.equal(state.cards.find(c=>c.id==='R6').selected,'true');assert.notEqual(state.cards.find(c=>c.id==='R6').background,literalCard.background);
  evidence.checks.push({name:'native source card selection updates formal directory identity and pushed state',state});
  evidence.checks.push({name:'1080p original ten-slot stage fits viewport',geometry:await geometry(page,1920,1080)});
  await screenshot(page,'1080p-cards');
  await click(page,'[data-room-card-next]');
  state=await modalState(page);assert.deepEqual(state.cards.map(c=>c.id),rooms.slice(10).map(r=>r.id));
  await click(page,card('R17'));assert.equal((await modalState(page)).selected,'R17');
  await refreshCards(page);assert.equal((await modalState(page)).selected,'R17');
  evidence.checks.push({name:'native second page selection and refresh retain room identity',state:await modalState(page)});
  await click(page,'[data-room-card-previous]');
  await click(page,'[data-room-card-sort]');await waitUntil(page, `document.querySelector('[data-room-card-sort]').dataset.roomCardSortMode === 'EMPTY'`);
  state=await modalState(page);assert.equal(state.sort,'EMPTY');assert(!state.cards[0].disabled);
  evidence.checks.push({name:'modal EMPTY sort delegates to global eligible-first directory',state});
  await click(page,'[data-room-card-sort]');await waitUntil(page, `document.querySelector('[data-room-card-sort]').dataset.roomCardSortMode === 'ID'`);
  await click(page,card('R7'));
  await click(page,'[data-room-card-close]');
  await input(page,'#join-password','incorrect-pass');
  await click(page,'#open-room-cards');
  const rejectedFrom=network.length;
  await click(page,'[data-room-card-join]');
  await waitUntil(page,`document.querySelector('#battle-status').value.includes('密码')&&!document.querySelector('#join').disabled`);
  const rejected=network.slice(rejectedFrom).find(n=>n.page===page&&n.name==='Join'&&n.direction==='received');
  assert.equal(rejected?.success,false);assert.equal(await world(page),null);
  await click(page,'#open-room-cards');
  state=await modalState(page);assert.equal(state.selected,'R7');assert.equal(state.password,'incorrect-pass');assert.equal(state.cards.find(c=>c.id==='R7').selected,'true');
  evidence.checks.push({name:'modal ordinary Join rejects wrong password and reopen retains selection and draft',rejected,state});
  await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},page);
  evidence.checks.push({name:'4K original card stage and controls fit viewport',geometry:await geometry(page,3840,2160)});
  await click(page,'[data-room-card-next]');await click(page,'[data-room-card-previous]');await click(page,card('R7'));
  await screenshot(page,'4k-cards');
  await click(page,'[data-room-card-close]');await input(page,'#join-password','cards-pass');await click(page,'#open-room-cards');
  const joinFrom=network.length;
  await click(page,'[data-room-card-join]');
  await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);
  const joined=network.slice(joinFrom).find(n=>n.page===page&&n.name==='Join'&&n.direction==='received');assert(joined?.success);
  const value=await world(page);assert.equal(value.roomId,'R7');assert.equal(value.playerId,joined.response.playerId);assert(value.players.some(p=>p.id===value.playerId&&p.name==='卡片玩家'));
  assert.equal(await evaluate(page,`!!document.querySelector('${modal}')?.open`),false);
  evidence.checks.push({name:'native card ordinary Join enters real WAITING with authoritative player identity',joined,world:value});
  await screenshot(page,'4k-waiting');
  }
  evidence.status='PASS';await rm(`${output}-failure.png`,{force:true});console.log(keyboardOnly?'PASS: fresh source card Tab/Enter and Tab/Space selection retain keyboard focus':'PASS: source room cards real state, selection, paging, refresh, password rejection and ordinary Join at 1080p/4K');
} catch(error) {
  evidence.status='FAIL';evidence.error=error.stack??String(error);
  const session=pages[0]?.sessionId;if(session){evidence.failureState=await modalState(session).catch(()=>null);evidence.failureStatus=await evaluate(session,`document.querySelector('#battle-status')?.value`).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
} finally {
  for(const fixture of fixtures)await fixture.disconnect();if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.isolation={server:3189,vite:5224,chrome:9294};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;
  await writeFile(`${output}${keyboardOnly?'-keyboard':''}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}${keyboardOnly?'-keyboard':''}.log`,serverLog);
}
