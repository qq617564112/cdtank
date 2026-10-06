import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, copyFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3412',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-home-equipment-confirmed-description-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-equipment-description-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3412,vite:5442,cdp:9642},runId,scope:'UI32 Equipment current active confirmed TankShop description and Equipment profile money; source rectangle, actual scroll and preview retention; no transactions.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3412',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  const reused=JSON.parse(await readFile('recovery/output/home-tank-active-marker-browser-fixture.json','utf8'));
  const {DatabaseSync}=require('node:sqlite');const check=new DatabaseSync(reused.database,{readOnly:true});assert.equal(check.prepare('SELECT COUNT(*) AS n FROM role_records').get().n,reused.expectedOwnedCount);check.close();evidence.legalCheckpointReadOnlyCountVerified=true;
  if(reused)await copyFile(reused.database,database);
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5442,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3412',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9642',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9642/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9642');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Page.enable',{},sessionId);
    if(reused)await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(reused.token)+')'},sessionId);
    await command('Page.navigate',{url:'http://127.0.0.1:5442'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);
    if(reused)assert(await evaluate(sessionId,`localStorage.getItem('cdtank-account-token')`)==reused.token,'Reuse confirmed account identity');

  }
  const s=pages[0].sessionId;

  await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('[data-home-name-open]')?.matches(':enabled')`);
  await nativeClick(s,'#home-inventory [data-role-tab="tank"]');await waitUntil(s,`document.querySelector('#home-roles [data-source-control="rdoEquip"]')?.matches(':enabled')`);
  await nativeClick(s,'#home-roles [data-source-control="rdoEquip"]');
  await waitUntil(s,`document.querySelector('#home-equipment [data-equipment-tab="PART"]')?.matches(':enabled')&&document.querySelector('#home-equipment [data-role-preview]')?.dataset.status==='ready'&&document.querySelector('#home-equipment [data-home-tank-description]')?.dataset.descriptionSource==='confirmed-tank-shop'`);
  const confirmed=network.filter(r=>r.name==='Equipment'&&r.success).at(-1).response;
  const activeId=new DataView(Uint8Array.from(confirmed.profile.bytes).buffer).getUint32(0xa8,true);
  assert.equal(activeId,reused.expectedActiveInstance);
  const owned=network.filter(r=>r.name==='OwnedRoles'&&r.success).at(-1).response.equipment;
  const active=owned.find(r=>new Map(r.fields).get(0x1c)===activeId);assert(active);
  const tankId=new Map(active.fields).get(0x24);
  const product=network.filter(r=>r.name==='TankShop'&&r.success).at(-1).response.tanks.find(p=>p.tankId===tankId);assert(product);
  const expectedMoney=new DataView(Uint8Array.from(confirmed.profile.bytes).buffer).getUint32(0x70,true);
  evidence.description=await evaluate(s,`(()=>{const r=document.querySelector('#home-equipment'),e=r.querySelector('[data-home-tank-description]'),b=e.getBoundingClientRect();return {text:e.textContent,source:e.dataset.sourceControl,layout:e.dataset.sourceLayout,authority:e.dataset.descriptionSource,colour:getComputedStyle(e).color,insideViewport:b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,money:r.querySelector('[data-source-control="txtMoney"]').textContent,activeInstance:Number(r.querySelector('[data-role-preview]').dataset.instanceId),previewStatus:r.querySelector('[data-role-preview]').dataset.status}})()`);
  assert.equal(evidence.description.text,product.info);assert.equal(evidence.description.source,'edtTankDesc');assert.equal(evidence.description.money,String(expectedMoney));assert.equal(evidence.description.activeInstance,activeId);assert(evidence.description.insideViewport);assert.equal(evidence.description.colour,'rgb(37, 55, 64)');
  const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-description-1920.png',Buffer.from(shot.data,'base64'));
  const point=await evaluate(s,`(()=>{const r=document.querySelector('#home-equipment [data-home-tank-description]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},s);
  await command('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaX:0,deltaY:200},s);
  await waitUntil(s,`document.querySelector('#home-equipment [data-home-tank-description]').scrollTop>0`);
  evidence.scroll=await evaluate(s,`(()=>{const e=document.querySelector('#home-equipment [data-home-tank-description]');return {scrollTop:e.scrollTop,atEnd:e.scrollTop+e.clientHeight>=e.scrollHeight-1,textUnchanged:e.textContent===${JSON.stringify(product.info)},previewReady:document.querySelector('#home-equipment [data-role-preview]').dataset.status==='ready',previewInstance:Number(document.querySelector('#home-equipment [data-role-preview]').dataset.instanceId)}})()`);assert(evidence.scroll.atEnd&&evidence.scroll.textUnchanged&&evidence.scroll.previewReady);assert.equal(evidence.scroll.previewInstance,activeId);
  await nativeClick(s,'[data-equipment-close]');await waitUntil(s,`!document.querySelector('#home-equipment')&&document.activeElement.matches('[data-room-card-home]')&&document.activeElement.matches(':enabled')`);evidence.strictHomeFocus=true;
  const mutations=network.filter(r=>r.direction==='sent'&&(r.name==='SelectRole'||r.payload?.operation==='BUY'||r.name==='Equipment'&&r.payload?.operation!=='QUERY'));assert.equal(mutations.length,0);evidence.noPurchaseSelectRoleOrEquipmentWrite=true;
  evidence.status='PASS';console.log('PASS Equipment confirmed active description/money/readable1920/ordinary scroll/preview retention/strict Home focus; read-only checkpoint');
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
