import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3496',logger:undefined});
const network=[];
const businessTailOnly=process.argv.includes('--business-tail-only');
const scrollTailOnly=process.argv.includes('--scroll-tail-only');
const navigationOnly=process.argv.includes('--navigation-only')||businessTailOnly;
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-waiting-chat-history-scrollbar-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-waiting-chat-history-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3496,vite:5526,cdp:9726},runId,scope:'UI01/UI02 formal complete WAITING/chat source page with two ordinary accounts/public Chinese sending/private rejection/menus/scroll/cleanup; no Ready/purchase/battle or old permission replay.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3496',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5526,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3496',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9726',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9726/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9726');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['CreateRoom','Join','Leave','ExitRoom','Ready','RoomChat','RoomWhisper','FriendChat','PlayerInput','Shop','TankShop','SelectRole'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});



  const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
  const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5526',browserContextId});
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);const s=sessionId;
  await waitUntil(s,`document.querySelector('[data-room-card-home]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);
  async function page(){const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5526',browserContextId});const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);await waitUntil(sessionId,`document.querySelector('[data-room-card-home]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);return sessionId;}
  const b=await page();
  await nativeClick(s,'[data-room-card-create]');await waitUntil(s,`document.querySelector('[data-map-selector-map="7"]')`);await nativeClick(s,'[data-map-selector-map="7"]');await nativeClick(s,'[data-map-selector-confirm]');await waitUntil(s,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);await nativeClick(s,'[data-room-create-confirm]');await waitUntil(s,`document.querySelector('[data-formal-waiting-page]')&&document.querySelector('.source-waiting-chat')&&!document.querySelector('[data-room-create-dialog]')?.open`);
  const room=await evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);await waitUntil(b,`document.querySelector('[data-room-card-id="${room}"]')`);await nativeClick(b,`[data-room-card-id="${room}"]`);await nativeClick(b,'[data-room-card-express]');await waitUntil(b,`document.querySelector('[data-formal-waiting-page]')&&document.querySelector('.source-waiting-chat')`);evidence.room=room;
  const input='.source-waiting-chat [data-chat-input]';
  async function press(p,key,code,vk){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,...(key==='Enter'?{text:'\r'}:{})},p);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk},p);}
  async function type(p,selector,text){await nativeClick(p,selector);await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},p);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},p);await command('Input.insertText',{text},p);}
  async function send(text){const before=network.length;await type(s,input,text);await press(s,'Enter','Enter',13);await waitUntil(s,`document.querySelector('${input}').value===''`);for(const p of [s,b])await waitUntil(p,`[...document.querySelectorAll('[data-chat-text]')].some(e=>e.dataset.chatText.includes(${JSON.stringify(text)}))`);const response=network.slice(before).find(n=>n.name==='RoomChat'&&n.direction==='received');assert(response?.success);return {text,confirmed:true,bothReceived:true};}
  if (!navigationOnly && !scrollTailOnly) {
  evidence.public=await send('等待聊天中文');
  evidence.resolutions=[];
  async function resize(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('[data-waiting-chat-stage]').getBoundingClientRect().width-612*Math.min(${width}/800,${height}/600))<.2&&Math.abs(document.querySelector('[data-waiting-room-stage]').getBoundingClientRect().width-615*Math.min(${width}/800,${height}/600))<.2`);}
  for(const [width,height]of [[800,600],[1920,1080],[3840,2160]]){
    await resize(width,height);
    const result=await evaluate(s,`(async()=>{const d=document.querySelector('.source-waiting-chat'),stage=d.querySelector('[data-waiting-chat-stage]'),wr=document.querySelector('[data-waiting-room-stage]'),scale=stage.getBoundingClientRect().width/612;
      const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,inside:r.left>=-.2&&r.top>=-.2&&r.right<=innerWidth+.2&&r.bottom<=innerHeight+.2}};
      const assets=[...new Set([...d.querySelectorAll('[data-source-asset]')].map(e=>e.dataset.sourceAsset))];await Promise.all(assets.map(a=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=reject;i.src='/'+a;})));
      const rect=e=>{const a=e.getBoundingClientRect();return [a.x,a.y,a.width,a.height]};
      return {width:innerWidth,height:innerHeight,scale,main:box(wr),chat:box(stage),input:box(d.querySelector('[data-chat-input]')),log:box(d.querySelector('[data-chat-log]')),management:box(document.querySelector('[data-waiting-management]')),mainTop:wr.getBoundingClientRect().y,chatTop:stage.getBoundingClientRect().y,assets,frames:d.querySelectorAll('[data-source-frame]').length,controls:[...d.querySelectorAll('[data-source-control]')].map(e=>e.dataset.sourceControl),sourceInput:d.querySelector('[data-chat-input]').dataset.sourceControl,messages:[...d.querySelectorAll('[data-chat-text]')].map(e=>e.dataset.chatText),legacySelect:getComputedStyle(d.querySelector('[data-chat-channel]')).display,legacySubmit:getComputedStyle(d.querySelector('button[type="submit"]')).display};})()`);
    evidence.resolutions.push(result);
    const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));
    assert(result.main.inside&&result.chat.inside&&result.input.inside&&result.log.inside&&result.management.inside);assert(Math.abs(result.chatTop-result.mainTop-402*result.scale)<.2);assert.equal(result.sourceInput,'edtNormalUserInput');assert.equal(result.legacySelect,'none');assert.equal(result.legacySubmit,'none');assert(result.messages.some(t=>t.includes('等待聊天中文')));

  }
  await resize(1920,1080);
  await type(s,input,'频道草稿');evidence.channels=[];
  for(const value of [1,3,2,0]){await nativeClick(s,'[data-waiting-chat-toggle]');await waitUntil(s,`document.querySelector('[data-waiting-chat-channel-menu]')`);await nativeClick(s,`[data-waiting-chat-channel="${value}"]`);await waitUntil(s,`!document.querySelector('[data-waiting-chat-channel-menu]')&&document.activeElement.matches('${input}')`);assert.equal(await evaluate(s,`document.querySelector('${input}').value`),'频道草稿');evidence.channels.push(value);}
  } else {evidence.resolutions=[]; evidence.scope='WAITING navigation-only missing Escape/emote/private rejection/scroll/ordinary Leave; no screenshots, Ready, purchases or old four-channel replay.';}
  if (scrollTailOnly) {
    evidence.scope='WAITING ChatTextBox scrollbar tail: nineteen real public rows, three resolutions, scale metrics, arrows/wheel/thumb capture/HomeEnd/autobottom; reuses prior room/menu evidence.';
    for(let i=0;i<19;i++) await send('长日志中文消息'+String(i+1).padStart(2,'0'));
    const logTail='.source-waiting-chat [data-chat-log]', barTail='[data-waiting-chat-history-scrollbar]', thumbTail='[data-waiting-chat-history-scroll-thumb]', upTail='[data-waiting-chat-history-scroll-arrow="up"]', downTail='[data-waiting-chat-history-scroll-arrow="down"]';
    evidence.longRows=await evaluate(s,`document.querySelectorAll('${logTail} li').length`);assert.equal(evidence.longRows,19);
    async function tailResize(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('[data-waiting-chat-stage]').getBoundingClientRect().width-612*Math.min(${width}/800,${height}/600))<.2`);await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);}
    const tailRead=()=>evaluate(s,`(()=>{const l=document.querySelector('${logTail}'),b=document.querySelector('${barTail}'),t=document.querySelector('${thumbTail}'),r=b.getBoundingClientRect();return {scale:Number(b.dataset.scrollScale),listScale:l.getBoundingClientRect().height/l.clientHeight,bar:{x:r.x,y:r.y,width:r.width,height:r.height,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight},scroll:l.scrollTop,extent:l.scrollHeight-l.clientHeight,page:l.clientHeight,thumb:t.getBoundingClientRect().height,capture:t.hasPointerCapture(1),state:t.dataset.thumbState}})()`);
    evidence.tailResolutions=[];
    for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){await tailResize(width,height);const state=await tailRead();assert(state.bar.inside&&state.extent>0&&Math.abs(state.scale-state.listScale)<.01);evidence.tailResolutions.push({width,height,...state});const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));}
    await tailResize(1920,1080);await nativeClick(s,upTail);const arrow=await tailRead();assert(arrow.scroll<arrow.extent);await evaluate(s,`document.querySelector('${logTail}').scrollTop=0`);await nativeClick(s,downTail);const down=await tailRead();assert(down.scroll>0);
    const wp=await evaluate(s,`(()=>{const r=document.querySelector('${logTail}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mouseWheel',...wp,deltaX:0,deltaY:40},s);const wheel=await tailRead();assert(wheel.scroll>down.scroll);evidence.tailArrowWheel={arrow,down,wheel};
    await nativeClick(s,thumbTail);await press(s,'Home','Home',36);const home=await tailRead();assert.equal(home.scroll,0);const tp=await evaluate(s,`(()=>{const r=document.querySelector('${thumbTail}').getBoundingClientRect();return {x:r.x+3,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...tp},s);const held=await tailRead();assert(held.capture);const outside={x:tp.x+100,y:tp.y+120};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,...outside},s);const moved=await tailRead();assert(moved.capture);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...outside},s);const released=await tailRead();assert(!released.capture&&released.state==='Normal');await press(s,'End','End',35);const end=await tailRead();assert(Math.abs(end.scroll-end.extent)<1);evidence.tailThumb={home,held,moved,released,end};
    await press(s,'Home','Home',36);await send('新消息自动到底');const auto=await tailRead();assert(Math.abs(auto.scroll-auto.extent)<1);evidence.tailAutoBottom=auto;evidence.tailNoBuy=true;
  }
  if (!businessTailOnly) {
  await nativeClick(s,'[data-waiting-chat-toggle]');await waitUntil(s,`document.querySelector('[data-waiting-chat-channel-menu]')`);evidence.beforeEscape=await evaluate(s,`({active:document.activeElement.outerHTML,withinMenu:!!document.activeElement.closest('[data-waiting-chat-channel-menu]')})`);await evaluate(s,`window.waitingChatKeys=[];window.addEventListener('keydown',e=>window.waitingChatKeys.push(e.code))`);await press(s,'Escape','Escape',27);await waitUntil(s,`!document.querySelector('[data-waiting-chat-channel-menu]')&&document.activeElement.matches('[data-waiting-chat-toggle]')`);evidence.menuEscape={keys:await evaluate(s,'window.waitingChatKeys'),toggleFocus:true};assert.deepEqual(evidence.menuEscape.keys,[]);
  await nativeClick(s,'[data-waiting-chat-emotes]');await waitUntil(s,`document.querySelectorAll('[data-waiting-emote-choice]').length===30`);evidence.emoteCount=30;await nativeClick(s,'[data-waiting-emote-choice="1"]');await waitUntil(s,`document.querySelector('${input}').value.includes(String.fromCharCode(0x2581))`);evidence.emoteInserted=true;await nativeClick(s,'[data-waiting-chat-emotes]');
  } else {evidence.scope='WAITING business-tail-only confirmed private rejection/scroll/ordinary Leave; resolutions[] and no old Escape/emote/channel replay.';}
  await nativeClick(s,'[data-waiting-chat-toggle]');await nativeClick(s,'[data-waiting-chat-channel="2"]');await type(s,'[data-chat-whisper-target]','无人存在甲');await type(s,input,'拒绝保稿中文');const before=network.length;await press(s,'Enter','Enter',13);const responseDeadline=Date.now()+10000;while(!network.slice(before).some(n=>n.name==='RoomWhisper'&&n.direction==='received')&&Date.now()<responseDeadline)await new Promise(r=>setTimeout(r,50));await waitUntil(s,`document.querySelector('[data-waiting-chat-business-status]')?.textContent.includes('密语目标当前不在线')`);const rejection=network.slice(before).find(n=>n.name==='RoomWhisper'&&n.direction==='received');assert(rejection&&!rejection.success);evidence.rejection={code:rejection.response.code,message:await evaluate(s,`document.querySelector('[data-waiting-chat-business-status]').textContent`),draft:await evaluate(s,`document.querySelector('${input}').value`)};assert.equal(evidence.rejection.draft,'拒绝保稿中文');
  await nativeClick(s,'[data-waiting-chat-toggle]');await nativeClick(s,'[data-waiting-chat-channel="0"]');evidence.scrollMessages=[];for(let i=0;i<8;i++)evidence.scrollMessages.push(await send('滚动消息'+i));
  const log='.source-waiting-chat [data-chat-log]';const historyBar='[data-waiting-chat-history-scrollbar]';const historyThumb='[data-waiting-chat-history-scroll-thumb]';const point=await evaluate(s,`(()=>{const r=document.querySelector('${log}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaX:0,deltaY:-500},s);await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);evidence.scroll=await evaluate(s,`({top:document.querySelector('${log}').scrollTop,height:document.querySelector('${log}').scrollHeight,client:document.querySelector('${log}').clientHeight})`);assert(evidence.scroll.height>evidence.scroll.client);assert(evidence.scroll.top<evidence.scroll.height-evidence.scroll.client);evidence.historyScrollbar=await evaluate(s,`(()=>{const b=document.querySelector('${historyBar}'),t=document.querySelector('${historyThumb}');return {visible:!!b&&!b.hidden,inside:b?.getBoundingClientRect().right<=innerWidth,minimum:t?.getBoundingClientRect().height,scale:b?.dataset.scrollScale}})()`);assert(evidence.historyScrollbar.visible&&evidence.historyScrollbar.inside);
  for(const p of [b,s]){await nativeClick(p,'[data-waiting-close]');await waitUntil(p,`!document.querySelector('.source-waiting-chat')&&document.activeElement.matches('[data-room-card-create]')&&document.activeElement.matches(':enabled')`);}evidence.cleanup={chatUnmounted:true,strictCreateFocusBoth:true};assert(!network.some(n=>n.direction==='sent'&&['Ready','Shop','TankShop','SelectRole'].includes(n.name)));evidence.noReadyPurchaseBattle=true;evidence.status='PASS';console.log('PASS formal waiting original chat page '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
