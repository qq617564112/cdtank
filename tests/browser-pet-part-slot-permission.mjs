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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3622',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-pet-part-slot-permission-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-pet-part-slot-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const tailIndex=process.argv.indexOf('--unreached-tail');
const firstPath=tailIndex>=0?process.argv[tailIndex+1]:undefined;
assert(tailIndex<0||firstPath&&!firstPath.startsWith('--'));
const first=firstPath?JSON.parse(await readFile(firstPath,'utf8')):undefined;
const fixtureIndex=process.argv.indexOf('--fixture');
const databaseIndex=process.argv.indexOf('--database');
const fixturePath=firstPath?firstPath.replace(/\.json$/,'-checkpoint-fixture.json'):fixtureIndex>=0?process.argv[fixtureIndex+1]:undefined;
assert(fixturePath&&!fixturePath.startsWith('--'),'Explicit Numeric committed identity fixture required');
const fixture=JSON.parse(await readFile(fixturePath,'utf8'));
const checkpoint=databaseIndex>=0?process.argv[databaseIndex+1]:fixture.database;
assert(checkpoint&&fixture.accounts?.length>=1&&fixture.accounts[0].token,'Explicit committed database/account required');
const snapshots=new Map(),events=new Map();
const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const pages=[],contexts=[];
const evidence={status:'RUNNING',runId,firstPath,unreachedTail:Boolean(firstPath),ports:{server:3622,vite:5652,cdp:9852},fixture:{source:checkpoint,fixturePath,newFundsOrRecordsInjected:false,newBuyOrLearn:false,earnedPointsProved:false},scope:'Confirmed Pet3 current10311/rank1, Tank3 Equipment slotCount3 and existing14003 slot2; ordinary Delete UNEQUIP then same owned instance EQUIP slot2, slot3 disabled, strictClose; no screenshots/restart/CPU',runtime:[]};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3622',ACCOUNT_DB_PATH:database};server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5652,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3622',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9852',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9852/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9852');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Runtime.enable',{},sessionId);await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.accounts[index].token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5652'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

  }

  const host=pages[0].sessionId;
  const state=session=>(snapshots.get(session)??[]).at(-1)?.snapshot;
  const lastResponse=(name,session=host)=>network.filter(n=>n.page===session&&n.direction==='received'&&n.name===name&&n.success).at(-1)?.response;
  async function condition(test,label,timeout=45000) {const until=Date.now()+timeout;while(Date.now()<until){if(test())return;await new Promise(r=>setTimeout(r,50));}throw new Error(label);}
  let petInstance=first?.pet?.instanceId;
  if(!firstPath){
  await nativeClick(host,'[data-room-card-home]');
  await waitUntil(host,`document.querySelector('#home-inventory [data-role-tab="pet"]')?.matches(':enabled')`);
  await nativeClick(host,'#home-inventory [data-role-tab="pet"]');
  await condition(()=>lastResponse('OwnedRoles')?.base?.some(r=>new Map(r.fields).get(8)===3),'Confirmed ownedPet3');
  const owned=lastResponse('OwnedRoles');
  const pet=owned.base.find(r=>new Map(r.fields).get(8)===3),fields=new Map(pet.fields);petInstance=fields.get(0);
  assert.equal(fields.get(0x44),10311);assert.equal(fields.get(0x5c),1);
  await waitUntil(host,`document.querySelector('#home-roles [data-owned-role="${petInstance}"]')?.matches(':enabled')`);
  await nativeClick(host,`#home-roles [data-owned-role="${petInstance}"]`);
  await waitUntil(host,`document.querySelector('[data-home-pet-skill="0"]')?.dataset.skillId==='10311'&&document.querySelector('[data-home-pet-skill="0"]').dataset.skillLevel==='1'`);
  evidence.pet={instanceId:petInstance,record:pet,web:await evaluate(host,`(()=>{const e=document.querySelector('[data-home-pet-skill="0"]');return {skillId:e.dataset.skillId,rank:e.dataset.skillLevel,text:e.textContent}})()`)};
  await nativeClick(host,'[data-roles-close]');
  await waitUntil(host,`!document.querySelector('#home-roles')&&document.querySelector('[data-room-card-home]')?.matches(':enabled')`);
  }else{assert(petInstance,'First confirmed Pet instance');evidence.pet=first.pet;}
  await nativeClick(host,'[data-room-card-home]');
  await waitUntil(host,`document.querySelector('#home-inventory [data-role-tab="tank"]')?.matches(':enabled')`);
  await nativeClick(host,'#home-inventory [data-role-tab="tank"]');
  await waitUntil(host,`document.querySelector('#home-roles [data-source-control="rdoEquip"][data-source-layout="ui/layouts/myhome_panzerpage.xml"]')?.matches(':enabled')`);
  await nativeClick(host,'#home-roles [data-source-control="rdoEquip"][data-source-layout="ui/layouts/myhome_panzerpage.xml"]');
  await waitUntil(host,`document.querySelector('#home-equipment')?.open&&document.querySelector('#home-equipment').getAttribute('aria-busy')==='false'&&document.querySelector('[data-equipment-slot="2"]')?.matches(':enabled')`);
  const initial=lastResponse('Equipment');assert(initial);assert.equal(initial.slotCount,3);
  const partInstance=initial.slots[2];assert(partInstance>0);
  const inventory=lastResponse('Inventory');assert.equal(inventory.records.find(r=>r.instanceId===partInstance)?.itemTableId,14003);
  const profile=new DataView(Uint8Array.from(initial.profile.bytes).buffer),tankInstance=profile.getUint32(0xa8,true);
  const tank=lastResponse('OwnedRoles').equipment.find(r=>new Map(r.fields).get(0x1c)===tankInstance);assert(tank);
  assert.equal(new Map(tank.fields).get(0x24),3);assert.equal(new Map(tank.fields).get(0x6c),2);
  assert.equal(profile.getUint32(0xa4,true),petInstance);
  const inspect=()=>evaluate(host,`(()=>{const e=document.querySelector('#home-equipment');return {slots:[...e.querySelectorAll('[data-equipment-slot]')].map(s=>({slot:Number(s.dataset.equipmentSlot),instanceId:Number(s.dataset.instanceId),disabled:s.disabled})),status:e.querySelector('output')?.textContent}})()`);
  const initialWeb=await inspect();assert.equal(initialWeb.slots.find(s=>s.slot===2).instanceId,partInstance);assert.equal(initialWeb.slots.find(s=>s.slot===3).disabled,true);
  evidence.initial={equipment:initial,inventory,tank,web:initialWeb,partInstance};
  const mutationStart=network.length;
  await nativeClick(host,'[data-equipment-slot="2"]');
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Delete',code:'Delete',windowsVirtualKeyCode:46},host);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Delete',code:'Delete',windowsVirtualKeyCode:46},host);
  await condition(()=>network.some(n=>n.index>=mutationStart&&n.direction==='received'&&n.name==='Equipment'&&n.success&&n.response.slots[2]===0),'Confirmed UNEQUIP');
  await waitUntil(host,`document.querySelector('[data-equipment-slot="2"]')?.dataset.instanceId==='0'&&document.querySelector('[data-equipment-slot="2"]').matches(':enabled')`);
  evidence.unequipped={confirmed:lastResponse('Equipment'),web:await inspect()};
  await waitUntil(host,`document.querySelector('[data-equipment-item="${partInstance}"]')?.matches(':enabled')`);
  await nativeClick(host,`[data-equipment-item="${partInstance}"]`);
  await nativeClick(host,'[data-equipment-slot="2"]');
  await condition(()=>lastResponse('Equipment')?.slots[2]===partInstance,'Confirmed same-instance EQUIP');
  await waitUntil(host,`document.querySelector('[data-equipment-slot="2"]')?.dataset.instanceId==='${partInstance}'&&document.querySelector('[data-equipment-slot="2"]').matches(':enabled')`);
  evidence.equipped={confirmed:lastResponse('Equipment'),web:await inspect()};
  assert.equal(evidence.equipped.confirmed.slotCount,3);assert.equal(evidence.equipped.web.slots.find(s=>s.slot===3).disabled,true);
  const mutations=network.filter(n=>n.index>=mutationStart&&n.direction==='sent'&&n.name==='Equipment'&&n.payload.operation!=='QUERY');
  assert.deepEqual(mutations.map(n=>n.payload),[{operation:'UNEQUIP',target:'PART',slot:2},{operation:'EQUIP',target:'PART',slot:2,instanceId:partInstance}]);
  evidence.mutations=mutations;
  await nativeClick(host,'[data-equipment-close]');
  await waitUntil(host,`!document.querySelector('#home-equipment')`);
  const parentOpen=await evaluate(host,`Boolean(document.querySelector('#home-inventory[open]'))`);
  if(parentOpen){await waitUntil(host,`document.querySelector('[data-home-close]')?.matches(':enabled')`);await nativeClick(host,'[data-home-close]');}
  await waitUntil(host,`!document.querySelector('#home-equipment')&&!document.querySelector('#home-inventory[open]')&&document.activeElement.matches('[data-room-card-home]')`);
  evidence.strictClose=true;
  assert.equal(network.filter(n=>n.direction==='sent'&&['BUY','LEARN','MAINTAIN','SELL'].includes(n.payload?.operation)).length,0);
  evidence.status='PASS_FINITE_LEARNED_PET3_PART_SLOT_PERMISSION_OWNED_INSTANCE_UNEQUIP_REEQUIP_CLOSE_SCOPE';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
  try{const db=new DatabaseSync(database,{readOnly:true});try{evidence.savedCheckpoint=output+'-checkpoint.sqlite';await backup(db,evidence.savedCheckpoint);}finally{db.close();}await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:evidence.savedCheckpoint,accounts:fixture.accounts,source:checkpoint,newFundsOrRecordsInjected:false})+'\n',{mode:0o600});}catch(error){evidence.checkpointError=String(error);}
  evidence.network=network;
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
}
