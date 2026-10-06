import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3522',logger:undefined});
const network=[],accountIds=new Map(),httpFailures=[],markers=[];let uiBlocked=true;
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-home-award-summary-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-award-summary-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={httpFailures,markers,status:'RUNNING',ports:{server:3522,vite:5552,cdp:9752},runId,scope:'UI37/M5-09 complete source award region/radio at three resolutions; nine counters empty and unbound, existing History owner retained; no account writes/room/BUY.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3522',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5552,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3522',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9752',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9752/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9752');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(r.service.name==='Account'&&r.ret?.isSucc)accountIds.set(m.sessionId,r.ret.res.accountId);if(['History','Kitbag','DisplayName','Friends','Blacklist','Equipment','Inventory','Shop','TankShop','PetShop','SelectRole','CreateRoom','Join','Ready','AddCpu','RoomChat','RoomWhisper','FriendChat'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});



  for(let i=0;i<1;i++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Network.enable',{},sessionId);await command('Page.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await command('Page.navigate',{url:'http://127.0.0.1:5552'},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-home]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);
  }
  const s=pages[0].sessionId;
  await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('#home-inventory[open] [data-home-award-summary-tab]')?.matches(':enabled')&&document.querySelector('[data-home-saved-summary]')?.getAttribute('aria-busy')==='false'`);
  await evaluate(s,`(()=>{window.homeAwardSavedNode=document.querySelector('[data-home-saved-summary]');return true})()`);
  const historyRequests=network.filter(n=>n.direction==='sent'&&n.name==='History').length;evidence.initialHistoryRequests=historyRequests;
  await nativeClick(s,'[data-home-award-summary-tab]');await waitUntil(s,`document.querySelector('[data-home-award-summary]')&&document.querySelector('[data-home-award-summary-tab]').getAttribute('aria-pressed')==='true'`);
  evidence.states=[];evidence.screenshots=[];
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    const scale=Math.min(width/800,height/600);await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    await waitUntil(s,`Math.abs(document.querySelector('.home-inventory-stage').getBoundingClientRect().width-625*${scale})<.2`);
    await evaluate(s,`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
    const state=await evaluate(s,`(()=>{const e=document.querySelector('[data-home-award-summary]'),r=e.getBoundingClientRect();return {viewport:[innerWidth,innerHeight],controls:[...e.querySelectorAll('[data-source-control]')].map(c=>({name:c.dataset.sourceControl,asset:c.dataset.sourceAsset,rect:c.getBoundingClientRect().toJSON()})),pictures:[...e.querySelectorAll('[data-source-image][data-source-asset]')].map(c=>({asset:c.dataset.sourceAsset,background:getComputedStyle(c).backgroundImage})),counters:[...e.querySelectorAll('[data-home-award-counter]')].map(c=>({name:c.dataset.homeAwardCounter,text:c.textContent,unbound:c.hasAttribute('data-home-award-unbound')})),awardSelected:document.querySelector('[data-home-award-summary-tab]').getAttribute('aria-pressed')==='true',battleSelected:document.querySelector('[data-home-saved-summary-tab]').getAttribute('aria-pressed')==='true',savedNodeRetained:document.querySelector('[data-home-saved-summary]')===window.homeAwardSavedNode,savedHidden:document.querySelector('[data-home-summary-battle-slot]').hidden,savedRect:window.homeAwardSavedNode.getBoundingClientRect().toJSON(),region:{x:r.x,y:r.y,width:r.width,height:r.height}}})()`);
    evidence.states.push(state);assert.equal(state.controls.length,20);assert.equal(state.pictures.length,10);assert.equal(state.counters.length,9);assert(state.counters.every(c=>c.text===''&&c.unbound));assert(state.awardSelected&&!state.battleSelected&&state.savedNodeRetained&&state.savedHidden&&state.savedRect.width===0);
    const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+width+'.png';await writeFile(path,Buffer.from(shot.data,'base64'));evidence.screenshots.push(path);
  }
  await nativeClick(s,'[data-home-saved-summary-tab]');await waitUntil(s,`document.querySelector('[data-home-saved-summary-tab]').getAttribute('aria-pressed')==='true'&&!document.querySelector('[data-home-award-summary]')`);
  evidence.historyRetained=await evaluate(s,`({sameNode:document.querySelector('[data-home-saved-summary]')===window.homeAwardSavedNode,visible:window.homeAwardSavedNode.getBoundingClientRect().width>0,awardSelected:document.querySelector('[data-home-award-summary-tab]').getAttribute('aria-pressed')==='true'})`);assert(evidence.historyRetained.sameNode&&evidence.historyRetained.visible&&!evidence.historyRetained.awardSelected);assert.equal(network.filter(n=>n.direction==='sent'&&n.name==='History').length,historyRequests);
  await nativeClick(s,'[data-home-close]');await waitUntil(s,`!document.querySelector('#home-inventory[open]')&&document.activeElement.matches('[data-room-card-home]')`);evidence.strictHomeOpener=true;
  assert(!network.some(n=>n.direction==='sent'&&(['Kitbag','SelectRole','CreateRoom','Join','Ready','AddCpu','RoomChat','RoomWhisper','FriendChat'].includes(n.name)||(['Shop','TankShop','PetShop','Equipment','Friends','Blacklist'].includes(n.name)&&n.payload?.operation!=='QUERY')||(n.name==='DisplayName'&&n.payload?.name!==undefined))));evidence.noAccountRoomSendPurchaseWrite=true;evidence.status='PASS';console.log('PASS Home award summary '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{if(evidence.status==='FAIL'&&pages.length){try{const shot=await command('Page.captureScreenshot',{format:'png'},pages[0].sessionId);evidence.failureFrame=output+'-failure.png';await writeFile(evidence.failureFrame,Buffer.from(shot.data,'base64'));}catch{}}evidence.network=network;await writeFile(output+'-server.log',serverLog);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={serverStopped:server?.exitCode!==null||server?.signalCode!==null,chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
