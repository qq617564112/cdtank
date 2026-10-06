import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const {WsClient} = require('tsrpc');
const {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3296', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-input-limit-'));
let server, chrome, vite, ws;
let serverLog = '';
let holdInputResponses = false;
const heldInputResponses = [];
function releaseInputResponses() {
  holdInputResponses = false;
  for (const send of heldInputResponses.splice(0)) send();
}
const pages = [], network = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'UI-07-R-INPUT-LIMIT source UTF32 count8/20, original typed gate/new value limit, actual Chinese composition/paste, create/password join and cleanup.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = (process.argv.includes('--single-gate-only')?'recovery/output/browser-room-create-input-limit-single-':'recovery/output/browser-room-create-input-limit-')+new Date().toISOString().replace(/[:.]/g,'-');
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5326'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3296', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9526', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9526/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
  }
  assert(endpoint, 'Dedicated Chromium failed to start');
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
  ws.on('close', () => {for (const callback of pending.values()) callback.reject(new Error('CDP closed')); pending.clear();});
  ws.on('message', raw => {
    const message = JSON.parse(String(raw));
    if(message.method==='Log.entryAdded') {evidence.browserLogs ??= [];evidence.browserLogs.push(message.params.entry);}
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
const modal = 'dialog[data-room-create-dialog]';
const nameInput = '[data-room-create-name]';
const passwordInput = '[data-room-create-password]';
const control = name => `${modal} [data-source-control="${name}"]`;
const worldExpression = `JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')`;
const form = session => evaluate(session, `({mode:Number(document.querySelector('#room-mode').value),map:Number(document.querySelector('#room-map').value),min:Number(document.querySelector('#room-min-players').value),max:Number(document.querySelector('#room-max-players').value),name:document.querySelector('#room-name').value,password:document.querySelector('#create-password').value,friendlyFire:document.querySelector('#room-friendly-fire').checked})`);
const modalState = session => evaluate(session, `(()=>{const d=document.querySelector('${modal}');return {open:!!d?.open,name:d?.querySelector('${nameInput}')?.value,password:d?.querySelector('${passwordInput}')?.value,min:Number(d?.querySelector('[data-source-control="txtLowBound"]')?.textContent),max:Number(d?.querySelector('[data-source-control="txtHighBound"]')?.textContent),friendlyFire:d?.querySelector('[data-room-create-friendly="true"]')?.getAttribute('aria-pressed')==='true',status:d?.querySelector('[data-room-create-status]')?.textContent,focused:document.activeElement?.dataset.sourceControl}})()`);
async function input(session, selector, value) {
  await click(session, selector);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},session);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},session);
  await command('Input.insertText',{text:String(value)},session);
}
async function open(session) {
  await click(session,'#open-room-create-dialog');
  await waitUntil(session,`document.querySelector('${modal}')?.open&&document.querySelector('[data-room-create-confirm]')`);
}
async function keyboardActivate(session,selector) {
  for(let step=0;step<35;step++) {
    if(await evaluate(session,`document.activeElement?.matches(${JSON.stringify(selector)})`)) {await press(session,'Enter','Enter');return;}
    await press(session,'Tab','Tab');
  }
  throw new Error('Keyboard could not reach '+selector);
}
async function verifySource(session,width,height) {
  const expectedScale=Math.min(width/800,height/600);
  await waitUntil(session, `(()=>{const e=document.querySelector('[data-room-create-stage]'),r=e?.getBoundingClientRect();return innerWidth===${width}&&innerHeight===${height}&&!!r&&Math.abs(r.width-310*${expectedScale})<.1&&Math.abs(r.height-328*${expectedScale})<.1})()`);
  const result=await evaluate(session,`(async()=>{
    const ui=await(await fetch('/ui.json')).json(),d=document.querySelector('${modal}'),layout=ui.layouts.find(l=>l.path==='ui/layouts/createroom.xml');
    function absolute(w){const n=w.properties.AbsoluteRect.match(/-?[\\d.]+/g).map(Number);let left=n[0],top=n[1];for(let p=w.parent;p;){const a=layout.windows.find(w=>w.name===p),b=a.properties.AbsoluteRect.match(/-?[\\d.]+/g).map(Number);left+=b[0];top+=b[1];p=a.parent;}return {left:left-248+2,top:top-140+10,width:n[2]-n[0],height:n[3]-n[1]};}
    function asset(reference){const m=/^set:(\\S+) image:(.+)$/.exec(reference),sets=ui.imagesets.filter(s=>s.attributes.Name===m[1]),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return set.images.find(i=>i.Name===m[2]).asset;}
    const rows=layout.windows.filter(w=>!['all','zhezhaoditu','quxiaoditu'].includes(w.name)&&(!w.name.startsWith('rdoNonCat')||!!d.querySelector('[data-source-control="rdoNonCatVsDog"]'))&&(!w.name.startsWith('rdoCat')||!!d.querySelector('[data-source-control="rdoCatVsDog"]'))).map(w=>{const e=d.querySelector('[data-source-control="'+w.name+'"]');if(!e)throw new Error('Missing '+w.name);const r=e.getBoundingClientRect();return {name:w.name,native:{left:parseFloat(e.style.left),top:parseFloat(e.style.top),width:parseFloat(e.style.width),height:parseFloat(e.style.height)},expected:absolute(w),rect:{x:r.x,y:r.y,width:r.width,height:r.height},background:getComputedStyle(e).backgroundImage,asset:e.dataset.sourceAsset,references:Object.entries(w.properties).filter(([key,value])=>key.endsWith('Image')&&value.startsWith('set:')).map(([key,reference])=>({key,reference,asset:asset(reference)}))};});
    const assets=[...new Set(rows.flatMap(r=>r.references.map(a=>a.asset)))],decoded=await Promise.all(assets.map(path=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve({asset:path,width:i.naturalWidth,height:i.naturalHeight});i.onerror=()=>reject(new Error(path));i.src='/'+path;})));
    const stage=d.querySelector('[data-room-create-stage]');return {rows,decoded,stage:{width:parseFloat(getComputedStyle(stage).width),height:parseFloat(getComputedStyle(stage).height)},name:{type:d.querySelector('${nameInput}').type,maxLength:d.querySelector('${nameInput}').maxLength},password:{type:d.querySelector('${passwordInput}').type,maxLength:d.querySelector('${passwordInput}').maxLength}};
  })()`);
  for(const row of result.rows) {
    assert.deepEqual(row.native,row.expected,row.name+' sheet-normalized rectangle');
    const r=row.rect;assert(Math.abs(r.width-row.expected.width*expectedScale)<.15,row.name+' committed scale width');assert(Math.abs(r.height-row.expected.height*expectedScale)<.15,row.name+' committed scale height');assert(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height,row.name+' visible');
    if(row.references.some(a=>a.key==='Image')&&row.name!=='picGameMode')assert(row.asset===row.references.find(a=>a.key==='Image').asset,row.name+' source image');
  }
  assert.deepEqual(result.name,{type:'text',maxLength:-1});assert.deepEqual(result.password,{type:'password',maxLength:-1});
  assert.deepEqual(result.stage,{width:310,height:328});
  assert(result.decoded.every(i=>i.width>0&&i.height>0));
  evidence.checks.push({name:`original control geometry, source PNG decoding and masked password at ${width}x${height}`,result});
  return result;
}

