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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3661',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-pet-last-stand-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-pet-last-stand-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
let coldClients=[];
const tailIndex=process.argv.indexOf('--unreached-tail');
const firstPath=tailIndex>=0?process.argv[tailIndex+1]:undefined;
const first=firstPath?JSON.parse(await readFile(firstPath,'utf8')):undefined;
const firstRootReviewPath='recovery/output/pet-last-stand-browser-first-root-review.json';
let firstRootReview;
if(first){
 assert.equal(first.status,'FAIL');assert.equal(first.error,'AssertionError [ERR_ASSERTION]: HP0 aim');
 assert.equal(first.home?.instanceId,13);const fields=new Map(first.home.pet.fields);
 assert.equal(fields.get(8),4);assert.equal(fields.get(0x50),10441);assert.equal(fields.get(0x68),1);
 assert.equal(first.injuryShots.length,6);assert.equal(first.rooms.length,1);assert(first.savedCheckpoint);
 const id=first.rooms[0].hostId,room=first.rooms[0].roomId;
 assert(first.zero.players.some(p=>p.id===id&&p.hp===0&&p.alive));
 assert(!first.stageFire&&!first.finalDeath&&!first.respawn&&!first.strictClose);
 firstRootReview=JSON.parse(await readFile(firstRootReviewPath,'utf8'));
 assert.equal(firstRootReview.raw,firstPath);
 assert.equal(firstRootReview.status,'ACCEPTED_FINITE_LEARNED_PET4_HOME_ZERO_HP_NATIVE_MOVE_TURN_AIM_AUTHORITY_ONLY_ENDPOINT_SAMPLE_UNREACHED_SCOPE');
 assert.equal(firstRootReview.zeroHpAlive,true);assert.equal(firstRootReview.stageFireFinalDeathRespawnCloseProved,false);
 const native=first.nativeKeyEvents.find(p=>p.page===first.snapshots[0].page).events;
 for(const [code,field,sign] of [['KeyW','move',1],['KeyS','move',-1],['KeyA','turn',1],['KeyD','turn',-1],['ArrowLeft','aim',1],['ArrowRight','aim',-1]]){
  const down=native.findLast(e=>e.code===code&&e.type==='keydown'&&e.isTrusted&&e.world?.players.some(p=>p.id===id&&p.hp===0&&p.alive));
  const up=native.find(e=>e.code===code&&e.type==='keyup'&&e.isTrusted&&e.wallTime>down?.wallTime);assert(down&&up);
  assert(first.playerInputs.some(n=>n.page===first.snapshots[0].page&&n.payload[field]===sign&&n.payload.clientTime>=down.wallTime&&n.payload.clientTime<=up.wallTime));
  const reviewed=firstRootReview.nativeInputsAndAuthorityChanges.find(r=>r.code===code);assert(reviewed);assert.equal(reviewed.realInputSign,sign);
  const samples=reviewed.authoritySamples;
  for(const sample of samples)for(const page of first.snapshots){const frame=page.frames.find(f=>f.snapshot.roomId===room&&f.snapshot.tick===sample[0]);assert(frame);const actor=frame.snapshot.players.find(p=>p.id===id);assert.equal(actor.hp,0);assert.equal(actor.alive,true);assert.deepEqual([frame.snapshot.tick,actor.x,actor.z,actor.bodyYaw,actor.aim],sample);}
  if(field==='move')assert(samples.some((r,i)=>i&&Math.hypot(r[1]-samples[i-1][1],r[2]-samples[i-1][2])>0));
  else {const index=field==='turn'?3:4;assert(samples.some((r,i)=>i&&(r[index]-samples[i-1][index])*sign>0));}
 }
}
const fixtureIndex=process.argv.indexOf('--fixture'),databaseIndex=process.argv.indexOf('--database');
const fixturePath=first?firstPath.replace(/\.json$/,'-checkpoint-fixture.json'):fixtureIndex>=0?process.argv[fixtureIndex+1]:undefined;
assert(fixturePath&&!fixturePath.startsWith('--'),'Explicit legitimate identity fixture required');
const fixture=JSON.parse(await readFile(fixturePath,'utf8'));
const checkpoint=first?first.savedCheckpoint:databaseIndex>=0?process.argv[databaseIndex+1]:fixture.database;
assert(checkpoint&&fixture.accounts?.length===2&&fixture.accounts.every(a=>a.token),'Explicit legitimate dual identities/database required');
if(first)assert.equal(fixture.database,checkpoint);
const expectedIndex=process.argv.indexOf('--expected-base-damage');assert(first||expectedIndex>=0,'Explicit Numeric same-source/facet normal base damage');
const expectedBaseDamage=first?first.expectedBaseDamage:Number(process.argv[expectedIndex+1]);assert(Number.isFinite(expectedBaseDamage)&&expectedBaseDamage>0);
const snapshots=new Map(),events=new Map(),eventTimes=[];
const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const pages=[],contexts=[];
const evidence={status:'RUNNING',runId,rooms:[],roomClosures:[],domStages:[],ports:{server:3661,vite:5691,cdp:9891},fixture:{source:checkpoint,fixturePath,newFundsOrRecordsInjected:false,newBuyOrEquip:false},expectedBaseDamage,scope:'Selected owned Pet4 slot3rank1/popup10441; natural native2001 lethal hit; HP0 alive ordinary move/body/aim/fire; fixed3000ms final destroy/life(false), natural3000ms respawn/fire; fullshared/websame-tick/summary HomeClose. No newwire/FX or transactions',runtime:[]};
if(first)evidence.firstScope={raw:firstPath,rootReview:firstRootReviewPath,status:firstRootReview.status,home:first.home,zero:first.zero,zeroStage:first.zeroStage,nativeInputsAndAuthorityChanges:firstRootReview.nativeInputsAndAuthorityChanges,newOrdinaryRoom:true,oldSessionRestored:false};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3661',ACCOUNT_DB_PATH:database};server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5691,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3661',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9891',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9891/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9891');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Runtime.enable',{},sessionId);await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.accounts[index].token)+');'},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:`window.lastStandKeyEvents=[];for(const type of ['keydown','keyup'])window.addEventListener(type,event=>{if(!['Space','ArrowLeft','ArrowRight','KeyA','KeyD','KeyW','KeyS'].includes(event.code))return;const target=event.target;window.lastStandKeyEvents.push({type,code:event.code,key:event.key,isTrusted:event.isTrusted,wallTime:Date.now(),target:target instanceof Element?{tag:target.tagName,id:target.id}:null,focus:document.activeElement?.outerHTML,world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null')});},true);`},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:`
window.lastStandEvidence={lifeTransitions:[],fireCalls:[],ready:false};
window.lastStandReady=(async()=>{
 const [{BattlePlayers},{TankView}]=await Promise.all([import('/src/render/battle-players.ts'),import('/src/assets/tanks/tank-view.ts')]);
 const out=window.lastStandEvidence,targets=new WeakMap();
 const render=BattlePlayers.prototype.render;BattlePlayers.prototype.render=function(...args){for(const [id,view] of this.players)targets.set(view,id);return render.apply(this,args);};
 const life=TankView.prototype.life;TankView.prototype.life=function(alive){
  const changed=!this.disposed&&this.alive!==alive;
  const row=changed?{targetId:targets.get(this),alive,previousAlive:this.alive,wallTime:Date.now(),world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null')}:undefined;
  if(row)out.lifeTransitions.push(row);
  const result=life.call(this,alive);
  if(row)Promise.resolve(result).then(()=>{row.completed=true;row.action=this.activeAction;row.acceptsBattleActions=this.acceptsBattleActions;},error=>{row.error=String(error);});
  return result;
 };
 const fire=TankView.prototype.fire;TankView.prototype.fire=function(...args){out.fireCalls.push({targetId:targets.get(this),alive:this.alive,acceptsBattleActions:this.acceptsBattleActions,wallTime:Date.now(),world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null')});return fire.apply(this,args);};
 out.ready=true;
})();`},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5691'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-entry-page="login"] button[data-source-control="btnLogin"]')?.matches(':enabled')`);
    await nativeClick(sessionId,'[data-entry-page="login"] button[data-source-control="btnLogin"]');
    await waitUntil(sessionId,`document.querySelector('[data-channel-id="main"]')?.matches(':enabled')`);
    await nativeClick(sessionId,'[data-channel-id="main"]');
    const channelPoint=await evaluate(sessionId,`(()=>{const r=document.querySelector('[data-channel-id="main"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...channelPoint},sessionId);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...channelPoint},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')`);

    await evaluate(sessionId,'window.lastStandReady.then(()=>true)');

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
  if(first)evidence.home={...first.home,reusedFrom:firstPath,rootReview:firstRootReviewPath};
  else {
  const responseStart=network.length;
  await nativeClick(host,'[data-room-card-home]');await waitUntil(host,`document.querySelector('#home-inventory [data-role-tab="pet"]')?.matches(':enabled')`);await nativeClick(host,'#home-inventory [data-role-tab="pet"]');
  await condition(()=>network.some(n=>n.index>=responseStart&&n.page===host&&n.direction==='received'&&n.success&&n.name==='OwnedRoles')&&network.some(n=>n.index>=responseStart&&n.page===host&&n.direction==='received'&&n.success&&n.name==='RoleProfile'),'Home both authoritative owned/profile responses');
  const profile=lastResponse('RoleProfile')?.profile;assert(profile);
  const instanceId=new DataView(Uint8Array.from(profile.bytes).buffer).getUint32(0xa4,true);
  const pet=lastResponse('OwnedRoles').base.find(r=>new Map(r.fields).get(0)===instanceId);assert(pet);
  const fields=new Map(pet.fields);assert.equal(fields.get(8),4);assert.equal(fields.get(0x50),10441);assert.equal(fields.get(0x68),1);
  await waitUntil(host,`document.querySelector('[data-owned-role="${instanceId}"]')?.matches(':enabled')`);await nativeClick(host,`[data-owned-role="${instanceId}"]`);
  await waitUntil(host,`document.querySelector('[data-home-pet-skill="3"]')?.dataset.skillId==='10441'&&document.querySelector('[data-home-pet-skill="3"]').dataset.skillLevel==='1'`);
  await nativeClick(host,'[data-home-pet-view-skill="3"]');await waitUntil(host,`document.querySelector('[data-pet-skill-dialog][open]')?.dataset.skillId==='10441'`);
  evidence.home={pet,profile,instanceId,web:await evaluate(host,`document.querySelector('[data-home-pet-skill="3"]').textContent`),popup:await evaluate(host,`document.querySelector('[data-pet-skill-dialog][open]').textContent`)};
  await nativeClick(host,'[data-pet-skill-close]');await waitUntil(host,`!document.querySelector('[data-pet-skill-dialog][open]')`);
  await nativeClick(host,'[data-roles-close]');await waitUntil(host,`!document.querySelector('#home-roles')&&document.activeElement.matches('[data-room-card-home]')`);
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
  assert.equal(actor(state(host),peerId).petId,2);evidence.initial=[state(host),state(peer)];
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
  function geometry(snapshot){const defender=actor(snapshot,hostId),shooter=actor(snapshot,peerId),bearing=Math.atan2(shooter.x-defender.x,shooter.z-defender.z),relative=Math.atan2(Math.sin(bearing-defender.bodyYaw),Math.cos(bearing-defender.bodyYaw)),absolute=Math.abs(relative);return {bodyYaw:defender.bodyYaw,bearing,relative,category:absolute<=Math.PI/4?'front':absolute>=3*Math.PI/4?'back':'side'};}
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
  const initialFacet='front';evidence.sourceFacet=initialFacet;
  async function restoreFacet(){
    if(geometry(state(host)).category===initialFacet)return;
    await nativeClick(host,'#world');const offset={front:0,side:Math.PI/2,back:Math.PI}[initialFacet],until=Date.now()+30000;
    while(Date.now()<until){const g=geometry(state(host)),error=Math.atan2(Math.sin(g.bearing-offset-g.bodyYaw),Math.cos(g.bearing-offset-g.bodyYaw));
      if(Math.abs(error)<.06){await new Promise(r=>setTimeout(r,250));if(geometry(state(host)).category===initialFacet)return;continue;}
      const code=error>0?'KeyA':'KeyD',letter=error>0?'a':'d',virtual=error>0?65:68;await key(host,'keyDown',code,letter,virtual);try{await new Promise(r=>setTimeout(r,Math.min(120,Math.max(35,Math.abs(error)*150))));}finally{await key(host,'keyUp',code,letter,virtual);}await new Promise(r=>setTimeout(r,180));
    }
    throw new Error('Ordinary body-turn same facet after natural respawn');
  }

  assert.equal(actor(state(host),hostId).petId,4);
  assert(actor(state(host),hostId).roleSkillSources.equipmentSkills.some(s=>s.baseId===10441&&s.rank===1));
  evidence.initial=[state(host),state(peer)];
  await restoreFacet();
  // Host's first fire is reserved for HP0; normal aim and reload are ready before lethal.
  await aimAndFire(host,hostId,peerId,'hostPreAim',true);
  evidence.injuryShots=[];
  for(let accepted=0;accepted<20;accepted++){
    const label='injury'+accepted;
    await aimAndFire(peer,peerId,hostId,label);
    const before=evidence[label].before[0],target=actor(before,hostId),hit=evidence[label].hits[0][0];
    assert.equal(geometry(before).category,'front');assert.equal(typeof hit.shotPlayerResult.critical,'boolean');
    assert(Math.abs(hit.value-expectedBaseDamage*(hit.shotPlayerResult.critical?2:1))<1e-6);
    await condition(()=>actor(state(host),hostId).hp===Math.max(0,Math.trunc(target.hp-hit.value)),'Authoritative injury HP');
    evidence.injuryShots.push({label,before,hit,after:state(host)});
    if(actor(state(host),hostId).hp===0)break;
    await sharedAfter(label);
  }
  const zero=state(host),zeroActor=actor(zero,hostId);assert.equal(zeroActor.hp,0);assert.equal(zeroActor.alive,true);assert.equal(zeroActor.respawnAt,0);
  evidence.zero=zero;evidence.zeroStage={};
  const destroys=session=>(events.get(session)??[]).filter(e=>e.roomId===roomId&&e.type==='destroy'&&e.targetId===hostId);
  assert.equal(destroys(host).length,0);assert.equal(destroys(peer).length,0);
  await sharedAfter('zeroStage');evidence.zeroShared=evidence.zeroStage.snapshots;
  for(const snapshot of evidence.zeroShared){assert.equal(actor(snapshot,hostId).hp,0);assert.equal(actor(snapshot,hostId).alive,true);}
  if(!first){
  const staged=[];evidence.stageInputs=staged;
  async function stagePulse(code,letter,virtual){
    assert.equal(actor(state(host),hostId).alive,true);assert.equal(actor(state(host),hostId).hp,0);
    const before=state(host);await key(host,'keyDown',code,letter,virtual);
    try{await new Promise(r=>setTimeout(r,130));}finally{await key(host,'keyUp',code,letter,virtual);}
    await condition(()=>state(host).tick>before.tick,'HP0 ordinary input sampled',1000);
    const after=state(host);assert.equal(actor(after,hostId).alive,true);assert.equal(actor(after,hostId).hp,0);
    staged.push({code,before,after});
  }
  await nativeClick(host,'#world');
  await stagePulse('KeyW','w',87);await stagePulse('KeyS','s',83);
  await stagePulse('KeyA','a',65);await stagePulse('KeyD','d',68);
  await stagePulse('ArrowLeft','ArrowLeft',37);await stagePulse('ArrowRight','ArrowRight',39);
  for(const row of staged){const before=actor(row.before,hostId),after=actor(row.after,hostId);
    if(['KeyW','KeyS'].includes(row.code))assert(Math.hypot(after.x-before.x,after.z-before.z)>0,'HP0 move changes position');
    else if(['KeyA','KeyD'].includes(row.code))assert.notEqual(after.bodyYaw,before.bodyYaw,'HP0 body rotation');
    else assert.notEqual(after.aim,before.aim,'HP0 aim');
  }
  }
  await nativeClick(host,'#world');
  async function soleFire(session,id,label){
    await condition(()=>!(actor(state(host),id).reload?.remaining>0),'Legal reload '+label,5000);
    const before=state(host),count=fires(host,id).length,pressedAt=Date.now();
    const record=evidence[label]={before,pressedAt,fire:[]};
    await key(session,'keyDown','Space',' ',32);
    try{while(Date.now()-pressedAt<250&&fires(host,id).length===count)await new Promise(r=>setTimeout(r,5));}
    finally{await key(session,'keyUp','Space',' ',32);record.heldMilliseconds=Date.now()-pressedAt;record.releasedAt=Date.now();}
    await condition(()=>fires(host,id).length>count&&fires(peer,id).length>count,'Dual actual sole '+label,5000);
    assert.equal(fires(host,id).length,count+1);assert.equal(fires(peer,id).length,count+1);
    record.fire=[fires(host,id).at(-1),fires(peer,id).at(-1)];
    assert.deepEqual(evidence[label].fire[0],evidence[label].fire[1]);
    await sharedAfter(label);
  }
  await soleFire(host,hostId,'stageFire');
  assert.equal(actor(evidence.stageFire.before,hostId).hp,0);assert.equal(actor(evidence.stageFire.before,hostId).alive,true);
  for(const s of evidence.stageFire.snapshots){assert.equal(actor(s,hostId).hp,0);assert.equal(actor(s,hostId).alive,true);}
  assert.equal(destroys(host).length,0);assert.equal(destroys(peer).length,0);
  await condition(()=>destroys(host).length===1&&destroys(peer).length===1&&!actor(state(host),hostId).alive,'Fixed deadline final dual death',7000);
  evidence.finalDeath={destroy:[destroys(host)[0],destroys(peer)[0]]};assert.deepEqual(...evidence.finalDeath.destroy);
  const death=await sharedAfter('finalDeath');
  const frames=(snapshots.get(host)??[]).filter(f=>f.snapshot.roomId===roomId).map(f=>f.snapshot);
  const firstZero=frames.find(s=>actor(s,hostId)?.hp===0&&actor(s,hostId)?.alive);
  const lastPositive=frames.findLast(s=>s.tick<firstZero.tick&&actor(s,hostId)?.hp>0);
  const firstDead=frames.find(s=>!actor(s,hostId)?.alive);assert(firstZero&&lastPositive&&firstDead);
  const resolution=firstZero.serverTime-lastPositive.serverTime;
  assert(firstDead.serverTime>=lastPositive.serverTime+3000,'No death before fixed3s lethal time bracket');
  assert(firstDead.serverTime-firstZero.serverTime>=3000-resolution,'Fixed3s at observed snapshot resolution');
  for(const s of frames.filter(s=>s.tick>=firstZero.tick&&s.tick<firstDead.tick)){assert.equal(actor(s,hostId).hp,0);assert.equal(actor(s,hostId).alive,true);}
  for(const s of death){const p=actor(s,hostId);assert.equal(p.hp,0);assert.equal(p.alive,false);assert.equal(p.deaths,zeroActor.deaths+1);assert.equal(actor(s,peerId).kills,actor(zero,peerId).kills+1);assert.equal(p.respawnAt,firstDead.serverTime+3000);}
  evidence.deadline={lastPositive,firstZero,firstDead,snapshotResolutionMs:resolution};
  for(const session of [host,peer])await waitUntil(session,`window.lastStandEvidence.lifeTransitions.some(r=>r.targetId===${JSON.stringify(hostId)}&&r.alive===false&&r.completed&&r.action==='09')`,3000);
  await condition(()=>actor(state(host),hostId).alive&&actor(state(host),hostId).hp===actor(state(host),hostId).maxHp,'Natural respawn from final death deadline',7000);
  evidence.respawn={snapshot:state(host)};
  const firstRespawn=(snapshots.get(host)??[]).map(f=>f.snapshot).find(s=>s.roomId===roomId&&s.tick>firstDead.tick&&actor(s,hostId)?.alive);assert(firstRespawn);
  assert(firstRespawn.serverTime>=actor(firstDead,hostId).respawnAt);assert.equal(actor(firstRespawn,hostId).respawnAt,0);
  evidence.respawn.first=firstRespawn;
  await nativeClick(host,'#world');await soleFire(host,hostId,'respawnFire');
  evidence.lifeObservation=await Promise.all([host,peer].map(s=>evaluate(s,'window.lastStandEvidence')));
  for(const out of evidence.lifeObservation){const deaths=out.lifeTransitions.filter(r=>r.targetId===hostId&&!r.alive);assert.equal(deaths.length,1);assert(deaths[0].completed&&deaths[0].action==='09');assert(out.lifeTransitions.some(r=>r.targetId===hostId&&r.alive&&r.completed));assert(out.fireCalls.some(r=>r.targetId===hostId&&r.alive&&r.acceptsBattleActions&&r.world?.players.some(p=>p.id===hostId&&p.hp===0&&p.alive)));}
  assert.equal(destroys(host).length,1);assert.equal(destroys(peer).length,1);
  await closeRoom();
  for(const [index,session] of [peer,host].entries()){
    const who=index===0?'peer':'host';await nativeClick(session,'[data-room-card-home]');
    await stageWait(session,who+'.HomeClose.sourceReady',`document.querySelector('[data-home-close]')?.matches(':enabled')`);
    await nativeClick(session,'[data-home-close]');
    await stageWait(session,who+'.HomeClose.strictGate',`!document.querySelector('#home-inventory[open]')&&document.activeElement.matches('[data-room-card-home]')`);
  }
  evidence.strictClose=true;assert.equal(fires(host,hostId).length,2);assert.equal(fires(peer,hostId).length,2);
  const writes=network.filter(n=>n.direction==='sent'&&(['BUY','LEARN','MAINTAIN','SELL','EQUIP','UNEQUIP'].includes(n.payload?.operation)));assert.equal(writes.length,0);assert.equal([...events.values()].flat().filter(e=>e.type==='itemUsed').length,0);assert.equal([...events.values()].flat().filter(e=>e.type==='playerHealed').length,0);
  assert.equal(evidence.runtime.filter(r=>r.method==='Runtime.exceptionThrown').length,0);evidence.status='PASS_FINITE_LEARNED_PET4_10441_NATIVE_HP_ZERO_ALIVE_ACTIONS_FIXED_DEATH_RESPAWN_DUAL_STATE_SUMMARY_HOME_CLOSE_SCOPE';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
  evidence.lifeObservationFinally=[];for(const page of pages){try{evidence.lifeObservationFinally.push({page:page.sessionId,evidence:await evaluate(page.sessionId,'window.lastStandEvidence')});}catch(error){evidence.observerSaveError=String(error);}}
  for(const client of coldClients)await client.disconnect();coldClients=[];
  try{const db=new DatabaseSync(database,{readOnly:true});try{evidence.savedCheckpoint=output+'-checkpoint.sqlite';await backup(db,evidence.savedCheckpoint);await chmod(evidence.savedCheckpoint,0o600);}finally{db.close();}await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:evidence.savedCheckpoint,accounts:fixture.accounts,source:checkpoint,newFundsOrRecordsInjected:false})+'\n',{mode:0o600});}catch(error){evidence.checkpointError=String(error);}
  evidence.nativeKeyEvents=[];for(const page of pages){try{evidence.nativeKeyEvents.push({page:page.sessionId,events:await evaluate(page.sessionId,'window.lastStandKeyEvents??[]')});}catch(error){evidence.nativeKeyObserverError=String(error);}}
  evidence.snapshotRetention={maximumPerPage:1000,fullSessionClaim:false};evidence.playerInputs=network.filter(n=>n.name==='PlayerInput'&&n.direction==='sent');
  evidence.eventTimes=eventTimes;evidence.network=network;evidence.snapshots=[...snapshots].map(([page,frames])=>({page,frames}));evidence.events=[...events].map(([page,rows])=>({page,rows}));
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
}
