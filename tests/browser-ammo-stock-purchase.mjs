import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3387',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const lifecycleOnly=false;
const businessOnly=true;
const tailOnly=process.argv.includes('--tail-only');
const output='recovery/output/browser-ammo-stock-purchase-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-ammo-stock-purchase-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3387,vite:5447,cdp:9647},mapId:7,ammo:2002,
  runId,lifecycleOnly,businessOnly,scope:'Two formal React pages, normal2002 MONEY purchase/Home/manual input consumption/Leave/restart; pre-room native owned-role fixture, no active injection.'};
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
  await command('Page.bringToFront', {}, session);await new Promise(r=>setTimeout(r,100));
  const point = await evaluate(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Control covered '+e.outerHTML+' by '+document.elementFromPoint(x,y)?.outerHTML);return {x,y}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},session);
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3387',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'60'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5447,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3387',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9647',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9647/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9647');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Shop','Account','Inventory','Kitbag','CreateRoom','Join','Cpu','Autopilot','Ready','Rematch','Leave','RoomSnapshot','RoomEvent','PlayerInput'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5447',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
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
  evidence.fixture={initialInventory:'empty',experimentalProfileMoney:[100,0],experimentalProfileTokens:[0,0],source:'world-role-attributes-native.json tank1/part0'};
  evidence.scope='Two formal React pages: normal Shop2002 MONEY5 BUY quantity2, Home slot1, normal Digit2/heldSpace depletion, empty rejection, Leave/actual service restart and Home inventory/balance. Native tank1/pet1 owned fixture with funds100/0 before room; no owned-stock import, active state or event injection. Role acquisition and2003 network evidence reused.';
  await nativeClick(host,'[data-room-card-shop]');
  await waitUntil(host,`document.querySelector('#account-shop')?.getAttribute('aria-busy')==='false'&&document.querySelector('[data-shop-item]')`);
  await nativeClick(host,'[data-shop-category="Weapon"]');
  await waitUntil(host,`document.querySelector('[data-shop-product-id="2002"]')?.matches(':enabled')`);
  await nativeClick(host,'[data-shop-product-id="2002"]');await nativeSelect(host,'[data-shop-currency]','MONEY');
  await nativeClick(host,'[data-shop-quantity]');
  for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},host);
  await command('Input.insertText',{text:'2'},host);await nativeClick(host,'[data-shop-buy]');
  await waitUntil(host,`document.querySelector('[data-shop-status]').value.includes('已购买')`);
  const instanceId=Number(await evaluate(host,`document.querySelector('#account-shop').dataset.purchasedInstance`));assert(instanceId>0);
  evidence.purchase=await evaluate(host,`({status:document.querySelector('[data-shop-status]').value,balance:document.querySelector('[data-shop-balance]').textContent,instance:document.querySelector('#account-shop').dataset.purchasedInstance})`);
  assert(evidence.purchase.balance.includes('金币：90 · 软星币：0'));
  await nativeClick(host,'[data-shop-close]');await nativeClick(host,'[data-room-card-home]');
  await waitUntil(host,`document.querySelector('[data-inventory-instance="${instanceId}"]')?.matches(':enabled')`);
  await nativeClick(host,`[data-inventory-instance="${instanceId}"]`);await nativeClick(host,'[data-kitbag-slot="1"]');
  await waitUntil(host,`document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId==='${instanceId}'`);
  evidence.assigned=await evaluate(host,`({item:document.querySelector('[data-inventory-instance="${instanceId}"]').textContent,slot:document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId})`);
  assert(evidence.assigned.item.includes('×2'));await nativeClick(host,'[data-home-close]');
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')`);
  await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');
  await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world&&!document.querySelector('[data-room-create-dialog][open]')`);
  const world=s=>evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  const roomId=(await world(host)).roomId;
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')?.matches(':enabled')`);
  const point=await evaluate(guest,`(()=>{const e=document.querySelector('[data-room-card-id="${roomId}"]');e.scrollIntoView();const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  for(const type of ['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,button:'left',clickCount:2,...point},guest);
  for(const s of [guest,host]){
    await waitUntil(s,`document.querySelector('[data-waiting-ready]')?.matches(':enabled')`);
    await nativeClick(s,'[data-waiting-ready]');
  }
  for(const s of [host,guest])await waitUntil(s,`JSON.parse(document.querySelector('#battle-status').dataset.world||'null')?.phase==='PLAYING'`);
  const ownerId=(await world(host)).playerId;
  const press=async(key,code,num)=>{for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:num},host);};
  await nativeClick(host,'#world');await press('2','Digit2',50);
  await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.find(p=>p.id==='${ownerId}').ammoItemId===2002`);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32},host);
  await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.find(p=>p.id==='${ownerId}').ammoSlots[0].quantity===0`,25000);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32},host);
  evidence.depleted=await Promise.all(pages.map(p=>world(p.sessionId)));
  await waitUntil(host,`document.querySelector('[data-ammo-slot="2"]').dataset.ammoQuantity==='0'`);
  evidence.hud=await evaluate(host,`({quantity:document.querySelector('[data-ammo-slot="2"]').dataset.ammoQuantity,text:document.querySelector('[data-ammo-slot="2"]').textContent})`);
  const shared=s=>network.filter(e=>e.page===s&&e.name==='RoomEvent'&&e.direction==='received'&&e.payload.playerId===ownerId&&['fire','ammoConsumed'].includes(e.payload.type)).map(e=>e.payload);
  if(!tailOnly)assert.deepEqual(shared(host),shared(guest));if(!tailOnly)assert.deepEqual(shared(host).filter(e=>e.type==='ammoConsumed').map(e=>e.value),[1,0]);
  if(!tailOnly)assert.equal(shared(host).filter(e=>e.type==='fire'&&e.skillId===2002).length,2);
  evidence.tailOnly=tailOnly;
  for(const s of [guest,host]){
    await nativeClick(s,await evaluate(s,`document.querySelector('[data-leave-room]')?'[data-leave-room]':document.querySelector('[data-waiting-close]')?'[data-waiting-close]':'[data-summary-leave]'`));await waitUntil(s,`!document.querySelector('#battle-status').dataset.world`);
  }
  await nativeClick(host,'[data-room-card-home]');await waitUntil(host,`document.querySelector('[data-inventory-instance="${instanceId}"]')`);
  evidence.afterLeave=await evaluate(host,`({item:document.querySelector('[data-inventory-instance="${instanceId}"]').textContent,slot:document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId})`);
  assert(evidence.afterLeave.item.includes('×0'));await nativeClick(host,'[data-home-close]');
  await stop(server);await startServer();
  for(const p of pages){await command('Page.reload',{},p.sessionId);await waitUntil(p.sessionId,`document.querySelector('[data-room-card-home]')?.matches(':enabled')`);}
  await nativeClick(host,'[data-room-card-home]');await waitUntil(host,`document.querySelector('[data-inventory-instance="${instanceId}"]')`);
  evidence.restored=await evaluate(host,`({item:document.querySelector('[data-inventory-instance="${instanceId}"]').textContent,slot:document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId})`);
  assert(evidence.restored.item.includes('×0'));assert.equal(evidence.restored.slot,String(instanceId));await nativeClick(host,'[data-home-close]');
  await nativeClick(host,'[data-room-card-shop]');await waitUntil(host,`document.querySelector('[data-shop-balance]')?.textContent.includes('金币：90 · 软星币：0')`);
  evidence.restored.balance=await evaluate(host,`document.querySelector('[data-shop-balance]').textContent`);
  const shot=await command('Page.captureScreenshot',{format:'png'},host);await writeFile(output+'-restored.png',Buffer.from(shot.data,'base64'));
  await nativeClick(host,'[data-shop-close]');evidence.status='PASS';console.log('PASS '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)for(const[i,p]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},p.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+i+'.png',Buffer.from(shot.data,'base64'));}throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2));await writeFile(output+'.log',serverLog);store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
