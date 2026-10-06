import assert from 'node:assert/strict';
import {advanceRoomCreateCaret} from '../apps/web/src/interface/lobby/room-create-caret-clock.ts';
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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3270', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-create-dialog-'));
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
const evidence = {status: 'RUNNING', scope: 'UI-07-R source visual slice and room-create dialog and ordinary authoritative create/join.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = (process.argv.includes('--emotion-gate-only')||process.argv.includes('--emotion-gate-success-only')) ? 'recovery/output/browser-room-create-emotion-gate-'+new Date().toISOString().replace(/[:.]/g,'-') : process.argv.includes('--frame-shared-regression') ? 'recovery/output/browser-room-create-frame-shared-'+new Date().toISOString().replace(/[:.]/g,'-') : process.argv.includes('--button-shared-regression') ? 'recovery/output/browser-room-create-button-shared' : process.argv.includes('--button-only') ? 'recovery/output/browser-room-create-button' : process.argv.includes('--name-selection-only') ? 'recovery/output/browser-room-create-name-selection' : process.argv.includes('--caret-only') ? 'recovery/output/browser-room-create-caret' : process.argv.includes('--password-selection-only') ? 'recovery/output/browser-room-create-password-selection' : process.argv.includes('--password-only') ? 'recovery/output/browser-room-create-password' : process.argv.includes('--input-only') ? 'recovery/output/browser-room-create-input' : process.argv.includes('--text-fixture-only') ? 'recovery/output/browser-room-create-text-fixture' : process.argv.includes('--text-only') ? 'recovery/output/browser-room-create-text' : process.argv.includes('--scale-only') ? 'recovery/output/browser-room-create-scale' : process.argv.includes('--image-only') ? 'recovery/output/browser-room-create-image' : process.argv.includes('--frame-only') ? 'recovery/output/browser-room-create-frame' : process.argv.includes('--mask-only') ? 'recovery/output/browser-room-create-mask' : process.argv.includes('--states-only') ? 'recovery/output/browser-room-create-visual-states' : 'recovery/output/browser-room-create-visual';
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5300'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3270', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9500', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9500/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
async function verifyButtonImages(session,source) {
  const row=source.rows.find(r=>r.name==='btnOK'),selector=control('btnOK');
  const point=await evaluate(session,`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},session);
  let image=await evaluate(session,`getComputedStyle(document.querySelector(${JSON.stringify(selector)}).querySelector('[data-room-button-image]')).backgroundImage`);
  assert(image.includes('/'+row.references.find(r=>r.key==='HoverImage').asset));
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point},session);
  image=await evaluate(session,`getComputedStyle(document.querySelector(${JSON.stringify(selector)}).querySelector('[data-room-button-image]')).backgroundImage`);
  assert(image.includes('/'+row.references.find(r=>r.key==='PushedImage').asset));
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x-100,y:point.y-80},session);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:point.x-100,y:point.y-80},session);
  evidence.checks.push({name:'OK native hover and held pointer use original HoverImage/PushedImage'});
}






async function verifyButtonVisual(session) {
  const native=JSON.parse(await readFile('recovery/output/room-create-button-native.json','utf8'));assert.equal(native.status,'PASS');
  for (const [width,height,label] of (process.argv.includes('--button-shared-regression') ? [[800,600,'800x600']] : [[800,600,'800x600'],[1920,1080,'1080p'],[3840,2160,'4k']])) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);const geometry=await verifySource(session,width,height),rows=[];
    const selector=name=>`[data-room-create-stage] [data-source-control="${name}"]`;
    const point=async name=>evaluate(session,`(()=>{const r=document.querySelector('${selector(name)}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    const move=async p=>command('Input.dispatchMouseEvent',{type:'mouseMoved',...p},session);
    const down=async p=>command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...p},session);
    const heldMove=async p=>command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,...p},session);
    const up=async p=>command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...p},session);
    async function sample(name,state,selected=false) {
      await waitUntil(session,`document.querySelector('${selector(name)}')?.dataset.sourceButtonState==='${state}'`);
      const r=await evaluate(session,`(()=>{const e=document.querySelector('${selector(name)}'),b=e.getBoundingClientRect();return {control:e.dataset.sourceControl,state:e.dataset.sourceButtonState,pushed:e.dataset.sourcePushed,hovering:e.dataset.sourceHovering,disabled:e.disabled,selected:e.getAttribute('aria-pressed'),opacity:getComputedStyle(e).opacity,images:[...e.querySelectorAll('[data-room-button-image]')].map(i=>{const r=i.getBoundingClientRect();return {property:i.dataset.roomButtonImage,asset:i.dataset.sourceAsset,background:getComputedStyle(i).backgroundImage,opacity:getComputedStyle(i).opacity,pointer:getComputedStyle(i).pointerEvents,rect:[r.x-b.x,r.y-b.y,r.width,r.height]}}),rect:[b.width,b.height],hit:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===e};})()`);
      const source=geometry.rows.find(r=>r.name===name),template=name.startsWith('rdo')?'rdoFriendlyFireOff':source.references.some(i=>i.key==='DisabledImage')?'btnIncLowBound':'btnOK';
      const expected=native.vectors.find(r=>r.control===template&&r.state===state&&r.selected===selected&&r.effectiveAlpha===1).images;
      assert.deepEqual(r.images.map(i=>i.property),expected.map(i=>i.property));assert.equal(r.opacity,'1');assert(r.hit);
      for(const i of r.images){const ref=source.references.find(ref=>ref.key===i.property);assert.equal(i.asset,ref.asset);assert(i.background.includes('/'+ref.asset));assert.equal(i.opacity,'1');assert.equal(i.pointer,'none');assert.deepEqual(i.rect,[0,0,...r.rect]);}rows.push(r);return r;
    }
    await move({x:5,y:5});await sample('btnOK','Normal');await sample('btnDecLowBound','Disabled');await sample('rdoCatVsDog','Disabled',true);await sample('rdoNonCatVsDog','Disabled');await screenshot(session,label+'-normal-disabled-mode');
    let p=await point('btnIncLowBound'),outside={x:p.x-80,y:p.y-55};await move(p);await sample('btnIncLowBound','Hover');await screenshot(session,label+'-hover');await down(p);await sample('btnIncLowBound','Pushed');await screenshot(session,label+'-pressed');await heldMove(outside);const dragged=await sample('btnIncLowBound','Hover');assert.equal(dragged.pushed,'true');await screenshot(session,label+'-captured-outside');await heldMove(p);await sample('btnIncLowBound','Pushed');await up(p);await sample('btnIncLowBound','Hover');assert.equal((await modalState(session)).min,5);await screenshot(session,label+'-return-release');
    await down(p);await heldMove(outside);await up(outside);await sample('btnIncLowBound','Normal');assert.equal((await modalState(session)).min,5);await screenshot(session,label+'-outside-release');
    await key(session,' ','Space');await sample('btnIncLowBound','Pushed');await screenshot(session,label+'-space-down');await key(session,' ','Space','keyUp');await sample('btnIncLowBound','Normal');assert.equal((await modalState(session)).min,6);await key(session,'Enter','Enter');await sample('btnIncLowBound','Pushed');assert.equal((await modalState(session)).min,7);await screenshot(session,label+'-enter-down');await key(session,'Enter','Enter','keyUp');await sample('btnIncLowBound','Normal');
    await key(session,' ','Space');await sample('btnIncLowBound','Pushed');await press(session,'Tab','Tab');await sample('btnIncLowBound','Normal');await key(session,' ','Space','keyUp');assert.equal((await modalState(session)).min,7);await screenshot(session,label+'-keyboard-blur');
    await click(session,selector('rdoFriendlyFireOn'));await sample('rdoFriendlyFireOn','Hover',true);await sample('rdoFriendlyFireOff','Normal');await screenshot(session,label+'-selected-radio');
    p=await point('btnIncLowBound');await move(p);await down(p);await sample('btnIncLowBound','Pushed');await press(session,'Tab','Tab');await sample('btnIncLowBound','Normal');await up(p);assert.equal((await modalState(session)).min,7);await screenshot(session,label+'-captured-focus-blur');
    await input(session,nameInput,'原按钮状态房间');await input(session,passwordInput,'中文密码\t拒绝');holdInputResponses=true;const from=network.length;await click(session,'[data-room-create-confirm]');await waitUntil(session,`document.querySelector('${passwordInput}')?.disabled`);await sample('btnOK','Disabled');await sample('btnClose','Disabled');await sample('btnIncLowBound','Disabled');await sample('rdoFriendlyFireOn','Disabled',true);await sample('rdoCatVsDog','Disabled',true);await screenshot(session,label+'-pending');await click(session,'[data-room-create-confirm]');assert.equal(network.slice(from).filter(r=>r.name==='CreateRoom'&&r.direction==='sent').length,1);releaseInputResponses();await waitUntil(session,`document.activeElement===document.querySelector('${passwordInput}')&&!document.querySelector('${passwordInput}').disabled`);const rejected=network.slice(from).find(r=>r.name==='CreateRoom'&&r.direction==='received');assert.equal(rejected?.success,false);const draft=await modalState(session);assert.equal(draft.name,'原按钮状态房间');assert.equal(draft.password,'中文密码\t拒绝');assert.equal(draft.min,7);assert.equal(draft.friendlyFire,true);await sample('btnOK','Normal');await sample('rdoFriendlyFireOn','Normal',true);await screenshot(session,label+'-rejected');
    if(label==='4k') {
      await input(session,passwordInput,'button-pass');for(let i=0;i<16&&!await evaluate(session,`document.activeElement===document.querySelector('[data-room-create-confirm]')`);i++)await press(session,'Tab','Tab');assert(await evaluate(session,`document.activeElement===document.querySelector('[data-room-create-confirm]')`));const begin=network.length;await press(session,'Enter','Enter');await waitUntil(session,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);const world=await evaluate(session,worldExpression),response=network.slice(begin).find(r=>r.name==='CreateRoom'&&r.direction==='received');assert(response?.success);assert.equal(world.match.minPlayers,7);assert.equal(world.match.friendlyFire,true);assert(!await evaluate(session,`document.querySelector('${modal}')`));await screenshot(session,label+'-ordinary-waiting');await click(session,'#leave');await waitUntil(session,`!(${worldExpression})`);evidence.checks.push({name:'formal original button states and ordinary keyboard create '+label,rows,rejected,draft,response,world});
    } else {
      p=await point('btnIncLowBound');await move(p);await down(p);await sample('btnIncLowBound','Pushed');await press(session,'Escape','Escape');await waitUntil(session,`!document.querySelector('${modal}')`);await up({x:5,y:5});assert(!await evaluate(session,`document.querySelector('.room-create-source-button')`));await screenshot(session,label+'-closed-held');evidence.checks.push({name:'formal original button states/capture/key/pending/refusal/close '+label,rows,rejected,draft});await open(session);await move({x:5,y:5});await sample('btnIncLowBound','Normal');
    }
  }
}

