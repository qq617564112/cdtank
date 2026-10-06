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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3191', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-map-selector-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-02-MS source mode/map selector with native draft selection, cancellation and ordinary authoritative room creation.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = 'recovery/output/browser-room-map-selector';
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5226'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3191', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9296', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9296/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
const modal = 'dialog[data-room-map-selector]';
const modeButton = mode => `[data-map-selector-mode="${mode}"]`;
const mapButton = map => `[data-map-selector-map="${map}"]`;
const worldExpression = `JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')`;
const form = session => evaluate(session, `({mode:Number(document.querySelector('#room-mode').value),map:Number(document.querySelector('#room-map').value),min:Number(document.querySelector('#room-min-players').value),max:Number(document.querySelector('#room-max-players').value),friendlyFire:document.querySelector('#room-friendly-fire').checked,friendlyFireDisabled:document.querySelector('#room-friendly-fire').disabled})`);
const modalState = session => evaluate(session, `(()=>{const d=document.querySelector('${modal}');return {open:!!d?.open,page:d?.querySelector('[data-map-selector-page]')?.textContent,previous:d?.querySelector('[data-map-selector-previous]')?.disabled,next:d?.querySelector('[data-map-selector-next]')?.disabled,focused:document.activeElement?.outerHTML,modes:[...d?.querySelectorAll('[data-map-selector-mode]')??[]].map(e=>({mode:Number(e.dataset.mapSelectorMode),selected:e.getAttribute('aria-pressed')})),maps:[...d?.querySelectorAll('[data-map-selector-map]')??[]].map(e=>({map:Number(e.dataset.mapSelectorMap),selected:e.getAttribute('aria-pressed'),disabled:e.disabled,text:e.textContent}))}})()`);
async function input(session, selector, value) {
  await click(session, selector);
  await command('Input.dispatchKeyEvent', {type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2}, session);
  await command('Input.dispatchKeyEvent', {type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2}, session);
  await command('Input.insertText', {text:String(value)}, session);
}
async function open(session) {
  await click(session, '#open-room-map-selector');
  await waitUntil(session, `document.querySelector('${modal}')?.open&&document.querySelector('[data-map-selector-map]')`);
}
async function keyboardActivate(session, selector) {
  await command('Page.bringToFront', {}, session);
  for(let step=0;step<40;step++) {
    if(await evaluate(session,`document.activeElement?.matches(${JSON.stringify(selector)})`)) {
      await press(session,'Enter','Enter');return;
    }
    await press(session,'Tab','Tab');
  }
  throw new Error('Keyboard could not reach '+selector);
}
async function assertFocus(session, selector) {
  assert(await evaluate(session,`document.activeElement?.matches(${JSON.stringify(selector)})`), `Focus lost after selecting ${selector}: ${JSON.stringify(await modalState(session))}`);
}
async function verifySource(session, width, height) {
  const result = await evaluate(session, `(async()=>{
    const ui=await(await fetch('/ui.json')).json();
    const d=document.querySelector('${modal}');
    const layout=ui.layouts.find(l=>l.path==='ui/layouts/selectgamemode.xml');
    function absolute(name){const w=layout.windows.find(w=>w.name===name);const n=w.properties.AbsoluteRect.match(/-?[\\d.]+/g).map(Number);let left=n[0],top=n[1];for(let parent=w.parent;parent;){const owner=layout.windows.find(w=>w.name===parent),box=owner.properties.AbsoluteRect.match(/-?[\\d.]+/g).map(Number);left+=box[0];top+=box[1];parent=owner.parent;}return {left:left-62,top:top-80,width:n[2]-n[0],height:n[3]-n[1]};}
    function asset(reference){const match=/^set:(\\S+) image:(.+)$/.exec(reference);const sets=ui.imagesets.filter(s=>s.attributes.Name===match[1]);const set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return set.images.find(i=>i.Name===match[2]).asset;}
    function node(e){const r=e.getBoundingClientRect();return {name:e.dataset.sourceControl,native:{left:parseFloat(e.style.left),top:parseFloat(e.style.top),width:parseFloat(e.style.width),height:parseFloat(e.style.height)},rect:{x:r.x,y:r.y,width:r.width,height:r.height},background:getComputedStyle(e).backgroundImage};}
    const names=['rdoTeamMode','rdoConquerMode','rdoVIPMode','rdoMeleeMode','rdoDestroyMode'];
    const modes=names.map(name=>{const e=d.querySelector('[data-source-control="'+name+'"]');if(!e)throw new Error('Missing '+name);const source=layout.windows.find(w=>w.name===name);return {...node(e),expected:absolute(name),references:['NormalImage','HoverImage','PushedImage','CheckMarkImage'].map(key=>source.properties[key]).filter(Boolean).map(reference=>({reference,asset:asset(reference)}))};});
    const slots=Array.from({length:8},(_,i)=>{const name='picMap'+i,e=d.querySelector('[data-source-control="'+name+'"]');if(!e)throw new Error('Missing '+name);return {...node(e),expected:absolute(name),selectable:!!e.querySelector('[data-map-selector-map]')||e.matches('[data-map-selector-map]')};});
    const icon=ui.layouts.find(l=>l.path==='ui/layouts/selectgamemode_icon.xml');
    function childExpected(name){const w=icon.windows.find(w=>w.name===name),n=w.properties.AbsoluteRect.match(/-?[\\d.]+/g).map(Number);let left=n[0],top=n[1];for(let parent=w.parent;parent;){const owner=icon.windows.find(w=>w.name===parent),box=owner.properties.AbsoluteRect.match(/-?[\\d.]+/g).map(Number);left+=box[0];top+=box[1];parent=owner.parent;}return {left,top,width:n[2]-n[0],height:n[3]-n[1]};}
    const cards=[...d.querySelectorAll('[data-map-selector-map]')].map(card=>{const map=Number(card.dataset.mapSelectorMap),reference='set:xiaoditu0 image:data'+String.fromCharCode(92)+'ui'+String.fromCharCode(92)+'xiaoditu'+String.fromCharCode(92)+String(map).padStart(4,'0')+'.tga';return {map,reference,expectedAsset:asset(reference),children:['ditu','picMapImage','txtMapName'].map(name=>{const e=card.querySelector('[data-source-control="'+name+'"]');return {...node(e),asset:e.dataset.sourceAsset,text:e.textContent,expected:childExpected(name),...(name==='ditu'?{expectedAsset:asset(icon.windows.find(w=>w.name===name).properties.Image)}:{})};})};});
    const assets=[...new Set([...modes.flatMap(m=>m.references.map(r=>r.asset)),...cards.flatMap(c=>c.children.map(child=>child.asset).filter(Boolean))])];
    const decoded=await Promise.all(assets.map(path=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve({asset:path,width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(new Error(path));image.src='/'+path;})));
    return {modes,slots,cards,decoded};
  })()`);
  for(const row of [...result.modes,...result.slots]) assert.deepEqual(row.native,row.expected, row.name+' original sheet-normalized rectangle');
  for(const row of result.modes) {
    assert(row.references.some(reference=>row.background.includes('/'+reference.asset)), row.name+' source imagery');
    const r=row.rect;assert(r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height,row.name+' visible');
  }
  for(const row of result.slots){const r=row.rect;assert(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height,row.name+' visible source slot');}
  for(const card of result.cards){for(const child of card.children)assert.deepEqual(child.native,child.expected,'card'+card.map+' '+child.name+' source rectangle');const preview=card.children.find(child=>child.name==='picMapImage'),bottom=card.children.find(child=>child.name==='ditu'),name=card.children.find(child=>child.name==='txtMapName');assert.equal(preview.asset,card.expectedAsset);assert(preview.asset.includes('ui/regions/76/'));assert(preview.background.includes('/'+card.expectedAsset));assert.equal(bottom.asset,bottom.expectedAsset);assert(name.text.length>0);const decoded=result.decoded.find(row=>row.asset===preview.asset);assert.deepEqual({width:decoded.width,height:decoded.height},{width:106,height:86});}
  assert(result.decoded.every(row=>row.width>0&&row.height>0));
  evidence.checks.push({name:`five source mode images, PNG decoding and eight original map slots at ${width}x${height}`,result});
}
try {
  await launchServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5226,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3191',ws:true,rewrite:()=> '/'}}}});
  await vite.listen();await launchBrowser();
  const page=await newPage();
  const maps=network.find(row=>row.page===page&&row.name==='ListMaps'&&row.direction==='received')?.response.maps;
  assert(maps?.length,'real ListMaps response');
  await click(page,'#create-room-controls > summary');
  const initial=await form(page);
  await open(page);
  let state=await modalState(page);
  assert.equal(state.modes.find(row=>row.selected==='true').mode,initial.mode);
  assert.equal(state.maps.find(row=>row.selected==='true').map,initial.map);
  await verifySource(page,1920,1080);await screenshot(page,'1080p');
  const directory=[];
  for(let mode=1;mode<=5;mode++) {
    await click(page,modeButton(mode));await assertFocus(page,modeButton(mode));
    state=await modalState(page);
    const expected=maps.filter(map=>map.mode===mode);
    assert.deepEqual(state.maps.map(row=>row.map),expected.slice(0,8).map(row=>row.mapId));
    assert(state.maps.length&&state.maps.every(row=>!row.disabled));assert(state.previous);assert.equal(state.next,expected.length<=8);
    assert(/^1\s*\//.test(state.page));
    const seen=[...state.maps.map(row=>row.map)];
    while(!state.next) {
      await click(page,'[data-map-selector-next]');state=await modalState(page);
      assert(state.maps.length>0&&state.maps.length<=8);seen.push(...state.maps.map(row=>row.map));
    }
    assert.deepEqual(seen,expected.map(row=>row.mapId));
    directory.push({mode,count:expected.length,pages:Math.ceil(expected.length/8),state});
    await click(page,mapButton(expected.at(-1).mapId));await assertFocus(page,mapButton(expected.at(-1).mapId));
    assert.deepEqual(await form(page),initial);
  }
  await keyboardActivate(page,modeButton(4));await assertFocus(page,modeButton(4));
  const chosen=maps.find(map=>map.mode===4&&map.mapId===7);assert(chosen);
  await keyboardActivate(page,mapButton(chosen.mapId));await assertFocus(page,mapButton(chosen.mapId));
  await press(page,'Escape','Escape');assert.equal((await modalState(page)).open,false);assert.deepEqual(await form(page),initial);
  assert(await evaluate(page,`document.activeElement?.id==='open-room-map-selector'`));
  await open(page);await click(page,modeButton(5));await click(page,'[data-map-selector-close]');assert.deepEqual(await form(page),initial);
  evidence.checks.push({name:'real directory mode filtering, eight-per-page bounds, native focus and draft-only mouse/keyboard selection; Escape and close cancel',directory,initial,pagination:directory.some(row=>row.pages>1)?'real multi-page directory exercised':'authoritative directory has no mode above eight maps'});
  await click(page,'#room-friendly-fire');assert.equal((await form(page)).friendlyFire,true);
  await input(page,'#room-min-players',3);await input(page,'#room-max-players',3);
  await open(page);await click(page,modeButton(4));await click(page,mapButton(chosen.mapId));
  await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},page);
  await verifySource(page,3840,2160);await screenshot(page,'4k');
  await keyboardActivate(page,'[data-map-selector-confirm]');assert.equal((await modalState(page)).open,false);
  const applied=await form(page);
  assert.deepEqual(applied,{mode:4,map:chosen.mapId,min:chosen.sourceMinPlayers,max:chosen.maxPlayers,friendlyFire:false,friendlyFireDisabled:true});
  evidence.checks.push({name:'confirm updates ordinary mode/map form and resets source player limits and unsupported friendly fire',applied,chosen});
  await input(page,'#room-min-players',chosen.maxPlayers+1);await input(page,'#room-max-players',chosen.maxPlayers);
  const refusedFrom=network.length;await click(page,'#create-room');
  await waitUntil(page,`document.querySelector('#battle-status').value.includes('人数')`);
  assert(!network.slice(refusedFrom).some(row=>row.page===page&&row.name==='CreateRoom'&&row.direction==='sent'));
  const refused=await form(page);assert.equal(refused.mode,4);assert.equal(refused.map,chosen.mapId);assert.equal(await evaluate(page,worldExpression),null);
  evidence.checks.push({name:'ordinary create visibly refuses invalid min/max, retains confirmed selection and sends no CreateRoom',refused,status:await evaluate(page,`document.querySelector('#battle-status').value`)});
  await input(page,'#room-min-players',chosen.sourceMinPlayers);await input(page,'#room-max-players',chosen.maxPlayers);
  const from=network.length;await click(page,'#create-room');
  await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);
  const world=await evaluate(page,worldExpression);
  const request=network.slice(from).find(row=>row.page===page&&row.name==='CreateRoom'&&row.direction==='sent');
  const response=network.slice(from).find(row=>row.page===page&&row.name==='CreateRoom'&&row.direction==='received');
  assert(response?.success,JSON.stringify(response));assert.equal(request.payload.mode,4);assert.equal(request.payload.mapId,chosen.mapId);
  assert.equal(world.mode,4);assert.equal(world.mapId,chosen.mapId);assert.equal(world.match.minPlayers,chosen.sourceMinPlayers);assert.equal(world.match.maxPlayers,chosen.maxPlayers);assert.equal(world.match.friendlyFire,false);
  const snapshot=network.slice(from).find(row=>row.page===page&&row.name==='RoomSnapshot'&&row.direction==='received'&&row.payload.phase==='WAITING');assert(snapshot,'decoded server WAITING snapshot');
  evidence.checks.push({name:'ordinary CreateRoom request/response and decoded authoritative WAITING match agree with confirmed mode/map',request,response,world,snapshot});await screenshot(page,'waiting');
  await click(page,'#leave');
  evidence.status='PASS';await rm(`${output}-failure.png`,{force:true});console.log('PASS: original five-mode/eight-slot selector, real directory, native draft/cancel/confirm/focus, refusal and authoritative WAITING, 1080p/4K');
} catch(error) {
  evidence.status='FAIL';evidence.error=error.stack??String(error);
  const session=pages[0]?.sessionId;if(session){evidence.failureState=await modalState(session).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
} finally {
  if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.isolation={server:3191,vite:5226,chrome:9296};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;
  await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);
}
