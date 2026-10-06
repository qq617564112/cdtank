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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3368',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-pet-shop-source-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-pet-shop-preview-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const readabilityOnly=process.argv.includes('--readability-only');
const interactionsOnly=process.argv.includes('--interactions-only');
const evidence={status:'RUNNING',ports:{server:3368,vite:5418,cdp:9618},runId,scope:'M5-10/UI-56 original pet shop main regions, readable description and source list/buy tab; ordinary pet2 purchase/navigation; full parameters/1:1 incomplete.'};
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
      return await evaluate(session, `(async()=>{const deadline=Date.now()+${timeout};while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('[data-pet-shop-status]')?.value+' '+document.querySelector('[data-shop-pet-preview]')?.dataset.status);})()`);
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3368',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'30'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5418,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3368',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9618',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9618/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9618');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['PetShop','Shop','Account'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5418',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const session=pages[0].sessionId;
  store=new AccountStore(database);const account=store.open(await evaluate(session,`localStorage.getItem('cdtank-account-token')`));const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0x70,4000,true);view.setUint32(0x74,1000,true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});store.close();store=undefined;evidence.fixture={money:4000,tokens:1000,initialOwnedPet2:false};
  const selector='[data-shop-pet-preview]';
  async function ready(){await waitUntil(session,`(()=>{const p=document.querySelector('${selector}');return p?.dataset.status==='ready'&&p.dataset.renderedPetId==='2'&&Number(p.dataset.meshes)>0})()`);}
  async function open(){await nativeClick(session,'[data-room-card-shop]');await waitUntil(session,`document.querySelector('[data-shop-root-category="Pet"]')?.matches(':enabled')`);if(!await evaluate(session,`Boolean(document.querySelector('${selector}'))`))await nativeClick(session,'[data-shop-root-category="Pet"]');await ready();}
  async function witness(name){await evaluate(session,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url);const element=document.querySelector('${selector}'),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===element.querySelector('canvas'));if(!engine)throw new Error('Product preview engine missing');const scene=engine.scenes[0],meshes=scene.meshes.filter(m=>m.isEnabled()&&m.getTotalVertices()>0);const w=window[${JSON.stringify(name)}]={element,engine,scene,draws:0,busy:[],materials:meshes.map(m=>({name:m.name,vertices:m.getTotalVertices(),textures:m.material?.getActiveTextures().map(t=>t.url??t.name)}))};for(const mesh of meshes)mesh.onAfterRenderObservable.add(()=>w.draws++);w.observer=new MutationObserver(()=>w.busy.push({busy:document.querySelector('#account-shop')?.getAttribute('aria-busy'),sameElement:w.element===document.querySelector('${selector}'),sameEngine:w.engine.getRenderingCanvas()===document.querySelector('${selector}')?.querySelector('canvas'),sceneDisposed:w.scene.isDisposed,engineDisposed:w.engine.isDisposed}));w.observer.observe(document.querySelector('#account-shop'),{attributes:true,attributeFilter:['aria-busy'],subtree:false});})()`);await waitUntil(session,`window[${JSON.stringify(name)}].draws>0`);}
  async function stable(name){assert(await evaluate(session,`(()=>{const w=window[${JSON.stringify(name)}];return w.element===document.querySelector('${selector}')&&w.engine.getRenderingCanvas()===w.element.querySelector('canvas')&&!w.engine.isDisposed&&!w.scene.isDisposed})()`),'Preview scene must remain mounted');}
  async function saved(name){return evaluate(session,`(()=>{const w=window[${JSON.stringify(name)}];return {dataset:{...w.element.dataset},draws:w.draws,materials:w.materials,busy:w.busy}})()`);}
  async function disposed(name){const result=await evaluate(session,`(()=>{const w=window[${JSON.stringify(name)}];w.observer.disconnect();return {engine:w.engine.isDisposed,scene:w.scene.isDisposed,connected:w.element.isConnected,frames:w.element.dataset.frames}})()`);assert.equal(result.engine,true);assert.equal(result.scene,true);assert.equal(result.connected,false);await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);assert.equal(await evaluate(session,`window[${JSON.stringify(name)}].element.dataset.frames`),result.frames);return result;}
  async function screenshot(suffix){const shot=await command('Page.captureScreenshot',{format:'png'},session);await writeFile(output+'-'+suffix+'.png',Buffer.from(shot.data,'base64'));}
  await open();assert.equal(await evaluate(session,`document.querySelector('[data-pet-shop-item]').dataset.selectedPet`),'2');await witness('firstPreview');evidence.initial=await saved('firstPreview');
  if(readabilityOnly){
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},session);
    await waitUntil(session,`Math.abs(document.querySelector('.shop-source-stage').getBoundingClientRect().width-1125)<.2`);
    await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    evidence.readability=await evaluate(session,`(()=>{const d=document.querySelector('[data-pet-shop-product]'),h=document.querySelector('[data-pet-shop-hp]');return {description:d.textContent,descriptionColour:getComputedStyle(d).color,hp:h.textContent,hpColour:getComputedStyle(h).color,hpPresentation:h.dataset.presentationColour}})()`);
    assert(evidence.readability.description.includes('大麦'));assert.equal(evidence.readability.hp,'700');assert.equal(evidence.readability.descriptionColour,'rgb(37, 55, 64)');assert.equal(evidence.readability.hpColour,'rgb(37, 55, 64)');await stable('firstPreview');await screenshot('readable-page');
    await nativeClick(session,'[data-shop-close]');await waitUntil(session,`!document.querySelector('#account-shop[open]')`);evidence.closeDisposed=await disposed('firstPreview');assert.equal(await evaluate(session,`document.activeElement.hasAttribute('data-room-card-shop')`),true);assert.equal(network.filter(e=>e.name==='PetShop'&&e.direction==='sent'&&e.payload.operation==='BUY').length,0);
  }else{
  evidence.sizes=[];if(!interactionsOnly)for(const [width,height]of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);const scale=Math.min(width/800,height/600);
    await waitUntil(session,`(()=>{const p=document.querySelector('${selector}'),c=p.querySelector('canvas'),r=p.getBoundingClientRect();return Math.abs(r.width-${218*scale})<1&&c.width===Math.round(r.width)&&c.height===Math.round(r.height)})()`);
    const size=await evaluate(session,`(()=>{const p=document.querySelector('${selector}'),r=p.getBoundingClientRect(),s=document.querySelector('.shop-source-stage').getBoundingClientRect(),c=p.querySelector('canvas');return {x:r.x-s.x,y:r.y-s.y,width:r.width,height:r.height,canvasWidth:c.width,canvasHeight:c.height,frames:Number(p.dataset.frames)}})()`);
    for(const[key,value]of Object.entries({x:225,y:52,width:218,height:217}))assert(Math.abs(size[key]-value*scale)<1,`${key} source rectangle at ${width}`);await stable('firstPreview');evidence.sizes.push({viewportWidth:width,viewportHeight:height,scale,...size});
    const regions=await evaluate(session,`(()=>{const d=document.querySelector('#account-shop'),s=d.querySelector('.shop-source-stage').getBoundingClientRect();return [...d.querySelectorAll('.pet-shop-source-picture')].map(e=>({name:e.dataset.sourceControl,parts:e.querySelectorAll('[data-source-image]').length}))})()`);
    assert.equal(regions.length,21);for(const name of ['lblCritical','lblLucky','cemianzhuangjia','hangditu8','lblHP','lblTank'])assert(regions.some(e=>e.name===name&&e.parts>0));
    const current=await evaluate(session,`(()=>{const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}},d=document.querySelector('#account-shop');return {dialog:box(d),refresh:box(d.querySelector('[data-pet-shop-refresh]')),status:box(d.querySelector('[data-pet-shop-status]')),list:box(d.querySelector('[data-pet-shop-item]')),buyTab:d.querySelector('[data-pet-shop-buy-tab]').getAttribute('aria-pressed'),name:d.querySelector('[data-source-control="txtName"]').textContent,count:d.querySelector('[data-source-control="txtListQuantity"]').textContent,nativeList:!!d.querySelector('select[data-pet-shop-item]')}})()`);
    assert.equal(current.nativeList,false);assert.equal(current.buyTab,'true');assert.equal(Number(current.count),network.find(e=>e.name==='PetShop'&&e.direction==='received'&&e.success).response.pets.length);assert(current.name);
    for(const box of [current.dialog,current.refresh,current.status])assert(box.x>=0&&box.y>=0&&box.x+box.w<=width+.2&&box.y+box.h<=height+.2);
    const description=await evaluate(session,`(()=>{const e=document.querySelector('[data-pet-shop-product]');return {text:e.textContent,colour:getComputedStyle(e).color,presentation:e.dataset.presentationColour,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight}})()`);assert.equal(description.colour,'rgb(37, 55, 64)');assert(description.text.includes('大麦'));evidence.sizes.at(-1).wholePage={regions,current,description};await screenshot('pet-'+width);
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},session);await waitUntil(session,`(()=>{const p=document.querySelector('${selector}'),r=p.getBoundingClientRect(),c=p.querySelector('canvas');return Math.abs(r.width-261.6)<1&&c.width===Math.round(r.width)&&c.height===Math.round(r.height)})()`);
  const descriptionPoint=await evaluate(session,`(()=>{const r=document.querySelector('[data-pet-shop-product]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mouseMoved',...descriptionPoint},session);await command('Input.dispatchMouseEvent',{type:'mouseWheel',...descriptionPoint,deltaX:0,deltaY:90},session);await waitUntil(session,`document.querySelector('[data-pet-shop-product]').scrollTop>0`);evidence.descriptionScroll=await evaluate(session,`document.querySelector('[data-pet-shop-product]').scrollTop`);await stable('firstPreview');
  await nativeClick(session,'[data-pet-shop-product-id="2"]');assert.equal(await evaluate(session,`document.querySelector('[data-pet-shop-product-id="2"]').getAttribute('aria-selected')`),'true');await nativeClick(session,'[data-pet-shop-refresh]');await waitUntil(session,`document.querySelector('#account-shop').getAttribute('aria-busy')==='false'`);await stable('firstPreview');evidence.refreshed=await saved('firstPreview');
  await nativeClick(session,'[data-pet-shop-buy]');await waitUntil(session,`document.querySelector('[data-pet-shop-status]').value.includes('已购买')`);await stable('firstPreview');evidence.purchased=await saved('firstPreview');assert((await evaluate(session,`document.querySelector('[data-pet-shop-balance]').textContent`)).includes('金币：500 · 软星币：1000'));
  await nativeClick(session,'[data-pet-shop-buy]');await waitUntil(session,`document.querySelector('[data-pet-shop-status]').value.includes('余额不足')`);await stable('firstPreview');evidence.rejected=await saved('firstPreview');assert(evidence.rejected.busy.some(s=>s.busy==='true'));for(const sample of evidence.rejected.busy)assert(sample.sameElement&&sample.sameEngine&&!sample.engineDisposed&&!sample.sceneDisposed);await screenshot('purchase-kept-preview');
  await nativeClick(session,'[data-shop-root-category="Item"]');await waitUntil(session,`!document.querySelector('${selector}')`);evidence.itemDisposed=await disposed('firstPreview');await nativeClick(session,'[data-shop-root-category="Pet"]');await ready();await witness('secondPreview');assert(await evaluate(session,`window.secondPreview.engine!==window.firstPreview.engine&&window.secondPreview.scene!==window.firstPreview.scene`));evidence.itemReopened=await saved('secondPreview');
  await nativeClick(session,'[data-shop-close]');await waitUntil(session,`!document.querySelector('#account-shop[open]')`);evidence.closeDisposed=await disposed('secondPreview');assert.equal(await evaluate(session,`document.activeElement.hasAttribute('data-room-card-shop')`),true);await open();await witness('thirdPreview');assert(await evaluate(session,`window.thirdPreview.engine!==window.secondPreview.engine&&window.thirdPreview.scene!==window.secondPreview.scene`));evidence.closeReopened=await saved('thirdPreview');await nativeClick(session,'[data-shop-close]');await waitUntil(session,`!document.querySelector('#account-shop[open]')`);evidence.finalDisposed=await disposed('thirdPreview');assert.equal(await evaluate(session,`document.activeElement.hasAttribute('data-room-card-shop')`),true);
}
evidence.status='PASS';console.log('PASS: '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)for(const[i,p]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},p.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