async function verifyNameSelectionVisual(session) {
  for (const [width,height,label] of [[800,600,'800x600'],[1920,1080,'1080p'],[3840,2160,'4k']]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
    await verifySource(session,width,height);
    const rows=[];
    async function projection(active=true) {
      await waitUntil(session,`document.querySelector('[data-room-name-selection]')?.dataset.sourceSelectionStart===String(document.querySelector('${nameInput}').selectionStart)&&document.querySelector('[data-room-name-selection]').dataset.sourceSelectionEnd===String(document.querySelector('${nameInput}').selectionEnd)&&document.querySelector('[data-room-name-selection]').dataset.sourceScroll===String(document.querySelector('${nameInput}').scrollLeft)`);
      const r=await evaluate(session,`(()=>{const e=document.querySelector('${nameInput}'),v=document.querySelector('[data-room-name-selection]'),a=v.querySelector('[data-room-name-selection-text="selected"]'),z=v.querySelector('[data-room-name-selection-text="suffix"]'),b=v.querySelector('i'),c=document.createElement('canvas').getContext('2d'),s=getComputedStyle(e);c.font=s.fontSize+' '+s.fontFamily;const start=e.selectionStart,end=e.selectionEnd,scroll=e.scrollLeft,selected=e.value.slice(start,end),suffix=e.value.slice(end);function css(n,key='left'){const temp=document.createElement('i');temp.style[key]=n+'px';return temp.style[key];}return {value:e.value,start,end,scroll,type:e.type,font:s.fontFamily,prefix:v.querySelector('[data-room-name-selection-text="prefix"]').textContent,selected:a.textContent,suffix:z.textContent,selectedLeft:a.style.left,suffixLeft:z.style.left,bgLeft:b.style.left,bgWidth:b.style.width,expected:{prefix:e.value.slice(0,start),selected,suffix,selectedLeft:css(c.measureText(e.value.slice(0,start)).width-scroll),suffixLeft:css(c.measureText(e.value.slice(0,start)).width+c.measureText(selected).width-scroll),bgLeft:css(c.measureText(e.value.slice(0,start)).width-scroll),bgWidth:css(c.measureText(e.value.slice(0,end)).width-c.measureText(e.value.slice(0,start)).width,'width')},background:getComputedStyle(b).backgroundColor,nativeFill:s.webkitTextFillColor,nativeSelection:getComputedStyle(e,'::selection').backgroundColor,pointer:getComputedStyle(v).pointerEvents,editable:document.querySelectorAll('[data-room-create-stage] input[type="text"]').length};})()`);
      assert.equal(r.type,'text');assert.equal(r.editable,1);assert(r.font.includes('SIMSUN'));for(const k of ['prefix','selected','suffix','selectedLeft','suffixLeft','bgLeft','bgWidth'])assert.equal(r[k],r.expected[k],k+' '+JSON.stringify(r));assert.equal(r.nativeFill,'rgba(0, 0, 0, 0)');assert.equal(r.nativeSelection,'rgba(0, 0, 0, 0)');assert.equal(r.pointer,'none');assert.equal(r.background,active?'rgb(96, 127, 255)':'rgb(128, 128, 128)');rows.push(r);return r;
    }
    await input(session,nameInput,'中文房名123');await waitUntil(session,`document.fonts.check('12px CDTank-SIMSUN')`);
    await evaluate(session,`document.querySelector('${nameInput}').setSelectionRange(1,4,'forward')`);const selected=await projection();assert.equal(selected.selected,'文房名');assert.equal(selected.suffix,'123');await screenshot(session,label+'-selected');
    await evaluate(session,`document.querySelector('${nameInput}').setSelectionRange(1,4,'backward')`);await projection();await waitUntil(session,`document.querySelector('[data-room-create-caret="edtRoomName"]')?.dataset.sourceCaretIndex==='1'`);await screenshot(session,label+'-backward-caret');
    await click(session,passwordInput);await projection(false);await screenshot(session,label+'-inactive');
    await click(session,nameInput);await press(session,'Home','Home');await key(session,'ArrowRight','ArrowRight','keyDown',{modifiers:8});await key(session,'ArrowRight','ArrowRight','keyUp',{modifiers:8});const keyboard=await projection();assert.equal(keyboard.start,0);assert.equal(keyboard.end,1);await screenshot(session,label+'-keyboard');
    await press(session,'End','End');await waitUntil(session,`!document.querySelector('[data-room-name-selection]')`);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16,modifiers:0},session);
    const p=await evaluate(session,`(()=>{const r=document.querySelector('${nameInput}').getBoundingClientRect(),s=Math.min(innerWidth/800,innerHeight/600);return {x:r.x+13*s,y:r.y+r.height/2,end:r.x+49*s}})()`);await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y},session);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,modifiers:16,clickCount:1,x:p.x,y:p.y},session);for(let i=1;i<=4;i++){await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,x:p.x+(p.end-p.x)*i/4,y:p.y},session);await pause(50);}await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,x:p.end,y:p.y},session);const dragged=await projection();assert.equal(dragged.start,1);assert.equal(dragged.end,4);await screenshot(session,label+'-dragged');
    await press(session,'End','End');await waitUntil(session,`!document.querySelector('[data-room-name-selection]')`);await command('Input.imeSetComposition',{text:'中文预编辑',selectionStart:5,selectionEnd:5},session);await command('Input.insertText',{text:'中文提交'},session);const composed=await evaluate(session,`document.querySelector('${nameInput}').value`);assert.equal(composed,'中文房名123中');assert(!await evaluate(session,`document.querySelector('[data-room-name-selection]')`));await screenshot(session,label+'-composed');
    await input(session,nameInput,'中文长房名'.repeat(6));assert.equal((await evaluate(session,`document.querySelector('${nameInput}').value`)).length,8);await evaluate(session,`document.querySelector('${nameInput}').setSelectionRange(5,8)`);const long=await projection();assert.equal(long.scroll,0);await screenshot(session,label+'-long-selected');await press(session,'End','End');await waitUntil(session,`!document.querySelector('[data-room-name-selection]')`);const end=await evaluate(session,`(()=>{const e=document.querySelector('${nameInput}');return {start:e.selectionStart,end:e.selectionEnd,scroll:e.scrollLeft}})()`);assert.equal(end.end,8);assert.equal(end.scroll,0);await screenshot(session,label+'-end-scroll');await press(session,'Home','Home');const home=await evaluate(session,`(()=>{const e=document.querySelector('${nameInput}');return {start:e.selectionStart,end:e.selectionEnd,scroll:e.scrollLeft}})()`);assert.deepEqual(home,{start:0,end:0,scroll:0});await screenshot(session,label+'-home');
    await input(session,nameInput,'AB━中文房名');await press(session,'Home','Home');for(let i=0;i<4;i++)await press(session,'ArrowRight','ArrowRight');for(let i=0;i<2;i++){await key(session,'ArrowRight','ArrowRight','keyDown',{modifiers:8});await key(session,'ArrowRight','ArrowRight','keyUp',{modifiers:8});}const special=await projection();assert.equal(special.value,'AB━中文房名');assert.equal(special.prefix,'AB━中');assert.equal(special.selected,'文房');assert.equal(special.suffix,'名');await screenshot(session,label+'-special-font-zero');
    await input(session,passwordInput,'中文密码\t拒绝');await input(session,nameInput,'中文房名123');await evaluate(session,`document.querySelector('${nameInput}').setSelectionRange(1,4)`);await projection();holdInputResponses=true;const from=network.length;await click(session,'[data-room-create-confirm]');await waitUntil(session,`document.querySelector('${nameInput}').disabled`);await projection(false);await screenshot(session,label+'-pending');releaseInputResponses();await waitUntil(session,`document.activeElement===document.querySelector('${nameInput}')&&!document.querySelector('${nameInput}').disabled`);await projection();const rejection=network.slice(from).find(r=>r.page===session&&r.name==='CreateRoom'&&r.direction==='received');assert.equal(rejection?.success,false);await screenshot(session,label+'-rejected');
    await press(session,'Escape','Escape');await waitUntil(session,`!document.querySelector('${modal}')`);assert(!await evaluate(session,`document.querySelector('[data-room-name-selection],.room-create-name-selected')`));await screenshot(session,label+'-closed');evidence.checks.push({name:'formal ordinary unmasked source name selection/Chinese/native drag/keyboard/caret/scroll/pending/rejection/close '+label,rows,composed,long,end,home,specialFontZero:special,rejection,scope:'Source EmotionFont0 complete prefix/selected/suffix; generic nonzero EmotionFont renderer remains separate.'});if(label!=='4k')await open(session);
  }
}

