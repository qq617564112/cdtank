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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3430',logger:undefined});
const network=[];
let serverLog='';
const navigationOnly=process.argv.includes('--navigation-only');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-shop-item-description-source-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-pet-details-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const fixture=JSON.parse(await readFile('recovery/output/home-pet-skill-source-browser-fixture.json','utf8'));
await copyFile(fixture.database,database);
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3430,vite:5461,cdp:9664},runId,scope:'UI52 four-control description sheet, Web attachment; readonly copied UI35 checkpoint, no BUY/room/gameplay.',checkpoint:{source:fixture.database,copied:true,originalModified:false,originalFundsFixture:true}};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3430',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5461,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3430',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9664',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9664/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9664');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5461'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const s=pages[0].sessionId;


  assert.equal(await evaluate(s,`localStorage.getItem('cdtank-account-token')`),fixture.token);
  await nativeClick(s,'[data-room-card-shop]');await waitUntil(s,`document.querySelector('[data-shop-product-id]')?.matches(':enabled')`);
  const query=network.filter(r=>r.name==='Shop'&&r.success).at(-1).response;
  const items=query.items.filter(p=>classifyItemId(p.itemTableId)!==3&&classifyItemId(p.itemTableId)<8);
  const product=items.toSorted((a,b)=>b.info.length-a.info.length)[0];assert(product);
  await nativeClick(s,'[data-shop-product-id="'+product.itemTableId+'"]');await waitUntil(s,`document.querySelector('[data-shop-description]')?.dataset.itemTableId==='${product.itemTableId}'`);
  evidence.resolutions=[];evidence.navigationOnly=navigationOnly;if(navigationOnly)evidence.visualReused='recovery/output/browser-shop-item-description-source-page-2026-10-04T23-38-25-204Z.json';
  for(const [width,height] of (navigationOnly?[]:[[800,600],[1920,1080],[3840,2160]])){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    await waitUntil(s,`Math.abs(document.querySelector('.shop-source-stage').getBoundingClientRect().width-625*Math.min(${width}/800,${height}/600))<.2`);
    const actual=await evaluate(s,`(async()=>{const d=document.querySelector('[data-shop-description]');await Promise.all([...d.querySelectorAll('[data-source-asset]')].filter(e=>e.dataset.sourceAsset).map(e=>new Promise((r,j)=>{const i=new Image();i.onload=r;i.onerror=j;i.src='/'+e.dataset.sourceAsset;})));const t=d.querySelector('[data-shop-description-text]');return {width:innerWidth,height:innerHeight,itemTableId:Number(d.dataset.itemTableId),info:t.textContent,type:d.querySelector('[data-source-control="txtType"]').textContent,scrollHeight:t.scrollHeight,clientHeight:t.clientHeight,frames:d.querySelectorAll('[data-source-frame]').length,controls:[...d.querySelectorAll('[data-source-control]')].map(e=>{const r=e.getBoundingClientRect();return {name:e.dataset.sourceControl,inside:r.left>=-.2&&r.top>=-.2&&r.right<=innerWidth+.2&&r.bottom<=innerHeight+.2}}),quantity:!!document.querySelector('[data-shop-quantity]'),currency:!!document.querySelector('[data-shop-currency]'),buy:!!document.querySelector('[data-shop-buy]')};})()`);
    assert.equal(actual.info,product.info);assert.equal(actual.itemTableId,product.itemTableId);assert.equal(actual.type,'');assert.equal(actual.controls.length,4);assert(actual.controls.every(c=>c.inside));assert(actual.quantity&&actual.currency&&actual.buy);evidence.resolutions.push(actual);
    const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);
  await waitUntil(s,`Math.abs(document.querySelector('.shop-source-stage').getBoundingClientRect().width-1125)<.2`);
  const point=await evaluate(s,`(()=>{const t=document.querySelector('[data-shop-description-text]'),r=t.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,overflow:t.scrollHeight>t.clientHeight}})()`);
  evidence.descriptionFits=!point.overflow;
  if(point.overflow){
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y},s);
  await command('Input.dispatchMouseEvent',{type:'mouseWheel',x:point.x,y:point.y,deltaX:0,deltaY:110},s);
  await waitUntil(s,`document.querySelector('[data-shop-description-text]').scrollTop>0`);
  evidence.scroll=await evaluate(s,`({top:document.querySelector('[data-shop-description-text]').scrollTop,info:document.querySelector('[data-shop-description-text]').textContent})`);assert.equal(evidence.scroll.info,product.info);
  }
  await nativeClick(s,'[data-shop-category="Weapon"]');await waitUntil(s,`document.querySelector('[data-shop-description]')&&document.querySelector('[data-shop-category="Weapon"]').getAttribute('aria-pressed')==='true'`);
  const weaponId=await evaluate(s,`Number(document.querySelector('[data-shop-description]').dataset.itemTableId)`);const weapon=query.items.find(p=>p.itemTableId===weaponId);assert.equal(classifyItemId(weaponId),3);
  evidence.weapon={itemTableId:weaponId,info:await evaluate(s,`document.querySelector('[data-shop-description-text]').textContent`)};assert.equal(evidence.weapon.info,weapon.info);
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`document.activeElement.matches('[data-room-card-shop]')&&document.activeElement.matches(':enabled')`);
  evidence.close={strictShop:true};assert(network.every(r=>r.direction!=='sent'||r.payload?.operation==='QUERY'||r.name==='OwnedRoles'||r.name==='Inventory'));evidence.noWrites=true;evidence.status='PASS';console.log('PASS shop item description '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
