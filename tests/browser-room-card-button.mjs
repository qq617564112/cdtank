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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3310', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-02-C-BUTTON original captured card image states and ordinary selection/Join.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = `recovery/output/browser-room-card-button-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5331'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3310', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9531', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9531/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
  const client = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3310', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
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
async function textState(session) {
  return evaluate(session, `(()=>{const names=['txtRoomName','txtTeam0PlayerNumber','txtTeam1PlayerNumber','txtPlayerNumber'];return [...document.querySelectorAll('[data-room-card-id]')].map(card=>({id:card.dataset.roomCardId,fields:[...card.querySelectorAll('.source-static-text')].filter(e=>names.includes(e.dataset.sourceControl)).map(e=>{const c=e.querySelector('[data-source-text-content]'),r=e.getBoundingClientRect();return {name:e.dataset.sourceControl,text:e.textContent,hidden:e.hidden,font:e.dataset.sourceFont,colour:e.dataset.sourceTextColour,horizontal:e.dataset.sourceHorzFormat,vertical:e.dataset.sourceVertFormat,clip:e.dataset.sourceTextClip,overflow:getComputedStyle(e).overflow,align:getComputedStyle(c).textAlign,color:getComputedStyle(c).color,fontFamily:getComputedStyle(c).fontFamily,extent:c.dataset.sourceRasterExtent,width:e.style.width,height:e.style.height,left:e.style.left,top:e.style.top,contentTop:c.style.top,lineHeight:c.style.height,glyphs:[...c.querySelectorAll('[data-source-raster-glyph]')].map(g=>({codepoint:g.dataset.sourceRasterGlyph,left:g.style.left,width:g.style.width,asset:getComputedStyle(g).backgroundImage,rect:(()=>{const r=g.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()})),screen:{x:r.x,y:r.y,width:r.width,height:r.height},scrollWidth:c.scrollWidth}})}))})()`);
}
const field=(states,id,name)=>states.find(c=>c.id===id).fields.find(f=>f.name===name);
const card=id=>`[data-room-card-id="${id}"]`,modal='dialog[data-room-cards]';
const samples=[],states=[];
async function point(session,selector){return evaluate(session,`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);}
const move=(session,p,held=false)=>command('Input.dispatchMouseEvent',{type:'mouseMoved',...p,...(held?{button:'left',buttons:1,modifiers:16}:{buttons:0})},session);
const down=(session,p)=>command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...p},session);
const up=(session,p)=>command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...p},session);
async function state(session,selector,expected,label){
  await pause(25);
  const actual=await evaluate(session,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return {state:e.dataset.sourceButtonState,pushed:e.dataset.sourcePushed,hovering:e.dataset.sourceHovering,selected:e.getAttribute('aria-pressed'),focused:document.activeElement===e,disabled:e.disabled,opacity:getComputedStyle(e).opacity,classes:e.className,images:[...e.querySelectorAll(':scope > [data-room-button-image]')].map(i=>({property:i.dataset.roomButtonImage,asset:i.dataset.sourceAsset,opacity:getComputedStyle(i).opacity,pointer:getComputedStyle(i).pointerEvents,background:getComputedStyle(i).backgroundImage})),text:e.querySelector('[data-source-control=txtTeam0PlayerNumber]')?.textContent,children:e.querySelectorAll('.source-static-text').length}})()`);
  assert.equal(actual.state,expected);assert.equal(actual.opacity,'1');
  const expectedImages=expected==='Disabled'?[]:[expected+'Image'];assert.deepEqual(actual.images.map(i=>i.property),expectedImages);
  for(const image of actual.images){assert.equal(image.opacity,'1');assert.equal(image.pointer,'none');assert(image.background.includes(image.asset));}
  states.push({label,selector,...actual});return actual;
}
async function checkCard(session,id,expected,label,capture=false){
  const actual=await state(session,card(id),expected,label);assert(actual.classes.includes('room-source-card'));assert.equal(actual.children,4);
  const source=await evaluate(session,`(async()=>{const u=await(await fetch('/ui.json')).json();const p=u.layouts.find(l=>l.path.endsWith('roomlist_icon.xml')).windows.find(c=>c.name==='btnRoom').properties;const ref=p['${expected}Image'];if(!ref)return null;const [,name]=ref.split(' image:');const set=u.imagesets.find(s=>s.attributes.Name==='lobby_ditu20'&&s.path.includes('imagesets_dds/'));return set.images.find(i=>i.Name===name).asset})()`);
  assert.equal(actual.images[0]?.asset??null,source);
  const texts=await textState(session);const count=field(texts,id,'txtTeam0PlayerNumber');assert.equal(count.color,'rgb(255, 255, 255)');assert(count.glyphs.length>0);
  if(capture){await screenshot(session,label);samples.push({file:`${output}-${label}.png`,state:label,field:count,opacity:Number(actual.opacity),visual:actual});}
  return actual;
}
async function openCards(session){await click(session,'#open-room-cards');await waitUntil(session,`document.querySelector('${modal}').open&&document.querySelector('${card('R6')} [data-source-raster-glyph]')`);}
try{
  await launchServer();vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5331,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3310',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  for(const [roomName,maxPlayers] of [['中文房间',6],['加入房间',6],['人数满房',2]]){const owner=await fixtureClient();const result=await owner.callApi('CreateRoom',{mode:1,mapId:7,minPlayers:2,maxPlayers,roomName,name:roomName,tankId:1});assert(result.isSucc,JSON.stringify(result));}
  const fullGuest=await fixtureJoin('R8','满员客');
  await launchBrowser();const page=await newPage();await input(page,'#player-name','卡片玩家');await click(page,'#refresh-rooms');await waitUntil(page,`[...document.querySelector('#room').options].some(o=>o.value==='R6')`);await openCards(page);
  if(process.argv.includes('--disabled-background-only')){
    evidence.scope='M5-02-C-BUTTON actual full/PLAYING disabled transparent background and original digit supplement';
    await command('Emulation.setDeviceMetricsOverride',{width:800,height:440,deviceScaleFactor:1,mobile:false},page);await pause(200);
    const captures=[];
    for(const label of ['full','playing']){
      if(label==='playing'){for(const client of [fixtures[2],fullGuest])assert((await client.callApi('Ready',{round:1,isReady:true})).isSucc);await click(page,'[data-room-card-refresh]');await waitUntil(page,`document.querySelector('${card('R8')}').getAttribute('aria-label').includes('PLAYING')`);}
      await move(page,{x:1,y:1});const result=await checkCard(page,'R8','Disabled','background-'+label,true);assert.equal(result.images.length,0);
      const blank=await evaluate(page,`(()=>{const b=document.querySelector('${card('R8')}'),r=b.getBoundingClientRect(),d=document.querySelector('${modal}');return {point:{x:Math.round(r.x+115),y:Math.round(r.y+110)},cardBackground:getComputedStyle(b).backgroundColor,parentBackground:getComputedStyle(d).backgroundColor}})()`);assert.equal(blank.cardBackground,'rgba(0, 0, 0, 0)');captures.push({file:output+'-background-'+label+'.png',...blank});
    }
    await writeFile(output+'-background-input.json',JSON.stringify(captures));evidence.backgroundPixels=JSON.parse(execFileSync('recovery/.venv/bin/python',['tests/room-card-button-background-pixels.py',output+'-background-input.json'],{encoding:'utf8'}));await writeFile(output+'-pixel-input.json',JSON.stringify(samples));evidence.pixels=JSON.parse(execFileSync('recovery/.venv/bin/python',['tests/room-card-text-pixels.py',output+'-pixel-input.json'],{encoding:'utf8'}));evidence.checks.push({name:'actual full/PLAYING disabled custom image absent, transparent button reveals parent background, source white digits remain',captures,pixels:evidence.pixels,background:evidence.backgroundPixels});evidence.status='PASS';
  }else{
  await evaluate(page,`(()=>{window.cardPointerEvidence=[];for(const type of ['pointerdown','pointerup','pointercancel','gotpointercapture','lostpointercapture'])document.addEventListener(type,e=>{const id=e.target.closest?.('[data-room-card-id]')?.dataset.roomCardId;if(id)window.cardPointerEvidence.push({type,id,isTrusted:e.isTrusted,pointerType:e.pointerType})},true)})()`);
  if(!process.argv.includes('--shared-join-only')&&!process.argv.includes('--waiting-only')){
  for(const [width,height,label] of [[800,600,'800'],[1920,1080,'1080p'],[3840,2160,'4k']].slice(process.argv.includes('--remaining-viewports')?1:0)){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);await pause(200);
    await click(page,card('R7'));await move(page,{x:1,y:1});await checkCard(page,'R6','Normal',label+'-normal',true);
    const p=await point(page,card('R6')),outside=await evaluate(page,`(()=>{const r=document.querySelector('${card('R6')}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.top-20}})()`);
    await move(page,p);await checkCard(page,'R6','Hover',label+'-hover');await down(page,p);await checkCard(page,'R6','Pushed',label+'-down',true);
    await move(page,outside,true);const captured=await checkCard(page,'R6','Hover',label+'-captured-out',true);assert.equal(captured.pushed,'true');
    await up(page,outside);await checkCard(page,'R6','Normal',label+'-outside-release');assert.equal(await evaluate(page,`document.querySelector('#room').value`),'R7');
    await move(page,p);await down(page,p);await move(page,outside,true);await move(page,p,true);await checkCard(page,'R6','Pushed',label+'-captured-return');await up(page,p);
    const selected=await checkCard(page,'R6','Hover',label+'-inside-release',true);assert.equal(selected.selected,'true');assert.equal(await evaluate(page,`document.querySelector('#room').value`),'R6');
    await move(page,{x:1,y:1});const persistent=await checkCard(page,'R6','Normal',label+'-selected-normal');assert.equal(persistent.selected,'true');
    await click(page,card('R8'));await checkCard(page,'R8','Disabled',label+'-disabled',true);assert.equal(await evaluate(page,`document.querySelector('#room').value`),'R6');
    evidence.checks.push({name:label+' source card normal/hover/captured drag-out/no-click/return/inside-click/disabled images and four text regression',states:states.filter(s=>s.label.startsWith(label))});
  }
  await command('Emulation.setDeviceMetricsOverride',{width:800,height:440,deviceScaleFactor:1,mobile:false},page);await pause(200);
  for(const [id,expected,label] of [['R6','Normal','native-normal'],['R8','Disabled','native-disabled']]){await move(page,{x:1,y:1});await checkCard(page,id,expected,label,true);}
  for(const client of [fixtures[2],fullGuest])assert((await client.callApi('Ready',{round:1,isReady:true})).isSucc);await click(page,'[data-room-card-refresh]');await waitUntil(page,`document.querySelector('${card('R8')}').getAttribute('aria-label').includes('PLAYING')`);await move(page,{x:1,y:1});await checkCard(page,'R8','Disabled','native-playing',true);
  const nativeSamples=samples.filter(s=>s.state.startsWith('native-'));await writeFile(`${output}-pixel-input.json`,JSON.stringify(nativeSamples));evidence.pixels=JSON.parse(execFileSync('recovery/.venv/bin/python',['tests/room-card-text-pixels.py',`${output}-pixel-input.json`],{encoding:'utf8'}));
  const touch=await point(page,card('R7'));await command('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1},page);await command('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...touch,id:1,radiusX:1,radiusY:1}]},page);await checkCard(page,'R7','Pushed','trusted-touch-start');await command('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]},page);await checkCard(page,'R7','Normal','trusted-touch-cancel');await command('Emulation.setTouchEmulationEnabled',{enabled:false},page);assert.equal(await evaluate(page,`document.querySelector('#room').value`),'R6');
  await click(page,card('R6'));await move(page,{x:1,y:1});for(let step=0;step<20&&!(await evaluate(page,`document.activeElement?.dataset.roomCardId==='R7'`));step++)await press(page,'Tab','Tab');assert.equal(await evaluate(page,`document.activeElement?.dataset.roomCardId`),'R7');
  await key(page,' ','Space');await checkCard(page,'R7','Pushed','space-down');await key(page,' ','Space','keyUp');await checkCard(page,'R7','Normal','space-up');assert.equal(await evaluate(page,`document.querySelector('#room').value`),'R7');assert.equal(await evaluate(page,`document.activeElement?.dataset.roomCardId`),'R7');
  // Native Shift+Tab restores the preceding available card.
  await key(page,'Tab','Tab','keyDown',{modifiers:8});await key(page,'Tab','Tab','keyUp',{modifiers:8});
  if(await evaluate(page,`document.activeElement?.dataset.roomCardId`) !=='R6'){await click(page,card('R6'));await move(page,{x:1,y:1});}
  await key(page,'Enter','Enter');await checkCard(page,'R6','Pushed','enter-down');await key(page,'Enter','Enter','keyUp');assert.equal(await evaluate(page,`document.querySelector('#room').value`),'R6');assert.equal(await evaluate(page,`document.activeElement?.dataset.roomCardId`),'R6');
  const events=await evaluate(page,'window.cardPointerEvidence');assert(events.some(e=>e.type==='pointercancel'&&e.isTrusted));assert(events.filter(e=>e.type==='pointerdown').every(e=>e.isTrusted));evidence.checks.push({name:'trusted pointer cancellation and ordinary Space/Enter selection retain identity/focus, source digit pixels',events,pixels:evidence.pixels});
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},page);await click(page,'[data-room-card-close]');if(!process.argv.includes('--waiting-only')){await click(page,'#create-room-controls summary');await click(page,'#open-room-create-dialog');await waitUntil(page,`document.querySelector('[data-room-create-cancel]')`);
  const cancel='[data-room-create-cancel]',cp=await point(page,cancel);await move(page,cp);await state(page,cancel,'Hover','shared-create-hover');await down(page,cp);await state(page,cancel,'Pushed','shared-create-down');await up(page,{x:1,y:1});await state(page,cancel,'Normal','shared-create-outside-release');await screenshot(page,'shared-create-state');await press(page,'Escape','Escape');}
  await openCards(page);await click(page,card('R7'));const joinFrom=network.length;await click(page,'[data-room-card-join]');await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);const joined=network.slice(joinFrom).find(n=>n.page===page&&n.name==='Join'&&n.direction==='received');assert(joined?.success);const value=await world(page);assert.equal(value.roomId,'R7');assert.equal(value.playerId,joined.response.playerId);
  await click(page,'[data-open-waiting-room]');await waitUntil(page,`document.querySelector('dialog[data-waiting-room]')?.open&&document.querySelector('[data-waiting-ready]')`);const readyButton='[data-waiting-ready]',rp=await point(page,readyButton);await move(page,rp);await state(page,readyButton,'Hover','shared-waiting-hover');await down(page,rp);await state(page,readyButton,'Pushed','shared-waiting-down');await move(page,{x:1,y:1},true);await up(page,{x:1,y:1});await state(page,readyButton,'Normal','shared-waiting-outside-release');await screenshot(page,'shared-waiting-state');assert(!(await world(page)).match.readyPlayerIds.includes(value.playerId));await press(page,'Escape','Escape');await click(page,'#leave');await waitUntil(page,`!(${worldExpression})`);
  evidence.checks.push({name:'minimal shared create/waiting state regression, one ordinary card Join reaches same authoritative WAITING and Leave',joined,world:value,sharedStates:states.filter(s=>s.label.startsWith('shared-'))});evidence.status='PASS';}
  console.log('PASS: '+evidence.checks.length+' completed scoped card button checks');
}catch(error){evidence.status='FAIL';evidence.error=error.stack??String(error);const session=pages[0]?.sessionId;if(session){evidence.pointerEvents=await evaluate(session,'window.cardPointerEvidence').catch(()=>null);evidence.failureStatus=await evaluate(session,`document.querySelector('#battle-status')?.value`).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
}finally{for(const fixture of fixtures)await fixture.disconnect();if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3310,vite:5331,chrome:9531};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.states=states;evidence.network=network;await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);}
