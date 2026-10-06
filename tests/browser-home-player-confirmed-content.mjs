import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3374',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-home-player-confirmed-content-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-player-content-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];


const evidence={status:'RUNNING',ports:{server:3374,vite:5424,cdp:9624},runId,scope:'UI36 formal Player whole page confirmed profile balances and current inventory record count; unknown player parameters and summaries incomplete.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3374',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'30'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5424,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3374',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9624',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9624/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9624');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Kitbag','Equipment','Inventory','TankShop','TankTextures','OwnedRoles','RoleProfile','Shop','Account'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5424',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const session=pages[0].sessionId;

  async function screenshot(suffix){const shot=await command('Page.captureScreenshot',{format:'png'},session);await writeFile(output+'-'+suffix+'.png',Buffer.from(shot.data,'base64'));}
  const text=selector=>evaluate(session,`document.querySelector(${JSON.stringify(selector)})?.textContent`);
  async function openHome(){await nativeClick(session,'[data-room-card-home]');await waitUntil(session,`document.querySelector('#home-inventory[open]')&&document.querySelector('[data-source-control="rdoItem"]')?.matches(':enabled')`);}
  async function closeHome(){await nativeClick(session,'[data-home-close]');await waitUntil(session,`!document.querySelector('#home-inventory[open]')`);assert.equal(await evaluate(session,`document.activeElement.hasAttribute('data-room-card-home')`),true);}
  await openHome();
  assert.equal(await text('[data-confirmed-item-quantity]'),'0');
  assert.equal(await text('[data-source-control="txtMoney"]'),'');
  assert.equal(await text('[data-source-control="txtCoin"]'),'');
  evidence.absentProfile={balancesBlank:true,inventoryReady:true};await closeHome();
  store=new AccountStore(database);const account=store.open(await evaluate(session,`localStorage.getItem('cdtank-account-token')`));const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0x70,200,true);view.setUint32(0x74,30,true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});store.close();store=undefined;
  evidence.fixture={money:200,tokens:30,inventoryImported:false};
  await openHome();await waitUntil(session,`document.querySelector('[data-confirmed-money]')?.dataset.confirmedMoney==='200'`);assert.equal(await text('[data-confirmed-tokens]'),'30');await closeHome();
  await nativeClick(session,'[data-room-card-shop]');await waitUntil(session,`document.querySelector('[data-shop-buy]')?.matches(':enabled')&&document.querySelector('[data-shop-product-id="1"]')`);await nativeClick(session,'[data-shop-product-id="1"]');await nativeClick(session,'[data-shop-buy]');
  await waitUntil(session,`document.querySelector('[data-shop-status]').textContent.includes('已购买')&&document.querySelector('[data-shop-buy]').matches(':enabled')`);
  const bought=network.filter(e=>e.name==='Shop'&&e.direction==='received'&&e.response?.purchased?.itemTableId===1).at(-1)?.response;assert(bought);assert.equal(bought.money,190);assert.equal(bought.tokens,30);evidence.purchase=bought;
  await nativeClick(session,'[data-shop-close]');await waitUntil(session,`!document.querySelector('#account-shop[open]')`);
  await openHome();await waitUntil(session,`document.querySelector('[data-confirmed-money]')?.dataset.confirmedMoney==='190'`);assert.equal(await text('[data-confirmed-tokens]'),'30');assert.equal(await text('[data-confirmed-item-quantity]'),'0');
  await nativeClick(session,'[data-source-control="rdoItem"]');await waitUntil(session,`document.querySelector('[data-inventory-instance="${bought.purchased.instanceId}"]')`);assert.equal(await text('[data-confirmed-item-quantity]'),'1');
  await nativeClick(session,`[data-inventory-instance="${bought.purchased.instanceId}"]`);assert.equal(await evaluate(session,`document.querySelector('[data-inventory-instance="${bought.purchased.instanceId}"]').getAttribute('aria-pressed')`),'true');
  evidence.returned={money:await text('[data-confirmed-money]'),tokens:await text('[data-confirmed-tokens]'),itemRecords:await text('[data-confirmed-item-quantity]'),purchasedInstance:bought.purchased.instanceId};
  evidence.sizes=[];
  for(const[width,height]of[[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
    await waitUntil(session,`Math.abs(Number(getComputedStyle(document.querySelector('#home-inventory')).zoom)-${Math.min(width/800,height/600)})<0.01`);
    await evaluate(session,`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
    const rect=await evaluate(session,`(()=>{const root=document.querySelector('[data-home-page]'),r=root.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,images:[...root.querySelectorAll('[data-source-image]')].map(e=>({name:e.dataset.sourceControl,asset:e.dataset.sourceAsset})),money:document.querySelector('[data-confirmed-money]').textContent,tokens:document.querySelector('[data-confirmed-tokens]').textContent,quantity:document.querySelector('[data-confirmed-item-quantity]').textContent}})()`);
    assert.equal(rect.money,'190');assert.equal(rect.tokens,'30');assert.equal(rect.quantity,'1');assert(rect.x>=0&&rect.y>=0);assert(rect.x+rect.width<=width+1&&rect.y+rect.height<=height+1);evidence.sizes.push({viewport:{width,height},...rect});await screenshot('player-'+width);
  }
  await nativeClick(session,'[data-source-control="rdoWeapon"]');assert.equal(await text('[data-confirmed-item-quantity]'),'0');await nativeClick(session,'[data-source-control="rdoItem"]');assert.equal(await text('[data-confirmed-item-quantity]'),'1');await closeHome();
  await openHome();await waitUntil(session,`document.querySelector('[data-confirmed-money]')?.dataset.confirmedMoney==='190'`);assert.equal(await text('[data-confirmed-item-quantity]'),'1');await closeHome();
  assert.equal(network.filter(e=>e.name==='Shop'&&e.direction==='sent'&&e.payload.operation==='BUY').length,1);assert.equal(network.filter(e=>e.name==='Kitbag'&&e.direction==='sent').length,0);evidence.navigation={formalHomeFocus:true,pageRetained:true};evidence.status='PASS';console.log('PASS: '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)for(const[i,p]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},p.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
