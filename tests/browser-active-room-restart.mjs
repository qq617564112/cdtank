import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3434',logger:undefined});
const network=[],httpResponses=[],upgrades=[];
const output='recovery/output/browser-active-room-restart-'+new Date().toISOString().replace(/[:.]/g,'-');
const directory=await mkdtemp(join(tmpdir(),'cdtank-active-restart-'));
const release=resolve('dist/release'),nginxRoot=resolve('recovery/output/nginx-runtime');
const leaveOnly=process.argv.includes('--leave-only');
const evidence={status:'RUNNING',scope:'M7-07 genuine purchased part/equipment persistence and interrupted active room cold restart from compiled release; ordinary browser Create/Join/Ready/rejoin/Leave, no active injection or fresh FX acceptance.',checkpoint:'home-tank-active-marker-browser.sqlite copied readonly; no funds/stock/roles imported',ports:{server:3434,http:8434,cdp:9661}};
const fixture=JSON.parse(await readFile('recovery/output/home-tank-active-marker-browser-fixture.json','utf8'));
const observer=new WsClient(serviceProto,{server:'ws://127.0.0.1:3434',logger:undefined});
let server,nginx,chrome,ws,serverLog='',nginxLog='';
const pages=[],contexts=[];
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
  await command('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',buttons:1,clickCount:1,...point}, session);
  await command('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',buttons:0,clickCount:1,...point}, session);
}

