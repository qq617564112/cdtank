import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3495',logger:undefined});
const network=[],httpFailures=[];let uiBlocked=false;
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-settings-resource-feedback-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-settings-resource-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];



const evidence={status:'RUNNING',resolutions:[800,1920,3840],screenshots:[],ports:{server:3495,vite:5525,cdp:9725},runId,scope:'UI50/M5-14 source HTTP503 loading feedback and normal Return/reopen same identity; three complete resolutions, zero save/audio/BUY/room'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3495',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'30'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'source-resource-failure',configureServer(server){server.middlewares.use((req,res,next)=>{if(uiBlocked&&req.url?.split('?')[0]==='/ui.json'){httpFailures.push({path:'/ui.json',status:503});res.statusCode=503;res.end('Source resource unavailable');return;}next();});}}],server:{port:5525,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3495',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9725',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9725/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9725');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,error:r.ret.isSucc?undefined:r.ret.err.code}:{operation:r.req?.op})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5525',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const session=pages[0].sessionId;

  const opener='#home-inventory[open] #open-quick-chat-settings';
  await nativeClick(session,'[data-room-card-home]');
  await waitUntil(session,`document.querySelector('${opener}')?.matches(':enabled')&&document.querySelector('#home-inventory [data-source-layout]')`);
  await evaluate(session,`window.settingsResourceBaseline={token:localStorage.getItem('cdtank-account-token'),storage:JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>k!=='cdtank-account-token')))};`);
  uiBlocked=true;
  await nativeClick(session,opener);
  await waitUntil(session,`document.querySelector('#source-settings[open] [data-settings-resource-state="error"]')`);
  assert.equal(httpFailures.length,1,'Real source HTTP503');
  evidence.httpFailures=httpFailures;
  evidence.failed=[];
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
    await waitUntil(session,`Math.abs(document.querySelector('[data-settings-source-page]').getBoundingClientRect().width-800*Math.min(${width}/800,${height}/600))<.2`);
    await evaluate(session,`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    const state=await evaluate(session,`(()=>{const e=document.querySelector('[data-settings-resource-state]'),r=e.getBoundingClientRect();return {width:innerWidth,height:innerHeight,state:e.dataset.settingsResourceState,text:e.textContent,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,returnEnabled:e.querySelector('button').matches(':enabled'),sourceConfirmAbsent:!document.querySelector('[data-settings-confirm]'),sameIdentity:localStorage.getItem('cdtank-account-token')===window.settingsResourceBaseline.token,storageUnchanged:JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>k!=='cdtank-account-token')))===window.settingsResourceBaseline.storage}})()`);
    assert(state.inside&&state.returnEnabled&&state.sourceConfirmAbsent&&state.sameIdentity&&state.storageUnchanged);
    assert(state.text.includes('设置暂时无法显示')&&state.text.includes('请返回后重新打开。')&&!state.text.includes('HTTP')&&!state.text.includes('/ui.json'));
    evidence.failed.push(state);
    const shot=await command('Page.captureScreenshot',{format:'png'},session),path=output+'-'+width+'.png';
    await writeFile(path,Buffer.from(shot.data,'base64'));evidence.screenshots.push(path);
  }
  await nativeClick(session,'[data-settings-resource-return]');
  await waitUntil(session,`!document.querySelector('#source-settings[open]')&&document.activeElement===document.querySelector('${opener}')`);
  evidence.strictReturn=true;
  uiBlocked=false;
  await nativeClick(session,opener);
  await waitUntil(session,`document.querySelector('[data-settings-confirm]')?.matches(':enabled')&&!document.querySelector('[data-settings-resource-state]')`);
  evidence.recovery=await evaluate(session,`({sourceRoot:!!document.querySelector('#source-settings[open] [data-settings-source-page]'),sameIdentity:localStorage.getItem('cdtank-account-token')===window.settingsResourceBaseline.token,storageUnchanged:JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>k!=='cdtank-account-token')))===window.settingsResourceBaseline.storage})`);
  assert(evidence.recovery.sourceRoot&&evidence.recovery.sameIdentity&&evidence.recovery.storageUnchanged);
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},session);
  await waitUntil(session,`Math.abs(document.querySelector('[data-settings-source-page]').getBoundingClientRect().width-1440)<.2`);
  await evaluate(session,`document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))`);
  const recoveredShot=await command('Page.captureScreenshot',{format:'png'},session);
  evidence.recoveryFrame=output+'-recovered-1920.png';await writeFile(evidence.recoveryFrame,Buffer.from(recoveredShot.data,'base64'));

  await nativeClick(session,'[data-settings-close]');
  await waitUntil(session,`!document.querySelector('#source-settings[open]')&&document.activeElement===document.querySelector('${opener}')`);
  await nativeClick(session,'[data-home-close]');
  await waitUntil(session,`!document.querySelector('#home-inventory[open]')&&document.activeElement.matches('[data-room-card-home]')`);
  evidence.strictHomeFocus=true;
  assert(!network.some(n=>n.direction==='sent'&&['CreateRoom','Join','Ready','RoomChat','RoomWhisper','FriendChat','SelectRole','TankTextures'].includes(n.name)));
  assert(!network.some(n=>n.direction==='sent'&&['Shop','TankShop','PetShop','Equipment','Inventory'].includes(n.name)&&n.operation&&n.operation!=='QUERY'));
  evidence.noSaveSendPurchaseRoom=true;evidence.status='PASS';console.log('PASS settings resource feedback '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{if(evidence.status==='FAIL'&&pages.length){const shot=await command('Page.captureScreenshot',{format:'png'},pages[0].sessionId).catch(()=>null);if(shot){evidence.failureFrame=output+'-failure.png';await writeFile(evidence.failureFrame,Buffer.from(shot.data,'base64'));}}if(pages.length)evidence.finalSourceState=await evaluate(pages[0].sessionId,`({settingsOpen:!!document.querySelector('#source-settings[open]'),resourceState:document.querySelector('[data-settings-resource-state]')?.dataset.settingsResourceState,resourceText:document.querySelector('[data-settings-resource-state]')?.textContent,sourceConfirmPresent:!!document.querySelector('[data-settings-confirm]'),activeTag:document.activeElement?.tagName,activeSource:document.activeElement?.dataset.sourceControl,homeOpen:!!document.querySelector('#home-inventory[open]')})`).catch(error=>({readError:String(error)}));evidence.httpFailures=httpFailures;evidence.network=network;await writeFile(output+'-server.log',serverLog);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
