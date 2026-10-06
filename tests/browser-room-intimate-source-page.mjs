import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3426',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-room-intimate-source-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-room-intimate-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3426,vite:5456,cdp:9656},runId,scope:'UI05/UI18 first formal WAITING+PLAYING source3control intimate menus; two ordinary humans and2CPU normalcontext, three full pages each, roster/caret/cancel/capture/composition/keyboard/Leave; no sends/BUY/outcomes.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3426',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'300'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'readonly-resource-ready',transform(source,id){if(id.endsWith('/src/match/battle.ts'))return source+'\nconst modeOldQuick=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.modeReadinessBattle=this;return modeOldQuick.call(this,value);};';}}],server:{port:5456,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3426',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9656',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9656/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9656');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5456'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')?.matches(':enabled')`);
  }
  const s=pages[0].sessionId,b=pages[1].sessionId;
  await nativeClick(s,'[data-room-card-create]');await waitUntil(s,`document.querySelector('[data-map-selector-map="7"]')`);await nativeClick(s,'[data-map-selector-map="7"]');await nativeClick(s,'[data-map-selector-confirm]');await waitUntil(s,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);await nativeClick(s,'[data-room-create-confirm]');await waitUntil(s,`document.querySelector('[data-formal-waiting-page]')`);
  const world=p=>evaluate(p,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  const roomId=(await world(s)).roomId;await waitUntil(b,`document.querySelector('[data-room-card-id="${roomId}"]')?.matches(':enabled')`);await nativeClick(b,`[data-room-card-id="${roomId}"]`);await nativeClick(b,'[data-room-card-express]');await waitUntil(b,`document.querySelector('[data-formal-waiting-page]')`);
  await waitUntil(s,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===2`);
  const guestId=(await world(b)).playerId,guestName=(await world(s)).players.find(p=>p.id===guestId).name;assert(guestName);evidence.context={roomId,guestId,guestName,normalHumans:2};
  async function key(p,key,code,vk,text){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,...(text?{text}: {})},p);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk},p);}
  async function resize(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('#original-battle-hud').getBoundingClientRect().width-800*Math.min(${width}/800,${height}/600))<.2`);}
  evidence.phases=[];
  for(const phase of ['WAITING','PLAYING']){
    const waiting=phase==='WAITING',container=waiting?'.source-waiting-chat':'.source-battle-chat',toggle=container+' [data-room-intimate-toggle]',menu='[data-room-intimate-menu]',input=container+' [data-chat-input]',target=container+' [data-chat-whisper-target]';
    if(waiting){await nativeClick(s,'[data-waiting-chat-toggle]');await waitUntil(s,`document.querySelector('[data-waiting-chat-channel="2"]')`);await nativeClick(s,'[data-waiting-chat-channel="2"]');await nativeClick(s,input);await command('Input.insertText',{text:'房内对象中文草稿'},s);await key(s,'ArrowLeft','ArrowLeft',37);}
    await waitUntil(s,`document.querySelector('${toggle}')?.matches(':enabled')`);
    async function open(){await nativeClick(s,toggle);await waitUntil(s,`document.querySelector('${menu}')&&document.activeElement.matches('[data-room-intimate-player]')`);}
    await open();const entry={phase,resolutions:[]};evidence.phases.push(entry);
    for(const [width,height]of [[800,600],[1920,1080],[3840,2160]]){
      await resize(width,height);
      const result=await evaluate(s,`(async()=>{const root=document.querySelector('${menu}'),box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,inside:r.left>=-.2&&r.top>=-.2&&r.right<=innerWidth+.2&&r.bottom<=innerHeight+.2}};const images=[...root.querySelectorAll('[data-source-asset]')].filter(e=>e.dataset.sourceAsset);await Promise.all(images.map(e=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=reject;i.src='/'+e.dataset.sourceAsset;})));return {width:innerWidth,height:innerHeight,menu:box(root),controls:[...root.querySelectorAll('[data-source-control]')].map(e=>({name:e.dataset.sourceControl,box:box(e)})),frames:root.querySelectorAll('[data-source-frame]').length,rows:[...root.querySelectorAll('[data-room-intimate-player]')].map(e=>({id:e.dataset.roomIntimatePlayer,name:e.textContent,box:box(e),selected:e.getAttribute('aria-selected')})),binding:root.querySelector('[data-roster-binding]').dataset.rosterBinding,confirmed:window.modeReadinessBattle.chat.getSnapshot().players,toggle:box(document.querySelector('${toggle}'))};})()`);
      entry.resolutions.push(result);const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+phase.toLowerCase()+'-'+width+'.png',Buffer.from(shot.data,'base64'));
      assert.equal(result.controls.length,3);assert.equal(result.frames,8);assert.equal(result.rows.length,waiting?2:4);assert(result.controls.every(v=>v.box.inside)&&result.rows.every(v=>v.box.inside)&&result.toggle.inside);assert.equal(result.binding,'web-confirmed-room-snapshot');for(const row of result.rows)assert(result.confirmed.some(p=>p.id===row.id&&p.name===row.name));
    }
    await resize(1920,1080);await evaluate(s,`window.roomIntimateKeys=[];window.addEventListener('keydown',e=>window.roomIntimateKeys.push(e.code),{once:false})`);
    await key(s,'Escape','Escape',27);await waitUntil(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${toggle}')`);entry.escape={keys:await evaluate(s,'window.roomIntimateKeys'),strictToggle:true};assert.deepEqual(entry.escape.keys,[]);
    const point=await evaluate(s,`(()=>{const r=document.querySelector('${toggle}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);const state=()=>evaluate(s,`(()=>{const e=document.querySelector('${toggle}');return {state:e.dataset.sourceButtonState,capture:e.hasPointerCapture(1),pushed:e.dataset.sourcePushed,menu:!!document.querySelector('${menu}')}})()`);
    await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'none',buttons:0,...point},s);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,modifiers:16,clickCount:1,...point},s);await waitUntil(s,`document.querySelector('${toggle}').dataset.sourcePushed==='true'`);entry.pressed=await state();assert(entry.pressed.capture);const outside={x:point.x+190,y:point.y-160};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,...outside},s);entry.outside=await state();assert(entry.outside.capture);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...outside},s);await waitUntil(s,`document.querySelector('${toggle}').dataset.sourcePushed==='false'`);entry.release=await state();assert(!entry.release.capture&&!entry.release.menu);assert.equal(entry.release.state,'Normal');
    const before=await evaluate(s,`({draft:document.querySelector('${input}').value,caret:document.querySelector('${input}').selectionStart})`);
    await open();await nativeClick(s,`[data-room-intimate-player="${guestId}"]`);await waitUntil(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${input}')&&document.querySelector('${target}').value===${JSON.stringify(guestName)}`);
    const read=()=>evaluate(s,`({target:document.querySelector('${target}').value,draft:document.querySelector('${input}').value,caret:document.querySelector('${input}').selectionStart,inputFocus:document.activeElement.matches('${input}')})`);entry.mouse=await read();assert.equal(entry.mouse.draft,before.draft);assert.equal(entry.mouse.caret,before.caret);
    await open();await key(s,'Home','Home',36);await key(s,'ArrowDown','ArrowDown',40);await key(s,'Enter','Enter',13,'\r');await waitUntil(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${input}')`);entry.keyboard=await read();assert.equal(entry.keyboard.target,guestName);assert.equal(entry.keyboard.draft,before.draft);assert.equal(entry.keyboard.caret,before.caret);
    await open();await key(s,'Home','Home',36);await key(s,'Escape','Escape',27);await waitUntil(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${toggle}')`);entry.cancel=await read();assert.equal(entry.cancel.target,guestName);assert.equal(entry.cancel.draft,before.draft);
    await evaluate(s,`document.querySelector('${target}').focus();document.querySelector('${target}').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'中'}))`);await nativeClick(s,toggle);assert(await evaluate(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${target}')`));await evaluate(s,`document.querySelector('${target}').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中'}))`);await open();await evaluate(s,`document.querySelector('${target}').focus();document.querySelector('${target}').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'中'}))`);await key(s,'Escape','Escape',27);assert(await evaluate(s,`!!document.querySelector('${menu}')&&document.activeElement.matches('${target}')`));await evaluate(s,`document.querySelector('${target}').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中'}))`);await key(s,'Escape','Escape',27);await waitUntil(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${toggle}')`);entry.composition={scope:'Synthetic nickname composition state with native Escape/mouse',kept:true};assert.deepEqual(await evaluate(s,'window.roomIntimateKeys'),[]);
    if(waiting){for(let i=0;i<2;i++){await nativeClick(s,'[data-add-cpu]');await waitUntil(s,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===${i+3}&&document.querySelector('[data-add-cpu]')?.matches(':enabled')`);}for(const p of [s,b])await waitUntil(p,`window.modeReadinessBattle?.mapLoaded&&window.modeReadinessBattle?.players.resourcesReady&&!window.modeReadinessBattle.players.loadingError&&document.querySelector('[data-waiting-ready]')?.matches(':enabled')`,90000);for(const p of [s,b])await nativeClick(p,'[data-waiting-ready]');for(const p of [s,b])await waitUntil(p,`document.querySelector('[data-formal-battle-page]')`,90000);}
  }
  evidence.cleanup=[];for(const p of [s,b]){await nativeClick(p,'[data-leave-room]');await waitUntil(p,`!document.querySelector('[data-formal-battle-page]')&&document.activeElement.matches('[data-room-card-create]')&&document.activeElement.matches(':enabled')`);evidence.cleanup.push({strictCreate:true,chatHidden:await evaluate(p,`!document.querySelector('.source-battle-chat')`),rosterCleared:await evaluate(p,`window.modeReadinessBattle.chat.getSnapshot().players.length===0`)});}assert(evidence.cleanup.every(v=>v.chatHidden&&v.rosterCleared));assert(!network.some(n=>n.direction==='sent'&&['RoomChat','RoomWhisper','FriendChat','Shop','TankShop','SelectRole'].includes(n.name)));evidence.noSendBuy=true;evidence.status='PASS';console.log('PASS room intimate source page '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
