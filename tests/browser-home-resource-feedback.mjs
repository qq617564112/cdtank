import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {DatabaseSync, backup} from 'node:sqlite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3481',logger:undefined});
const network=[],httpFailures=[];let uiBlocked=false;
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-home-resource-feedback-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-resource-'));
const database=join(directory,'accounts.sqlite');
const equipmentOnly=process.argv.includes('--equipment-recovery-only');
let fixture,checkpoint;
if(equipmentOnly){fixture=JSON.parse(await readFile('recovery/output/home-tank-active-marker-browser-fixture.json','utf8'));checkpoint=fixture.database??'recovery/output/home-tank-active-marker-browser.sqlite';const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}}
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3481,vite:5511,cdp:9711},runId,scope:'M5-07/M5-08/M5-09 Home resource503 feedback isolated from successful Account queries; three ordinary entry paths, one fallback3res and nativeReturn/reopen same identity; no purchase/equip/role selection/room.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3481',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'300'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'readonly-resource-ready',configureServer(server){server.middlewares.use((req,res,next)=>{if(uiBlocked&&req.url?.split('?')[0]==='/ui.json'){httpFailures.push({path:'/ui.json',status:503});res.statusCode=503;res.end('Source resource unavailable');return;}next();});},transform(source,id){if(id.endsWith('/src/match/battle.ts'))return source+'\nconst modeOldQuick=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.modeReadinessBattle=this;return modeOldQuick.call(this,value);};';}}],server:{port:5511,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3481',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9711',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9711/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9711');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(r.service.name==='Account'&&received&&r.ret?.isSucc)network.push({page:m.sessionId,direction:'received',name:'AccountIdentity',accountId:r.ret.res.accountId});if(['Inventory','Equipment','OwnedRoles','RoleProfile','DisplayName','Kitbag','PetShop','CreateRoom','Join','Ready','Shop','TankShop','SelectRole'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc}:{payload:r.msg??r.req})});});





  const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
  const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
  const {sessionId:page}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId:page});
  await command('Page.enable',{},page);await command('Network.enable',{},page);if(equipmentOnly)await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},page);await command('Page.navigate',{url:'http://127.0.0.1:5511'},page);
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},page);
  await waitUntil(page,`document.querySelector('[data-room-card-home]')?.matches(':enabled')&&document.querySelector('[data-lobby-stage]')`);
  const initialIdentity=network.find(n=>n.name==='AccountIdentity')?.accountId;assert(initialIdentity);evidence.identityBefore=initialIdentity;if(equipmentOnly){assert(await evaluate(page,`localStorage.getItem('cdtank-account-token')===${JSON.stringify(fixture.token)}`),'Checkpoint identity mismatch');evidence.checkpoint={source:checkpoint,copied:true,originalModified:false,originalFundsFixture:true,inventoryOrProfileInjected:false};evidence.previousScopeReused='recovery/output/browser-home-resource-feedback-2026-10-05T04-30-47-802Z.json';}
  await evaluate(page,`window.homeResourceBaselineToken=localStorage.getItem('cdtank-account-token')`);
  evidence.pages=[];evidence.screenshots=[];
  async function home(){await nativeClick(page,'[data-room-card-home]');await waitUntil(page,`document.querySelector('#home-inventory [data-role-tab="tank"]')?.matches(':enabled')&&!document.querySelector('[data-home-resource-state]')`);}
  async function tank(){await home();await nativeClick(page,'#home-inventory [data-role-tab="tank"]');await waitUntil(page,`document.querySelector('#home-roles [data-source-control="rdoEquip"]')?.matches(':enabled')&&!document.querySelector('[data-home-resource-state]')`);}
  const configs=[{name:'inventory',dialog:'#home-inventory',close:'[data-home-close]',query:['Inventory','DisplayName'],open:async()=>nativeClick(page,'[data-room-card-home]'),recover:home},
    {name:'roles',dialog:'#home-roles',close:'[data-roles-close]',query:['OwnedRoles','RoleProfile'],open:async()=>nativeClick(page,'#home-inventory [data-role-tab="tank"]'),prepare:home,recover:tank},
    {name:'equipment',dialog:'#home-equipment',close:'[data-equipment-close]',query:['Inventory','Equipment','OwnedRoles'],prepare:tank,open:async()=>nativeClick(page,'#home-roles [data-source-control="rdoEquip"]'),recover:async()=>{await tank();await nativeClick(page,'#home-roles [data-source-control="rdoEquip"]');await waitUntil(page,`document.querySelector('#home-equipment [data-source-control="lstEquip"]')&&!document.querySelector('[data-home-resource-state]')`);}}];
  for(const config of configs.filter(config=>!equipmentOnly||config.name==='equipment')){
    await config.prepare?.();const mark=network.length,failedBefore=httpFailures.length;uiBlocked=true;await config.open();
    await waitUntil(page,`document.querySelector('${config.dialog} [data-home-resource-state="error"]')`);
    const deadline=Date.now()+15000;while(Date.now()<deadline&&!config.query.every(name=>network.slice(mark).some(n=>n.name===name&&n.direction==='received'&&n.success)))await new Promise(r=>setTimeout(r,50));
    assert(config.query.every(name=>network.slice(mark).some(n=>n.name===name&&n.direction==='received'&&n.success)),'Account query completion');
    assert(httpFailures.length>failedBefore,'real uiHTTP503');
    const read=()=>evaluate(page,`(()=>{const root=document.querySelector('${config.dialog}'),f=root.querySelector('[data-home-resource-state]'),r=f.getBoundingClientRect();return {phase:f.dataset.homeResourceState,error:f.dataset.homeResourceError,text:f.textContent,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,buttonEnabled:root.querySelector('${config.close}').matches(':enabled'),normalStatusVisible:[...root.querySelectorAll('output')].some(e=>!e.hidden&&e.offsetWidth&&e.offsetHeight),sameToken:localStorage.getItem('cdtank-account-token')===window.homeResourceBaselineToken}})()`);
    const entry={name:config.name,feedback:await read(),queryResponses:config.query};evidence.pages.push(entry);assert.equal(entry.feedback.phase,'error');assert(entry.feedback.sameToken&&entry.feedback.buttonEnabled);assert(!entry.feedback.normalStatusVisible);assert(!/http|\/ui\.json|debug/i.test(entry.feedback.text));
    if(config.name==='inventory'){entry.resolutions=[];entry.feedbackPrerequisiteReused=process.argv.includes('--render-recovery-tail-only')?'recovery/output/browser-home-resource-feedback-2026-10-05T04-27-30-686Z.json':undefined;for(const [width,height]of [[800,600],[1920,1080],[3840,2160]]){const trace={target:{width,height},before:await evaluate(page,`({stageWidth:document.querySelector('.home-inventory-stage').getBoundingClientRect().width,zoom:getComputedStyle(document.querySelector('${config.dialog}')).zoom})`)};(entry.resizeTrace??=[]).push(trace);await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page);trace.afterDispatch=await evaluate(page,`({stageWidth:document.querySelector('.home-inventory-stage').getBoundingClientRect().width,zoom:getComputedStyle(document.querySelector('${config.dialog}')).zoom})`);await waitUntil(page,`Math.abs(document.querySelector('.home-inventory-stage').getBoundingClientRect().width-625*Math.min(${width}/800,${height}/600))<.2`);await evaluate(page,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);trace.afterReact=await evaluate(page,`({stageWidth:document.querySelector('.home-inventory-stage').getBoundingClientRect().width,zoom:getComputedStyle(document.querySelector('${config.dialog}')).zoom})`);const state=await read();assert(state.inside);entry.resolutions.push({width,height,...state});const shot=await command('Page.captureScreenshot',{format:'png'},page),path=output+'-'+width+'.png';await writeFile(path,Buffer.from(shot.data,'base64'));evidence.screenshots.push(path);}}
    await nativeClick(page,config.dialog+' '+config.close);await waitUntil(page,`!document.querySelector('${config.dialog}')&&document.activeElement.matches('[data-room-card-home]')`);entry.strictHome=true;
    uiBlocked=false;await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},page);await config.recover();
    entry.recovery=await evaluate(page,`({sourceRoot:!!document.querySelector('${config.dialog} [data-source-layout="ui/layouts/myhome.xml"]'),noFeedback:!document.querySelector('${config.dialog} [data-home-resource-state]'),sameToken:localStorage.getItem('cdtank-account-token')===window.homeResourceBaselineToken})`);assert(Object.values(entry.recovery).every(Boolean));
    await nativeClick(page,config.dialog+' '+config.close);await waitUntil(page,`!document.querySelector('${config.dialog}')&&document.activeElement.matches('[data-room-card-home]')`);
  }
  evidence.identityAfter=network.filter(n=>n.name==='AccountIdentity').at(-1)?.accountId;assert.equal(evidence.identityAfter,evidence.identityBefore);
  assert(!network.some(n=>n.direction==='sent'&&['CreateRoom','Join','Ready','SelectRole','Kitbag'].includes(n.name)));
  assert(!network.some(n=>n.direction==='sent'&&['Shop','TankShop','PetShop','Equipment'].includes(n.name)&&n.payload.operation!=='QUERY'));
  evidence.noTransactions=true;evidence.status='PASS';console.log('PASS home resource feedback '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.httpFailures=httpFailures;evidence.network=network;await writeFile(output+'-server.log',serverLog);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