async function verifyCaretVisual(session) {
  assert.deepEqual(advanceRoomCreateCaret(.5,1e-9),{elapsed:.5,visible:false});
  let elapsed=0;for(const [delta,visible] of [[.5,true],[.01,false],[.49,false],[.01,true],[1.2,true]]){const next=advanceRoomCreateCaret(elapsed,delta);assert.equal(next.visible,visible);elapsed=next.elapsed;}

  for (const [width,height,label] of [[800,600,'800x600'],[1920,1080,'1080p'],[3840,2160,'4k']]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
    await verifySource(session,width,height);
    const rows=[];
    async function sample(selector,name,index,focused=true) {
      const layer=`[data-room-create-caret="${name}"]`;
      await waitUntil(session,`document.querySelector('${layer}')?.dataset.sourceCaretIndex==='${index}'&&document.querySelector('${layer}')?.dataset.sourceFocused==='${focused}'&&document.querySelector('${layer}').dataset.sourceScroll===String(document.querySelector('${selector}').scrollLeft)`);
      const r=await evaluate(session,`(()=>{const e=document.querySelector('${selector}'),v=document.querySelector('${layer}'),i=v.querySelector('i'),s=getComputedStyle(e),c=document.createElement('canvas').getContext('2d'),index=Number(v.dataset.sourceCaretIndex);c.font=s.fontSize+' '+s.fontFamily;const expected=document.createElement('i');expected.style.left=Math.min(c.measureText(e.type==='password'?'*'.repeat(index):e.value.slice(0,index)).width-e.scrollLeft,e.clientWidth-Number(v.dataset.sourceCaretWidth))+'px';return {index,scroll:e.scrollLeft,start:e.selectionStart,end:e.selectionEnd,direction:e.selectionDirection,focused:v.dataset.sourceFocused,visibility:getComputedStyle(v).visibility,left:parseFloat(i.style.left),width:parseFloat(i.style.width),height:getComputedStyle(i).height,asset:v.dataset.sourceAsset,image:getComputedStyle(i).backgroundImage,pointer:getComputedStyle(v).pointerEvents,nativeCaret:s.caretColor,expected:parseFloat(expected.style.left),sourceWidth:Number(v.dataset.sourceCaretWidth)};})()`);
      assert.equal(r.left,r.expected,JSON.stringify(r));assert.equal(r.asset,'ui/regions/60/237.png');assert(r.image.includes(r.asset));assert.equal(r.height,'16px');assert.equal(r.sourceWidth,Math.round(Math.min(width/800,height/600))/Math.min(width/800,height/600));assert.equal(r.pointer,'none');assert.equal(r.nativeCaret,'rgba(0, 0, 0, 0)');assert.equal(r.visibility,focused?'visible':'hidden');rows.push({name,...r});return r;
    }
    for(const [selector,name,text] of [[nameInput,'edtRoomName','中文房名123'],[passwordInput,'edtPassword','中文密码123']]) {
      await input(session,selector,text);await waitUntil(session,`document.fonts.check('12px CDTank-SIMSUN')`);
      await sample(selector,name,text.length);
      await waitUntil(session,`getComputedStyle(document.querySelector('[data-room-create-caret="${name}"] i')).opacity==='1'`);await screenshot(session,label+'-'+name+'-visible');
      await waitUntil(session,`getComputedStyle(document.querySelector('[data-room-create-caret="${name}"] i')).opacity==='0'`);await screenshot(session,label+'-'+name+'-blink-hidden');
      await evaluate(session,`document.querySelector('${selector}').setSelectionRange(1,4,'forward')`);await sample(selector,name,4);
      await evaluate(session,`document.querySelector('${selector}').setSelectionRange(1,4,'backward')`);await sample(selector,name,1);await screenshot(session,label+'-'+name+'-selected');
      await input(session,selector,name==='edtPassword'?'中文长密码'.repeat(10)+'1234':'中文长房名'.repeat(6));
      const length=await evaluate(session,`document.querySelector('${selector}').value.length`);
      await press(session,'End','End');const end=await sample(selector,name,length);assert(end.scroll>0);await screenshot(session,label+'-'+name+'-end-scroll');
      await press(session,'Home','Home');const home=await sample(selector,name,0);assert.equal(home.scroll,0);await screenshot(session,label+'-'+name+'-home');
      await click(session,'[data-room-create-stage] [data-source-control="txtMapName"]');await sample(selector,name,0,false);await screenshot(session,label+'-'+name+'-blurred');
    }
    await click(session,passwordInput);await press(session,'End','End');await command('Input.imeSetComposition',{text:'中文预编辑',selectionStart:5,selectionEnd:5},session);await command('Input.insertText',{text:'中文提交'},session);const composed=await evaluate(session,`document.querySelector('${passwordInput}').value`);assert(composed.endsWith('中文提交'));await sample(passwordInput,'edtPassword',composed.length);
    const pixels=await evaluate(session,`(async()=>{const image=new Image();image.src='/ui/regions/60/237.png';await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d');x.drawImage(image,0,0);return {width:image.width,height:image.height,pixels:[...x.getImageData(0,0,image.width,image.height).data]};})()`);assert.equal(pixels.width,1);assert.equal(pixels.height,12);assert(pixels.pixels.some(v=>v));
    await input(session,nameInput,'原光标房间');await input(session,passwordInput,'中文密码\t拒绝');await evaluate(session,`document.querySelector('${passwordInput}').setSelectionRange(1,4)`);await sample(passwordInput,'edtPassword',4);
    holdInputResponses=true;const from=network.length;await click(session,'[data-room-create-confirm]');await waitUntil(session,`document.querySelector('${passwordInput}').disabled`);await sample(passwordInput,'edtPassword',4,false);await screenshot(session,label+'-pending');releaseInputResponses();
    await waitUntil(session,`document.activeElement===document.querySelector('${passwordInput}')&&!document.querySelector('${passwordInput}').disabled`);await sample(passwordInput,'edtPassword',4);const rejection=network.slice(from).find(r=>r.page===session&&r.name==='CreateRoom'&&r.direction==='received');assert.equal(rejection?.success,false);await screenshot(session,label+'-rejected');
    await press(session,'Escape','Escape');await waitUntil(session,`!document.querySelector('${modal}')`);assert(!await evaluate(session,`document.querySelector('[data-room-create-caret],.room-create-source-caret-input')`));await screenshot(session,label+'-closed');
    evidence.checks.push({name:'formal original CaratImage/native input caret geometry/blink/selection/scroll/blur/pending/rejection/close '+label,rows,pixels,composed,rejection});
    if(label!=='4k')await open(session);
  }
}

