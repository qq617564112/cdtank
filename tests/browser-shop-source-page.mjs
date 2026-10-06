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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3336', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-10 formal shop source whole page and existing consumable purchase operations.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = `recovery/output/browser-shop-source-page-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5362'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3336', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9562', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9562/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['Inventory', 'Kitbag', 'OwnedRoles', 'RoleProfile', 'SelectRole', 'Equipment', 'Shop'].includes(result.service.name)) {
      network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent', kind: result.type, name: result.service.name,
        ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err} : {payload: result.msg ?? result.req})});
    }
  });
}


async function select(page,selector,value) {
  const index=await evaluate(page,`[...document.querySelector(${JSON.stringify(selector)}).options].findIndex(o=>o.value===${JSON.stringify(String(value))})`);
  assert(index>=0);await click(page,selector);await press(page,'Home','Home');
  for(let i=0;i<index;i++)await press(page,'ArrowDown','ArrowDown');
  await press(page,'Enter','Enter');await waitUntil(page,`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(String(value))}`);
}
const shopReady=`document.querySelector('#account-shop')?.open&&document.querySelector('#account-shop').getAttribute('aria-busy')==='false'&&document.querySelector('[data-shop-item]').options.length>=6`;
try {
  await launchServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5362,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3336',ws:true,rewrite:()=> '/'}}}});
  await vite.listen();await launchBrowser();const page=await newPage();
  await waitUntil(page,`localStorage.getItem('cdtank-account-token')`);
  const store=new AccountStore(join(directory,'accounts.sqlite')),owner=store.open(await evaluate(page,`localStorage.getItem('cdtank-account-token')`));
  const profile=new Uint8Array(0x170),view=new DataView(profile.buffer);view.setUint32(0x70,100,true);view.setUint32(0x74,40,true);
  store.replaceRoleProfile(owner.accountId,{bytes:profile,strings:['','']});
  evidence.fixture={explicitImportedBalance:{money:100,tokens:40},initialInventory:'empty',purchaseAuthority:'existing Shop API'};
  await click(page,'[data-room-card-shop]');await waitUntil(page,shopReady);
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);
    const scale=Math.min(width/800,height/600);
    await waitUntil(page,`Math.abs(document.querySelector('[data-shop-page]').getBoundingClientRect().width-625*${scale})<.2`);
    await evaluate(page,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const state=await evaluate(page,`(async()=>{const d=document.querySelector('#account-shop'),rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}},stage=rect(d.querySelector('[data-shop-page]')),root=[...d.querySelectorAll('[data-source-layout="ui/layouts/shop.xml"]')].map(e=>({name:e.dataset.sourceControl,rect:rect(e),selected:e.getAttribute('aria-pressed'),disabled:e.getAttribute('aria-disabled')})),assets=[...new Set([...d.querySelectorAll('[data-source-asset]')].map(e=>e.dataset.sourceAsset))];for(const path of assets){const image=new Image();image.src='/'+path;await image.decode();}const css=getComputedStyle(d);return {stage,dialog:rect(d),root,list:rect(d.querySelector('[data-shop-item]')),frames:d.querySelectorAll('[data-source-frame]').length,assets,background:css.backgroundColor,padding:css.padding,border:css.borderWidth,options:[...d.querySelector('[data-shop-item]').options].map(e=>({value:e.value,text:e.textContent})),balance:d.querySelector('[data-shop-balance]').textContent}})()`);
    assert.equal(state.frames,20);assert.equal(state.padding,'0px');assert.equal(state.border,'0px');assert.equal(state.background,'rgba(0, 0, 0, 0)');assert(state.options.length>=6);assert.deepEqual(state.options.map(e=>Number(e.value)),network.find(e=>e.name==='Shop'&&e.direction==='received'&&e.success)?.response.items.map(e=>e.itemTableId));
    assert(Math.abs(state.stage.height-404*scale)<.2);assert(state.dialog.x>=0&&state.dialog.y>=0&&state.dialog.x+state.dialog.width<=width+.2&&state.dialog.y+state.dialog.height<=height+.2);
    for(const [name,x,y,w,h] of [['anniuditu',1,0,208,43],['zkb',0,35,216,368],['hongsexiaodi',209,0,397,45],['youbiandaditu',209,34,405,370],['btnClose',570,-2,37,37]]) {
      const r=state.root.find(e=>e.name===name)?.rect;assert(r,name);
      for(const [actual,expected] of [[r.x-state.stage.x,x*scale],[r.y-state.stage.y,y*scale],[r.width,w*scale],[r.height,h*scale]])assert(Math.abs(actual-expected)<.2,`${name}: ${actual} vs ${expected}`);
    }
    for(const [actual,expected] of [[state.list.x-state.stage.x,222*scale],[state.list.y-state.stage.y,97*scale],[state.list.width,376*scale],[state.list.height,279*scale]])assert(Math.abs(actual-expected)<.2);
    await screenshot(page,'shop-'+width);evidence.checks.push({name:'formal shop source full page '+width+'×'+height,scale,state});
  }
  for(const id of [1,2,4,6,7,8]) {
    await select(page,'[data-shop-item]',id);
    const item=await evaluate(page,`(async()=>{const e=document.querySelector('[data-shop-product]'),icon=e.querySelector('[data-source-asset]'),i=new Image();i.src='/'+icon.dataset.sourceAsset;await i.decode();return {id:document.querySelector('[data-shop-item]').value,text:e.textContent,asset:icon.dataset.sourceAsset,width:i.naturalWidth,height:i.naturalHeight}})()`);
    assert.equal(item.id,String(id));assert(item.asset&&item.width>0&&item.height>0);evidence.checks.push({name:'ordinary source catalog selection and decoded product '+id,item});
  }
  const balances=()=>{const p=store.roleProfile(owner.accountId),v=new DataView(p.bytes.buffer,p.bytes.byteOffset,p.bytes.byteLength);return {money:v.getUint32(0x70,true),tokens:v.getUint32(0x74,true)}};
  await select(page,'[data-shop-item]',2);await input(page,'[data-shop-quantity]','3');await click(page,'[data-shop-buy]');
  await waitUntil(page,shopReady+`&&document.querySelector('[data-shop-status]').value.includes('已购买')`);assert.deepEqual(balances(),{money:40,tokens:40});
  const first=await evaluate(page,`({instance:document.querySelector('#account-shop').dataset.purchasedInstance,status:document.querySelector('[data-shop-status]').value,balance:document.querySelector('[data-shop-balance]').textContent})`);assert(Number(first.instance)>0);
  evidence.checks.push({name:'ordinary MONEY purchase confirms quantity3 and authoritative 100→40',result:first});
  await select(page,'[data-shop-item]',8);await input(page,'[data-shop-quantity]','1');await select(page,'[data-shop-currency]','TOKENS');await click(page,'[data-shop-buy]');
  await waitUntil(page,shopReady+`&&document.querySelector('[data-shop-status]').value.includes('已购买')`);assert.deepEqual(balances(),{money:40,tokens:20});
  evidence.checks.push({name:'ordinary TOKENS purchase confirms independent price40/20',balance:balances(),status:await evaluate(page,`document.querySelector('[data-shop-status]').value`)});
  await input(page,'[data-shop-quantity]','10');await select(page,'[data-shop-currency]','MONEY');await click(page,'[data-shop-buy]');
  await waitUntil(page,shopReady+`&&!document.querySelector('[data-shop-status]').value.includes('已购买')`);assert.deepEqual(balances(),{money:40,tokens:20});
  const rejection=await evaluate(page,`({item:document.querySelector('[data-shop-item]').value,quantity:document.querySelector('[data-shop-quantity]').value,currency:document.querySelector('[data-shop-currency]').value,status:document.querySelector('[data-shop-status]').value})`);assert.equal(rejection.item,'8');assert.equal(rejection.quantity,'10');assert.equal(rejection.currency,'MONEY');assert(rejection.status.includes('不足'));
  evidence.checks.push({name:'ordinary insufficient balance rejection preserves draft and authority',rejection});await screenshot(page,'purchase-rejection');
  await click(page,'[data-shop-refresh]');await waitUntil(page,shopReady);assert.deepEqual(balances(),{money:40,tokens:20});
  await click(page,'[data-shop-close]');await waitUntil(page,`!document.querySelector('#account-shop')`);assert.equal(await evaluate(page,`document.activeElement.hasAttribute('data-room-card-shop')`),true);
  evidence.checks.push({name:'source Close returns lobby shop focus after query and transactions'});
  await click(page,'[data-room-card-shop]');await waitUntil(page,shopReady);assert((await evaluate(page,`document.querySelector('[data-shop-balance]').textContent`)).includes('40'));
  await press(page,'Escape','Escape');await waitUntil(page,`!document.querySelector('#account-shop')`);assert.equal(await evaluate(page,`document.activeElement.hasAttribute('data-room-card-shop')`),true);
  evidence.checks.push({name:'normal reopen shows confirmed balances and Escape restores lobby focus'});
  const buys=evidence.network=network;assert.equal(buys.filter(e=>e.name==='Shop'&&e.direction==='sent'&&e.payload.operation==='BUY').length,3);
  evidence.status='PASS';console.log('PASS formal source shop whole page/catalog/purchase/rejection/return');
} catch(error) {evidence.status='FAIL';evidence.error=error.stack??String(error);await screenshot(pages[0]?.sessionId,'failure').catch(()=>{});throw error;
} finally {if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3336,vite:5362,chrome:9562};evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);}
