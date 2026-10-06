import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3435',logger:undefined});
const observer=new WsClient(serviceProto,{server:'ws://127.0.0.1:3435',logger:undefined});
const network=[],httpResponses=[],upgrades=[];
let serverLog='';
const output='recovery/output/browser-continuous-sessions-'+new Date().toISOString().replace(/[:.]/g,'-');
const directory=await mkdtemp(join(tmpdir(),'cdtank-continuous-'));
const fixture=JSON.parse(await readFile('recovery/output/home-tank-active-marker-browser-fixture.json','utf8'));
const database=join(directory,'accounts.sqlite');
const evidence={status:'RUNNING',scope:'Six consecutive ordinary Create/Join/Ready/Digit5/Autopilot/Leave sessions on maps7/2/4, two actual browsers, original time and health unchanged. Lifecycle only; no full game or HD performance claim.',fixture:'Lawful previously purchased role checkpoint copied; no fresh funds/roles/stock import; genuine per-session BUY4x6 and17031/EQUIP.',sessions:[],ports:{server:3435,vite:5459,cdp:9662}};
let server,chrome,vite,ws;
const pages=[],contexts=[];
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
      return await evaluate(session, `(async()=>{const deadline=Date.now()+${timeout};while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('[data-tank-shop-status]')?.value+' '+document.querySelector('[data-tank-shop-preview]')?.dataset.status);})()`);
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
  await command('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',buttons:1,clickCount:1,...point}, session);
  await command('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',buttons:0,clickCount:1,...point}, session);
}


