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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3238',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const lifecycleOnly=false;
const effectExpiryOnly=false;
const businessOnly=true;
const output='recovery/output/browser-cpu-loadout-'+(effectExpiryOnly?'effect-expiry-':lifecycleOnly?'lifecycle-':businessOnly?'business-':'')+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-cpu-loadout-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3238,vite:5398,cdp:9598},mapId:7,ammo:2007,
  runId,lifecycleOnly,businessOnly,scope:'Directed second dualvisibleCPU Effect18/SE17 check: finite2007x15/item3x5 at source maxima, ordinary KeyD turn4s each player toward nearby CPU fighting, no camera/pose injection; Rebuilt host WAITING ordinary UI CpuCONFIGURE finite2007/item3; natural CPU fire/actualburn/autonomousskill3, dualoriginalEffect18SE17, account stock/balance isolation and normalLeavecleanup; network supplies two-round/restart/humanCAS'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3238',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'30'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5398,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3238',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9598',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9598/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9598');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Shop','Account','Inventory','Kitbag','CreateRoom','Join','Cpu','Autopilot','Ready','Rematch','Leave','RoomSnapshot','RoomEvent','PlayerInput'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5398',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  store=new AccountStore(database);const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(r=>r.tankId===1&&r.part===0);
  for(const [index,page]of pages.entries()){
    const account=store.open(await evaluate(page.sessionId,`localStorage.getItem('cdtank-account-token')`));
    const baseFields=new Map(Object.keys(native.base).map(k=>[Number(k),0])),equipmentFields=new Map(Object.keys(native.equipment).map(k=>[Number(k),0]));baseFields.set(0,73);baseFields.set(8,1);baseFields.set(0x2c,600);baseFields.set(0x34,5);baseFields.set(0x3c,10);equipmentFields.set(0x1c,74);equipmentFields.set(0x24,1);equipmentFields.set(0x3c,100);equipmentFields.set(0x40,70);equipmentFields.set(0x4c,15);equipmentFields.set(0x50,30);equipmentFields.set(0x58,2001);
    store.replaceRoleRecords(account.accountId,{base:[{name:'Explicit base pet1 fixture',fields:baseFields}],equipment:[{name:'Explicit base tank1 fixture',fields:equipmentFields}]});assert.equal(store.inventory(account.accountId).records.length,0);const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa4,73,true);view.setUint32(0xa8,74,true);view.setUint32(0x70,index===1?100:0,true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
  }
  store.close();store=undefined;
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')`);await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
  const joinPoint=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...joinPoint},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...joinPoint},guest);
  await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
  await waitUntil(host,`!document.querySelector('[data-room-create-dialog][open]')`);const cpuIds=[];for(let i=0;i<3;i++){await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.filter(p=>p.isCpu).length===${i+1}`);}const configured=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.filter(p=>p.isCpu).map(p=>p.id)`);for(const cpuId of configured){cpuIds.push(cpuId);const root=`[data-cpu-loadout="${cpuId}"]`;await nativeClick(host,root+' summary');await waitUntil(host,`document.querySelector('${root} [data-cpu-loadout-save]')?.matches(':enabled')`);for(const[slot,item,quantity]of [[2,2007,15],[5,3,5]]){await nativeSelect(host,root+` [data-cpu-loadout-slot="${slot}"] [data-cpu-loadout-item]`,item);await nativeClick(host,root+` [data-cpu-loadout-slot="${slot}"] [data-cpu-loadout-quantity]`);for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},host);await command('Input.insertText',{text:String(quantity)},host);}await nativeClick(host,root+' [data-cpu-loadout-save]');await waitUntil(host,`document.querySelector('${root} [data-cpu-loadout-status]').value.includes('配给已确认')`);await nativeClick(host,root+' summary');}evidence.configured=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);await nativeClick(host,`[data-cpu-loadout="${cpuIds[0]}"] summary`);const configShot=await command('Page.captureScreenshot',{format:'png'},host);await writeFile(output+'-configured.png',Buffer.from(configShot.data,'base64'));await nativeClick(host,`[data-cpu-loadout="${cpuIds[0]}"] summary`);assert.equal(await evaluate(guest,`document.querySelectorAll('[data-cpu-loadout]').length`),0);for(const p of pages)await waitUntil(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).renderedPlayers===5`);
  for(const page of pages){
    await evaluate(page.sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world')),scene=engine.scenes[0];
      engine.setHardwareScalingLevel(4);engine.resize();window.muzzleScene=scene;window.muzzleCamera=scene.activeCamera;
      window.muzzle={effects:[],sounds:[],events:[],frames:0,frameTimes:[],canvas:{width:engine.getRenderWidth(),height:engine.getRenderHeight()}};
      const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');
      window.injection={effects:[],sounds:[],actualDraws:0,drawSubmissions:0};const {EFFECT_PRIMARY_TAGS}=await import('/src/assets/tanks/effect-tag-matrices.ts');
      const attached=EffectRuntime.prototype.spawnAttachedEffect;EffectRuntime.prototype.spawnAttachedEffect=function(view,id,tag,once,local){const handle=attached.call(this,view,id,tag,once,local);if(id===18){window.injectionRuntime=this;const instance=this.instances.find(i=>i.handle===handle);window.injection.effects.push({handle,id,boundRootName:view.root.name,tag,once,drawCount:instance?.draws.length??0,rootId:instance?.tree.root.definition.index,treeNodes:instance?.tree.nodes.length,actualTag:EFFECT_PRIMARY_TAGS[tag],parentReferenceMatches:!!instance&&instance.tree.parentMatrix===view.primaryTag(EFFECT_PRIMARY_TAGS[tag])});}return handle;};
      const sound=EffectRuntime.prototype.playSkillSound;EffectRuntime.prototype.playSkillSound=function(view,reference,selector){const handle=sound.call(this,view,reference,selector);if(reference==='SE17'){window.injectionRuntime=this;const voice=this.skillSound.voices.get(handle),row={handle,reference,selector,src:voice?.audio.src,loop:voice?.audio.loop,context:this.skillSound.context?.state,played:false,ended:false};voice?.audio.addEventListener('playing',()=>row.played=true);voice?.audio.addEventListener('ended',()=>row.ended=true);window.injection.sounds.push(row);}return handle;};
      const draw=EffectRuntime.prototype.draw;EffectRuntime.prototype.draw=function(instance,node){const result=draw.call(this,instance,node);if(window.injection.effects.some(e=>e.handle===instance.handle)){const meshes=[node.sprite?.mesh,node.particle?.sprite.mesh,node.overlay?.mesh,...(node.model?.meshes??[])].filter(Boolean);if(meshes.some(m=>m.isEnabled()&&m.getTotalVertices()>0))window.injection.drawSubmissions++;for(const mesh of meshes)if(!mesh.injectionMonitor){mesh.injectionMonitor=true;mesh.onAfterRenderObservable.add(()=>window.injection.actualDraws++);}}return result;};

      const add=EffectRuntime.prototype.addInstance;EffectRuntime.prototype.addInstance=function(...args){window.muzzleRuntime=this;return add.apply(this,args);};
      const {BattleSound}=await import('/src/audio/battle-sound.ts');const event=BattleSound.prototype.event;BattleSound.prototype.event=function(value,...args){window.muzzleSound=this;const result=event.call(this,value,...args);if(value.type==='fire')window.muzzle.events.push(value);return result;};
      const {Battle}=await import('/src/match/battle.ts');const reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.muzzleBattle=this;const result=reconcile.apply(this,args);if(this.roomFeed.snapshot){const players=this.roomFeed.snapshot.players;window.muzzle.snapshots??=[];const states=players.map(p=>({id:p.id,alive:p.alive,ammoItemId:p.ammoItemId,selectedAmmoSlot:p.selectedAmmoSlot}));const key=JSON.stringify(states);if(window.muzzle.snapshots.at(-1)?.key!==key)window.muzzle.snapshots.push({key,states,phase:window.muzzle.phase,round:this.roomFeed.snapshot.match.round});}return result;};
      scene.onAfterRenderObservable.add(()=>{window.muzzle.frames++;if(window.muzzle.frameTimes.length<3000)window.muzzle.frameTimes.push(engine.getDeltaTime());});
    })()`);
  }
  for(const s of [guest,host]){await waitUntil(s,`document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await nativeClick(s,'[data-waiting-ready]');}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  // Original spawn heading faces away from the nearby CPU fight; turn the player through normal controls.
  evidence.normalViewingInput={key:'KeyD',durationMs:4000,reason:'Turn original player body toward nearby CPU fighting; camera continues its normal follow behavior',cpuFiniteQuantities:{ammo2007:15,injection3:5}};
  for(const p of pages){await command('Page.bringToFront',{},p.sessionId);await evaluate(p.sessionId,`document.activeElement?.blur()`);await command('Input.dispatchKeyEvent',{type:'keyDown',key:'d',code:'KeyD',windowsVirtualKeyCode:68},p.sessionId);await new Promise(r=>setTimeout(r,4000));await command('Input.dispatchKeyEvent',{type:'keyUp',key:'d',code:'KeyD',windowsVirtualKeyCode:68},p.sessionId);}
  console.log('Normal map0007 two-account room PLAYING');
  const key=async(s,key,code,windowsVirtualKeyCode)=>{await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode},s);};
  const world=s=>evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  const ids=await Promise.all(pages.map(async p=>(await world(p.sessionId)).playerId));evidence.initial=await Promise.all(pages.map(p=>world(p.sessionId)));
  const ownerId=ids[0],peerId=ids[1],owner=async()=>{const s=await world(host);return s.players.find(p=>p.id===ownerId);};
  const stock=(s,id)=>s.players.find(p=>p.id===id).ammoSlots.find(a=>a.slot===2).quantity;
  evidence.fixture={source:'explicit measured sourceHP600 fixture',humanInventory:'empty',cpuLoadout:'only normal authenticated hostCpuCONFIGURE'};async function waitNetwork(check,ms=25000){const end=Date.now()+ms;while(!check()&&Date.now()<end)await new Promise(r=>setTimeout(r,20));assert(check(),'Natural CPU injection deadline');}const battleEvents=()=>network.filter(e=>e.page===host&&e.direction==='received'&&e.name==='RoomEvent').map(e=>e.payload);await waitNetwork(()=>battleEvents().some(e=>e.type==='itemUsed'&&e.skillId===3&&cpuIds.includes(e.playerId)));const used=battleEvents().find(e=>e.type==='itemUsed'&&e.skillId===3&&cpuIds.includes(e.playerId));const before=battleEvents().slice(0,battleEvents().indexOf(used)).filter(e=>e.type==='hit'&&e.targetId===used.playerId).at(-1);assert(before);assert(battleEvents().some(e=>e.type==='fire'&&e.skillId===2007&&e.playerId===before.playerId));evidence.causal={hit:before,used};await waitUntil(host,`window.muzzleBattle.roomFeed.snapshot.players.find(p=>p.id==='${used.playerId}').cpuLoadout.find(i=>i.itemTableId===3).quantity<5`);evidence.afterCPUUse=await world(host);assert(evidence.afterCPUUse.players.find(p=>p.id===used.playerId).cpuLoadout.find(i=>i.itemTableId===3).quantity<5);await waitUntil(host,`window.injection.actualDraws>0`);for(const[i,p]of pages.entries()){await waitUntil(p.sessionId,`window.injection.actualDraws>0`,15000);const shot=await command('Page.captureScreenshot',{format:'png'},p.sessionId);await writeFile(output+'-cpu-injection-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}
  for(const p of pages)await waitUntil(p.sessionId,`window.injection.actualDraws>0&&window.injection.sounds.some(s=>s.played&&s.ended)&&window.injectionRuntime.skillSound.voices.size===0`,15000);evidence.consumers=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.injection`)));for(const c of evidence.consumers){assert(c.effects.some(e=>e.id===18&&e.drawCount>0&&e.actualTag==='tag_efcenter'&&e.parentReferenceMatches));assert(c.drawSubmissions>0&&c.actualDraws>0);assert(c.sounds.some(s=>s.reference==='SE17'&&s.context==='running'&&s.loop===false&&s.played&&s.ended));}
  const shared=page=>network.filter(e=>e.page===page&&e.name==='RoomEvent'&&e.direction==='received'&&['fire','hit','ammoConsumed','itemUsed','itemRejected'].includes(e.payload.type)).map(e=>e.payload);const hostEvents=shared(host),guestEvents=shared(guest),common=Math.min(hostEvents.length,guestEvents.length);assert.deepEqual(hostEvents.slice(0,common),guestEvents.slice(0,common));assert(hostEvents.slice(0,common).some(e=>e.type==='itemUsed'&&e.skillId===3));evidence.sharedEvents=hostEvents.slice(0,common);
  for(const page of pages)await nativeClick(page.sessionId,'[data-leave-room]');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({instances:window.muzzleRuntime.instances.length,voices:window.muzzleSound.voices.size,state:document.querySelector('[data-source-audio="battle-sound"]').dataset.state})`)));for(const c of evidence.cleanup)assert.deepEqual(c,{instances:0,voices:0,state:'stopped'});
  evidence.network=network;evidence.status='PASS';console.log('PASS: '+output+'.json');
}catch(error){if(ws)for(const[i,page]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.consumerObserved=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.injection`).catch(()=>null)));if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.muzzle`).catch(e=>({error:String(e)}))));throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
