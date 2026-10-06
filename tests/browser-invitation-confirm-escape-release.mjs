import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3450',logger:undefined});
const network=[],runtimeErrors=[],resourceErrors=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-invitation-confirm-escape-release-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-room-intimate-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3450,vite:5478,cdp:9681},runId,scope:'UI06 confirm modal native Escape down/up lifecycle and strict Create focus; necessary normal Create+Invite context, no Join/Ready/BUY/send or new screenshots.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3450',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'300'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'readonly-resource-ready',transform(source,id){if(id.endsWith('/src/match/battle.ts'))return source+'\nconst modeOldQuick=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.modeReadinessBattle=this;return modeOldQuick.call(this,value);};';}}],server:{port:5478,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3450',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9681',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9681/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9681');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.method==='Runtime.exceptionThrown')runtimeErrors.push({page:m.sessionId,text:m.params.exceptionDetails.text,description:m.params.exceptionDetails.exception?.description});if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')runtimeErrors.push({page:m.sessionId,text:m.params.entry.text});if(m.method==='Network.responseReceived'&&m.params.response.status>=400)resourceErrors.push({page:m.sessionId,status:m.params.response.status,path:new URL(m.params.response.url).pathname});if(m.method==='Network.loadingFailed')resourceErrors.push({page:m.sessionId,type:m.params.type,error:m.params.errorText});});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['RoomInvite','RoomInvitation','RoomSnapshot','Cpu','CreateRoom','Join','Leave','ExitRoom','Ready','AddCpu','RoomChat','RoomWhisper','FriendChat','PlayerInput','Shop','TankShop','SelectRole'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});




  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Runtime.enable',{},sessionId);await command('Log.enable',{},sessionId);await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5478'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')?.matches(':enabled')`);
  }
  const recipient=pages[1].sessionId,host=pages[0].sessionId;
  async function key(p,key,code,vk,text){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,...(text?{text}: {})},p);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk},p);}
  async function create(p,password){
    await nativeClick(p,'[data-room-card-create]');await waitUntil(p,`document.querySelector('[data-map-selector-map="7"]')`);await nativeClick(p,'[data-map-selector-map="7"]');await nativeClick(p,'[data-map-selector-confirm]');await waitUntil(p,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);
    if(password){await nativeClick(p,'[data-room-create-password]');await command('Input.insertText',{text:password},p);}
    await nativeClick(p,'[data-room-create-confirm]');await waitUntil(p,`document.querySelector('[data-formal-waiting-page]')&&!document.querySelector('dialog[data-room-create-dialog]')&&document.querySelector('[data-waiting-invite]')?.matches(':enabled')`);
  }
  await create(host,'');await nativeClick(host,'[data-waiting-invite]');await waitUntil(recipient,`document.querySelector('[data-source-confirm]')?.open&&document.querySelector('[data-source-confirm-cancel]')?.matches(':enabled')`);
  await waitUntil(recipient,`document.activeElement.matches('[data-source-confirm-cancel]')`);
  await evaluate(recipient,`window.confirmEscaped=[];window.addEventListener('keydown',e=>window.confirmEscaped.push('down:'+e.code));window.addEventListener('keyup',e=>window.confirmEscaped.push('up:'+e.code));`);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},recipient);
  evidence.afterDown=await evaluate(recipient,`(()=>{const d=document.querySelector('[data-source-confirm]');return {open:!!d?.open,withinDialog:!!d?.contains(document.activeElement),keys:window.confirmEscaped}})()`);assert(evidence.afterDown.open&&evidence.afterDown.withinDialog);assert.deepEqual(evidence.afterDown.keys,[]);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},recipient);
  await waitUntil(recipient,`!document.querySelector('[data-source-confirm]')&&document.activeElement.matches('[data-room-card-create]')`);
  evidence.afterUp={closed:true,strictCreate:true,keys:await evaluate(recipient,'window.confirmEscaped')};assert.deepEqual(evidence.afterUp.keys,[]);
  await nativeClick(host,'[data-waiting-close]');await waitUntil(host,`!document.querySelector('[data-formal-waiting-page]')&&document.activeElement.matches('[data-room-card-create]')`);evidence.normalHostLeave=true;
  assert(!network.some(n=>n.direction==='sent'&&['Join','Ready','Shop','TankShop','SelectRole','RoomChat','RoomWhisper','FriendChat'].includes(n.name)));evidence.noJoinReadyBuySend=true;evidence.resolutions=[];evidence.screenshots=[];evidence.status='PASS';console.log('PASS invitation confirm Escape down/up '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.runtimeErrors=runtimeErrors;evidence.resourceErrors=resourceErrors;evidence.failureState=await Promise.all(pages.map(async p=>({page:p.sessionId,state:await evaluate(p.sessionId,`({pathname:location.pathname,title:document.title,ready:document.readyState,body:document.body.innerText.slice(0,1600),lobby:!!document.querySelector('[data-lobby-stage]'),waiting:!!document.querySelector('[data-formal-waiting-page]'),confirm:!!document.querySelector('[data-source-confirm]')})`).catch(e=>({error:String(e)}))})));throw error;}
finally{await writeFile(output+'-server.log',serverLog);evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