async function verifyPasswordVisual(session) {
  for (const [width,height,label] of [[800,600,'800x600'],[1920,1080,'1080p'],[3840,2160,'4k']]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
    await verifySource(session,width,height);
    await input(session,nameInput,'原密码字符房间');
    await input(session,passwordInput,'中文密码123');
    await waitUntil(session,`document.fonts.check('12px CDTank-SIMSUN-Password')`);
    const glyph=await evaluate(session,`(async()=>{await document.fonts.ready;const e=document.querySelector('${passwordInput}'),s=getComputedStyle(e),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
      function render(font,text){ctx.clearRect(0,0,100,30);canvas.width=100;canvas.height=30;ctx.font=font;ctx.fillText(text,2,18);const pixels=[...ctx.getImageData(0,0,100,30).data],coords=[];for(let y=0;y<30;y++)for(let x=0;x<100;x++)if(pixels[(y*100+x)*4+3])coords.push([x,y]);const minX=Math.min(...coords.map(p=>p[0])),minY=Math.min(...coords.map(p=>p[1]));return {width:ctx.measureText(text).width,pixels,bounds:[minX,minY,Math.max(...coords.map(p=>p[0])),Math.max(...coords.map(p=>p[1]))],shape:coords.map(([x,y])=>[x-minX,y-minY,pixels[(y*100+x)*4+3]])};}
      const star=render('12px CDTank-SIMSUN','*'),mask=render('12px CDTank-SIMSUN-Password','\u2022');
      const derivedStar=render('12px CDTank-SIMSUN-Password','*');return {type:e.type,value:e.value,font:s.fontFamily,fontSize:s.fontSize,starWidth:star.width,maskWidth:mask.width,samePixels:JSON.stringify(star.pixels)===JSON.stringify(mask.pixels),sameShape:JSON.stringify(star.shape)===JSON.stringify(mask.shape),bounds:[star.bounds,mask.bounds],derivedSame:JSON.stringify(derivedStar.pixels)===JSON.stringify(mask.pixels),sourceSum:star.pixels.reduce((a,b)=>a+b,0),maskSum:mask.pixels.reduce((a,b)=>a+b,0),nonEmpty:mask.pixels.some(v=>v),selection:[e.selectionStart,e.selectionEnd]};})()`);
    assert.equal(glyph.type,'password');assert.equal(glyph.value,'中文密码123');assert(glyph.font.includes('CDTank-SIMSUN-Password'));assert.equal(glyph.maskWidth,glyph.starWidth);assert(glyph.samePixels&&glyph.nonEmpty);
    const dom=await command('DOM.getDocument',{},session);const node=await command('DOM.querySelector',{nodeId:dom.root.nodeId,selector:passwordInput},session);
    const fonts=await command('CSS.getPlatformFontsForNode',{nodeId:node.nodeId},session);
    assert(fonts.fonts.some(f=>f.isCustomFont&&f.familyName.includes('Password')),JSON.stringify(fonts));
    await screenshot(session,label+'-password-asterisks');
    async function selectionProjection() {
      const result=await evaluate(session,`(()=>{const e=document.querySelector('${passwordInput}'),v=document.querySelector('[data-room-password-selection]'),t=v?.querySelector('[data-room-password-selection-text]'),b=v?.querySelector('i');return {length:e.value.length,start:e.selectionStart,end:e.selectionEnd,scroll:e.scrollLeft,layer:!!v,text:t?.textContent,left:t?.style.left,bgLeft:b?.style.left,bgWidth:b?.style.width,background:b?getComputedStyle(b).backgroundColor:null,fill:getComputedStyle(e).webkitTextFillColor,caret:getComputedStyle(e).caretColor,pointer:v?getComputedStyle(v).pointerEvents:null};})()`);
      assert(result.layer);assert.equal(result.text,'*'.repeat(result.length));assert.equal(parseFloat(result.left),result.scroll ? -result.scroll : 0);assert.equal(parseFloat(result.bgLeft),result.start*6-result.scroll);assert.equal(parseFloat(result.bgWidth),(result.end-result.start)*6);assert.equal(result.fill,'rgba(0, 0, 0, 0)');assert.equal(result.caret,'rgba(0, 0, 0, 0)');assert.equal(result.pointer,'none');return result;
    }
    await evaluate(session,`document.querySelector('${passwordInput}').setSelectionRange(1,4)`);
    await waitUntil(session,`document.querySelector('[data-room-password-selection]')?.dataset.sourceSelectionStart==='1'`);
    const sourceSelected=await selectionProjection();assert.equal(sourceSelected.text,'*******');assert.equal(sourceSelected.background,'rgb(96, 127, 255)');
    await screenshot(session,label+'-source-selected');
    await click(session,nameInput);
    const inactive=await selectionProjection();assert.equal(inactive.background,'rgb(128, 128, 128)');
    await screenshot(session,label+'-source-inactive');
    await click(session,passwordInput);await press(session,'Home','Home');
    await key(session,'ArrowRight','ArrowRight','keyDown',{modifiers:8});await key(session,'ArrowRight','ArrowRight','keyUp',{modifiers:8});
    await waitUntil(session,`document.querySelector('[data-room-password-selection]')`);const keyboardSelected=await selectionProjection();assert.equal(keyboardSelected.start,0);assert.equal(keyboardSelected.end,1);
    await press(session,'End','End');await waitUntil(session,`!document.querySelector('[data-room-password-selection]')`);
    await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Control',code:'ControlLeft',windowsVirtualKeyCode:17,modifiers:0},session);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16,modifiers:0},session);
    const dragPoints=await evaluate(session,`(()=>{const r=document.querySelector('${passwordInput}').getBoundingClientRect(),scale=Math.min(innerWidth/800,innerHeight/600);return {x:r.x+7*scale,y:r.y+r.height/2,end:r.x+25*scale}})()`);
    await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragPoints.x,y:dragPoints.y},session);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,modifiers:16,clickCount:1,x:dragPoints.x,y:dragPoints.y},session);
    await pause(100);for(let step=1;step<=4;step++){await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,x:dragPoints.x+(dragPoints.end-dragPoints.x)*step/4,y:dragPoints.y},session);await pause(50);}
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,x:dragPoints.end,y:dragPoints.y},session);
    await waitUntil(session,`document.querySelector('${passwordInput}').selectionEnd>=3&&document.querySelector('${passwordInput}').selectionEnd>document.querySelector('${passwordInput}').selectionStart`);await waitUntil(session,`document.querySelector('[data-room-password-selection]')?.dataset.sourceSelectionEnd===String(document.querySelector('${passwordInput}').selectionEnd)`);const dragged=await selectionProjection();assert(dragged.end>=3&&dragged.end>dragged.start);
    await screenshot(session,label+'-source-dragged');
    await press(session,'End','End');await waitUntil(session,`!document.querySelector('[data-room-password-selection]')`);

    await command('Input.imeSetComposition',{text:'中文预编辑',selectionStart:5,selectionEnd:5},session);
    await command('Input.insertText',{text:'中文提交'},session);
    const composed=await evaluate(session,`document.querySelector('${passwordInput}').value`);assert(composed.includes('中文提交'));
    await input(session,passwordInput,'中文长密码'.repeat(10)+'1234');
    await evaluate(session,`document.querySelector('${passwordInput}').setSelectionRange(10,15)`);await waitUntil(session,`document.querySelector('[data-room-password-selection]')?.dataset.sourceSelectionStart==='10'&&document.querySelector('[data-room-password-selection]')?.dataset.sourceSelectionEnd==='15'`);
    const selected=await evaluate(session,`(()=>{const e=document.querySelector('${passwordInput}');return {type:e.type,value:e.value,length:e.value.length,start:e.selectionStart,end:e.selectionEnd,focused:document.activeElement===e,scroll:e.scrollLeft,selectionColor:getComputedStyle(e,'::selection').color,selectionBackground:getComputedStyle(e,'::selection').backgroundColor}})()`);
    assert.equal(selected.start,10);assert.equal(selected.end,15);assert(selected.focused);assert.equal(selected.selectionBackground,'rgba(0, 0, 0, 0)');await selectionProjection();
    await screenshot(session,label+'-password-selected');
    await press(session,'End','End');
    const end=await evaluate(session,`(()=>{const e=document.querySelector('${passwordInput}');return {start:e.selectionStart,end:e.selectionEnd,length:e.value.length,scroll:e.scrollLeft}})()`);
    assert.equal(end.start,end.length);assert.equal(end.length,20);assert.equal(end.scroll,0);
    await screenshot(session,label+'-password-end-scroll');
    await press(session,'Home','Home');
    const home=await evaluate(session,`(()=>{const e=document.querySelector('${passwordInput}');return {start:e.selectionStart,end:e.selectionEnd,scroll:e.scrollLeft}})()`);
    assert.equal(home.start,0);assert.equal(home.scroll,0);
    await click(session,passwordInput);
    const hit=await evaluate(session,`(()=>{const e=document.querySelector('${passwordInput}'),r=e.getBoundingClientRect();return {focus:document.activeElement===e,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e,caret:e.selectionStart}})()`);assert(hit.focus&&hit.hit);
    await screenshot(session,label+'-password-home-hit');
    await input(session,passwordInput,'中文密码\t拒绝');await evaluate(session,`document.querySelector('${passwordInput}').setSelectionRange(1,4)`);await waitUntil(session,`document.querySelector('[data-room-password-selection]')?.dataset.sourceSelectionStart==='1'`);holdInputResponses=true;const from=network.length;
    await click(session,'[data-room-create-confirm]');await waitUntil(session,`document.querySelector('${passwordInput}')?.disabled`);
    const pendingSelection=await selectionProjection();assert.equal(pendingSelection.background,'rgb(128, 128, 128)');await screenshot(session,label+'-password-pending');releaseInputResponses();
    await waitUntil(session,`document.querySelector('${passwordInput}')&&!document.querySelector('${passwordInput}').disabled&&document.activeElement===document.querySelector('${passwordInput}')`);
    const rejection=network.slice(from).find(r=>r.page===session&&r.name==='CreateRoom'&&r.direction==='received');assert.equal(rejection?.success,false);
    assert.equal(await evaluate(session,`document.querySelector('${passwordInput}').value`),'中文密码\t拒绝');
    await screenshot(session,label+'-password-rejected');
    await press(session,'Escape','Escape');await waitUntil(session,`!document.querySelector('${modal}')`);assert(!await evaluate(session,`document.querySelector('[data-room-password-selection],.room-create-password-selected')`));await screenshot(session,label+'-closed');
    evidence.checks.push({name:'formal native password source asterisk/font/Chinese composition/selection/caret horizontal scroll/hit/pending/rejection/close '+label,glyph,platformFonts:fonts,sourceSelected,inactive,keyboardSelected,dragged,composed,selected,end,home,hit,pendingSelection,rejection,scope:'Native password input with independent source glyph font; CDP composition does not verify OS candidate UI.'});
    if(label!=='4k')await open(session);
  }
}

