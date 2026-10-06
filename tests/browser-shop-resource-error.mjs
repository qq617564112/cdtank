import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3388',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-shop-resource-error-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-shop-error-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3388,vite:5438,cdp:9638},runId,scope:'UI51/UI53 source shop root survives real directory connection failure; tabs/empty confirmed lists/disabled BUY/native Escape and strict Shop focus. No transactions.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3388',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5438,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3388',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9638',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9638/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9638');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});



  const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
  const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5438',browserContextId});
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
  const s=sessionId;
  await waitUntil(s,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);
  await stop(server);server=undefined;evidence.realServerStopped=true;
  await nativeClick(s,'[data-room-card-shop]');
  await waitUntil(s,`document.querySelector('#account-shop [data-shop-close][data-source-control]')?.matches(':enabled')&&document.querySelector('#account-shop').getAttribute('aria-busy')==='false'&&document.querySelector('[data-shop-status]')?.textContent&&!document.querySelector('[data-shop-status]').textContent.includes('载入商店')`);
  evidence.initial=await evaluate(s,`(()=>{const root=document.querySelector('#account-shop');return {page:root.querySelector('[data-shop-page]').dataset.shopActivePage,status:root.querySelector('[data-shop-status]').textContent,sourceClose:root.querySelector('[data-shop-close]').getAttribute('data-source-layout'),withinDialog:root.contains(document.activeElement),focusedClose:document.activeElement.matches('[data-shop-close]'),buyDisabled:root.querySelector('[data-shop-buy]').disabled,productCount:root.querySelectorAll('[data-shop-product-id]').length,ownedCount:root.querySelectorAll('[data-shop-owned-instance]').length,loadingClose:!!root.querySelector('.shop-loading-close')}})()`);
  assert.equal(evidence.initial.page,'Item');assert.equal(evidence.initial.sourceClose,'ui/layouts/shop.xml');assert(evidence.initial.withinDialog&&evidence.initial.focusedClose);assert(evidence.initial.buyDisabled);assert.equal(evidence.initial.productCount,0);assert.equal(evidence.initial.ownedCount,0);assert(!evidence.initial.loadingClose);
  if(!process.argv.includes('--keyboard-only')){
  evidence.errorViewport=await evaluate(s,`(()=>{const e=document.querySelector('[data-shop-status]'),r=e.getBoundingClientRect();return {text:e.textContent,insideViewport:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,colour:getComputedStyle(e).color,background:getComputedStyle(e).backgroundColor}})()`);assert(evidence.errorViewport.insideViewport,'Entire error feedback area must fit viewport');
  const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-item-error-1920.png',Buffer.from(shot.data,'base64'));
  }
  if(!process.argv.includes('--readability-only')){
  await nativeClick(s,'[data-shop-root-category="Pet"]');await waitUntil(s,`document.querySelector('[data-shop-active-page="Pet"]')&&document.querySelector('#account-shop').getAttribute('aria-busy')==='false'`);
  evidence.petSourceRoot=await evaluate(s,`!!document.querySelector('#account-shop [data-shop-close][data-source-control]')&&!!document.querySelector('[data-shop-active-page="Pet"] [data-source-control="ditukuang"]')`);assert(evidence.petSourceRoot);
  await nativeClick(s,'[data-shop-root-category="Item"]');await waitUntil(s,`document.querySelector('[data-shop-active-page="Item"]')&&document.querySelector('#account-shop').getAttribute('aria-busy')==='false'`);
  }
  evidence.beforeEscape=await evaluate(s,`(()=>{const e=document.activeElement;return {tag:e.tagName,source:e.getAttribute('data-source-control'),withinDialog:document.querySelector('#account-shop').contains(e),busy:document.querySelector('#account-shop').getAttribute('aria-busy')}})()`);
  assert(evidence.beforeEscape.withinDialog,'Refresh commit must keep focus inside source shop');
  await evaluate(s,`window.shopErrorEscapedKeys=[];window.addEventListener('keydown',e=>window.shopErrorEscapedKeys.push(e.code))`);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);
  await waitUntil(s,`!document.querySelector('#account-shop')&&document.activeElement.matches('[data-room-card-shop]')&&document.activeElement.matches(':enabled')`);
  evidence.escape={keys:await evaluate(s,'window.shopErrorEscapedKeys'),closed:true,strictShopFocus:true};assert.deepEqual(evidence.escape.keys,[]);
  assert(!network.some(r=>r.direction==='sent'&&(r.name==='SelectRole'||r.payload?.operation==='BUY'||r.name==='Equipment'&&r.payload?.operation!=='QUERY')));evidence.noPurchaseOrConfiguration=true;evidence.status='PASS';console.log('PASS shop source root/empty lists/disabled BUY after real connection failure, Pet/Item tabs/native Escape/no leak/strict Shop focus');
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
