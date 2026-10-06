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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3620',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-pet-food-healing-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-pet-food-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const tailIndex=process.argv.indexOf('--unreached-tail');
const firstPath=tailIndex>=0?process.argv[tailIndex+1]:undefined;
assert(tailIndex<0||firstPath&&!firstPath.startsWith('--'));
const first=firstPath?JSON.parse(await readFile(firstPath,'utf8')):undefined;
const fixtureIndex=process.argv.indexOf('--fixture');
const fixturePath=firstPath?firstPath.replace(/\.json$/,'-checkpoint-fixture.json'):fixtureIndex>=0?process.argv[fixtureIndex+1]:undefined;
assert(fixturePath&&!fixturePath.startsWith('--'),'Explicit Numeric committed dual-identity fixture required');
const databaseIndex=process.argv.indexOf('--database');
const fixture=JSON.parse(await readFile(fixturePath,'utf8')),checkpoint=databaseIndex>=0?process.argv[databaseIndex+1]:fixture.database;
assert(checkpoint&&fixture.accounts?.length===2&&fixture.accounts.every(a=>a.token),'Fixture must contain database and two legitimate identities');
const snapshots=new Map(),events=new Map();
const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const pages=[],contexts=[];
const evidence={status:'RUNNING',runId,firstPath,reusedPetPopup:first?.pet,unreachedTail:Boolean(firstPath),ports:{server:3620,vite:5650,cdp:9850},fixture:{source:checkpoint,fixturePath,newFundsOrRecordsInjected:false,newBuyOrLearn:false,earnedPointsProved:false},scope:'Read confirmed Pet103 slot0rank1 popup, ordinary dual pages/CPU naturalhurt deficit>=240, sole food1 nativeDigit5 confirmedvalue240/count1to0, dual complete snapshots, normalLeave/HomeClose; prior food FX/audio/layout evidence reused, same-tempDB compiled restart/cold-query equality, no screenshots/two-round suite',runtime:[]};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3620',ACCOUNT_DB_PATH:database};server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5650,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3620',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9850',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9850/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9850');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(['Runtime.exceptionThrown','Runtime.consoleAPICalled'].includes(m.method))evidence.runtime.push({method:m.method,params:m.params});});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(received&&r.service.name==='RoomSnapshot'){const rows=snapshots.get(m.sessionId)??[];rows.push({snapshot:r.msg,wallTime:Date.now()});if(rows.length>1000)rows.shift();snapshots.set(m.sessionId,rows);}if(received&&r.service.name==='RoomEvent'){const rows=events.get(m.sessionId)??[];rows.push(r.msg);events.set(m.sessionId,rows);}if(['PetSkillLearning','PartSale','PartMaintenance','OwnedRoleSale','Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop','RoleProfile','Kitbag','TankTextures','CreateRoom','Join','Leave','JoinRoom','LeaveRoom'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Runtime.enable',{},sessionId);await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.accounts[index].token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5650'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

  }

  const host=pages[0].sessionId,peer=pages[1].sessionId;
  const state=session=>(snapshots.get(session)??[]).at(-1)?.snapshot;
  const lastResponse=(name,session=host)=>network.filter(n=>n.page===session&&n.direction==='received'&&n.name===name&&n.success).at(-1)?.response;
  async function condition(test,label,timeout=45000) {const until=Date.now()+timeout;while(Date.now()<until){if(test())return;await new Promise(r=>setTimeout(r,50));}throw new Error(label);}
  let inventory;
  if(!firstPath){
  await nativeClick(host,'[data-room-card-home]');
  await waitUntil(host,`document.querySelector('#home-inventory [data-role-tab="pet"]')?.matches(':enabled')`);
  await nativeClick(host,'#home-inventory [data-role-tab="pet"]');
  await condition(()=>lastResponse('OwnedRoles')?.base?.some(r=>new Map(r.fields).get(8)===103),'Confirmed ownedPet103');
  const pet=lastResponse('OwnedRoles').base.find(r=>new Map(r.fields).get(8)===103),fields=new Map(pet.fields),instance=fields.get(0);
  assert.equal(fields.get(0x44),10811);assert.equal(fields.get(0x5c),1);
  await waitUntil(host,`document.querySelector('#home-roles [data-owned-role="${instance}"]')?.matches(':enabled')`);
  await nativeClick(host,'#home-roles [data-owned-role="'+instance+'"]');
  await waitUntil(host,`document.querySelector('[data-home-pet-view-skill="0"]')?.matches(':enabled')`);
  await nativeClick(host,'[data-home-pet-view-skill="0"]');
  await waitUntil(host,`document.querySelector('[data-pet-skill-dialog]')?.open&&document.querySelector('[data-pet-skill-dialog]').dataset.skillId==='10811'&&document.querySelector('[data-pet-skill-dialog] [data-source-control="txtLv"]')?.textContent==='1'`);
  evidence.pet={instanceId:instance,record:pet,popup:await evaluate(host,`document.querySelector('[data-pet-skill-dialog]').textContent`)};
  await nativeClick(host,'[data-pet-skill-close]');await waitUntil(host,`!document.querySelector('[data-pet-skill-dialog]')`);
  await nativeClick(host,'[data-roles-close]');await waitUntil(host,`!document.querySelector('#home-roles')&&document.querySelector('[data-room-card-home]')?.matches(':enabled')`);
  inventory=lastResponse('Inventory');assert(inventory,'Home confirmed Inventory');
  }else{inventory=first.initialInventory;evidence.pet=first.pet;}
  const food=inventory.records.find(r=>r.itemTableId===1);assert(food);assert.equal(food.ownedQuantity,1);assert.equal(inventory.hotkeys[3],food.instanceId);
  evidence.initialInventory=inventory;
  await nativeClick(host,'[data-room-card-create]');
  await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')?.matches(':enabled')`);
  await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');
  await waitUntil(host,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);
  await nativeClick(host,'[data-room-create-confirm]');
  await condition(()=>state(host)?.phase==='WAITING','Ordinary room WAITING');
  await waitUntil(host,`!document.querySelector('[data-room-create-dialog][open]')&&(()=>{const w=JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null');return w?.mapLoaded&&w.phase==='WAITING'})()`);
  const roomId=state(host).roomId;
  await waitUntil(peer,`document.querySelector('[data-room-card-id="${roomId}"]')?.matches(':enabled')`);
  await nativeClick(peer,'[data-room-card-id="'+roomId+'"]');
  const point=await evaluate(peer,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...point},peer);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...point},peer);
  await condition(()=>state(peer)?.roomId===roomId&&state(host)?.players.length===2,'Dual ordinary room join');
  await waitUntil(peer,`(()=>{const w=JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null');return w?.mapLoaded&&w.phase==='WAITING'})()`);
  for(let index=0;index<3;index++){
    await waitUntil(host,`document.querySelector('[data-add-cpu]')?.matches(':enabled')`);
    await nativeClick(host,'[data-add-cpu]');await condition(()=>state(host)?.players.length===index+3,'CPU addition');
  }
  for(const session of [host,peer])await waitUntil(session,`(()=>{const w=JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null');return w?.mapLoaded&&w.renderedPlayers===5})()`);
  for(const session of [peer,host]){await waitUntil(session,`document.querySelector('[data-waiting-ready]')?.matches(':enabled')`);await nativeClick(session,'[data-waiting-ready]');}
  await condition(()=>state(host)?.phase==='PLAYING'&&state(peer)?.phase==='PLAYING','PLAYING');
  const ownerId=lastResponse('CreateRoom')?.playerId;assert(ownerId,'Confirmed CreateRoom.playerId');
  evidence.entry=[state(host),state(peer)];
  await nativeClick(host,'#world');
  await condition(()=>{const w=state(host),p=w?.players.find(p=>p.id===ownerId);return w?.phase==='PLAYING'&&p?.alive&&p.maxHp-p.hp>=240;},'Natural CPU injury deficit>=240',180000);
  evidence.beforeUse=[state(host),state(peer)];
  const before=state(host).players.find(p=>p.id===ownerId);assert(before.alive&&before.maxHp-before.hp>=240);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'5',code:'Digit5',windowsVirtualKeyCode:53},host);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'5',code:'Digit5',windowsVirtualKeyCode:53},host);
  const used=session=>(events.get(session)??[]).filter(e=>e.type==='itemUsed'&&e.skillId===1&&e.playerId===ownerId);
  await condition(()=>used(host).length===1&&used(peer).length===1,'Both confirmed food events');
  assert.equal(used(host)[0].value,240);assert.deepEqual(used(host),used(peer));evidence.foodEvents=[used(host),used(peer)];
  const confirmedAt=Date.now();
  const snapshotKey=snapshot=>JSON.stringify([snapshot.roomId,snapshot.match.round,snapshot.phase,snapshot.tick,snapshot.serverTime]);
  const commonAfter=()=>{
    const peers=new Map((snapshots.get(peer)??[]).map(f=>[snapshotKey(f.snapshot),f.snapshot]));
    const frame=(snapshots.get(host)??[]).findLast(f=>f.wallTime>=confirmedAt&&f.snapshot.roomId===roomId
      &&f.snapshot.match.round===evidence.beforeUse[0].match.round&&f.snapshot.phase==='PLAYING'
      &&peers.has(snapshotKey(f.snapshot)));
    return frame?{host:frame.snapshot,peer:peers.get(snapshotKey(frame.snapshot))}:undefined;
  };
  await condition(()=>Boolean(commonAfter()),'Both complete post-heal snapshots');
  const after=commonAfter();assert(after);
  assert.deepEqual(after.host.players,after.peer.players);
  const projection=({playerId,...snapshot})=>snapshot;
  assert.deepEqual(projection(after.host),projection(after.peer));
  evidence.afterUse=[after.host,after.peer];
  const dom=await Promise.all([host,peer].map(s=>evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));evidence.webStates=dom;
  for(const session of [peer,host]){
    await waitUntil(session,`document.querySelector('[data-leave-room]')?.matches(':enabled')`);await nativeClick(session,'[data-leave-room]');
    await waitUntil(session,`!document.querySelector('#battle-status')?.dataset.world&&document.querySelector('[data-room-card-home]')?.matches(':enabled')`);
    assert.equal(lastResponse('Leave',session)?.roomId,roomId);
  }
  await nativeClick(host,'[data-room-card-home]');
  await waitUntil(host,`document.querySelector('[data-source-control="rdoItem"]')?.matches(':enabled')`);
  await nativeClick(host,'[data-source-control="rdoItem"]');
  await condition(()=>lastResponse('Inventory')?.records.find(r=>r.instanceId===food.instanceId)?.ownedQuantity===0,'Final confirmed stock zero');
  evidence.finalInventory=lastResponse('Inventory');assert.equal(evidence.finalInventory.records.find(r=>r.instanceId===food.instanceId).ownedQuantity,0);assert.equal(evidence.finalInventory.hotkeys[3],food.instanceId);
  await waitUntil(host,`document.querySelector('[data-home-close]')?.matches(':enabled')`);await nativeClick(host,'[data-home-close]');
  await waitUntil(host,`!document.querySelector('#home-inventory[open]')&&document.activeElement.matches('[data-room-card-home]')`);evidence.strictClose=true;
  async function coldQueries(session) {
    const start=network.length;
    await nativeClick(session,'[data-room-card-home]');
    await waitUntil(session,`document.querySelector('#home-inventory [data-role-tab="pet"]')?.matches(':enabled')`);
    await nativeClick(session,'#home-inventory [data-role-tab="pet"]');
    const fresh=name=>network.filter(n=>n.index>=start&&n.page===session&&n.direction==='received'&&n.name===name&&n.success).at(-1)?.response;
    await condition(()=>fresh('Inventory')&&fresh('PetSkillLearning'),'Cold confirmed Inventory/PetLearning');
    const result={inventory:fresh('Inventory'),learning:fresh('PetSkillLearning')};
    assert(result.inventory.records.every(r=>r.battleQuantity===0),'Out-of-room Inventory battleQuantity0');
    await waitUntil(session,`document.querySelector('[data-roles-close]')?.matches(':enabled')`);
    await nativeClick(session,'[data-roles-close]');
    await waitUntil(session,`!document.querySelector('#home-roles')&&document.querySelector('[data-room-card-home]')?.matches(':enabled')`);
    return result;
  }
  evidence.outOfRoomBeforeRestart=[];
  for(const session of [host,peer])evidence.outOfRoomBeforeRestart.push(await coldQueries(session));
  await stop(server);evidence.compiledStoppedBeforeRestart=true;await startServer();
  for(const session of [host,peer]) {
    await command('Page.reload',{ignoreCache:true},session);
    await waitUntil(session,`document.querySelector('[data-room-card-home]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);
  }
  evidence.outOfRoomAfterRestart=[];
  for(const session of [host,peer])evidence.outOfRoomAfterRestart.push(await coldQueries(session));
  assert.deepEqual(evidence.outOfRoomAfterRestart,evidence.outOfRoomBeforeRestart);
  evidence.sameDatabaseCompiledRestart=true;
  const writes=network.filter(n=>n.direction==='sent'&&(['BUY','LEARN','MAINTAIN','SELL'].includes(n.payload?.operation)));assert.equal(writes.length,0);
  evidence.status='PASS_FINITE_LEARNED_PET103_FOOD240_NATIVE_SHORTCUT_DUAL_STATE_STOCK_ZERO_RESTART_LEAVE_CLOSE_SCOPE';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
  try{const db=new DatabaseSync(database,{readOnly:true});try{evidence.savedCheckpoint=output+'-checkpoint.sqlite';await backup(db,evidence.savedCheckpoint);}finally{db.close();}await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:evidence.savedCheckpoint,accounts:fixture.accounts,source:checkpoint,newFundsOrRecordsInjected:false})+'\n');}catch(error){evidence.checkpointError=String(error);}
  evidence.network=network; evidence.snapshots=[...snapshots].map(([page,frames])=>({page,frames})); evidence.events=[...events].map(([page,rows])=>({page,rows}));
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
}
