import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3448',logger:undefined});
const network=[],runtimeErrors=[],resourceErrors=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-lobby-intimate-scroll-source-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-lobby-intimate-scroll-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[],clients=[];

const evidence={status:'RUNNING',ports:{server:3448,vite:5476,cdp:9679},runId,scope:'UI05 long confirmed lobby directory source scrollbar consumer; one1920 complete overflow menu/capture/wheel/keys/selection/caret, no send/room/BUY; prior base menu screenshots reused.'};
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
  const point = await evaluate(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),c=e.closest('[data-lobby-intimate-scrollbar]')?.getBoundingClientRect(),x=c?(Math.max(r.left,c.left)+Math.min(r.right,c.right))/2:r.x+r.width/2,y=c?(Math.max(r.top,c.top)+Math.min(r.bottom,c.bottom))/2:r.y+r.height/2;if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Control covered '+e.outerHTML+' by '+document.elementFromPoint(x,y)?.outerHTML);return {x,y}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},session);
  await command('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',buttons:1,clickCount:1,...point}, session);
  await command('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',buttons:0,clickCount:1,...point}, session);
}
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3448',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5476,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3448',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9679',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9679/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9679');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));
  if(m.method==='Runtime.exceptionThrown')runtimeErrors.push({page:m.sessionId,text:m.params.exceptionDetails.text,description:m.params.exceptionDetails.exception?.description});
  if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')runtimeErrors.push({page:m.sessionId,text:m.params.entry.text});
  if(m.method==='Network.responseReceived'&&m.params.response.status>=400)resourceErrors.push({page:m.sessionId,type:m.params.type,status:m.params.response.status,url:new URL(m.params.response.url).pathname});
  if(m.method==='Network.loadingFailed')resourceErrors.push({page:m.sessionId,type:m.params.type,error:m.params.errorText});
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(r.service.name==='Account'&&r.ret?.isSucc)network.push({index:network.length,page:m.sessionId,direction:'received',name:'AccountIdentity',accountId:r.ret.res.accountId});if(['ListMaps','LobbyPlayers','LobbyChat','LobbyWhisper','FriendChat','Friends','CreateRoom','Join','Ready','Shop','TankShop','SelectRole'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});




  for(let i=0;i<10;i++){
    const client=new WsClient(serviceProto,{server:'ws://127.0.0.1:3448',logger:undefined});clients.push(client);
    assert((await client.connect()).isSucc);const account=await client.callApi('Account',{});assert(account.isSucc);
    (evidence.accounts??=[]).push({accountId:account.res.accountId});
  }
  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Runtime.enable',{},sessionId);await command('Log.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.enable',{},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5476'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-home]')?.matches(':enabled')&&document.querySelector('[data-lobby-channel-toggle]')?.matches(':enabled')`);
  }
  const s=pages[0].sessionId;
  await command('Page.bringToFront',{},s);
  await waitUntil(s,`document.querySelectorAll('[data-lobby-player-account]').length===12`);

  const menu='[data-lobby-intimate-menu]',toggle='[data-lobby-intimate-toggle]',input='[data-lobby-chat-input]';
  async function key(key,code,vk,text){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,...(text?{text}: {})},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk},s);}
  async function open(){await nativeClick(s,toggle);await waitUntil(s,`document.querySelector('${menu}')&&document.activeElement.matches('[data-lobby-intimate-account]')`);}
  async function resize(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('[data-lobby-stage]').getBoundingClientRect().width-800*Math.min(${width}/800,${height}/600))<.2`);}
  await nativeClick(s,'[data-lobby-channel-toggle]');await waitUntil(s,`document.querySelector('[data-lobby-channel="whisper"]')`);await nativeClick(s,'[data-lobby-channel="whisper"]');await waitUntil(s,`document.querySelector('${toggle}')`);
  await nativeClick(s,input);await command('Input.insertText',{text:'对象中文草稿'},s);await key('ArrowLeft','ArrowLeft',37);
  const caret=await evaluate(s,`document.querySelector('${input}').selectionStart`);assert.equal(caret,5);
  await open();
  const list='[data-lobby-intimate-list]',bar='[data-lobby-intimate-scrollbar]',thumb='[data-lobby-intimate-scroll-thumb]',down='[data-lobby-intimate-scroll-arrow="down"]';
  await waitUntil(s,`document.querySelector('${bar}')&&!document.querySelector('${bar}').hidden`);
  const read=()=>evaluate(s,`(()=>{const l=document.querySelector('${list}'),t=document.querySelector('${thumb}');return {scroll:l.scrollTop,height:l.clientHeight,document:l.scrollHeight,state:t.dataset.thumbState,capture:t.hasPointerCapture(1),ids:[...l.querySelectorAll('[data-lobby-intimate-account]')].map(e=>e.dataset.lobbyIntimateAccount)}})()`);
  evidence.initial=await read();assert.equal(evidence.initial.ids.length,12);assert(evidence.initial.document>evidence.initial.height);
  const confirmed=network.filter(n=>n.name==='LobbyPlayers'&&n.success).at(-1)?.response.players;assert.equal(confirmed?.length,12);assert.deepEqual([...evidence.initial.ids].sort(),confirmed.map(p=>p.accountId).sort());evidence.confirmedDirectory=confirmed;
  evidence.source=await evaluate(s,`(async()=>{const root=document.querySelector('${menu}'),b=document.querySelector('${bar}'),l=document.querySelector('${list}');const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}};const images=[...root.querySelectorAll('[data-source-asset]')].filter(e=>e.dataset.sourceAsset);await Promise.all(images.map(e=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=reject;img.src='/'+e.dataset.sourceAsset})));return {menu:box(root),list:box(l),bar:box(b),controls:[...root.querySelectorAll('[data-source-control]')].map(e=>e.dataset.sourceControl),images:images.map(e=>e.dataset.sourceAsset),geometry:b.dataset.scrollGeometryBinding,width:b.dataset.scrollWidthBinding,minimum:b.dataset.scrollMinimumBinding,step:b.dataset.scrollStepBinding,font:getComputedStyle(l).fontFamily}})()`);assert(evidence.source.menu.inside&&evidence.source.list.inside&&evidence.source.bar.inside);assert(Math.abs(evidence.source.list.width-108*1.8)<.2);assert.equal(evidence.source.controls.length,3);
  evidence.resolutions=[{width:1920,height:1080}];const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-1920.png',Buffer.from(shot.data,'base64'));
  await evaluate(s,`window.intimateScrollKeys=[];window.addEventListener('keydown',e=>window.intimateScrollKeys.push('down:'+e.code));window.addEventListener('keyup',e=>window.intimateScrollKeys.push('up:'+e.code))`);
  await nativeClick(s,down);evidence.arrow=await read();assert(evidence.arrow.scroll>0);
  const point=await evaluate(s,`(()=>{const r=document.querySelector('${list}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaY:100,deltaX:0},s);await waitUntil(s,`document.querySelector('${list}').scrollTop>${evidence.arrow.scroll}`);evidence.wheel=await read();
  const p=await evaluate(s,`(()=>{const r=document.querySelector('${thumb}').getBoundingClientRect(),b=document.querySelector('${bar}').getBoundingClientRect();return {x:b.x+b.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'none',buttons:0,...p},s);
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,modifiers:16,clickCount:1,...p},s);
  evidence.thumbPressed=await read();assert(evidence.thumbPressed.capture);assert.equal(evidence.thumbPressed.state,'Pushed');
  const outside={x:p.x+80,y:p.y+30};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,...outside},s);evidence.thumbMoved=await read();assert(evidence.thumbMoved.capture);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,modifiers:0,clickCount:1,...outside},s);await waitUntil(s,`document.querySelector('${thumb}').dataset.thumbState==='Normal'`);evidence.thumbReleased=await read();assert(!evidence.thumbReleased.capture);
  await key('Home','Home',36);evidence.home=await read();assert.equal(evidence.home.scroll,0);
  await key('End','End',35);evidence.end=await read();assert(Math.abs(evidence.end.scroll-(evidence.end.document-evidence.end.height))<=1/1.8);
  await key('Escape','Escape',27);await waitUntil(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${toggle}')`);
  await open();await key('End','End',35);const chosen=await evaluate(s,`document.activeElement.dataset.lobbyIntimateAccount`);assert(confirmed.some(p=>p.accountId===chosen));await key('Enter','Enter',13,'\r');await waitUntil(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${input}')`);
  evidence.choice=await evaluate(s,`({accountId:document.querySelector('[data-lobby-whisper-target]').dataset.targetAccount,draft:document.querySelector('${input}').value,caret:document.querySelector('${input}').selectionStart,inputFocus:document.activeElement.matches('${input}')})`);assert.equal(evidence.choice.accountId,chosen);assert.equal(evidence.choice.draft,'对象中文草稿');assert.equal(evidence.choice.caret,caret);
  evidence.keys=await evaluate(s,'window.intimateScrollKeys');assert.deepEqual(evidence.keys,[]);
  assert(!network.some(n=>n.direction==='sent'&&['LobbyChat','LobbyWhisper','FriendChat','CreateRoom','Join','Ready','Shop','TankShop','SelectRole'].includes(n.name)));evidence.noSendRoomPurchaseBattle=true;evidence.status='PASS';console.log('PASS lobby intimate source scroll '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.runtimeErrors=runtimeErrors;evidence.resourceErrors=resourceErrors;
  evidence.failureState=await Promise.all(pages.map(async p=>({page:p.sessionId,state:await evaluate(p.sessionId,`({pathname:location.pathname,title:document.title,ready:document.readyState,body:document.body.innerText.slice(0,1600),root:!!document.querySelector('[data-lobby-stage]'),home:document.querySelector('[data-room-card-home]')?.disabled,channel:document.querySelector('[data-lobby-channel-toggle]')?.disabled})`).catch(e=>({error:String(e)}))})));throw error;}
finally{for(const client of clients)await client.disconnect();evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