async function field(page,selector){return evaluate(page,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return {value:e.value,length:Array.from(e.value).length,utf16:e.value.length,maxLength:e.maxLength,start:e.selectionStart,end:e.selectionEnd,scroll:e.scrollLeft,focused:document.activeElement===e}})()`);}
async function range(page,selector,start,end){await click(page,selector);await press(page,'Home','Home');for(let i=0;i<start;i++)await press(page,'ArrowRight','ArrowRight');for(let i=start;i<end;i++){await key(page,'ArrowRight','ArrowRight','keyDown',{modifiers:8});await key(page,'ArrowRight','ArrowRight','keyUp',{modifiers:8});}}
async function paste(page,selector,text){await evaluate(page,`navigator.clipboard.writeText(${JSON.stringify(text)})`);await click(page,selector);await key(page,'v','KeyV','keyDown',{modifiers:2});await key(page,'v','KeyV','keyUp',{modifiers:2});}
try{
  await launchServer();vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5326,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3296',ws:true,rewrite:()=> '/',configure:proxy=>{proxy.on('proxyReqWs',(_request,_incoming,socket)=>{const originalWrite=socket.write.bind(socket);socket.write=(...args)=>{if(holdInputResponses){heldInputResponses.push(()=>originalWrite(...args));return true;}return originalWrite(...args);};});}}}}});await vite.listen();await launchBrowser();await command('Browser.grantPermissions',{origin:'http://127.0.0.1:5326',permissions:['clipboardReadWrite','clipboardSanitizedWrite']});const page=await newPage();await click(page,'#create-room-controls > summary');await open(page);
  if(process.argv.includes('--single-gate-only')){
    const rows=[];
    for(const [selector,limit]of [[nameInput,8],[passwordInput,20]]){
      const original='ABCDEFGHIJKLMNOPQRST'.slice(0,limit);await input(page,selector,original);await range(page,selector,3,3);
      await evaluate(page,`window.roomBefore=[];document.querySelector(${JSON.stringify(selector)}).addEventListener('beforeinput',event=>queueMicrotask(()=>window.roomBefore.push({inputType:event.inputType,data:event.data,defaultPrevented:event.defaultPrevented,isTrusted:event.isTrusted})))`);
      await key(page,'Z','KeyZ');await key(page,'Z','KeyZ','keyUp');const blocked=await field(page,selector),events=await evaluate(page,'window.roomBefore');assert.equal(blocked.value,original);assert(events.some(e=>e.data==='Z'&&e.defaultPrevented&&e.isTrusted));
      await range(page,selector,3,5);await key(page,'Z','KeyZ');await key(page,'Z','KeyZ','keyUp');const replaced=await field(page,selector);assert.equal(replaced.value,original.slice(0,3)+'Z'+original.slice(5));rows.push({selector,limit,original,blocked,replaced,events});
    }
    await screenshot(page,'800x600-native-single-gate');await press(page,'Escape','Escape');await waitUntil(page,`!document.querySelector('${modal}')`);evidence.checks.push({name:'Actual trusted beforeinput blocks middle single insert at8/20 and permits selection replacement without deleting suffix',rows});evidence.status='PASS';console.log('PASS actual native beforeinput full/middle gate and selection replacement; '+output);
  }else{
  evidence.viewports=[];
  for(const [width,height,label]of [[800,600,'800x600'],[1920,1080,'1080p'],[3840,2160,'4k']]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);await verifySource(page,width,height);const fields=[];
    for(const [selector,limit]of [[nameInput,8],[passwordInput,20]]){
      await input(page,selector,'A'.repeat(limit+3));await waitUntil(page,`document.querySelector(${JSON.stringify(selector)}).value.length===${limit}`);const supplied=await field(page,selector);assert.equal(supplied.maxLength,-1);await key(page,'X','KeyX');await key(page,'X','KeyX','keyUp');assert.equal((await field(page,selector)).value,'A'.repeat(limit));
      await range(page,selector,1,3);await key(page,'Z','KeyZ');await key(page,'Z','KeyZ','keyUp');const replacement=await field(page,selector);assert.equal(replacement.value,'AZ'+'A'.repeat(limit-3));assert.equal(replacement.length,limit-1);
      await input(page,selector,'');await paste(page,selector,'中文'.repeat(limit));await waitUntil(page,`Array.from(document.querySelector(${JSON.stringify(selector)}).value).length===${limit}`);const pasted=await field(page,selector);assert.equal(pasted.value,('中文'.repeat(limit)).slice(0,limit));
      await input(page,selector,'😀'.repeat(limit+2));const emoji=await field(page,selector);assert.equal(emoji.length,limit);assert.equal(emoji.utf16,2*limit);await key(page,'X','KeyX');await key(page,'X','KeyX','keyUp');assert.equal((await field(page,selector)).value,emoji.value);
      await input(page,selector,'中'.repeat(limit-1));await command('Input.imeSetComposition',{text:'文甲乙',selectionStart:3,selectionEnd:3},page);const preedit=await field(page,selector);assert.equal(preedit.length,limit+2,'Native preedit remains untruncated');await screenshot(page,label+(selector===nameInput?'-name':'-password')+'-preedit');await command('Input.insertText',{text:'文甲乙'},page);await waitUntil(page,`Array.from(document.querySelector(${JSON.stringify(selector)}).value).length===${limit}`);const committed=await field(page,selector);assert.equal(committed.value,'中'.repeat(limit-1)+'文');await screenshot(page,label+(selector===nameInput?'-name':'-password')+'-committed');fields.push({selector,limit,supplied,replacement,pasted,emoji,preedit,committed});
    }
    await input(page,nameInput,'中文合格房');await input(page,passwordInput,'中文\t拒绝');const from=network.length;holdInputResponses=true;await click(page,'[data-room-create-confirm]');await waitUntil(page,`document.querySelector('${passwordInput}').disabled`);await screenshot(page,label+'-pending');releaseInputResponses();await waitUntil(page,`!document.querySelector('${passwordInput}').disabled&&document.activeElement===document.querySelector('${passwordInput}')`);const rejection=network.slice(from).find(r=>r.name==='CreateRoom'&&r.direction==='received');assert.equal(rejection.success,false);assert.equal((await field(page,nameInput)).value,'中文合格房');assert.equal((await field(page,passwordInput)).value,'中文\t拒绝');await screenshot(page,label+'-rejected');evidence.viewports.push({label,width,height,fields,rejection});evidence.checks.push({name:label+' ordinary typed max reject/selection replacement/clipboard prefix/UTF32 emoji count/Chinese preedit commit/pending and actual server rejection'});
  }
  await input(page,nameInput,'中文成功房');await input(page,passwordInput,'中文可用密码');const from=network.length;await click(page,'[data-room-create-confirm]');await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'&&!document.querySelector('${modal}')`);const owner=await evaluate(page,worldExpression),request=network.slice(from).find(r=>r.name==='CreateRoom'&&r.direction==='sent'),response=network.slice(from).find(r=>r.name==='CreateRoom'&&r.direction==='received');assert(response.success);assert.equal(request.payload.roomName,'中文成功房');assert.equal(request.payload.password,'中文可用密码');await screenshot(page,'4k-success-waiting');
  const peer=await newPage();await click(peer,'#refresh-rooms');await waitUntil(peer,`[...document.querySelector('#room').options].some(o=>o.value===${JSON.stringify(owner.roomId)})&&!document.querySelector('#refresh-rooms').disabled`);await select(peer,'#room',owner.roomId);await input(peer,'#join-password','错误密码');const joinFrom=network.length;await click(peer,'#join');await waitUntil(peer,`document.querySelector('#battle-status').value.includes('密码')&&!document.querySelector('#join').disabled`);const wrong=network.slice(joinFrom).find(r=>r.name==='Join'&&r.direction==='received');assert.equal(wrong.success,false);await input(peer,'#join-password','中文可用密码');await click(peer,'#join');await waitUntil(peer,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);assert.equal((await evaluate(peer,worldExpression)).roomId,owner.roomId);evidence.checks.push({name:'Ordinary limited Chinese CreateRoom and independent peer wrong/right password Join same authoritative WAITING',request,response,wrong,owner});
  for(const p of [peer,page]){await click(p,'#leave');await waitUntil(p,`!(${worldExpression})`);}await open(page);await input(page,nameInput,'重开中文房');await range(page,nameInput,0,1);await waitUntil(page,`document.querySelector('[data-room-name-selection]')`);await press(page,'Escape','Escape');await waitUntil(page,`!document.querySelector('${modal}')`);assert(!await evaluate(page,`document.querySelector('[data-room-name-selection],[data-room-password-selection]')`));evidence.checks.push({name:'Both ordinary Leave, reopen limited source input and Escape clear source selection layers'});evidence.status='PASS';console.log('PASS source8/20 ordinary UTF32 input limit/composition/paste three viewport create/passwordjoin/cleanup; '+output);
}}catch(error){evidence.status='FAIL';evidence.error=error.stack??String(error);const page=pages[0]?.sessionId;if(page){evidence.failureForm=await modalState(page).catch(()=>null);await screenshot(page,'failure').catch(()=>{});}throw error;}
finally{releaseInputResponses();if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3296,vite:5326,chrome:9526};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);}
