import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3459',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-room-password-escape-release-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-password-release-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3459,vite:5489,cdp:9689},runId,resolutions:[],screenshots:[],scope:'UI65/M5-02 password modal native Escape down/up lifetime only; source geometry/Chinese composition/rejection/Join existing evidence reused; no Join/BUY/Ready/send.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3459',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5489,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3459',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9689',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9689/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9689');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['CreateRoom','Join','Leave','ExitRoom','Shop','TankShop','PetShop','SelectRole','Ready'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});


  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5489',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);
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
  await fill(guest,'[data-room-password-input]','中文关闭草稿');
  await evaluate(guest,`window.passwordReleaseKeys=[];window.addEventListener('keydown',e=>window.passwordReleaseKeys.push('down:'+e.code));window.addEventListener('keyup',e=>window.passwordReleaseKeys.push('up:'+e.code));`);
  evidence.before=await evaluate(guest,`({open:!!document.querySelector('[data-room-password-dialog][open]'),activeElement:document.activeElement?.tagName,withinDialog:document.querySelector('[data-room-password-dialog]')?.contains(document.activeElement),draft:document.querySelector('[data-room-password-input]')?.value})`);
  assert(evidence.before.open&&evidence.before.withinDialog);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,modifiers:0},guest);
  evidence.down=await evaluate(guest,`({open:!!document.querySelector('[data-room-password-dialog][open]'),activeElement:document.activeElement?.tagName,withinDialog:document.querySelector('[data-room-password-dialog]')?.contains(document.activeElement),draft:document.querySelector('[data-room-password-input]')?.value,keys:window.passwordReleaseKeys})`);
  assert(evidence.down.open&&evidence.down.withinDialog);assert.equal(evidence.down.draft,evidence.before.draft);assert.deepEqual(evidence.down.keys,[]);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,modifiers:0},guest);
  await waitUntil(guest,`!document.querySelector('[data-room-password-dialog]')&&document.activeElement===document.querySelector(${JSON.stringify(card)})&&document.activeElement.matches(':enabled')`);
  evidence.up=await evaluate(guest,`({closed:!document.querySelector('[data-room-password-dialog]'),strictCard:document.activeElement===document.querySelector(${JSON.stringify(card)}),keys:window.passwordReleaseKeys})`);assert(evidence.up.closed&&evidence.up.strictCard);assert.deepEqual(evidence.up.keys,[]);
  await waitUntil(host,`document.querySelector('[data-waiting-room] [data-source-control="btnClose"]')?.matches(':enabled')`);await nativeClick(host,'[data-waiting-room] [data-source-control="btnClose"]');await waitUntil(host,`!document.querySelector('[data-waiting-room]')&&document.activeElement.matches('[data-room-card-create]')`);
  evidence.hostLeave={strictCreate:true};assert(!network.some(r=>r.direction==='sent'&&(r.name==='Join'||r.name==='Ready'||r.name==='SelectRole'||r.payload?.operation==='BUY')));evidence.noJoinPurchaseReadySend=true;evidence.status='PASS';console.log('PASS room password Escape release '+output);

}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'-server.log',serverLog);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
