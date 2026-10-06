import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3492',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-room-intimate-scroll-source-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-room-intimate-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[],clients=[];

const evidence={status:'RUNNING',ports:{server:3492,vite:5522,cdp:9722},runId,scope:'UI05/UI18 room long roster source scrollbar: twelve ordinary authenticated Accounts, only two renderer pages; WAITING/PLAYING three complete resolutions, native scroll/capture/HomeEnd/choose preserving draft; no BUY/send.'};
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
  const point = await evaluate(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});const clip=e.closest('.room-intimate-scrollbar');if(!clip)e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),c=clip?.getBoundingClientRect(),left=c?Math.max(r.left,c.left):r.left,right=c?Math.min(r.right,c.right):r.right,top=c?Math.max(r.top,c.top):r.top,bottom=c?Math.min(r.bottom,c.bottom):r.bottom,x=(left+right)/2,y=(top+bottom)/2;if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Control covered '+e.outerHTML+' by '+document.elementFromPoint(x,y)?.outerHTML);return {x,y}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},session);
  await command('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',buttons:1,clickCount:1,...point}, session);
  await command('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',buttons:0,clickCount:1,...point}, session);
}
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3492',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'300'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'readonly-resource-ready',transform(source,id){if(id.endsWith('/src/match/battle.ts'))return source+'\nconst modeOldQuick=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.modeReadinessBattle=this;return modeOldQuick.call(this,value);};';}}],server:{port:5522,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3492',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9722',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9722/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9722');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['RoomSnapshot','Cpu','CreateRoom','Join','Leave','ExitRoom','Ready','AddCpu','RoomChat','RoomWhisper','FriendChat','PlayerInput','Shop','TankShop','SelectRole'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});




  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5522'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')?.matches(':enabled')`);
  }
  const s=pages[0].sessionId,b=pages[1].sessionId;
  await nativeClick(s,'[data-room-card-create]');await waitUntil(s,`document.querySelector('[data-map-selector-mode="5"]')`);
  await nativeClick(s,'[data-map-selector-mode="5"]');await nativeClick(s,'[data-map-selector-map="20"]');await nativeClick(s,'[data-map-selector-confirm]');
  await waitUntil(s,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);
  evidence.legalBounds=await evaluate(s,`({min:Number(document.querySelector('[data-source-control="txtLowBound"]').textContent),max:Number(document.querySelector('[data-source-control="txtHighBound"]').textContent)})`);assert.equal(evidence.legalBounds.max,12);
  await nativeClick(s,'[data-room-create-confirm]');await waitUntil(s,`document.querySelector('[data-formal-waiting-page]')`);
  const world=p=>evaluate(p,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  const roomId=(await world(s)).roomId;await waitUntil(b,`document.querySelector('[data-room-card-id="${roomId}"]')?.matches(':enabled')`);
  await nativeClick(b,`[data-room-card-id="${roomId}"]`);await nativeClick(b,'[data-room-card-express]');await waitUntil(b,`document.querySelector('[data-formal-waiting-page]')`);
  await Promise.all([s,b].map(p=>waitUntil(p,`window.modeReadinessBattle?.mapLoaded&&window.modeReadinessBattle?.players.resourcesReady&&!window.modeReadinessBattle.players.loadingError&&document.querySelector('[data-waiting-chat-toggle]')?.matches(':enabled')`,90000)));
  evidence.accounts=[];
  for(let index=0;index<10;index++){
    const client=new WsClient(serviceProto,{server:'ws://127.0.0.1:3492',logger:undefined,heartbeat:{interval:5000,timeout:10000}});clients.push(client);assert((await client.connect()).isSucc);
    const account=await client.callApi('Account',{});assert(account.isSucc);
    const joined=await client.callApi('Join',{roomId,name:`房内名单${String(index+1).padStart(2,'0')}`,tankId:1,clientId:''});assert(joined.isSucc);
    evidence.accounts.push({accountId:account.res.accountId,playerId:joined.res.playerId,name:joined.res.room.players.find(p=>p.id===joined.res.playerId).name});
  }
  await waitUntil(s,`window.modeReadinessBattle.chat.getSnapshot().players.length===12`);
  const last=evidence.accounts.at(-1);evidence.context={roomId,normalAccounts:12,rendererPages:2,lastTarget:last};
  async function key(key,code,vk,text){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,...(text?{text}:{})},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk},s);}
  evidence.phases=[];evidence.screenshots=[];
  for(const phase of ['WAITING','PLAYING']){
    const waiting=phase==='WAITING',container=waiting?'.source-waiting-chat':'.source-battle-chat',toggle=container+' [data-room-intimate-toggle]',menu='[data-room-intimate-menu]',input=container+' [data-chat-input]',target=container+' [data-chat-whisper-target]';
    if(waiting){evidence.chatEntranceBefore=await evaluate(s,`({toggle:!!document.querySelector('[data-waiting-chat-toggle]'),input:!!document.querySelector('.source-waiting-chat [data-chat-input]'),status:window.modeReadinessBattle.chat.getSnapshot().status,mapLoaded:window.modeReadinessBattle.mapLoaded,resourcesReady:window.modeReadinessBattle.players.resourcesReady})`);const entranceShot=await command('Page.captureScreenshot',{format:'png'},s);evidence.entranceFrame=output+'-waiting-entrance.png';await writeFile(evidence.entranceFrame,Buffer.from(entranceShot.data,'base64'));await waitUntil(s,`document.querySelector('[data-waiting-chat-toggle]')?.matches(':enabled')&&document.querySelector('.source-waiting-chat [data-chat-input]')`,90000);evidence.chatEntranceReady=await evaluate(s,`({toggle:!!document.querySelector('[data-waiting-chat-toggle]'),input:!!document.querySelector('.source-waiting-chat [data-chat-input]'),status:window.modeReadinessBattle.chat.getSnapshot().status})`);await nativeClick(s,'[data-waiting-chat-toggle]');await waitUntil(s,`document.querySelector('[data-waiting-chat-channel="2"]')`);await nativeClick(s,'[data-waiting-chat-channel="2"]');}
    await nativeClick(s,input);await command('Input.insertText',{text:waiting?'长名单中文草稿':'战斗名单中文草稿'},s);await key('ArrowLeft','ArrowLeft',37);
    const before=await evaluate(s,`({draft:document.querySelector('${input}').value,caret:document.querySelector('${input}').selectionStart})`);
    await nativeClick(s,toggle);await waitUntil(s,`document.querySelector('${menu}')&&document.querySelector('[data-room-intimate-scrollbar]')&&!document.querySelector('[data-room-intimate-scrollbar]').hidden`);
    const entry={phase,resolutions:[],before};evidence.phases.push(entry);
    const read=()=>evaluate(s,`(()=>{const root=document.querySelector('${menu}'),list=root.querySelector('[data-room-intimate-list]'),bar=root.querySelector('[data-room-intimate-scrollbar]'),thumb=root.querySelector('[data-room-intimate-scroll-thumb]'),r=root.getBoundingClientRect();return {menu:{x:r.x,y:r.y,width:r.width,height:r.height,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight},count:list.querySelectorAll('[data-room-intimate-player]').length,listScale:list.getBoundingClientRect().height/list.clientHeight,metricScale:Number(bar.dataset.scrollScale),thumbPhysicalHeight:thumb.getBoundingClientRect().height,trackPhysicalHeight:root.querySelector('[data-room-intimate-scroll-track]').getBoundingClientRect().height,scroll:list.scrollTop,extent:list.scrollHeight-list.clientHeight,barVisible:!bar.hidden,capture:thumb.hasPointerCapture(1),thumbState:thumb.dataset.thumbState,rows:[...list.querySelectorAll('[data-room-intimate-player]')].map(e=>({id:e.dataset.roomIntimatePlayer,name:e.textContent})),confirmed:window.modeReadinessBattle.chat.getSnapshot().players}})()`);
    for(const [width,height]of [[800,600],[1920,1080],[3840,2160]]){
      const trace={width,height,before:await read()};(entry.resizeTrace??=[]).push(trace);
      await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
      await waitUntil(s,`Math.abs(document.querySelector('${menu}').getBoundingClientRect().width-118*Math.min(${width}/800,${height}/600))<.2`);
      await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
      const state=await read();trace.afterReact=state;assert(state.menu.inside&&state.barVisible&&state.extent>0);assert(Math.abs(state.metricScale-state.listScale)<.01);assert(state.thumbPhysicalHeight+.2>=Math.min(53,state.trackPhysicalHeight));assert.equal(state.count,12);for(const row of state.rows)assert(state.confirmed.some(p=>p.id===row.id&&p.name===row.name));entry.resolutions.push({width,height,...state});
      const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+phase.toLowerCase()+'-'+width+'.png';await writeFile(path,Buffer.from(shot.data,'base64'));evidence.screenshots.push(path);
    }
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('${menu}').getBoundingClientRect().width-212.4)<.2`);await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    await nativeClick(s,'[data-room-intimate-scroll-thumb]');await key('Home','Home',36);entry.arrowStart=await read();assert.equal(entry.arrowStart.scroll,0);
    await nativeClick(s,'[data-room-intimate-scroll-arrow="down"]');entry.arrow=await read();assert(entry.arrow.scroll>0);
    const point=await evaluate(s,`(()=>{const r=document.querySelector('[data-room-intimate-list]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await command('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaX:0,deltaY:40},s);await waitUntil(s,`document.querySelector('[data-room-intimate-list]').scrollTop>${entry.arrow.scroll}`);entry.wheel=await read();
    await nativeClick(s,'[data-room-intimate-scroll-thumb]');await key('Home','Home',36);entry.home=await read();assert.equal(entry.home.scroll,0);
    const thumb=await evaluate(s,`(()=>{const r=document.querySelector('[data-room-intimate-scroll-thumb]').getBoundingClientRect();return {x:r.x+3,y:r.y+r.height/2}})()`);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...thumb},s);entry.held=await read();assert(entry.held.capture);
    const outside={x:thumb.x+200,y:thumb.y+300};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,...outside},s);entry.outside=await read();assert(entry.outside.capture);
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...outside},s);entry.release=await read();assert(!entry.release.capture);assert.equal(entry.release.thumbState,'Normal');
    await key('End','End',35);entry.end=await read();assert(Math.abs(entry.end.scroll-entry.end.extent)<1);
    await nativeClick(s,`[data-room-intimate-player="${last.playerId}"]`);await waitUntil(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${input}')`);
    entry.chosen=await evaluate(s,`({target:document.querySelector('${target}').value,draft:document.querySelector('${input}').value,caret:document.querySelector('${input}').selectionStart,inputFocus:document.activeElement.matches('${input}')})`);
    assert.equal(entry.chosen.target,last.name);assert.equal(entry.chosen.draft,before.draft);assert.equal(entry.chosen.caret,before.caret);
    if(waiting){for(const client of clients)assert((await client.callApi('Ready',{round:1})).isSucc);for(const p of [s,b])await waitUntil(p,`window.modeReadinessBattle?.mapLoaded&&window.modeReadinessBattle?.players.resourcesReady&&!window.modeReadinessBattle.players.loadingError&&document.querySelector('[data-waiting-ready]')?.matches(':enabled')`,90000);for(const p of [s,b])await nativeClick(p,'[data-waiting-ready]');for(const p of [s,b])await waitUntil(p,`document.querySelector('[data-formal-battle-page]')`,90000);}
  }
  evidence.cleanup=[];
  for(const p of [s,b]){await nativeClick(p,'[data-leave-room]');await waitUntil(p,`document.activeElement.matches('[data-room-card-create]')&&document.activeElement.matches(':enabled')`);const cleared=await evaluate(p,`window.modeReadinessBattle.chat.getSnapshot().players.length===0`);assert(cleared);evidence.cleanup.push({strictCreate:true,rosterCleared:cleared});}
  for(const client of clients)assert((await client.callApi('Leave',{roomId,round:1})).isSucc);
  assert(!network.some(n=>n.direction==='sent'&&['RoomChat','RoomWhisper','FriendChat','Shop','TankShop','SelectRole'].includes(n.name)));evidence.noSendBuy=true;evidence.status='PASS';console.log('PASS room intimate scrollbar '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{if(evidence.status==='FAIL'&&pages.length){const shot=await command('Page.captureScreenshot',{format:'png'},pages[0].sessionId).catch(()=>null);if(shot){evidence.failureFrame=output+'-failure.png';await writeFile(evidence.failureFrame,Buffer.from(shot.data,'base64'));}}evidence.finalLoadState=[];for(const p of pages){evidence.finalLoadState.push(await evaluate(p.sessionId,`(()=>{const b=window.modeReadinessBattle;return {phase:document.querySelector('[data-formal-battle-page]')?'PLAYING':document.querySelector('[data-formal-waiting-page]')?'WAITING':'LOBBY',mapLoaded:b?.mapLoaded,resourcesReady:b?.players.resourcesReady,loadingError:b?.players.loadingError,chatStatus:b?.chat.getSnapshot().status,waitingTogglePresent:!!document.querySelector('[data-waiting-chat-toggle]'),waitingInputPresent:!!document.querySelector('.source-waiting-chat [data-chat-input]'),menuPresent:!!document.querySelector('[data-room-intimate-menu]'),list:document.querySelector('[data-room-intimate-list]')?{height:document.querySelector('[data-room-intimate-list]').clientHeight,scrollHeight:document.querySelector('[data-room-intimate-list]').scrollHeight,physicalHeight:document.querySelector('[data-room-intimate-list]').getBoundingClientRect().height,rows:document.querySelectorAll('[data-room-intimate-player]').length}:null,bar:document.querySelector('[data-room-intimate-scrollbar]')?{hidden:document.querySelector('[data-room-intimate-scrollbar]').hidden,scale:document.querySelector('[data-room-intimate-scrollbar]').dataset.scrollScale}:null,world:document.querySelector('#battle-status')?.dataset.world}})()`).catch(error=>({readError:String(error)})));}evidence.network=network;await writeFile(output+'-server.log',serverLog);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');for(const client of clients)await client.disconnect();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
