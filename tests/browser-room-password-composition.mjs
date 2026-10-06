import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3385',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-room-password-composition-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-password-composition-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3385,vite:5435,cdp:9635},runId,scope:'UI65 formal password Join rejection and Chinese composition Escape guard; source root geometry reused, no purchase/Ready/battle.'};
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
  await command('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',clickCount:1,...point}, session);
  await command('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',clickCount:1,...point}, session);
}
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3385',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5435,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3385',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9635',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9635/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9635');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['CreateRoom','Join','ExitRoom','Shop','TankShop','PetShop','SelectRole'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});


  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5435',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);
  }
  const host=pages[0].sessionId, guest=pages[1].sessionId;
  async function press(session,key,code,virtual,modifiers=0){
    await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:virtual,modifiers},session);
    await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:virtual,modifiers},session);
  }
  async function fill(session,selector,text){await nativeClick(session,selector);await press(session,'a','KeyA',65,2);await command('Input.insertText',{text},session);}
  await nativeClick(host,'[data-room-card-create]');
  await waitUntil(host,`document.querySelector('[data-map-selector-map="7"]')?.matches(':enabled')`);
  await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');
  await waitUntil(host,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);
  await fill(host,'[data-room-create-name]','中文密码房');
  await fill(host,'[data-room-create-password]','中文密码');
  await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('[data-waiting-room]')`);
  const roomId=network.find(r=>r.name==='CreateRoom'&&r.success)?.response?.room?.id;assert(roomId,'Actual CreateRoom confirmed ID');
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')`);
  const card='[data-room-card-id="'+roomId+'"]';
  async function open(){await nativeClick(guest,card);await nativeClick(guest,'[data-room-card-express]');await waitUntil(guest,`document.querySelector('[data-room-password-input]')?.matches(':enabled')`);}
  await open();
  await fill(guest,'[data-room-password-input]','错误中文');
  await nativeClick(guest,'[data-room-password-confirm]');
  await waitUntil(guest,`document.querySelector('[data-room-password-dialog] output')?.textContent&&document.querySelector('[data-room-password-input]')?.matches(':enabled')&&document.activeElement.matches('[data-room-password-input]')`);
  evidence.rejection=await evaluate(guest,`({text:document.querySelector('[data-room-password-dialog] output').textContent,draftPreserved:document.querySelector('[data-room-password-input]').value==='错误中文',focusedInput:document.activeElement.matches('[data-room-password-input]')})`);
  assert(evidence.rejection.draftPreserved);assert(evidence.rejection.focusedInput);
  const shot=await command('Page.captureScreenshot',{format:'png'},guest);await writeFile(output+'-rejected-1920.png',Buffer.from(shot.data,'base64'));
  if(process.argv.includes('--readability-only')){
    evidence.readability=await evaluate(guest,`(()=>{const e=document.querySelector('[data-room-password-status]'),r=e.getBoundingClientRect(),c=getComputedStyle(e),d=document.querySelector('[data-room-password-dialog]').getBoundingClientRect();return {text:e.textContent,colour:c.color,background:c.backgroundColor,width:r.width,height:r.height,insideDialog:r.x>=d.x&&r.y>=d.y&&r.right<=d.right&&r.bottom<=d.bottom,insideViewport:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}})()`);
    assert(evidence.readability.insideDialog&&evidence.readability.insideViewport);assert(evidence.readability.height>=20);
    await nativeClick(guest,'[data-room-password-cancel]');await waitUntil(guest,`!document.querySelector('[data-room-password-dialog]')&&document.activeElement.matches(${JSON.stringify(card)})`);
    await nativeClick(host,'[data-waiting-room] [data-source-control="btnClose"]');await waitUntil(host,`!document.querySelector('[data-waiting-room]')&&document.activeElement.matches('[data-room-card-create]')`);
    evidence.sourceCancelFocus=true;evidence.hostLeaveFocus=true;evidence.status='PASS';console.log('PASS directed password rejection readability/source Cancel and host cleanup; no replay of composition/correct Join');
  }else{
  await evaluate(guest,`window.passwordEscapedKeys=[];window.addEventListener('keydown',e=>window.passwordEscapedKeys.push(e.code));document.querySelector('[data-room-password-input]').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}))`);
  await press(guest,'Escape','Escape',27);
  evidence.compositionEscape=await evaluate(guest,`({open:!!document.querySelector('[data-room-password-dialog][open]'),draftPreserved:document.querySelector('[data-room-password-input]')?.value==='错误中文',escapedKeys:[...window.passwordEscapedKeys]})`);
  assert(evidence.compositionEscape.open);assert(evidence.compositionEscape.draftPreserved);assert.deepEqual(evidence.compositionEscape.escapedKeys,[]);
  await evaluate(guest,`document.querySelector('[data-room-password-dialog]').dispatchEvent(new Event('cancel',{cancelable:true}));`);
  assert(await evaluate(guest,`!!document.querySelector('[data-room-password-dialog][open]')`));
  evidence.nativeCancelCompositionGuard=true;
  await evaluate(guest,`document.querySelector('[data-room-password-input]').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'错误中文'}))`);
  await press(guest,'Escape','Escape',27);
  await waitUntil(guest,`!document.querySelector('[data-room-password-dialog]')&&document.activeElement.matches(${JSON.stringify(card)})&&document.activeElement.matches(':enabled')`);
  evidence.escape={closed:true,strictCardFocus:true,escapedKeys:await evaluate(guest,'window.passwordEscapedKeys')};assert.deepEqual(evidence.escape.escapedKeys,[]);
  await open();await fill(guest,'[data-room-password-input]','中文密码');await nativeClick(guest,'[data-room-password-confirm]');
  await waitUntil(guest,`document.querySelector('[data-waiting-room]')&&!document.querySelector('[data-room-password-dialog]')`);evidence.correctChineseJoin=true;
  for(const session of [guest,host]){await waitUntil(session,`document.querySelector('[data-waiting-room] [data-source-control="btnClose"]')?.matches(':enabled')`);await nativeClick(session,'[data-waiting-room] [data-source-control="btnClose"]');await waitUntil(session,`!document.querySelector('[data-waiting-room]')&&document.activeElement.matches('[data-room-card-create]')`);}
  assert(!network.some(r=>r.direction==='sent'&&(r.name==='SelectRole'||r.payload?.operation==='BUY')));
  evidence.noPurchaseSelectRoleReadyOrBattle=true;evidence.status='PASS';console.log('PASS formal Join password rejection, Chinese draft, composition/native Escape isolation, strict card focus and ordinary correct Join/Leave');
  }
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
