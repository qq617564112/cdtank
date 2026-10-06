import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3512',logger:undefined});
const network=[];let uiBlocked=true;const httpFailures=[],transformMarkers=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-waiting-room-resource-feedback-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-waiting-resource-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={httpFailures,transformMarkers,status:'RUNNING',ports:{server:3512,vite:5542,cdp:9742},runId,scope:'UI44/M5-03 waiting layout HTTP503 feedback/three resolutions/Return same-token recovery; normal Create and Leave only, no Ready/chat/BUY.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3512',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'300'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'readonly-resource-ready',configureServer(server){server.middlewares.use((req,res,next)=>{if(uiBlocked&&req.url==='/ui.json?waiting-resource-test'){httpFailures.push({url:req.url,status:503});res.statusCode=503;res.end('Resource unavailable');return;}next();});},transform(source,id){if(id.endsWith('/interface/lobby/waiting-room.tsx')){const pattern=/fetch\((['"])\/ui\.json\1,/g,matches=source.match(pattern)??[];const replaced=source.replace(pattern,'fetch("/ui.json?waiting-resource-test",');transformMarkers.push({id,matches:matches.length,replacementApplied:replaced!==source});assert.equal(matches.length,1,'One waiting layout marker');assert.notEqual(replaced,source);return replaced;}if(id.endsWith('/src/match/battle.ts'))return source+'\nconst modeOldQuick=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.modeReadinessBattle=this;return modeOldQuick.call(this,value);};';}}],server:{port:5542,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3512',ws:true,rewrite:()=> '/'}}}});await vite.listen();await vite.transformRequest('/src/interface/lobby/waiting-room.tsx');assert(transformMarkers.some(m=>m.matches===1),'Marker matched before Chromium or room transaction');
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9742',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9742/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9742');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['RoomSnapshot','Cpu','CreateRoom','Join','Leave','ExitRoom','Ready','AddCpu','RoomChat','RoomWhisper','FriendChat','PlayerInput','Shop','TankShop','SelectRole'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});




  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5542'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')?.matches(':enabled')`);
  }
  const s=pages[0].sessionId;
  await evaluate(s,`window.waitingResourceToken=localStorage.getItem('cdtank-account-token');if(!window.waitingResourceToken)throw new Error('Normal account token absent')`);
  async function create(){await nativeClick(s,'[data-room-card-create]');await waitUntil(s,`document.querySelector('[data-map-selector-map="7"]')?.matches(':enabled')`);await nativeClick(s,'[data-map-selector-map="7"]');await nativeClick(s,'[data-map-selector-confirm]');await waitUntil(s,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);await nativeClick(s,'[data-room-create-confirm]');await waitUntil(s,`document.querySelector('[data-formal-waiting-page]')&&!document.querySelector('[data-room-create-dialog][open]')`);await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);}
  async function identity(){return evaluate(s,`localStorage.getItem('cdtank-account-token')===window.waitingResourceToken`);}
  await create();
  {const deadline=Date.now()+3000;while(!httpFailures.length&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));assert(httpFailures.length>0,'Targeted real HTTP503 must occur before UI wait');}
  await waitUntil(s,`(()=>{const e=document.querySelector('[data-waiting-resource-return]');if(!e?.matches(':enabled')||document.querySelector('[data-room-create-dialog][open]'))return false;const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()`);
  evidence.httpFailures=httpFailures;assert.equal(httpFailures.length,1,'One targeted waiting layout HTTP503');
  evidence.roomCreated=await evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);assert(evidence.roomCreated);
  evidence.failed=[];evidence.screenshots=[];
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    const scale=Math.min(width/800,height/600);
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    await waitUntil(s,`Math.abs(document.querySelector('[data-waiting-room-stage]').getBoundingClientRect().width-615*${scale})<.2`);
    await evaluate(s,`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
    const state=await evaluate(s,`(()=>{const e=document.querySelector('[data-waiting-resource-state]'),r=e.getBoundingClientRect(),button=e.querySelector('button'),br=button.getBoundingClientRect();return {viewport:[innerWidth,innerHeight],text:e.textContent,status:document.querySelector('[data-waiting-room-status]').textContent,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,buttonInside:br.left>=r.left&&br.right<=r.right&&br.top>=r.top&&br.bottom<=r.bottom,enabled:button.matches(':enabled'),createDialogClosed:!document.querySelector('[data-room-create-dialog][open]'),returnHit:button.contains(document.elementFromPoint(br.x+br.width/2,br.y+br.height/2)),sourceCloseAbsent:!document.querySelector('[data-waiting-close]'),sameToken:localStorage.getItem('cdtank-account-token')===window.waitingResourceToken,roomId:JSON.parse(document.querySelector('#battle-status').dataset.world).roomId}})()`);
    evidence.failed.push(state);assert(state.inside&&state.buttonInside&&state.enabled&&state.createDialogClosed&&state.returnHit&&state.sourceCloseAbsent&&state.sameToken);assert.equal(state.roomId,evidence.roomCreated);assert(state.text.includes('等待房间暂时无法显示')&&state.text.includes('返回大厅'));assert(!/HTTP|ui.json|Escape/.test(state.text+state.status));
    const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+width+'.png';await writeFile(path,Buffer.from(shot.data,'base64'));evidence.screenshots.push(path);
  }
  await nativeClick(s,'[data-waiting-resource-return]');await waitUntil(s,`!document.querySelector('[data-formal-waiting-page]')&&document.activeElement.matches('[data-room-card-create]')&&document.activeElement.matches(':enabled')`);evidence.strictReturn=true;assert(await identity());
  uiBlocked=false;await create();await waitUntil(s,`document.querySelector('[data-waiting-close]')?.matches(':enabled')&&!document.querySelector('[data-waiting-resource-state]')`);
  evidence.recovered={sameToken:await identity(),sourceClose:true,errorAbsent:true};assert(evidence.recovered.sameToken);
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('[data-waiting-room-stage]').getBoundingClientRect().width-1107)<.2`);await evaluate(s,`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
  const recovered=await command('Page.captureScreenshot',{format:'png'},s);evidence.recoveredFrame=output+'-recovered-1920.png';await writeFile(evidence.recoveredFrame,Buffer.from(recovered.data,'base64'));
  await nativeClick(s,'[data-waiting-close]');await waitUntil(s,`!document.querySelector('[data-formal-waiting-page]')&&document.activeElement.matches('[data-room-card-create]')&&document.activeElement.matches(':enabled')`);evidence.finalStrictCreate=true;
  assert(!network.some(n=>n.direction==='sent'&&['Ready','AddCpu','RoomChat','RoomWhisper','FriendChat','Shop','TankShop','SelectRole','Join'].includes(n.name)));evidence.noReadySendBuy=true;evidence.status='PASS';console.log('PASS waiting resource '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{if(evidence.status==='FAIL'&&pages.length){try{const shot=await command('Page.captureScreenshot',{format:'png'},pages[0].sessionId);evidence.failureFrame=output+'-failure.png';await writeFile(evidence.failureFrame,Buffer.from(shot.data,'base64'));}catch{}}if(evidence.status==='FAIL'&&pages.length){try{const s=pages[0].sessionId;if(await evaluate(s,`!!document.querySelector('[data-waiting-resource-return], [data-waiting-close]')`)){await nativeClick(s,'[data-waiting-resource-return], [data-waiting-close]');await waitUntil(s,`!document.querySelector('[data-formal-waiting-page]')&&document.activeElement.matches('[data-room-card-create]')`);evidence.failureNormalLeave=true;}}catch(error){evidence.failureLeaveError=String(error);}}evidence.runtime=[];for(const p of pages){try{evidence.runtime.push(await evaluate(p.sessionId,`(()=>{const b=window.modeReadinessBattle;return {resourcesReady:b?.players.resourcesReady,loadingError:b?.players.loadingError,mapLoaded:b?.mapLoaded,world:!!b?.world}})()`));}catch(error){evidence.runtime.push({error:String(error)});}}evidence.network=network;await writeFile(output+'-server.log',serverLog);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={serverStopped:server?.exitCode!==null||server?.signalCode!==null,chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
