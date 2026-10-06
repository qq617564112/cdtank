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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3389',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-network-latency-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-network-latency-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store,delayProxy;
const proxySockets=new Set(),delayTimers=new Set();
const transport=[];
function forward(from,to,direction){from.on('message',bytes=>{const queuedAt=performance.now();const timer=setTimeout(()=>{delayTimers.delete(timer);if(to.readyState===WebSocket.OPEN){to.send(bytes,{binary:typeof bytes!=='string'});transport.push({direction,delayMs:performance.now()-queuedAt,bytes:bytes.length});}},100);delayTimers.add(timer);});}
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3389,vite:5449,cdp:9649},mapId:7,proxy:3390,
  runId,scope:'Two formal React pages through ordered100ms each-direction transport delay; normal movement/turn/aim and rendered convergence. Explicit pre-room native owned fixture.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3389',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'60'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  delayProxy=new WebSocket.Server({port:3390,host:'127.0.0.1'});
  delayProxy.on('connection',down=>{const up=new WebSocket('ws://127.0.0.1:3389');proxySockets.add(down);proxySockets.add(up);down._socket.pause();up.once('open',()=>{forward(down,up,'input');forward(up,down,'snapshot');down._socket.resume();});down.on('close',()=>up.close());up.on('close',()=>down.close());});
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5449,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3390',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9649',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9649/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9649');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5449',browserContextId});
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
    assert.equal(store.inventory(account.accountId).records.length,0);
    const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa8,72,true);view.setUint32(0xa4,base.fields.get(0),true);view.setUint32(0x70,index===0?100:0,true);view.setUint32(0x74,0,true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
  }
  store.close();store=undefined;
  const host=pages[0].sessionId,guest=pages[1].sessionId;

  evidence.fixture={source:'world-role-attributes-native.json tank1/part0',inventory:'empty',roles:'Explicit pre-room native tank1/pet1 ownership; no BUY claim'};
  evidence.scope='Two formal React accounts; all actual WebSocket frames delayed100ms each direction in order. Native W/D/ArrowLeft and release; authoritative dual snapshots, actual TankView convergence, normal Leave.1280x720 viewport/hardwareScaling4 rendering; no active state/event/HP/position injection.';
  for(const page of pages)await evaluate(page.sessionId,`(async()=>{const {Battle}=await import('/src/match/battle.ts');const render=Battle.prototype.render;window.latencyFrames=[];Battle.prototype.render=function(...args){window.latencyBattle=this;if(this.scene.getEngine().getHardwareScalingLevel()!==4)this.scene.getEngine().setHardwareScalingLevel(4);const value=render.apply(this,args);const snapshot=this.roomFeed.snapshot;if(snapshot&&window.latencyFrames.length<600){window.latencyFrames.push({at:performance.now(),tick:snapshot.tick,players:snapshot.players.map(p=>{const v=this.players.get(p.id);return{id:p.id,x:p.x,y:p.y,z:p.z,yaw:p.yaw,bodyYaw:p.bodyYaw,aim:p.aim,alive:p.alive,view:v?{x:-v.root.position.x,y:v.root.position.y,z:v.root.position.z,bodyYaw:-v.root.rotation.y,turretYaw:v.turretYaw,action:v.activeAction}:null};})});}return value;};})()`);
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')`);
  await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');
  await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world&&!document.querySelector('[data-room-create-dialog][open]')`);
  const world=s=>evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  const roomId=(await world(host)).roomId;
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')?.matches(':enabled')`);
  const point=await evaluate(guest,`(()=>{const e=document.querySelector('[data-room-card-id="${roomId}"]');e.scrollIntoView();const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  for(const type of ['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,button:'left',clickCount:2,...point},guest);
  for(const s of [guest,host]){
    await waitUntil(s,`document.querySelector('[data-waiting-ready]')?.matches(':enabled')`);
    await nativeClick(s,'[data-waiting-ready]');
  }
  for(const s of [host,guest])await waitUntil(s,`JSON.parse(document.querySelector('#battle-status').dataset.world||'null')?.phase==='PLAYING'`);
  const ownerId=(await world(host)).playerId;

  const initial=(await world(host)).players.find(p=>p.id===ownerId);evidence.initial=initial;
  await nativeClick(host,'#world');
  async function held(key,code,num,ms){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:num},host);await new Promise(resolve=>setTimeout(resolve,ms));await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:num},host);}
  await held('w','KeyW',87,1500);
  await held('d','KeyD',68,1200);
  await held('ArrowLeft','ArrowLeft',37,1200);
  // Observe at least ten new server ticks after key release before testing convergence.
  const releasedTick=(await world(host)).tick;
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).tick>=${releasedTick+12}`);
  evidence.frames=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.latencyFrames')));
  const convergence=`(()=>{const b=window.latencyBattle,s=b.roomFeed.snapshot,p=s.players.find(p=>p.id===${JSON.stringify(ownerId)}),v=b.players.get(p.id),angle=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));return{tick:s.tick,player:p,view:{x:-v.root.position.x,y:v.root.position.y,z:v.root.position.z,bodyYaw:-v.root.rotation.y,turretYaw:v.turretYaw,action:v.activeAction},positionError:Math.hypot(v.root.position.x+p.x,v.root.position.y-p.y,v.root.position.z-p.z),bodyError:angle(-v.root.rotation.y,p.bodyYaw??p.yaw),turretError:angle(v.turretYaw,p.yaw+p.aim)}})()`;
  for(const page of pages)await waitUntil(page.sessionId,`(${convergence}).positionError<.01&&(${convergence}).bodyError<.001&&(${convergence}).turretError<.001`);
  evidence.convergence=await Promise.all(pages.map(p=>evaluate(p.sessionId,convergence)));
  const moved=Math.hypot(evidence.convergence[0].player.x-initial.x,evidence.convergence[0].player.z-initial.z);
  evidence.distance=moved;assert(moved>50,'Normal delayed forward input must move');
  const angle=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
  assert(angle(evidence.convergence[0].player.bodyYaw,initial.bodyYaw)>.1,'Normal body turn reached authority');
  assert(angle(evidence.convergence[0].player.aim,initial.aim)>.1,'Normal turret input reached authority');
  const snapshots=pages.map(p=>network.filter(e=>e.page===p.sessionId&&e.direction==='received'&&e.name==='RoomSnapshot'&&e.payload.phase==='PLAYING').map(e=>e.payload));
  const pose=p=>[p.x,p.y,p.z,p.yaw,p.bodyYaw,p.aim];
  evidence.stationaryTail=snapshots.map(rows=>{const unique=[...new Map(rows.map(s=>[s.tick,s])).values()];const tail=unique.slice(-8).map(s=>({tick:s.tick,pose:pose(s.players.find(p=>p.id===ownerId))}));assert.equal(tail.length,8);for(const sample of tail)assert.deepEqual(sample.pose,tail[0].pose);return tail;});
  const second=new Map(snapshots[1].map(s=>[s.tick,s]));let sharedTicks=0;
  for(const snapshot of snapshots[0]){const peer=second.get(snapshot.tick);if(peer){assert.deepEqual(snapshot.players,peer.players);sharedTicks++;}}assert(sharedTicks>30);evidence.sharedTicks=sharedTicks;
  evidence.inputs=network.filter(e=>e.name==='PlayerInput'&&e.direction==='sent').map(e=>({page:e.page,...e.payload}));
  assert(evidence.inputs.some(i=>i.move===1));assert(evidence.inputs.some(i=>i.turn!==0));assert(evidence.inputs.some(i=>i.aim!==0));
  for(const session of [guest,host]){await nativeClick(session,await evaluate(session,`document.querySelector('[data-leave-room]')?'[data-leave-room]':document.querySelector('[data-waiting-close]')?'[data-waiting-close]':'[data-summary-leave]'`));await waitUntil(session,`!document.querySelector('#battle-status').dataset.world`);}
  evidence.left=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({world:document.querySelector('#battle-status').dataset.world,views:window.latencyBattle.players.size})`)));assert(evidence.left.every(p=>!p.world&&p.views===0));
  evidence.transport={input:transport.filter(x=>x.direction==='input'),snapshot:transport.filter(x=>x.direction==='snapshot')};
  assert(evidence.transport.input.length>20&&evidence.transport.snapshot.length>20);assert(transport.every(x=>x.delayMs>=90));
  evidence.status='PASS_FIXED_LATENCY_SCOPE';console.log(evidence.status+' '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)for(const[i,p]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},p.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+i+'.png',Buffer.from(shot.data,'base64'));}throw error;}
finally{evidence.network=network.filter(e=>!['Account','Inventory','Kitbag'].includes(e.name));await writeFile(output+'.json',JSON.stringify(evidence,null,2));await writeFile(output+'.log',serverLog);store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}for(const timer of delayTimers)clearTimeout(timer);for(const socket of proxySockets)socket.terminate();await new Promise(resolve=>delayProxy?delayProxy.close(resolve):resolve());await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
