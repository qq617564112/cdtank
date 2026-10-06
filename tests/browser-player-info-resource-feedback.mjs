import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3520',logger:undefined});
const network=[],accountIds=new Map(),httpFailures=[],markers=[];let uiBlocked=true;
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-player-info-resource-feedback-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-player-info-resource-feedback-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={httpFailures,markers,status:'RUNNING',ports:{server:3520,vite:5550,cdp:9750},runId,scope:'UI42/M5-13 friendly source error presentation only; one1920 real503/Close opener/same-token normal source reopen; no relationship writes/room/send/BUY.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3520',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'player-info-targeted-layout-error',configureServer(server){server.middlewares.use((req,res,next)=>{if(uiBlocked&&req.url==='/ui.json?player-info-resource-test'){httpFailures.push({status:503,url:req.url});res.statusCode=503;res.end('Unavailable');return;}next();});},transform(source,id){if(!id.endsWith('/interface/lobby/source-react.tsx'))return;const pattern=/fetch\((['"])\/ui\.json\1\)/g,matches=source.match(pattern)??[],replaced=source.replace(pattern,'fetch(suffixKey === "playerlist_playerinfo.xml" ? "/ui.json?player-info-resource-test" : "/ui.json")');markers.push({matches:matches.length,replacementApplied:replaced!==source});assert.equal(matches.length,1);return replaced;}}],server:{port:5550,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3520',ws:true,rewrite:()=> '/'}}}});await vite.listen();await vite.transformRequest('/src/interface/lobby/source-react.tsx');assert(markers.some(m=>m.matches===1&&m.replacementApplied),'PreChrome targeted marker');
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9750',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9750/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9750');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(r.service.name==='Account'&&r.ret?.isSucc)accountIds.set(m.sessionId,r.ret.res.accountId);if(['Friends','Blacklist','Equipment','Inventory','Shop','TankShop','PetShop','SelectRole','CreateRoom','Join','Ready','AddCpu','RoomChat','RoomWhisper','FriendChat'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});



  for(let i=0;i<2;i++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Network.enable',{},sessionId);await command('Page.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await command('Page.navigate',{url:'http://127.0.0.1:5550'},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-home]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);
  }
  const s=pages[0].sessionId,targetId=accountIds.get(pages[1].sessionId);assert(targetId);assert(accountIds.get(s)!==targetId,'Distinct ordinary account identities');
  const row='[data-lobby-player-account="'+targetId+'"]';await waitUntil(s,`document.querySelector(${JSON.stringify(row)})`);
  await evaluate(s,`window.playerInfoBaselineToken=localStorage.getItem('cdtank-account-token');if(!window.playerInfoBaselineToken)throw new Error('Normal identity missing')`);
  async function openInfo(){await nativeClick(s,row);const point=await evaluate(s,`(()=>{const e=document.querySelector(${JSON.stringify(row)}),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'right',clickCount:1,...point},s);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'right',clickCount:1,...point},s);await waitUntil(s,`document.querySelector('[data-player-info]')?.open`);}
  await openInfo();{const deadline=Date.now()+3000;while(!httpFailures.length&&Date.now()<deadline)await new Promise(r=>setTimeout(r,20));assert.equal(httpFailures.length,1,'Real targeted sourceHTTP503');}
  await waitUntil(s,`document.querySelector('[data-player-info-resource-state="error"]')&&document.querySelector('[data-player-info-close]')?.matches(':enabled')`);
  await evaluate(s,`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
  evidence.failure=await evaluate(s,`(()=>{const e=document.querySelector('[data-player-info-resource-state]'),r=e.getBoundingClientRect(),b=e.querySelector('button'),br=b.getBoundingClientRect();return {text:e.textContent,status:document.querySelector('[data-player-info-status]').textContent,viewport:[innerWidth,innerHeight],inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,closeHit:b.contains(document.elementFromPoint(br.x+br.width/2,br.y+br.height/2)),withinDialog:document.querySelector('[data-player-info]').contains(document.activeElement),closeCount:document.querySelectorAll('[data-player-info-close]').length,sameToken:localStorage.getItem('cdtank-account-token')===window.playerInfoBaselineToken,sourceCloseAbsent:!document.querySelector('[data-player-info-close][data-source-control]')}})()`);
  assert(evidence.failure.inside&&evidence.failure.closeHit&&evidence.failure.sameToken&&evidence.failure.sourceCloseAbsent&&evidence.failure.withinDialog);assert.equal(evidence.failure.closeCount,1);assert(evidence.failure.text.includes('玩家资料暂时无法显示'));assert(!/HTTP|ui.json/.test(evidence.failure.text+evidence.failure.status));
  const shot=await command('Page.captureScreenshot',{format:'png'},s);evidence.screenshot=output+'-1920.png';await writeFile(evidence.screenshot,Buffer.from(shot.data,'base64'));
  async function closeInfo(){await nativeClick(s,'[data-player-info-close]');await waitUntil(s,`!document.querySelector('[data-player-info]')&&document.activeElement.matches(${JSON.stringify(row)})&&document.activeElement.matches(':enabled')`);}
  await closeInfo();evidence.strictErrorClose=true;uiBlocked=false;await openInfo();await waitUntil(s,`document.querySelector('[data-player-info-close][data-source-control="btnClose"]')&&!document.querySelector('[data-player-info-resource-state]')`);
  evidence.recovered=await evaluate(s,`({sameToken:localStorage.getItem('cdtank-account-token')===window.playerInfoBaselineToken,sourceClose:document.querySelector('[data-player-info-close]').dataset.sourceLayout,sourceName:document.querySelector('[data-source-control="txtPlayerName"]').textContent,errorAbsent:!document.querySelector('[data-player-info-resource-state]')})`);assert(evidence.recovered.sameToken&&evidence.recovered.errorAbsent);assert.equal(evidence.recovered.sourceClose,'ui/layouts/playerlist_playerinfo.xml');
  await closeInfo();evidence.strictRecoveredClose=true;
  const mutations=network.filter(n=>n.direction==='sent'&&((['Friends','Blacklist','Equipment','Inventory','Shop','TankShop','PetShop'].includes(n.name)&&n.payload?.operation!=='QUERY')||['SelectRole','CreateRoom','Join','Ready','AddCpu','RoomChat','RoomWhisper','FriendChat'].includes(n.name)));assert.equal(mutations.length,0);evidence.noRelationshipRoomSendPurchaseWrite=true;evidence.status='PASS';console.log('PASS PlayerInfo resource feedback '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{if(evidence.status==='FAIL'&&pages.length){try{const shot=await command('Page.captureScreenshot',{format:'png'},pages[0].sessionId);evidence.failureFrame=output+'-failure.png';await writeFile(evidence.failureFrame,Buffer.from(shot.data,'base64'));}catch{}}evidence.network=network;await writeFile(output+'-server.log',serverLog);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={serverStopped:server?.exitCode!==null||server?.signalCode!==null,chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
