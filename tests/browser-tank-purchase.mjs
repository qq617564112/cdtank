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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3241',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-tank-purchase-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-tank-purchase-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3241,vite:5401,cdp:9601},runId,scope:'Paid tank3 MONEY2500 from empty tank3 ownership; ordinary source Tank purchase/Home selection/one CPU battle movement-fire/Leave. SameDB restart and rejection coverage delegated to network runner.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3241',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'30'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5401,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3241',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9601',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9601/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9601');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['TankShop','Shop','OwnedRoles','RoleProfile','SelectRole','Account','CreateRoom','Cpu','Ready','Leave','RoomSnapshot','RoomEvent','PlayerInput'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5401',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  store=new AccountStore(database);const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(r=>r.tankId===1&&r.part===0);
  for(const [index,page]of pages.entries()){
    const account=store.open(await evaluate(page.sessionId,`localStorage.getItem('cdtank-account-token')`));
    const baseFields=new Map(Object.keys(native.base).map(k=>[Number(k),0])),equipmentFields=new Map(Object.keys(native.equipment).map(k=>[Number(k),0]));baseFields.set(0,73);baseFields.set(8,1);baseFields.set(0x2c,600);baseFields.set(0x34,5);baseFields.set(0x3c,10);equipmentFields.set(0x1c,74);equipmentFields.set(0x24,1);equipmentFields.set(0x3c,100);equipmentFields.set(0x40,70);equipmentFields.set(0x4c,15);equipmentFields.set(0x50,30);equipmentFields.set(0x58,2001);
    store.replaceRoleRecords(account.accountId,{base:[{name:'Explicit base pet1 fixture',fields:baseFields}],equipment:[{name:'Explicit base tank1 fixture',fields:equipmentFields}]});assert.equal(store.inventory(account.accountId).records.length,0);
    const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa4,73,true);view.setUint32(0xa8,74,true);view.setUint32(0x70,index===0?3000:2000,true);view.setUint32(0x74,1000,true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
  }
  store.close();store=undefined;evidence.fixture={existingPet:73,existingTank:74,initialTank3:false,money:[3000,2000],tokens:1000};
  const host=pages[0].sessionId,peer=pages[1].sessionId;
  async function openTank(s){await nativeClick(s,'[data-room-card-shop]');await waitUntil(s,`document.querySelector('[data-shop-root-category="Tank"]')?.matches(':enabled')`);await nativeClick(s,'[data-shop-root-category="Tank"]');await waitUntil(s,`document.querySelector('[data-tank-shop-buy]')?.matches(':enabled')`);assert.equal(await evaluate(s,`document.querySelector('[data-tank-shop-item]').value`),'3');}
  async function shot(s,suffix){const result=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+suffix+'.png',Buffer.from(result.data,'base64'));}
  await openTank(peer);await nativeClick(peer,'[data-tank-shop-buy]');await waitUntil(peer,`document.querySelector('[data-tank-shop-status]').value.includes('余额不足')`);evidence.shortage=await evaluate(peer,`({status:document.querySelector('[data-tank-shop-status]').value,balance:document.querySelector('[data-tank-shop-balance]').textContent})`);assert(evidence.shortage.balance.includes('金币：2000 · 软星币：1000'));await nativeClick(peer,'[data-shop-close]');
  await openTank(host);evidence.product=await evaluate(host,`document.querySelector('[data-tank-shop-product]').textContent`);assert(evidence.product.includes('2500金币'));await nativeClick(host,'[data-tank-shop-buy]');await waitUntil(host,`document.querySelector('[data-tank-shop-status]').value.includes('已购买')&&document.querySelector('[data-purchased-tank-instance]').dataset.purchasedTankInstance`);
  const instanceId=Number(await evaluate(host,`document.querySelector('[data-purchased-tank-instance]').dataset.purchasedTankInstance`));assert.equal(instanceId,1);evidence.purchase=await evaluate(host,`({status:document.querySelector('[data-tank-shop-status]').value,balance:document.querySelector('[data-tank-shop-balance]').textContent,instanceId:document.querySelector('[data-purchased-tank-instance]').dataset.purchasedTankInstance})`);assert(evidence.purchase.balance.includes('金币：500 · 软星币：1000'));await shot(host,'purchased');
  await nativeClick(host,'[data-shop-root-category="Item"]');await waitUntil(host,`document.querySelector('[data-shop-balance]')?.textContent.includes('金币：500 · 软星币：1000')`);evidence.itemPageBalance=await evaluate(host,`document.querySelector('[data-shop-balance]').textContent`);await nativeClick(host,'[data-shop-close]');
  await nativeClick(host,'[data-room-card-home]');await waitUntil(host,`document.querySelector('[data-role-tab="tank"]')`);await nativeClick(host,'[data-role-tab="tank"]');await waitUntil(host,`document.querySelector('[data-owned-role="${instanceId}"]')?.matches(':enabled')`);assert.equal(await evaluate(host,`document.querySelector('.home-role-use').dataset.selectedInstance`),'74');await nativeClick(host,`[data-owned-role="${instanceId}"]`);
  await waitUntil(host,`(()=>{const p=document.querySelector('#home-roles [data-role-preview]');return p?.dataset.status==='ready'&&p.dataset.renderedTankId==='3'&&Number(p.dataset.meshes)>0})()`);
  evidence.homePreview=await evaluate(host,`({...document.querySelector('#home-roles [data-role-preview]').dataset})`);assert.deepEqual(JSON.parse(evidence.homePreview.tankTextures),{U:30041,M:30042,XY:30013});await shot(host,'home-tank3');await nativeClick(host,'.home-role-use');await waitUntil(host,`document.querySelector('.home-role-status').value.includes('已保存')&&document.querySelector('.home-role-use').dataset.selectedInstance==='${instanceId}'`);evidence.selection=await evaluate(host,`document.querySelector('.home-role-use').dataset.selectedInstance`);await nativeClick(host,'[data-roles-close]');
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')`);await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world&&!document.querySelector('[data-room-create-dialog][open]')`);await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).renderedPlayers===2`);await nativeClick(host,'[data-waiting-ready]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  const world=()=>evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);evidence.initial=await world();const ownerId=evidence.initial.playerId,before=evidence.initial.players.find(p=>p.id===ownerId);assert.equal(before.tankId,3);assert.deepEqual(before.tankTextures,{U:30041,M:30042,XY:30013});
  // Observe submitted source meshes without changing the scene or player pose.
  await evaluate(host,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url);const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world')),scene=engine.scenes[0];const root=scene.getTransformNodeByName('player-${ownerId}');if(!root)throw new Error('Purchased player model missing');const meshes=root.getChildMeshes().filter(m=>m.getTotalVertices()>0);window.tankPurchaseRender={draws:0,meshes:meshes.map(m=>({name:m.name,vertices:m.getTotalVertices(),textures:m.material?.getActiveTextures().map(t=>t.url??t.name)}))};for(const mesh of meshes)mesh.onAfterRenderObservable.add(()=>window.tankPurchaseRender.draws++);})()`);
  await command('Page.bringToFront',{},host);await evaluate(host,`document.activeElement?.blur()`);await command('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87},host);await new Promise(r=>setTimeout(r,1200));await command('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87},host);evidence.afterMove=await world();const after=evidence.afterMove.players.find(p=>p.id===ownerId);assert(Math.hypot(after.x-before.x,after.z-before.z)>0.1);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32},host);const fireDeadline=Date.now()+5000;while(!network.some(e=>e.page===host&&e.direction==='received'&&e.name==='RoomEvent'&&e.payload.type==='fire'&&e.payload.playerId===ownerId)&&Date.now()<fireDeadline)await new Promise(r=>setTimeout(r,25));await command('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32},host);await waitUntil(host,`window.tankPurchaseRender.draws>0`);evidence.render=await evaluate(host,`window.tankPurchaseRender`);assert(evidence.render.meshes.length>0);await shot(host,'battle-tank3');evidence.battle=await world();
  assert(network.some(e=>e.page===host&&e.direction==='received'&&e.name==='RoomEvent'&&e.payload.type==='fire'&&e.payload.playerId===ownerId));await nativeClick(host,'[data-battle-play-summary]');await nativeClick(host,'[data-leave-room]');await waitUntil(host,`!document.querySelector('#battle-status').dataset.world`);evidence.leave=true;evidence.status='PASS';console.log('PASS: '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)for(const[i,p]of pages.entries()){const result=await command('Page.captureScreenshot',{format:'png'},p.sessionId).catch(()=>null);if(result)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(result.data,'base64'));}throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
