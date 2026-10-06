import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {DatabaseSync, backup} from 'node:sqlite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3632',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-directional-armor-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-directional-armor-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
let coldClients=[];
const fixtureIndex=process.argv.indexOf('--fixture'),databaseIndex=process.argv.indexOf('--database');
const fixturePath=fixtureIndex>=0?process.argv[fixtureIndex+1]:undefined;
assert(fixturePath&&!fixturePath.startsWith('--'),'Explicit Numeric final committed identity fixture required');
const fixture=JSON.parse(await readFile(fixturePath,'utf8'));
const checkpoint=databaseIndex>=0?process.argv[databaseIndex+1]:fixture.database;
assert(checkpoint&&fixture.accounts?.length===2&&fixture.accounts.every(a=>a.token),'Explicit legitimate dual identities/database required');
const expectedDamage={};
for(const direction of ['front','side','back']){const index=process.argv.indexOf('--expected-'+direction+'-damage');assert(index>=0,'Explicit Numeric '+direction+' damage');const value=Number(process.argv[index+1]);assert(Number.isFinite(value)&&value>0);expectedDamage[direction]=value;}
const snapshots=new Map(),events=new Map();
const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const pages=[],contexts=[];
const evidence={status:'RUNNING',runId,domStages:[],ports:{server:3632,vite:5662,cdp:9862},fixture:{source:checkpoint,fixturePath,newFundsOrRecordsInjected:false,newBuyOrEquip:false},expectedDamage,scope:'Ordinary host A/D body orientation front/side/back and peer native sole2001 per direction; explicit Numeric damages/bodyYaw-bearing categories, dual full snapshots/websame-tick players, phase exits/Close; no transactions/equipment/FX/restart',runtime:[]};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3632',ACCOUNT_DB_PATH:database};server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5662,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3632',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9862',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9862/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9862');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(['Runtime.exceptionThrown','Runtime.consoleAPICalled'].includes(m.method))evidence.runtime.push({method:m.method,params:m.params});});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(received&&r.service.name==='RoomSnapshot'){const rows=snapshots.get(m.sessionId)??[];rows.push({snapshot:r.msg,wallTime:Date.now()});if(rows.length>1000)rows.shift();snapshots.set(m.sessionId,rows);}if(received&&r.service.name==='RoomEvent'){const rows=events.get(m.sessionId)??[];rows.push(r.msg);events.set(m.sessionId,rows);}if(['PlayerInput','PetSkillLearning','PartSale','PartMaintenance','OwnedRoleSale','Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop','RoleProfile','Kitbag','TankTextures','CreateRoom','Join','Leave','JoinRoom','LeaveRoom'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Runtime.enable',{},sessionId);await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.accounts[index].token)+');'},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:`window.directionalArmorKeyEvents=[];for(const type of ['keydown','keyup'])window.addEventListener(type,event=>{if(!['Space','ArrowLeft','ArrowRight','KeyA','KeyD'].includes(event.code))return;const target=event.target;window.directionalArmorKeyEvents.push({type,code:event.code,key:event.key,isTrusted:event.isTrusted,wallTime:Date.now(),target:target instanceof Element?{tag:target.tagName,id:target.id}:null,focus:document.activeElement?.outerHTML,world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null')});},true);`},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5662'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

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
  await nativeClick(host,'[data-room-card-create]');
  await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')?.matches(':enabled')`);
  await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');
  await waitUntil(host,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);await nativeClick(host,'[data-room-create-confirm]');
  await condition(()=>state(host)?.phase==='WAITING','Host WAITING');
  await waitUntil(host,`!document.querySelector('[data-room-create-dialog][open]')&&(()=>{const w=JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null');return w?.mapLoaded&&w.phase==='WAITING'})()`);
  const roomId=state(host).roomId;
  await waitUntil(peer,`document.querySelector('[data-room-card-id="${roomId}"]')?.matches(':enabled')`);
  await nativeClick(peer,`[data-room-card-id="${roomId}"]`);
  const point=await evaluate(peer,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...point},peer);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...point},peer);
  await condition(()=>state(peer)?.roomId===roomId&&state(host)?.players.length===2,'Dual Join');
  for(const session of [peer,host]){await waitUntil(session,`(()=>{const w=JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null');return w?.mapLoaded&&w.renderedPlayers===2})()`);await waitUntil(session,`document.querySelector('[data-waiting-ready]')?.matches(':enabled')`);await nativeClick(session,'[data-waiting-ready]');}
  await condition(()=>state(host)?.phase==='PLAYING'&&state(peer)?.phase==='PLAYING','PLAYING');
  const hostId=lastResponse('CreateRoom')?.playerId,peerId=lastResponse('Join',peer)?.playerId;assert(hostId&&peerId);
  const actor=(snapshot,id)=>snapshot.players.find(p=>p.id===id);
  const key=(session,type,code,key,virtual)=>command('Input.dispatchKeyEvent',{type,code,key,windowsVirtualKeyCode:virtual},session);
  const fires=(session,id)=>(events.get(session)??[]).filter(e=>e.type==='fire'&&e.playerId===id);
  const hits=(session,attacker,victim)=>(events.get(session)??[]).filter(e=>e.type==='hit'&&e.playerId===attacker&&e.targetId===victim&&e.shotPlayerResult?.itemId===2001);
  async function aimAndFire(session,attacker,victim,label){
    const fireCount=fires(host,attacker).length,hitCount=hits(host,attacker,victim).length;
    assert.equal(actor(state(host),attacker).ammoItemId,2001);await nativeClick(session,'#world');
    const inputs=[],deadline=Date.now()+16000;let aimed=false;
    while(Date.now()<deadline){
      const snapshot=state(host),me=actor(snapshot,attacker),enemy=actor(snapshot,victim);assert(me?.alive&&enemy?.alive);
      const desired=Math.atan2(enemy.x-me.x,enemy.z-me.z),error=Math.atan2(Math.sin(desired-me.yaw-me.aim),Math.cos(desired-me.yaw-me.aim));inputs.push({tick:snapshot.tick,error});
      if(Math.abs(error)<.035){await new Promise(r=>setTimeout(r,250));const next=actor(state(host),attacker),residual=Math.atan2(Math.sin(desired-next.yaw-next.aim),Math.cos(desired-next.yaw-next.aim));if(Math.abs(residual)<.035){aimed=true;break;}continue;}
      const code=error>0?'ArrowLeft':'ArrowRight',virtual=error>0?37:39;await key(session,'keyDown',code,code,virtual);try{await new Promise(r=>setTimeout(r,Math.min(100,Math.max(25,Math.abs(error)/.9*600))));}finally{await key(session,'keyUp',code,code,virtual);}await new Promise(r=>setTimeout(r,180));
    }
    evidence[label]={aimInputs:inputs,before:[state(host),state(peer)]};assert(aimed,'Ordinary aim before '+label);await observe(session,label+'.Space.before');
    await key(session,'keyDown','Space',' ',32);const pressedAt=Date.now();
    try{while(Date.now()-pressedAt<250&&fires(host,attacker).length===fireCount)await new Promise(r=>setTimeout(r,5));}
    finally{await key(session,'keyUp','Space',' ',32);evidence[label].heldMilliseconds=Date.now()-pressedAt;await observe(session,label+'.Space.released');}
    await condition(()=>fires(host,attacker).length>fireCount,'Actual '+label+' fire',5000);assert.equal(fires(host,attacker).length,fireCount+1);
    await condition(()=>hits(host,attacker,victim).length===hitCount+1&&hits(peer,attacker,victim).length===hitCount+1,'Dual '+label+' hit');assert.deepEqual(hits(host,attacker,victim),hits(peer,attacker,victim));evidence[label].hits=[hits(host,attacker,victim).slice(hitCount),hits(peer,attacker,victim).slice(hitCount)];
  }
  const initialOwner=actor(state(host),hostId);assert(!initialOwner.roleSkillSources?.selectedSkillIds.includes(13161),'Reactive source normally unequipped');evidence.initial=[state(host),state(peer)];
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
  const normalize=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
  function geometry(snapshot){const defender=actor(snapshot,hostId),shooter=actor(snapshot,peerId);assert(Number.isFinite(defender.bodyYaw));const bearing=Math.atan2(shooter.x-defender.x,shooter.z-defender.z),relative=normalize(bearing-defender.bodyYaw),absolute=Math.abs(relative);return {bodyYaw:defender.bodyYaw,bearing,relative,category:absolute<=Math.PI/4?'front':absolute>=3*Math.PI/4?'back':'side'};}
  async function orient(direction){
    await nativeClick(host,'#world');const offset={front:0,side:Math.PI/2,back:Math.PI}[direction],inputs=[];const until=Date.now()+30000;let aligned=false;
    while(Date.now()<until){const g=geometry(state(host)),desired=normalize(g.bearing-offset),error=normalize(desired-g.bodyYaw);inputs.push({tick:state(host).tick,...g,error});
      if(Math.abs(error)<.06){await new Promise(r=>setTimeout(r,250));if(geometry(state(host)).category===direction){aligned=true;break;}continue;}
      const code=error>0?'KeyA':'KeyD',letter=error>0?'a':'d',virtual=error>0?65:68;await key(host,'keyDown',code,letter,virtual);try{await new Promise(r=>setTimeout(r,Math.min(120,Math.max(35,Math.abs(error)*150))));}finally{await key(host,'keyUp',code,letter,virtual);}await new Promise(r=>setTimeout(r,180));
    }
    assert(aligned,'Actual native A/D '+direction+' body alignment');return inputs;
  }
  for(const direction of ['front','side','back']){
    const bodyInputs=await orient(direction),beforeHP=actor(state(host),hostId).hp;
    await aimAndFire(peer,peerId,hostId,direction);evidence[direction].bodyInputs=bodyInputs;
    const beforeGeometry=geometry(evidence[direction].before[0]);assert.equal(beforeGeometry.category,direction);evidence[direction].hitGeometry=beforeGeometry;
    assert(Math.abs(evidence[direction].hits[0][0].value-expectedDamage[direction])<1e-6,'Explicit '+direction+' damage');
    const after=await sharedAfter(direction),defender=actor(after[0],hostId);assert.equal(defender.hp,Math.trunc(beforeHP-expectedDamage[direction]));assert.equal(actor(after[1],hostId).hp,defender.hp);evidence[direction].beforeHP=beforeHP;evidence[direction].afterHP=defender.hp;
    await new Promise(r=>setTimeout(r,600));
  }
  assert.equal(fires(host,peerId).length,3);assert.equal(fires(peer,peerId).length,3);assert.equal(fires(host,hostId).length,0);
  evidence.closure={roomId,leaves:[]};
  for(const [index,session] of [peer,host].entries()){
    const who=index===0?'peer':'host';
    if(index===1)await condition(()=>state(host)?.phase==='FINISHED','Host FINISHED after peer leaves');
    const phase=state(session)?.phase;assert.equal(phase,index===0?'PLAYING':'FINISHED');
    const selector=index===0?'[data-leave-room]':'[data-summary-leave]';
    await stageWait(session,who+'.'+phase+'.sourceExitReady',`document.querySelector('${selector}')?.matches(':enabled')`);
    await nativeClick(session,selector);
    await condition(()=>lastResponse('Leave',session)?.roomId===roomId,who+' confirmed Leave');
    evidence.closure.leaves.push({page:session,phase,selector,confirmed:lastResponse('Leave',session)});
    await stageWait(session,who+'.Leave.lobbyGate',`!document.querySelector('#battle-status')?.dataset.world&&document.querySelector('[data-room-card-home]')?.matches(':enabled')`);
  }
  for(const [index,session] of [peer,host].entries()){
    const who=index===0?'peer':'host';await nativeClick(session,'[data-room-card-home]');
    await stageWait(session,who+'.HomeClose.sourceReady',`document.querySelector('[data-home-close]')?.matches(':enabled')`);
    await nativeClick(session,'[data-home-close]');
    await stageWait(session,who+'.HomeClose.strictGate',`!document.querySelector('#home-inventory[open]')&&document.activeElement.matches('[data-room-card-home]')`);
  }
  evidence.strictClose=true;assert.equal(fires(host,peerId).length,3);assert.equal(fires(host,hostId).length,0);
  const writes=network.filter(n=>n.direction==='sent'&&(['BUY','LEARN','MAINTAIN','SELL','EQUIP','UNEQUIP'].includes(n.payload?.operation)));assert.equal(writes.length,0);assert.equal([...events.values()].flat().filter(e=>e.type==='itemUsed').length,0);assert.equal([...events.values()].flat().filter(e=>e.type==='playerHealed').length,0);
  evidence.status='PASS_FINITE_NATIVE_BODY_FRONT_SIDE_BACK_ARMOR_THREE_PEER_SHOTS_DUAL_STATE_SUMMARY_HOME_CLOSE_SCOPE';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
  for(const client of coldClients)await client.disconnect();coldClients=[];
  try{const db=new DatabaseSync(database,{readOnly:true});try{evidence.savedCheckpoint=output+'-checkpoint.sqlite';await backup(db,evidence.savedCheckpoint);}finally{db.close();}await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:evidence.savedCheckpoint,accounts:fixture.accounts,source:checkpoint,newFundsOrRecordsInjected:false})+'\n',{mode:0o600});}catch(error){evidence.checkpointError=String(error);}
  evidence.nativeKeyEvents=[];for(const page of pages){try{evidence.nativeKeyEvents.push({page:page.sessionId,events:await evaluate(page.sessionId,'window.directionalArmorKeyEvents??[]')});}catch(error){evidence.nativeKeyObserverError=String(error);}}
  evidence.playerInputs=network.filter(n=>n.name==='PlayerInput'&&n.direction==='sent');
  evidence.network=network;evidence.snapshots=[...snapshots].map(([page,frames])=>({page,frames}));evidence.events=[...events].map(([page,rows])=>({page,rows}));
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
}
