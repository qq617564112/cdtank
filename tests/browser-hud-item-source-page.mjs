import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile, copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3423',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-hud-item-source-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-hud-item-source-'));
const database=join(directory,'accounts.sqlite');
const fixture=JSON.parse(await readFile('recovery/output/home-tank-active-marker-browser-fixture.json','utf8'));
await copyFile('recovery/output/home-tank-active-marker-browser.sqlite',database);
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3423,vite:5453,cdp:9653},runId,scope:'First formal eight-slot HUD source bar: copied lawful owned-role checkpoint; normal BUY4 quantity2/Home Digit5 configuration; three complete pages; ordinary itemUsed2to1/itemRejected unchanged/Leave. No damage, FX regression or restart.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3423',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'300'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'readonly-resource-ready',transform(source,id){if(id.endsWith('/src/match/battle.ts'))return source+'\nconst modeOldQuick=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.modeReadinessBattle=this;return modeOldQuick.call(this,value);};';}}],server:{port:5453,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3423',ws:true,rewrite:()=> '/'}}}});await vite.listen();
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
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['CreateRoom','Join','Leave','ExitRoom','Ready','AddCpu','RoomChat','RoomWhisper','FriendChat','PlayerInput','Shop','TankShop','SelectRole','Inventory','Kitbag','RoomEvent'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});



  const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
  const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
  await command('Page.enable',{},sessionId);
  await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+')'},sessionId);
  await command('Page.navigate',{url:'http://127.0.0.1:5453'},sessionId);
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);const s=sessionId;
  await waitUntil(s,`document.querySelector('[data-room-card-home]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);
  assert((await evaluate(s,`localStorage.getItem('cdtank-account-token')`))===fixture.token,'Copied checkpoint account identity');
  evidence.checkpointIdentityMatched=true;


  evidence.fixture={source:'home-tank-active-marker-browser.sqlite',copied:true,rolesNotImported:true,stockNotImported:true};
  await nativeClick(s,'[data-room-card-shop]');await waitUntil(s,`document.querySelector('[data-shop-product-id="4"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-product-id="4"]');await waitUntil(s,`document.querySelector('[data-shop-buy]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-quantity]');
  for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},s);
  await command('Input.insertText',{text:'2'},s);await nativeClick(s,'[data-shop-buy]');
  await waitUntil(s,`document.querySelector('[data-shop-status]').value.includes('已购买')&&document.querySelector('#account-shop').dataset.purchasedInstance`);
  const instanceId=Number(await evaluate(s,`document.querySelector('#account-shop').dataset.purchasedInstance`));
  evidence.purchase={itemTableId:4,instanceId,quantity:2};assert(instanceId>0);
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`!document.querySelector('#account-shop[open]')`);
  await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('#home-inventory [data-source-control="rdoItem"]')?.matches(':enabled')`);
  await nativeClick(s,'#home-inventory [data-source-control="rdoItem"]');await waitUntil(s,`document.querySelector('[data-inventory-instance="${instanceId}"]')?.matches(':enabled')`);
  await nativeClick(s,`[data-inventory-instance="${instanceId}"]`);await nativeClick(s,'[data-kitbag-slot="4"]');
  await waitUntil(s,`document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='${instanceId}'`);
  evidence.assignment={slot:4,digit:5,instanceId};await nativeClick(s,'[data-home-close]');
  await nativeClick(s,'[data-room-card-create]');await waitUntil(s,`document.querySelector('[data-map-selector-mode="1"]')`);
  await nativeClick(s,'[data-map-selector-mode="1"]');await waitUntil(s,`document.querySelector('[data-map-selector-map="7"]')`);
  await nativeClick(s,'[data-map-selector-map="7"]');await nativeClick(s,'[data-map-selector-confirm]');
  await waitUntil(s,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);await nativeClick(s,'[data-room-create-confirm]');
  await waitUntil(s,`document.querySelector('[data-add-cpu]')?.matches(':enabled')&&!document.querySelector('[data-room-create-dialog]')?.open`);
  for(let i=0;i<3;i++){await nativeClick(s,'[data-add-cpu]');await waitUntil(s,`JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')?.players.length>=${i+2}&&document.querySelector('[data-add-cpu]')?.matches(':enabled')`);}
  await waitUntil(s,`window.modeReadinessBattle?.mapLoaded&&window.modeReadinessBattle?.players.resourcesReady&&!window.modeReadinessBattle.players.loadingError&&document.querySelector('[data-waiting-ready]')?.matches(':enabled')`,90000);
  await nativeClick(s,'[data-waiting-ready]');await waitUntil(s,`document.querySelector('[data-formal-battle-page]')&&document.querySelector('.hud-item-source-bar [data-source-control="txtItemCount4"]').dataset.itemQuantity==='2'`,90000);
  evidence.resolutions=[];
  for(const [width,height]of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    await waitUntil(s,`Math.abs(document.querySelector('#original-battle-hud').getBoundingClientRect().width-800*Math.min(${width}/800,${height}/600))<.2`);
    const result=await evaluate(s,`(async()=>{const root=document.querySelector('.hud-item-source-bar');const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,inside:r.left>=-.2&&r.top>=-.2&&r.right<=innerWidth+.2&&r.bottom<=innerHeight+.2}};
      const images=[root,...root.querySelectorAll('[data-source-asset]')];await Promise.all(images.map(e=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=reject;i.src='/'+e.dataset.sourceAsset;})));
      const inv=window.modeReadinessBattle.itemInventory.getSnapshot().inventory;
      return {width:innerWidth,height:innerHeight,bar:box(root),controls:1+root.querySelectorAll('[data-source-control]').length,images:images.map(e=>({control:e.dataset.sourceControl,asset:e.dataset.sourceAsset,box:box(e)})),labels:[...root.querySelectorAll('[data-source-control^="lblItem"]')].map(e=>({label:e.getAttribute('aria-label'),glyphs:e.querySelectorAll('img').length,box:box(e)})),counts:[...root.querySelectorAll('[data-source-control^="txtItemCount"]')].map(e=>({binding:e.dataset.itemCountBinding,quantity:e.dataset.itemQuantity,glyphs:e.querySelectorAll('img').length,box:box(e)})),cooldowns:[...root.querySelectorAll('[data-item-cooldown-binding]')].map(e=>({hidden:e.hidden,binding:e.dataset.itemCooldownBinding})),confirmed:{hotkeys:inv.hotkeys,record:inv.records.find(v=>v.instanceId===${instanceId})}};})()`);
    evidence.resolutions.push(result);const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));
    assert.equal(result.controls,41);assert.equal(result.bar.width,300*Math.min(width/800,height/600));assert(result.images.every(v=>v.box.inside));assert.equal(result.labels.length,8);assert(result.labels.every((v,i)=>v.label===String(i+1)&&v.glyphs===1&&v.box.inside));
    assert.equal(result.counts[0].binding,'unbound');assert.equal(result.counts[0].glyphs,0);assert.equal(result.counts[4].quantity,'2');assert.equal(result.counts[4].binding,'web-confirmed-battle-quantity');assert(result.cooldowns.every(v=>v.hidden&&v.binding==='unbound'));assert.equal(result.confirmed.hotkeys[3],instanceId);assert.equal(result.confirmed.record.battleQuantity,2);
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);
  await waitUntil(s,`Math.abs(document.querySelector('#original-battle-hud').getBoundingClientRect().width-1440)<.2`);
  await nativeClick(s,'#world');
  const localId=await evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world).playerId`);
  async function use(){for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'5',code:'Digit5',windowsVirtualKeyCode:53},s);}
  let start=network.length;await use();await waitUntil(s,`document.querySelector('.hud-item-source-bar [data-source-control="txtItemCount4"]').dataset.itemQuantity==='1'`);
  const used=network.slice(start).find(n=>n.name==='RoomEvent'&&n.payload?.type==='itemUsed'&&n.payload.playerId===localId);assert(used);const refreshed=network.slice(start).filter(n=>n.name==='Inventory'&&n.success).at(-1);assert(refreshed);assert.equal(refreshed.response.records.find(v=>v.instanceId===instanceId).battleQuantity,1);
  evidence.consumption={event:used.payload,confirmed:refreshed.response.records.find(v=>v.instanceId===instanceId),hudQuantity:1};
  start=network.length;await use();const deadline=Date.now()+5000;while(Date.now()<deadline&&!network.slice(start).some(n=>n.name==='RoomEvent'&&n.payload?.type==='itemRejected'&&n.payload.playerId===localId))await new Promise(r=>setTimeout(r,50));
  const rejected=network.slice(start).find(n=>n.name==='RoomEvent'&&n.payload?.type==='itemRejected'&&n.payload.playerId===localId);assert(rejected,'Real duplicate skill rejection');
  evidence.rejection={event:rejected.payload,hudQuantity:await evaluate(s,`document.querySelector('.hud-item-source-bar [data-source-control="txtItemCount4"]').dataset.itemQuantity`),inventoryRefreshes:network.slice(start).filter(n=>n.name==='Inventory'&&n.direction==='sent').length};assert.equal(evidence.rejection.hudQuantity,'1');assert.equal(evidence.rejection.inventoryRefreshes,0);
  await nativeClick(s,'[data-leave-room]');await waitUntil(s,`!document.querySelector('[data-formal-battle-page]')&&document.activeElement.matches('[data-room-card-create]')&&document.activeElement.matches(':enabled')`);
  evidence.cleanup={strictCreate:true,hudHidden:await evaluate(s,`document.querySelector('#original-battle-hud').hidden`),inventoryCleared:await evaluate(s,`!window.modeReadinessBattle.itemInventory.getSnapshot().inventory`)};assert(evidence.cleanup.hudHidden&&evidence.cleanup.inventoryCleared);
  evidence.status='PASS';console.log('PASS HUD item source page '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
