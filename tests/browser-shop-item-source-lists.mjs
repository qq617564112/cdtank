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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3366', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const evidence = {status: 'RUNNING', scope: 'M5-10/UI-53 original owned/catalog main lists and existing purchases, incomplete original purchase producer.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
  await evaluate(session, `document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'nearest'})`);
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
const output = `recovery/output/browser-shop-item-source-lists-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5416'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3366', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9616', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9616/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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


const layoutOnly = process.argv.includes('--layout-only');
const interactionsOnly = process.argv.includes('--interactions-only');
const shopReady = `document.querySelector('#account-shop')?.open&&document.querySelector('#account-shop').getAttribute('aria-busy')==='false'&&document.querySelectorAll('[data-shop-product-id]').length>=6`;
async function product(page,id) {await click(page,`[data-shop-product-id="${id}"]`);await waitUntil(page,`document.querySelector('[data-shop-item]').dataset.selectedItem==='${id}'`);}
async function currency(page,value) {
  await click(page,'[data-shop-currency]');await press(page,'Home','Home');
  if(value==='TOKENS')await press(page,'ArrowDown','ArrowDown');
  await press(page,'Enter','Enter');await waitUntil(page,`document.querySelector('[data-shop-currency]').value==='${value}'`);
}
try {
  await launchServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5416,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3366',ws:true,rewrite:()=> '/'}}}});
  await vite.listen();await launchBrowser();const page=await newPage();
  await waitUntil(page,`localStorage.getItem('cdtank-account-token')`);
  const store=new AccountStore(join(directory,'accounts.sqlite')),owner=store.open(await evaluate(page,`localStorage.getItem('cdtank-account-token')`));
  const profile=new Uint8Array(0x170),view=new DataView(profile.buffer);view.setUint32(0x70,100,true);view.setUint32(0x74,40,true);
  store.replaceRoleProfile(owner.accountId,{bytes:profile,strings:['','']});
  const record=(instanceId,itemTableId,ownedQuantity)=>({instanceId,itemTableId,ownedQuantity,battleQuantity:0,state:0,field8:0,float24Bits:0,float28Bits:0,float2cBits:0});
  store.replaceInventory(owner.accountId,[record(301,2001,5),record(302,4,2)]);
  evidence.fixture={explicitImportedBalance:{money:100,tokens:40},explicitImportedInventory:[{instance:301,item:2001,quantity:5},{instance:302,item:4,quantity:2}],purchaseAuthority:'existing Shop API, owned list uses real Inventory query'};
  await click(page,'[data-room-card-shop]');await waitUntil(page,shopReady+`&&document.querySelector('[data-shop-owned-instance="302"]')&&!document.querySelector('[data-shop-owned-instance="302"]').disabled`);
  if(!interactionsOnly)for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);
    const scale=Math.min(width/800,height/600);
    await waitUntil(page,`Math.abs(document.querySelector('[data-shop-page]').getBoundingClientRect().width-625*${scale})<.2`);
    await evaluate(page,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const state=await evaluate(page,`(async()=>{const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}},d=document.querySelector('#account-shop'),assets=[...new Set([...d.querySelectorAll('[data-source-asset]')].map(e=>e.dataset.sourceAsset))];for(const path of assets){const i=new Image();i.src='/'+path;await i.decode();}return {stage:box(d.querySelector('[data-shop-page]')),catalog:box(d.querySelector('[data-shop-item]')),owned:box(d.querySelector('[data-shop-owned-list]')),purchase:box(d.querySelector('[data-shop-buy]')),quantity:box(d.querySelector('[data-shop-quantity]')),currency:box(d.querySelector('[data-shop-currency]')),detail:box(d.querySelector('[data-shop-product]')),status:box(d.querySelector('[data-shop-status]')),products:[...d.querySelectorAll('[data-shop-product-id]')].map(e=>Number(e.dataset.shopProductId)),ownedRows:[...d.querySelectorAll('[data-shop-owned-instance]')].map(e=>({id:e.dataset.shopOwnedInstance,text:e.textContent})),ownedCount:d.querySelector('[data-source-control="txtMyListQuantity"]').textContent,nativeCatalog:!!d.querySelector('select[data-shop-item]'),assets}})()`);
    assert.equal(state.nativeCatalog,false);assert.equal(state.ownedCount,'1');assert.equal(state.ownedRows[0].id,'302');
    for(const [rect,x,y,w,h] of [[state.catalog,222,97,376,279],[state.owned,12,50,192,279]])for(const [a,b] of [[rect.x-state.stage.x,x*scale],[rect.y-state.stage.y,y*scale],[rect.width,w*scale],[rect.height,h*scale]])assert(Math.abs(a-b)<.2);
    for(const rect of [state.stage,state.purchase,state.detail,state.status])assert(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width+.2&&rect.y+rect.height<=height+.2);
    assert(state.quantity.y+state.quantity.height<state.purchase.y);assert(state.currency.y+state.currency.height<state.purchase.y);
    await screenshot(page,'item-'+width);evidence.checks.push({name:'formal item shop owned/catalog whole page '+width+'×'+height,scale,state});
  }
  if (!layoutOnly) {
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},page);
  await waitUntil(page,`Math.abs(document.querySelector('[data-shop-page]').getBoundingClientRect().width-1125)<.2`);
  await evaluate(page,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  await click(page,'[data-shop-owned-instance="302"]');assert.equal(await evaluate(page,`document.querySelector('[data-shop-owned-instance="302"]').getAttribute('aria-selected')`),'true');
  await click(page,'[data-shop-owned-category="Weapon"]');await waitUntil(page,`document.querySelector('[data-shop-owned-instance="301"]')`);
  assert.equal(await evaluate(page,`document.querySelector('[data-shop-category="Item"]').getAttribute('aria-pressed')`),'true');
  await click(page,'[data-shop-owned-category="Item"]');await waitUntil(page,`document.querySelector('[data-shop-owned-instance="302"]')`);
  const listPoint=await evaluate(page,`(()=>{const r=document.querySelector('[data-shop-item]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...listPoint},page);await command('Input.dispatchMouseEvent',{type:'mouseWheel',...listPoint,deltaX:0,deltaY:180},page);
  await waitUntil(page,`document.querySelector('[data-shop-item]').scrollTop>0`);
  await product(page,8);await press(page,'Home','Home');await waitUntil(page,`document.querySelector('[data-shop-item]').dataset.selectedItem==='1'`);
  await press(page,'End','End');await waitUntil(page,`document.querySelector('[data-shop-item]').dataset.selectedItem==='8'`);
  evidence.checks.push({name:'independent source owned categories, original selection and ordinary catalog wheel/Home/End focus'});
  const balances=()=>{const p=store.roleProfile(owner.accountId),v=new DataView(p.bytes.buffer,p.bytes.byteOffset,p.bytes.byteLength);return {money:v.getUint32(0x70,true),tokens:v.getUint32(0x74,true)}};
  await product(page,2);await input(page,'[data-shop-quantity]','3');await click(page,'[data-shop-buy]');
  await waitUntil(page,shopReady+`&&document.querySelector('[data-shop-status]').value.includes('已购买')`);
  const first=store.inventory(owner.accountId).records.find(r=>r.itemTableId===2);assert(first);assert.equal(first.ownedQuantity,3);assert.deepEqual(balances(),{money:40,tokens:40});
  await waitUntil(page,`document.querySelector('[data-shop-owned-instance="${first.instanceId}"]')?.textContent.includes('×3')&&!document.querySelector('[data-shop-owned-instance="${first.instanceId}"]').disabled`);
  assert.equal(await evaluate(page,`document.querySelector('[data-source-control="txtMyListQuantity"]').textContent`),'2');assert.equal(await evaluate(page,`document.activeElement.hasAttribute('data-shop-buy')`),true);
  evidence.checks.push({name:'ordinary quantity3 MONEY purchase confirms authority and re-queries owned instance',instance:first.instanceId,balance:balances()});
  await product(page,8);await input(page,'[data-shop-quantity]','1');await currency(page,'TOKENS');await click(page,'[data-shop-buy]');
  await waitUntil(page,shopReady+`&&document.querySelector('[data-shop-status]').value.includes('已购买')`);
  const second=store.inventory(owner.accountId).records.find(r=>r.itemTableId===8);assert(second);assert.deepEqual(balances(),{money:40,tokens:20});
  await waitUntil(page,`document.querySelector('[data-shop-owned-instance="${second.instanceId}"]')&&!document.querySelector('[data-shop-owned-instance="${second.instanceId}"]').disabled`);
  evidence.checks.push({name:'ordinary TOKENS purchase updates real owned list and independent balance',instance:second.instanceId,balance:balances()});
  const before=store.inventory(owner.accountId);await input(page,'[data-shop-quantity]','10');await currency(page,'MONEY');await click(page,'[data-shop-buy]');
  await waitUntil(page,shopReady+`&&document.querySelector('[data-shop-status]').value.includes('不足')`);
  assert.deepEqual(balances(),{money:40,tokens:20});assert.deepEqual(store.inventory(owner.accountId),before);
  assert.equal(await evaluate(page,`document.querySelector('[data-shop-quantity]').value`),'10');assert.equal(await evaluate(page,`document.querySelector('[data-shop-item]').dataset.selectedItem`),'8');
  evidence.checks.push({name:'insufficient balance rejection preserves purchase draft and confirmed owned inventory'});await screenshot(page,'rejection');
  await click(page,'[data-shop-category="Weapon"]');await waitUntil(page,`document.querySelector('[data-shop-product-id="2007"]')`);
  assert.equal(await evaluate(page,`document.querySelector('[data-shop-owned-category="Item"]').getAttribute('aria-pressed')`),'true');
  await click(page,'[data-shop-category="Item"]');await waitUntil(page,shopReady);
  await click(page,'[data-shop-refresh]');await waitUntil(page,shopReady+`&&document.querySelector('[data-shop-owned-instance="${second.instanceId}"]')&&!document.querySelector('[data-shop-owned-instance="${second.instanceId}"]').disabled`);
  await click(page,'[data-shop-close]');await waitUntil(page,`!document.querySelector('#account-shop')`);assert.equal(await evaluate(page,`document.activeElement.hasAttribute('data-room-card-shop')`),true);
  await click(page,'[data-room-card-shop]');await waitUntil(page,shopReady+`&&document.querySelector('[data-shop-owned-instance="${second.instanceId}"]')`);
  await press(page,'Escape','Escape');await waitUntil(page,`!document.querySelector('#account-shop')`);assert.equal(await evaluate(page,`document.activeElement.hasAttribute('data-room-card-shop')`),true);
  assert.equal(network.filter(e=>e.name==='Shop'&&e.direction==='sent'&&e.payload.operation==='BUY').length,3);
  evidence.checks.push({name:'source catalog categories, query, close/reopen inventory and Escape restore lobby shop focus'});
  }
  evidence.status='PASS';console.log('PASS item shop owned/catalog full page, selection, ordinary purchases and returns');
} catch(error) {evidence.status='FAIL';evidence.error=error.stack??String(error);await screenshot(pages[0]?.sessionId,'failure').catch(()=>{});throw error;
} finally {if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3366,vite:5416,chrome:9616};evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);}
