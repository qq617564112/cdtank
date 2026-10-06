import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';

const require = createRequire(import.meta.url), WebSocket = require('ws');
const directory = await mkdtemp(join(tmpdir(), 'cdtank-key-settings-'));
const focused = process.argv.includes('--diagnostics');
const output = process.env.CDTANK_KEY_SETTINGS_OUTPUT ?? 'recovery/output/browser-key-settings' + (focused ? '.diagnostics' : '');
const origin = 'http://127.0.0.1:5295', key = 'cdtank.key-bindings.v1';
const evidence = {status: 'RUNNING', isolation: {server: 3265, vite: 5295, chrome: 9495},
  scope: 'Real Chromium 1920x1080 and 3840x2160, CDP native mouse and KeyboardEvent.code, save/conflict/cancel/default restoration, reload/new-page/same-profile restart, ordinary server room CPU/Ready, movement/turn/aim/fire snapshots, held-key/focus/editor/autopilot isolation. Observer only; no world/HP/timer injection.',
  normal: [], diagnostics: [], errors: []};
const contexts = [], pages = [], pending = new Map();
let sequence = 0, server, chrome, vite, ws, serverLog = '';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function stop(child) {
  if (child?.exitCode === null && child?.signalCode === null) {
    const ended = new Promise(resolve => child.once('exit', resolve));
    child.kill(); await ended;
  }
}
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, sessionId}));
  });
}
async function evaluate(session, expression) {
  const result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}, session);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitUntil(session, expression, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {if (await evaluate(session, `Boolean(${expression})`)) return;} catch (error) {
      if (!String(error).includes('Execution context was destroyed')) throw error;
    }
    await pause(50);
  }
  throw new Error('Browser condition timeout: ' + expression);
}
async function click(session, selector) {
  await command('Page.bringToFront', {}, session);
  const point = await evaluate(session, `(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing selector');e.scrollIntoView({block:'center'});await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Control obscured '+e.id);return {x,y}})()`);
  for (const type of ['mousePressed', 'mouseReleased']) await command('Input.dispatchMouseEvent', {type, button: 'left', clickCount: 1, ...point}, session);
  await evaluate(session, 'new Promise(requestAnimationFrame)');
}
async function keyEvent(session, code, type, autoRepeat = false) {
  const key = code.startsWith('Key') ? code.slice(3).toLowerCase() : code.startsWith('Digit') ? code.slice(5) : code === 'Space' ? ' ' : code;
  const vk = code.startsWith('Key') ? code.charCodeAt(3) : code.startsWith('Digit') ? code.charCodeAt(5) : {Space:32,ArrowLeft:37,ArrowRight:39,Escape:27,Home:36,ArrowDown:40,Enter:13}[code];
  await command('Input.dispatchKeyEvent', {type,key,code,windowsVirtualKeyCode:vk,autoRepeat},session);
}
async function press(session, code, milliseconds = 0) {
  await command('Page.bringToFront', {}, session);
  await keyEvent(session, code, 'keyDown'); if (milliseconds) await pause(milliseconds); await keyEvent(session, code, 'keyUp');
}
async function save(session) {await click(session,'#key-settings-save');await click(session,'#key-settings-cancel');}
async function bind(session, action, code) {await click(session, `[data-key-action="${action}"]`);await press(session,code);}
async function screenshot(session, name) {
  const layout=await evaluate(session,`(()=>{const e=document.querySelector('dialog[open]');if(!e)return null;const r=e.getBoundingClientRect();return {viewport:[innerWidth,innerHeight],dialog:[r.x,r.y,r.width,r.height],inputs:e.querySelectorAll('input,button').length};})()`);
  if(layout){const [x,y,w,h]=layout.dialog;assert(w>0&&h>0&&x>=-1&&y>=-1&&x+w<=layout.viewport[0]+1&&y+h<=layout.viewport[1]+1,'Visible settings dialog fits viewport');(evidence.layouts??=[]).push({name,...layout});}

  const shot = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`${output}-${name}.png`, Buffer.from(shot.data, 'base64'));
}
async function newContext() {
  const {browserContextId} = await command('Target.createBrowserContext'); contexts.push(browserContextId); return browserContextId;
}
async function newPage(browserContextId, width = 1920, height = 1080, fixture = '') {
  const {targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  pages.push({targetId, sessionId});
  await command('Runtime.enable', {}, sessionId);
  await command('Page.enable', {}, sessionId);
  await command('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false}, sessionId);
  await command('Page.addScriptToEvaluateOnNewDocument', {source: `window.keyObserved=[];window.keyNetwork=[];window.keyEvents=[];window.settingsCaptureListeners=new Set();for(const method of ['addEventListener','removeEventListener']){const original=window[method];window[method]=function(type,listener,options){if(type==='keydown'&&(options===true||options?.capture)){if(method==='addEventListener')window.settingsCaptureListeners.add(listener);else window.settingsCaptureListeners.delete(listener);}return original.call(this,type,listener,options);};}${fixture}`}, sessionId);
  await command('Page.navigate', {url: origin}, sessionId);
  await ready(sessionId); return sessionId;
}
async function reload(session) {
  const previous=await evaluate(session,'performance.timeOrigin');
  await command('Page.reload',{},session);
  await waitUntil(session,`performance.timeOrigin!==${previous}`);
  await ready(session);
}
async function ready(session) {
  await waitUntil(session, `window.keyBattle&&document.querySelector('#open-key-settings')&&document.querySelector('#tank')?.options.length===21&&!document.querySelector('#create-room').disabled`);
}
const defaults = {forward:'KeyW',backward:'KeyS',turnLeft:'KeyA',turnRight:'KeyD',aimLeft:'ArrowLeft',aimRight:'ArrowRight',fire:'Space',...Object.fromEntries(Array.from({length:8},(_,i)=>['slot'+(i+1),'Digit'+(i+1)]))};
const custom = {...defaults,forward:'KeyI',backward:'KeyK',turnLeft:'KeyJ',turnRight:'KeyL',aimLeft:'KeyU',aimRight:'KeyO',fire:'KeyF',slot5:'KeyH'};
const worldExpression = `JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')`;
async function state(session, storage = true) {return evaluate(session, `({bindings:window.keyBattle.getKeyBindings(),stored:${storage ? `localStorage.getItem('${key}')` : 'null'},status:document.querySelector('#key-settings-status')?.textContent??'',open:document.querySelector('#key-settings')?.open??false,viewport:[innerWidth,innerHeight],setters:window.keyObserved})`);}
async function record(session,name,expected,stored=true) {const row=await state(session);assert.deepEqual(row.bindings,expected);if(stored)assert.deepEqual(JSON.parse(row.stored),expected);evidence.normal.push({name,...row});return row;}
async function world(session){return evaluate(session,worldExpression);}
async function local(session){return evaluate(session,`(()=>{const w=${worldExpression};return w.players.find(p=>p.id===w.playerId)})()`);}
async function inputs(session){return evaluate(session,'window.keyNetwork');}
async function clearInputs(session){await evaluate(session,'window.keyNetwork=[]');}
async function expectNeutral(session,name,selector,code){await click(session,selector);await clearInputs(session);await press(session,code,250);const rows=await inputs(session);assert(rows.length>0);assert(rows.every(r=>!r.move&&!r.turn&&!r.aim&&!r.fire&&!r.useItem),name);evidence.normal.push({name,inputs:rows});}
async function launchBrowser() {
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',
    ['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9495',`--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9495/json/version')).json()).webSocketDebuggerUrl;break;}catch{await pause(50);}}
  assert(endpoint,'Dedicated Chromium failed to start');ws=new WebSocket(endpoint);await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  ws.on('close',()=>{for(const p of pending.values())p.reject(new Error('CDP closed'));pending.clear();});
  ws.on('message',raw=>{const m=JSON.parse(String(raw)),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')evidence.errors.push(m.params.exceptionDetails);});
}
try {
  server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:'3265',ACCOUNT_DB_PATH:join(directory,'accounts.sqlite')},stdio:['ignore','pipe','pipe']});
  const append=data=>{serverLog+=String(data);};server.stdout.on('data',append);server.stderr.on('data',append);
  const deadline=Date.now()+15000;while(!serverLog.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await pause(20);assert(serverLog.includes('Server started'),serverLog);
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'key-browser-observer',transform(source,id){if(!id.endsWith('/src/match/battle.ts'))return;return source+`\nconst originalGet=Battle.prototype.getKeyBindings;Battle.prototype.getKeyBindings=function(){window.keyBattle=this;return originalGet.call(this);};const originalKeys=Battle.prototype.setKeyBindings;Battle.prototype.setKeyBindings=function(value){window.keyBattle=this;window.keyObserved.push({...value});if(!this.client.keyObserver){this.client.keyObserver=true;this.client.listenMsg('RoomEvent',event=>window.keyEvents.push(event));const originalSend=this.client.sendMsg;this.client.sendMsg=function(name,message,...rest){if(name==='PlayerInput')window.keyNetwork.push({...message});return originalSend.call(this,name,message,...rest);};}return originalKeys.call(this,value);};\n`;}}],server:{port:5295,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3265',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  await launchBrowser();const hd=await newPage(undefined);await record(hd,'fresh-defaults',defaults,false);
  const closedListeners=await evaluate(hd,'window.settingsCaptureListeners.size');
  await click(hd,'#open-key-settings');
  const openListeners=await evaluate(hd,'window.settingsCaptureListeners.size');assert.equal(openListeners,closedListeners+1);
  await click(hd,'[data-key-action="forward"]');await keyEvent(hd,'KeyP','keyDown',true);await keyEvent(hd,'KeyP','keyUp');
  assert.equal(await evaluate(hd,`document.querySelector('[data-key-action="forward"]').getAttribute("aria-pressed")`),'true');
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'p',code:'KeyP',windowsVirtualKeyCode:80,modifiers:2},hd);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'p',code:'KeyP',windowsVirtualKeyCode:80,modifiers:2},hd);
  assert((await state(hd)).status.includes('组合键'));
  await press(hd,'Tab');assert.equal(await evaluate(hd,`document.querySelector('[data-key-action="forward"]').getAttribute("aria-pressed")`),'false');
  await click(hd,'#key-settings-cancel');assert.equal(await evaluate(hd,'window.settingsCaptureListeners.size'),closedListeners);
  await click(hd,'#open-key-settings');assert.equal(await evaluate(hd,'window.settingsCaptureListeners.size'),openListeners);
  await click(hd,'#key-settings-cancel');assert.equal(await evaluate(hd,'window.settingsCaptureListeners.size'),closedListeners);
  evidence.normal.push({name:'repeat-modifier-tab-capture-isolation-and-close-reopen-listener-cleanup',closedListeners,openListeners});
  await click(hd,'#open-key-settings');for(const [action,code] of Object.entries(custom))if(code!==defaults[action])await bind(hd,action,code);
  if (!focused) {await screenshot(hd,'1080p');await save(hd);await record(hd,'native-remap-saved',custom);
  await click(hd,'#open-key-settings');await bind(hd,'forward','KeyK');
  const conflict=await state(hd);assert(conflict.open);assert(conflict.status.length>0);assert.deepEqual(conflict.bindings,custom);evidence.normal.push({name:'duplicate-refused',...conflict});
  await click(hd,'#key-settings-cancel');await record(hd,'conflict-cancel',custom);
  await click(hd,'#open-key-settings');await bind(hd,'forward','KeyP');await click(hd,'#key-settings-cancel');await record(hd,'draft-cancel',custom);
  await reload(hd);await record(hd,'refresh-restores',custom);
  const uhd=await newPage(undefined,3840,2160);await record(uhd,'new-page-4k-restores',custom);await click(uhd,'#open-key-settings');await screenshot(uhd,'4k');await command('Target.closeTarget',{targetId:pages.at(-1).targetId});
  await click(hd,'#open-key-settings');await click(hd,'#key-settings-defaults');assert.deepEqual((await state(hd)).bindings,custom);await save(hd);await record(hd,'defaults-saved',defaults);
  await click(hd,'#open-key-settings');for(const [action,code] of Object.entries(custom))if(code!==defaults[action])await bind(hd,action,code);await save(hd);
  } else {await save(hd);}
  const store=new AccountStore(join(directory,'accounts.sqlite'));
  try {
    const owner=store.open(await evaluate(hd,"localStorage.getItem('cdtank-account-token')"));
    const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(row=>row.tankId===1&&row.part===0);
    const fields=value=>new Map(Object.entries(value).map(([key,value])=>[Number(key),value]));
    const equipment={name:'明确导入原战车',fields:fields(native.equipment)},base={name:'明确导入原宠物',fields:fields(native.base)};
    equipment.fields.set(0x1c,72);equipment.fields.set(0x24,1);equipment.fields.set(0x28,10011);equipment.fields.set(0x2c,10012);equipment.fields.set(0x30,10013);
    store.replaceRoleRecords(owner.accountId,{base:[base],equipment:[equipment]});
    const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa8,72,true);view.setUint32(0xa4,base.fields.get(0),true);
    store.replaceRoleProfile(owner.accountId,{bytes,strings:['','']});
    evidence.fixture={native:'world-role-attributes-native.json tank1 part0',ownedInstance:72,profileTankOffset:0xa8,profilePetOffset:0xa4,scope:'Explicit source-backed owned account fixture before ordinary room creation; no combat pose/HP/result injected.'};
  } finally {store.close();}
  if(!await evaluate(hd,`document.querySelector('#create-room-controls').open`))await click(hd,'#create-room-controls summary');await click(hd,'#room-mode');await press(hd,'Home');for(let i=0;i<3;i++)await press(hd,'ArrowDown');await press(hd,'Enter');await waitUntil(hd,`[...document.querySelector('#room-map').options].some(o=>o.value==='7')`);const mapIndex=await evaluate(hd,`[...document.querySelector('#room-map').options].findIndex(o=>o.value==='7')`);await click(hd,'#room-map');await press(hd,'Home');for(let i=0;i<mapIndex;i++)await press(hd,'ArrowDown');await press(hd,'Enter');await click(hd,'#create-room');
  await waitUntil(hd,`(${worldExpression})?.mapLoaded&&!document.querySelector('#leave').hidden&&!document.querySelector('[data-add-cpu]').disabled`);
  for(let i=0;i<3;i++){await click(hd,'[data-add-cpu]');await waitUntil(hd,`(${worldExpression}).players.length===${i+2}`);}
  await waitUntil(hd,`(${worldExpression}).renderedPlayers===4&&window.keyBattle.players.resourcesReady`,120000);await click(hd,'[data-ready]');await waitUntil(hd,`(${worldExpression})?.phase==='PLAYING'&&(${worldExpression}).players.find(p=>p.id===(${worldExpression}).playerId).alive`);
  evidence.normal.push({name:'ordinary-room-cpu-ready',world:await world(hd)});
  if (!focused) {await click(hd,'#world');await clearInputs(hd);let before=await local(hd);await press(hd,'KeyI',400);let after=await local(hd);let rows=await inputs(hd);assert(rows.some(r=>r.move===1));assert(Math.hypot(after.x-before.x,after.z-before.z)>.1);evidence.normal.push({name:'I-server-movement',before,after,inputs:rows});
  await pause(100);await clearInputs(hd);before=await local(hd);await press(hd,'KeyW',250);after=await local(hd);rows=await inputs(hd);assert(rows.every(r=>r.move===0));assert(Math.hypot(after.x-before.x,after.z-before.z)<.001);evidence.normal.push({name:'old-W-idle',before,after,inputs:rows});
  for(const [code,field,pose,expected] of [['KeyK','move','x',-1],['KeyJ','turn','yaw',1],['KeyL','turn','yaw',-1],['KeyU','aim','aim',1],['KeyO','aim','aim',-1]]){
    await clearInputs(hd);before=await local(hd);await press(hd,code,300);after=await local(hd);rows=await inputs(hd);assert(rows.some(r=>r[field]===expected));if(field==='turn'||field==='aim')assert.notEqual(after[pose],before[pose]);evidence.normal.push({name:`${code}-server-${field}`,before,after,inputs:rows});
  }
  await clearInputs(hd);before=await local(hd);await press(hd,'KeyF',700);after=await local(hd);rows=await inputs(hd);assert(rows.some(r=>r.fire));assert(after.reload.startedAt>before.reload.startedAt);evidence.normal.push({name:'F-server-fire',before,after,inputs:rows,world:await world(hd)});
  }
  await click(hd,'#world');await clearInputs(hd);await evaluate(hd,'window.keyEvents=[]');await keyEvent(hd,'KeyH','keyDown');await keyEvent(hd,'KeyH','keyDown',true);await keyEvent(hd,'KeyH','keyUp');await pause(250);let rows=await inputs(hd);assert.equal(rows.filter(r=>r.useItem===5).length,1);evidence.normal.push({name:'H-slot5-single-request-repeat-suppressed',inputs:rows,events:await evaluate(hd,'window.keyEvents')});await clearInputs(hd);await press(hd,'Digit5');await pause(200);rows=await inputs(hd);assert(rows.every(r=>r.useItem===0));evidence.normal.push({name:'old-Digit5-idle',inputs:rows});
  if (!focused) {
  await expectNeutral(hd,'focused-chat-isolated','[data-chat-input]','KeyI');await expectNeutral(hd,'focused-button-isolated','#open-key-settings','KeyF');await click(hd,'#key-settings-cancel');
  await click(hd,'#world');await keyEvent(hd,'KeyI','keyDown');await pause(150);await click(hd,'#open-key-settings');await clearInputs(hd);await press(hd,'KeyF',200);rows=await inputs(hd);assert(rows.every(r=>!r.move&&!r.fire));await keyEvent(hd,'KeyI','keyUp');evidence.normal.push({name:'editor-clears-held-and-isolates',inputs:rows});await click(hd,'#key-settings-cancel');
  await click(hd,'[data-autopilot]');await waitUntil(hd,`(${worldExpression}).players.find(p=>p.id===(${worldExpression}).playerId).isAutopilot`);await click(hd,'#world');await clearInputs(hd);await press(hd,'KeyI',250);await press(hd,'KeyH');rows=await inputs(hd);assert.deepEqual(rows,[]);evidence.normal.push({name:'autopilot-manual-isolated',world:await world(hd),inputs:rows});
  await click(hd,'[data-autopilot]');await waitUntil(hd,`!(${worldExpression}).players.find(p=>p.id===(${worldExpression}).playerId).isAutopilot`);} await click(hd,'#leave');await waitUntil(hd,`!(${worldExpression})`);
  if (!focused) {ws.close();await stop(chrome);await launchBrowser();const reopened=await newPage(undefined);await record(reopened,'chromium-restart-same-profile',custom);await click(reopened,'#open-key-settings');await screenshot(reopened,'reopened');}
  const malformed=await newPage(await newContext(),1920,1080,`localStorage.setItem('${key}','{broken');`);await click(malformed,'#open-key-settings');let diagnostic=await state(malformed);assert.deepEqual(diagnostic.bindings,defaults);assert(diagnostic.status.includes('无法读取'));evidence.diagnostics.push({fixture:'Malformed browser-local JSON before page load',...diagnostic});await click(malformed,'#key-settings-cancel');
  const duplicate=await newPage(await newContext(),1920,1080,`localStorage.setItem('${key}',JSON.stringify(${JSON.stringify({...custom,backward:'KeyI'})}));`);await click(duplicate,'#open-key-settings');diagnostic=await state(duplicate);assert.deepEqual(diagnostic.bindings,defaults);assert(diagnostic.status.includes('无效'));evidence.diagnostics.push({fixture:'Duplicate forward/backward in saved browser-local bindings',...diagnostic});await click(duplicate,'#key-settings-cancel');
  const denied=await newPage(await newContext(),1920,1080,`for(const method of ['getItem','setItem']){const original=Storage.prototype[method];Storage.prototype[method]=function(name,...args){if(name==='${key}')throw new DOMException('Fixture storage disabled','SecurityError');return original.call(this,name,...args);};}`);await click(denied,'#open-key-settings');diagnostic=await state(denied,false);assert.deepEqual(diagnostic.bindings,defaults);assert(diagnostic.status.includes('无法读取'));evidence.diagnostics.push({fixture:'Only key-settings Storage reads/writes denied; account storage remains real',...diagnostic});await bind(denied,'forward','KeyP');await click(denied,'#key-settings-save');diagnostic=await state(denied,false);assert.deepEqual(diagnostic.bindings,defaults);assert(diagnostic.status.includes('无法保存'));assert.deepEqual(diagnostic.setters,[defaults]);evidence.diagnostics.push({fixture:'Native draft/save with denied storage keeps active bindings unchanged',...diagnostic});await screenshot(denied,'storage-disabled');
  assert.deepEqual(evidence.errors,[]);evidence.status='PASS';evidence.runMode=focused?'additional-shortcut-and-storage-diagnostics':'full';await rm(`${output}-failure.png`,{force:true});console.log(focused ? 'PASS: native H repeat suppression, old Digit5 idle, ordinary empty-inventory shortcut dispatch, malformed/conflicting/denied localStorage and failed-save active bindings' : 'PASS: native key editor, conflicts/cancel/defaults, 1080p/4K and profile persistence, real server movement/turn/aim/fire, old-key/focus/editor/autopilot isolation, shortcut/storage diagnostics');
} catch(error){evidence.status='FAIL';evidence.error=String(error);if(pages[0]){evidence.failure=await state(pages[0].sessionId).catch(()=>null);evidence.failureWorld=await world(pages[0].sessionId).catch(()=>null);await screenshot(pages[0].sessionId,'failure').catch(()=>{});}throw error;
} finally {
  if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};
  await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);
}
