import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const {WsClient} = require('tsrpc');
const {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3365', logger: undefined, heartbeat: {interval: 3000, timeout: 10000}});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-room-cards-'));
let server, chrome, vite, ws;
let serverLog = '';
const pages = [], network = [], fixtures = [];
let sequence = 0;
const pending = new Map();
const supplementOnly = process.argv.includes('--supplement-only');
const interactionsOnly = supplementOnly || process.argv.includes('--interactions-only');
const evidence = {status: 'RUNNING', scope: 'M5-09/UI-36 player major original regions, readonly account name, inventory selection and ordinary shortcut navigation.', viewport: {width: 1920, height: 1080, deviceScaleFactor: 1}, checks: []};
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
const output = `recovery/output/browser-home-player-source-page-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}`;
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
  await command('Page.navigate', {url: 'http://127.0.0.1:5415'}, sessionId);
  await ready(sessionId);
  return sessionId;
}
async function launchServer() {
  const from = serverLog.length;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {
    env: {...process.env, PORT: '3365', ACCOUNT_DB_PATH: join(directory, 'accounts.sqlite')}, stdio: ['ignore', 'pipe', 'pipe'],
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
    '--remote-debugging-port=9615', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank',
  ], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9615/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
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
    if (['Inventory', 'Kitbag', 'OwnedRoles', 'RoleProfile', 'DisplayName'].includes(result.service.name)) {
      network.push({index: network.length, page: message.sessionId, direction: received ? 'received' : 'sent', kind: result.type, name: result.service.name,
        ...(result.ret ? {success: result.ret.isSucc, response: result.ret.isSucc ? result.ret.res : result.ret.err} : {payload: result.msg ?? result.req})});
    }
  });
}