async function verifyInputVisual(session) {
  for (const [width,height,label] of [[800,600,'800x600'],[1920,1080,'1080p'],[3840,2160,'4k']]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
    await verifySource(session,width,height);
    await input(session,nameInput,'中文房间输入名称');
    await input(session,passwordInput,'中文密码123');
    await click(session,nameInput);
    await evaluate(session,`document.querySelector('${nameInput}').setSelectionRange(0,4)`);
    const selection = await evaluate(session,`(()=>{const e=document.querySelector('${nameInput}'),s=getComputedStyle(e),sel=getComputedStyle(e,'::selection'),r=e.getBoundingClientRect();return {value:e.value,start:e.selectionStart,end:e.selectionEnd,focus:document.activeElement===e,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e,color:s.color,font:s.fontFamily,fontLoaded:document.fonts.check('12px CDTank-SIMSUN'),selectedColor:sel.color,selectedBackground:sel.backgroundColor};})()`);
    assert.equal(selection.value,'中文房间输入名称');assert.equal(selection.start,0);assert.equal(selection.end,4);assert(selection.focus&&selection.hit&&selection.fontLoaded);assert.equal(selection.color,'rgb(255, 255, 255)');assert.equal(selection.selectedColor,'rgb(255, 255, 255)');assert.equal(selection.selectedBackground,'rgb(96, 127, 255)');
    await screenshot(session,label+'-name-selected');
    await click(session,passwordInput);
    const password=await evaluate(session,`(()=>{const e=document.querySelector('${passwordInput}'),r=e.getBoundingClientRect();return {value:e.value,type:e.type,focus:document.activeElement===e,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e,inactiveSelection:getComputedStyle(document.querySelector('${nameInput}'),'::selection').backgroundColor};})()`);
    assert.equal(password.value,'中文密码123');assert.equal(password.type,'password');assert(password.focus&&password.hit);assert.equal(password.inactiveSelection,'rgb(128, 128, 128)');
    await screenshot(session,label+'-password-focused');
    await input(session,passwordInput,'中文密码\t拒绝');
    const from=network.length;
    holdInputResponses=true;
    await click(session,'[data-room-create-confirm]');
    await waitUntil(session,`document.querySelector('${nameInput}')?.disabled&&document.querySelector('${passwordInput}')?.disabled`);
    const disabled=await evaluate(session,`[...document.querySelectorAll('${modal} input')].map(e=>({name:e.dataset.sourceControl,disabled:e.disabled,color:getComputedStyle(e).color,fill:getComputedStyle(e).webkitTextFillColor,opacity:getComputedStyle(e).opacity,value:e.value,type:e.type}))`);
    assert(disabled.every(e=>e.disabled&&e.color==='rgb(255, 255, 255)'&&e.fill==='rgb(255, 255, 255)'&&e.opacity==='1'));
    await screenshot(session,label+'-pending-disabled');
    releaseInputResponses();
    await waitUntil(session,`document.querySelector('${passwordInput}')&&!document.querySelector('${passwordInput}').disabled&&document.activeElement===document.querySelector('${passwordInput}')`);
    const rejection=network.slice(from).find(r=>r.page===session&&r.name==='CreateRoom'&&r.direction==='received');
    assert.equal(rejection?.success,false);
    await press(session,'Escape','Escape');await waitUntil(session,`!document.querySelector('${modal}')`);
    assert(!await evaluate(session,`document.activeElement?.matches('${nameInput},${passwordInput}')`));
    await screenshot(session,label+'-closed');
    evidence.checks.push({name:'formal Chinese input, source selection colors, password masking, real pending disabled and focus disposal '+label,selection,password,disabled,rejection,transport:'Test proxy holds server response bytes during existing production pending state, then releases original response.'});
    if(label!=='4k')await open(session);
  }
}

async function verifyText(session) {
  for(const [width,height,label] of (process.argv.includes('--text-fixture-only') ? [] : [[800,600,'800x600'],[1920,1080,'1080p'],[3840,2160,'4k']])) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
    await verifySource(session,width,height);
    await input(session,nameInput,'建房中文玩家名称');await input(session,passwordInput,'中文密码123');
    const result=await evaluate(session,`(()=>{
      const d=document.querySelector('${modal}');
      return {texts:['txtMapName','txtLowBound','txtHighBound'].map(name=>{const e=d.querySelector('[data-source-control="'+name+'"]'),s=getComputedStyle(e),r=e.getBoundingClientRect();return {name,text:e.textContent,overflow:s.overflow,nowrap:s.whiteSpace,align:s.textAlign,rect:r.toJSON()};}),
        name:d.querySelector('${nameInput}').value,passwordType:d.querySelector('${passwordInput}').type,passwordValue:d.querySelector('${passwordInput}').value,
        buttons:[...d.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {name:b.dataset.sourceControl,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b};}),
        frames:[...d.querySelectorAll('.room-create-source-image')].map(e=>getComputedStyle(e).overflow)};
    })()`);
    assert(result.texts.every(t=>t.overflow==='hidden'&&t.nowrap==='nowrap'&&t.align==='center'));assert(result.frames.every(x=>x!=='hidden'));
    assert.equal(result.name,'建房中文玩家名称');assert.equal(result.passwordValue,'中文密码123');assert.equal(result.passwordType,'password');assert(result.buttons.every(b=>b.hit));
    await screenshot(session,label+'-open');await press(session,'Escape','Escape');await waitUntil(session,`!document.querySelector('${modal}')`);
    evidence.checks.push({name:'formal source text clipping, Chinese inputs, hit targets and Escape disposal '+label,result});
    if(label!=='4k')await open(session);
  }
  await command('Page.navigate',{url:'http://127.0.0.1:5300/__room-text-fixture'},session);
  await waitUntil(session,`document.querySelector('${modal}')?.open&&document.querySelector('[data-source-control="txtMapName"]')`);
  for(const [width,height,label] of [[800,600,'800x600'],[1920,1080,'1080p'],[3840,2160,'4k']]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
    await verifySource(session,width,height);
    const result=await evaluate(session,`(()=>{const e=document.querySelector('[data-source-control="txtMapName"]'),r=e.getBoundingClientRect();return {text:e.textContent,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,overflow:getComputedStyle(e).overflow,rect:r.toJSON()}})()`);
    assert(result.scrollWidth>result.clientWidth*2);assert.equal(result.overflow,'hidden');
    await screenshot(session,label+'-long-map-fixture');
    evidence.checks.push({name:'isolated production React props long map text clip fixture '+label,result,scope:'Presentation fixture; no network map name claim'});
  }
  await press(session,'Escape','Escape');await waitUntil(session,`!document.querySelector('${modal}')`);
}

async function verifyCentreImage(session) {
  const native=JSON.parse(await (await import('node:fs/promises')).readFile('recovery/output/room-create-image-native.json','utf8'));
  for(const [width,height,label] of [[800,600,'800x600'],[1920,1080,'1080p'],[3840,2160,'4k']]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
    await verifySource(session,width,height);
    const result=await evaluate(session,`(async()=>{
      const d=document.querySelector('${modal}'),scale=Math.min(innerWidth/800,innerHeight/600);
      const panels=await Promise.all(['daditu','ditu2','ditu3','xiaoditu'].map(async name=>{
        const e=d.querySelector('[data-source-control="'+name+'"]'),base=e.getBoundingClientRect(),i=e.querySelector('[data-source-image]'),r=i.getBoundingClientRect();
        const image=new Image();image.src='/'+i.dataset.sourceAsset;await image.decode();
        return {name,position:[r.x-base.x,r.y-base.y],size:[r.width,r.height],rect:r.toJSON(),asset:i.dataset.sourceAsset,
          horz:i.dataset.sourceHorzFormat,vert:i.dataset.sourceVertFormat,offset:i.dataset.sourceOffset,clip:i.dataset.sourceClip,
          background:getComputedStyle(i).backgroundSize,overflow:getComputedStyle(i).overflow,imageSize:[image.naturalWidth,image.naturalHeight]};
      }));
      const buttons=[...d.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return{name:b.dataset.sourceControl,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b};});
      return {width:innerWidth,height:innerHeight,scale,panels,buttons};
    })()`);
    assert(result.buttons.every(b=>b.hit));
    for(const panel of result.panels){
      const expected=native.rows.find(r=>r.control===panel.name&&r.scale===result.scale).draw;
      for(let i=0;i<2;i++){assert(Math.abs(panel.position[i]-expected.position[i])<.1);assert(Math.abs(panel.size[i]-expected.size[i])<.1);}
      assert.equal(panel.horz,'HorzStretched');assert.equal(panel.vert,'VertStretched');assert.equal(panel.offset,'0,0');assert.equal(panel.clip,'inner-rectangle');assert.equal(panel.background,'100% 100%');assert.equal(panel.overflow,'hidden');
    }
    await screenshot(session,label+'-open');
    await press(session,'Escape','Escape');await waitUntil(session,`!document.querySelector('${modal}')`);
    assert.equal(await evaluate(session,`document.querySelector('[data-source-image]')`),null);
    evidence.checks.push({name:'actual centre image draw, sourceoffset, inner clipping and Escape disposal '+label,result});
    if(label!=='4k')await open(session);
  }
}

