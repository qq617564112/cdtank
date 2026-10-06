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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3313', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-02-C-IDTEXT-SCALE original MediumHT numeric images in complete real room IDs; local SIMSUN and card button regression.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = `recovery/output/browser-room-card-id-font-scale-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5335'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3313', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9535', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9535/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
  const client = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3313', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
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
const captures = [];
async function snapshot(session) {
  return evaluate(session, `(()=>{const d=document.querySelector('${modal}'),stage=d.querySelector('[data-room-card-stage]');const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {scale:Math.max(.25,Math.min(3,(window.innerWidth-48)/615,(window.innerHeight-160)/321)),stage:box(stage),selected:document.querySelector('#room').value,page:d.querySelector('[data-room-card-page]').textContent,cards:[...d.querySelectorAll('[data-room-card-id]')].map(card=>{const e=card.querySelector('[data-source-control=txtRoomID]'),content=e.querySelector('[data-source-text-content]');return {id:card.dataset.roomCardId,aria:card.getAttribute('aria-label'),selected:card.getAttribute('aria-pressed'),state:card.dataset.sourceButtonState,images:[...card.querySelectorAll('[data-room-button-image]')].map(i=>({property:i.dataset.roomButtonImage,asset:i.dataset.sourceAsset})),rect:box(card),field:{rect:box(e),left:e.style.left,top:e.style.top,width:e.style.width,height:e.style.height,title:e.title,text:e.textContent,font:e.dataset.sourceFont,color:getComputedStyle(content).color,overflow:getComputedStyle(e).overflow,horizontal:e.dataset.sourceHorzFormat,vertical:e.dataset.sourceVertFormat,clip:e.dataset.sourceTextClip,contentTop:content.style.top,extent:Number(content.dataset.sourceRasterExtent),glyphs:[...e.querySelectorAll('[data-source-raster-glyph]')].map(g=>({codepoint:Number(g.dataset.sourceRasterGlyph),asset:g.dataset.sourceAsset,rect:box(g),left:parseFloat(g.style.left),top:parseFloat(g.style.top),pointer:getComputedStyle(g).pointerEvents,aria:g.getAttribute('aria-hidden'),hit:document.elementFromPoint(box(g).x+box(g).width/2,box(g).y+box(g).height/2)===card}))},imageBeforeText:card.querySelector('[data-room-button-image]').compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING}}),simsun:[...d.querySelectorAll('[data-source-font=SIMSUN]')].map(e=>({name:e.dataset.sourceControl,text:e.textContent,color:getComputedStyle(e.querySelector('[data-source-text-content]')).color,glyphs:[...e.querySelectorAll('[data-source-raster-glyph]')].map(g=>Number(g.dataset.sourceRasterGlyph))})),previousDisabled:d.querySelector('[data-room-card-previous]').disabled,nextDisabled:d.querySelector('[data-room-card-next]').disabled}})()`);
}
async function cssPixels(session,values){return evaluate(session,`(()=>{const e=document.createElement('span');return ${JSON.stringify(values)}.map(value=>{e.style.left=value+'px';return parseFloat(e.style.left)})})()`);}
async function verify(session, width, height) {
  const state = await snapshot(session);
  const scale = state.scale;
  assert.equal(state.cards.length, 10);
  assert.deepEqual(state.cards.map(card => card.id), Array.from({length:10}, (_,i) => 'R'+(i+1)));
  for (const card of state.cards) {
    const field=card.field, digits=Array.from(card.id.slice(1));
    assert.equal(field.font,'MediumHT');assert.equal(field.text,card.id);assert.equal(field.title,card.id);assert(card.aria.startsWith(card.id+' '));
    assert.equal(field.color,'rgb(255, 255, 255)');assert.equal(field.overflow,'hidden');assert.equal(field.clip,'text-area-intersect-window');
    assert.equal(field.horizontal,'HorzCentred');assert.equal(field.vertical,'VertCentred');
    assert.deepEqual([field.left,field.top,field.width,field.height],['-1px','8px','32px','17px']);const factor=Math.fround(Math.fround(800*scale)/800),verticalFactor=Math.fround(Math.fround(600*scale)/600),imageHeight=Math.round(Math.fround(14*verticalFactor)),line=Math.fround(imageHeight*verticalFactor);const top=17*scale<line?-Math.round((line-17*scale)/2):Math.round((17*scale-line)/2);assert.equal(parseFloat(field.contentTop),(await cssPixels(session,[top/scale]))[0]);
    let nativeAdvance=0,nativeExtent=0;for(const d of digits){const w=d==='1'?7:10;nativeExtent=Math.max(nativeExtent,nativeAdvance+Math.round(Math.fround(w*factor)));nativeAdvance+=Math.trunc(w*factor);}nativeExtent=Math.max(nativeExtent,nativeAdvance);assert(Math.abs(field.extent-nativeExtent/scale)<.00001);assert.deepEqual(field.glyphs.map(g=>g.codepoint),digits.map(d=>d.codePointAt(0)));
    assert(Math.abs(field.rect.x-(card.rect.x-scale))<.15);assert(Math.abs(field.rect.y-(card.rect.y+8*scale))<.15);
    assert(Math.abs(field.rect.width-32*scale)<.15);assert(Math.abs(field.rect.height-17*scale)<.15);
    assert(field.rect.x>=0&&field.rect.y>=0&&field.rect.x+field.rect.width<=width+1&&field.rect.y+field.rect.height<=height+1);
    let advance=0;
    for(const glyph of field.glyphs){const gw=glyph.codepoint===49?7:10;const expectedLeft=(32-field.extent)/2+advance/scale;assert.equal(glyph.left,(await cssPixels(session,[expectedLeft]))[0]);assert(Math.abs(glyph.rect.x-(field.rect.x+expectedLeft*scale))<.15);assert.equal(glyph.top,0);assert(Math.abs(glyph.rect.width-Math.round(Math.fround(gw*factor)))<.15);assert(Math.abs(glyph.rect.height-imageHeight)<.15);assert(Math.abs(glyph.rect.y-(field.rect.y+top))<.15);assert.equal(glyph.pointer,'none');assert.equal(glyph.aria,'true');advance+=Math.trunc(gw*factor);}
    assert(card.imageBeforeText);assert.equal(card.images.length,1);
  }
  const page=state.simsun.find(field=>field.name==='yeshu');assert.equal(page.text,'1 / 2');assert.equal(page.color,'rgb(255, 255, 255)');assert.deepEqual(page.glyphs,Array.from(page.text).map(c=>c.codePointAt(0)));
  for(const field of state.simsun.filter(field=>field.name.includes('PlayerNumber'))){assert.equal(field.color,'rgb(255, 255, 255)');assert(field.glyphs.length>0);}
  return state;
}
async function capture(session,label,width,height){const state=await verify(session,width,height);await screenshot(session,label);captures.push({file:output+'-'+label+'.png',label,state});return state;}
try {
  await launchServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5335,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3313',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  for(let id=6;id<=17;id++){const owner=await fixtureClient();const created=await owner.callApi('CreateRoom',{mode:1,mapId:7,minPlayers:2,maxPlayers:6,roomName:'编号房'+id,name:'房主'+id,tankId:1});assert(created.isSucc,JSON.stringify(created));assert.equal(created.res.room.id,'R'+id);}
  await launchBrowser();const page=await newPage();await input(page,'#player-name','编号玩家');await click(page,'#refresh-rooms');await waitUntil(page,`[...document.querySelector('#room').options].some(o=>o.value==='R6')`);await click(page,'#open-room-cards');await waitUntil(page,`document.querySelector('${modal}').open&&document.querySelector('[data-source-control=txtRoomID] [data-source-raster-glyph]')&&document.querySelector('[data-room-card-page] [data-source-raster-glyph="47"]')`);
  await evaluate(page,`(()=>{window.idEvents=[];for(const name of ['pointerdown','keydown'])document.addEventListener(name,e=>{if(e.target.matches('[data-room-card-id]'))window.idEvents.push({type:e.type,isTrusted:e.isTrusted,key:e.key,id:e.target.dataset.roomCardId})},true)})()`);
  for(const [width,height,label]of [[800,600,'800'],[1920,1080,'1080p'],[3840,2160,'4k']]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);await pause(200);await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1},page);
    const normal=await capture(page,label+'-normal',width,height);const glyph=normal.cards.find(card=>card.id==='R6').field.glyphs[0].rect;const field=normal.cards.find(card=>card.id==='R6').field.rect;const point={x:glyph.x+glyph.width/2,y:(Math.max(glyph.y,field.y)+Math.min(glyph.y+glyph.height,field.y+field.height))/2};
    await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},page);await pause(30);const hover=await capture(page,label+'-hover',width,height);assert.equal(hover.cards.find(card=>card.id==='R6').state,'Hover');
    await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...point},page);await pause(30);const pushed=await capture(page,label+'-pushed',width,height);assert.equal(pushed.cards.find(card=>card.id==='R6').state,'Pushed');
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...point},page);await waitUntil(page,`document.querySelector('#room').value==='R6'`);await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1},page);await pause(25);const selected=await capture(page,label+'-selected',width,height);assert.equal(selected.cards.find(card=>card.id==='R6').state,'Normal');assert.equal(selected.cards.find(card=>card.id==='R6').selected,'true');
    evidence.checks.push({name:label+' actual real R1–R10 numeric glyphs, source geometry, white colour, window clip and layers; digit-point hit and ordinary button states',normal,selected});
  }
  await click(page,'[data-room-card-id="R6"]');await press(page,'Tab','Tab');assert(await evaluate(page,`document.activeElement.dataset.roomCardId==='R7'`));await press(page,'Enter','Enter');assert.equal((await snapshot(page)).selected,'R7');await press(page,'Tab','Tab');assert(await evaluate(page,`document.activeElement.dataset.roomCardId==='R8'`));await press(page,' ','Space');assert.equal((await snapshot(page)).selected,'R8');
  const previous=(await snapshot(page)).page;await click(page,'[data-room-card-previous]');assert.equal((await snapshot(page)).page,previous);await click(page,'[data-room-card-next]');await waitUntil(page,`document.querySelector('[data-room-card-page]').textContent==='2 / 2'`);await click(page,'[data-room-card-id="R17"]');assert.equal((await snapshot(page)).selected,'R17');await click(page,'[data-room-card-previous]');await waitUntil(page,`document.querySelector('[data-room-card-page]').textContent==='1 / 2'`);assert.equal(await world(page),null);
  const events=await evaluate(page,'window.idEvents');assert(events.some(e=>e.isTrusted&&e.type==='pointerdown'&&e.id==='R6'));assert(events.some(e=>e.isTrusted&&e.key==='Enter'&&e.id==='R7'));assert(events.some(e=>e.isTrusted&&e.key===' '&&e.id==='R8'));
  evidence.checks.push({name:'trusted ordinary card mouse/Enter/Space selection preserves complete identity; first boundary and second-page R17/back regression',events,world:await world(page),joinEvidenceReused:'browser-room-card-paging-accepted.json'});
  await writeFile(output+'-pixel-input.json',JSON.stringify(captures));
  evidence.pixels=JSON.parse(execFileSync('recovery/.venv/bin/python',['tests/room-card-id-font-scale-pixels.py',output+'-pixel-input.json'],{encoding:'utf8'}));
  evidence.status='PASS';console.log('PASS: MediumHT real IDs, three viewport screenshots, ordinary card and SIMSUN regression');
}catch(error){evidence.status='FAIL';evidence.error=error.stack??String(error);const session=pages[0]?.sessionId;if(session){evidence.failureState=await snapshot(session).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
}finally{for(const fixture of fixtures)await fixture.disconnect();if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3313,vite:5335,chrome:9535};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.captures=captures;evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);}
