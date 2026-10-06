import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
const WebSocket=createRequire(import.meta.url)('ws');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-ammo-slow-business-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-ammo-slow-business-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3393,vite:5453,cdp:9653},mapId:7,ammo:2008,
  scope:'Formal React purchase/Kitbag/Ready/nativeW before-during-after ordinary2008 hit with15sec authority expiry, dual state/event equality and normal Leave. Original111/SE43 drawing acceptance reused; low320x180 render and native owned-role/funds fixture disclosed.'};
async function stop(child){if(child?.exitCode===null&&child.signalCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}}
let sequence = 0;
const pending = new Map();
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
async function waitUntil(session, expression, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      return await evaluate(session, `(async()=>{const deadline=Date.now()+${timeout};while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#room-map-info')?.value+' tanks='+document.querySelector('#tank')?.options.length+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed')
          && !String(error).includes('Inspected target navigated or closed')) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Page navigation timeout');
}
async function nativeClick(session, selector) {
  await command('Page.bringToFront', {}, session);
  const point = await evaluate(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',clickCount:1,...point}, session);
  await command('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',clickCount:1,...point}, session);
}
async function nativeSelect(session, selector, value) {
  const index = await evaluate(session, `Array.from(document.querySelector(${JSON.stringify(selector)}).options).filter(o=>!o.disabled).findIndex(o=>o.value===${JSON.stringify(String(value))})`);
  assert(index >= 0, `${selector} option ${value}`);
  await nativeClick(session, selector);
  const press = async (key, code, windowsVirtualKeyCode) => {
    await command('Input.dispatchKeyEvent', {type:'keyDown',key,code,windowsVirtualKeyCode}, session);
    await command('Input.dispatchKeyEvent', {type:'keyUp',key,code,windowsVirtualKeyCode}, session);
  };
  await press('Home', 'Home', 36);
  for(let step=0;step<index;step++)await press('ArrowDown', 'ArrowDown', 40);
  await press('Enter', 'Enter', 13);
  await waitUntil(session, `document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(String(value))}`);
  assert.equal(await evaluate(session, `document.querySelector(${JSON.stringify(selector)}).value`), String(value));
}
try {
  const env={...process.env,PORT:'3393',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'120'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5453,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3393',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9653',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9653/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9653');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});

  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5453',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  store=new AccountStore(database);const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(r=>r.tankId===1&&r.part===0);
  for(const [index,page]of pages.entries()){
    const account=store.open(await evaluate(page.sessionId,`localStorage.getItem('cdtank-account-token')`));
    const fields=v=>new Map(Object.entries(v).map(([k,v])=>[Number(k),v]));
    const equipment={name:'明确导入原战车',fields:fields(native.equipment)},base={name:'明确导入原宠物',fields:fields(native.base)};
    equipment.fields.set(0x1c,72);equipment.fields.set(0x24,1);equipment.fields.set(0x28,index?10021:10011);equipment.fields.set(0x2c,index?10022:10012);equipment.fields.set(0x30,index?10023:10013);
    store.replaceRoleRecords(account.accountId,{base:[base],equipment:[equipment]});
    assert.equal(store.inventory(account.accountId).records.length,0);

    const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa8,72,true);view.setUint32(0xa4,base.fields.get(0),true);view.setUint32(0x70,index===0?100:0,true);view.setUint32(0x74,0,true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
  }
  store.close();store=undefined;
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  for(const page of pages){await nativeClick(page.sessionId,'[data-room-card-home]');await waitUntil(page.sessionId,`document.querySelector('#home-inventory[open] [data-source-control="btnClose"]')`);await nativeClick(page.sessionId,'[data-home-close]');await waitUntil(page.sessionId,`!document.querySelector('#home-inventory[open]')`);}
  evidence.fixture={initialInventory:'empty',experimentalProfileMoney:[100,0],experimentalProfileTokens:[0,0],source:'world-role-attributes-native.json tank1/part0; owned native tank1/pet1 imported before room'};
  await nativeClick(host,'[data-room-card-shop]');await waitUntil(host,`document.querySelector('#account-shop')?.open&&document.querySelector('#account-shop').getAttribute('aria-busy')==='false'`);
  await nativeClick(host,'[data-shop-category="Weapon"]');await waitUntil(host,`document.querySelector('[data-shop-product-id="2008"]')`);
  await nativeClick(host,'[data-shop-product-id="2008"]');await waitUntil(host,`document.querySelector('[data-shop-item]').dataset.selectedItem==='2008'`);await nativeSelect(host,'[data-shop-currency]','MONEY');
  await nativeClick(host,'[data-shop-quantity]');for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},host);await command('Input.insertText',{text:'2'},host);
  await nativeClick(host,'[data-shop-buy]');await waitUntil(host,`document.querySelector('[data-shop-status]').value.includes('已购买')&&document.querySelector('#account-shop').dataset.purchasedInstance`);
  const instanceId=Number(await evaluate(host,`document.querySelector('#account-shop').dataset.purchasedInstance`));assert(instanceId>0);
  evidence.purchase=await evaluate(host,`({status:document.querySelector('[data-shop-status]').value,balance:document.querySelector('[data-shop-balance]').textContent,instanceId:document.querySelector('#account-shop').dataset.purchasedInstance})`);assert(evidence.purchase.balance.includes('金币：90 · 软星币：0'));
  await nativeClick(host,'[data-shop-close]');await waitUntil(host,`!document.querySelector('#account-shop[open]')`);
  await nativeClick(host,'[data-room-card-home]');await waitUntil(host,`document.querySelector('[data-inventory-instance="${instanceId}"]')?.matches(':enabled')`);
  assert((await evaluate(host,`document.querySelector('[data-inventory-instance="${instanceId}"]').textContent`)).includes('×2'));
  await nativeClick(host,`[data-inventory-instance="${instanceId}"]`);await nativeClick(host,'[data-kitbag-slot="1"]');await waitUntil(host,`document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId==='${instanceId}'`);
  evidence.inventoryBefore=await evaluate(host,`({item:document.querySelector('[data-inventory-instance="${instanceId}"]').textContent,slot:document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId})`);
  await nativeClick(host,'[data-home-close]');await waitUntil(host,`!document.querySelector('#home-inventory[open]')`);
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')`);await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
  const joinPoint=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...joinPoint},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...joinPoint},guest);
  await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).renderedPlayers===2`);
  for(const page of pages){
    await evaluate(page.sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world'));
      engine.setHardwareScalingLevel(4);engine.resize();window.slowScene=engine.scenes[0];
      window.slowObserved={events:[],eventTimes:[],snapshots:[]};
      const {Battle}=await import('/src/match/battle.ts');const reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(snapshot){window.slowBattle=this;window.slowObserved.snapshots.push(snapshot);return reconcile.call(this,snapshot);};
      const {BattleSound}=await import('/src/audio/battle-sound.ts');const event=BattleSound.prototype.event;
      BattleSound.prototype.event=function(value,...args){window.slowObserved.events.push(value);const latest=window.slowObserved.snapshots.at(-1);window.slowObserved.eventTimes.push({type:value.type,tick:latest?.tick,serverTime:latest?.serverTime});return event.call(this,value,...args);};
    })()`);
  }
  for(const session of [guest,host]){await waitUntil(session,`window.slowBattle?.players.resourcesReady&&!window.slowBattle.players.loadingError&&document.querySelector('[data-waiting-ready]')?.matches(':enabled')`);await nativeClick(session,'[data-waiting-ready]');}
  const world=session=>evaluate(session,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  const ids=await Promise.all(pages.map(async page=>(await world(page.sessionId)).playerId));
  const key=async(session,code,down)=>command('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',key:code==='Space'?' ':code==='KeyW'?'w':code==='KeyS'?'s':code,code,windowsVirtualKeyCode:({Space:32,KeyW:87,KeyS:83,ArrowLeft:37,ArrowRight:39,Digit2:50})[code]},session);
  const sample=async(name,code)=>{
    await nativeClick(guest,'#world');const tick=(await world(guest)).tick;
    await key(guest,code,true);
    await waitUntil(guest,`(()=>{const rows=window.slowObserved.snapshots.filter(s=>s.tick>=${tick});let count=0;for(let i=1;i<rows.length;i++){const a=rows[i-1].players.find(p=>p.id==='${ids[1]}'),b=rows[i].players.find(p=>p.id==='${ids[1]}');if(Math.hypot(b.x-a.x,b.z-a.z)>.1)count++;}return count>=5;})()`);
    await key(guest,code,false);
    const rows=await evaluate(guest,`window.slowObserved.snapshots.filter(s=>s.tick>=${tick})`);
    let distance=0,seconds=0,wallSeconds=0;const movingTicks=[];
    for(let index=1;index<rows.length;index++){const a=rows[index-1],b=rows[index],previous=a.players.find(p=>p.id===ids[1]),current=b.players.find(p=>p.id===ids[1]);const moved=Math.hypot(current.x-previous.x,current.z-previous.z);if(moved<=.1)continue;distance+=moved;seconds+=(b.tick-a.tick)*.05;wallSeconds+=(b.serverTime-a.serverTime)/1000;movingTicks.push([a.tick,b.tick]);}
    assert(movingTicks.length>=5&&distance>0);return{name,distance,simSeconds:seconds,wallSeconds,speed:distance/seconds,ticks:movingTicks};
  };
  const expiryOnly=process.argv.includes('--expiry-only');
  const baseline=expiryOnly?undefined:await sample('baseline','KeyW');if(!expiryOnly)await sample('baseline-return','KeyS');
  await nativeClick(host,'#world');await key(host,'Digit2',true);await key(host,'Digit2',false);
  await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.find(p=>p.id==='${ids[0]}').ammoItemId===2008`);
  const held=new Set();let accepted=false;const hitDeadline=Date.now()+30000;
  while(Date.now()<hitDeadline){const state=await world(host),me=state.players.find(p=>p.id===ids[0]),target=state.players.find(p=>p.id===ids[1]);
    accepted=await evaluate(host,`window.slowObserved.events.some(e=>e.type==='ammoSlowed')`);if(accepted)break;
    const bearing=Math.atan2(target.x-me.x,target.z-me.z),error=Math.atan2(Math.sin(bearing-me.yaw-me.aim),Math.cos(bearing-me.yaw-me.aim));
    const keys=new Set(Math.abs(error)<.025?['Space']:[error>0?'ArrowLeft':'ArrowRight']);
    for(const code of new Set([...held,...keys]))if(held.has(code)!==keys.has(code)){await key(host,code,keys.has(code));keys.has(code)?held.add(code):held.delete(code);}
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  for(const code of held)await key(host,code,false);assert(accepted,'Ordinary aim/fire reaches a real slowed victim');
  for(const page of pages)await waitUntil(page.sessionId,`window.slowObserved.events.some(e=>e.type==='ammoSlowed')`);
  const activeAt=await evaluate(host,"window.slowObserved.eventTimes.find(e=>e.type==='ammoSlowed').serverTime");
  const slowed=expiryOnly?undefined:await sample('slowed','KeyW');if(!expiryOnly)await sample('slowed-return','KeyS');
  if(!expiryOnly)assert(Math.abs(baseline.speed-150)<1&&Math.abs(slowed.speed-90)<1,JSON.stringify({baseline,slowed}));
  for(const page of pages)await waitUntil(page.sessionId,`window.slowObserved.events.some(e=>e.type==='ammoSlowEnded')`,22000);
  const expiredAt=await evaluate(host,"window.slowObserved.eventTimes.find(e=>e.type==='ammoSlowEnded').serverTime");assert(expiredAt-activeAt>=14500&&expiredAt-activeAt<15500);
  const restored=await sample('restored','KeyW');assert(Math.abs(restored.speed-150)<1);
  evidence.movement={baseline,slowed,restored,activeAt,expiredAt};
  evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.slowObserved')));
  const slowEvents=evidence.observed.map(side=>side.events.find(event=>event.type==='ammoSlowed'));
  assert.deepEqual(slowEvents[0],slowEvents[1]);assert.equal(slowEvents[0].skillId,4006);
  const pairs=evidence.observed[0].snapshots.filter(a=>evidence.observed[1].snapshots.some(b=>a.tick===b.tick));assert(pairs.length>100);
  for(const a of pairs)assert.deepEqual(a.players,evidence.observed[1].snapshots.find(b=>b.tick===a.tick).players);
  evidence.commonTicks=pairs.length;
  for(const page of pages)await nativeClick(page.sessionId,'[data-leave-room]');
  for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await Promise.all(pages.map(page=>evaluate(page.sessionId,`({instances:window.slowBattle.effects.instances.length,views:window.slowBattle.players.players.size,meshes:window.slowScene.meshes.filter(m=>m.metadata?.originalEffect).length,state:document.querySelector('[data-source-audio="battle-sound"]').dataset.state})`)));
  for(const row of evidence.cleanup)assert.deepEqual(row,{instances:0,views:0,meshes:0,state:'stopped'});
  await nativeClick(host,'[data-room-card-home]');await waitUntil(host,`document.querySelector('[data-inventory-instance="${instanceId}"]')`);
  evidence.inventoryAfter=await evaluate(host,`({item:document.querySelector('[data-inventory-instance="${instanceId}"]').textContent,slot:document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId})`);
  assert(evidence.inventoryAfter.item.includes('×1'));assert.equal(evidence.inventoryAfter.slot,String(instanceId));
  await nativeClick(host,'[data-home-close]');
  evidence.status='PASS_PURCHASED_SLOW_REACT_SCOPE';console.log('PASS '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.slowObserved').catch(()=>null)));throw error;}
finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');store?.close();
  if(ws){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
