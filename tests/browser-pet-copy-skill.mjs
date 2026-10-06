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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3665',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-pet-copy-skill-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-pet-copy-skill-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
let coldClients=[];
const tailIndex=process.argv.indexOf('--unreached-tail'),parentPath=tailIndex>=0?process.argv[tailIndex+1]:undefined;
const parent=parentPath?JSON.parse(await readFile(parentPath,'utf8')):undefined;
const clearParent=parent?.error==='Error: Dual clearedInjury0 hit'?parent:undefined;
const firstPath=clearParent?clearParent.firstScope.raw:parentPath;
const first=clearParent?JSON.parse(await readFile(firstPath,'utf8')):parent;
const firstRootReviewPath='recovery/output/pet-copy-skill-browser-first-root-review.json';
let firstRootReview;
if(first){
 firstRootReview=JSON.parse(await readFile(firstRootReviewPath,'utf8'));assert.equal(firstRootReview.raw,firstPath);assert.equal(firstRootReview.status,'ACCEPTED_FINITE_LEARNED_PET102_PET103_HOME_ORDINARY_FOOD_BUY_KITBAG_HOSTILE_COPY10811_FOOD240_DUAL_STATE_NATIVE_ONLY_CLEAR_CLOSE_RESTART_UNREACHED_SCOPE');assert.equal(firstRootReview.nativeAllTablesExpectedEqual,true);assert.equal(firstRootReview.nativeRemainingQuantity,1);assert.equal(firstRootReview.sourceOwnedAndReceiptsPreserved,true);assert.equal(firstRootReview.perHitFullSameKeyWebOwnTick,true);assert.equal(firstRootReview.dualBenefitShowOnce,true);assert.equal(firstRootReview.checkpoint,first.savedCheckpoint);
 assert.equal(first.status,'FAIL');assert.equal(first.error,'Error: Dual food heal copiedFood');assert.equal(first.acceptedHits,8);
 assert.equal(first.hostHome.instanceId,16);assert.equal(first.victimHome.instanceId,4);
 const buys=first.network.filter(n=>n.direction==='sent'&&n.payload?.operation==='BUY');assert.equal(buys.length,1);assert.equal(buys[0].name,'Shop');assert.equal(buys[0].payload.itemTableId,1);assert.equal(buys[0].payload.quantity,2);assert.equal(buys[0].payload.currency,'MONEY');
 assert.equal(first.purchase.confirmed.purchased.instanceId,18);assert.equal(first.purchase.confirmed.purchased.ownedQuantity,2);assert.equal(first.kitbag.slot,4);assert.equal(first.kitbag.instanceId,18);assert.equal(first.kitbag.hotkeys[3],18);
 assert.equal(first.initialInjury.length,3);assert.equal(first.copyKill.length,5);
 const id=first.rooms[0].hostId;assert(first.copied.snapshots.every(s=>s.players.find(p=>p.id===id).roleSkillSources.selectedSkillIds.includes(10811)));
 const items=first.events.map(page=>page.rows.filter(e=>e.type==='itemUsed'&&e.skillId===1&&e.playerId===id&&e.targetId===id));assert(items.every(rows=>rows.length===1&&rows[0].value===240));assert.deepEqual(items[0],items[1]);
 assert.equal(first.runtime.filter(r=>r.method==='Runtime.exceptionThrown').length,0);assert(!first.clearedFood&&!first.sameDatabaseCompiledRestart);assert(first.savedCheckpoint);
 assert.deepEqual(first.processCleanup,{chromeStopped:true,serverStopped:true,viteClosed:true,tempRemoved:true});
}
const clearRootReviewPath='recovery/output/pet-copy-skill-browser-clear-root-review.json';
let clearRootReview;
if(clearParent){
 clearRootReview=JSON.parse(await readFile(clearRootReviewPath,'utf8'));
 assert.equal(clearRootReview.raw,parentPath);assert.equal(clearRootReview.status,'ACCEPTED_FINITE_HOSTILE_COPY10811_NATIVE_FINAL_DEATH_RESPAWN_CLEAR_DUAL_STATE_NATIVE_UNCHANGED_ONLY_TERRAIN_BLOCKED_FOOD200_CLOSE_RESTART_UNREACHED_SCOPE');
 assert.equal(clearRootReview.firstRootReview,firstRootReviewPath);assert.equal(clearRootReview.actualSession,93398);assert.equal(clearRootReview.actualExit,1);
 for(const field of ['perHitFullSameKeyWebOwnTick','copiedSkillClearedAtDeathAndRespawn','dualLife09Then01Once','nativeAllTablesUnchanged'])assert.equal(clearRootReview[field],true);
 assert.equal(clearRootReview.nativeFoodInstance,18);assert.equal(clearRootReview.nativeRemainingQuantity,1);assert.equal(clearRootReview.newBuyAssignFoodConsumption,0);assert.equal(clearRootReview.runtimeExceptions,0);assert.equal(clearRootReview.checkpoint,clearParent.savedCheckpoint);
 assert.equal(clearParent.status,'FAIL');assert.equal(clearParent.error,'Error: Dual clearedInjury0 hit');assert.equal(clearParent.acceptedHits,11);assert.equal(clearParent.copyKill.length,6);assert.equal(clearParent.learnerDeath.length,5);assert.equal(clearParent.clearedInjury.length,0);
 assert.equal(clearParent.firstScope.raw,firstPath);assert.equal(clearParent.firstScope.rootReview,firstRootReviewPath);
 const id=clearParent.rooms[0].hostId;
 for(const [field,alive,hp] of [['copied',true,650],['cleared',false,0],['respawn',true,650]]){
  const frames=clearParent[field].snapshots;assert.equal(frames.length,2);assert.deepEqual(frames[0],frames[1]);
  for(const frame of frames){const actor=frame.players.find(player=>player.id===id);assert.equal(actor.alive,alive);assert.equal(actor.hp,hp);assert.equal(actor.roleSkillSources.selectedSkillIds.includes(10811),field==='copied');}
 }
 assert.equal(clearParent.observationFinally.length,2);
 for(const page of clearParent.observationFinally){const rows=page.evidence.lifeTransitions.filter(row=>row.targetId===id&&row.completed);assert.equal(rows.filter(row=>row.alive===false&&row.action==='09').length,1);assert.equal(rows.filter(row=>row.alive===true&&row.action==='01').length,1);}
 assert(!clearParent.network.some(row=>row.direction==='sent'&&(row.payload?.operation==='BUY'||row.name==='Kitbag')));
 assert(clearParent.events.every(page=>!page.rows.some(row=>row.type==='itemUsed')));assert(!clearParent.clearedFood&&!clearParent.sameDatabaseCompiledRestart);
 assert.equal(clearParent.runtime.filter(row=>row.method==='Runtime.exceptionThrown').length,0);assert.deepEqual(clearParent.processCleanup,{chromeStopped:true,serverStopped:true,viteClosed:true,tempRemoved:true});
}
const fixtureIndex=process.argv.indexOf('--fixture'),databaseIndex=process.argv.indexOf('--database'),oracleIndex=process.argv.indexOf('--oracle');
assert(first||fixtureIndex>=0&&databaseIndex>=0&&oracleIndex>=0,'Explicit final source or identified first actual');
const fixturePath=parent?parentPath.slice(0,-5)+'-checkpoint-fixture.json':process.argv[fixtureIndex+1],fixture=JSON.parse(await readFile(fixturePath,'utf8')),checkpoint=parent?parent.savedCheckpoint:process.argv[databaseIndex+1];
if(parent)assert.equal(fixture.database,checkpoint);
const oracle=parent?parent.oracle:JSON.parse(await readFile(process.argv[oracleIndex+1],'utf8'));
assert(fixture.accounts?.length===2&&fixture.accounts.every(a=>a.token));
assert.deepEqual(oracle.victimSkill,{petId:103,slot:0,baseId:10811,rank:1,resolvedId:10811});
for(const field of ['hostFrontBaseDamage','peerFrontBaseDamage'])assert(Number.isFinite(oracle[field])&&oracle[field]>0);
assert.equal(oracle.copiedFoodHealing,240);assert.equal(oracle.clearedFoodHealing,200);
assert(Number.isInteger(oracle.maximumAcceptedHits)&&oracle.maximumAcceptedHits>0);
const snapshots=new Map(),events=new Map(),eventTimes=[];
const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const pages=[],contexts=[];
const evidence={status:'RUNNING',runId,rooms:[],roomClosures:[],domStages:[],ports:{server:3665,vite:5695,cdp:9895},fixture:{source:checkpoint,fixturePath,newFundsOrRecordsInjected:false,newPetBuyOrLearn:false,ordinaryFoodPurchase:!first},oracle,acceptedHits:0,scope:'Selected learnt Pet10210711 and explicit learnt victim passive; native hostile final kill/selectedSkillIds copy, copied food240 and life-cleared food200 consumer, learner natural death/respawn clears, dual complete snapshot/webownTick and normal phase Leave/HomeClose; normal BUYfood2/Kitbag4, no newwire/FX',runtime:[]};
if(first)evidence.firstScope={raw:firstPath,rootReview:firstRootReviewPath,rootReviewStatus:firstRootReview.status,nativeAllTablesExpectedEqual:firstRootReview.nativeAllTablesExpectedEqual,actualSession:89140,actualExit:1,home:[first.hostHome,first.victimHome],purchase:first.purchase,kitbag:first.kitbag,copied:first.copied,food240:first.events.map(page=>page.rows.filter(e=>e.type==='itemUsed'&&e.skillId===1)),newOrdinaryRoom:true,oldSessionRestored:false};
if(clearParent){
 evidence.clearScope={raw:parentPath,rootReview:clearRootReviewPath,rootReviewStatus:clearRootReview.status,actualSession:93398,actualExit:1,nativeAllTablesUnchanged:true,copied:clearParent.copied,finalDeath:clearParent.cleared,respawn:clearParent.respawn,dualLife09Then01Once:true,perHitFullSameKeyWebOwnTick:true,foodInstance:18,remainingQuantity:1,fullSessionClaim:false};
 evidence.scope='Referenced first Home/BUY/Kitbag/copy240 and separate natural death/respawn clear; new ordinary room starts without10811, native peer injury deficit>=200, sole remaining food200, dual fullsamekey/webownTick, normal Leave/HomeClose and sameDB cold restart';
}
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
  await command('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',clickCount:1,...point}, session);
  await command('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',clickCount:1,...point}, session);
}
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3665',ACCOUNT_DB_PATH:database};server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  const sourceDb=new DatabaseSync(checkpoint,{readOnly:true});try{evidence.retainedReceipts=sourceDb.prepare('SELECT account_id, request_id, receipt FROM shop_purchases ORDER BY account_id, request_id').all();evidence.sourceTables=sourceDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);if(first){const record=sourceDb.prepare('SELECT record FROM inventory WHERE account_id=? AND instance_id=?').get(fixture.accounts[0].accountId,18);assert.equal(JSON.parse(record.record).ownedQuantity,1);const assigned=sourceDb.prepare('SELECT instance_id FROM hotkeys WHERE account_id=? AND slot=4').get(fixture.accounts[0].accountId);assert.equal(assigned.instance_id,18);}}finally{sourceDb.close();}
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5695,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3665',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9895',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9895/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9895');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Runtime.enable',{},sessionId);await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.accounts[index].token)+');'},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:`window.copySkillKeyEvents=[];for(const type of ['keydown','keyup'])window.addEventListener(type,event=>{if(!['Digit5','Space','ArrowLeft','ArrowRight','KeyA','KeyD','KeyW','KeyS'].includes(event.code))return;const target=event.target;window.copySkillKeyEvents.push({type,code:event.code,key:event.key,isTrusted:event.isTrusted,wallTime:Date.now(),target:target instanceof Element?{tag:target.tagName,id:target.id}:null,focus:document.activeElement?.outerHTML,world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null')});},true);`},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:`
window.copySkillEvidence={lifeTransitions:[],shows:[],benefitShows:[],ready:false};
window.copySkillReady=(async()=>{
 const [{BattlePlayers},{TankView},{TankDamageText},{TankBenefitText}]=await Promise.all([import('/src/render/battle-players.ts'),import('/src/assets/tanks/tank-view.ts'),import('/src/assets/tanks/tank-damage-text.ts'),import('/src/assets/tanks/tank-benefit-text.ts')]);
 const out=window.copySkillEvidence,targets=new WeakMap();let context;
 const render=BattlePlayers.prototype.render;BattlePlayers.prototype.render=function(...args){for(const [id,view] of this.players)targets.set(view,id);return render.apply(this,args);};
 const life=TankView.prototype.life;TankView.prototype.life=function(alive){const changed=!this.disposed&&this.alive!==alive,row=changed?{targetId:targets.get(this),alive,previousAlive:this.alive,wallTime:Date.now()}:undefined;if(row)out.lifeTransitions.push(row);const result=life.call(this,alive);if(row)Promise.resolve(result).then(()=>{row.completed=true;row.action=this.activeAction;},error=>{row.error=String(error);});return result;};
 const damage=BattlePlayers.prototype.damage;BattlePlayers.prototype.damage=function(targetId,value,isLocal,critical=false){const previous=context;context={targetId,value,isLocal,critical,wallTime:Date.now()};try{return damage.call(this,targetId,value,isLocal,critical);}finally{context=previous;}};
 const show=TankDamageText.prototype.show;TankDamageText.prototype.show=function(screenX,screenY,damage,isLocal,critical=false){out.shows.push({context:{...context},screenX,screenY,damage,isLocal,critical,wallTime:Date.now()});return show.call(this,screenX,screenY,damage,isLocal,critical);};
 let benefitContext;
 const benefit=BattlePlayers.prototype.benefit;BattlePlayers.prototype.benefit=function(targetId,increase,isLocal){const previous=benefitContext;benefitContext={targetId,increase,isLocal,wallTime:Date.now()};try{return benefit.call(this,targetId,increase,isLocal);}finally{benefitContext=previous;}};
 const benefitShow=TankBenefitText.prototype.show;TankBenefitText.prototype.show=function(x,y,increase,isLocal=false){out.benefitShows.push({context:{...benefitContext},increase,isLocal,wallTime:Date.now()});return benefitShow.call(this,x,y,increase,isLocal);};
 out.ready=true;
})();`},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5695'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-entry-page="login"] button[data-source-control="btnLogin"]')?.matches(':enabled')`);
    await nativeClick(sessionId,'[data-entry-page="login"] button[data-source-control="btnLogin"]');
    await waitUntil(sessionId,`document.querySelector('[data-channel-id="main"]')?.matches(':enabled')`);
    await nativeClick(sessionId,'[data-channel-id="main"]');
    const channelPoint=await evaluate(sessionId,`(()=>{const r=document.querySelector('[data-channel-id="main"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...channelPoint},sessionId);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...channelPoint},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')`);

    await evaluate(sessionId,'window.copySkillReady.then(()=>true)');

  }

  const host=pages[0].sessionId,peer=pages[1].sessionId;
  const state=session=>(snapshots.get(session)??[]).at(-1)?.snapshot;
  const lastResponse=(name,session=host)=>network.filter(n=>n.page===session&&n.direction==='received'&&n.name===name&&n.success).at(-1)?.response;
  async function condition(test,label,timeout=45000) {const until=Date.now()+timeout;while(Date.now()<until){if(test())return;await new Promise(r=>setTimeout(r,50));}throw new Error(label);}
  async function observe(session,label) {
    const dom=await evaluate(session,`(()=>{const world=document.querySelector('#battle-status')?.dataset.world;const selectors=['[data-room-card-home]','[data-leave-room]','[data-summary-leave]','[data-waiting-close]','[data-home-close]'];return {world:world?JSON.parse(world):null,buttons:selectors.map(selector=>{const e=document.querySelector(selector);return {selector,exists:!!e,disabled:e?.disabled,visible:e?e.getClientRects().length>0:false}}),openDialogs:[...document.querySelectorAll('dialog[open]')].map(e=>({id:e.id,ariaBusy:e.getAttribute('aria-busy')})),activeElement:document.activeElement?.outerHTML}})()`);
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
  async function selectedPetHome(session,expected,label){
    const start=network.length;await nativeClick(session,'[data-room-card-home]');await waitUntil(session,`document.querySelector('#home-inventory [data-role-tab="pet"]')?.matches(':enabled')`);await nativeClick(session,'#home-inventory [data-role-tab="pet"]');
    await condition(()=>network.some(n=>n.index>=start&&n.page===session&&n.name==='OwnedRoles'&&n.direction==='received'&&n.success)&&network.some(n=>n.index>=start&&n.page===session&&n.name==='RoleProfile'&&n.direction==='received'&&n.success),'Home both selected owned/profile '+label);
    const profile=lastResponse('RoleProfile',session).profile,id=new DataView(Uint8Array.from(profile.bytes).buffer).getUint32(0xa4,true),pet=lastResponse('OwnedRoles',session).base.find(r=>new Map(r.fields).get(0)===id);assert(pet);
    const fields=new Map(pet.fields);assert.equal(fields.get(8),expected.petId);assert.equal(fields.get(0x44+expected.slot*4),expected.baseId);assert.equal(fields.get(0x5c+expected.slot*4),expected.rank);
    await nativeClick(session,`[data-owned-role="${id}"]`);await waitUntil(session,`document.querySelector('[data-home-pet-skill="${expected.slot}"]')?.dataset.skillId==='${expected.resolvedId}'&&document.querySelector('[data-home-pet-skill="${expected.slot}"]').dataset.skillLevel==='${expected.rank}'`);
    await nativeClick(session,`[data-home-pet-view-skill="${expected.slot}"]`);await waitUntil(session,`document.querySelector('[data-pet-skill-dialog][open]')?.dataset.skillId==='${expected.resolvedId}'`);
    evidence[label]={profile,pet,instanceId:id,popup:await evaluate(session,`document.querySelector('[data-pet-skill-dialog][open]').textContent`)};
    await nativeClick(session,'[data-pet-skill-close]');await waitUntil(session,`!document.querySelector('[data-pet-skill-dialog][open]')`);await nativeClick(session,'[data-roles-close]');await waitUntil(session,`!document.querySelector('#home-roles')&&document.activeElement.matches('[data-room-card-home]')`);
  }
  let purchase,foodInstance;
  if(first){purchase=first.purchase.confirmed;foodInstance=18;evidence.purchase=first.purchase;evidence.kitbag=first.kitbag;evidence.hostHome=first.hostHome;evidence.victimHome=first.victimHome;}else{
  await selectedPetHome(host,{petId:102,slot:0,baseId:10711,rank:1,resolvedId:10711},'hostHome');
  await selectedPetHome(peer,oracle.victimSkill,'victimHome');
  await nativeClick(host,'[data-room-card-shop]');await stageWait(host,'FoodShopReady',`document.querySelector('#account-shop[open]')?.getAttribute('aria-busy')==='false'`);
  await nativeClick(host,'[data-shop-category="Item"]');await waitUntil(host,`document.querySelector('[data-shop-product-id="1"]')?.matches(':enabled')`);await nativeClick(host,'[data-shop-product-id="1"]');
  await waitUntil(host,`document.querySelector('[data-shop-description]')?.dataset.itemTableId==='1'&&document.querySelector('[data-shop-buy]')?.matches(':enabled')`);
  const shopBefore=lastResponse('Shop');assert.equal(await evaluate(host,`document.querySelector('[data-shop-currency]').value`),'MONEY');
  await nativeClick(host,'[data-shop-quantity]');for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},host);await command('Input.insertText',{text:'2'},host);
  const buyAt=network.length;await nativeClick(host,'[data-shop-buy]');await condition(()=>network.some(n=>n.index>=buyAt&&n.page===host&&n.name==='Shop'&&n.success&&n.response.purchased?.itemTableId===1),'Ordinary BUYfood2');
  purchase=network.findLast(n=>n.index>=buyAt&&n.name==='Shop'&&n.page===host&&n.success&&n.response.purchased).response;foodInstance=purchase.purchased.instanceId;assert.equal(purchase.purchased.ownedQuantity,2);assert.equal(purchase.money,shopBefore.money-20);assert.equal(purchase.tokens,shopBefore.tokens);evidence.purchase={before:shopBefore,confirmed:purchase};
  await nativeClick(host,'[data-shop-close]');await waitUntil(host,`!document.querySelector('#account-shop[open]')`);await nativeClick(host,'[data-room-card-home]');await waitUntil(host,`document.querySelector('#home-inventory button[data-source-control="rdoItem"]')?.matches(':enabled')`);await nativeClick(host,'#home-inventory button[data-source-control="rdoItem"]');await waitUntil(host,`document.querySelector('[data-inventory-instance="${foodInstance}"]')?.matches(':enabled')`);await nativeClick(host,`[data-inventory-instance="${foodInstance}"]`);
  const assignAt=network.length;await nativeClick(host,'[data-kitbag-slot="4"]');await condition(()=>network.some(n=>n.index>=assignAt&&n.page===host&&n.name==='Kitbag'&&n.success&&n.response.slot===4&&n.response.instanceId===foodInstance),'Food slot4 confirmed');assert.equal(lastResponse('Kitbag').hotkeys[3],foodInstance);evidence.kitbag=lastResponse('Kitbag');await nativeClick(host,'[data-home-close]');await waitUntil(host,`!document.querySelector('#home-inventory[open]')&&document.activeElement.matches('[data-room-card-home]')`);
  }
  await enterRoom();
  const actor=(snapshot,id)=>snapshot.players.find(p=>p.id===id);
  const key=(session,type,code,key,virtual)=>command('Input.dispatchKeyEvent',{type,code,key,windowsVirtualKeyCode:virtual},session);
  const fires=(session,id)=>(events.get(session)??[]).filter(e=>e.roomId===roomId&&e.type==='fire'&&e.playerId===id);
  const hits=(session,attacker,victim)=>(events.get(session)??[]).filter(e=>e.roomId===roomId&&e.type==='hit'&&e.playerId===attacker&&e.targetId===victim&&e.shotPlayerResult?.itemId===2001);
  async function aimAndFire(session,attacker,victim,label,onlyAim=false){
    const fireCount=fires(host,attacker).length,hitCount=hits(host,attacker,victim).length;
    assert.equal(actor(state(host),attacker).ammoItemId,2001);await nativeClick(session,'#world');
    const inputs=[],deadline=Date.now()+16000;let aimed=false;
    while(Date.now()<deadline){
      const snapshot=state(host),me=actor(snapshot,attacker),enemy=actor(snapshot,victim);assert(me?.alive&&enemy?.alive);
      const desired=Math.atan2(enemy.x-me.x,enemy.z-me.z),error=Math.atan2(Math.sin(desired-me.yaw-me.aim),Math.cos(desired-me.yaw-me.aim));inputs.push({tick:snapshot.tick,error});
      if(Math.abs(error)<.035){await new Promise(r=>setTimeout(r,250));const next=actor(state(host),attacker),residual=Math.atan2(Math.sin(desired-next.yaw-next.aim),Math.cos(desired-next.yaw-next.aim));if(Math.abs(residual)<.035){aimed=true;break;}continue;}
      const code=error>0?'ArrowLeft':'ArrowRight',virtual=error>0?37:39;await key(session,'keyDown',code,code,virtual);try{await new Promise(r=>setTimeout(r,Math.min(100,Math.max(25,Math.abs(error)/.9*600))));}finally{await key(session,'keyUp',code,code,virtual);}await new Promise(r=>setTimeout(r,180));
    }
    evidence[label]={aimInputs:inputs,before:[state(host),state(peer)]};assert(aimed,'Ordinary aim before '+label);if(onlyAim)return;await condition(()=>!(actor(state(host),attacker).reload?.remaining>0),'Legal reload before '+label);await observe(session,label+'.Space.before');
    await key(session,'keyDown','Space',' ',32);const pressedAt=Date.now();
    try{while(Date.now()-pressedAt<250&&fires(host,attacker).length===fireCount)await new Promise(r=>setTimeout(r,5));}
    finally{await key(session,'keyUp','Space',' ',32);evidence[label].heldMilliseconds=Date.now()-pressedAt;await observe(session,label+'.Space.released');}
    await condition(()=>fires(host,attacker).length>fireCount,'Actual '+label+' fire',5000);assert.equal(fires(host,attacker).length,fireCount+1);
    await condition(()=>hits(host,attacker,victim).length===hitCount+1&&hits(peer,attacker,victim).length===hitCount+1,'Dual '+label+' hit');assert.deepEqual(hits(host,attacker,victim),hits(peer,attacker,victim));evidence[label].hits=[hits(host,attacker,victim).slice(hitCount),hits(peer,attacker,victim).slice(hitCount)];
  }
  assert.equal(actor(state(host),peerId).petId,oracle.victimSkill.petId);evidence.initial=[state(host),state(peer)];
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
  function geometry(snapshot,targetId,shooterId){const target=actor(snapshot,targetId),shooter=actor(snapshot,shooterId),bearing=Math.atan2(shooter.x-target.x,shooter.z-target.z),relative=Math.atan2(Math.sin(bearing-target.bodyYaw),Math.cos(bearing-target.bodyYaw));return {bodyYaw:target.bodyYaw,bearing,relative,category:Math.abs(relative)<=Math.PI/4?'front':Math.abs(relative)>=3*Math.PI/4?'back':'side'};}
  async function front(session,targetId,shooterId){await nativeClick(session,'#world');const until=Date.now()+30000;while(Date.now()<until){const g=geometry(state(host),targetId,shooterId);if(g.category==='front')return;const error=Math.atan2(Math.sin(g.bearing-g.bodyYaw),Math.cos(g.bearing-g.bodyYaw)),code=error>0?'KeyA':'KeyD',letter=error>0?'a':'d',virtual=error>0?65:68;await key(session,'keyDown',code,letter,virtual);try{await new Promise(r=>setTimeout(r,Math.min(120,Math.max(35,Math.abs(error)*150))));}finally{await key(session,'keyUp',code,letter,virtual);}await new Promise(r=>setTimeout(r,150));}throw new Error('Normal FRONT body turn');}
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
  const copiedId=oracle.victimSkill.resolvedId,selected=(s,id)=>actor(s,id).roleSkillSources.selectedSkillIds;
  const initial=state(host);assert.equal(actor(initial,hostId).petId,102);assert(actor(initial,hostId).roleSkillSources.equipmentSkills.some(s=>s.baseId===10711&&s.rank===1));assert(!selected(initial,hostId).includes(copiedId),'Source copy absent before actual kill');assert(selected(initial,peerId).includes(copiedId),'Victim actual qualified passive');evidence.initial=[initial,state(peer)];
  async function acceptedShot(session,id,victimId,expectedBase,label){
    assert(evidence.acceptedHits<oracle.maximumAcceptedHits,'Frozen finite shot budget');
    await front(victimId===hostId?host:peer,victimId,id);
    await aimAndFire(session,id,victimId,label);evidence.acceptedHits++;
    const before=evidence[label].before[0],victim=actor(before,victimId),hit=evidence[label].hits[0][0];assert.equal(geometry(before,victimId,id).category,'front');assert.equal(typeof hit.shotPlayerResult.critical,'boolean');assert(Math.abs(hit.value-expectedBase*(hit.shotPlayerResult.critical?2:1))<1e-6);
    const expectedHP=Math.max(0,Math.trunc(victim.hp-hit.value));await condition(()=>actor(state(host),victimId).hp===expectedHP,'Actual integer hit HP '+label);
    const shared=await sharedAfter(label);for(const snapshot of shared)assert.equal(actor(snapshot,victimId).hp,expectedHP);
    for(const page of [host,peer])await waitUntil(page,`window.copySkillEvidence.shows.some(r=>r.context.targetId===${JSON.stringify(victimId)}&&r.damage===${hit.value}&&r.critical===${hit.shotPlayerResult.critical})`);
    return {hit,before,after:shared};
  }
  async function foodHeal(label,amount,remaining){
    await nativeClick(host,'#world');const before=state(host),target=actor(before,hostId),prior=(events.get(host)??[]).filter(e=>e.roomId===roomId&&e.type==='itemUsed'&&e.skillId===1&&e.playerId===hostId&&e.targetId===hostId).length,expected=Math.min(amount,target.maxHp-target.hp);assert(expected>0);evidence[label]={before,expected,pressedAt:Date.now()};
    await key(host,'keyDown','Digit5','5',53);try{await new Promise(r=>setTimeout(r,80));}finally{await key(host,'keyUp','Digit5','5',53);evidence[label].releasedAt=Date.now();}
    const heals=session=>(events.get(session)??[]).filter(e=>e.roomId===roomId&&e.type==='itemUsed'&&e.skillId===1&&e.playerId===hostId&&e.targetId===hostId);
    await condition(()=>heals(host).length===prior+1&&heals(peer).length===prior+1,'Dual food heal '+label);assert.deepEqual(heals(host),heals(peer));assert.equal(heals(host).at(-1).value,expected);evidence[label].events=[heals(host).at(-1),heals(peer).at(-1)];
    const after=await sharedAfter(label);for(const frame of after)assert.equal(actor(frame,hostId).hp,target.hp+expected);
    await condition(()=>lastResponse('Inventory')&&(lastResponse('Inventory').records.find(r=>r.instanceId===foodInstance)?.ownedQuantity??0)===remaining,'Food finite remaining '+label);evidence[label].inventory=lastResponse('Inventory');
    for(const page of [host,peer])await waitUntil(page,`window.copySkillEvidence.benefitShows.some(r=>r.context.targetId===${JSON.stringify(hostId)}&&r.increase===${expected})`);
  }
  if(!clearParent){
  evidence.initialInjury=[];
  while(!first&&actor(state(host),hostId).maxHp-actor(state(host),hostId).hp<240){const shot=await acceptedShot(peer,peerId,hostId,oracle.peerFrontBaseDamage,'initialInjury'+evidence.initialInjury.length);evidence.initialInjury.push(shot);assert(actor(state(host),hostId).alive,'Natural injury leaves learner alive');}
  evidence.copyKill=[];
  while(actor(state(host),peerId).alive){const shot=await acceptedShot(host,hostId,peerId,oracle.hostFrontBaseDamage,'copyKill'+evidence.copyKill.length);evidence.copyKill.push(shot);}
  evidence.copied={};const copied=await sharedAfter('copied');for(const snapshot of copied){assert(!actor(snapshot,peerId).alive);assert(actor(snapshot,hostId).alive);assert(selected(snapshot,hostId).includes(copiedId));}
  const lethal=evidence.copyKill.at(-1);assert.equal(actor(copied[0],hostId).hp,actor(lethal.before,hostId).hp,'Copy does not heal learner');assert.deepEqual(actor(copied[0],hostId).ammoMagazine,actor(lethal.after[0],hostId).ammoMagazine,'Copy does not refill after accepted fire');
  if(!first)await foodHeal('copiedFood',oracle.copiedFoodHealing,1);
  await condition(()=>actor(state(host),peerId).alive,'Victim natural respawn before learner death');
  evidence.learnerDeath=[];
  while(actor(state(host),hostId).alive)evidence.learnerDeath.push(await acceptedShot(peer,peerId,hostId,oracle.peerFrontBaseDamage,'learnerDeath'+evidence.learnerDeath.length));
  evidence.cleared={};const cleared=await sharedAfter('cleared');for(const snapshot of cleared){assert(!actor(snapshot,hostId).alive);assert(!selected(snapshot,hostId).includes(copiedId));}
  for(const page of [host,peer])await waitUntil(page,`window.copySkillEvidence.lifeTransitions.some(r=>r.targetId===${JSON.stringify(hostId)}&&r.alive===false&&r.completed&&r.action==='09')`);
  await condition(()=>actor(state(host),hostId).alive&&actor(state(host),hostId).hp===actor(state(host),hostId).maxHp,'Learner natural fullHP respawn');
  evidence.respawn={};const respawn=await sharedAfter('respawn');for(const snapshot of respawn)assert(!selected(snapshot,hostId).includes(copiedId));
  }else{
    evidence.clearedLifeNewRoom={};const frames=await sharedAfter('clearedLifeNewRoom');
    for(const frame of frames){assert(actor(frame,hostId).alive);assert.equal(actor(frame,hostId).hp,actor(frame,hostId).maxHp);assert(!selected(frame,hostId).includes(copiedId));}
  }
  evidence.clearedInjury=[];
  while(actor(state(host),hostId).maxHp-actor(state(host),hostId).hp<200){const shot=await acceptedShot(peer,peerId,hostId,oracle.peerFrontBaseDamage,'clearedInjury'+evidence.clearedInjury.length);evidence.clearedInjury.push(shot);assert(actor(state(host),hostId).alive);assert(!selected(state(host),hostId).includes(copiedId));}
  assert(!selected(state(host),hostId).includes(copiedId));await foodHeal('clearedFood',oracle.clearedFoodHealing,0);
  if(clearParent){assert.equal(evidence.clearedFood.expected,200);for(const page of [host,peer]){const items=(events.get(page)??[]).filter(row=>row.roomId===roomId&&row.type==='itemUsed');assert.equal(items.length,1);assert.equal(items[0].value,200);}assert(actor(state(host),hostId).alive);assert(actor(state(host),peerId).alive);assert(!evidence.copyKill&&!evidence.learnerDeath&&!evidence.copiedFood);}
  evidence.observation=await Promise.all([host,peer].map(page=>evaluate(page,'window.copySkillEvidence')));
  await closeRoom();
  for(const [index,session] of [peer,host].entries()){
    const who=index===0?'peer':'host';await nativeClick(session,'[data-room-card-home]');
    await stageWait(session,who+'.HomeClose.sourceReady',`document.querySelector('[data-home-close]')?.matches(':enabled')`);
    await nativeClick(session,'[data-home-close]');
    await stageWait(session,who+'.HomeClose.strictGate',`!document.querySelector('#home-inventory[open]')&&document.activeElement.matches('[data-room-card-home]')`);
  }
  evidence.strictClose=true;
  async function authenticateCold(){
    coldClients=[0,1].map(()=>new WsClient(serviceProto,{server:'ws://127.0.0.1:3665',logger:undefined}));
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
  assert.equal(evidence.coldBeforeRestart[0].inventory.records.find(r=>r.instanceId===foodInstance)?.ownedQuantity??0,0);assert.equal(evidence.coldBeforeRestart[0].inventory.hotkeys[3],foodInstance);
  const nativeDb=new DatabaseSync(database,{readOnly:true});try{evidence.nativeBeforeRestart=fixture.accounts.map((account,index)=>{const row=nativeDb.prepare('SELECT payload, strings FROM role_profiles WHERE account_id=?').get(account.accountId),profile={bytes:[...row.payload],strings:JSON.parse(String(row.strings))};assert.deepEqual(profile,evidence.coldBeforeRestart[index].equipment.profile);const inventory=nativeDb.prepare('SELECT record FROM inventory WHERE account_id=? ORDER BY instance_id').all(account.accountId).map(r=>JSON.parse(String(r.record)));assert.deepEqual(inventory,evidence.coldBeforeRestart[index].inventory.records);const owned={base:[],equipment:[]};for(const r of nativeDb.prepare('SELECT kind, record FROM role_records WHERE account_id=? ORDER BY instance_id').all(account.accountId))owned[r.kind==='base'?'base':'equipment'].push(JSON.parse(String(r.record)));assert.deepEqual(owned,evidence.coldBeforeRestart[index].owned);const hotkeys=Array(7).fill(0);for(const r of nativeDb.prepare('SELECT slot, instance_id FROM hotkeys WHERE account_id=? ORDER BY slot').all(account.accountId))hotkeys[r.slot-1]=r.instance_id;assert.deepEqual(hotkeys,evidence.coldBeforeRestart[index].inventory.hotkeys);return {profile,inventory,owned,hotkeys};});const buyRequest=(first?first.network:network).find(n=>n.direction==='sent'&&n.name==='Shop'&&n.payload?.operation==='BUY');const receipt=nativeDb.prepare('SELECT receipt FROM shop_purchases WHERE account_id=? AND request_id=?').get(fixture.accounts[0].accountId,buyRequest.payload.requestId);evidence.nativePurchaseReceipt=JSON.parse(String(receipt.receipt));assert.deepEqual(evidence.nativePurchaseReceipt,purchase.purchased);for(const row of evidence.retainedReceipts)assert.equal(nativeDb.prepare('SELECT receipt FROM shop_purchases WHERE account_id=? AND request_id=?').get(row.account_id,row.request_id).receipt,row.receipt);}finally{nativeDb.close();}
  for(const client of coldClients)await client.disconnect();coldClients=[];
  await stop(server);evidence.compiledStoppedBeforeRestart=true;await startServer();
  await authenticateCold();evidence.coldAfterRestart=[];
  for(const client of coldClients)evidence.coldAfterRestart.push(await coldQuery(client));
  assert.deepEqual(evidence.coldAfterRestart,evidence.coldBeforeRestart);evidence.sameDatabaseCompiledRestart=true;
  for(const client of coldClients)await client.disconnect();coldClients=[];

  const writes=network.filter(n=>n.direction==='sent'&&(['BUY','LEARN','MAINTAIN','SELL','EQUIP','UNEQUIP'].includes(n.payload?.operation)));assert.equal(writes.length,first?0:1);if(!first){assert.equal(writes[0].name,'Shop');assert.equal(writes[0].payload.itemTableId,1);assert.equal(writes[0].payload.quantity,2);}const assigns=network.filter(n=>n.direction==='sent'&&n.name==='Kitbag');assert.equal(assigns.length,first?0:1);if(!first){assert.equal(assigns[0].payload.slot,4);assert.equal(assigns[0].payload.instanceId,foodInstance);}
  assert.equal(evidence.runtime.filter(r=>r.method==='Runtime.exceptionThrown').length,0);evidence.status=clearParent?'PASS_FINITE_REFERENCED_PET102_COPY240_LIFE_CLEAR_NEW_ROOM_FOOD200_DUAL_STATE_NATIVE_RESTART_SUMMARY_HOME_CLOSE_SCOPE':'PASS_FINITE_LEARNED_PET102_10711_COPY10811_FOOD240_LIFE_CLEAR_FOOD200_DUAL_STATE_NATIVE_RESTART_SUMMARY_HOME_CLOSE_SCOPE';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
  evidence.observationFinally=[];for(const page of pages){try{evidence.observationFinally.push({page:page.sessionId,evidence:await evaluate(page.sessionId,'window.copySkillEvidence')});}catch(error){evidence.observerSaveError=String(error);}}
  for(const client of coldClients)await client.disconnect();coldClients=[];
  try{const db=new DatabaseSync(database,{readOnly:true});try{evidence.savedCheckpoint=output+'-checkpoint.sqlite';await backup(db,evidence.savedCheckpoint);await chmod(evidence.savedCheckpoint,0o600);}finally{db.close();}await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:evidence.savedCheckpoint,accounts:fixture.accounts,source:checkpoint,newFundsOrRecordsInjected:false})+'\n',{mode:0o600});}catch(error){evidence.checkpointError=String(error);}
  evidence.nativeKeyEvents=[];for(const page of pages){try{evidence.nativeKeyEvents.push({page:page.sessionId,events:await evaluate(page.sessionId,'window.copySkillKeyEvents??[]')});}catch(error){evidence.nativeKeyObserverError=String(error);}}
  evidence.snapshotRetention={maximumPerPage:1000,fullSessionClaim:false};evidence.playerInputs=network.filter(n=>n.name==='PlayerInput'&&n.direction==='sent');
  evidence.eventTimes=eventTimes;evidence.network=network;evidence.snapshots=[...snapshots].map(([page,frames])=>({page,frames}));evidence.events=[...events].map(([page,rows])=>({page,rows}));
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
}