async function verifyScale(session) {
  const native=JSON.parse(await (await import('node:fs/promises')).readFile('recovery/output/room-create-scale-native.json','utf8'));
  for(const [width,height,label] of (process.argv.includes('--frame-shared-regression') ? [[800,600,'800x600']] : [[800,600,'800x600'],[1920,1080,'1080p'],[3840,2160,'4k']])) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
    await verifySource(session,width,height);
    const result=await evaluate(session,`(()=>{
      const d=document.querySelector('${modal}'),scale=Math.min(innerWidth/800,innerHeight/600);
      const panels=['daditu','ditu2','ditu3','xiaoditu'].map(name=>{
        const e=d.querySelector('[data-source-control="'+name+'"]'),base=e.getBoundingClientRect();
        return {name,center:(()=>{const r=e.querySelector('[data-source-image]').getBoundingClientRect();return {x:(r.x-base.x)/scale,y:(r.y-base.y)/scale,width:r.width/scale,height:r.height/scale}})(),
          pieces:[...e.querySelectorAll('[data-source-frame]')].map(p=>{const r=p.getBoundingClientRect();return {part:p.dataset.sourceFrame.replace('FrameImage',''),position:[(r.x-base.x)/scale,(r.y-base.y)/scale],size:[r.width/scale,r.height/scale]};})};
      });
      const buttons=[...d.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return{name:b.dataset.sourceControl,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b};});
      return {width:innerWidth,height:innerHeight,scale,panels,buttons};
    })()`);
    assert(result.buttons.every(b=>b.hit));
    for(const expected of native.rows.filter(row=>row.kind==='sourceViewport'&&row.viewport[0]===width&&row.viewport[1]===height)){
      const panel=result.panels.find(p=>p.name===expected.control);
      assert.deepEqual(panel.pieces.map(p=>p.part),expected.draws.map(p=>p.part));
      for(const draw of expected.draws){const piece=panel.pieces.find(p=>p.part===draw.part);for(let i=0;i<2;i++){assert(Math.abs(piece.position[i]*result.scale-draw.position[i])<.1,expected.control+' '+draw.part+' pos');assert(Math.abs(piece.size[i]*result.scale-draw.size[i])<.1,expected.control+' '+draw.part+' size');}}
      const inset=expected.insets;
      assert(Math.abs(panel.center.x*result.scale-inset[0])<.05);assert(Math.abs(panel.center.y*result.scale-inset[2])<.05);
      assert(Math.abs(panel.center.width*result.scale-(expected.outer[0]-inset[0]-inset[1]))<.05);assert(Math.abs(panel.center.height*result.scale-(expected.outer[1]-inset[2]-inset[3]))<.05);
    }
    await screenshot(session,label+'-open');await click(session,'[data-room-create-close]');await waitUntil(session,`!document.querySelector('${modal}')`);
    assert.equal(await evaluate(session,`document.querySelector('[data-source-frame]')`),null);
    evidence.checks.push({name:'actual HD frame geometry matches original imageset rounding and source viewport '+label,result});
    if(label!=='4k'&&!process.argv.includes('--frame-shared-regression'))await open(session);
  }
}

async function verifyFrame(session) {
  const native=JSON.parse(await (await import('node:fs/promises')).readFile('recovery/output/room-create-frame-native.json','utf8'));
  for(const [width,height,label] of [[800,600,'800x600'],[1920,1080,'1080p'],[3840,2160,'4k']]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
    await verifySource(session,width,height);
    const result=await evaluate(session,`(()=>{
      const d=document.querySelector('${modal}'),scale=Math.min(innerWidth/800,innerHeight/600);
      const panels=['daditu','ditu2','ditu3','xiaoditu'].map(name=>{
        const e=d.querySelector('[data-source-control="'+name+'"]'),base=e.getBoundingClientRect();
        return {name,center:(()=>{const r=e.querySelector('[data-source-image]').getBoundingClientRect();return {x:(r.x-base.x)/scale,y:(r.y-base.y)/scale,width:r.width/scale,height:r.height/scale}})(),
          pieces:[...e.querySelectorAll('[data-source-frame]')].map(p=>{const r=p.getBoundingClientRect();return {part:p.dataset.sourceFrame.replace('FrameImage',''),position:[(r.x-base.x)/scale,(r.y-base.y)/scale],size:[r.width/scale,r.height/scale]};})};
      });
      const buttons=[...d.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return{name:b.dataset.sourceControl,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b};});
      return {width:innerWidth,height:innerHeight,scale,panels,buttons};
    })()`);
    assert(result.buttons.every(b=>b.hit));
    for(const expected of native.frameDraws){
      const panel=result.panels.find(p=>p.name===expected.control);
      assert.deepEqual(panel.pieces.map(p=>p.part),expected.draws.map(p=>p.part));
      for(const draw of expected.draws){const piece=panel.pieces.find(p=>p.part===draw.part);for(let i=0;i<2;i++){assert(Math.abs(piece.position[i]-draw.position[i])<.05,expected.control+' '+draw.part+' pos');assert(Math.abs(piece.size[i]-draw.size[i])<.05,expected.control+' '+draw.part+' size');}}
      const inset=native.rows.find(r=>r.control===expected.control&&r.enabled).insets;
      assert(Math.abs(panel.center.x-inset[0])<.05);assert(Math.abs(panel.center.y-inset[2])<.05);
      assert(Math.abs(panel.center.width-(expected.width-inset[0]-inset[1]))<.05);assert(Math.abs(panel.center.height-(expected.height-inset[2]-inset[3]))<.05);
    }
    await screenshot(session,label+'-open');await click(session,'[data-room-create-close]');await waitUntil(session,`!document.querySelector('${modal}')`);
    assert.equal(await evaluate(session,`document.querySelector('[data-source-frame]')`),null);
    evidence.checks.push({name:'actual frame geometry matches original draw outputs and inner rectangle '+label,result});
    if(label!=='4k')await open(session);
  }
}

async function verifyMask(session) {
  for(const [width,height,label] of [[800,600,'800x600'],[1200,600,'letterbox'],[1920,1080,'1080p'],[3840,2160,'4k']]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
    await verifySource(session,width,height);
    await waitUntil(session, `(()=>{const r=document.querySelector('[data-source-control="zhezhaoditu"]')?.getBoundingClientRect();return !!r&&Math.abs(r.x-(${width}-800*Math.min(${width}/800,${height}/600))/2)<.1})()`);
    const result=await evaluate(session,`(async()=>{
      const d=document.querySelector('${modal}'),e=d.querySelector('[data-source-control="zhezhaoditu"]'),r=e.getBoundingClientRect(),scale=Math.min(innerWidth/800,innerHeight/600);
      const ui=await(await fetch('/ui.json')).json(),w=ui.layouts.find(l=>l.path.endsWith('createroom.xml')).windows.find(w=>w.name==='zhezhaoditu');
      const image=new Image();image.src='/'+e.dataset.sourceAsset;await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const context=c.getContext('2d');context.drawImage(image,0,0);
      const alpha=[...context.getImageData(0,0,c.width,c.height).data].filter((v,i)=>i%4===3);
      const buttons=[...d.querySelectorAll('button')].map(b=>{const box=b.getBoundingClientRect();return{name:b.dataset.sourceControl,hit:document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)===b};});
      return {width:innerWidth,height:innerHeight,scale,rect:{x:r.x,y:r.y,width:r.width,height:r.height},asset:e.dataset.sourceAsset,source:w.properties,
        alpha:[Math.min(...alpha),Math.max(...alpha)],imageSize:[c.width,c.height],backdrop:getComputedStyle(d,'::backdrop').backgroundColor,
        pointerEvents:getComputedStyle(e).pointerEvents,buttons,
        sample:{x:Math.round((innerWidth-800*scale)/2+790*scale),y:Math.round((innerHeight-600*scale)/2+590*scale)}};
    })()`);
    const scale=Math.min(width/800,height/600);
    assert.equal(result.asset,'ui/regions/60/128.png');assert.deepEqual(result.alpha,[153,153]);assert.deepEqual(result.imageSize,[30,30]);
    assert(Math.abs(result.rect.x-(width-800*scale)/2)<.1);assert(Math.abs(result.rect.y-((height-600*scale)/2-scale))<.1);
    assert(Math.abs(result.rect.width-800*scale)<.1);assert(Math.abs(result.rect.height-599*scale)<.1);
    assert.equal(result.backdrop,'rgba(0, 0, 0, 0)');assert.equal(result.pointerEvents,'none');assert(result.buttons.every(b=>b.hit));
    await screenshot(session,label+'-open');
    await click(session,'[data-room-create-close]');await waitUntil(session,`!document.querySelector('${modal}')`);
    assert.equal(await evaluate(session,`document.querySelector('[data-source-control="zhezhaoditu"]')`),null);
    await screenshot(session,label+'-closed');
    evidence.checks.push({name:'source mask geometry, PNG alpha, transparent native backdrop, button hits and close removal '+label,result,
      open:`${output}-${label}-open.png`,closed:`${output}-${label}-closed.png`});
    if(label!=='4k')await open(session);
  }
}

