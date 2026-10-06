import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, mkdir, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {readOwnedRolePairMessage} from '../recovery/evidence/roles/role-owned-sources.ts';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const {WsClient} = require('tsrpc');
const {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3325', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-07-R-PAGE source home owned tank/pet root, ordinary save/navigation and preview lifecycle.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = `recovery/output/browser-home-roles-page-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
await mkdir('recovery/output', {recursive: true});
const world = session => evaluate(session, worldExpression);
async function ready(session){await waitUntil(session,`document.querySelector('[data-lobby-background] [data-source-image]')&&document.querySelector('[data-room-card-id="R1"]')&&!document.querySelector('[data-room-card-create]').disabled`);}
async function newPage(browserContextId, width = 1920, height = 1080) {
  const {targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  pages.push({targetId, sessionId});
  await command('Network.enable', {}, sessionId);
  await command('Page.enable', {}, sessionId);
  await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false}, sessionId);
  await command('Page.navigate', {url: 'http://127.0.0.1:5349'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3325', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9549', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9549/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['Inventory', 'Kitbag', 'OwnedRoles', 'RoleProfile', 'SelectRole'].includes(result.service.name)) {
      network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent', kind: result.type, name: result.service.name,
        ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err} : {payload: result.msg ?? result.req})});
    }
  });
}


