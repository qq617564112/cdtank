import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile, chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {DatabaseSync, backup} from 'node:sqlite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3663',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-old-bomb-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-old-bomb-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
let coldClients=[];
const tailIndex=process.argv.indexOf('--unreached-tail');
const firstPath=tailIndex>=0?process.argv[tailIndex+1]:undefined;
const first=firstPath?JSON.parse(await readFile(firstPath,'utf8')):undefined;
let reusedPurchase;
if(first){
 assert.equal(first.status,'FAIL');assert(first.error.includes('15 !== 14'));
 const requests=first.network.filter(n=>n.direction==='sent'&&n.payload?.operation==='BUY');assert.equal(requests.length,1);
 const req=requests[0];assert.equal(req.name,'Shop');assert.equal(req.payload.itemTableId,3001);assert.equal(req.payload.quantity,1);assert.equal(req.payload.currency,'MONEY');assert(req.payload.requestId);
 const res=first.network.filter(n=>n.name==='Shop'&&n.direction==='received'&&n.success&&n.response.purchased);assert.equal(res.length,1);
 assert.equal(res[0].response.purchased.instanceId,15);assert.equal(res[0].response.purchased.itemTableId,3001);assert.equal(res[0].response.purchased.ownedQuantity,1);
 const query=first.network.find(n=>n.name==='Shop'&&n.direction==='received'&&n.success&&!n.response.purchased).response;
 assert.equal(res[0].response.money,query.money-20);assert.equal(res[0].response.tokens,query.tokens);
 assert.equal(first.network.filter(n=>n.direction==='sent'&&n.name==='Kitbag').length,0);assert.equal(first.events.length,0);assert.equal(first.rooms.length,0);
 assert.equal(first.runtime.filter(r=>r.method==='Runtime.exceptionThrown').length,0);
 assert.equal(first.visualFinally.length,2);assert(first.visualFinally.every(p=>p.evidence.ready));
 assert(!first.kitbag&&!first.placement);assert(first.savedCheckpoint);
 assert.deepEqual(first.processCleanup,{chromeStopped:true,serverStopped:true,viteClosed:true,tempRemoved:true});
 reusedPurchase={request:req.payload,before:query,confirmed:res[0].response,instanceId:15,reusedFrom:firstPath,rootReview:'recovery/output/old-bomb-browser-purchase-root-review.json'};
}
const fixtureIndex=process.argv.indexOf('--fixture'),databaseIndex=process.argv.indexOf('--database');
const fixturePath=first?firstPath.slice(0,-5)+'-checkpoint-fixture.json':fixtureIndex>=0?process.argv[fixtureIndex+1]:undefined;
assert(fixturePath,'Explicit legitimate identity fixture');
const fixture=JSON.parse(await readFile(fixturePath,'utf8'));
const checkpoint=first?first.savedCheckpoint:databaseIndex>=0?process.argv[databaseIndex+1]:fixture.database;
assert(checkpoint&&fixture.accounts?.length===2&&fixture.accounts.every(a=>a.token),'Legitimate saved dual accounts/database');
if(first)assert.equal(fixture.database,checkpoint);
const snapshots=new Map(),events=new Map(),eventTimes=[];
const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const pages=[],contexts=[];
const evidence={status:'RUNNING',runId,rooms:[],roomClosures:[],domStages:[],clickedTargets:[],ports:{server:3663,vite:5693,cdp:9893},fixture:{source:checkpoint,fixturePath,newFundsOrRecordsInjected:false},scope:'Ordinary Shop BUY3001x1 MONEY20, Home weapon Kitbag slot1/Digit2 placeTrap; fixed5s direct300 square blast, dual complete snapshot/webown-tick, original03001 ground/world010+009 draw consumers, finite stock and phase HomeClose',runtime:[]};
if(first)evidence.firstScope={raw:firstPath,actualSession:45229,actualExit:1,businessReached:false,newOrdinarySession:true,ordinaryPurchaseReused:true,observerReady:true,rootReview:'recovery/output/old-bomb-browser-purchase-root-review.json',previousFirst:first.firstScope};
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
  const hit=await evaluate(session,`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return {missing:true};e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,target=document.elementFromPoint(x,y);return {x,y,covered:!e.contains(target),control:e.outerHTML,target:target?.outerHTML,activeElement:document.activeElement?.outerHTML}})()`);
  const record={page:session,selector,wallTime:Date.now(),before:hit};evidence.clickedTargets.push(record);
  assert(!hit.missing,'Missing native control '+selector);assert(!hit.covered,'Covered native control '+selector);
  const point={x:hit.x,y:hit.y};
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},session);
  await command('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',clickCount:1,...point}, session);
  await command('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',clickCount:1,...point}, session);
  record.after=await evaluate(session,`({activeElement:document.activeElement?.outerHTML,shopCategory:[...document.querySelectorAll('[data-shop-category]')].filter(e=>e.getAttribute('aria-pressed')==='true').map(e=>e.dataset.shopCategory),selectedProduct:document.querySelector('[data-shop-description]')?.dataset.itemTableId,openDialogs:[...document.querySelectorAll('dialog[open]')].map(e=>e.id)})`);
}
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3663',ACCOUNT_DB_PATH:database};server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  const sourceDb=new DatabaseSync(checkpoint,{readOnly:true});try{evidence.sourceInventory=sourceDb.prepare('SELECT record FROM inventory WHERE account_id=? ORDER BY instance_id').all(fixture.accounts[0].accountId).map(r=>JSON.parse(String(r.record)));evidence.retainedReceipts=sourceDb.prepare('SELECT account_id, request_id, receipt FROM shop_purchases ORDER BY account_id, request_id').all();}finally{sourceDb.close();}
  const sourceBomb=evidence.sourceInventory.find(r=>r.itemTableId===3001&&r.instanceId===14);assert(sourceBomb);assert.equal(sourceBomb.ownedQuantity,2);
  if(first){const newBomb=evidence.sourceInventory.find(r=>r.instanceId===reusedPurchase.instanceId);assert(newBomb);assert.equal(newBomb.itemTableId,3001);assert.equal(newBomb.ownedQuantity,1);evidence.purchase=reusedPurchase;}
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5693,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3663',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9893',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9893/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9893');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(['Runtime.exceptionThrown','Runtime.consoleAPICalled'].includes(m.method))evidence.runtime.push({method:m.method,params:m.params});});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(received&&r.service.name==='RoomSnapshot'){const rows=snapshots.get(m.sessionId)??[];rows.push({snapshot:r.msg,wallTime:Date.now()});if(rows.length>1000)rows.shift();snapshots.set(m.sessionId,rows);}if(received&&r.service.name==='RoomEvent'){const rows=events.get(m.sessionId)??[];rows.push(r.msg);events.set(m.sessionId,rows);eventTimes.push({page:m.sessionId,event:r.msg,wallTime:Date.now()});}if(['PlayerInput','PetSkillLearning','PartSale','PartMaintenance','OwnedRoleSale','Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop','RoleProfile','Kitbag','TankTextures','CreateRoom','Join','Leave','JoinRoom','LeaveRoom'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Runtime.enable',{},sessionId);await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.accounts[index].token)+');'},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:`window.oldBombKeyEvents=[];for(const type of ['keydown','keyup'])window.addEventListener(type,event=>{if(!['Digit2','Space','ArrowLeft','ArrowRight','KeyA','KeyD','KeyW','KeyS'].includes(event.code))return;const target=event.target;window.oldBombKeyEvents.push({type,code:event.code,key:event.key,isTrusted:event.isTrusted,wallTime:Date.now(),target:target instanceof Element?{tag:target.tagName,id:target.id}:null,focus:document.activeElement?.outerHTML,world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null')});},true);`},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:`
window.oldBombEvidence={groundReconciles:[],notifications:[],worldCalls:[],draws:[],ready:false};
window.oldBombReady=(async()=>{
 const [{GroundTrapsPresentation},{EffectRuntime},{SkillEffectNotifications}]=await Promise.all([import('/src/assets/scenes/ground-traps-presentation.ts'),import('/src/render/effects/runtime/effect-runtime.ts'),import('/src/match/skills/skill-effect-notifications.ts')]);
 const out=window.oldBombEvidence,scenes=new Set(),registered=new WeakSet(),presentations=new Set(),runtimes=new Set();let context;
 const play=SkillEffectNotifications.prototype.play;SkillEffectNotifications.prototype.play=function(message){const previous=context;if([3001,3009].includes(message.skillId)){context={...message};out.notifications.push({...message,wallTime:Date.now()});}try{return play.call(this,message);}finally{context=previous;}};
 function effectRoot(name,exact=false){const parts=(name??'').split(String.fromCharCode(92));return parts[0]==='_root'&&parts[1]==='online'&&['010','009'].includes(parts[2])&&(!exact||parts.length===3)?parts[2]:undefined;}
 function drawOwner(mesh){for(const runtime of runtimes)for(const instance of runtime.instances)for(const draw of instance.draws){if(draw.sprite?.mesh===mesh||draw.particle?.sprite.mesh===mesh||draw.overlay?.mesh===mesh)return {instanceHandle:instance.handle,nodeIndex:draw.node.definition.index,nodeName:draw.node.definition.name};}return null;}
 function observe(scene){if(scenes.has(scene))return;scenes.add(scene);
  scene.onBeforeRenderObservable.add(()=>{
   for(const mesh of scene.meshes){const source=mesh.metadata?.sourceModel,effect=mesh.metadata?.originalEffect;
    const root=effectRoot(effect);
    if(source!=='Data/scnobj/03001/03001.POL'&&!root)continue;
    if(!mesh.onBeforeRenderObservable||registered.has(mesh))continue;registered.add(mesh);
    mesh.onBeforeRenderObservable.add(()=>{if(out.draws.length>=4000)return;out.draws.push({frame:scene.getFrameId(),wallTime:Date.now(),name:mesh.name,drawOwner:drawOwner(mesh),groundId:mesh.metadata?.groundTrapId,sourceModel:source,effect,root,vertices:mesh.getTotalVertices(),indices:mesh.getTotalIndices(),matrix:Array.from(mesh.getWorldMatrix().asArray()),textures:mesh.material?.getActiveTextures().map(t=>t.url??t.name)??[],alpha:mesh.material?.alpha,vertexAlphas:Array.from(mesh.getVerticesData('color')??[]).filter((_,i)=>i%4===3),alphaIndex:mesh.alphaIndex,world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null')});});
   }
  });
 }
 const reconcile=GroundTrapsPresentation.prototype.reconcile;GroundTrapsPresentation.prototype.reconcile=function(sources,scope){presentations.add(this);observe(this.scene);if(sources.some(s=>s.itemTableId===3001))out.groundReconciles.push({sources:sources.map(s=>({...s})),scope,wallTime:Date.now()});return reconcile.call(this,sources,scope);};
 const spawn=EffectRuntime.prototype.spawnWorldEffect;EffectRuntime.prototype.spawnWorldEffect=function(name,origin){runtimes.add(this);observe(this.scene);const handle=spawn.call(this,name,origin);if(effectRoot(name,true))out.worldCalls.push({notification:{...context},name,origin:[...origin],handle,wallTime:Date.now(),soundNodeCount:this.instances.find(i=>i.handle===handle)?.tree.nodes.filter(n=>n.sound).length,sounds:[]});return handle;};
 const update=EffectRuntime.prototype.update;EffectRuntime.prototype.update=function(...args){const result=update.apply(this,args);for(const record of out.worldCalls){const instance=this.instances.find(i=>i.handle===record.handle);if(!instance||record.sounds.length>=400)continue;for(const node of instance.tree.nodes){if(!node.sound?.started)continue;const voice=this.sound.voices.get(node.sound.handle),audio=voice?.audio;record.sounds.push({frame:this.scene.getFrameId(),node:node.definition.name,reference:node.sound.reference,handle:node.sound.handle,ended:voice?.ended,asset:audio?.src,currentTime:audio?.currentTime,paused:audio?.paused,readyState:audio?.readyState,volume:audio?.volume});}}return result;};
 window.oldBombCleanup=()=>({groundEntries:[...presentations].map(p=>p.entries.size),targetMeshes:[...scenes].map(s=>s.meshes.filter(m=>m.metadata?.sourceModel==='Data/scnobj/03001/03001.POL'||effectRoot(m.metadata?.originalEffect)).length),targetInstances:[...runtimes].map(r=>r.instances.filter(i=>i.tree.nodes.some(n=>effectRoot(n.definition.name))).length)});
 out.ready=true;
})();`},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5693'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-entry-page="login"] button[data-source-control="btnLogin"]')?.matches(':enabled')`);
    await nativeClick(sessionId,'[data-entry-page="login"] button[data-source-control="btnLogin"]');
    await waitUntil(sessionId,`document.querySelector('[data-channel-id="main"]')?.matches(':enabled')`);
    await nativeClick(sessionId,'[data-channel-id="main"]');
    const channelPoint=await evaluate(sessionId,`(()=>{const r=document.querySelector('[data-channel-id="main"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...channelPoint},sessionId);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...channelPoint},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')`);

    await evaluate(sessionId,'window.oldBombReady.then(()=>true)');

  }

  const host=pages[0].sessionId,peer=pages[1].sessionId;
  const state=session=>(snapshots.get(session)??[]).at(-1)?.snapshot;
  const lastResponse=(name,session=host)=>network.filter(n=>n.page===session&&n.direction==='received'&&n.name===name&&n.success).at(-1)?.response;
  async function condition(test,label,timeout=45000) {const until=Date.now()+timeout;while(Date.now()<until){if(test())return;await new Promise(r=>setTimeout(r,50));}await observe(host,label+'.failed').catch(()=>{});await observe(peer,label+'.failed').catch(()=>{});throw new Error(label);}
  async function observe(session,label) {
    const dom=await evaluate(session,`(()=>{const world=document.querySelector('#battle-status')?.dataset.world;const selectors=['[data-room-card-home]','[data-leave-room]','[data-summary-leave]','[data-waiting-close]','[data-home-close]'];return {shop:{open:!!document.querySelector('#account-shop[open]'),activePage:document.querySelector('[data-shop-page]')?.dataset.shopActivePage,categories:[...document.querySelectorAll('[data-shop-category]')].map(e=>({category:e.dataset.shopCategory,selected:e.getAttribute('aria-pressed'),disabled:e.disabled})),lists:[...document.querySelectorAll('[data-shop-source-product-grid],[data-home-inventory-list]')].map(e=>({selector:e.hasAttribute('data-shop-source-product-grid')?'product':'owned',scrollTop:e.scrollTop,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,rows:[...e.querySelectorAll('[data-shop-product-id],[data-inventory-instance]')].map(b=>({id:b.dataset.shopProductId??b.dataset.inventoryInstance,disabled:b.disabled,rect:{top:b.getBoundingClientRect().top,bottom:b.getBoundingClientRect().bottom}}))}))},world:world?JSON.parse(world):null,buttons:selectors.map(selector=>{const e=document.querySelector(selector);return {selector,exists:!!e,disabled:e?.disabled,visible:e?e.getClientRects().length>0:false}}),openDialogs:[...document.querySelectorAll('dialog[open]')].map(e=>({id:e.id,ariaBusy:e.getAttribute('aria-busy')})),activeElement:document.activeElement?.outerHTML}})()`);
    evidence.domStages.push({label,page:session,dom});return dom;
  }
  async function stageWait(session,label,expression) {
    await observe(session,label+'.before');
    try{await waitUntil(session,expression);await observe(session,label+'.passed');}
    catch(error){evidence.failedStage=label;await observe(session,label+'.failed').catch(()=>{});throw error;}
  }
  let roomId,hostId,peerId;
  async function enterRoom(){
  await nativeClick(host,'[data-room-card-create]');
  await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')?.matches(':enabled')`);
  await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');
  await waitUntil(host,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);await nativeClick(host,'[data-room-create-confirm]');
  await condition(()=>state(host)?.phase==='WAITING','Host WAITING');
  await waitUntil(host,`!document.querySelector('[data-room-create-dialog][open]')&&(()=>{const w=JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null');return w?.mapLoaded&&w.phase==='WAITING'})()`);
  roomId=state(host).roomId;
  await waitUntil(peer,`document.querySelector('[data-room-card-id="${roomId}"]')?.matches(':enabled')`);
  await nativeClick(peer,`[data-room-card-id="${roomId}"]`);
  const point=await evaluate(peer,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...point},peer);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...point},peer);
  await condition(()=>state(peer)?.roomId===roomId&&state(host)?.players.length===2,'Dual Join');
  for(const session of [peer,host]){await waitUntil(session,`(()=>{const w=JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null');return w?.mapLoaded&&w.renderedPlayers===2})()`);await waitUntil(session,`document.querySelector('[data-waiting-ready]')?.matches(':enabled')`);await nativeClick(session,'[data-waiting-ready]');}
  await condition(()=>state(host)?.phase==='PLAYING'&&state(peer)?.phase==='PLAYING','PLAYING');
  hostId=lastResponse('CreateRoom')?.playerId;peerId=lastResponse('Join',peer)?.playerId;assert(hostId&&peerId);
  evidence.rooms.push({roomId,hostId,peerId,created:lastResponse('CreateRoom'),joined:lastResponse('Join',peer),initial:[state(host),state(peer)]});
  }
  async function homeClose(session,label){await stageWait(session,label+'.CloseReady',`document.querySelector('[data-home-close]')?.matches(':enabled')`);await nativeClick(session,'[data-home-close]');await stageWait(session,label+'.StrictClose',`!document.querySelector('#home-inventory[open]')&&document.activeElement.matches('[data-room-card-home]')`);}
  let bought,instanceId;
  if(first){bought=reusedPurchase.confirmed;instanceId=reusedPurchase.instanceId;}else {
  // Buying and assigning use only the ordinary rendered Shop/Home controls.
  await nativeClick(host,'[data-room-card-shop]');
  await stageWait(host,'Shop.resourceReady',`document.querySelector('#account-shop[open]')?.getAttribute('aria-busy')==='false'`);
  await stageWait(host,'Shop.WeaponCategoryReady',`document.querySelector('[data-shop-category="Weapon"]')?.matches(':enabled')`);await nativeClick(host,'[data-shop-category="Weapon"]');
  await stageWait(host,'Shop.3001RowReady',`document.querySelector('[data-shop-product-id="3001"]')?.matches(':enabled')`);
  await nativeClick(host,'[data-shop-product-id="3001"]');
  await stageWait(host,'Shop.3001SelectedReady',`document.querySelector('[data-shop-description]')?.dataset.itemTableId==='3001'&&document.querySelector('[data-shop-buy]')?.matches(':enabled')`);
  const query=lastResponse('Shop');assert.equal(query.items.find(i=>i.itemTableId===3001).moneyPrice,20);
  assert.equal(await evaluate(host,`document.querySelector('[data-shop-currency]').value`),'MONEY');
  await nativeClick(host,'[data-shop-quantity]');for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},host);await command('Input.insertText',{text:'1'},host);
  const buyStart=network.length;await nativeClick(host,'[data-shop-buy]');
  await condition(()=>network.some(n=>n.index>=buyStart&&n.page===host&&n.name==='Shop'&&n.direction==='received'&&n.success&&n.response.purchased?.itemTableId===3001),'Confirmed ordinary BUY3001');
  bought=network.findLast(n=>n.index>=buyStart&&n.page===host&&n.name==='Shop'&&n.direction==='received'&&n.success&&n.response.purchased?.itemTableId===3001).response;instanceId=bought.purchased.instanceId;
  assert.equal(bought.money,query.money-20);assert.equal(bought.tokens,query.tokens);assert(instanceId>0);assert.notEqual(instanceId,sourceBomb.instanceId);assert.equal(bought.purchased.ownedQuantity,1);
  evidence.purchase={before:query,confirmed:bought,instanceId};
  await nativeClick(host,'[data-shop-close]');await waitUntil(host,`!document.querySelector('#account-shop[open]')`);
  }
  const inventoryStart=network.length;await nativeClick(host,'[data-room-card-home]');
  await condition(()=>network.some(n=>n.index>=inventoryStart&&n.page===host&&n.name==='Inventory'&&n.direction==='received'&&n.success),'Actual Home Inventory after BUY');
  await waitUntil(host,`document.querySelector('#home-inventory button[data-source-control="rdoWeapon"]')?.matches(':enabled')`);await nativeClick(host,'#home-inventory button[data-source-control="rdoWeapon"]');
  await stageWait(host,'Home.3001OwnedReady',`document.querySelector('[data-inventory-instance="${instanceId}"]')?.matches(':enabled')`);
  const inventory=lastResponse('Inventory'),owned=inventory.records.find(r=>r.instanceId===instanceId);assert.equal(owned.itemTableId,3001);assert.equal(owned.ownedQuantity,1);assert.deepEqual(inventory.records.find(r=>r.instanceId===sourceBomb.instanceId),sourceBomb);
  await nativeClick(host,`[data-inventory-instance="${instanceId}"]`);const assignStart=network.length;await nativeClick(host,'[data-kitbag-slot="1"]');
  await condition(()=>network.some(n=>n.index>=assignStart&&n.page===host&&n.name==='Kitbag'&&n.direction==='received'&&n.success&&n.response.slot===1&&n.response.instanceId===instanceId),'Confirmed ordinary slot1 assign');
  assert.equal(lastResponse('Kitbag').hotkeys[0],instanceId);await waitUntil(host,`document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId==='${instanceId}'`);
  evidence.kitbag={inventory,confirmed:lastResponse('Kitbag'),web:await evaluate(host,`document.querySelector('[data-kitbag-slot="1"]').outerHTML`)};
  await homeClose(host,'InitialHome');await enterRoom();
  const actor=(snapshot,id)=>snapshot.players.find(p=>p.id===id);
  const key=(session,type,code,key,virtual)=>command('Input.dispatchKeyEvent',{type,code,key,windowsVirtualKeyCode:virtual},session);
  const selectEvents=(session,type,skill)=>(events.get(session)??[]).filter(e=>e.roomId===roomId&&e.type===type&&(skill===undefined||e.skillId===skill));
  async function sharedAfter(label){
    const afterAt=Date.now(),snapshotKey=s=>JSON.stringify([s.roomId,s.match.round,s.phase,s.tick,s.serverTime]);
    const common=()=>{const peerFrames=new Map((snapshots.get(peer)??[]).map(f=>[snapshotKey(f.snapshot),f.snapshot]));const f=(snapshots.get(host)??[]).findLast(f=>f.wallTime>=afterAt&&f.snapshot.roomId===roomId&&f.snapshot.phase==='PLAYING'&&peerFrames.has(snapshotKey(f.snapshot)));return f?[f.snapshot,peerFrames.get(snapshotKey(f.snapshot))]:undefined;};
    await condition(()=>Boolean(common()),'Full shared '+label);const result=common();assert.deepEqual(result[0],result[1]);evidence[label].snapshots=result;
    evidence[label].webStates=await Promise.all([host,peer].map(s=>evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
    evidence[label].webAuthority=[];
    for(const [index,session] of [host,peer].entries()){
      const web=evidence[label].webStates[index];assert(web,'Confirmed webpage world');
      const matching=()=>(snapshots.get(session)??[]).findLast(frame=>frame.snapshot.roomId===web.roomId&&frame.snapshot.match.round===web.match.round&&frame.snapshot.phase===web.phase&&frame.snapshot.tick===web.tick)?.snapshot;
      await condition(()=>Boolean(matching()),label+' webpage same-connection authoritative frame');
      const authoritative=matching();assert.equal(web.roomId,roomId);assert.equal(web.match.round,result[0].match.round);assert.equal(web.phase,'PLAYING');
      assert.deepEqual(web.players,authoritative.players);evidence[label].webAuthority.push({page:session,snapshot:authoritative});
    }
    return result;
  }
  async function closeRoom(){
  const closure={roomId,leaves:[]};
  for(const [index,session] of [peer,host].entries()){
    const who=index===0?'peer':'host';
    if(index===1)await condition(()=>state(host)?.phase==='FINISHED','Host FINISHED after peer leaves');
    const phase=state(session)?.phase;assert.equal(phase,index===0?'PLAYING':'FINISHED');
    const selector=index===0?'[data-leave-room]':'[data-summary-leave]';
    await stageWait(session,who+'.'+phase+'.sourceExitReady',`document.querySelector('${selector}')?.matches(':enabled')`);
    await nativeClick(session,selector);
    await condition(()=>lastResponse('Leave',session)?.roomId===roomId,who+' confirmed Leave');
    closure.leaves.push({page:session,phase,selector,confirmed:lastResponse('Leave',session)});
    await stageWait(session,who+'.Leave.lobbyGate',`!document.querySelector('#battle-status')?.dataset.world&&document.querySelector('[data-room-card-home]')?.matches(':enabled')`);
  }
  evidence.roomClosures.push(closure);
  }
  const initial=state(host);assert.equal(actor(initial,hostId).ammoItemId,2001);assert.equal(actor(initial,peerId).ammoItemId,2001);
  evidence.initial=[initial,state(peer)];
  // Bring the real guest into the square before placing the five-second object.
  await nativeClick(peer,'#world');const navigation=[];const approachDeadline=Date.now()+20000;
  while(Date.now()<approachDeadline){const s=state(host),me=actor(s,peerId),target=actor(s,hostId),dx=target.x-me.x,dz=target.z-me.z;
    if(Math.max(Math.abs(dx),Math.abs(dz))<=90)break;
    const bearing=Math.atan2(dx,dz),error=Math.atan2(Math.sin(bearing-me.bodyYaw),Math.cos(bearing-me.bodyYaw));
    navigation.push({snapshot:s,error});
    const code=Math.abs(error)>.08?(error>0?'KeyA':'KeyD'):'KeyW',letter=code==='KeyA'?'a':code==='KeyD'?'d':'w',virtual=code==='KeyA'?65:code==='KeyD'?68:87;
    await key(peer,'keyDown',code,letter,virtual);try{await new Promise(r=>setTimeout(r,Math.abs(error)>.08?Math.min(120,Math.max(40,Math.abs(error)*150)):120));}finally{await key(peer,'keyUp',code,letter,virtual);}
    await new Promise(r=>setTimeout(r,100));
  }
  await new Promise(r=>setTimeout(r,200));const before=state(host),owner=actor(before,hostId),victim=actor(before,peerId);
  assert(Math.abs(owner.x-victim.x)<=100&&Math.abs(owner.z-victim.z)<=100,'Ordinary guest in square');assert(victim.hp>300,'Survive direct300');
  evidence.approach={navigation,before};
  await nativeClick(host,'#world');evidence.placement={before,pressedAt:Date.now()};
  await key(host,'keyDown','Digit2','2',50);try{await new Promise(r=>setTimeout(r,80));}finally{await key(host,'keyUp','Digit2','2',50);evidence.placement.releasedAt=Date.now();}
  await condition(()=>selectEvents(host,'trapPlaced',3001).length===1&&selectEvents(peer,'trapPlaced',3001).length===1,'Dual placed3001');
  assert.deepEqual(selectEvents(host,'trapPlaced',3001),selectEvents(peer,'trapPlaced',3001));
  const trap=state(host).match.groundTraps.find(t=>t.itemTableId===3001&&t.ownerId===hostId);assert(trap);assert.equal(trap.modelId,3001);
  await condition(()=>lastResponse('Inventory')&&!lastResponse('Inventory').records.some(r=>r.instanceId===instanceId&&r.ownedQuantity>0),'Confirmed consumed Inventory refresh',3000);evidence.battleInventoryAfter=lastResponse('Inventory');
  evidence.placement.trap=trap;evidence.placement.events=[selectEvents(host,'trapPlaced',3001),selectEvents(peer,'trapPlaced',3001)];
  await sharedAfter('placement');
  await condition(()=>selectEvents(host,'trapTriggered',3009).length===1&&selectEvents(peer,'trapTriggered',3009).length===1,'Fixed5s dual trigger',12000);
  await condition(()=>selectEvents(host,'hit',3012).length===1&&selectEvents(peer,'hit',3012).length===1,'Dual direct300 hit',3000);
  const hit=selectEvents(host,'hit',3012)[0];assert.equal(hit.value,300);assert.equal(hit.playerId,hostId);assert.equal(hit.targetId,peerId);assert.equal(hit.shotPlayerResult,undefined);
  assert.deepEqual(selectEvents(host,'hit',3012),selectEvents(peer,'hit',3012));
  evidence.blast={trigger:[selectEvents(host,'trapTriggered',3009),selectEvents(peer,'trapTriggered',3009)],hits:[selectEvents(host,'hit',3012),selectEvents(peer,'hit',3012)]};
  assert.deepEqual(...evidence.blast.trigger);const after=await sharedAfter('blast');
  for(const s of after){assert.equal(actor(s,peerId).hp,victim.hp-300);assert.equal(actor(s,hostId).hp,owner.hp);assert(!s.match.groundTraps.some(t=>t.id===trap.id));}
  const frames=(snapshots.get(host)??[]).map(f=>f.snapshot).filter(s=>s.roomId===roomId&&s.tick>=before.tick);
  const firstPresent=frames.find(s=>s.match.groundTraps.some(t=>t.id===trap.id)),lastAbsentBefore=frames.findLast(s=>s.tick<firstPresent.tick&&!s.match.groundTraps.some(t=>t.id===trap.id));
  assert(firstPresent&&lastAbsentBefore);assert(trap.expiresAt>=lastAbsentBefore.serverTime+5000&&trap.expiresAt<=firstPresent.serverTime+5000);
  for(const s of frames.filter(s=>s.serverTime<trap.expiresAt)){assert.equal(actor(s,peerId).hp,victim.hp);assert.equal(actor(s,hostId).hp,owner.hp);}
  const firstDamage=frames.find(s=>actor(s,peerId).hp!==victim.hp);assert(firstDamage.serverTime>=trap.expiresAt);evidence.deadline={firstPresent,lastAbsentBefore,firstDamage};
  for(const session of [host,peer])await waitUntil(session,`window.oldBombEvidence.draws.some(d=>d.sourceModel==='Data/scnobj/03001/03001.POL'&&d.vertices>0)&&window.oldBombEvidence.draws.some(d=>d.root==='010'&&d.vertices>0)&&window.oldBombEvidence.draws.some(d=>d.root==='009'&&d.vertices>0)`,8000);
  evidence.visual=await Promise.all([host,peer].map(session=>evaluate(session,'window.oldBombEvidence')));
  for(const out of evidence.visual){
    for(const suffix of ['010','009']){const calls=out.worldCalls.filter(r=>r.name.endsWith(suffix));assert.equal(calls.length,1);assert(calls[0].handle>0);assert.equal(calls[0].soundNodeCount,0);assert.deepEqual(calls[0].sounds,[]);assert.equal(calls[0].notification.roleId,0);assert.equal(calls[0].notification.effectIndex,0);assert.equal(calls[0].notification.skillId,suffix==='010'?3001:3009);assert(Math.abs(calls[0].origin[0]-trap.x)<1e-3&&Math.abs(calls[0].origin[2]-trap.z)<1e-3);}
    const ground=out.draws.filter(d=>d.groundId===trap.id&&d.sourceModel==='Data/scnobj/03001/03001.POL');assert(ground.some(d=>d.vertices>0&&d.alpha>0));assert(ground.some(d=>Math.abs(d.matrix[12]+trap.x)<1e-3&&Math.abs(d.matrix[14]-trap.z)<1e-3));
    for(const suffix of ['010','009'])assert(out.draws.some(d=>d.root===suffix&&d.vertices>0&&d.drawOwner&&d.vertexAlphas.some(alpha=>alpha>0)));
  }
  await closeRoom();
  for(const [index,session] of [peer,host].entries()){
    const inventoryStart=network.length;await nativeClick(session,'[data-room-card-home]');
    await condition(()=>network.some(n=>n.index>=inventoryStart&&n.page===session&&n.name==='Inventory'&&n.direction==='received'&&n.success),'Final ordinary Home Inventory');
    if(session===host){const final=lastResponse('Inventory'),record=final.records.find(r=>r.instanceId===instanceId);assert.equal(record?.ownedQuantity??0,owned.ownedQuantity-1);assert.deepEqual(final.records.find(r=>r.instanceId===sourceBomb.instanceId),sourceBomb);assert.equal(final.hotkeys[0],instanceId);evidence.inventoryAfter=final;}
    await homeClose(session,index===0?'PeerFinalHome':'HostFinalHome');
  }
  evidence.strictClose=true;evidence.visualCleanup=await Promise.all([host,peer].map(s=>evaluate(s,'window.oldBombCleanup()')));
  for(const c of evidence.visualCleanup){assert(c.groundEntries.every(n=>n===0));assert(c.targetMeshes.every(n=>n===0));assert(c.targetInstances.every(n=>n===0));}
  async function authenticateCold(){
    coldClients=[0,1].map(()=>new WsClient(serviceProto,{server:'ws://127.0.0.1:3663',logger:undefined}));
    for(const [index,client] of coldClients.entries()){
      assert((await client.connect()).isSucc,'Normal cold transport');
      const result=await client.callApi('Account',{token:fixture.accounts[index].token});assert(result.isSucc,'Normal retained Account auth');
      if(fixture.accounts[index].accountId)assert.equal(result.res.accountId,fixture.accounts[index].accountId);
    }
  }
  async function coldQuery(client){
    const query=async(name,request)=>{const response=await client.callApi(name,request);assert(response.isSucc,'Cold '+name+' confirmed');return response.res;};
    const result={inventory:await query('Inventory',{}),equipment:await query('Equipment',{operation:'QUERY'}),owned:await query('OwnedRoles',{}),learning:await query('PetSkillLearning',{operation:'QUERY'})};
    assert(result.inventory.records.every(record=>record.battleQuantity===0),'Out-of-room cold quantity');return result;
  }
  await authenticateCold();evidence.coldBeforeRestart=[];
  for(const client of coldClients)evidence.coldBeforeRestart.push(await coldQuery(client));
  assert.deepEqual(evidence.coldBeforeRestart[0].inventory,evidence.inventoryAfter);
  const nativeDb=new DatabaseSync(database,{readOnly:true});try{evidence.nativeBeforeRestart=fixture.accounts.map((account,index)=>{const row=nativeDb.prepare('SELECT payload, strings FROM role_profiles WHERE account_id=?').get(account.accountId),profile={bytes:[...row.payload],strings:JSON.parse(String(row.strings))};assert.deepEqual(profile,evidence.coldBeforeRestart[index].equipment.profile);const inventory=nativeDb.prepare('SELECT record FROM inventory WHERE account_id=? ORDER BY instance_id').all(account.accountId).map(r=>JSON.parse(String(r.record)));assert.deepEqual(inventory,evidence.coldBeforeRestart[index].inventory.records);const owned={base:[],equipment:[]};for(const r of nativeDb.prepare('SELECT kind, record FROM role_records WHERE account_id=? ORDER BY instance_id').all(account.accountId))owned[r.kind==='base'?'base':'equipment'].push(JSON.parse(String(r.record)));assert.deepEqual(owned,evidence.coldBeforeRestart[index].owned);const hotkeys=Array(7).fill(0);for(const r of nativeDb.prepare('SELECT slot, instance_id FROM hotkeys WHERE account_id=? ORDER BY slot').all(account.accountId))hotkeys[r.slot-1]=r.instance_id;assert.deepEqual(hotkeys,evidence.coldBeforeRestart[index].inventory.hotkeys);return {profile,inventory,owned,hotkeys};});const buyRequest=first?{payload:reusedPurchase.request}:network.find(n=>n.direction==='sent'&&n.name==='Shop'&&n.payload?.operation==='BUY');const receipt=nativeDb.prepare('SELECT receipt FROM shop_purchases WHERE account_id=? AND request_id=?').get(fixture.accounts[0].accountId,buyRequest.payload.requestId);evidence.nativePurchaseReceipt=JSON.parse(String(receipt.receipt));assert.deepEqual(evidence.nativePurchaseReceipt,bought.purchased);for(const row of evidence.retainedReceipts)assert.equal(nativeDb.prepare('SELECT receipt FROM shop_purchases WHERE account_id=? AND request_id=?').get(row.account_id,row.request_id).receipt,row.receipt);}finally{nativeDb.close();}
  for(const client of coldClients)await client.disconnect();coldClients=[];
  await stop(server);evidence.compiledStoppedBeforeRestart=true;await startServer();
  await authenticateCold();evidence.coldAfterRestart=[];
  for(const client of coldClients)evidence.coldAfterRestart.push(await coldQuery(client));
  assert.deepEqual(evidence.coldAfterRestart,evidence.coldBeforeRestart);evidence.sameDatabaseCompiledRestart=true;
  for(const client of coldClients)await client.disconnect();coldClients=[];

  const writes=network.filter(n=>n.direction==='sent'&&['BUY','LEARN','MAINTAIN','SELL','EQUIP','UNEQUIP','ASSIGN','CANCEL'].includes(n.payload?.operation));
  assert.equal(writes.length,first?1:2);const assign=writes.at(-1);assert.equal(assign.name,'Kitbag');assert.equal(assign.payload.operation,'ASSIGN');assert.equal(assign.payload.slot,1);assert.equal(assign.payload.instanceId,instanceId);if(!first){assert.equal(writes[0].name,'Shop');assert.equal(writes[0].payload.itemTableId,3001);assert.equal(writes[0].payload.quantity,1);}
  assert.equal([...events.values()].flat().filter(e=>e.type==='playerHealed'||e.type==='fire'||e.type==='destroy').length,0);
  assert.equal(evidence.runtime.filter(r=>r.method==='Runtime.exceptionThrown').length,0);
  evidence.status='PASS_FINITE_ORDINARY_BUY_KITBAG_3001_NATIVE_TIMED300_BLAST_ORIGINAL_GROUND_WORLD_EFFECT_DRAW_DUAL_STATE_NATIVE_RESTART_SUMMARY_HOME_CLOSE_SCOPE';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
  evidence.visualFinally=[];for(const page of pages){try{evidence.visualFinally.push({page:page.sessionId,evidence:await evaluate(page.sessionId,'window.oldBombEvidence')});}catch(error){evidence.observerSaveError=String(error);}}
  for(const client of coldClients)await client.disconnect();coldClients=[];
  try{const db=new DatabaseSync(database,{readOnly:true});try{evidence.savedCheckpoint=output+'-checkpoint.sqlite';await backup(db,evidence.savedCheckpoint);await chmod(evidence.savedCheckpoint,0o600);}finally{db.close();}await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:evidence.savedCheckpoint,accounts:fixture.accounts,source:checkpoint,newFundsOrRecordsInjected:false})+'\n',{mode:0o600});}catch(error){evidence.checkpointError=String(error);}
  evidence.nativeKeyEvents=[];for(const page of pages){try{evidence.nativeKeyEvents.push({page:page.sessionId,events:await evaluate(page.sessionId,'window.oldBombKeyEvents??[]')});}catch(error){evidence.nativeKeyObserverError=String(error);}}
  evidence.snapshotRetention={maximumPerPage:1000,fullSessionClaim:false};evidence.playerInputs=network.filter(n=>n.name==='PlayerInput'&&n.direction==='sent');
  evidence.eventTimes=eventTimes;evidence.network=network;evidence.snapshots=[...snapshots].map(([page,frames])=>({page,frames}));evidence.events=[...events].map(([page,rows])=>({page,rows}));
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
}
