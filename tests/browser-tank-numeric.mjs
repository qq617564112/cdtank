import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {TANKS,PET_BASES} from '../apps/server/src/config.ts';
import {combatLimits} from '../apps/server/src/battle/catalog.ts';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3251',logger:undefined});
const network=[];
let serverLog='';
const steeringOnly=process.argv.includes('--steering-only');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-tank-'+(steeringOnly?'steering':'numeric')+'-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-tank-numeric-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3251,vite:5411,cdp:9611},runId,scope:'Two production browser pages; complete owned pet1/tank1 fixtures; native W/S A/D Arrow Space and ordinary ammunition hotkeys; no pose or combat injection'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3251',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'75'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5411,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3251',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9611',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9611/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9611');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['PetShop','Shop','OwnedRoles','RoleProfile','SelectRole','Account','CreateRoom','Cpu','Ready','Leave','RoomSnapshot','RoomEvent','PlayerInput'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5411',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  store=new AccountStore(database);const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(r=>r.tankId===1&&r.part===0);
  for(const [index,page]of pages.entries()){
    const account=store.open(await evaluate(page.sessionId,`localStorage.getItem('cdtank-account-token')`));
    const baseFields=new Map(Object.keys(native.base).map(k=>[Number(k),0])),equipmentFields=new Map(Object.keys(native.equipment).map(k=>[Number(k),0]));baseFields.set(0,73);baseFields.set(8,1);baseFields.set(0x2c,600);baseFields.set(0x34,5);baseFields.set(0x3c,10);equipmentFields.set(0x1c,74);equipmentFields.set(0x24,1);equipmentFields.set(0x3c,100);equipmentFields.set(0x40,70);equipmentFields.set(0x4c,15);equipmentFields.set(0x50,30);equipmentFields.set(0x58,2001);
    store.replaceRoleRecords(account.accountId,{base:[{name:'Explicit base pet1 fixture',fields:baseFields}],equipment:[{name:'Explicit base tank1 fixture',fields:equipmentFields}]});if(index===0)store.replaceInventory(account.accountId,[{instanceId:77,itemTableId:2007,ownedQuantity:1,battleQuantity:1,state:0,field8:0,float24Bits:0,float28Bits:0,float2cBits:0}]);
    const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa4,73,true);view.setUint32(0xa8,74,true);view.setUint32(0x70,index===0?5000:3000,true);view.setUint32(0x74,1000,true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
  }
  store.close();store=undefined;evidence.fixture={petId:1,tankId:1,petInstance:73,tankInstance:74};
  const host=pages[0].sessionId,peer=pages[1].sessionId;
  if(!steeringOnly){await nativeClick(host,'[data-room-card-home]');await waitUntil(host,`document.querySelector('[data-inventory-instance="77"]')?.matches(':enabled')`);await nativeClick(host,'[data-inventory-instance="77"]');await nativeClick(host,'[data-kitbag-slot="1"]');await waitUntil(host,`document.querySelector('[data-kitbag-slot="1"]')?.dataset.instanceId==='77'`);await nativeClick(host,'[data-home-close]');}
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')`);await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world&&!document.querySelector('[data-room-create-dialog][open]')`);const roomId=JSON.parse(await evaluate(host,`document.querySelector('#battle-status').dataset.world`)).roomId;await waitUntil(peer,`document.querySelector('[data-room-card-id="${roomId}"]')?.matches(':enabled')`);await command('Page.bringToFront',{},peer);const point=await evaluate(peer,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,button:'left',clickCount:2,...point},peer);await waitUntil(peer,`document.querySelector('#battle-status')?.dataset.world`);await waitUntil(peer,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.mapLoaded&&w.renderedPlayers===2})()`);await nativeClick(peer,'[data-waiting-ready]');await nativeClick(host,'[data-waiting-ready]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  const snapshots=()=>network.filter(e=>e.name==='RoomSnapshot'&&e.direction==='received');
  const latest=()=>snapshots().filter(e=>e.page===host).at(-1).payload;
  const ownerId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).playerId`);
  await command('Page.bringToFront',{},host);await evaluate(host,`document.activeElement?.blur()`);
  async function key(code,down){const map={KeyW:['w',87],KeyS:['s',83],KeyA:['a',65],KeyD:['d',68],ArrowLeft:['ArrowLeft',37],ArrowRight:['ArrowRight',39],Space:[' ',32],Digit1:['1',49],Digit2:['2',50]};const[key,v]=map[code];await command('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',key,code,windowsVirtualKeyCode:v},host);}
  if(steeringOnly)evidence.scope='New rebuilt stationary A/D mapping: actual production keyboard rotates movement-look and hull together; independent Arrow turret aim; dual-page PLAYING snapshots and normal Leave';
  const tank=TANKS.find(t=>t.id===1).recomputeBase,pet=PET_BASES.find(p=>p.id===1),clamp=(value,id)=>Math.max(combatLimits.get(id).lower,Math.min(combatLimits.get(id).upper,value)),mastery=Math.max(1,[pet.field7c,pet.field80,pet.field84,pet.field88][tank.tankType-1]-1),expectedRate=Math.fround((mastery+clamp(tank.field88,15)-3)*Math.fround(0.06981316953897476)+Math.fround(.1919862));evidence.expectedRate=expectedRate;
  evidence.controls=[];
  for(const[code,expected]of (steeringOnly?[]:[['KeyW',{move:1}],['KeyS',{move:-1}]]).concat([['KeyA',{turn:1}],['KeyD',{turn:-1}],['ArrowLeft',{aim:1}],['ArrowRight',{aim:-1}]])){
    const start=network.length;await key(code,true);await new Promise(r=>setTimeout(r,450));const releaseAt=network.length;await key(code,false);await new Promise(r=>setTimeout(r,150));
    const messages=network.slice(start).filter(e=>e.page===host&&e.name==='PlayerInput'&&e.direction==='sent').map(e=>e.payload);assert(messages.some(m=>Object.entries(expected).every(([k,v])=>m[k]===v)),code);
    const frames=network.slice(start,releaseAt).filter(e=>e.page===host&&e.name==='RoomSnapshot'&&e.direction==='received').map(e=>e.payload);const field=expected.turn?'bodyYaw':expected.aim?'aim':'x',changed=frames.slice(1).map((frame,index)=>({index:index+1,changed:Math.abs(frame.players.find(p=>p.id===ownerId)[field]-frames[index].players.find(p=>p.id===ownerId)[field])>1e-5})).filter(row=>row.changed),firstIndex=steeringOnly?changed[0].index-1:1,lastIndex=steeringOnly?changed.at(-1).index:frames.length-1,first=frames[firstIndex].players.find(p=>p.id===ownerId),last=frames[lastIndex].players.find(p=>p.id===ownerId);const distance=Math.hypot(last.x-first.x,last.z-first.z);if(expected.move)assert(distance>1,code);if(expected.turn)assert(Math.abs(last.yaw-first.yaw)>.1,code);if(expected.aim)assert(Math.abs(last.aim-first.aim)>.1,code);const seconds=(frames[lastIndex].tick-frames[firstIndex].tick)/20;if(steeringOnly){assert.equal(distance,0,code);if(expected.turn){assert(Math.abs((last.bodyYaw-first.bodyYaw)-(last.yaw-first.yaw))<.0002,code+' hull/look agreement');assert(Math.abs((last.bodyYaw-first.bodyYaw)/seconds-expected.turn*expectedRate)<.0005,code+' source hull rate');}if(expected.aim){assert.equal(last.bodyYaw,first.bodyYaw,code+' independent hull');assert.equal(last.yaw,first.yaw,code+' independent look');assert(Math.abs((last.aim-first.aim)/seconds-expected.aim*expectedRate)<.0005,code+' source aim rate');}}evidence.controls.push({code,expected,first,last,distance,seconds,messages,window:{firstTick:frames[firstIndex].tick,lastTick:frames[lastIndex].tick,allTicks:frames.map(f=>f.tick),neutralBoundaryTicks:frames.filter((f,i)=>i<firstIndex||i>lastIndex).map(f=>f.tick)}});if(steeringOnly&&code==='KeyA'){const shot=await command('Page.captureScreenshot',{format:'png'},host);await writeFile(output+'-body-after-A.png',Buffer.from(shot.data,'base64'));}
  }
  if(!steeringOnly){const start=network.length;await key('Space',true);await new Promise(r=>setTimeout(r,2100));await key('Space',false);await new Promise(r=>setTimeout(r,150));const fires=network.slice(start).filter(e=>e.page===host&&e.name==='RoomEvent'&&e.payload.type==='fire'&&e.payload.playerId===ownerId);assert(fires.length>=2);const before=latest().players.find(p=>p.id===ownerId);assert(before.ammoMagazine.remaining<before.ammoMagazine.capacity);await key('Digit2',true);await key('Digit2',false);let deadline=Date.now()+3000;while(latest().players.find(p=>p.id===ownerId).ammoItemId!==2007&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));assert.equal(latest().players.find(p=>p.id===ownerId).ammoItemId,2007);await key('Digit1',true);await key('Digit1',false);deadline=Date.now()+3000;while(latest().players.find(p=>p.id===ownerId).ammoItemId!==2001&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));const after=latest().players.find(p=>p.id===ownerId);assert.equal(after.ammoItemId,2001);assert.deepEqual(after.ammoMagazine,before.ammoMagazine);evidence.fireSwitch={fires,before,after};}
  const common=snapshots().filter(a=>a.page===host&&a.payload.phase==='PLAYING'&&snapshots().some(b=>b.page===peer&&b.payload.phase==='PLAYING'&&b.payload.roomId===a.payload.roomId&&b.payload.round===a.payload.round&&b.payload.tick===a.payload.tick));assert(common.length>(steeringOnly?20:50));for(const a of common){const b=snapshots().find(b=>b.page===peer&&b.payload.phase==='PLAYING'&&b.payload.roomId===a.payload.roomId&&b.payload.round===a.payload.round&&b.payload.tick===a.payload.tick);assert.deepEqual(a.payload.players,b.payload.players);}evidence.sharedTicks=common.length;
  const shot=await command('Page.captureScreenshot',{format:'png'},host);await writeFile(output+'-battle.png',Buffer.from(shot.data,'base64'));
  for(const session of [peer,host]){const waiting=await evaluate(session,`Boolean(document.querySelector('[data-waiting-close]'))`);if(waiting)await nativeClick(session,'[data-waiting-close]');else{await nativeClick(session,'[data-battle-play-summary]');await nativeClick(session,'[data-leave-room]');}await waitUntil(session,`!document.querySelector('#battle-status').dataset.world`);}evidence.leave=true;evidence.status='PASS';console.log('PASS: '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)for(const[i,p]of pages.entries()){const result=await command('Page.captureScreenshot',{format:'png'},p.sessionId).catch(()=>null);if(result)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(result.data,'base64'));}throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