try {
  const copied=spawnSync(process.execPath,['scripts/account-snapshot.mjs','backup','recovery/output/home-tank-active-marker-browser.sqlite',database],{encoding:'utf8'});assert.equal(copied.status,0,copied.stderr);
  const env={...process.env,PORT:'3435',ACCOUNT_DB_PATH:database};delete env.MATCH_MIN_PLAYERS;delete env.MATCH_TIME_LIMIT_SECONDS;
  server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>serverLog+=String(d));
  const deadline=Date.now()+15000;while(!serverLog.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.includes('Server started'),serverLog);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'readonly-continuous-observer',transform(source,id){if(id.endsWith('/src/match/battle.ts'))return source+'\nconst originalQuick=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.continuousBattle=this;return originalQuick.call(this,value);};';}}],server:{port:5459,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3435',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9662',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9662/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint);ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(r.service.name==='Account'&&r.ret?.isSucc)network.push({index:network.length,page:m.sessionId,direction:'received',name:'AccountIdentity',accountId:r.ret.res.accountId});if(['ListMaps','LobbyPlayers','LobbyChat','LobbyWhisper','FriendChat','Friends','CreateRoom','Join','Ready','Shop','TankShop','SelectRole','Leave','RoomChat','Equipment','Inventory','OwnedRoles','History','Ready','RoomSnapshot','RoomEvent','Autopilot','ListRooms'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Network.enable',{},sessionId);await command('Page.enable',{},sessionId);
    await command('Page.addScriptToEvaluateOnNewDocument',{source:`window.continuousIntervals=new Set();const originalInterval=window.setInterval.bind(window),originalClear=window.clearInterval.bind(window);window.setInterval=(...args)=>{const id=originalInterval(...args);window.continuousIntervals.add(id);return id;};window.clearInterval=id=>{window.continuousIntervals.delete(id);return originalClear(id);};`},sessionId);
    if(index===0)await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+')'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await command('Page.navigate',{url:'http://127.0.0.1:5459/'},sessionId);await waitUntil(sessionId,`window.continuousBattle&&document.querySelector('[data-room-card-home]')?.matches(':enabled')`);
  }
  const [s,b]=pages.map(p=>p.sessionId);assert((await evaluate(s,`localStorage.getItem('cdtank-account-token')`))===fixture.token);
  assert((await observer.connect()).isSucc);assert((await observer.callApi('Account',{token:fixture.token})).isSucc);
  evidence.purchases=[];
  async function buyAndConfigure(){
  await nativeClick(s,'[data-room-card-shop]');await waitUntil(s,`document.querySelector('[data-shop-root-category="Item"]')?.matches(':enabled')`);await nativeClick(s,'[data-shop-root-category="Item"]');await waitUntil(s,`document.querySelector('[data-shop-product-id="4"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-product-id="4"]');await waitUntil(s,`document.querySelector('[data-shop-buy]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-quantity]');
  for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},s);
  await command('Input.insertText',{text:'6'},s);await nativeClick(s,'[data-shop-buy]');
  await waitUntil(s,`document.querySelector('[data-shop-status]').value.includes('已购买')&&document.querySelector('#account-shop').dataset.purchasedInstance`);
  const instanceId=Number(await evaluate(s,`document.querySelector('#account-shop').dataset.purchasedInstance`));
  evidence.purchases.push({itemTableId:4,instanceId,quantity:6});assert(instanceId>0);
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`!document.querySelector('#account-shop[open]')`);
  await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('#home-inventory [data-source-control="rdoItem"]')?.matches(':enabled')`);
  await nativeClick(s,'#home-inventory [data-source-control="rdoItem"]');await waitUntil(s,`document.querySelector('[data-inventory-instance="${instanceId}"]')?.matches(':enabled')`);
  await nativeClick(s,`[data-inventory-instance="${instanceId}"]`);await nativeClick(s,'[data-kitbag-slot="4"]');
  await waitUntil(s,`document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='${instanceId}'`);
  await nativeClick(s,'[data-home-close]');
  return instanceId;
  }
  let instanceId=await buyAndConfigure();
  await nativeClick(s,'[data-room-card-shop]');await waitUntil(s,`document.querySelector('#account-shop')?.open&&document.querySelector('#account-shop').getAttribute('aria-busy')==='false'`);
  await nativeClick(s,'[data-shop-root-category="Part"]');await waitUntil(s,`document.querySelector('[data-part-product-id="17031"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-part-product-id="17031"]');
  await nativeClick(s,'[data-part-buy]');await waitUntil(s,`document.querySelector('[data-part-status]').textContent.includes('已购买黄金之光')&&document.querySelector('[data-part-owned-instance]')`);
  const partInstance=Number(await evaluate(s,`document.querySelector('[data-part-owned-instance]').dataset.partOwnedInstance`));assert(partInstance>0);
  await nativeClick(s,'[data-part-equipment]');await waitUntil(s,`document.querySelector('#home-equipment[open] [data-equipment-item="${partInstance}"]')?.matches(':enabled')`);
  await nativeClick(s,`[data-equipment-item="${partInstance}"]`);await nativeClick(s,'[data-equipment-slot="0"]');
  await waitUntil(s,`document.querySelector('[data-equipment-slot="0"]').dataset.instanceId==='${partInstance}'&&!document.querySelector('#home-equipment').matches('[aria-busy="true"]')`);
  evidence.partEquipment={itemTableId:17031,slot:0,instanceId:partInstance};
  await nativeClick(s,'[data-equipment-close]');await waitUntil(s,`!document.querySelector('#home-equipment[open]')`);

  async function resources(p){return evaluate(p,`(()=>{const b=window.continuousBattle,s=b.scene;return {meshes:s.meshes.length,materials:s.materials.length,textures:s.textures.length,geometries:s.geometries.length,transforms:s.transformNodes.length,players:b.players.size,effects:b.effects.instances.length,effectMeshes:s.meshes.filter(m=>m.metadata?.originalEffect).length,skillVoices:b.effects.skillSound.voices.size,treeVoices:b.effects.sound.voices.size,battleVoices:b.sound.voices.size,inputIntervalActive:window.continuousIntervals.has(b.input.timer),running:b.effects.running,world:document.querySelector('#battle-status').dataset.world??null,inventory:!!b.itemInventory.getSnapshot().inventory,roster:b.chat.getSnapshot().players.length,materialsNames:s.materials.map(x=>x.name),texturesNames:s.textures.map(x=>x.name)}})()`);}
  evidence.before=await Promise.all([s,b].map(resources));const started=Date.now();
  for(const [index,mapId] of [7,2,4,7,2,4].entries()){
    if(index>0) instanceId=await buyAndConfigure();
    const record={index,mapId,instanceId,startedAt:Date.now(),samples:[]};evidence.sessions.push(record);
    await nativeClick(s,'[data-room-card-create]');await waitUntil(s,`document.querySelector('[data-map-selector-mode="1"]')`);await nativeClick(s,'[data-map-selector-mode="1"]');await waitUntil(s,`document.querySelector('[data-map-selector-map="${mapId}"]')`);await nativeClick(s,`[data-map-selector-map="${mapId}"]`);await nativeClick(s,'[data-map-selector-confirm]');await waitUntil(s,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);await nativeClick(s,'[data-room-create-confirm]');await waitUntil(s,`document.querySelector('[data-formal-waiting-page]')&&!document.querySelector('[data-room-create-dialog]')?.open`);
    const room=await evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);record.roomId=room;
    await waitUntil(b,`document.querySelector('[data-room-card-id="${room}"]')`);await nativeClick(b,`[data-room-card-id="${room}"]`);await nativeClick(b,'[data-room-card-express]');await waitUntil(b,`document.querySelector('[data-formal-waiting-page]')`);
    for(let i=0;i<3;i++){await waitUntil(s,`document.querySelector('[data-add-cpu]')?.matches(':enabled')`);await nativeClick(s,'[data-add-cpu]');await waitUntil(s,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===${i+3}`);}
    for(const p of [s,b])await waitUntil(p,`window.continuousBattle.mapLoaded&&window.continuousBattle.players.resourcesReady&&!window.continuousBattle.players.loadingError&&document.querySelector('[data-waiting-ready]')?.matches(':enabled')`,90000);
    for(const p of [s,b])await nativeClick(p,'[data-waiting-ready]');for(const p of [s,b])await waitUntil(p,`document.querySelector('[data-formal-battle-page]')`,90000);
    const localId=await evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world).playerId`);const eventStart=network.length;
    await waitUntil(s,`window.continuousBattle.itemInventory.getSnapshot().inventory?.records.some(r=>r.instanceId===${instanceId}&&r.battleQuantity>0)`);
    record.quantityBefore=await evaluate(s,`window.continuousBattle.itemInventory.getSnapshot().inventory.records.find(r=>r.instanceId===${instanceId}).battleQuantity`);
    await nativeClick(s,'#world');for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'5',code:'Digit5',windowsVirtualKeyCode:53},s);
    await waitUntil(s,`window.continuousBattle.itemInventory.getSnapshot().inventory?.records.find(r=>r.instanceId===${instanceId})?.battleQuantity===${record.quantityBefore-1}`);
    for(const p of [s,b]){await nativeClick(p,'[data-battle-play-summary]');await nativeClick(p,'[data-autopilot]');await waitUntil(p,`document.querySelector('[data-autopilot]')?.getAttribute('aria-pressed')==='true'`);await nativeClick(p,'[data-battle-play-summary]');}
    const playStart=Date.now();while(Date.now()-playStart<60000){await new Promise(r=>setTimeout(r,1000));if(record.samples.length===0||Date.now()-record.samples.at(-1).at>=10000)record.samples.push({at:Date.now(),resources:await Promise.all([s,b].map(resources))});}
    record.playWallMs=Date.now()-playStart;
    record.acceptedEvents=network.slice(eventStart).filter(n=>n.name==='RoomEvent'&&n.payload?.playerId===localId&&['itemUsed','itemRejected'].includes(n.payload.type)).map(n=>n.payload);
    assert(record.acceptedEvents.some(e=>e.type==='itemUsed'&&e.skillId===4));
    for(const p of [b,s]){await waitUntil(p,`document.querySelector('[data-leave-room], [data-summary-leave]')?.matches(':enabled')`);const exit=await evaluate(p,`document.querySelector('[data-leave-room]')?'[data-leave-room]':'[data-summary-leave]'`);await nativeClick(p,exit);await waitUntil(p,`!document.querySelector('[data-formal-battle-page]')&&!document.querySelector('[data-battle-summary-page]')&&document.activeElement.matches('[data-room-card-create]')&&document.activeElement.matches(':enabled')`);}
    await new Promise(r=>setTimeout(r,1000));record.cleanup=await Promise.all([s,b].map(resources));
    for(const value of record.cleanup){assert.equal(value.players,0);assert.equal(value.effects,0);assert.equal(value.effectMeshes,0);assert.equal(value.skillVoices,0);assert.equal(value.treeVoices,0);assert.equal(value.battleVoices,0);assert.equal(value.inputIntervalActive,false);assert.equal(value.running,false);assert.equal(value.world,null);assert.equal(value.inventory,false);assert.equal(value.roster,0);}
    if(index>0)for(const [page,value] of record.cleanup.entries())for(const field of ['meshes','materials','textures','geometries','transforms'])assert(value[field]<=evidence.sessions[0].cleanup[page][field],`${field} grew session ${index}: ${value[field]} > ${evidence.sessions[0].cleanup[page][field]}`);
    let rooms; const roomDeadline=Date.now()+5000; do { rooms=await observer.callApi('ListRooms',{}); if(!rooms.isSucc){await observer.disconnect().catch(()=>{}); await observer.connect(); continue;} if(!rooms.res.rooms.some(r=>r.id===room)) break; await new Promise(r=>setTimeout(r,250)); } while(Date.now()<roomDeadline); assert(rooms?.isSucc); assert(!rooms.res.rooms.some(r=>r.id===room)); record.roomRemoved=true;
    await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');console.log(`session ${index+1}/6 map${mapId} accepted and cleaned`);
  }
  evidence.wallMs=Date.now()-started;evidence.status='PASS_SIX_CONTINUOUS_SWITCHED_MAP_SESSIONS';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await observer.disconnect();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.cleaned=true;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
