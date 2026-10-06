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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3372',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-home-tank-confirmed-content-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-content-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const navigationOnly=process.argv.includes('--navigation-only');
const evidence={status:'RUNNING',ports:{server:3372,vite:5422,cdp:9622},runId,scope:'UI-32 Home Tank whole page confirmed money/quantity/source catalogue description; full parameters/source rendering incomplete.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3372',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'30'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5422,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3372',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9622',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9622/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9622');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['TankShop','TankTextures','OwnedRoles','RoleProfile','Shop','Account'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5422',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const session=pages[0].sessionId;
  store=new AccountStore(database);const account=store.open(await evaluate(session,`localStorage.getItem('cdtank-account-token')`));const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0x70,20000,true);view.setUint32(0x74,200,true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});store.close();store=undefined;evidence.fixture={money:20000,tokens:200,initialOwnedTank3:false};
  async function witness(name){await evaluate(session,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url);const element=document.querySelector('${selector}'),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===element.querySelector('canvas'));if(!engine)throw new Error('Product preview engine missing');const scene=engine.scenes[0],meshes=scene.meshes.filter(m=>m.isEnabled()&&m.getTotalVertices()>0);const w=window[${JSON.stringify(name)}]={element,engine,scene,draws:0,busy:[],materials:meshes.map(m=>({name:m.name,vertices:m.getTotalVertices(),textures:m.material?.getActiveTextures().map(t=>t.url??t.name)}))};for(const mesh of meshes)mesh.onAfterRenderObservable.add(()=>w.draws++);w.observer=new MutationObserver(()=>w.busy.push({busy:document.querySelector('#account-shop')?.getAttribute('aria-busy'),sameElement:w.element===document.querySelector('${selector}'),sameEngine:w.engine.getRenderingCanvas()===document.querySelector('${selector}')?.querySelector('canvas'),sceneDisposed:w.scene.isDisposed,engineDisposed:w.engine.isDisposed}));w.observer.observe(document.querySelector('#account-shop'),{attributes:true,attributeFilter:['aria-busy'],subtree:false});})()`);await waitUntil(session,`window[${JSON.stringify(name)}].draws>0`);}
  async function stable(name){assert(await evaluate(session,`(()=>{const w=window[${JSON.stringify(name)}];return w.element===document.querySelector('${selector}')&&w.engine.getRenderingCanvas()===w.element.querySelector('canvas')&&!w.engine.isDisposed&&!w.scene.isDisposed})()`),'Preview scene must remain mounted');}
  async function saved(name){return evaluate(session,`(()=>{const w=window[${JSON.stringify(name)}];return {dataset:{...w.element.dataset},draws:w.draws,materials:w.materials,busy:w.busy}})()`);}
  async function disposed(name){const result=await evaluate(session,`(()=>{const w=window[${JSON.stringify(name)}];w.observer.disconnect();return {engine:w.engine.isDisposed,scene:w.scene.isDisposed,connected:w.element.isConnected,frames:w.element.dataset.frames}})()`);assert.equal(result.engine,true);assert.equal(result.scene,true);assert.equal(result.connected,false);await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);assert.equal(await evaluate(session,`window[${JSON.stringify(name)}].element.dataset.frames`),result.frames);return result;}
  async function screenshot(suffix){const shot=await command('Page.captureScreenshot',{format:'png'},session);await writeFile(output+'-'+suffix+'.png',Buffer.from(shot.data,'base64'));}
  await nativeClick(session,'[data-room-card-shop]');await waitUntil(session,`document.querySelector('[data-shop-root-category="Tank"]')?.matches(':enabled')`);await nativeClick(session,'[data-shop-root-category="Tank"]');
  const bought=[];for(const id of [3,4]){
    await waitUntil(session,`document.querySelector('[data-tank-shop-buy]')?.matches(':enabled')`);await nativeClick(session,`[data-tank-shop-product-id="${id}"]`);await nativeClick(session,'[data-tank-shop-buy]');await waitUntil(session,`document.querySelector('[data-tank-shop-status]').value.includes('已购买')&&document.querySelector('[data-tank-shop-buy]')?.matches(':enabled')`);
    const result=network.filter(e=>e.name==='TankShop'&&e.direction==='received'&&e.response?.purchased).at(-1).response.purchased;bought.push({tankId:id,instance:result.fields.find(([offset])=>offset===0x1c)[1]});
  }evidence.bought=bought;await nativeClick(session,'[data-shop-close]');await waitUntil(session,`!document.querySelector('#account-shop[open]')`);
  await nativeClick(session,'[data-room-card-home]');await waitUntil(session,`document.querySelector('[data-role-tab="tank"]')?.matches(':enabled')`);await nativeClick(session,'[data-role-tab="tank"]');await waitUntil(session,`document.querySelector('[data-owned-role="${bought[0].instance}"]')?.matches(':enabled')`);await nativeClick(session,`[data-owned-role="${bought[0].instance}"]`);
  await waitUntil(session,`document.querySelector('[data-role-preview]')?.dataset.status==='ready'&&document.querySelector('[data-home-tank-description]')?.dataset.descriptionSource==='confirmed-tank-shop'`);
  const products=network.filter(e=>e.name==='TankShop'&&e.direction==='received'&&e.success).at(-1).response.tanks;
  const description=products.find(p=>p.tankId===3).info;assert.equal(await evaluate(session,`document.querySelector('[data-home-tank-description]').textContent`),description);
  evidence.sizes=[];if(!navigationOnly)for(const[width,height]of[[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);const scale=Math.min(width/800,height/600);await waitUntil(session,`Math.abs(document.querySelector('.home-roles-stage').getBoundingClientRect().width-${625*scale})<.2`);await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const whole=await evaluate(session,`(()=>{const d=document.querySelector('#home-roles'),desc=d.querySelector('[data-home-tank-description]');return {money:d.querySelector('[data-source-control="txtMoney"]').textContent,count:d.querySelector('[data-source-control="txtListQuantity"]').textContent,description:desc.textContent,colour:getComputedStyle(desc).color,source:desc.dataset.descriptionSource,regions:d.querySelectorAll('.home-tank-source-picture').length,preview:{...d.querySelector('[data-role-preview]').dataset},creative:d.querySelector('[data-source-control="txtOriginality"]')?.textContent??null}})()`);
    assert.equal(whole.money,'14000');assert.equal(whole.count,'2');assert.equal(whole.description,description);assert.equal(whole.colour,'rgb(37, 55, 64)');assert.equal(whole.regions,36);assert.equal(whole.creative,null);evidence.sizes.push({width,height,scale,whole});await screenshot('home-tank-'+width);
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},session);await waitUntil(session,`Math.abs(document.querySelector('.home-roles-stage').getBoundingClientRect().width-1125)<.2`);
  const desc=await evaluate(session,`(()=>{const e=document.querySelector('[data-home-tank-description]'),r=e.getBoundingClientRect();return {scroll:e.scrollHeight,client:e.clientHeight,x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:desc.x,y:desc.y},session);await command('Input.dispatchMouseEvent',{type:'mouseWheel',x:desc.x,y:desc.y,deltaX:0,deltaY:90},session);await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);evidence.descriptionScroll={...desc,top:await evaluate(session,`document.querySelector('[data-home-tank-description]').scrollTop`)};if(desc.scroll>desc.client)assert(evidence.descriptionScroll.top>0);
  await nativeClick(session,`[data-owned-role="${bought[1].instance}"]`);await waitUntil(session,`document.querySelector('[data-role-preview]')?.dataset.status==='ready'&&document.querySelector('[data-role-preview]').dataset.renderedTankId==='4'`);assert.equal(await evaluate(session,`document.querySelector('[data-home-tank-description]').textContent`),products.find(p=>p.tankId===4).info);evidence.changedDescription=await evaluate(session,`document.querySelector('[data-home-tank-description]').textContent`);
  await nativeClick(session,'.home-tank-source-use');await waitUntil(session,`document.querySelector('.home-tank-source-use').dataset.selectedInstance==='${bought[1].instance}'&&document.querySelector('#home-roles').getAttribute('aria-busy')==='false'`);
  await nativeClick(session,'[data-source-control="rdoEquip"]');await waitUntil(session,`document.querySelector('#home-equipment[open]')&&document.querySelector('#home-equipment [data-source-control="rdoTank"]')?.matches(':enabled')`);evidence.equipmentNavigation=true;
  await nativeClick(session,'[data-role-tab="tank"]');await waitUntil(session,`document.querySelector('[data-role-preview]')?.dataset.status==='ready'&&document.querySelector('[data-home-tank-description]')?.dataset.descriptionSource==='confirmed-tank-shop'`);assert.equal(await evaluate(session,`document.querySelector('[data-home-tank-description]').textContent`),products.find(p=>p.tankId===4).info);
  await nativeClick(session,'[data-roles-close]');await waitUntil(session,`!document.querySelector('#home-roles[open]')`);assert.equal(await evaluate(session,`document.activeElement.hasAttribute('data-room-card-home')`),true);assert.equal(network.filter(e=>e.name==='TankTextures'&&e.direction==='sent').length,0);evidence.status='PASS';console.log('PASS: '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)for(const[i,p]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},p.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