try {
  await launchServer();
  vite = await createServer({configFile: false, cacheDir:join(directory,'vite-cache'), root: 'apps/web', publicDir: '../../recovery/output/web-assets', server: {port:5415, strictPort:true, host:'127.0.0.1', hmr:false, proxy:{'/game':{target:'ws://127.0.0.1:3365',ws:true,rewrite:()=> '/'}}}});
  await vite.listen(); await launchBrowser(); const page = await newPage();
  await waitUntil(page, `localStorage.getItem('cdtank-account-token')`);
  const store = new AccountStore(join(directory, 'accounts.sqlite'));
  const owner = store.open(await evaluate(page, `localStorage.getItem('cdtank-account-token')`));
  const record=(instanceId,itemTableId,ownedQuantity)=>({instanceId,itemTableId,ownedQuantity,battleQuantity:0,state:0,field8:0,float24Bits:0,float28Bits:0,float2cBits:0});
  store.replaceInventory(owner.accountId,[record(301,2001,5),record(302,1,3)]);
  await click(page, '[data-room-card-home]');
  await waitUntil(page, `document.querySelector('[data-inventory-instance="301"]')`);
  if (!interactionsOnly) for (const [width,height] of [[800,600],[1920,1080],[3840,2160]]) {
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);
    const scale=Math.min(width/800,height/600);
    await waitUntil(page, `Math.abs(document.querySelector('[data-home-page]').getBoundingClientRect().width-${625}*${scale})<0.2`);
    const state=await evaluate(page, `(()=>{const d=document.querySelector('#home-inventory'),r=d.getBoundingClientRect();return {dialog:{x:r.x,y:r.y,width:r.width,height:r.height},rootControls:[...d.querySelectorAll('[data-source-layout="ui/layouts/myhome.xml"]')].map(e=>e.dataset.sourceControl),frames:d.querySelectorAll('[data-source-frame]').length,sourceTabs:[...d.querySelectorAll('button[data-source-layout="ui/layouts/myhome.xml"]')].length,webNavigation:!!d.querySelector('legend'),inventory:[...d.querySelectorAll('[data-inventory-instance]')].map(e=>e.dataset.inventoryInstance)}})()`);
    assert(state.dialog.x>=0&&state.dialog.y>=0&&state.dialog.x+state.dialog.width<=width+.2&&state.dialog.y+state.dialog.height<=height+.2);
    assert(state.frames >= 20); assert.equal(await evaluate(page, `document.querySelectorAll('.home-player-source-picture').length`),16); assert.equal(await evaluate(page, `document.querySelector('[data-source-control="txtPlayerName"]').textContent`),store.displayName(owner.accountId)); assert(state.rootControls.includes('btnClose')); assert(state.rootControls.includes('rdoPetPage')); assert.equal(state.webNavigation,true);
    await screenshot(page,String(width)); evidence.checks.push({name:'source whole page '+width+'×'+height,scale,state});
  }
  if (!supplementOnly) {
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},page);
  await waitUntil(page, `Math.abs(document.querySelector('[data-home-page]').getBoundingClientRect().width-1125)<.2`);
  await evaluate(page, `new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  await click(page,'[data-inventory-instance="301"]'); assert(await evaluate(page, `Boolean(document.querySelector('[data-inventory-instance="301"]').dataset.sourceAsset)`)); await click(page,'[data-kitbag-slot="1"]');
  await waitUntil(page,`document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId==='301'&&!document.querySelector('[data-kitbag-slot="1"]').disabled`);
  assert.equal(store.inventory(owner.accountId).hotkeys[0],301);
  assert.equal(await evaluate(page,`document.activeElement.dataset.kitbagSlot`),'1');
  await press(page,'Delete','Delete');
  await waitUntil(page,`document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId==='0'&&!document.querySelector('[data-kitbag-slot="1"]').disabled`);
  assert.equal(store.inventory(owner.accountId).hotkeys[0],0);
  await click(page,'[data-source-control="rdoItem"]'); await waitUntil(page,`document.querySelector('[data-inventory-instance="302"]')`);
  await click(page,'[data-inventory-instance="302"]'); await click(page,'[data-kitbag-slot="4"]');
  await waitUntil(page,`document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='302'&&!document.querySelector('[data-kitbag-slot="4"]').disabled`);
  assert.equal(store.inventory(owner.accountId).hotkeys[3],302);
  evidence.checks.push({name:'ordinary selection, weapon ASSIGN/Delete cancel and item ASSIGN; saved authority and slot focus',hotkeys:store.inventory(owner.accountId).hotkeys});
  await click(page,'[data-home-close]'); await waitUntil(page,`!document.querySelector('#home-inventory')`);
  assert.equal(await evaluate(page,`document.activeElement.hasAttribute('data-room-card-home')`),true);
  await click(page,'[data-room-card-home]'); await waitUntil(page,`document.querySelector('[data-inventory-instance="302"]')`);
  await press(page,'Escape','Escape'); await waitUntil(page,`!document.querySelector('#home-inventory')`);
  assert.equal(await evaluate(page,`document.activeElement.hasAttribute('data-room-card-home')`),true);
  evidence.checks.push({name:'source Close and Escape return to lobby home entry focus; item page persists on reopen'});
  for(const kind of ['pet','tank']) {
    await click(page,'[data-room-card-home]'); await waitUntil(page,`document.querySelector('[data-source-control="rdoPetPage"]')&&!document.querySelector('[data-source-control="rdoPetPage"]').disabled`);
    await click(page,kind==='pet'?'[data-source-control="rdoPetPage"]':'[data-source-control="rdoTankPage"]');
    await waitUntil(page,`document.querySelector('#home-roles')?.open&&document.querySelector('[data-role-tab="${kind}"]')?.getAttribute('aria-pressed')==='true'&&!document.querySelector('#home-inventory')`);
    if (!interactionsOnly) await screenshot(page,kind); await click(page,'[data-roles-close]'); await waitUntil(page,`!document.querySelector('#home-roles')`);
    evidence.checks.push({name:'source '+kind+' root tab opens existing account '+kind+' page and returns'});
  }
  }
  if (supplementOnly) {
    for (const [width,height] of [[800,600],[1920,1080],[3840,2160]]) {
      await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);
      const scale=Math.min(width/800,height/600);
      await waitUntil(page,`Math.abs(document.querySelector('[data-home-page]').getBoundingClientRect().width-625*${scale})<.2`);
      const bounds=await evaluate(page,`(()=>{const r=document.querySelector('.home-page-navigation').getBoundingClientRect();return {bottom:r.bottom,x:r.x,right:r.right}})()`);
      assert(bounds.bottom<=height&&bounds.x>=0&&bounds.right<=width);
      await screenshot(page,'footer-'+width);
      evidence.checks.push({name:'changed supplemental footer visible '+width+'×'+height,bounds});
    }
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},page);
    await waitUntil(page,`Math.abs(document.querySelector('[data-home-page]').getBoundingClientRect().width-1125)<.2`);
    await evaluate(page,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const tab='[data-source-control="rdoItem"]';
    const point=await evaluate(page,`(()=>{const r=document.querySelector('${tab}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},page);
    await waitUntil(page,`document.querySelector('${tab}').dataset.sourceButtonState==='Hover'`);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point},page);
    await waitUntil(page,`document.querySelector('${tab}').dataset.sourceButtonState==='Pushed'`);
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point},page);
    await waitUntil(page,`document.querySelector('[data-inventory-instance="302"]')`);
    evidence.checks.push({name:'original item radio Hover/Pushed and selected state by ordinary mouse'});
    const nav=await evaluate(page,`(()=>{const r=document.querySelector('.home-page-navigation-scroll').getBoundingClientRect();return {x:r.x+20,y:r.y+r.height/2}})()`);
    await command('Input.dispatchMouseEvent',{type:'mouseMoved',...nav},page);
    await command('Input.dispatchMouseEvent',{type:'mouseWheel',...nav,deltaX:0,deltaY:130},page);
    await waitUntil(page,`document.querySelector('.home-page-navigation-scroll').scrollTop>0`);
    await click(page,'#open-quick-chat-settings');await waitUntil(page,`document.querySelector('#quick-chat-settings')?.open`);
    await input(page,'#quick-chat-F5','中文快捷内容');
    assert.equal(await evaluate(page,`document.querySelector('#quick-chat-F5').value`),'中文快捷内容');
    await click(page,'#quick-chat-settings-save');await waitUntil(page,`document.querySelector('#quick-chat-settings-status').value==='快捷聊天已保存并生效。'`);
    await click(page,'#quick-chat-settings-cancel');await waitUntil(page,`!document.querySelector('#quick-chat-settings')`);
    assert.equal(await evaluate(page,`document.activeElement.id`),'open-quick-chat-settings');
    await click(page,'[data-home-close]');await waitUntil(page,`!document.querySelector('#home-inventory')`);
    assert.equal(await evaluate(page,`document.activeElement.hasAttribute('data-room-card-home')`),true);
    evidence.checks.push({name:'ordinary supplemental mouse wheel, Chinese quick chat save and nested return focus'});
  }
  evidence.status='PASS'; console.log('PASS source home root whole page and ordinary inventory/navigation');
} catch(error) {evidence.status='FAIL';evidence.error=error.stack??String(error);await screenshot(pages[0]?.sessionId,'failure').catch(()=>{});throw error;
} finally {if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.isolation={server:3365,vite:5415,chrome:9615};evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);}
