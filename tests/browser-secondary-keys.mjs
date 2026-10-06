import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';

const require = createRequire(import.meta.url), WebSocket = require('ws');
const directory = await mkdtemp(join(tmpdir(), 'cdtank-secondary-keys-'));

const output = process.env.CDTANK_SECONDARY_KEYS_OUTPUT ?? 'recovery/output/browser-secondary-keys';
const origin = 'http://127.0.0.1:5296', key = 'cdtank.key-bindings.v1';
const evidence = {status: 'RUNNING', isolation: {server: 3266, vite: 5296, chrome: 9496},
  scope: 'Real Chromium 1920x1080 and 3840x2160, CDP native mouse and KeyboardEvent.code, secondary save/primary-conflict/secondary-conflict/clear/cancel/default restoration, legacy primary-only custom JSON, reload/new-page/same-profile restart, ordinary mode4/map7 server room with three CPU and Ready, primary+secondary server movement/held-release/fire snapshots, slot5 repeat suppression, focus/editor/autopilot isolation. Observer only; no world/HP/timer injection.',
  normal: [], errors: []};
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
async function bind(session, action, code) {await click(session, `[data-secondary-key-action="${action}"]`);await press(session,code);}
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
  await command('Page.addScriptToEvaluateOnNewDocument', {source: `window.keyObserved=[];window.keyNetwork=[];window.keyEvents=[];${fixture}`}, sessionId);
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
const legacyDefaults = {...defaults,forward:'KeyP'};
const custom = {...defaults,secondary:{forward:'KeyI',fire:'KeyF',slot5:'KeyH'}};
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
    ['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9496',`--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9496/json/version')).json()).webSocketDebuggerUrl;break;}catch{await pause(50);}}
  assert(endpoint,'Dedicated Chromium failed to start');ws=new WebSocket(endpoint);await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  ws.on('close',()=>{for(const p of pending.values())p.reject(new Error('CDP closed'));pending.clear();});
  ws.on('message',raw=>{const m=JSON.parse(String(raw)),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')evidence.errors.push(m.params.exceptionDetails);});
}
try {
  server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:{...process.env,PORT:'3266',ACCOUNT_DB_PATH:join(directory,'accounts.sqlite')},stdio:['ignore','pipe','pipe']});
  const append=data=>{serverLog+=String(data);};server.stdout.on('data',append);server.stderr.on('data',append);
  const deadline=Date.now()+15000;while(!serverLog.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await pause(20);assert(serverLog.includes('Server started'),serverLog);
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'key-browser-observer',transform(source,id){if(!id.endsWith('/src/match/battle.ts'))return;return source+`\nconst originalGet=Battle.prototype.getKeyBindings;Battle.prototype.getKeyBindings=function(){window.keyBattle=this;return originalGet.call(this);};const originalKeys=Battle.prototype.setKeyBindings;Battle.prototype.setKeyBindings=function(value){window.keyBattle=this;window.keyObserved.push({...value});if(!this.client.keyObserver){this.client.keyObserver=true;this.client.listenMsg('RoomEvent',event=>window.keyEvents.push(event));const originalSend=this.client.sendMsg;this.client.sendMsg=function(name,message,...rest){if(name==='PlayerInput')window.keyNetwork.push({...message});return originalSend.call(this,name,message,...rest);};}return originalKeys.call(this,value);};\n`;}}],server:{port:5296,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3266',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  await launchBrowser();const hd=await newPage(undefined);await record(hd,'fresh-defaults',defaults,false);
  const legacy=await newPage(await newContext(),1920,1080,`localStorage.setItem('${key}',JSON.stringify(${JSON.stringify(legacyDefaults)}));`);
  await record(legacy,'legacy-primary-only-custom-compatible',legacyDefaults);
  await command('Target.closeTarget',{targetId:pages.at(-1).targetId});
  await click(hd,'#open-key-settings');for(const [action,code] of Object.entries(custom.secondary))await bind(hd,action,code);
  await screenshot(hd,'1080p');await save(hd);await record(hd,'secondary-saved-primary-retained',custom);
  for (const code of ['KeyA','KeyF']) {
    await click(hd,'#open-key-settings');await bind(hd,'forward',code);
    const conflict=await state(hd);assert(conflict.open);assert(conflict.status.length>0);assert.deepEqual(conflict.bindings,custom);
    await press(hd,'Escape');
    assert((await evaluate(hd,`document.querySelector('[data-secondary-key-action="forward"]').textContent.trim()`)).endsWith('I'));
    evidence.normal.push({name:code==='KeyA'?'primary-conflict-refused':'secondary-conflict-refused',...conflict});
    await save(hd);await record(hd,'conflict-save-retains-binding-'+code,custom);
  }
  await click(hd,'#open-key-settings');await bind(hd,'forward','KeyP');await click(hd,'#key-settings-cancel');await record(hd,'draft-cancel',custom);
  await click(hd,'#open-key-settings');await click(hd,'[data-clear-secondary="forward"]');await save(hd);
  await record(hd,'clear-secondary-preserves-primary-and-other-secondary',{...defaults,secondary:{fire:'KeyF',slot5:'KeyH'}});
  await click(hd,'#open-key-settings');await bind(hd,'forward','KeyI');await save(hd);
  await reload(hd);await record(hd,'refresh-restores',custom);
  const uhd=await newPage(undefined,3840,2160);await record(uhd,'new-page-4k-restores',custom);await click(uhd,'#open-key-settings');await screenshot(uhd,'4k');await command('Target.closeTarget',{targetId:pages.at(-1).targetId});
  await click(hd,'#open-key-settings');await click(hd,'#key-settings-defaults');assert.deepEqual((await state(hd)).bindings,custom);await save(hd);await record(hd,'defaults-remove-all-secondary',defaults);
  await click(hd,'#open-key-settings');for(const [action,code] of Object.entries(custom.secondary))await bind(hd,action,code);await save(hd);
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
  await click(hd,'#world');
  for (const code of ['KeyW','KeyI']) {
    await clearInputs(hd);const before=await local(hd);await press(hd,code,400);const after=await local(hd), rows=await inputs(hd);
    assert(rows.some(r=>r.move===1));assert(Math.hypot(after.x-before.x,after.z-before.z)>.1);
    evidence.normal.push({name:`${code}-server-movement`,before,after,inputs:rows});
  }
  await clearInputs(hd);await keyEvent(hd,'KeyW','keyDown');await keyEvent(hd,'KeyI','keyDown');await pause(180);
  let rows=await inputs(hd);assert(rows.length>0);assert(rows.every(r=>r.move===1));evidence.normal.push({name:'both-forward-keys-held',inputs:rows});
  await clearInputs(hd);await keyEvent(hd,'KeyW','keyUp');await pause(180);rows=await inputs(hd);assert(rows.length>0);assert(rows.every(r=>r.move===1));evidence.normal.push({name:'release-primary-keeps-secondary-held',inputs:rows});
  await clearInputs(hd);await keyEvent(hd,'KeyI','keyUp');await pause(180);rows=await inputs(hd);assert(rows.length>0);assert(rows.every(r=>r.move===0));evidence.normal.push({name:'release-both-neutral',inputs:rows});
  await clearInputs(hd);const before=await local(hd);await press(hd,'KeyF',700);const after=await local(hd);rows=await inputs(hd);assert(rows.some(r=>r.fire));assert(after.reload.startedAt>before.reload.startedAt);evidence.normal.push({name:'secondary-F-real-server-fire',before,after,inputs:rows});
  await click(hd,'#world');await clearInputs(hd);await evaluate(hd,'window.keyEvents=[]');await keyEvent(hd,'KeyH','keyDown');await keyEvent(hd,'KeyH','keyDown',true);await keyEvent(hd,'KeyH','keyUp');await pause(250);rows=await inputs(hd);assert.equal(rows.filter(r=>r.useItem===5).length,1);evidence.normal.push({name:'H-slot5-single-request-repeat-suppressed',inputs:rows,events:await evaluate(hd,'window.keyEvents')});await clearInputs(hd);await press(hd,'Digit5');await pause(200);rows=await inputs(hd);assert.equal(rows.filter(r=>r.useItem===5).length,1);evidence.normal.push({name:'primary-Digit5-retained',inputs:rows});
  await expectNeutral(hd,'focused-chat-isolated','[data-chat-input]','KeyI');await expectNeutral(hd,'focused-button-isolated','#open-key-settings','KeyF');await click(hd,'#key-settings-cancel');
  await click(hd,'#world');await keyEvent(hd,'KeyI','keyDown');await pause(150);await click(hd,'#open-key-settings');await clearInputs(hd);await press(hd,'KeyF',200);rows=await inputs(hd);assert(rows.every(r=>!r.move&&!r.fire));await keyEvent(hd,'KeyI','keyUp');evidence.normal.push({name:'editor-clears-held-and-isolates',inputs:rows});await click(hd,'#key-settings-cancel');
  await click(hd,'[data-autopilot]');await waitUntil(hd,`(${worldExpression}).players.find(p=>p.id===(${worldExpression}).playerId).isAutopilot`);await click(hd,'#world');await clearInputs(hd);await press(hd,'KeyI',250);await press(hd,'KeyH');rows=await inputs(hd);assert.deepEqual(rows,[]);evidence.normal.push({name:'autopilot-manual-isolated',world:await world(hd),inputs:rows});
  await click(hd,'[data-autopilot]');await waitUntil(hd,`!(${worldExpression}).players.find(p=>p.id===(${worldExpression}).playerId).isAutopilot`); await click(hd,'#leave');await waitUntil(hd,`!(${worldExpression})`);
  ws.close();await stop(chrome);await launchBrowser();const reopened=await newPage(undefined);await record(reopened,'chromium-restart-same-profile',custom);await click(reopened,'#open-key-settings');await screenshot(reopened,'reopened');
  assert.deepEqual(evidence.errors,[]);evidence.status='PASS';await rm(`${output}-failure.png`,{force:true});console.log('PASS: secondary editor/save/conflicts/clear/cancel/defaults, 1080p/4K/profile persistence, real primary+secondary movement/held-release/fire/slot, focus/editor/autopilot isolation');
} catch(error){evidence.status='FAIL';evidence.error=String(error);if(pages[0]){evidence.failure=await state(pages[0].sessionId).catch(()=>null);evidence.failureWorld=await world(pages[0].sessionId).catch(()=>null);await screenshot(pages[0].sessionId,'failure').catch(()=>{});}throw error;
} finally {
  if(ws?.readyState===WebSocket.OPEN)ws.close();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};
  await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);
}
