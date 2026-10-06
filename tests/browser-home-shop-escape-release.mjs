import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile, copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {DatabaseSync, backup} from 'node:sqlite';
import {classifyItemId} from '../apps/shared/combat/item-hotkeys.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3452',logger:undefined});
const network=[];
let serverLog='';
const remainingOnly=process.argv.includes('--remaining-only');
const navigationOnly=process.argv.includes('--navigation-only');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-home-shop-escape-release-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-shop-escape-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const fixture=JSON.parse(await readFile('recovery/output/home-tank-active-marker-browser-fixture.json','utf8'));
const checkpoint=fixture.database??'recovery/output/home-tank-active-marker-browser.sqlite';const evidenceDb=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(evidenceDb,database);}finally{evidenceDb.close();}
const pages=[],contexts=[];

const evidence={status:'RUNNING',navigationOnly,ports:{server:3452,vite:5480,cdp:9682},runId,scope:'Home Inventory/Role/Equipment and Shop root native Escape down/up isolation; readonly normal checkpoint navigation, no BUY/Equip/Kitbag/room/selection writes or screenshots.',checkpoint:{source:checkpoint,copied:true,originalModified:false,originalFundsFixture:true}};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3452',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5480,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3452',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9682',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9682/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9682');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop','RoleProfile'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  const prepare=new WsClient(serviceProto,{server:'ws://127.0.0.1:3452',logger:undefined});
  assert((await prepare.connect()).isSucc);
  try {
    const identity=await prepare.callApi('Account',{token:fixture.token});assert(identity.isSucc);
    assert(identity.res.token===fixture.token,'Checkpoint account token identity mismatch');evidence.accountId=identity.res.accountId;
  } finally {await prepare.disconnect();}
  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5480'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const s=pages[0].sessionId;



  assert(await evaluate(s,`localStorage.getItem('cdtank-account-token')`)===fixture.token,'Browser checkpoint identity mismatch');
  await evaluate(s,`window.rootEscapeKeys=[];window.addEventListener('keydown',e=>window.rootEscapeKeys.push('down:'+e.code));window.addEventListener('keyup',e=>window.rootEscapeKeys.push('up:'+e.code))`);
  evidence.roots=[];evidence.resolutions=[];evidence.screenshots=[];
  async function escapeRoot(selector,opener){
    await waitUntil(s,`document.querySelector('${selector}')?.open&&document.querySelector('${selector}').getAttribute('aria-busy')==='false'&&document.querySelector('${selector}').contains(document.activeElement)`);
    const before=await evaluate(s,`({open:document.querySelector('${selector}').open,withinDialog:document.querySelector('${selector}').contains(document.activeElement),focus:document.activeElement.dataset.sourceControl||document.activeElement.tagName})`);
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);
    const down=await evaluate(s,`({open:!!document.querySelector('${selector}')?.open,withinDialog:!!document.querySelector('${selector}')?.contains(document.activeElement),keys:[...window.rootEscapeKeys]})`);assert(down.open&&down.withinDialog);assert.deepEqual(down.keys,[]);
    await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);
    await waitUntil(s,`!document.querySelector('${selector}')?.open&&document.activeElement.matches('${opener}')&&document.activeElement.matches(':enabled')`);
    const up={closed:true,strictOpener:true,keys:await evaluate(s,'window.rootEscapeKeys')};assert.deepEqual(up.keys,[]);evidence.roots.push({selector,opener,before,down,up});
  }
  if(!remainingOnly){await nativeClick(s,'[data-room-card-home]');await escapeRoot('#home-inventory','[data-room-card-home]');}
  await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('#home-inventory [data-role-tab="pet"]')?.matches(':enabled')`);await nativeClick(s,'#home-inventory [data-role-tab="pet"]');await escapeRoot('#home-roles','[data-room-card-home]');
  await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('#home-inventory [data-role-tab="tank"]')?.matches(':enabled')`);await nativeClick(s,'#home-inventory [data-role-tab="tank"]');await waitUntil(s,`document.querySelector('#home-roles [data-source-control="rdoEquip"]')?.matches(':enabled')`);await nativeClick(s,'#home-roles [data-source-control="rdoEquip"]');await escapeRoot('#home-equipment','[data-room-card-home]');
  await nativeClick(s,'[data-room-card-shop]');await escapeRoot('#account-shop','[data-room-card-shop]');
  assert.equal(evidence.roots.length,remainingOnly?3:4);evidence.remainingOnly=remainingOnly;
  assert(!network.some(n=>n.direction==='sent'&&(['CreateRoom','Join','Ready','SelectRole','TankTextures'].includes(n.name)||n.payload?.operation&&n.payload.operation!=='QUERY')));evidence.noPurchaseEquipmentSelectionRoom=true;evidence.status='PASS';console.log('PASS four Home/Shop Escape release '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{await writeFile(output+'-server.log',serverLog);evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
