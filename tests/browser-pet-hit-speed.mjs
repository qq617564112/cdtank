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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3671',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-pet-hit-speed-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-pet-hit-speed-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
let coldClients=[];
const tailIndex=process.argv.indexOf('--unreached-tail'),firstPath=tailIndex>=0?process.argv[tailIndex+1]:undefined;
const first=firstPath?JSON.parse(await readFile(firstPath,'utf8')):undefined;
const firstRootReviewPath='recovery/output/pet-hit-speed-browser-first-root-review.json';let firstRootReview;
if(first){
 firstRootReview=JSON.parse(await readFile(firstRootReviewPath,'utf8'));
 assert.equal(firstPath,'recovery/output/browser-pet-hit-speed-2026-10-06T02-40-11-233Z.json');assert.equal(firstRootReview.raw,firstPath);assert.equal(firstRootReview.status,'ACCEPTED_FINITE_LEARNED_PET2_10231_HOME_READY_NATIVE_TURN_SOURCE_ONLY_INJURY_MOVE_CLOSE_RESTART_UNREACHED_SCOPE');assert.equal(firstRootReview.checkpoint,first.savedCheckpoint);assert.equal(firstRootReview.actualSession,77049);assert.equal(firstRootReview.actualExit,1);
 for(const field of ['nativeAllTablesExpectedEqual','allOwnedInventoryProfilesHotkeysReceiptsPreserved','portsClear'])assert.equal(firstRootReview[field],true);
 assert.equal(first.status,'FAIL');assert.equal(first.error,'Error: Ordinary facing ownerFacingPeer');assert.equal(first.acceptedHits,0);assert.equal(first.events.length,0);assert.equal(first.ownerHome.instanceId,3);assert.equal(new Map(first.ownerHome.pet.fields).get(0x64),1);assert.equal(first.rooms.length,1);assert.equal(first.runtime.filter(row=>row.method==='Runtime.exceptionThrown').length,0);assert(!first.injured&&!first.activeMovement&&!first.strictClose&&!first.sameDatabaseCompiledRestart);assert.deepEqual(first.processCleanup,{chromeStopped:true,serverStopped:true,viteClosed:true,tempRemoved:true});assert.deepEqual(firstRootReview.cleanup,first.processCleanup);
 assert(!first.network.some(row=>row.direction==='sent'&&['BUY','LEARN','ASSIGN','EQUIP','UNEQUIP'].includes(row.payload?.operation)));
}
const fixtureIndex=process.argv.indexOf('--fixture'),databaseIndex=process.argv.indexOf('--database'),oracleIndex=process.argv.indexOf('--oracle');
assert(first||fixtureIndex>=0&&databaseIndex>=0&&oracleIndex>=0,'Explicit final source or strict first actual backup');
const fixturePath=first?firstPath.slice(0,-5)+'-checkpoint-fixture.json':process.argv[fixtureIndex+1],fixture=JSON.parse(await readFile(fixturePath,'utf8')),checkpoint=first?first.savedCheckpoint:process.argv[databaseIndex+1];
if(first)assert.equal(fixture.database,checkpoint);
const oraclePath='recovery/output/pet-hit-speed-browser-oracle.json';if(!first)assert.equal(process.argv[oracleIndex+1],oraclePath);const oracle=JSON.parse(await readFile(oraclePath,'utf8'));if(first)assert.deepEqual(oracle,first.oracle);
const networkRootReviewPath='recovery/output/pet-hit-speed-network-root-review.json',networkRootReview=JSON.parse(await readFile(networkRootReviewPath,'utf8'));
assert.equal(networkRootReview.status,'PASS_FINITE_ORDINARY_EXISTING_PET2_LEARN10231_HOSTILE_INJURY_SPEED5S_EXPIRE_BASELINE_MOVE_READY_DUAL_STATE_NATIVE_RESTART_SCOPE');
assert.equal(networkRootReview.raw,'recovery/output/pet-hit-speed-network-2026-10-06T02-35-29-950Z.json');assert.equal(networkRootReview.checkpoint,first?first.fixture.source:checkpoint);assert.equal(networkRootReview.actualSession,93331);assert.equal(networkRootReview.actualExit,0);
if(!first)assert.equal(fixturePath,'recovery/output/pet-hit-speed-network-2026-10-06T02-35-29-950Z-identity.private.json');assert.equal(oraclePath,'recovery/output/pet-hit-speed-browser-oracle.json');assert.equal(oracle.sourceRaw,networkRootReview.raw);assert.equal(oracle.rootReview,networkRootReviewPath);
for(const field of ['dualPhaseCoreEventsFullEqual','nativeAllTablesExpectedEqual','allOtherOwnedInventoryProfilesHotkeysReceiptsPreserved','fullDualNativeAndSameDBActualStopStartFourQueriesEqual','normalHistoryPayloadMatchesOrdinaryForfeitAndPlayerCounters','cleaned','portsClear'])assert.equal(networkRootReview[field],true);
assert.equal(networkRootReview.selectedExistingInstance,3);assert.equal(networkRootReview.ordinaryLearnCost,10);assert.equal(networkRootReview.earnedPointsProved,false);assert.equal(networkRootReview.durationMilliseconds,5000);assert.equal(networkRootReview.sourceDerivedMoveIncrement,10);
assert(fixture.accounts?.length===2&&fixture.accounts.every(account=>account.token));
assert.deepEqual(oracle.ownerSkill,{petId:2,instanceId:3,slot:2,baseId:10231,rank:1,resolvedId:10231});
assert.equal(oracle.hostPetId,102);assert.equal(oracle.durationMilliseconds,5000);
assert.equal(oracle.hostFrontBaseDamage,127.10765255670468);
assert.equal(oracle.baselineSpeed,130);assert.equal(oracle.activeSpeed,140);
assert.equal(oracle.simulationTickSeconds,.05);
const snapshots=new Map(),events=new Map(),eventTimes=[];
const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const pages=[],contexts=[];
const evidence={status:'RUNNING',runId,rooms:[],roomClosures:[],domStages:[],ports:{server:3671,vite:5701,cdp:9901},fixture:{source:checkpoint,fixturePath,newFundsOrRecordsInjected:false,newPointsInjected:false,newPetBuyOrLearn:false,newTransactions:false},networkSource:{rootReview:networkRootReviewPath,status:networkRootReview.status,actualSession:93331,actualExit:0,preServicePointsEarned:false,ordinaryLearnCost:10},oracle,acceptedHits:0,scope:'Selected learned Pet2instance3/10231slot2rank1; owner native retreat100/host sole injury installs current10231, peer W500ms active motion and fixed5s expiry/baseline W500ms, dual fullsamekey/webownTick/Close/native; no transactions/newFX',runtime:[]};
if(first)evidence.firstScope={raw:firstPath,rootReview:firstRootReviewPath,rootReviewStatus:firstRootReview.status,actualSession:77049,actualExit:1,scope:'Learned Home/Ready/native turn only; injury/motion/expiry/Close/restart unreached',nativeAllTablesExpectedEqual:true,home:first.ownerHome,newOrdinaryRoom:true,oldSessionRestored:false};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3671',ACCOUNT_DB_PATH:database};server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  const sourceDb=new DatabaseSync(checkpoint,{readOnly:true});try{evidence.retainedReceipts=sourceDb.prepare('SELECT account_id, request_id, receipt FROM shop_purchases ORDER BY account_id, request_id').all();evidence.sourceTables=sourceDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);}finally{sourceDb.close();}
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5701,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3671',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9901',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9901/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9901');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Runtime.enable',{},sessionId);await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.accounts[index].token)+');'},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:`window.hitSpeedKeyEvents=[];for(const type of ['keydown','keyup'])window.addEventListener(type,event=>{if(!['Space','ArrowLeft','ArrowRight','KeyA','KeyD','KeyW','KeyS'].includes(event.code))return;const target=event.target;window.hitSpeedKeyEvents.push({type,code:event.code,key:event.key,isTrusted:event.isTrusted,wallTime:Date.now(),target:target instanceof Element?{tag:target.tagName,id:target.id}:null,focus:document.activeElement?.outerHTML,world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null')});},true);`},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:`
window.hitSpeedEvidence={damage:[],shows:[],ready:false};
window.hitSpeedReady=(async()=>{
 const [{BattlePlayers},{TankDamageText}]=await Promise.all([import('/src/render/battle-players.ts'),import('/src/assets/tanks/tank-damage-text.ts')]);const out=window.hitSpeedEvidence;let context;
 const damage=BattlePlayers.prototype.damage;BattlePlayers.prototype.damage=function(id,value,isLocal,critical=false){const previous=context;context={targetId:id,value,isLocal,critical,wallTime:Date.now()};out.damage.push({...context});try{return damage.call(this,id,value,isLocal,critical);}finally{context=previous;}};
 const show=TankDamageText.prototype.show;TankDamageText.prototype.show=function(x,y,value,isLocal,critical=false){out.shows.push({context:{...context},x,y,value,isLocal,critical,wallTime:Date.now()});return show.call(this,x,y,value,isLocal,critical);};out.ready=true;
})();`},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5701'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-entry-page="login"] button[data-source-control="btnLogin"]')?.matches(':enabled')`);
    await nativeClick(sessionId,'[data-entry-page="login"] button[data-source-control="btnLogin"]');
    await waitUntil(sessionId,`document.querySelector('[data-channel-id="main"]')?.matches(':enabled')`);
    await nativeClick(sessionId,'[data-channel-id="main"]');
    const channelPoint=await evaluate(sessionId,`(()=>{const r=document.querySelector('[data-channel-id="main"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...channelPoint},sessionId);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...channelPoint},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')`);

    await evaluate(sessionId,'window.hitSpeedReady.then(()=>true)');

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
    const fields=new Map(pet.fields);assert.equal(fields.get(8),expected.petId);assert.equal(id,expected.instanceId);assert.equal(fields.get(0x44+expected.slot*4),expected.baseId);assert.equal(fields.get(0x5c+expected.slot*4),expected.rank);
    await nativeClick(session,`[data-owned-role="${id}"]`);await waitUntil(session,`document.querySelector('[data-home-pet-skill="${expected.slot}"]')?.dataset.skillId==='${expected.resolvedId}'&&document.querySelector('[data-home-pet-skill="${expected.slot}"]').dataset.skillLevel==='${expected.rank}'`);
    await nativeClick(session,`[data-home-pet-view-skill="${expected.slot}"]`);await waitUntil(session,`document.querySelector('[data-pet-skill-dialog][open]')?.dataset.skillId==='${expected.resolvedId}'`);
    evidence[label]={profile,pet,instanceId:id,popup:await evaluate(session,`document.querySelector('[data-pet-skill-dialog][open]').textContent`)};
    await nativeClick(session,'[data-pet-skill-close]');await waitUntil(session,`!document.querySelector('[data-pet-skill-dialog][open]')`);await nativeClick(session,'[data-roles-close]');await waitUntil(session,`!document.querySelector('#home-roles')&&document.activeElement.matches('[data-room-card-home]')`);
  }
  await selectedPetHome(peer,oracle.ownerSkill,'ownerHome');
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
    evidence[label]={aimInputs:inputs,before:[state(host),state(peer)]};assert(aimed,'Ordinary aim before '+label);if(onlyAim)return;await condition(()=>!(actor(state(host),attacker).reload?.remaining>0),'Legal reload before '+label);evidence[label].before=[state(host),state(peer)];await observe(session,label+'.Space.before');
    await key(session,'keyDown','Space',' ',32);const pressedAt=Date.now();
    try{while(Date.now()-pressedAt<250&&fires(host,attacker).length===fireCount)await new Promise(r=>setTimeout(r,5));}
    finally{await key(session,'keyUp','Space',' ',32);evidence[label].heldMilliseconds=Date.now()-pressedAt;await observe(session,label+'.Space.released');}
    await condition(()=>fires(host,attacker).length>fireCount,'Actual '+label+' fire',5000);assert.equal(fires(host,attacker).length,fireCount+1);
    await condition(()=>hits(host,attacker,victim).length===hitCount+1&&hits(peer,attacker,victim).length===hitCount+1,'Dual '+label+' hit');assert.deepEqual(hits(host,attacker,victim),hits(peer,attacker,victim));evidence[label].hits=[hits(host,attacker,victim).slice(hitCount),hits(peer,attacker,victim).slice(hitCount)];
  }
  assert.equal(actor(state(host),peerId).petId,oracle.ownerSkill.petId);assert.equal(actor(state(host),hostId).petId,oracle.hostPetId);evidence.initial=[state(host),state(peer)];
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
  const active=snapshot=>actor(snapshot,peerId).roleSkillSources.currentSkillIds.includes(10231);
  assert(!active(state(host)));assert(actor(state(host),peerId).roleSkillSources.equipmentSkills.some(skill=>skill.baseId===10231&&skill.rank===1));
  async function orient(session,id,target,label){
    await nativeClick(session,'#world');const samples=[],deadline=Date.now()+12000;evidence[label]=samples;
    while(Date.now()<deadline){
      const snapshot=state(host),me=actor(snapshot,id),bearing=Math.atan2(target.x-me.x,target.z-me.z),error=Math.atan2(Math.sin(bearing-me.bodyYaw),Math.cos(bearing-me.bodyYaw)),sample={snapshot,error};samples.push(sample);if(Math.abs(error)<=.03)return;
      const code=error>0?'KeyA':'KeyD',sign=error>0?1:-1,pressedAt=Date.now(),inputStart=network.length;sample.pressedAt=pressedAt;sample.code=code;
      await key(session,'keyDown',code,code==='KeyA'?'a':'d',code==='KeyA'?65:68);
      try{
        const until=Math.min(deadline,pressedAt+1000);
        while(Date.now()<until){const current=state(host);if(Date.now()-pressedAt>=50&&current.tick>snapshot.tick&&Math.abs(actor(current,id).bodyYaw-me.bodyYaw)>.0001&&network.some(row=>row.index>=inputStart&&row.page===session&&row.direction==='sent'&&row.name==='PlayerInput'&&row.payload.turn===sign)){sample.changedAuthority=current;break;}await new Promise(resolve=>setTimeout(resolve,5));}
        assert(sample.changedAuthority,'Native turn crosses input period and changes authority '+label);
      }finally{await key(session,'keyUp',code,code==='KeyA'?'a':'d',code==='KeyA'?65:68);sample.releasedAt=Date.now();sample.heldMilliseconds=sample.releasedAt-pressedAt;}
      await new Promise(resolve=>setTimeout(resolve,100));sample.afterRelease=state(host);
    }
    throw new Error('Ordinary facing '+label);
  }
  await orient(host,hostId,actor(state(host),peerId),'ownerFacingPeer');const retreatStart=actor(state(host),hostId);evidence.ownerRetreat={before:retreatStart,samples:[]};await nativeClick(host,'#world');const retreatDeadline=Date.now()+15000;
  await key(host,'keyDown','KeyS','s',83);try{while(Date.now()<retreatDeadline&&Math.hypot(actor(state(host),hostId).x-retreatStart.x,actor(state(host),hostId).z-retreatStart.z)<100){evidence.ownerRetreat.samples.push(state(host));await new Promise(resolve=>setTimeout(resolve,50));}}finally{await key(host,'keyUp','KeyS','s',83);}
  assert(Math.hypot(actor(state(host),hostId).x-retreatStart.x,actor(state(host),hostId).z-retreatStart.z)>=100,'Normal owner retreat corridor');await new Promise(resolve=>setTimeout(resolve,150));evidence.ownerRetreat.after=state(host);
  await orient(peer,peerId,actor(state(host),hostId),'peerCorridorFacingOwner');await aimAndFire(host,hostId,peerId,'injuryAim',true);
  await front(peer,peerId,hostId);await aimAndFire(host,hostId,peerId,'injury');evidence.acceptedHits=1;
  const before=evidence.injury.before[0],target=actor(before,peerId),hit=evidence.injury.hits[0][0];assert.equal(geometry(before,peerId,hostId).category,'front');assert.equal(typeof hit.shotPlayerResult.critical,'boolean');assert(Math.abs(hit.value-oracle.hostFrontBaseDamage*(hit.shotPlayerResult.critical?2:1))<1e-6);const expectedHP=Math.max(0,Math.trunc(target.hp-hit.value));assert(expectedHP>0);
  await condition(()=>[host,peer].every(session=>active(state(session))&&actor(state(session),peerId).hp===expectedHP),'Dual learned injury10231 current installed');evidence.injured={};const injured=await sharedAfter('injured');for(const snapshot of injured)assert.equal(actor(snapshot,peerId).roleSkillSources.currentSkillIds.filter(id=>id===10231).length,1);
  async function measure(label,expectedSpeed,isActive){
    await nativeClick(peer,'#world');const pressedAt=Date.now(),startTick=state(host).tick;evidence[label]={pressedAt,startTick,expectedSpeed,isActive};await key(peer,'keyDown','KeyW','w',87);try{await new Promise(resolve=>setTimeout(resolve,500));}finally{await key(peer,'keyUp','KeyW','w',87);evidence[label].releasedAt=Date.now();}
    await new Promise(resolve=>setTimeout(resolve,150));const rows=(snapshots.get(host)??[]).filter(row=>row.snapshot.roomId===roomId&&row.wallTime>=pressedAt&&row.wallTime<=evidence[label].releasedAt&&row.snapshot.tick>startTick);
    const moving=rows.slice(1,-1);assert(moving.length>=3,'Normal500ms motion samples');const first=moving[0],last=moving.at(-1),a=actor(first.snapshot,peerId),b=actor(last.snapshot,peerId),simulationSeconds=(last.snapshot.tick-first.snapshot.tick)*oracle.simulationTickSeconds,distance=Math.hypot(b.x-a.x,b.z-a.z),observedSpeed=distance/simulationSeconds;
    assert(simulationSeconds>0);assert(Math.abs(observedSpeed-expectedSpeed)<.3,'Actual round2 projection movement speed '+label);
    for(const row of moving){const player=actor(row.snapshot,peerId);assert.equal(active(row.snapshot),isActive);assert.equal(player.hp,a.hp);assert(Math.abs(player.bodyYaw-a.bodyYaw)<.001);}
    Object.assign(evidence[label],{samples:moving,simulationSeconds,serverMilliseconds:last.snapshot.serverTime-first.snapshot.serverTime,wallMilliseconds:last.wallTime-first.wallTime,distance,observedSpeed,round2Projection:true});await sharedAfter(label);
  }
  await measure('activeMovement',oracle.activeSpeed,true);
  await condition(()=>[host,peer].every(session=>!active(state(session))),'Natural fixed5s current10231 expires',7000);
  const hostFrames=(snapshots.get(host)??[]).filter(row=>row.snapshot.roomId===roomId),firstActive=hostFrames.find(row=>active(row.snapshot)),firstExpired=hostFrames.find(row=>firstActive&&row.snapshot.tick>firstActive.snapshot.tick&&!active(row.snapshot));assert(firstActive&&firstExpired);
  evidence.expired={timing:{simulationSeconds:(firstExpired.snapshot.tick-firstActive.snapshot.tick)*oracle.simulationTickSeconds,serverMilliseconds:firstExpired.snapshot.serverTime-firstActive.snapshot.serverTime,wallMilliseconds:firstExpired.wallTime-firstActive.wallTime},firstActive,firstExpired};assert(evidence.expired.timing.serverMilliseconds>=4950&&evidence.expired.timing.serverMilliseconds<=5100);await sharedAfter('expired');
  await measure('baselineMovement',oracle.baselineSpeed,false);evidence.observation=await Promise.all([host,peer].map(page=>evaluate(page,'window.hitSpeedEvidence')));
  assert.equal([...events.values()].flat().filter(event=>event.type==='playerHealed'||event.type==='itemUsed').length,0);
  await closeRoom();
  for(const [index,session] of [peer,host].entries()){
    const who=index===0?'peer':'host';await nativeClick(session,'[data-room-card-home]');
    await stageWait(session,who+'.HomeClose.sourceReady',`document.querySelector('[data-home-close]')?.matches(':enabled')`);
    await nativeClick(session,'[data-home-close]');
    await stageWait(session,who+'.HomeClose.strictGate',`!document.querySelector('#home-inventory[open]')&&document.activeElement.matches('[data-room-card-home]')`);
  }
  evidence.strictClose=true;
  async function authenticateCold(){
    coldClients=[0,1].map(()=>new WsClient(serviceProto,{server:'ws://127.0.0.1:3671',logger:undefined}));
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
  const nativeDb=new DatabaseSync(database,{readOnly:true});try{evidence.nativeBeforeRestart=fixture.accounts.map((account,index)=>{const row=nativeDb.prepare('SELECT payload, strings FROM role_profiles WHERE account_id=?').get(account.accountId),profile={bytes:[...row.payload],strings:JSON.parse(String(row.strings))};assert.deepEqual(profile,evidence.coldBeforeRestart[index].equipment.profile);const inventory=nativeDb.prepare('SELECT record FROM inventory WHERE account_id=? ORDER BY instance_id').all(account.accountId).map(r=>JSON.parse(String(r.record)));assert.deepEqual(inventory,evidence.coldBeforeRestart[index].inventory.records);const owned={base:[],equipment:[]};for(const r of nativeDb.prepare('SELECT kind, record FROM role_records WHERE account_id=? ORDER BY instance_id').all(account.accountId))owned[r.kind==='base'?'base':'equipment'].push(JSON.parse(String(r.record)));assert.deepEqual(owned,evidence.coldBeforeRestart[index].owned);const hotkeys=Array(7).fill(0);for(const r of nativeDb.prepare('SELECT slot, instance_id FROM hotkeys WHERE account_id=? ORDER BY slot').all(account.accountId))hotkeys[r.slot-1]=r.instance_id;assert.deepEqual(hotkeys,evidence.coldBeforeRestart[index].inventory.hotkeys);return {profile,inventory,owned,hotkeys};});for(const row of evidence.retainedReceipts)assert.equal(nativeDb.prepare('SELECT receipt FROM shop_purchases WHERE account_id=? AND request_id=?').get(row.account_id,row.request_id).receipt,row.receipt);}finally{nativeDb.close();}
  for(const client of coldClients)await client.disconnect();coldClients=[];
  await stop(server);evidence.compiledStoppedBeforeRestart=true;await startServer();
  await authenticateCold();evidence.coldAfterRestart=[];
  for(const client of coldClients)evidence.coldAfterRestart.push(await coldQuery(client));
  assert.deepEqual(evidence.coldAfterRestart,evidence.coldBeforeRestart);evidence.sameDatabaseCompiledRestart=true;
  for(const client of coldClients)await client.disconnect();coldClients=[];

  const writes=network.filter(row=>row.direction==='sent'&&(['BUY','LEARN','MAINTAIN','SELL','EQUIP','UNEQUIP','ASSIGN'].includes(row.payload?.operation)));assert.equal(writes.length,0);assert.equal([...events.values()].flat().filter(event=>event.type==='itemUsed').length,0);
  assert.equal(evidence.runtime.filter(r=>r.method==='Runtime.exceptionThrown').length,0);evidence.status='PASS_FINITE_LEARNED_PET2_10231_NATIVE_INJURY_ACTIVE_MOVE_FIXED_EXPIRY_BASELINE_DUAL_STATE_NATIVE_RESTART_SUMMARY_HOME_CLOSE_SCOPE';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
  evidence.observationFinally=[];for(const page of pages){try{evidence.observationFinally.push({page:page.sessionId,evidence:await evaluate(page.sessionId,'window.hitSpeedEvidence')});}catch(error){evidence.observerSaveError=String(error);}}
  for(const client of coldClients)await client.disconnect();coldClients=[];
  try{const db=new DatabaseSync(database,{readOnly:true});try{evidence.savedCheckpoint=output+'-checkpoint.sqlite';await backup(db,evidence.savedCheckpoint);await chmod(evidence.savedCheckpoint,0o600);}finally{db.close();}await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:evidence.savedCheckpoint,accounts:fixture.accounts,source:checkpoint,newFundsOrRecordsInjected:false})+'\n',{mode:0o600});}catch(error){evidence.checkpointError=String(error);}
  evidence.nativeKeyEvents=[];for(const page of pages){try{evidence.nativeKeyEvents.push({page:page.sessionId,events:await evaluate(page.sessionId,'window.hitSpeedKeyEvents??[]')});}catch(error){evidence.nativeKeyObserverError=String(error);}}
  evidence.snapshotRetention={maximumPerPage:1000,fullSessionClaim:false};evidence.playerInputs=network.filter(n=>n.name==='PlayerInput'&&n.direction==='sent');
  evidence.eventTimes=eventTimes;evidence.network=network;evidence.snapshots=[...snapshots].map(([page,frames])=>({page,frames}));evidence.events=[...events].map(([page,rows])=>({page,rows}));
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
}
