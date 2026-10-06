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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3363', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-07/UI-32 equipment major source regions, source navigation/category state and ordinary equip/unequip authority.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  await waitUntil(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)return false;const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&r.height>0&&(e===hit||e.contains(hit))})()`);
  await evaluate(session, `new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
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
const output = `recovery/output/browser-home-equipment-source-page-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5413'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3363', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9613', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9613/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['Inventory', 'Kitbag', 'OwnedRoles', 'RoleProfile', 'SelectRole', 'Equipment'].includes(result.service.name)) {
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


const preview='#home-equipment [data-role-preview]';
const previewReady=`document.querySelector('${preview}')?.dataset.status==='ready'&&document.querySelector('${preview}').dataset.renderedTankId==='2'&&Number(document.querySelector('${preview}').dataset.frames)>1`;
async function inventoryReady(page) {
  await waitUntil(page,`document.querySelector('#home-inventory')?.getAttribute('aria-busy')==='false'&&document.querySelector('#open-equipment')`);
}
async function openEquipment(page) {
  await click(page,'[data-room-card-home]');
  await waitUntil(page,`document.querySelector('#open-equipment')&&!document.querySelector('#home-inventory')?.getAttribute('aria-busy')?.includes('true')`);
  await inventoryReady(page);await click(page,'#open-equipment'); await waitUntil(page,previewReady);
}
try {
  await launchServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5413,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3363',ws:true,rewrite:()=> '/'}}}});
  await vite.listen();await launchBrowser();const page=await newPage();
  await waitUntil(page,`localStorage.getItem('cdtank-account-token')`);
  const store=new AccountStore(join(directory,'accounts.sqlite')),owner=store.open(await evaluate(page,`localStorage.getItem('cdtank-account-token')`));
  const fixture=JSON.parse(await readFile('recovery/output/role-owned-pair-native.json','utf8')).rows[0];
  const pair=readOwnedRolePairMessage(new Uint8Array(fixture.raw),fixture.alignment,()=> '原角色');
  const base={name:'测试宠物',fields:new Map(pair.base.fields)},tank={name:'测试战车',fields:new Map(pair.equipment.fields)};
  base.fields.set(0,71);base.fields.set(8,1);tank.fields.set(0x1c,72);tank.fields.set(0x24,2);tank.fields.set(0x28,20011);tank.fields.set(0x2c,20012);tank.fields.set(0x30,20013);tank.fields.set(0x6c,3);for(const offset of [0x58,0x5c,0x60])tank.fields.set(offset,0);
  const profile=new Uint8Array(0x170);new DataView(profile.buffer).setUint32(0xa8,72,true);
  store.replaceRoleRecords(owner.accountId,{base:[base],equipment:[tank]});store.replaceRoleProfile(owner.accountId,{bytes:profile,strings:['角色名','资料']});
  store.replaceInventory(owner.accountId,[{instanceId:81,itemTableId:13001,ownedQuantity:1,battleQuantity:1,state:0,field8:0,float24Bits:0,float28Bits:0,float2cBits:0}]);
  evidence.fixture={source:'role-owned-pair-native.json rows[0]',pet:71,tank:72,tankDefinition:2,explicitImportedOwnership:true};
  await openEquipment(page);await witness(page,preview,'rootPreview');
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);
    const scale=Math.min(width/800,height/600);
    await waitUntil(page,`Math.abs(document.querySelector('.home-equipment-stage').getBoundingClientRect().width-625*${scale})<.2&&Math.abs(document.querySelector('${preview} canvas').width-Math.round(218*${scale}))<=1&&${previewReady}`);
    const state=await evaluate(page,`(async()=>{const d=document.querySelector('#home-equipment'),s=d.querySelector('.home-equipment-stage'),rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}},stage=rect(s),p=d.querySelector('[data-role-preview]'),css=getComputedStyle(d),root=[...d.querySelectorAll('[data-source-layout="ui/layouts/myhome.xml"]')].map(e=>({name:e.dataset.sourceControl,rect:rect(e)})),assets=[...new Set([...d.querySelectorAll('[data-source-asset]')].map(e=>e.dataset.sourceAsset))];for(const path of assets){const image=new Image();image.src='/'+path;await image.decode();}return {stage,dialog:rect(d),root,frames:d.querySelectorAll('[data-source-frame]').length,assets,background:css.backgroundColor,padding:css.padding,border:css.borderWidth,preview:{rect:rect(p),pixels:[p.querySelector('canvas').width,p.querySelector('canvas').height],meshes:p.dataset.meshes,status:p.dataset.status}}})()`);
    assert(state.frames>20);assert.equal(await evaluate(page,`document.querySelectorAll('#home-equipment .home-tank-source-picture').length`),36);assert.equal(state.padding,'0px');assert.equal(state.border,'0px');assert.equal(state.background,'rgba(0, 0, 0, 0)');
    assert(Math.abs(state.stage.height-404*scale)<.2);assert(state.dialog.x>=0&&state.dialog.y>=0&&state.dialog.x+state.dialog.width<=width+.2&&state.dialog.y+state.dialog.height<=height+.2);
    for(const [name,x,y,w,h] of [['anniuditu',1,0,208,43],['zkb',0,35,216,368],['hongsexiaodi',209,0,397,45],['youbiandaditu',209,34,405,370],['btnClose',570,-2,37,37]]) {
      const r=state.root.find(e=>e.name===name)?.rect;assert(r,name);
      for(const [actual,expected] of [[r.x-state.stage.x,x*scale],[r.y-state.stage.y,y*scale],[r.width,w*scale],[r.height,h*scale]])assert(Math.abs(actual-expected)<.2,`${name}: ${actual} vs ${expected}`);
    }
    await screenshot(page,'equipment-'+width);evidence.checks.push({name:'formal equipment full source root '+width+'×'+height,scale,state});
  }
  for(const target of ['DECORATION','MARK','PART']) {
    await click(page,`[data-equipment-tab="${target}"]`);await waitUntil(page,`document.querySelector('[data-equipment-tab="${target}"]').getAttribute('aria-pressed')==='true'`);await stable(page,preview,'rootPreview');
  }
  await click(page,'[data-equipment-item="81"]');await click(page,'[data-equipment-slot="0"]');
  await waitUntil(page,`document.querySelector('[data-equipment-slot="0"]').dataset.instanceId==='81'&&!document.querySelector('[data-equipment-slot="0"]').disabled`);
  assert.equal(store.inventory(owner.accountId).records.find(r=>r.instanceId===81).state,2);
  await press(page,'Delete','Delete');
  await waitUntil(page,`document.querySelector('[data-equipment-slot="0"]').dataset.instanceId==='0'&&!document.querySelector('[data-equipment-slot="0"]').disabled`);
  assert.equal(store.inventory(owner.accountId).records.find(r=>r.instanceId===81).state,0);
  evidence.checks.push({name:'ordinary source item candidate equip and Delete unequip confirmed by authority'});
  await click(page,'#home-equipment [data-source-control="rdoTank"]');await waitUntil(page,`document.querySelector('#home-roles')?.open&&!document.querySelector('#home-equipment')`);
  await click(page,'#home-roles [data-source-control="rdoEquip"]');await waitUntil(page,previewReady);await witness(page,preview,'rootPreview');
  evidence.checks.push({name:'source Tank and Equip navigation restores formal selected equipment category'});
  evidence.checks.push({name:'ordinary equipment category switches preserve preview and authority',profileTank:new DataView(store.roleProfile(owner.accountId).bytes.buffer).getUint32(0xa8,true)});
  await click(page,'#home-equipment [data-source-control="rdoPlayerPage"]');await waitUntil(page,`!document.querySelector('#home-equipment')&&document.querySelector('#home-inventory')?.open`);
  evidence.checks.push({name:'source About Me opens inventory root and disposes equipment preview',disposed:await disposed(page,'rootPreview')});
  await inventoryReady(page);await click(page,'#open-equipment');await waitUntil(page,previewReady);await witness(page,preview,'petTransition');
  await click(page,'#home-equipment [data-role-tab="pet"]');await waitUntil(page,`!document.querySelector('#home-equipment')&&document.querySelector('[data-home-role-page]')?.dataset.homeRolePage==='pet'`);
  evidence.checks.push({name:'source Pet opens actual owned pet page and disposes equipment preview',disposed:await disposed(page,'petTransition')});
  await click(page,'[data-source-control="rdoPlayerPage"]');await waitUntil(page,`document.querySelector('#home-inventory')?.open`);
  await inventoryReady(page);await click(page,'#open-equipment');await waitUntil(page,previewReady);await witness(page,preview,'tankTransition');
  await click(page,'#home-equipment [data-role-tab="tank"]');await waitUntil(page,`!document.querySelector('#home-equipment')&&document.querySelector('[data-home-role-page]')?.dataset.homeRolePage==='tank'`);
  evidence.checks.push({name:'source Tank opens actual owned tank page and disposes equipment preview',disposed:await disposed(page,'tankTransition')});
  await click(page,'[data-source-control="rdoPlayerPage"]');await waitUntil(page,`document.querySelector('#home-inventory')?.open`);
  await inventoryReady(page);await click(page,'#open-equipment');await waitUntil(page,previewReady);await witness(page,preview,'closePreview');
  await click(page,'[data-equipment-close]');await waitUntil(page,`!document.querySelector('#home-equipment')`);
  assert.equal(await evaluate(page,`document.querySelector('[data-lobby-page]').hidden`),false);
  evidence.checks.push({name:'source Close returns lobby and stops preview rendering',disposed:await disposed(page,'closePreview')});
  await openEquipment(page);await witness(page,preview,'escapePreview');await press(page,'Escape','Escape');await waitUntil(page,`!document.querySelector('#home-equipment')`);
  evidence.checks.push({name:'ordinary Escape closes equipment root and stops preview',disposed:await disposed(page,'escapePreview')});
  evidence.status='PASS';console.log('PASS formal equipment source whole page/navigation/preview cleanup');
} catch(error) {evidence.status='FAIL';evidence.error=error.stack??String(error);await screenshot(pages[0]?.sessionId,'failure').catch(()=>{});throw error;
} finally {if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3363,vite:5413,chrome:9613};evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);}
