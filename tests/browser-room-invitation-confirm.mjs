import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3427',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-room-invitation-confirm-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-room-intimate-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3427,vite:5457,cdp:9657},runId,scope:'UI06 source seven-control invitation confirmation; three ordinary accounts, formal Create/Invite/cancel/password Join rejection and success; no Ready/BUY/send.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3427',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'300'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'readonly-resource-ready',transform(source,id){if(id.endsWith('/src/match/battle.ts'))return source+'\nconst modeOldQuick=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.modeReadinessBattle=this;return modeOldQuick.call(this,value);};';}}],server:{port:5457,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3427',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9657',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9657/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9657');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['RoomInvite','RoomInvitation','RoomSnapshot','Cpu','CreateRoom','Join','Leave','ExitRoom','Ready','AddCpu','RoomChat','RoomWhisper','FriendChat','PlayerInput','Shop','TankShop','SelectRole'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});




  for(let index=0;index<3;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5457'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')?.matches(':enabled')`);
  }
  const recipient=pages[2].sessionId;
  async function key(p,key,code,vk,text){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,...(text?{text}: {})},p);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk},p);}
  async function create(p,password){
    await nativeClick(p,'[data-room-card-create]');await waitUntil(p,`document.querySelector('[data-map-selector-map="7"]')`);await nativeClick(p,'[data-map-selector-map="7"]');await nativeClick(p,'[data-map-selector-confirm]');await waitUntil(p,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);
    if(password){await nativeClick(p,'[data-room-create-password]');await command('Input.insertText',{text:password},p);}
    await nativeClick(p,'[data-room-create-confirm]');await waitUntil(p,`document.querySelector('[data-formal-waiting-page]')&&!document.querySelector('dialog[data-room-create-dialog]')&&document.querySelector('[data-waiting-invite]')?.matches(':enabled')`);
  }
  await evaluate(recipient,`window.confirmEscaped=[];window.addEventListener('keydown',e=>window.confirmEscaped.push(e.code));`);
  const password='confirm-secret';await create(pages[1].sessionId,password);
  await nativeClick(pages[1].sessionId,'[data-waiting-invite]');await waitUntil(recipient,`document.querySelector('[data-source-confirm]')?.open&&document.querySelector('[data-source-confirm-ok]')?.matches(':enabled')`);
  if (!process.argv.includes('--join-only')) {
  evidence.resolutions=[];
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},recipient);
    await waitUntil(recipient,`Math.abs(document.querySelector('[data-source-confirm]').getBoundingClientRect().width-315*Math.min(${width}/800,${height}/600))<.2`);
    const result=await evaluate(recipient,`(async()=>{const d=document.querySelector('[data-source-confirm]'),box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,inside:r.left>=-.2&&r.top>=-.2&&r.right<=innerWidth+.2&&r.bottom<=innerHeight+.2}};await Promise.all([...d.querySelectorAll('[data-source-asset]')].filter(e=>e.dataset.sourceAsset).map(e=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=reject;i.src='/'+e.dataset.sourceAsset;})));return {width:innerWidth,height:innerHeight,binding:d.dataset.confirmBinding,controls:[...d.querySelectorAll('[data-source-control]')].map(e=>({name:e.dataset.sourceControl,box:box(e)})),frameCount:d.querySelectorAll('[data-source-frame]').length,message:d.querySelector('[data-source-control="txtMessage"]').textContent,focus:document.activeElement.matches('[data-source-confirm-cancel]')};})()`);
    assert.equal(result.controls.length,7);assert(result.controls.filter(c=>c.name!=='picBackgroundMask').every(c=>c.box.inside));evidence.resolutions.push(result);
    const shot=await command('Page.captureScreenshot',{format:'png'},recipient);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},recipient);await waitUntil(recipient,`Math.abs(document.querySelector('[data-source-confirm]').getBoundingClientRect().width-567)<.2`);
  const selector='[data-source-confirm-cancel]',point=await evaluate(recipient,`(()=>{const r=document.querySelector('${selector}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const read=()=>evaluate(recipient,`(()=>{const e=document.querySelector('${selector}');return {state:e.dataset.sourceButtonState,capture:e.hasPointerCapture(1),pushed:e.dataset.sourcePushed,open:document.querySelector('[data-source-confirm]').open}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:0,button:'none',...point},recipient);await command('Input.dispatchMouseEvent',{type:'mousePressed',buttons:1,button:'left',modifiers:16,clickCount:1,...point},recipient);await waitUntil(recipient,`document.querySelector('${selector}').dataset.sourcePushed==='true'`);evidence.pressed=await read();assert(evidence.pressed.capture);
  const outside={x:point.x+190,y:point.y-160};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,...outside},recipient);evidence.outside=await read();assert(evidence.outside.capture);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...outside},recipient);await waitUntil(recipient,`document.querySelector('${selector}').dataset.sourcePushed==='false'`);evidence.release=await read();assert.equal(evidence.release.state,'Normal');assert(!evidence.release.capture&&evidence.release.open);
  await nativeClick(recipient,'[data-source-confirm-ok]');await waitUntil(recipient,`document.querySelector('[data-room-password-dialog]')?.open`);
  await nativeClick(recipient,'[data-room-password-cancel]');await waitUntil(recipient,`document.querySelector('[data-source-confirm]')?.open&&document.activeElement.matches('[data-source-confirm-cancel]')`);evidence.passwordCancel={sameInvitation:true,strictConfirmFocus:true};
  await nativeClick(recipient,'[data-source-confirm-ok]');await waitUntil(recipient,`document.querySelector('[data-room-password-input]')?.matches(':enabled')`);await nativeClick(recipient,'[data-room-password-input]');await command('Input.insertText',{text:'wrong'},recipient);await nativeClick(recipient,'[data-room-password-confirm]');await waitUntil(recipient,`document.querySelector('[data-room-password-status]').textContent.includes('密码')&&document.activeElement.matches('[data-room-password-input]')`);
  evidence.rejected={draft:await evaluate(recipient,`document.querySelector('[data-room-password-input]').value`),focus:true,response:network.filter(n=>n.page===recipient&&n.name==='Join'&&n.direction==='received').at(-1)};assert.equal(evidence.rejected.draft,'wrong');assert.equal(evidence.rejected.response.success,false);
  } else {await nativeClick(recipient,'[data-source-confirm-ok]');await waitUntil(recipient,`document.querySelector('[data-room-password-input]')?.matches(':enabled')`);await nativeClick(recipient,'[data-room-password-input]');}
  await key(recipient,'Home','Home',36);await command('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},recipient);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},recipient);await command('Input.insertText',{text:password},recipient);assert.equal(await evaluate(recipient,`document.querySelector('[data-room-password-input]').value`),password);await nativeClick(recipient,'[data-room-password-confirm]');await waitUntil(recipient,`document.querySelector('[data-formal-waiting-page]')&&!document.querySelector('[data-source-confirm]')&&!document.querySelector('[data-room-password-dialog]')`);evidence.joined={success:true,response:network.filter(n=>n.page===recipient&&n.name==='Join'&&n.direction==='received').at(-1)};
  evidence.cleanup=[];for(const p of [recipient,pages[1].sessionId]){await nativeClick(p,'[data-waiting-close]');await waitUntil(p,`!document.querySelector('[data-formal-waiting-page]')&&document.activeElement.matches('[data-room-card-create]')`);evidence.cleanup.push({strictCreate:true});}
  assert(!network.some(n=>n.direction==='sent'&&['Ready','Shop','TankShop','SelectRole','RoomChat','RoomWhisper','FriendChat'].includes(n.name)));evidence.consumerEvidenceReused='recovery/output/browser-room-invitation-confirm-2026-10-04T23-03-28-377Z.json';evidence.escapeReused='recovery/output/browser-room-invitation-confirm-2026-10-04T23-02-04-467Z.json';evidence.noReadyBuySend=true;evidence.status='PASS';console.log('PASS room invitation confirm '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