async function visualStates(session) {
  const ui=await evaluate(session,`(async()=>await(await fetch('/ui.json')).json())()`);
  const layout=ui.layouts.find(l=>l.path.endsWith('createroom.xml'));
  const asset=reference=>{const m=/^set:(\S+) image:(.+)$/.exec(reference),sets=ui.imagesets.filter(s=>s.attributes.Name===m[1]),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return set.images.find(i=>i.Name===m[2]).asset;};
  async function capture(name, property, state) {
    const expected=asset(layout.windows.find(w=>w.name===name).properties[property]);
    const actual=await evaluate(session,`document.querySelector(${JSON.stringify(control(name))}).dataset.sourceAsset`);
    assert.equal(actual,expected,name+' '+state);
    const rect=await evaluate(session,`(()=>{const e=document.querySelector(${JSON.stringify(control(name))}),r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`);
    const shot=await command('Page.captureScreenshot',{format:'png',clip:{...rect,scale:1}},session);
    const path=`${output}-state-${state}.png`;await writeFile(path,Buffer.from(shot.data,'base64'));
    evidence.checks.push({name:'source state '+state,control:name,property,expected,actual,screenshot:path,rect});
  }
  const point=await evaluate(session,`(()=>{const r=document.querySelector(${JSON.stringify(control('btnOK'))}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:5},session);
  await capture('btnOK','NormalImage','normal');
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},session);
  await capture('btnOK','HoverImage','hover');
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point},session);
  await capture('btnOK','PushedImage','down');
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:5,y:5},session);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:5,y:5},session);
  const disabled=await evaluate(session,`[...document.querySelectorAll('${modal} button:disabled')].find(e=>e.dataset.sourceControl.startsWith('btn'))?.dataset.sourceControl`);
  assert(disabled);await capture(disabled,'DisabledImage','disabled');
  const selected=await evaluate(session,`document.querySelector('${modal} button[aria-pressed="true"]').dataset.sourceControl`);
  await capture(selected,'CheckMarkImage','selected');
}

async function verifyVisual(session, size) {
  const result = await evaluate(session, `(async()=>{
    await document.fonts.ready;
    const ui=await(await fetch('/ui.json')).json(), layout=ui.layouts.find(l=>l.path.endsWith('createroom.xml'));
    const d=document.querySelector('${modal}');
    function asset(reference){const m=/^set:(\\S+) image:(.+)$/.exec(reference),sets=ui.imagesets.filter(s=>s.attributes.Name===m[1]),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return set.images.find(i=>i.Name===m[2]).asset;}
    const frames=['daditu','ditu2','ditu3','xiaoditu'].map(name=>{
      const w=layout.windows.find(w=>w.name===name), e=d.querySelector('[data-source-control="'+name+'"]');
      return {name,pieces:Object.entries(w.properties).filter(([k,v])=>k.endsWith('FrameImage')&&v.startsWith('set:')).map(([key,value])=>({key,expected:asset(value),actual:e.querySelector('[data-source-frame="'+key+'"]')?.dataset.sourceAsset}))};
    });
    const buttons=[...d.querySelectorAll('button')].map(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {name:e.dataset.sourceControl,disabled:e.disabled,hit:hit===e};});
    return {frames,buttons,font:getComputedStyle(d.querySelector('${nameInput}')).fontFamily,fontLoaded:document.fonts.check('12px CDTank-SIMSUN'),
      noExtraFrame:getComputedStyle(d).borderWidth==='0px',baseScale:Math.min(innerWidth/800,innerHeight/600),
      frameDisabled:['tiao1','tiao2'].every(n=>!d.querySelector('[data-source-control="'+n+'"] [data-source-frame]')),
      modes:['rdoCatVsDog','rdoNonCatVsDog'].map(n=>({name:n,asset:d.querySelector('[data-source-control="'+n+'"]')?.dataset.sourceAsset})),
      canvas:d.querySelector('[data-room-create-stage]').getBoundingClientRect().toJSON()};
  })()`);
  for(const frame of result.frames)for(const piece of frame.pieces)assert.equal(piece.actual,piece.expected,frame.name+' '+piece.key);
  assert(result.frameDisabled);assert(result.fontLoaded);assert(result.font.includes('CDTank-SIMSUN'));assert(result.noExtraFrame);
  assert(result.buttons.every(b=>b.hit),JSON.stringify(result.buttons));assert(result.modes.every(m=>m.asset));
  evidence.checks.push({name:'source frames, disabled frame suppression, source font and native hit targets '+size,result});
}

try {
  await launchServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5300,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3270',ws:true,rewrite:()=> '/',configure:proxy=>{proxy.on('proxyReqWs',(_request,_incoming,socket)=>{const originalWrite=socket.write.bind(socket);socket.write=(...args)=>{if(holdInputResponses){heldInputResponses.push(()=>originalWrite(...args));return true;}return originalWrite(...args);};});}}}}});
  vite.middlewares.use('/__room-text-fixture', (request,response)=>{
    response.setHeader('Content-Type','text/html; charset=utf-8');response.end(`<div id="fixture"></div><script type="module">
      import React from '/node_modules/.vite/deps/react.js';
      import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
      import {RoomCreateDialog} from '/src/interface/lobby/room-create-dialog.tsx';
      const root=ReactDOM.createRoot(document.querySelector('#fixture'));
      root.render(React.createElement(RoomCreateDialog,{open:true,close:()=>root.unmount(),initialDraft:{roomName:'中文房间名称',password:'中文密码',mode:1,minPlayers:4,maxPlayers:10,friendlyFire:false},
        map:{name:'地图名称裁剪展示夹具'.repeat(20),mapId:1,minPlayers:4,maxPlayers:10},submit:async()=>{}}));
    </script>`);
  });
  vite.middlewares.stack.unshift(vite.middlewares.stack.pop());
  await vite.listen();await launchBrowser();
  const page=await newPage(),maps=network.find(r=>r.page===page&&r.name==='ListMaps'&&r.direction==='received').response.maps;
  await click(page,'#create-room-controls > summary');
  await input(page,'#player-name','创建房主');
  await input(page,'#room-name','外层房间');await input(page,'#create-password','outer-pass');
  const initial=await form(page);
  await open(page);let state=await modalState(page);
  assert.equal(state.name,initial.name);assert.equal(state.password,initial.password);assert.equal(state.min,initial.min);assert.equal(state.max,initial.max);
  if(process.argv.includes('--button-only')||process.argv.includes('--button-shared-regression')) {await verifyButtonVisual(page);evidence.status='PASS';}
  else if(process.argv.includes('--emotion-gate-only')||process.argv.includes('--emotion-gate-success-only')) {
    if(process.argv.includes('--emotion-gate-only')){await verifyNameSelectionVisual(page);await open(page);await command('DOM.enable',{},page);await command('CSS.enable',{},page);await command('Log.enable',{},page);await verifyPasswordVisual(page);await open(page);}
    await input(page,nameInput,'AB━中文成功房');await input(page,passwordInput,'中文可用密码');const from=network.length;await click(page,'[data-room-create-confirm]');await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'&&!document.querySelector('${modal}')`);
    const request=network.slice(from).find(r=>r.name==='CreateRoom'&&r.direction==='sent'),response=network.slice(from).find(r=>r.name==='CreateRoom'&&r.direction==='received');assert.equal(request.payload.roomName,'AB━中文成功房');assert.equal(request.payload.password,'中文可用密码');assert(response.success);const world=await evaluate(page,worldExpression);assert(response.response.room.name.includes('AB━中文成功房'));assert(!await evaluate(page,`document.querySelector('[data-room-name-selection],[data-room-password-selection],.room-create-name-selected,.room-create-password-selected')`));await screenshot(page,'4k-success-waiting');await click(page,'#leave');await waitUntil(page,`!(${worldExpression})`);await open(page);await input(page,nameInput,'重开中文房');await press(page,'Home','Home');await key(page,'ArrowRight','ArrowRight','keyDown',{modifiers:8});await key(page,'ArrowRight','ArrowRight','keyUp',{modifiers:8});await waitUntil(page,`document.querySelector('[data-room-name-selection]')`);await press(page,'Escape','Escape');await waitUntil(page,`!document.querySelector('${modal}')`);assert(!await evaluate(page,`document.querySelector('[data-room-name-selection],[data-room-password-selection]')`));evidence.checks.push({name:'Ordinary corrected Chinese/special name and password successfully CreateRoom, authoritative WAITING, Leave/reopen/new edit/Escape clean layers',request,response,world});evidence.status='PASS';console.log('PASS EmotionFont0 ordinary successful create/Leave/reopen; '+output);
  }
  else if(process.argv.includes('--name-selection-only')) {await verifyNameSelectionVisual(page);evidence.status='PASS';}
  else if(process.argv.includes('--caret-only')) {await verifyCaretVisual(page);evidence.status='PASS';}
  else if(process.argv.includes('--password-only')||process.argv.includes('--password-selection-only')) {await command('DOM.enable',{},page);await command('CSS.enable',{},page);await command('Log.enable',{},page);await verifyPasswordVisual(page);evidence.status='PASS';}
  else if(process.argv.includes('--input-only')) {await verifyInputVisual(page);evidence.status='PASS';}
  else if(process.argv.includes('--text-only')) {await verifyText(page);evidence.status='PASS';}
  else if(process.argv.includes('--scale-only')) {await verifyScale(page);evidence.status='PASS';}
  else if(process.argv.includes('--image-only')) {await verifyScale(page);evidence.status='PASS';}
  else if(process.argv.includes('--frame-only')||process.argv.includes('--frame-shared-regression')) {await verifyScale(page);evidence.status='PASS';}
  else if(process.argv.includes('--mask-only')) {await verifyMask(page);evidence.status='PASS';}
  else {
  await command('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:1,mobile:false},page);
  await verifySource(page,800,600);await verifyVisual(page,'800x600');await visualStates(page);await screenshot(page,'800x600');
  if (process.argv.includes('--states-only')) {
    for(const [width,height,label] of [[1920,1080,'1080p'],[3840,2160,'4k']]) {
      await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);
      await verifySource(page,width,height);await verifyVisual(page,label);await screenshot(page,label);
    }
    evidence.status='PASS';
  }
  else {
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},page);
  const source=await verifySource(page,1920,1080);await verifyVisual(page,'1080p');await verifyButtonImages(page,source);await screenshot(page,'1080p');
  await input(page,nameInput,'取消草稿');await input(page,passwordInput,'cancel-pass');
  await click(page,'[data-room-create-low="1"]');await click(page,'[data-room-create-friendly="true"]');
  await keyboardActivate(page,'[data-room-create-cancel]');assert.equal((await modalState(page)).open,false);assert.deepEqual(await form(page),initial);
  assert(await evaluate(page,`document.activeElement?.id==='open-room-create-dialog'`), await evaluate(page,`document.activeElement?.outerHTML`));
  await open(page);await input(page,nameInput,'Esc草稿');await press(page,'Escape','Escape');assert.deepEqual(await form(page),initial);
  await open(page);await input(page,passwordInput,'close-pass');await click(page,'[data-room-create-close]');assert.deepEqual(await form(page),initial);
  evidence.checks.push({name:'cancel button by native keyboard, Escape and original close preserve ordinary form and restore launcher focus',initial});
  await select(page,'#room-mode',4);await open(page);
  assert(await evaluate(page,`document.querySelector('[data-room-create-friendly="true"]').disabled`));
  assert.equal((await modalState(page)).friendlyFire,false);await press(page,'Escape','Escape');
  await select(page,'#room-mode',1);
  const outer=await form(page),chosen=maps.find(m=>m.mapId===outer.map);
  assert(chosen);await open(page);
  for(let i=0;i<chosen.maxPlayers+2;i++)await click(page,'[data-room-create-low="1"]');
  state=await modalState(page);assert.equal(state.min,state.max);assert(state.max<=chosen.maxPlayers);
  assert(await evaluate(page,`document.querySelector('[data-room-create-low="1"]').disabled`));
  for(let i=0;i<chosen.maxPlayers+2;i++)await click(page,'[data-room-create-low="-1"]');
  state=await modalState(page);assert.equal(state.min,chosen.sourceMinPlayers);
  for(let i=0;i<chosen.maxPlayers+2;i++)await click(page,'[data-room-create-high="-1"]');
  state=await modalState(page);assert.equal(state.max,state.min);
  for(let i=0;i<chosen.maxPlayers+2;i++)await click(page,'[data-room-create-high="1"]');
  state=await modalState(page);assert.equal(state.max,chosen.maxPlayers);
  await keyboardActivate(page,'[data-room-create-low="1"]');
  state=await modalState(page);assert.equal(state.min,Math.min(chosen.sourceMinPlayers+1,state.max));
  await click(page,'[data-room-create-friendly="true"]');
  state=await modalState(page);assert.equal(state.friendlyFire,true);
  const check=source.rows.find(r=>r.name==='rdoFriendlyFireOn').references.find(r=>r.key==='CheckMarkImage').asset;
  assert((await evaluate(page,`getComputedStyle(document.querySelector('[data-room-create-friendly="true"]')).backgroundImage`)).includes('/'+check));
  evidence.checks.push({name:'native arrows clamp to real map limits and min≤max; keyboard increment retains focus; friendly-fire source checkmark',chosen,state});
  await input(page,nameInput,'原版创建房间');await input(page,passwordInput,'reject\tpass');
  assert.equal((await modalState(page)).password,'reject\tpass','native password insertion preserves server-rejected tab');
  const draft=await modalState(page),refusedFrom=network.length;
  await command('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false},page);
  await verifySource(page,3840,2160);await verifyVisual(page,'4k');await screenshot(page,'4k');
  await keyboardActivate(page,'[data-room-create-confirm]');
  await waitUntil(page,`document.querySelector('[data-room-create-status]').textContent.length>0&&!document.querySelector('[data-room-create-confirm]').disabled`);
  const rejected=network.slice(refusedFrom).find(r=>r.page===page&&r.name==='CreateRoom'&&r.direction==='received');
  assert.equal(rejected?.success,false,JSON.stringify(rejected));assert.equal(rejected.response.code,'ROOM_CONFLICT');
  state=await modalState(page);assert(state.open);for(const field of ['name','password','min','max','friendlyFire'])assert.equal(state[field],draft[field]);
  assert.equal(await evaluate(page,worldExpression),null);assert.deepEqual(await form(page),outer);
  assert(await evaluate(page,`document.activeElement?.matches('${passwordInput}')`),'rejected password field focus');
  evidence.checks.push({name:'real CreateRoom tab-password server refusal retains all dialog drafts and focuses rejected field',draft,rejected,state});await screenshot(page,'4k-rejected');
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},page);
  await input(page,passwordInput,'create-pass');const from=network.length;await click(page,'[data-room-create-confirm]');
  await waitUntil(page,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'&&!document.querySelector('${modal}')?.open`);
  assert.equal((await modalState(page)).open,false);
  const ownerWorld=await evaluate(page,worldExpression),request=network.slice(from).find(r=>r.page===page&&r.name==='CreateRoom'&&r.direction==='sent'),response=network.slice(from).find(r=>r.page===page&&r.name==='CreateRoom'&&r.direction==='received');
  assert(response?.success,JSON.stringify(response));assert.equal(request.payload.roomName,draft.name);assert.equal(request.payload.password,'create-pass');assert.equal(request.payload.minPlayers,draft.min);assert.equal(request.payload.maxPlayers,draft.max);assert.equal(request.payload.friendlyFire,true);
  assert.equal(ownerWorld.mapId,chosen.mapId);assert.equal(ownerWorld.mode,1);assert.equal(ownerWorld.match.minPlayers,draft.min);assert.equal(ownerWorld.match.maxPlayers,draft.max);assert.equal(ownerWorld.match.friendlyFire,true);
  evidence.checks.push({name:'corrected draft uses ordinary CreateRoom and enters authoritative WAITING with selected limits and friendly fire',request,response,world:ownerWorld});await screenshot(page,'1080p-waiting');
  const {browserContextId}=await command('Target.createBrowserContext');const peer=await newPage(browserContextId);
  await input(peer,'#player-name','创建访客');await click(peer,'#refresh-rooms');await waitUntil(peer,`[...document.querySelector('#room').options].some(o=>o.value===${JSON.stringify(ownerWorld.roomId)})&&!document.querySelector('#refresh-rooms').disabled`);await select(peer,'#room',ownerWorld.roomId);await input(peer,'#join-password','wrong-pass');
  const peerFrom=network.length;await click(peer,'#join');
  await waitUntil(peer,`document.querySelector('#battle-status').value.includes('密码')&&!document.querySelector('#join').disabled`);
  const wrong=network.slice(peerFrom).find(r=>r.page===peer&&r.name==='Join'&&r.direction==='received');assert.equal(wrong?.success,false);assert.equal(wrong.response.code,'ROOM_JOIN_REJECTED');assert.equal(await evaluate(peer,worldExpression),null);
  await input(peer,'#join-password','create-pass');await click(peer,'#join');
  await waitUntil(peer,`(${worldExpression})?.mapLoaded&&(${worldExpression}).phase==='WAITING'`);
  const peerWorld=await evaluate(peer,worldExpression);assert.equal(peerWorld.roomId,ownerWorld.roomId);assert.equal(peerWorld.match.minPlayers,draft.min);assert.equal(peerWorld.match.maxPlayers,draft.max);assert.equal(peerWorld.match.friendlyFire,true);
  evidence.checks.push({name:'second ordinary browser wrong password rejects; correct password joins same authoritative WAITING room',wrong,world:peerWorld});
  await click(peer,'#leave');await click(page,'#leave');
  evidence.status='PASS';await rm(`${output}-failure.png`,{force:true});console.log('PASS: original room-create controls/PNG geometry, native cancel/limits/friendly fire, real server refusal, ordinary create and password join, 1080p/4K');
  }
  }
} catch(error) {
  evidence.status='FAIL';evidence.error=error.stack??String(error);const session=pages[0]?.sessionId;
  if(session){evidence.failureFocus=await evaluate(session,`document.activeElement?.outerHTML`).catch(()=>null);evidence.failureState=await modalState(session).catch(()=>null);evidence.failureStatus=await evaluate(session,`document.querySelector('#battle-status')?.value`).catch(()=>null);await screenshot(session,'failure').catch(()=>{});}throw error;
} finally {
  releaseInputResponses();
  if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.isolation={server:3270,vite:5300,chrome:9500};evidence.noInjectedGameplayState=true;evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;
  await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);
}