async function startServer(){
  serverLog='';
  const env={...process.env,PORT:'3434',ACCOUNT_DB_PATH:join(directory,'accounts.sqlite')};
  for(const key of ['NODE_PATH','NODE_OPTIONS','CONTENT_TABLES','WEB_ASSETS','SCENE_PLACEMENTS','BATTLEFIELDS','MATCH_MIN_PLAYERS','MATCH_TIME_LIMIT_SECONDS'])delete env[key];
  server=spawn(process.execPath,[join(release,'start.mjs')],{cwd:directory,env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>serverLog+=String(d));
  const deadline=Date.now()+15000;while(!serverLog.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(serverLog.includes('Server started'),serverLog);
}

try {
  const copied=spawnSync(process.execPath,['scripts/account-snapshot.mjs','backup','recovery/output/home-tank-active-marker-browser.sqlite',join(directory,'accounts.sqlite')],{encoding:'utf8'});assert.equal(copied.status,0,copied.stderr);
  await startServer();
  const site=(await readFile('deployment/nginx.conf.example','utf8')).replace('listen 8080;','listen 8434;').replace('/srv/cdtank/web',join(release,'web')).replace('127.0.0.1:3001','127.0.0.1:3434');
  const config=`daemon off;\npid ${join(directory,'nginx.pid')};\nerror_log stderr;\nevents {worker_connections 128;}\nhttp {client_body_temp_path ${join(directory,'body')}; proxy_temp_path ${join(directory,'proxy')}; fastcgi_temp_path ${join(directory,'fastcgi')}; uwsgi_temp_path ${join(directory,'uwsgi')}; scgi_temp_path ${join(directory,'scgi')}; include ${join(nginxRoot,'etc/nginx/mime.types')}; access_log ${join(directory,'access.log')}; ${site}}\n`;
  await writeFile(join(directory,'nginx.conf'),config);
  nginx=spawn(join(nginxRoot,'usr/sbin/nginx'),['-p',directory+'/', '-c',join(directory,'nginx.conf')],{stdio:['ignore','pipe','pipe']});
  for(const stream of [nginx.stdout,nginx.stderr])stream.on('data',d=>nginxLog+=String(d));
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:8434/')).status===200)break;}catch{}await new Promise(r=>setTimeout(r,50));}
  const response=await fetch('http://127.0.0.1:8434/');assert.equal(response.status,200);assert(response.headers.get('content-type').includes('text/html'));
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9661',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9661/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint);ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(r.service.name==='Account'&&r.ret?.isSucc)network.push({index:network.length,page:m.sessionId,direction:'received',name:'AccountIdentity',accountId:r.ret.res.accountId});if(['ListMaps','LobbyPlayers','LobbyChat','LobbyWhisper','FriendChat','Friends','CreateRoom','Join','Ready','Shop','TankShop','SelectRole','Leave','RoomChat','Equipment','Inventory','OwnedRoles','History','Ready','RoomSnapshot'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});
  ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.method==='Network.responseReceived'&&m.params.response.url.startsWith('http://127.0.0.1:8434/')){const r=m.params.response;httpResponses.push({url:r.url,status:r.status,mimeType:r.mimeType});}if(m.method==='Network.webSocketHandshakeResponseReceived')upgrades.push({page:m.sessionId,status:m.params.response.status});});
  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Network.enable',{},sessionId);await command('Page.enable',{},sessionId);
    if(index===0)await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+')'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await command('Page.navigate',{url:'http://127.0.0.1:8434/'},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-home]')?.matches(':enabled')&&document.querySelector('[data-lobby-channel-toggle]')?.matches(':enabled')`);
  }
  const [s,b]=pages.map(p=>p.sessionId);
  const identities=network.filter(n=>n.name==='AccountIdentity');assert.equal(identities.length,2);assert.notEqual(identities[0].accountId,identities[1].accountId);
  assert.equal(upgrades.filter(u=>u.status===101).length,2);
  assert(httpResponses.some(r=>r.url.endsWith('.js')&&r.mimeType.includes('javascript')));
  assert(httpResponses.some(r=>r.url.endsWith('ui.json')&&r.status===200));
  assert((await evaluate(s,`localStorage.getItem('cdtank-account-token')`))===fixture.token,'Checkpoint identity mismatch');
  evidence.checkpointIdentityMatched=true;
  if(!leaveOnly){
  await nativeClick(s,'[data-room-card-shop]');await waitUntil(s,`document.querySelector('#account-shop')?.open&&document.querySelector('#account-shop').getAttribute('aria-busy')==='false'`);
  await nativeClick(s,'[data-shop-root-category="Part"]');await waitUntil(s,`document.querySelector('[data-part-product-id="17031"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-part-product-id="17031"]');
  await nativeClick(s,'[data-part-buy]');await waitUntil(s,`document.querySelector('[data-part-status]').textContent.includes('已购买黄金之光')&&document.querySelector('[data-part-owned-instance]')`);
  const instanceId=Number(await evaluate(s,`document.querySelector('[data-part-owned-instance]').dataset.partOwnedInstance`));assert(instanceId>0);
  await nativeClick(s,'[data-part-equipment]');await waitUntil(s,`document.querySelector('#home-equipment[open] [data-equipment-item="${instanceId}"]')?.matches(':enabled')`);
  await nativeClick(s,`[data-equipment-item="${instanceId}"]`);await nativeClick(s,'[data-equipment-slot="0"]');
  await waitUntil(s,`document.querySelector('[data-equipment-slot="0"]').dataset.instanceId==='${instanceId}'&&!document.querySelector('#home-equipment').matches('[aria-busy="true"]')`);
  evidence.purchaseEquipment={itemTableId:17031,slot:0,instanceId};
  await nativeClick(s,'[data-equipment-close]');await waitUntil(s,`!document.querySelector('#home-equipment[open]')`);
  async function queryDurable(){
    const result={};for(const name of ['Inventory','Equipment','OwnedRoles','History']){const res=await observer.callApi(name,name==='Equipment'?{operation:'QUERY'}:{});assert(res.isSucc,name+' query');result[name]=res.res;}return result;
  }
  assert((await observer.connect()).isSucc);assert((await observer.callApi('Account',{token:fixture.token})).isSucc);
  const expected=await queryDurable();assert.equal(expected.Equipment.slots[0],instanceId);
  }
  await nativeClick(s,'[data-room-card-create]');await waitUntil(s,`document.querySelector('[data-map-selector-map="7"]')`);
  await nativeClick(s,'[data-map-selector-map="7"]');await nativeClick(s,'[data-map-selector-confirm]');
  await waitUntil(s,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);await nativeClick(s,'[data-room-create-confirm]');
  await waitUntil(s,`document.querySelector('[data-formal-waiting-page]')&&document.querySelector('.source-waiting-chat')&&!document.querySelector('[data-room-create-dialog]')?.open`);
  const room=await evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);evidence.room=room;
  await waitUntil(b,`document.querySelector('[data-room-card-id="${room}"]')`);await nativeClick(b,`[data-room-card-id="${room}"]`);await nativeClick(b,'[data-room-card-express]');
  await waitUntil(b,`document.querySelector('[data-formal-waiting-page]')&&document.querySelector('.source-waiting-chat')`);
  async function readyBoth(){for(const p of [s,b])await waitUntil(p,`document.querySelector('[data-waiting-ready]')?.matches(':enabled')`,90000);for(const p of [s,b])await nativeClick(p,'[data-waiting-ready]');for(const p of [s,b])await waitUntil(p,`document.querySelector('[data-formal-battle-page]')&&JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`,90000);}
  await readyBoth();
  if(!leaveOnly){
  const before=await evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  assert(!before.match.result);const hostId=before.playerId;
  assert(before.players.find(p=>p.id===hostId).queuedPartSkillIds.includes(13501));
  evidence.beforeInterrupted={roomId:room,phase:before.phase,round:before.match.round,queuedPartSkillIds:before.players.find(p=>p.id===hostId).queuedPartSkillIds};
  await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},s).then(r=>writeFile(output+'-before-playing.png',Buffer.from(r.data,'base64')));
  // Stop the real compiled server with both browser members still connected.
  const interruptedAt=network.length;await stop(server);await observer.disconnect();
  for(const p of [s,b])await waitUntil(p,`!document.querySelector('[data-formal-battle-page]')&&!document.querySelector('.source-battle-chat')&&!document.querySelector('#battle-status').dataset.world`);
  evidence.disconnectCleanup=[];
  for(const p of [s,b])evidence.disconnectCleanup.push(await evaluate(p,`({noWorld:!document.querySelector('#battle-status').dataset.world,noRoomChat:!document.querySelector('.source-battle-chat'),noPlayPage:!document.querySelector('[data-formal-battle-page]'),status:document.querySelector('#battle-status').value})`));
  await startServer();
  for(const p of [s,b]){await command('Page.reload',{},p);await waitUntil(p,`document.querySelector('[data-room-card-home]')?.matches(':enabled')`);}
  for(const identity of identities){const resumed=network.slice(interruptedAt).filter(n=>n.name==='AccountIdentity'&&n.page===identity.page);assert(resumed.some(n=>n.accountId===identity.accountId));}
  for(const p of [s,b])assert(!(await evaluate(p,`!!document.querySelector('[data-room-card-id="${room}"]')`)));
  assert((await observer.connect()).isSucc);assert((await observer.callApi('Account',{token:fixture.token})).isSucc);
  const restored=await queryDurable();assert.deepEqual(restored,expected);
  evidence.durableRestored={allQueriedFieldsEqual:true,inventory:restored.Inventory,equipment:restored.Equipment,ownedRoles:restored.OwnedRoles,history:restored.History};
  evidence.roomRecovery={temporaryOriginalAbsent:true,incompleteRoundNotAddedToHistory:true,identityBothPreserved:true};
  await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},s).then(r=>writeFile(output+'-restored-lobby.png',Buffer.from(r.data,'base64')));
  await nativeClick(s,'[data-room-card-create]');await waitUntil(s,`document.querySelector('[data-map-selector-map="7"]')`);await nativeClick(s,'[data-map-selector-map="7"]');await nativeClick(s,'[data-map-selector-confirm]');await waitUntil(s,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);await nativeClick(s,'[data-room-create-confirm]');await waitUntil(s,`document.querySelector('[data-formal-waiting-page]')&&!document.querySelector('[data-room-create-dialog]')?.open`);
  const newRoom=await evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await waitUntil(b,`document.querySelector('[data-room-card-id="${newRoom}"]')`);await nativeClick(b,`[data-room-card-id="${newRoom}"]`);await nativeClick(b,'[data-room-card-express]');await waitUntil(b,`document.querySelector('[data-formal-waiting-page]')`);
  await readyBoth();const rebound=await evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  assert(rebound.players.find(p=>p.id===rebound.playerId).queuedPartSkillIds.includes(13501));
  evidence.newRoomConfirmed={roomId:newRoom,round:rebound.match.round,queuedPartSkillIds:rebound.players.find(p=>p.id===rebound.playerId).queuedPartSkillIds};
  }
  for(const p of [b,s]){await waitUntil(p,`document.querySelector('[data-leave-room], [data-summary-leave]')?.matches(':enabled')`);const exit=await evaluate(p,`document.querySelector('[data-leave-room]')?'[data-leave-room]':'[data-summary-leave]'`);await nativeClick(p,exit);await waitUntil(p,`!document.querySelector('[data-formal-battle-page]')&&document.activeElement.matches('[data-room-card-create]')&&document.activeElement.matches(':enabled')`);}
  evidence.normalLeaveBoth=true;if(leaveOnly)evidence.scope='Ordinary room context only to complete normal Leave from PLAYING then FINISHED; no repeat purchase/equipment/restart/images';evidence.status=leaveOnly?'PASS_ACTIVE_RESTART_LEAVE_SUPPLEMENT':'PASS_EQUIPPED_PART_ACTIVE_RESTART_SCOPE';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
  evidence.network=network;evidence.http=httpResponses;evidence.upgrades=upgrades;
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await observer.disconnect();await stop(chrome);await stop(nginx);await stop(server);
  await writeFile(output+'-nginx.log',nginxLog);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.cleaned=true;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
}
