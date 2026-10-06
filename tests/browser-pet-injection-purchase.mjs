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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3234',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const lifecycleOnly=false;
const effectExpiryOnly=false;
const businessOnly=true;
const output='recovery/output/browser-pet-injection-purchase-'+(effectExpiryOnly?'effect-expiry-':lifecycleOnly?'lifecycle-':businessOnly?'business-':'')+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-pet-injection-purchase-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3234,vite:5394,cdp:9594},mapId:7,ammo:2007,
  runId,lifecycleOnly,businessOnly,scope:'Rebuilt paiditem3 source10 MONEY/10 TOKENS, empty target inventory normalItem BUY2/Home acquired slot4/Digit5 cures real2007 firstburntick; qty2→1, dualEffect18SE17 and HP487, Leave/sameDB originaltoken balance80 stock1 shortcut restart; prior two-round/expiry evidence reused'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3234',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'30'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5394,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3234',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9594',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9594/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9594');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5394',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  store=new AccountStore(database);const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(r=>r.tankId===1&&r.part===0);
  for(const [index,page]of pages.entries()){
    const account=store.open(await evaluate(page.sessionId,`localStorage.getItem('cdtank-account-token')`));
    const baseFields=new Map(Object.keys(native.base).map(k=>[Number(k),0])),equipmentFields=new Map(Object.keys(native.equipment).map(k=>[Number(k),0]));baseFields.set(0,73);baseFields.set(8,1);baseFields.set(0x2c,600);baseFields.set(0x34,5);baseFields.set(0x3c,10);equipmentFields.set(0x1c,74);equipmentFields.set(0x24,1);equipmentFields.set(0x3c,100);equipmentFields.set(0x40,70);equipmentFields.set(0x4c,15);equipmentFields.set(0x50,30);equipmentFields.set(0x58,2001);
    store.replaceRoleRecords(account.accountId,{base:[{name:'Explicit base pet1 fixture',fields:baseFields}],equipment:[{name:'Explicit base tank1 fixture',fields:equipmentFields}]});if(index===0)store.replaceInventory(account.accountId,[{instanceId:77,itemTableId:2007,ownedQuantity:1,battleQuantity:1,state:0,field8:0,float24Bits:0,float28Bits:0,float2cBits:0}]);else assert.equal(store.inventory(account.accountId).records.length,0);const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa4,73,true);view.setUint32(0xa8,74,true);view.setUint32(0x70,index===1?100:0,true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
  }
  store.close();store=undefined;
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  await nativeClick(guest,'[data-room-card-shop]');await waitUntil(guest,`document.querySelector('#account-shop')?.getAttribute('aria-busy')==='false'`);await nativeSelect(guest,'[data-shop-item]',3);await nativeClick(guest,'[data-shop-quantity]');for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},guest);await command('Input.insertText',{text:'2'},guest);evidence.product=await evaluate(guest,`document.querySelector('[data-shop-product]').textContent`);assert(evidence.product.includes('10金币 / 10软星币'));await nativeClick(guest,'[data-shop-buy]');await waitUntil(guest,`document.querySelector('[data-shop-status]').value.includes('已购买')&&document.querySelector('#account-shop').dataset.purchasedInstance`);const instanceId=Number(await evaluate(guest,`document.querySelector('#account-shop').dataset.purchasedInstance`));evidence.purchase=await evaluate(guest,`({status:document.querySelector('[data-shop-status]').value,balance:document.querySelector('[data-shop-balance]').textContent,instanceId:document.querySelector('#account-shop').dataset.purchasedInstance})`);assert(evidence.purchase.balance.includes('金币：80 · 软星币：0'));const purchasedShot=await command('Page.captureScreenshot',{format:'png'},guest);await writeFile(output+'-purchased.png',Buffer.from(purchasedShot.data,'base64'));await nativeClick(guest,'[data-shop-close]');
  evidence.inventoryBefore=[];for(const[i,p]of pages.entries()){const s=p.sessionId,ownedInstance=i===0?77:instanceId,slot=i===0?1:4;await nativeClick(s,'[data-room-card-home]');if(i===1){await nativeClick(s,'[data-source-control="rdoItem"]');}await waitUntil(s,`document.querySelector('[data-inventory-instance="${ownedInstance}"]')?.matches(':enabled')`);await nativeClick(s,`[data-inventory-instance="${ownedInstance}"]`);await nativeClick(s,`[data-kitbag-slot="${slot}"]`);await waitUntil(s,`document.querySelector('[data-kitbag-slot="${slot}"]').dataset.instanceId==='${ownedInstance}'`);evidence.inventoryBefore.push(await evaluate(s,`({item:document.querySelector('[data-inventory-instance="${ownedInstance}"]').textContent,slot:document.querySelector('[data-kitbag-slot="${slot}"]').dataset.instanceId})`));await nativeClick(s,'[data-home-close]');}
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')`);await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
  const joinPoint=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...joinPoint},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...joinPoint},guest);
  await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
  await waitUntil(host,`!document.querySelector('[data-room-create-dialog][open]')`);for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===2})()`);
  for(const page of pages){
    await evaluate(page.sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world')),scene=engine.scenes[0];
      engine.setHardwareScalingLevel(4);engine.resize();window.muzzleScene=scene;window.muzzleCamera=scene.activeCamera;
      window.muzzle={effects:[],sounds:[],events:[],frames:0,frameTimes:[],canvas:{width:engine.getRenderWidth(),height:engine.getRenderHeight()}};
      const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');
      window.injection={effects:[],sounds:[],actualDraws:0,drawSubmissions:0};const {EFFECT_PRIMARY_TAGS}=await import('/src/assets/tanks/effect-tag-matrices.ts');
      const attached=EffectRuntime.prototype.spawnAttachedEffect;EffectRuntime.prototype.spawnAttachedEffect=function(view,id,tag,once,local){const handle=attached.call(this,view,id,tag,once,local);if(id===18){window.injectionRuntime=this;const instance=this.instances.find(i=>i.handle===handle);window.injection.effects.push({handle,id,tag,once,drawCount:instance?.draws.length??0,rootId:instance?.tree.root.definition.index,treeNodes:instance?.tree.nodes.length,actualTag:EFFECT_PRIMARY_TAGS[tag],parentReferenceMatches:!!instance&&instance.tree.parentMatrix===view.primaryTag(EFFECT_PRIMARY_TAGS[tag])});}return handle;};
      const sound=EffectRuntime.prototype.playSkillSound;EffectRuntime.prototype.playSkillSound=function(view,reference,selector){const handle=sound.call(this,view,reference,selector);if(reference==='SE17'){window.injectionRuntime=this;const voice=this.skillSound.voices.get(handle),row={handle,reference,selector,src:voice?.audio.src,loop:voice?.audio.loop,context:this.skillSound.context?.state,played:false,ended:false};voice?.audio.addEventListener('playing',()=>row.played=true);voice?.audio.addEventListener('ended',()=>row.ended=true);window.injection.sounds.push(row);}return handle;};
      const draw=EffectRuntime.prototype.draw;EffectRuntime.prototype.draw=function(instance,node){const result=draw.call(this,instance,node);if(window.injection.effects.some(e=>e.handle===instance.handle)){const meshes=[node.sprite?.mesh,node.particle?.sprite.mesh,node.overlay?.mesh,...(node.model?.meshes??[])].filter(Boolean);if(meshes.some(m=>m.isEnabled()&&m.getTotalVertices()>0))window.injection.drawSubmissions++;for(const mesh of meshes)if(!mesh.injectionMonitor){mesh.injectionMonitor=true;mesh.onAfterRenderObservable.add(()=>window.injection.actualDraws++);}}return result;};

      const add=EffectRuntime.prototype.addInstance;EffectRuntime.prototype.addInstance=function(...args){window.muzzleRuntime=this;return add.apply(this,args);};
      const {BattleSound}=await import('/src/audio/battle-sound.ts');const event=BattleSound.prototype.event;BattleSound.prototype.event=function(value,...args){window.muzzleSound=this;const result=event.call(this,value,...args);if(value.type==='fire')window.muzzle.events.push(value);return result;};
      const {Battle}=await import('/src/match/battle.ts');const reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.muzzleBattle=this;const result=reconcile.apply(this,args);if(this.roomFeed.snapshot){const players=this.roomFeed.snapshot.players;window.muzzle.snapshots??=[];const states=players.map(p=>({id:p.id,alive:p.alive,ammoItemId:p.ammoItemId,selectedAmmoSlot:p.selectedAmmoSlot}));const key=JSON.stringify(states);if(window.muzzle.snapshots.at(-1)?.key!==key)window.muzzle.snapshots.push({key,states,phase:window.muzzle.phase,round:this.roomFeed.snapshot.match.round});}return result;};
      scene.onAfterRenderObservable.add(()=>{window.muzzle.frames++;if(window.muzzle.frameTimes.length<3000)window.muzzle.frameTimes.push(engine.getDeltaTime());});
    })()`);
  }
  for(const s of [host]){await waitUntil(s,`document.querySelector('[data-autopilot]')&&!document.querySelector('[data-autopilot]').disabled`);await nativeClick(s,'[data-autopilot]');}
  for(const s of [guest,host]){await waitUntil(s,`document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await nativeClick(s,'[data-waiting-ready]');}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  console.log('Normal map0007 two-account room PLAYING');
  const key=async(s,key,code,windowsVirtualKeyCode)=>{await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode},s);};
  const world=s=>evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  const ids=await Promise.all(pages.map(async p=>(await world(p.sessionId)).playerId));evidence.initial=await Promise.all(pages.map(p=>world(p.sessionId)));
  const ownerId=ids[0],peerId=ids[1],owner=async()=>{const s=await world(host);return s.players.find(p=>p.id===ownerId);};
  const stock=(s,id)=>s.players.find(p=>p.id===id).ammoSlots.find(a=>a.slot===2).quantity;
  evidence.fixture={source:'tank-numeric-sol-network measured pet1HP600/tank1 fixture with complete native field layout',owned2007:1,shooterInstance:77,initialTargetInventory:'empty',purchasedInstance:instanceId,experimentalTargetMoney:100};assert(evidence.initial.every(s=>s.players.every(p=>p.maxHp===600)));
  async function waitNetwork(check,ms=15000){const end=Date.now()+ms;while(!check()&&Date.now()<end)await new Promise(r=>setTimeout(r,20));assert(check(),'Natural network event deadline');}
  const ownerEvents=()=>network.filter(e=>e.page===host&&e.direction==='received'&&e.name==='RoomEvent'&&e.payload.playerId===ownerId);
  await waitNetwork(()=>ownerEvents().some(e=>e.payload.type==='fire'&&e.payload.skillId===2007),20000);await nativeClick(host,'[data-battle-play-summary]');await waitUntil(host,`document.querySelector('[data-autopilot]')?.offsetParent`);await nativeClick(host,'[data-autopilot]');await evaluate(host,`document.activeElement?.blur()`);await command('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32},host);evidence.stoppedAfterNaturalFire=await world(host);
  await waitNetwork(()=>ownerEvents().some(e=>e.payload.type==='hit'&&e.payload.targetId===peerId));const initialHit=ownerEvents().find(e=>e.payload.type==='hit'&&e.payload.targetId===peerId);evidence.initialHit=initialHit;
  await waitNetwork(()=>ownerEvents().filter(e=>e.payload.type==='hit'&&e.payload.skillId===4005).length===1,8000);evidence.beforeInjection=await world(guest);assert(evidence.beforeInjection.players.find(p=>p.id===peerId).hp===487);await command('Page.bringToFront',{},guest);await evaluate(guest,`document.activeElement?.blur()`);await key(guest,'5','Digit5',53);await waitNetwork(()=>network.some(e=>e.page===host&&e.name==='RoomEvent'&&e.direction==='received'&&e.payload.type==='itemUsed'&&e.payload.skillId===3));evidence.used=network.find(e=>e.page===host&&e.name==='RoomEvent'&&e.direction==='received'&&e.payload.type==='itemUsed'&&e.payload.skillId===3).payload;evidence.afterInventory=await evaluate(guest,`window.muzzleBattle.inventory()`);assert.equal(evidence.afterInventory.records.find(r=>r.instanceId===instanceId).ownedQuantity,1);assert.equal(evidence.afterInventory.records.find(r=>r.instanceId===instanceId).battleQuantity,1);await key(guest,'5','Digit5',53);await waitNetwork(()=>network.some(e=>e.page===host&&e.name==='RoomEvent'&&e.direction==='received'&&e.payload.type==='itemRejected'&&e.payload.playerId===peerId));evidence.rejected=network.find(e=>e.page===host&&e.name==='RoomEvent'&&e.direction==='received'&&e.payload.type==='itemRejected'&&e.payload.playerId===peerId).payload;
  await waitUntil(guest,`window.injection.actualDraws>0`);if(!effectExpiryOnly){const effectShot=await command('Page.captureScreenshot',{format:'png'},guest);await writeFile(output+'-injection.png',Buffer.from(effectShot.data,'base64'));}
  for(const p of pages)await waitUntil(p.sessionId,`window.injection.actualDraws>0&&window.injection.sounds.some(s=>s.played&&s.ended)&&window.injectionRuntime.skillSound.voices.size===0`,15000);evidence.consumers=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.injection`)));for(const c of evidence.consumers){assert(c.effects.some(e=>e.id===18&&e.drawCount>0&&e.actualTag==='tag_efcenter'&&e.parentReferenceMatches));assert(c.drawSubmissions>0&&c.actualDraws>0);assert(c.sounds.some(s=>s.reference==='SE17'&&s.context==='running'&&s.loop===false&&s.played&&s.ended));}
  const until=evidence.beforeInjection.tick+200;await waitUntil(host,`window.muzzleBattle.roomFeed.snapshot.tick>=${until}`,12000);assert.equal(ownerEvents().filter(e=>e.payload.type==='hit'&&e.payload.skillId===4005).length,1);evidence.cleansed=await Promise.all(pages.map(p=>world(p.sessionId)));assert(evidence.cleansed.every(s=>s.players.find(p=>p.id===peerId).hp===487));evidence.visibleHealth=await Promise.all(pages.map(p=>evaluate(p.sessionId,`Array.from(document.querySelectorAll('.source-life-progress')).filter(e=>e.getAttribute('aria-valuenow')).map(e=>({name:e.getAttribute('aria-label'),now:e.getAttribute('aria-valuenow'),max:e.getAttribute('aria-valuemax'),title:e.title}))`)));
  assert.equal(ownerEvents().filter(e=>e.payload.type==='hit'&&e.payload.skillId===4005).length,1);const shared=page=>network.filter(e=>e.page===page&&e.name==='RoomEvent'&&e.direction==='received'&&['fire','hit','ammoConsumed','itemUsed','itemRejected'].includes(e.payload.type)).map(e=>e.payload);assert.deepEqual(shared(host),shared(guest));evidence.sharedEvents=shared(host);
  for(const page of pages)await nativeClick(page.sessionId,'[data-leave-room]');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({instances:window.muzzleRuntime.instances.length,voices:window.muzzleSound.voices.size,state:document.querySelector('[data-source-audio="battle-sound"]').dataset.state})`)));for(const c of evidence.cleanup)assert.deepEqual(c,{instances:0,voices:0,state:'stopped'});
  const token=await evaluate(guest,`localStorage.getItem('cdtank-account-token')`);await stop(server);await startServer();const origin=await evaluate(guest,`performance.timeOrigin`);await command('Page.reload',{},guest);await waitUntil(guest,`performance.timeOrigin!==${origin}&&document.querySelector('[data-room-card-home]')`);assert.equal(await evaluate(guest,`localStorage.getItem('cdtank-account-token')`),token);await nativeClick(guest,'[data-room-card-home]');await nativeClick(guest,'[data-source-control="rdoItem"]');await waitUntil(guest,`document.querySelector('[data-inventory-instance="${instanceId}"]')?.textContent.includes('×1')&&document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='${instanceId}'`);evidence.actualRestart=await evaluate(guest,`({item:document.querySelector('[data-inventory-instance="${instanceId}"]').textContent,slot:document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId})`);await nativeClick(guest,'[data-home-close]');await nativeClick(guest,'[data-room-card-shop]');await waitUntil(guest,`document.querySelector('[data-shop-balance]').textContent.includes('金币：80 · 软星币：0')`);evidence.actualRestart.balance=await evaluate(guest,`document.querySelector('[data-shop-balance]').textContent`);await nativeClick(guest,'[data-shop-close]');evidence.network=network;evidence.status='PASS';console.log('PASS: '+output+'.json');
}catch(error){if(ws&&!businessOnly)for(const[i,page]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.muzzle`).catch(e=>({error:String(e)}))));throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
