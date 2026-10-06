import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3387',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-home-role-resource-error-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-role-error-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3387,vite:5437,cdp:9637},runId,scope:'UI32/UI34 original Home role roots retained after actual transport query failure; source tabs, readable error, native Escape/strict Home focus. Zero purchase/configuration.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3387',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5437,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3387',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9637',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9637/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9637');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
  const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5437',browserContextId});
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
  const s=sessionId;
  await waitUntil(s,`document.querySelector('[data-room-card-create]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);
  await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('[data-home-name-open]')?.matches(':enabled')`);
  await stop(server);server=undefined;evidence.realServerStopped=true;
  await nativeClick(s,'#home-inventory [data-role-tab="tank"]');
  await waitUntil(s,`document.querySelector('#home-roles [data-roles-close]')?.matches(':enabled')&&!document.querySelector('#home-roles').getAttribute('aria-busy').includes('true')&&document.querySelector('.home-role-status')?.textContent.includes('角色资料读取失败')`);
  const error=await evaluate(s,`document.querySelector('.home-role-status').textContent`);evidence.roots=[];
  for(const kind of ['tank','pet']){
    if(kind==='pet')await nativeClick(s,'#home-roles [data-role-tab="pet"]');
    await waitUntil(s,`document.querySelector('[data-home-role-page="${kind}"] [data-source-control="${kind==='tank'?'txtTankName':'txtPetName'}"]')`);
    const actual=await evaluate(s,`(()=>{const root=document.querySelector('#home-roles'),name=root.querySelector('[data-source-control="${kind==='tank'?'txtTankName':'txtPetName'}"]');return {page:root.querySelector('[data-home-role-page]').dataset.homeRolePage,error:root.querySelector('.home-role-status').textContent,sourceClose:root.querySelector('[data-roles-close]').getAttribute('data-source-layout'),tabsEnabled:[...root.querySelectorAll('[data-role-tab]')].every(e=>!e.disabled),blankName:name.textContent,ownedCount:root.querySelectorAll('[data-owned-role]').length,preview:!!root.querySelector('[data-role-preview],[data-home-pet-preview]'),loadingClose:!!root.querySelector('.home-loading-close')}})()`);
    assert.equal(actual.error,error);assert(actual.tabsEnabled);assert.equal(actual.blankName,'');assert.equal(actual.ownedCount,0);assert(!actual.preview&&!actual.loadingClose);assert.equal(actual.sourceClose,'ui/layouts/myhome.xml');evidence.roots.push(actual);
  }
  const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-pet-error-1920.png',Buffer.from(shot.data,'base64'));
  await evaluate(s,`window.roleErrorEscapedKeys=[];window.addEventListener('keydown',e=>window.roleErrorEscapedKeys.push(e.code))`);
  const before=await evaluate(s,`document.querySelector('#home-roles').contains(document.activeElement)`);assert(before);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);
  await waitUntil(s,`!document.querySelector('#home-roles')&&document.activeElement.matches('[data-room-card-home]')&&document.activeElement.matches(':enabled')`);
  evidence.escape={beforeWithinDialog:before,keys:await evaluate(s,'window.roleErrorEscapedKeys'),closed:true,strictHomeFocus:true};assert.deepEqual(evidence.escape.keys,[]);
  assert(!network.some(r=>r.direction==='sent'&&(r.name==='SelectRole'||r.payload?.operation==='BUY'||r.name==='Equipment'&&r.payload?.operation!=='QUERY')));evidence.noPurchaseOrConfiguration=true;evidence.status='PASS';console.log('PASS actual disconnected query failure preserves source tank/pet roots/error/tabs and native Escape/strict Home focus');
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
