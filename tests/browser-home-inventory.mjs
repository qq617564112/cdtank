import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
const require = createRequire(import.meta.url), WebSocket = require('ws');
const endpoint = process.argv[2];
if (!endpoint) throw new Error('Usage: node --import tsx tests/browser-home-inventory.mjs <CDP WebSocket>');
const directory = await mkdtemp(join(tmpdir(), 'cdtank-home-'));
const database = join(directory, 'accounts.sqlite');
let server;
let serverLog = '';
const outputPrefix = process.env.CDTANK_INVENTORY_OUTPUT ?? 'recovery/output/browser-home-inventory';
async function start() {
  let log='';
  server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],
    {env:{...process.env,PORT:'3131',ACCOUNT_DB_PATH:database},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',data=>{log+=String(data);serverLog+=String(data);});server.stderr.on('data',data=>{log+=String(data);serverLog+=String(data);});
  const deadline=Date.now()+15000;
  while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
}
async function stop() {
  if(server?.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
}
await start();
const vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',
  server:{port:5190,host:'127.0.0.1',proxy:{'/game':{target:'ws://127.0.0.1:3131',ws:true,rewrite:()=> '/'}}}});
await vite.listen();
const ws=new WebSocket(endpoint);
await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
let sequence = 0;
const sentFrames=[];
const pending = new Map();
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  if(message.method==='Network.webSocketFrameSent')sentFrames.push({session:message.sessionId,response:message.params.response});
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
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
let lastCondition;
async function waitUntil(session, expression) {
  lastCondition=expression;
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      return await evaluate(session, `(async()=>{const deadline=Date.now()+45000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed') && !String(error).includes('Inspected target navigated')) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Page navigation timeout');
}

async function point(session, selector) {
  return evaluate(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
}
async function click(session, selector, button = 'left') {
  const p = await point(session, selector);
  await command('Input.dispatchMouseEvent', {type:'mouseMoved', ...p}, session);
  await command('Input.dispatchMouseEvent', {type:'mousePressed', ...p, button, clickCount:1}, session);
  await command('Input.dispatchMouseEvent', {type:'mouseReleased', ...p, button, clickCount:1}, session);
}
async function key(session, key, code, windowsVirtualKeyCode) {
  await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode},session);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode},session);
}
async function select(session, selector, value) {
  const steps = await evaluate(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});return Array.from(e.options).findIndex(o=>o.value===${JSON.stringify(value)});})()`);
  assert(steps >= 0, `${selector}: option ${value}`);
  await click(session, selector);
  await key(session, 'Home', 'Home', 36);
  for(let i=0;i<steps;i++) await key(session,'ArrowDown','ArrowDown',40);
  await key(session,'Enter','Enter',13);
  await waitUntil(session, `document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(value)}`);
}
async function assign(session, instance, slot) {
  await click(session, `[data-inventory-instance="${instance}"]`);
  await waitUntil(session, `document.querySelector('[data-inventory-instance="${instance}"]').getAttribute('aria-pressed')==='true'`);
  await click(session, `[data-kitbag-slot="${slot}"]`);
  await waitUntil(session, `document.querySelector('[data-kitbag-slot="${slot}"]').dataset.instanceId==='${instance}' && document.querySelector('#home-inventory output').value==='快捷槽已保存'`);
}
async function drag(session, source, target) {
  const from = await point(session, source), to = await point(session, target);
  await command('Input.setInterceptDrags',{enabled:true},session);
  const intercepted = new Promise(resolve => {
    const handler = raw => {const message=JSON.parse(String(raw));if(message.sessionId===session && message.method==='Input.dragIntercepted'){ws.off('message',handler);resolve(message.params.data);}};
    ws.on('message',handler);
  });
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...from},session);
  await command('Input.dispatchMouseEvent',{type:'mousePressed',...from,button:'left',buttons:1,clickCount:1},session);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:from.x+12,y:from.y+12,button:'left',buttons:1},session);
  const data = await Promise.race([intercepted,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Native drag did not start')),5000))]);
  for(const type of ['dragEnter','dragOver','drop']) await command('Input.dispatchDragEvent',{type,...to,data},session);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',...to,button:'left',clickCount:1},session);
  await command('Input.setInterceptDrags',{enabled:false},session);
}
const contexts=[], pages=[];
const evidence={status:'PASS',scope:'React inventory pane with original source images/layout, real CDP mouse/keyboard/native drag, authoritative configuration/cancel/rejection, pending and close/reopen isolation, separate account, refresh/restart persistence and ordinary Digit2 ammo. Combat rendering reduced; existing E-R01 covers two natural rounds and dual-page item effects.',sizes:[]};
try {
  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5190',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#tank')?.options.length===21 && localStorage.getItem('cdtank-account-token')`);
  }
  const session=pages[0].sessionId, guest=pages[1].sessionId;
  const token=await evaluate(session,`localStorage.getItem('cdtank-account-token')`);
  const store=new AccountStore(database), owner=store.open(token);
  const record=(instanceId,itemTableId,ownedQuantity)=>({instanceId,itemTableId,ownedQuantity,battleQuantity:0,state:0,
    field8:0,float24Bits:0,float28Bits:0,float2cBits:0});
  store.replaceInventory(owner.accountId,[record(301,2001,5),record(302,1,3)]);
  await click(session,'#open-home');
  await waitUntil(session,`document.querySelector('[data-inventory-instance="301"]')`);
  await assign(session,301,1);
  await waitUntil(session,`document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId==='301' && document.querySelector('#home-inventory output').value==='快捷槽已保存'`);
  assert.equal(store.inventory(owner.accountId).hotkeys[0],301);
  await click(session,'[data-source-control="rdoItem"]');
  await waitUntil(session,`document.querySelector('[data-inventory-instance="302"]')`);
  await assign(session,302,4);
  await waitUntil(session,`document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='302'`);
  assert.equal(store.inventory(owner.accountId).hotkeys[3],302);
  const slots=await evaluate(session,`Array.from(document.querySelectorAll('.home-slot')).map(b=>({slot:Number(b.dataset.kitbagSlot),asset:b.dataset.sourceAsset,count:b.textContent,rect:{x:b.getBoundingClientRect().x,y:b.getBoundingClientRect().y,w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}}))`);
  assert.deepEqual(slots.map(s=>s.slot),[4,5,6,7]);assert.equal(slots[0].count,'3');assert(slots[0].asset);
  for(const [width,height] of [[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
    await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const state=await evaluate(session,`(()=>{const d=document.querySelector('#home-inventory').getBoundingClientRect();const b=document.querySelector('.home-slot').getBoundingClientRect();return {dialog:{x:d.x,y:d.y,w:d.width,h:d.height},cell:{w:b.width,h:b.height},sourceImages:Array.from(document.querySelectorAll('#home-inventory [data-source-asset]')).map(e=>e.dataset.sourceAsset)}})()`);
    assert(state.dialog.x>=0 && state.dialog.y>=0 && state.dialog.x+state.dialog.w<=width && state.dialog.y+state.dialog.h<=height);
    assert(Math.abs(state.cell.w-32*Math.min(width/800,height/600))<.2);
    for(const asset of state.sourceImages)assert(await evaluate(session,`fetch('/'+${JSON.stringify(asset)}).then(r=>r.ok)`));
    const screenshot=await command('Page.captureScreenshot',{format:'png'},session);
    await writeFile(`${outputPrefix}-${width}.png`,Buffer.from(screenshot.data,'base64'));
    evidence.sizes.push({width,height,...state});
  }
  await click(session,'[data-kitbag-slot="4"]');
  await waitUntil(session,`!document.querySelector('[data-kitbag-slot="4"]').disabled && document.querySelector('#home-inventory output').value==='快捷槽已保存'`);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Delete',code:'Delete',windowsVirtualKeyCode:46},session);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Delete',code:'Delete',windowsVirtualKeyCode:46},session);
  await waitUntil(session,`document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='0'`);
  assert.equal(store.inventory(owner.accountId).hotkeys[3],0);
  await assign(session,302,4);
  await click(session,'[data-kitbag-slot="4"]','right');
  await waitUntil(session,`document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='0'`);
  await drag(session,'[data-inventory-instance="302"]','[data-kitbag-slot="4"]');
  await waitUntil(session,`document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='302'`);
  await click(session,'[data-kitbag-slot="4"]');
  await waitUntil(session,`!document.querySelector('[data-kitbag-slot="4"]').disabled && document.querySelector('#home-inventory output').value==='快捷槽已保存'`);
  await key(session,'Backspace','Backspace',8);
  await waitUntil(session,`document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='0'`);
  await assign(session,302,4);
  await key(session,'Escape','Escape',27);
  await waitUntil(session,`!document.querySelector('#home-inventory[open]') && document.activeElement?.id==='open-home'`);
  await click(session,'#open-home');
  await waitUntil(session,`document.querySelector('[data-source-control="rdoWeapon"]') && !document.querySelector('[data-source-control="rdoWeapon"]').disabled`);
  await click(session,'[data-source-control="rdoWeapon"]');
  await waitUntil(session,`document.querySelector('[data-inventory-instance="301"]')`);
  await click(session,'[data-inventory-instance="301"]');
  await waitUntil(session,`document.querySelector('[data-inventory-instance="301"]').getAttribute('aria-pressed')==='true'`);
  server.kill('SIGSTOP');
  try {
    const sentBefore = sentFrames.filter(frame=>frame.session===session).length;
    await click(session,'[data-kitbag-slot="2"]');
    await waitUntil(session,`document.querySelector('#home-inventory output').value==='保存快捷槽…'`);
    await click(session,'[data-kitbag-slot="3"]');
    assert.equal(sentFrames.filter(frame=>frame.session===session).length-sentBefore,1,'Pending repeat must send only one request');
    assert.equal(await evaluate(session,`document.querySelector('[data-kitbag-slot="2"]').dataset.instanceId`),'0');
    await key(session,'Escape','Escape',27);
    await waitUntil(session,`!document.querySelector('#home-inventory[open]')`);
    await click(session,'#open-home');
    await waitUntil(session,`document.querySelector('#home-inventory output').value==='载入物品…'`);
    server.kill('SIGCONT');
    await waitUntil(session,`document.querySelector('[data-inventory-instance="301"]') && document.querySelector('[data-kitbag-slot="2"]').dataset.instanceId==='301'`);
    assert.equal(await evaluate(session,`document.querySelector('[data-inventory-instance="301"]').getAttribute('aria-pressed')`),'false');
    assert.notEqual(await evaluate(session,`document.querySelector('#home-inventory output').value`),'快捷槽已保存','Late old mutation must not overwrite reopened session status');
    assert.equal(store.inventory(owner.accountId).hotkeys[2],0,'Repeated second slot must stay empty');
  } finally {server.kill('SIGCONT');}
  await click(session,'[data-inventory-instance="301"]');
  await waitUntil(session,`document.querySelector('[data-inventory-instance="301"]').getAttribute('aria-pressed')==='true'`);
  const beforeRejected = store.inventory(owner.accountId).hotkeys;
  await stop();
  await click(session,'[data-kitbag-slot="3"]');
  await waitUntil(session,`document.querySelector('#home-inventory output').value!=='保存快捷槽…' && !document.querySelector('[data-kitbag-slot="3"]').disabled`);
  assert.deepEqual(store.inventory(owner.accountId).hotkeys,beforeRejected);
  assert.equal(await evaluate(session,`document.querySelector('[data-kitbag-slot="3"]').dataset.instanceId`),'0');
  assert.equal(await evaluate(session,`document.querySelector('[data-inventory-instance="301"]').getAttribute('aria-pressed')`),'true');
  evidence.rejectionStatus=await evaluate(session,`document.querySelector('#home-inventory output').value`);
  await start();
  evidence.mouseRightCancel=true;evidence.backspaceCancel=true;evidence.nativeDrag=true;
  evidence.escapeFocus=true;evidence.pendingSingleRequest=true;evidence.closedRequestIsolation=true;evidence.failedRequestPreserved=true;
  await command('Page.reload',{},guest);
  await waitUntil(guest,`document.querySelector('#tank')?.options.length===21`);
  await click(guest,'#open-home');
  await waitUntil(guest,`document.querySelector('#home-inventory output')?.value==='暂无物品'`);
  assert.equal(await evaluate(guest,`document.querySelectorAll('[data-inventory-instance]').length`),0);
  await evaluate(session,`document.documentElement.dataset.reloadProbe='old'`);
  await command('Page.reload',{},session);
  await waitUntil(session,`!document.documentElement.dataset.reloadProbe && document.querySelector('#tank')?.options.length===21`);
  assert.equal(await evaluate(session,`localStorage.getItem('cdtank-account-token')`),token);
  await click(session,'#open-home');
  await waitUntil(session,`document.querySelector('[data-kitbag-slot="1"]')?.dataset.instanceId==='301'`);
  store.replaceInventory(owner.accountId,[record(301,2001,5),record(302,1,1)]);
  evidence.combatFixture={instanceId:302,itemTableId:1,ownedQuantity:1};
  store.close();await stop();await start();
  await evaluate(session,`document.documentElement.dataset.reloadProbe='old'`);
  await command('Page.reload',{},session);
  await waitUntil(session,`!document.documentElement.dataset.reloadProbe && document.querySelector('#tank')?.options.length===21`);
  assert.equal(await evaluate(session,`localStorage.getItem('cdtank-account-token')`),token);
  await click(session,'#open-home');
  await waitUntil(session,`document.querySelector('[data-kitbag-slot="1"]')?.dataset.instanceId==='301'`);
  await click(session,'[data-source-control="rdoItem"]');
  await assign(session,302,4);
  await click(session,'[data-home-close]');
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},session);
  await evaluate(session,`(async()=>{
    const source=await(await fetch('/src/render/scene-runtime.ts')).text();
    const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);EngineStore.LastCreatedEngine.setHardwareScalingLevel(3);EngineStore.LastCreatedEngine.resize();
  })()`);
  await click(session,'#create-room-controls > summary');
  await select(session,'#room-mode','4');
  await waitUntil(session,`Array.from(document.querySelector('#room-map').options).some(o=>o.value==='7')`);
  await select(session,'#room-map','7');
  await click(session,'#create-room');
  await waitUntil(session,`document.querySelector('#battle-status').dataset.world`);
  for(let index=0;index<3;index++){
    await click(session,'[data-add-cpu]');
    await waitUntil(session,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===${index+2}`);
  }
  await waitUntil(session,`document.querySelector('[data-ready]') && !document.querySelector('[data-ready]').disabled && (()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.mapLoaded&&s.renderedPlayers===s.players.length})()`);
  await click(session,'[data-ready]');
  await waitUntil(session,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'2',code:'Digit2',windowsVirtualKeyCode:50},session);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'2',code:'Digit2',windowsVirtualKeyCode:50},session);
  await waitUntil(session,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.players.find(p=>p.id===s.playerId).selectedAmmoSlot===2})()`);
  const consumeStore = new AccountStore(database);
  const deadline=Date.now()+180000;
  let consumed=false;
  await click(session,'#world');
  while(Date.now()<deadline && !consumed){
    const state=await evaluate(session,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
    const local=state.players.find(player=>player.id===state.playerId);
    if(state.phase==='PLAYING' && local?.alive && local.hp<local.maxHp){
      await key(session,'5','Digit5',53);
      await new Promise(resolve=>setTimeout(resolve,350));
      consumed=consumeStore.inventory(owner.accountId).records.find(record=>record.instanceId===302).ownedQuantity===0;
      if(consumed)evidence.healing={before:1,after:0,injuredHp:local.hp,maxHp:local.maxHp,tick:state.tick};
    }
    await new Promise(resolve=>setTimeout(resolve,350));
  }
  assert(consumed,'Ordinary Digit5 after natural CPU injury must consume assigned first item');
  consumeStore.close();
  await click(session,'#leave');
  await waitUntil(session,`!document.querySelector('#battle-status').dataset.world`);
  await stop();await start();
  await command('Page.reload',{},session);
  await waitUntil(session,`document.querySelector('#tank')?.options.length===21`);
  await click(session,'#open-home');
  await waitUntil(session,`document.querySelector('[data-inventory-instance="301"]')`);
  await click(session,'[data-source-control="rdoItem"]');
  await waitUntil(session,`document.querySelector('[data-inventory-instance="302"]')?.textContent.includes('×0')`);
  assert.equal(await evaluate(session,`document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId`),'302');
  const finalStore=new AccountStore(database);
  assert.equal(finalStore.inventory(owner.accountId).records.find(record=>record.instanceId===302).ownedQuantity,0);finalStore.close();
  evidence.zeroStockRestart=true;
  evidence.identityRefresh=true;evidence.identityServerRestart=true;evidence.isolatedEmptyAccount=true;evidence.normalKeyboardAmmo=2;
  await writeFile(`${outputPrefix}.json`,JSON.stringify(evidence,null,2));
  console.log('PASS: original inventory images/quantities/layout, ordinary assign/Delete/Backspace/right-click/native drag, 1080p/4K, pending/close isolation, failed request preservation, isolated account, refresh/restart, Digit2 ammo and injured Digit5 consumption 1→0 with zero-stock restart');
} catch(error) {
  evidence.status='FAIL';evidence.error=String(error);evidence.lastCondition=lastCondition;
  evidence.diagnostics=await Promise.all(pages.map(async page=>({targetId:page.targetId,state:await evaluate(page.sessionId,`({status:document.querySelector('#home-inventory output')?.value,focus:document.activeElement?.outerHTML,slots:Array.from(document.querySelectorAll('.home-slot')).map(e=>({slot:e.dataset.kitbagSlot,instanceId:e.dataset.instanceId,disabled:e.disabled})),world:document.querySelector('#battle-status')?.dataset.world})`).catch(error=>({error:String(error)}))})));
  throw error;
} finally {
  await writeFile(`${outputPrefix}.json`,JSON.stringify(evidence,null,2));
  for(const {targetId} of pages)await command('Target.closeTarget',{targetId}).catch(()=>{});
  for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});
  ws.close();await vite.close();server?.kill('SIGCONT');await stop();await writeFile(`${outputPrefix}-server.log`,serverLog);await rm(directory,{recursive:true,force:true});
}
