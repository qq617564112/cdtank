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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3375',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-home-pet-confirmed-state-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-pet-state-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];


const evidence={status:'RUNNING',ports:{server:3375,vite:5425,cdp:9625},runId,scope:'UI34 formal Pet whole page, confirmed balances/count/current-pet source image; ordinary acquisition-selection-return scope, unknown growth/skills incomplete.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3375',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'30'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5425,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3375',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9625',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9625/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9625');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['SelectRole','PetShop','Equipment','Inventory','TankShop','TankTextures','OwnedRoles','RoleProfile','Shop','Account'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5425',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const session=pages[0].sessionId;

  async function screenshot(suffix){const shot=await command('Page.captureScreenshot',{format:'png'},session);await writeFile(output+'-'+suffix+'.png',Buffer.from(shot.data,'base64'));}
  async function openPet(){await nativeClick(session,'[data-room-card-home]');await waitUntil(session,`document.querySelector('[data-role-tab="pet"]')?.matches(':enabled')`);await nativeClick(session,'[data-role-tab="pet"]');await waitUntil(session,`document.querySelector('#home-roles[open]')&&document.querySelector('[data-home-pet-quantity]')&&document.querySelector('#home-roles').getAttribute('aria-busy')==='false'`);}
  async function closePet(){await nativeClick(session,'[data-roles-close]');await waitUntil(session,`!document.querySelector('#home-roles[open]')`);assert.equal(await evaluate(session,`document.activeElement.hasAttribute('data-room-card-home')`),true);}
  await openPet();assert.equal(await evaluate(session,`document.querySelector('[data-home-pet-quantity]').textContent`),'0');assert.equal(await evaluate(session,`document.querySelector('[data-source-control="txtMoney"]').textContent`),'');assert.equal(await evaluate(session,`!!document.querySelector('[data-home-pet-already-used]')`),false);evidence.emptyOwned={count:0,balanceBlank:true,currentMarkerAbsent:true};await closePet();
  store=new AccountStore(database);const account=store.open(await evaluate(session,`localStorage.getItem('cdtank-account-token')`));const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0x70,4000,true);view.setUint32(0x74,25,true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});store.close();store=undefined;evidence.fixture={money:4000,tokens:25,ownedPetsImported:false};
  await nativeClick(session,'[data-room-card-shop]');await waitUntil(session,`document.querySelector('[data-shop-root-category="Pet"]')?.matches(':enabled')`);await nativeClick(session,'[data-shop-root-category="Pet"]');await waitUntil(session,`document.querySelector('[data-pet-shop-product-id="2"]')?.matches(':enabled')`);await nativeClick(session,'[data-pet-shop-product-id="2"]');await nativeClick(session,'[data-pet-shop-buy]');await waitUntil(session,`document.querySelector('[data-pet-shop-status]').textContent.includes('已购买')&&document.querySelector('[data-pet-shop-buy]').matches(':enabled')`);
  const bought=network.filter(e=>e.name==='PetShop'&&e.direction==='received'&&e.response?.purchased).at(-1)?.response;assert(bought);const instance=new Map(bought.purchased.fields).get(0);assert.equal(bought.money,500);assert.equal(bought.tokens,25);evidence.purchased={instance,petId:2,money:bought.money,tokens:bought.tokens};
  await nativeClick(session,'[data-shop-close]');await waitUntil(session,`!document.querySelector('#account-shop[open]')`);await openPet();await waitUntil(session,`document.querySelector('[data-owned-role="${instance}"]')?.matches(':enabled')&&document.querySelector('[data-home-pet-money]').textContent==='500'`);assert.equal(await evaluate(session,`document.querySelector('[data-home-pet-quantity]').textContent`),'1');await nativeClick(session,`[data-owned-role="${instance}"]`);await waitUntil(session,`document.querySelector('[data-home-pet-preview]').dataset.status==='ready'`);
  assert.equal(await evaluate(session,`!!document.querySelector('[data-home-pet-already-used]')`),false);assert.equal(await evaluate(session,`document.querySelector('.home-role-use').matches(':enabled')`),true);await screenshot('candidate-1920');
  await nativeClick(session,'.home-role-use');await waitUntil(session,`document.querySelector('[data-home-pet-already-used]')&&document.querySelector('.home-role-use').disabled&&document.querySelector('#home-roles').getAttribute('aria-busy')==='false'`);
  const confirmed=network.filter(e=>e.name==='SelectRole'&&e.direction==='received'&&e.success).at(-1)?.response;assert(confirmed);assert.equal(new DataView(Uint8Array.from(confirmed.profile.bytes).buffer).getUint32(0xa4,true),instance);assert.equal(confirmed.code,0);evidence.selected={instance,profileA4:instance,code:confirmed.code,sourceImage:'mycabin0/chuji4.tga'};
  evidence.sizes=[];
  for(const[width,height]of[[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);await waitUntil(session,`Math.abs(Number(getComputedStyle(document.querySelector('#home-roles')).zoom)-${Math.min(width/800,height/600)})<0.01`);await evaluate(session,`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
    const state=await evaluate(session,`(()=>{const r=document.querySelector('[data-home-role-page]').getBoundingClientRect(),pet=document.querySelector('[data-home-pet-preview]');return {x:r.x,y:r.y,width:r.width,height:r.height,money:document.querySelector('[data-home-pet-money]').textContent,quantity:document.querySelector('[data-home-pet-quantity]').textContent,currentMarker:!!document.querySelector('[data-home-pet-already-used]'),disabled:document.querySelector('.home-role-use').disabled,preview:{status:pet.dataset.status,petId:pet.dataset.renderedPetId}}})()`);assert.equal(state.money,'500');assert.equal(state.quantity,'1');assert(state.currentMarker&&state.disabled);assert.equal(state.preview.status,'ready');assert.equal(state.preview.petId,'2');assert(state.x>=0&&state.y>=0&&state.x+state.width<=width+1&&state.y+state.height<=height+1);evidence.sizes.push({viewport:{width,height},...state});await screenshot('pet-'+width);
  }
  await nativeClick(session,'[data-role-tab="tank"]');await waitUntil(session,`document.querySelector('[data-home-role-page]').dataset.homeRolePage==='tank'`);assert.equal(await evaluate(session,`!!document.querySelector('[data-home-pet-already-used]')`),false);await nativeClick(session,'[data-role-tab="pet"]');await waitUntil(session,`document.querySelector('[data-home-pet-already-used]')&&document.querySelector('[data-home-pet-preview]').dataset.status==='ready'`);await closePet();await openPet();await waitUntil(session,`document.querySelector('[data-home-pet-already-used]')&&document.querySelector('[data-home-pet-money]').textContent==='500'`);assert.equal(await evaluate(session,`document.querySelector('.home-role-use').dataset.selectedInstance`),String(instance));await closePet();
  assert.equal(network.filter(e=>e.name==='PetShop'&&e.direction==='sent'&&e.payload.operation==='BUY').length,1);assert.equal(network.filter(e=>e.name==='SelectRole'&&e.direction==='sent').length,1);evidence.navigation={tabReturn:true,reopenConfirmed:true,formalHomeFocus:true};evidence.status='PASS';console.log('PASS: '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)for(const[i,p]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},p.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
