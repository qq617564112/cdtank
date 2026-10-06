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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3311', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-02-C-PAGING original source paging controls, real directory and ordinary Join.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = `recovery/output/browser-room-card-paging-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5333'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3311', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9533', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9533/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
  const client = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3311', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
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
async function point(session,selector){return evaluate(session,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);}
async function snapshot(session){return evaluate(session,`(()=>{const d=document.querySelector('${modal}'),stage=d.querySelector('[data-room-card-stage]'),s=stage.getBoundingClientRect();return {page:d.querySelector('[data-room-card-page]').textContent,selected:document.querySelector('#room').value,stage:{x:s.x,y:s.y,width:s.width,height:s.height},cards:[...d.querySelectorAll('[data-room-card-id]')].map(e=>e.dataset.roomCardId),controls:['btnPageUp','btnPageDown','yeshu'].map(name=>{const e=d.querySelector('[data-source-control='+name+']'),r=e.getBoundingClientRect(),content=e.querySelector('[data-source-text-content]');return {name,state:e.dataset.sourceButtonState,disabled:e.disabled,asset:e.dataset.sourceAsset,left:e.style.left,top:e.style.top,width:e.style.width,height:e.style.height,opacity:getComputedStyle(e).opacity,rect:{x:r.x,y:r.y,width:r.width,height:r.height},hit:e instanceof HTMLButtonElement?document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e:null,images:[...e.querySelectorAll('[data-room-button-image]')].map(i=>({property:i.dataset.roomButtonImage,asset:i.dataset.sourceAsset,opacity:getComputedStyle(i).opacity,pointer:getComputedStyle(i).pointerEvents})),font:e.dataset.sourceFont,color:content?getComputedStyle(content).color:null,horizontal:e.dataset.sourceHorzFormat,vertical:e.dataset.sourceVertFormat,clip:e.dataset.sourceTextClip,text:e.textContent,extent:content?.dataset.sourceRasterExtent,glyphs:[...e.querySelectorAll('[data-source-raster-glyph]')].map(g=>{const b=g.getBoundingClientRect();return {codepoint:Number(g.dataset.sourceRasterGlyph),asset:getComputedStyle(g).backgroundImage,backgroundSize:getComputedStyle(g).backgroundSize,backgroundPosition:getComputedStyle(g).backgroundPosition,rect:{x:b.x,y:b.y,width:b.width,height:b.height}}})}})}})()`);}
async function verify(session,width,height){const state=await snapshot(session);assert(Math.abs(state.stage.width/state.stage.height-615/321)<.001);const scale=state.stage.width/615;for(const row of state.controls){const expected=row.name==='btnPageUp'?[176,274,26,37]:row.name==='btnPageDown'?[484,274,26,37]:[557,261,50,15];assert.equal(parseFloat(row.left),expected[0]);assert.equal(parseFloat(row.top),expected[1]+84);assert(Math.abs(row.rect.x-(state.stage.x+expected[0]*scale))<.1);assert(Math.abs(row.rect.y-(state.stage.y+expected[1]*scale))<.1);assert(Math.abs(row.rect.width-expected[2]*scale)<.1);assert(Math.abs(row.rect.height-expected[3]*scale)<.1);assert(row.rect.x>=0&&row.rect.y>=0&&row.rect.x+row.rect.width<=width+1&&row.rect.y+row.rect.height<=height+1);if(row.name!=='yeshu'){assert.equal(row.hit,true);assert.equal(row.images.length,1);assert.equal(row.opacity,'1');assert.equal(row.images[0].opacity,'1');assert.equal(row.images[0].pointer,'none');}else{assert.equal(row.font,'SIMSUN');assert.equal(row.color,'rgb(255, 255, 255)');assert.equal(row.horizontal,'HorzCentred');assert.equal(row.vertical,'VertCentred');assert.equal(row.clip,'text-area-intersect-window');assert(row.glyphs.some(g=>g.codepoint===47));assert(row.extent);assert.deepEqual(row.glyphs.map(g=>g.codepoint),Array.from(row.text).map(c=>c.codePointAt(0)));}}return state;}
async function imageState(session,name,expected){const selector=`${modal} [data-source-control=${name}]`;await pause(25);const state=await snapshot(session),row=state.controls.find(r=>r.name===name);assert.equal(row.state,expected);assert.equal(row.images[0].property,expected+'Image');const source=await evaluate(session,`(async()=>{const u=await(await fetch('/ui.json')).json();const ref=u.layouts.find(l=>l.path.endsWith('roomlist.xml')).windows.find(c=>c.name==='${name}').properties['${expected}Image'];const [setName,imageName]=ref.slice(4).split(' image:');const sets=u.imagesets.filter(s=>s.attributes.Name===setName);return (sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0]).images.find(i=>i.Name===imageName).asset})()`);assert.equal(row.images[0].asset,source);return row;}
async function capture(session,label,width,height){const state=await verify(session,width,height);await screenshot(session,label);captures.push({file:`${output}-${label}.png`,label,state});return state;}
try{
  await launchServer();vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5333,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3311',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  for(let id=6;id<=17;id++){const owner=await fixtureClient();const created=await owner.callApi('CreateRoom',{mode:1,mapId:7,minPlayers:2,maxPlayers:6,roomName:`分页房${id}`,name:`房主${id}`,tankId:1});assert(created.isSucc,JSON.stringify(created));assert.equal(created.res.room.id,'R'+id);}
  await launchBrowser();const page=await newPage();await input(page,'#player-name','分页玩家');await click(page,'#refresh-rooms');await waitUntil(page,`[...document.querySelector('#room').options].some(o=>o.value==='R6')`);await click(page,'#open-room-cards');await waitUntil(page,`document.querySelector('${modal}').open&&document.querySelector('[data-room-card-page] [data-source-raster-glyph="47"]')`);
  await evaluate(page,`(()=>{window.pagingEvents=[];document.addEventListener('keydown',e=>{if(e.target.matches('[data-room-card-previous],[data-room-card-next]'))window.pagingEvents.push({isTrusted:e.isTrusted,key:e.key,source:e.target.dataset.sourceControl})},true);document.addEventListener('pointerdown',e=>{if(e.target.matches('[data-room-card-previous],[data-room-card-next]'))window.pagingEvents.push({isTrusted:e.isTrusted,source:e.target.dataset.sourceControl})},true)})()`);
  if(process.argv.includes('--previous-hover-only')){
    await click(page,'[data-room-card-next]');await waitUntil(page,`document.querySelector('[data-room-card-page]').textContent==='2 / 2'`);
    for(const [width,height,label]of [[800,600,'800'],[1920,1080,'1080p'],[3840,2160,'4k']]){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);await pause(200);const p=await point(page,'[data-room-card-previous]');await command('Input.dispatchMouseEvent',{type:'mouseMoved',...p},page);await imageState(page,'btnPageUp','Hover');await capture(page,label+'-previous-hover',width,height);}
    await writeFile(output+'-pixel-input.json',JSON.stringify(captures));evidence.pixels=JSON.parse(execFileSync('recovery/.venv/bin/python',['tests/room-card-paging-pixels.py',output+'-pixel-input.json','--no-native'],{encoding:'utf8'}));evidence.checks.push({name:'three viewport actual previous Hover source PNG and opaque interior pixels',captures,pixels:evidence.pixels});evidence.status='PASS';
  }else{
  if(!process.argv.includes('--operation-only')){
  for(const [width,height,label]of [[800,600,'800'],[1920,1080,'1080p'],[3840,2160,'4k']]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);await pause(200);
    if((await snapshot(page)).page==='2 / 2')await click(page,'[data-room-card-previous]');
    await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1},page);await imageState(page,'btnPageUp','Disabled');await imageState(page,'btnPageDown','Normal');let first=await capture(page,label+'-first',width,height);assert.equal(first.page,'1 / 2');assert.deepEqual(first.cards,Array.from({length:10},(_,i)=>'R'+(i+1)));
    await click(page,'[data-room-card-previous]');assert.equal((await snapshot(page)).page,'1 / 2');
    const next=await point(page,'[data-room-card-next]');await command('Input.dispatchMouseEvent',{type:'mouseMoved',...next},page);await imageState(page,'btnPageDown','Hover');await capture(page,label+'-next-hover',width,height);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...next},page);await imageState(page,'btnPageDown','Pushed');await capture(page,label+'-next-down',width,height);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...next},page);await waitUntil(page,`document.querySelector('[data-room-card-page]').textContent==='2 / 2'`);
    await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1},page);await imageState(page,'btnPageDown','Disabled');await imageState(page,'btnPageUp','Normal');let last=await capture(page,label+'-last',width,height);assert.deepEqual(last.cards,Array.from({length:7},(_,i)=>'R'+(i+11)));
    await click(page,'[data-room-card-next]');assert.equal((await snapshot(page)).page,'2 / 2');await click(page,'[data-room-card-id="R17"]');assert.equal((await snapshot(page)).selected,'R17');
    const prev=await point(page,'[data-room-card-previous]');await command('Input.dispatchMouseEvent',{type:'mouseMoved',...prev},page);await imageState(page,'btnPageUp','Hover');await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...prev},page);await imageState(page,'btnPageUp','Pushed');await capture(page,label+'-previous-down',width,height);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...prev},page);await waitUntil(page,`document.querySelector('[data-room-card-page]').textContent==='1 / 2'`);const back=await verify(page,width,height);assert(back.cards.includes(back.selected));
    evidence.checks.push({name:label+' real source previous/next states, disabled first/last boundaries, original page glyphs and ordinary card identity',first,last,back});
  }
  await command('Emulation.setDeviceMetricsOverride',{width:800,height:481,deviceScaleFactor:1,mobile:false},page);await pause(200);await capture(page,'native-page-glyphs',800,481);
  await writeFile(output+'-pixel-input.json',JSON.stringify(captures));evidence.pixels=JSON.parse(execFileSync('recovery/.venv/bin/python',['tests/room-card-paging-pixels.py',output+'-pixel-input.json'],{encoding:'utf8'}));
  }
  if(!process.argv.includes('--join-leave-only')){
  await click(page,'[data-room-card-id="R6"]');for(let step=0;step<30&&!(await evaluate(page,`document.activeElement?.matches('[data-room-card-next]')`));step++)await press(page,'Tab','Tab');assert(await evaluate(page,`document.activeElement?.matches('[data-room-card-next]')`));await press(page,'Enter','Enter');await waitUntil(page,`document.querySelector('[data-room-card-page]').textContent==='2 / 2'`);evidence.nextDisabledFocus=await evaluate(page,`({tag:document.activeElement?.tagName,source:document.activeElement?.dataset.sourceControl,insideDialog:document.querySelector('${modal}').contains(document.activeElement)})`);await press(page,'Enter','Enter');assert.equal((await snapshot(page)).page,'2 / 2');await click(page,'[data-room-card-id="R17"]');for(let step=0;step<30&&!(await evaluate(page,`document.activeElement?.matches('[data-room-card-previous]')`));step++)await press(page,'Tab','Tab');assert(await evaluate(page,`document.activeElement?.matches('[data-room-card-previous]')`));await press(page,' ','Space');await waitUntil(page,`document.querySelector('[data-room-card-page]').textContent==='1 / 2'`);await press(page,' ','Space');assert.equal((await snapshot(page)).page,'1 / 2');evidence.keyboard={nextEnter:true,lastDisabledNoMove:true,previousSpace:true,firstDisabledNoMove:true,world:await world(page)};assert.equal(evidence.keyboard.world,null);}
  await click(page,'[data-room-card-next]');await waitUntil(page,`document.querySelector('[data-room-card-page]').textContent==='2 / 2'`);await click(page,'[data-room-card-id="R17"]');const from=network.length;await click(page,'[data-room-card-join]');await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);const joined=network.slice(from).find(n=>n.page===page&&n.name==='Join'&&n.direction==='received');assert(joined?.success);const value=await world(page);assert.equal(value.roomId,'R17');assert.equal(value.playerId,joined.response.playerId);if(!await evaluate(page,`document.querySelector('dialog[data-waiting-room]')?.open`))await click(page,'[data-open-waiting-room]');await waitUntil(page,`document.querySelector('[data-waiting-close]')`);await click(page,'[data-waiting-close]');await waitUntil(page,`!(${worldExpression})`);evidence.checks.push({name:'ordinary original next-page/second-page card selection Join reaches R17 WAITING and Leave',joined,world:value,pixels:evidence.pixels,events:await evaluate(page,'window.pagingEvents')});evidence.status='PASS';}
  console.log('PASS: scoped source paging checks');
}catch(error){evidence.status='FAIL';evidence.error=error.stack??String(error);const session=pages[0]?.sessionId;if(session){evidence.failureState=await snapshot(session).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
}finally{for(const fixture of fixtures)await fixture.disconnect();if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3311,vite:5333,chrome:9533};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.captures=captures;evidence.network=network;await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);}
