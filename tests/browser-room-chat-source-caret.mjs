import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3480',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-room-chat-source-caret-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-room-caret-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3480,vite:5510,cdp:9710},runId,scope:'UI01/UI02/M5-12 six source input caret consumers in normal WAITING/PLAYING; two humans+2CPU, source3res and whisper1920/focus/blur; no send/BUY/OSIME.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3480',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'300'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'readonly-resource-ready',transform(source,id){if(id.endsWith('/src/match/battle.ts'))return source+'\nconst modeOldQuick=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.modeReadinessBattle=this;return modeOldQuick.call(this,value);};';}}],server:{port:5510,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3480',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9710',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9710/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9710');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5510'},sessionId);
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

  evidence.phases=[];
  for(const phase of ['WAITING','PLAYING']){
    const waiting=phase==='WAITING',container=waiting?'.source-waiting-chat':'.source-battle-chat',input=container+' [data-chat-input]',target=container+' [data-chat-whisper-target]',normalName=waiting?'edtNormalUserInput':'edtChat';
    const entry={phase,states:[],resizeTrace:[],screenshots:[]};evidence.phases.push(entry);
    const read=name=>evaluate(s,`(()=>{const c=document.querySelector('[data-room-chat-caret="${name}"]'),e=document.querySelector('${name==='edtIntimateNameInput'?target:input}'),brush=c.querySelector('i'),r=c.getBoundingClientRect(),er=e.getBoundingClientRect();return {name:'${name}',stageWidth:document.querySelector('${waiting?'[data-waiting-chat-stage]':'.source-chat-stage'}')?.getBoundingClientRect().width,viewport:{width:innerWidth,height:innerHeight},asset:c.dataset.sourceAsset,index:Number(c.dataset.sourceCaretIndex),focused:c.dataset.sourceFocused,visibility:getComputedStyle(c).visibility,brushWidth:brush.getBoundingClientRect().width,sourceWidth:Number(c.dataset.sourceCaretWidth),blink:brush.style.opacity,draft:e.value,withinInput:Math.abs(r.x-er.x)<.2&&Math.abs(r.y-er.y)<.2,selection:[e.selectionStart,e.selectionEnd],nativeCaret:getComputedStyle(e).caretColor}})()`);
    async function type(selector,text){await nativeClick(s,selector);await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},s);await command('Input.insertText',{text},s);assert.equal(await evaluate(s,`document.querySelector('${selector}').value`),text);}
    if(!waiting){await nativeClick(s,'.source-battle-chat [data-source-control="btnPublic"]:not([hidden]), .source-battle-chat [data-source-control="btnPrivate"]:not([hidden]), .source-battle-chat [data-source-control="btnTeam"]:not([hidden]), .source-battle-chat [data-source-control="btnFriend"]:not([hidden])');await waitUntil(s,`document.querySelector('[data-chat-source-channel="0"]')`);await nativeClick(s,'[data-chat-source-channel="0"]');}
    await waitUntil(s,`document.querySelector('[data-room-chat-caret="${normalName}"]')`);
    await type(input,'房内中文光标草稿');
    for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
      const trace={target:{width,height},before:await read(normalName)};entry.resizeTrace.push(trace);
      await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
      trace.afterDispatch=await read(normalName);
      await waitUntil(s,`Math.abs(document.querySelector('#original-battle-hud').getBoundingClientRect().width-800*Math.min(${width}/800,${height}/600))<.2&&Math.abs(document.querySelector('.battle-chat').getBoundingClientRect().width-${waiting?612:301}*Math.min(${width}/800,${height}/600))<.2`);
      await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
      trace.afterReact=await read(normalName);
      await waitUntil(s,`document.querySelector('[data-room-chat-caret="${normalName}"] i').style.opacity==='1'`);
      const state=await read(normalName);entry.states.push(state);assert.equal(state.asset,'ui/regions/60/236.png');assert.equal(state.focused,'true');assert(state.withinInput);assert(Math.abs(state.brushWidth-Math.round(Math.min(width/800,height/600)))<.2);
      const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+phase.toLowerCase()+'-'+width+'.png';await writeFile(path,Buffer.from(shot.data,'base64'));entry.screenshots.push(path);
    }
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);
    await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    await nativeClick(s,waiting?'[data-waiting-chat-toggle]':'.source-battle-chat [data-source-control="btnPublic"]:not([hidden]), .source-battle-chat [data-source-control="btnPrivate"]:not([hidden]), .source-battle-chat [data-source-control="btnTeam"]:not([hidden]), .source-battle-chat [data-source-control="btnFriend"]:not([hidden])');
    await waitUntil(s,`document.querySelector('${waiting?'[data-waiting-chat-channel="2"]':'[data-chat-source-channel="2"]'}')`);
    await nativeClick(s,waiting?'[data-waiting-chat-channel="2"]':'[data-chat-source-channel="2"]');
    await type(target,'中文对象未发送');const targetState=await read('edtIntimateNameInput');assert.equal(targetState.focused,'true');assert(targetState.withinInput);entry.target=targetState;
    await type(input,'中文房内密语草稿');const content=await read('edtIntimateChatInput');assert.equal(content.focused,'true');assert(content.withinInput);entry.whisper=content;
    entry.targetBlur=await read('edtIntimateNameInput');assert.equal(entry.targetBlur.visibility,'hidden');assert.equal(entry.targetBlur.focused,'false');
    await waitUntil(s,`document.querySelector('[data-room-chat-caret="edtIntimateChatInput"] i').style.opacity==='1'`);const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+phase.toLowerCase()+'-whisper-1920.png';await writeFile(path,Buffer.from(shot.data,'base64'));entry.screenshots.push(path);
    await key(s,'Escape','Escape',27);await waitUntil(s,`document.querySelector('[data-room-chat-caret="edtIntimateChatInput"]').dataset.sourceFocused==='false'`);entry.blur=await read('edtIntimateChatInput');assert.equal(entry.blur.visibility,'hidden');assert.equal(entry.blur.draft,'中文房内密语草稿');
    if(waiting){for(let i=0;i<2;i++){await nativeClick(s,'[data-add-cpu]');await waitUntil(s,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===${i+3}&&document.querySelector('[data-add-cpu]')?.matches(':enabled')`);}for(const p of [s,b])await waitUntil(p,`window.modeReadinessBattle?.mapLoaded&&window.modeReadinessBattle?.players.resourcesReady&&!window.modeReadinessBattle.players.loadingError&&document.querySelector('[data-waiting-ready]')?.matches(':enabled')`,90000);for(const p of [s,b])await nativeClick(p,'[data-waiting-ready]');for(const p of [s,b])await waitUntil(p,`document.querySelector('[data-formal-battle-page]')`,90000);}
  }
  evidence.cleanup=[];for(const p of [s,b]){await nativeClick(p,'[data-leave-room]');await waitUntil(p,`!document.querySelector('[data-formal-battle-page]')&&document.activeElement.matches('[data-room-card-create]')&&document.activeElement.matches(':enabled')`);evidence.cleanup.push({strictCreate:true,chatHidden:await evaluate(p,`!document.querySelector('.source-battle-chat')`)});}assert(evidence.cleanup.every(v=>v.chatHidden));assert(!network.some(n=>n.direction==='sent'&&['RoomChat','RoomWhisper','FriendChat','Shop','TankShop','SelectRole'].includes(n.name)));evidence.noSendBuy=true;evidence.status='PASS';console.log('PASS room chat source caret '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.runtime=[];for(const p of pages){try{evidence.runtime.push(await evaluate(p.sessionId,`(()=>{const b=window.modeReadinessBattle;return {resourcesReady:b?.players.resourcesReady,loadingError:b?.players.loadingError,mapLoaded:b?.mapLoaded,world:!!b?.world}})()`));}catch(error){evidence.runtime.push({error:String(error)});}}evidence.network=network;await writeFile(output+'-server.log',serverLog);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
