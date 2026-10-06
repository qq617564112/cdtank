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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3438',logger:undefined});
const network=[];
let serverLog='';
const navigationOnly=process.argv.includes('--navigation-only');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-home-inventory-list-scroll-source-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-pet-details-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const fixture=JSON.parse(await readFile('recovery/output/home-tank-active-marker-browser-fixture.json','utf8'));
const checkpoint=fixture.database??'recovery/output/home-tank-active-marker-browser.sqlite';await copyFile(checkpoint,database);
const pages=[],contexts=[];

const evidence={status:'RUNNING',navigationOnly,ports:{server:3438,vite:5466,cdp:9669},runId,scope:'UI36/M5-09 confirmed Home Inventory list source scrollbar and normal row navigation; legal Shop BUY only for missing seven different consumables, no inventory injection/Kitbag mutation/room.',checkpoint:{source:checkpoint,copied:true,originalModified:false,originalFundsFixture:true}};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3438',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5466,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3438',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9669',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9669/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9669');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop','RoleProfile'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  const prepare=new WsClient(serviceProto,{server:'ws://127.0.0.1:3438',logger:undefined});
  assert((await prepare.connect()).isSucc);
  try {
    const identity=await prepare.callApi('Account',{token:fixture.token});assert(identity.isSucc);
    assert.equal(identity.res.token,fixture.token);evidence.accountId=identity.res.accountId;
    const before=await prepare.callApi('Inventory',{});assert(before.isSucc);
    evidence.baseline=before.res.records.map(r=>({instanceId:r.instanceId,itemTableId:r.itemTableId,quantity:r.ownedQuantity}));
    evidence.necessaryPurchases=[];
    for(const id of [1,2,3,4,5,6,7]) {
      if(before.res.records.some(r=>r.itemTableId===id&&r.ownedQuantity>0))continue;
      const purchase=await prepare.callApi('Shop',{operation:'BUY',itemTableId:id,quantity:1,currency:'MONEY',requestId:'home-list-'+runId+'-'+id});
      assert(purchase.isSucc);evidence.necessaryPurchases.push({id,confirmed:purchase.res.purchased});
    }
  } finally {await prepare.disconnect();}
  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5466'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const s=pages[0].sessionId;



  assert.equal(await evaluate(s,`localStorage.getItem('cdtank-account-token')`),fixture.token);
  await nativeClick(s,'[data-room-card-home]');
  await waitUntil(s,`document.querySelector('[data-source-control="rdoItem"]')&&!document.querySelector('[data-source-control="rdoItem"]').disabled`);
  await nativeClick(s,'[data-source-control="rdoItem"]');
  const list='[data-home-inventory-list]',shell='[data-source-control="lstPlayerItem"]',bar='[data-home-inventory-list-scrollbar]',thumb='[data-home-inventory-list-scroll-thumb]',up='[data-home-inventory-list-scroll-arrow="up"]';
  await waitUntil(s,`document.querySelectorAll('[data-inventory-instance]').length>=7&&!document.querySelector('${bar}').hidden`);
  const confirmed=network.filter(n=>n.name==='Inventory'&&n.success).at(-1).response.records.filter(r=>r.itemTableId>=1&&r.itemTableId<=1000);
  const metrics=()=>evaluate(s,`(()=>{const l=document.querySelector('${list}'),t=document.querySelector('${thumb}');return {scroll:l.scrollTop,page:l.clientHeight,document:l.scrollHeight,capture:t.hasPointerCapture(1),state:t.dataset.thumbState}})()`);
  async function resize(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('.home-inventory-stage').getBoundingClientRect().width-625*Math.min(${width}/800,${height}/600))<.2`);}
  async function key(key,code,vk){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk},s);}
  const point=selector=>evaluate(s,`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),clip=e.closest('${bar}')?.getBoundingClientRect()??r,x=(Math.max(r.left,clip.left)+Math.min(r.right,clip.right))/2,y=(Math.max(r.top,clip.top)+Math.min(r.bottom,clip.bottom))/2;if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Control covered');return {x,y}})()`);
  evidence.resolutions=[];
  for(const [width,height]of [[800,600],[1920,1080],[3840,2160]]){
    await resize(width,height);const data=await evaluate(s,`(async()=>{const l=document.querySelector('${list}'),root=document.querySelector('${shell}'),b=document.querySelector('${bar}'),r=root.getBoundingClientRect();await Promise.all([...root.querySelectorAll('[data-source-asset]')].filter(e=>e.dataset.sourceAsset).map(e=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=reject;i.src='/'+e.dataset.sourceAsset;})));return {width:innerWidth,height:innerHeight,root:{x:r.x,y:r.y,width:r.width,height:r.height,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight},page:l.clientHeight,document:l.scrollHeight,rows:[...l.querySelectorAll('[data-inventory-instance]')].map(e=>({id:Number(e.dataset.inventoryInstance),text:e.textContent,draggable:e.draggable})),barWidth:b.getBoundingClientRect().width};})()`);
    evidence.resolutions.push(data);const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));
    assert(data.root.inside);assert.equal(data.page,224);assert.equal(data.rows.length,confirmed.length);for(const r of confirmed)assert(data.rows.some(e=>e.id===r.instanceId&&e.text.includes('×'+r.ownedQuantity)&&e.draggable));assert(data.document>224);
  }
  await resize(1920,1080);await evaluate(s,`window.inventoryKeys=[];window.addEventListener('keydown',e=>window.inventoryKeys.push('down:'+e.code));window.addEventListener('keyup',e=>window.inventoryKeys.push('up:'+e.code))`);
  await nativeClick(s,'[data-inventory-instance="'+confirmed[0].instanceId+'"]');await key('End','End',35);
  assert.equal(await evaluate(s,'Number(document.activeElement.dataset.inventoryInstance)'),confirmed.at(-1).instanceId);evidence.endRow=await metrics();
  await key('Home','Home',36);assert.equal(await evaluate(s,'Number(document.activeElement.dataset.inventoryInstance)'),confirmed[0].instanceId);
  await key('ArrowDown','ArrowDown',40);assert.equal(await evaluate(s,'Number(document.activeElement.dataset.inventoryInstance)'),confirmed[1].instanceId);await key('ArrowUp','ArrowUp',38);
  evidence.navigation={home:confirmed[0].instanceId,end:confirmed.at(-1).instanceId,down:confirmed[1].instanceId,up:confirmed[0].instanceId};
  const t=await point(thumb);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,modifiers:16,clickCount:1,...t},s);evidence.thumbPressed=await metrics();assert(evidence.thumbPressed.capture);
  const moved={x:t.x-40,y:t.y+10};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,...moved},s);evidence.thumbMoved=await metrics();assert(evidence.thumbMoved.capture&&evidence.thumbMoved.scroll>evidence.thumbPressed.scroll);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,modifiers:0,clickCount:1,...moved},s);evidence.thumbRelease=await metrics();assert(!evidence.thumbRelease.capture&&evidence.thumbRelease.state==='Normal');
  await key('End','End',35);evidence.end=await metrics();assert(Math.abs(evidence.end.scroll-(evidence.end.document-evidence.end.page))<=1/1.8);await key('Home','Home',36);evidence.home=await metrics();assert.equal(evidence.home.scroll,0);
  evidence.windowKeys=await evaluate(s,'window.inventoryKeys');assert.deepEqual(evidence.windowKeys,[]);
  await nativeClick(s,'[data-home-close]');await waitUntil(s,`document.activeElement.matches('[data-room-card-home]')&&document.activeElement.matches(':enabled')`);evidence.close={strictHome:true};
  assert(network.every(n=>n.direction!=='sent'||n.payload?.operation==='QUERY'||['OwnedRoles','Inventory','RoleProfile'].includes(n.name)));evidence.noBrowserTransactions=true;evidence.status='PASS';console.log('PASS home inventory list source '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
