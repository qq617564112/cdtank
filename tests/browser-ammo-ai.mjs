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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3224',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const lifecycleOnly=process.argv.includes('--lifecycle-only');
const businessOnly=true;
const output='recovery/output/browser-ammo-ai-'+(lifecycleOnly?'lifecycle-':businessOnly?'business-':'')+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-ammo11-consumption-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3224,vite:5384,cdp:9584},mapId:7,ammo:2011,
  runId,lifecycleOnly,businessOnly,scope:'Rebuilt finite2011 owned/battle2; formal React inventory/Kitbag ordinary mouse, Digit2/Space two shots and exhaustion/default; dual original drawing/audio consumers; two natural30s rounds and actual restart. Related visual/audio dependency only.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3224',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'30'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5384,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3224',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9584',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9584/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9584');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Account','Inventory','Kitbag','CreateRoom','Join','Cpu','Autopilot','Ready','Rematch','Leave','RoomSnapshot','RoomEvent','PlayerInput'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5384',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  store=new AccountStore(database);const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(r=>r.tankId===1&&r.part===0);
  for(const [index,page]of pages.entries()){
    const account=store.open(await evaluate(page.sessionId,`localStorage.getItem('cdtank-account-token')`));
    const fields=v=>new Map(Object.entries(v).map(([k,v])=>[Number(k),v]));
    const equipment={name:'明确导入原战车',fields:fields(native.equipment)},base={name:'明确导入原宠物',fields:fields(native.base)};
    equipment.fields.set(0x1c,72);equipment.fields.set(0x24,1);equipment.fields.set(0x28,index?10021:10011);equipment.fields.set(0x2c,index?10022:10012);equipment.fields.set(0x30,index?10023:10013);
    store.replaceRoleRecords(account.accountId,{base:[base],equipment:[equipment]});
    store.replaceInventory(account.accountId,[{instanceId:77,itemTableId:2011,ownedQuantity:2,battleQuantity:2,state:0,field8:0,float24Bits:0,float28Bits:0,float2cBits:0}]);
    if(lifecycleOnly){store.assign(account.accountId,77,1);if(index===0)store.replaceInventory(account.accountId,[{instanceId:77,itemTableId:2011,ownedQuantity:0,battleQuantity:2,state:0,field8:0,float24Bits:0,float28Bits:0,float2cBits:0}]);}
    const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa8,72,true);view.setUint32(0xa4,base.fields.get(0),true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
  }
  store.close();store=undefined;
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  evidence.inventoryBefore=[];for(const page of pages){const s=page.sessionId;await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('[data-inventory-instance="77"]')?.matches(':enabled')`);assert((await evaluate(s,`document.querySelector('[data-inventory-instance="77"]').textContent`)).includes(lifecycleOnly&&s===host?'×0':'×2'));if(!lifecycleOnly){await nativeClick(s,'[data-inventory-instance="77"]');await nativeClick(s,'[data-kitbag-slot="1"]');await waitUntil(s,`document.querySelector('[data-kitbag-slot="1"]')?.dataset.instanceId==='77'`);}evidence.inventoryBefore.push(await evaluate(s,`({item:document.querySelector('[data-inventory-instance="77"]').textContent,slot:document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId})`));await nativeClick(s,'[data-home-close]');await waitUntil(s,`!document.querySelector('#home-inventory[open]')`);}
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')`);await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
  const joinPoint=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...joinPoint},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...joinPoint},guest);
  await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
  await waitUntil(host,`!document.querySelector('[data-room-create-dialog][open]')`);await waitUntil(host,`document.querySelector('[data-add-cpu]')&&!document.querySelector('[data-add-cpu]').disabled`);await nativeClick(host,'[data-add-cpu]');await new Promise(r=>setTimeout(r,500));if(await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===2`))await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===3`);
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===3})()`);
  for(const page of pages){
    await evaluate(page.sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world')),scene=engine.scenes[0];
      engine.setHardwareScalingLevel(4);engine.resize();window.muzzleScene=scene;window.muzzleCamera=scene.activeCamera;
      window.muzzle={effects:[],sounds:[],events:[],frames:0,frameTimes:[],canvas:{width:engine.getRenderWidth(),height:engine.getRenderHeight()}};
      const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');
      const add=EffectRuntime.prototype.addInstance;EffectRuntime.prototype.addInstance=function(...args){window.muzzleRuntime=this;return add.apply(this,args);};
      const {BattleSound}=await import('/src/audio/battle-sound.ts');const event=BattleSound.prototype.event;BattleSound.prototype.event=function(value,...args){window.muzzleSound=this;const result=event.call(this,value,...args);if(value.type==='fire')window.muzzle.events.push(value);return result;};
      const {Battle}=await import('/src/match/battle.ts');const reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.muzzleBattle=this;const result=reconcile.apply(this,args);if(this.roomFeed.snapshot){const players=this.roomFeed.snapshot.players;window.muzzle.snapshots??=[];const states=players.map(p=>({id:p.id,alive:p.alive,ammoItemId:p.ammoItemId,selectedAmmoSlot:p.selectedAmmoSlot}));const key=JSON.stringify(states);if(window.muzzle.snapshots.at(-1)?.key!==key)window.muzzle.snapshots.push({key,states,phase:window.muzzle.phase,round:this.roomFeed.snapshot.match.round});}return result;};
      scene.onAfterRenderObservable.add(()=>{window.muzzle.frames++;if(window.muzzle.frameTimes.length<3000)window.muzzle.frameTimes.push(engine.getDeltaTime());});
    })()`);
  }
  for(const page of pages){
    const s=page.sessionId;const point=await evaluate(s,`(()=>{const r=document.querySelector('#world').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    for(let i=0;i<3;i++){if(await evaluate(s,`window.muzzleCamera.radius>=4000`))break;await command('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaX:0,deltaY:1500},s);await new Promise(r=>setTimeout(r,100));}
  }
  for(const s of [guest,host]){await waitUntil(s,`document.querySelector('[data-autopilot]')&&!document.querySelector('[data-autopilot]').disabled`);await nativeClick(s,'[data-autopilot]');}
  for(const s of [guest,host]){await waitUntil(s,`document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await nativeClick(s,'[data-waiting-ready]');}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  console.log('Normal map0007 room with two accounts and CPU PLAYING');
  const key=async(s,key,code,windowsVirtualKeyCode)=>{await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode},s);};
  const world=s=>evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  const ids=await Promise.all(pages.map(async p=>(await world(p.sessionId)).playerId));evidence.initial=await Promise.all(pages.map(p=>world(p.sessionId)));
  const ownerId=ids[0],peerId=ids[1],owner=async()=>{const s=await world(host);return s.players.find(p=>p.id===ownerId);};
  const stock=(s,id)=>s.players.find(p=>p.id===id).ammoSlots.find(a=>a.slot===2).quantity;
  evidence.scope='Rebuilt AI special-ammo selection; same-account autonomous2011 consumption lifecycle, rendering reused. Ordinary Home/Kitbag/Autopilot/Ready, no player-selected ammo/movement/fire input injection.';
  evidence.reusedRendering=['browser-ammo11-consumption-2026-10-04T09-43-13-676Z.json','browser-ammo11-muzzle-diagnostic-2026-10-04T10-03-08-850Z.json'];
  for(const [index,page]of pages.entries())await waitUntil(page.sessionId,`window.muzzleBattle.roomFeed.snapshot.players.find(p=>p.id===window.muzzleBattle.playerId).ammoSlots.find(a=>a.slot===2).quantity===0`,30000);
  for(const page of pages)await waitUntil(page.sessionId,`document.querySelector('[data-ammo-slot="2"]').dataset.ammoQuantity==='0'`);
  const current=await Promise.all(pages.map(p=>world(p.sessionId)));evidence.depleted=current;for(const id of ids){const ownerEvents=network.filter(e=>e.page===host&&e.direction==='received'&&e.name==='RoomEvent'&&e.payload.playerId===id);assert.equal(ownerEvents.filter(e=>e.payload.type==='fire'&&e.payload.skillId===2011).length,2);assert.deepEqual(ownerEvents.filter(e=>e.payload.type==='ammoConsumed').map(e=>e.payload.value),[1,0]);}
  for(const id of ids)await waitUntil(host,`window.muzzle.events.some(e=>e.playerId===${JSON.stringify(id)}&&e.skillId===2001)`,20000);
  evidence.normalDefault=await Promise.all(pages.map(p=>world(p.sessionId)));
  for(const page of pages)await waitUntil(page.sessionId,`window.muzzleBattle.roomFeed.snapshot.phase==='FINISHED'`,45000);evidence.finished=await Promise.all(pages.map(p=>world(p.sessionId)));
  for(const s of [guest,host])await nativeClick(s,'[data-rematch]');for(const page of pages)await waitUntil(page.sessionId,`window.muzzleBattle.roomFeed.snapshot.phase==='PLAYING'&&window.muzzleBattle.roomFeed.snapshot.match.round===2`);evidence.rematch=await Promise.all(pages.map(p=>world(p.sessionId)));for(const s of evidence.rematch){assert.equal(stock(s,ownerId),0);assert.equal(stock(s,peerId),0);}await waitUntil(host,`document.querySelector('[data-ammo-slot="2"]').dataset.ammoQuantity==='0'`);await waitUntil(guest,`document.querySelector('[data-ammo-slot="2"]').dataset.ammoQuantity==='0'`);
  for(const page of pages)await waitUntil(page.sessionId,`window.muzzleBattle.roomFeed.snapshot.phase==='FINISHED'&&window.muzzleBattle.roomFeed.snapshot.match.round===2`,45000);evidence.round2Finished=await Promise.all(pages.map(p=>world(p.sessionId)));
  for(const page of pages)await nativeClick(page.sessionId,'[data-leave-room]');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({instances:window.muzzleRuntime.instances.length,voices:window.muzzleSound.voices.size,state:document.querySelector('[data-source-audio="battle-sound"]').dataset.state})`)));for(const c of evidence.cleanup)assert.deepEqual(c,{instances:0,voices:0,state:'stopped'});
  const tokens=await Promise.all(pages.map(p=>evaluate(p.sessionId,`localStorage.getItem('cdtank-account-token')`)));await stop(server);await startServer();evidence.actualRestart=[];
  for(const [i,page] of pages.entries()){const s=page.sessionId,origin=await evaluate(s,`performance.timeOrigin`);await command('Page.reload',{},s);await waitUntil(s,`performance.timeOrigin!==${origin}&&document.querySelector('[data-room-card-home]')&&localStorage.getItem('cdtank-account-token')`);assert.equal(await evaluate(s,`localStorage.getItem('cdtank-account-token')`),tokens[i]);await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('[data-inventory-instance="77"]')&&document.querySelector('[data-kitbag-slot="1"]')?.dataset.instanceId==='77'`);const item=await evaluate(s,`document.querySelector('[data-inventory-instance="77"]').textContent`);assert(item.includes('×0'));evidence.actualRestart.push({item,slot:await evaluate(s,`document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId`)});if(!businessOnly){const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-restart-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}await nativeClick(s,'[data-home-close]');}
  {const fire=network.filter(e=>e.page===host&&e.name==='RoomEvent'&&e.direction==='received'&&e.payload.type==='fire'&&e.payload.playerId===ownerId);assert.equal(fire.filter(e=>e.payload.skillId===2011).length,2);const ammo=network.filter(e=>e.page===host&&e.name==='RoomEvent'&&e.direction==='received'&&e.payload.type==='ammoConsumed'&&e.payload.playerId===ownerId);assert.deepEqual(ammo.map(e=>e.payload.value),[1,0]);}evidence.network=network;evidence.status='PASS';console.log('PASS: '+output+'.json');
}catch(error){if(ws&&!businessOnly)for(const[i,page]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.muzzle`).catch(e=>({error:String(e)}))));throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