async function witness(session,selector,name){
  await evaluate(session,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url);const element=document.querySelector(${JSON.stringify(selector)}),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===element.querySelector('canvas'));if(!engine)throw new Error('Preview engine missing');window[${JSON.stringify(name)}]={element,engine,scene:engine.scenes[0]};})()`);
}
async function stable(session,selector,name){
  assert(await evaluate(session,`(()=>{const w=window[${JSON.stringify(name)}];return w.element===document.querySelector(${JSON.stringify(selector)})&&w.engine.getRenderingCanvas()===w.element.querySelector('canvas')&&!w.engine.isDisposed&&!w.scene.isDisposed})()`),'Preview element/engine/scene identity must survive semantic changes');
}
async function disposed(session,name){
  const state=await evaluate(session,`(()=>{const w=window[${JSON.stringify(name)}];return {engine:w.engine.isDisposed,scene:w.scene.isDisposed,connected:w.element.isConnected,frames:w.element.dataset.frames}})()`);
  assert.equal(state.engine,true);assert.equal(state.scene,true);assert.equal(state.connected,false);
  await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  assert.equal(await evaluate(session,`window[${JSON.stringify(name)}].element.dataset.frames`),state.frames,'Closed preview render loop must stop');
  return state;
}


async function state(page) {
  return evaluate(page, `(()=>{const d=document.querySelector('#home-roles'),box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}},p=d.querySelector('[data-role-preview]');return {dialog:box(d),kind:d.querySelector('[data-home-role-page]').dataset.homeRolePage,frames:d.querySelectorAll('[data-source-frame]').length,root:[...d.querySelectorAll('[data-source-layout="ui/layouts/myhome.xml"]')].map(e=>e.dataset.sourceControl),owned:[...d.querySelectorAll('[data-owned-role]')].map(e=>({id:e.dataset.ownedRole,selected:e.getAttribute('aria-pressed'),name:e.textContent})),preview:p?{box:box(p),pixels:[p.querySelector('canvas').width,p.querySelector('canvas').height],status:p.dataset.status,tank:p.dataset.tankId,meshes:p.dataset.meshes}:null}})()`);
}
const preview='[data-role-preview]';
const previewReady=`document.querySelector('${preview}')?.dataset.status==='ready'&&document.querySelector('${preview}').dataset.renderedTankId==='2'&&Number(document.querySelector('${preview}').dataset.frames)>1`;
try {
  await launchServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5349,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3325',ws:true,rewrite:()=> '/'}}}});
  await vite.listen();await launchBrowser();const page=await newPage();
  await waitUntil(page,`localStorage.getItem('cdtank-account-token')`);
  const store=new AccountStore(join(directory,'accounts.sqlite')),owner=store.open(await evaluate(page,`localStorage.getItem('cdtank-account-token')`));
  const fixture=JSON.parse(await readFile('recovery/output/role-owned-pair-native.json','utf8')).rows[0];
  const pair=readOwnedRolePairMessage(new Uint8Array(fixture.raw),fixture.alignment,()=> '原角色');
  const base={name:'测试宠物',fields:new Map(pair.base.fields)},tank={name:'测试战车',fields:new Map(pair.equipment.fields)};
  base.fields.set(0,71);base.fields.set(8,1);tank.fields.set(0x1c,72);tank.fields.set(0x24,2);tank.fields.set(0x28,20011);tank.fields.set(0x2c,20012);tank.fields.set(0x30,20013);
  store.replaceRoleRecords(owner.accountId,{base:[base],equipment:[tank]});store.replaceRoleProfile(owner.accountId,{bytes:new Uint8Array(0x170),strings:['角色名','资料']});
  evidence.fixture={source:'role-owned-pair-native.json rows[0]',pet:71,tank:72,tankDefinition:2,explicitImportedOwnership:true};
  await click(page,'[data-room-card-home]');await waitUntil(page,`document.querySelector('[data-source-control="rdoTankPage"]')&&!document.querySelector('[data-source-control="rdoTankPage"]').disabled`);
  await click(page,'[data-source-control="rdoTankPage"]');await waitUntil(page,`document.querySelector('[data-owned-role="72"]')`);
  await click(page,'[data-owned-role="72"]');await waitUntil(page,previewReady);await witness(page,preview,'tankWitness');
  await click(page,'.home-role-use');await waitUntil(page,`document.querySelector('.home-role-use').dataset.selectedInstance==='72'&&document.querySelector('#home-roles .home-role-status').value==='角色选择已保存'`);
  assert.equal(new DataView(store.roleProfile(owner.accountId).bytes.buffer).getUint32(0xa8,true),72);await stable(page,preview,'tankWitness');
  evidence.checks.push({name:'ordinary tank selected and saved authority, existing preview retained',instance:72});
  for(const kind of ['tank','pet']) {
    if(kind==='pet') {
      await click(page,'[data-role-tab="pet"]');await waitUntil(page,`document.querySelector('[data-owned-role="71"]')`);
      evidence.checks.push({name:'Tank→Pet source radio destroys old preview',disposed:await disposed(page,'tankWitness')});
      await click(page,'[data-owned-role="71"]');await click(page,'.home-role-use');
      await waitUntil(page,`document.querySelector('.home-role-use').dataset.selectedInstance==='71'&&document.querySelector('#home-roles .home-role-status').value==='角色选择已保存'`);
      assert.equal(new DataView(store.roleProfile(owner.accountId).bytes.buffer).getUint32(0xa4,true),71);
      evidence.checks.push({name:'ordinary pet selected and saved authority',instance:71});
    }
    for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]) {
      await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);
      const scale=Math.min(width/800,height/600);
      await waitUntil(page,`Math.abs(document.querySelector('[data-home-role-page]').getBoundingClientRect().width-625*${scale})<.2`);
      if(kind==='tank')await waitUntil(page,`Math.abs(document.querySelector('${preview} canvas').width-Math.round(218*${scale}))<=1&&${previewReady}`);
      const current=await state(page);assert.equal(current.kind,kind);assert.equal(current.frames,20);
      assert(current.root.includes('btnClose'));assert(current.dialog.x>=0&&current.dialog.y>=0&&current.dialog.x+current.dialog.width<=width+.2&&current.dialog.y+current.dialog.height<=height+.2);
      if(kind==='tank'){assert.equal(current.preview.status,'ready');assert.equal(current.preview.tank,'2');assert(Math.abs(current.preview.box.width-218*scale)<.2);}
      else assert.equal(current.preview,null);
      await screenshot(page,kind+'-'+width);evidence.checks.push({name:kind+' source whole page '+width+'×'+height,scale,state:current});
    }
  }
  await click(page,'[data-source-control="rdoPlayerPage"]');await waitUntil(page,`document.querySelector('#home-inventory')?.open&&!document.querySelector('#home-roles')`);
  await screenshot(page,'player-return');assert.equal(await evaluate(page,`document.querySelector('[data-source-control="rdoPlayerPage"]').getAttribute('aria-pressed')`),'true');
  await click(page,'[data-home-close]');await waitUntil(page,`!document.querySelector('#home-inventory')`);assert.equal(await evaluate(page,`document.activeElement.hasAttribute('data-room-card-home')`),true);
  evidence.checks.push({name:'source Player returns inventory source root and Close restores lobby Home focus'});
  await click(page,'[data-room-card-home]');await waitUntil(page,`document.querySelector('[data-source-control="rdoTankPage"]')&&!document.querySelector('[data-source-control="rdoTankPage"]').disabled`);
  await click(page,'[data-source-control="rdoTankPage"]');await waitUntil(page,previewReady);await witness(page,preview,'closeWitness');
  await click(page,'[data-roles-close]');await waitUntil(page,`!document.querySelector('#home-roles')`);evidence.checks.push({name:'source Close disposes preview and restores lobby focus',disposed:await disposed(page,'closeWitness')});assert.equal(await evaluate(page,`document.activeElement.hasAttribute('data-room-card-home')`),true);
  evidence.status='PASS';console.log('PASS source home roles whole pages and ordinary save/navigation/lifecycle');
} catch(error) {evidence.status='FAIL';evidence.error=error.stack??String(error);await screenshot(pages[0]?.sessionId,'failure').catch(()=>{});throw error;
} finally {if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3325,vite:5349,chrome:9549};evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);}
