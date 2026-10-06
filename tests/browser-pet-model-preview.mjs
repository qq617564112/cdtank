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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3246',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const lateOnly=process.argv.includes('--late-only');
const output='recovery/output/browser-pet-model-preview-'+(lateOnly?'late-only-':'')+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-pet-model-preview-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3246,vite:5406,cdp:9606},runId,lateOnly,scope:'Home/Shop original pet2 n1 model actual draw/material/morph; retained scenes on candidate/selection/refresh/BUY rejection, three source resolutions, page/close/reopen disposal; purchase and battle evidence reused.'};
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
      return await evaluate(session, `(async()=>{const deadline=Date.now()+${timeout};while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('[data-tank-shop-status]')?.value+' '+document.querySelector('[data-pet-model-preview]')?.dataset.status);})()`);
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
async function nativeSelect(session, selector, value) {
  const index = await evaluate(session, `Array.from(document.querySelector(${JSON.stringify(selector)}).options).filter(o=>!o.disabled).findIndex(o=>o.value===${JSON.stringify(String(value))})`);
  assert(index >= 0, `${selector} option ${value}`);
  await nativeClick(session, selector);
  const press = async (key, code, windowsVirtualKeyCode) => {
    await command('Input.dispatchKeyEvent', {type:'keyDown',key,code,windowsVirtualKeyCode}, session);
    await command('Input.dispatchKeyEvent', {type:'keyUp',key,code,windowsVirtualKeyCode}, session);
  };
  await press('Home', 'Home', 36);
  for(let step=0;step<index;step++)await press('ArrowDown', 'ArrowDown', 40);
  await press('Enter', 'Enter', 13);
  await waitUntil(session, `document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(String(value))}`);
  assert.equal(await evaluate(session, `document.querySelector(${JSON.stringify(selector)}).value`), String(value));
}
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3246',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'30'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5406,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3246',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9606',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9606/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9606');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['PetShop','SelectRole','OwnedRoles','RoleProfile','Account'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5406',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const ui=JSON.parse(await readFile('recovery/output/web-assets/ui.json','utf8')),sourcePet=JSON.parse(await readFile('recovery/output/pet-purchase-source-sol.json','utf8')).pet.values;store=new AccountStore(database);const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(r=>r.tankId===1&&r.part===0);
  for(const [index,page]of pages.entries()){const account=store.open(await evaluate(page.sessionId,`localStorage.getItem('cdtank-account-token')`));const base=new Map(Object.keys(native.base).map(k=>[Number(k),0])),tank=new Map(Object.keys(native.equipment).map(k=>[Number(k),0]));base.set(0,73);base.set(8,1);base.set(0x2c,600);base.set(0x34,5);base.set(0x3c,10);tank.set(0x1c,74);tank.set(0x24,1);tank.set(0x3c,100);tank.set(0x40,70);tank.set(0x4c,15);tank.set(0x50,30);tank.set(0x58,2001);const pet2=new Map(base);pet2.set(0,75);pet2.set(8,2);pet2.set(0x2c,700);pet2.set(0x34,20);pet2.set(0x3c,8);for(let i=0;i<6;i++){pet2.set(0x44+i*4,Number(sourcePet['Skill'+i]));pet2.set(0x5c+i*4,Number(sourcePet['SkillLv'+i]));}store.replaceRoleRecords(account.accountId,{base:[{name:'Fixture pet1',fields:base},{name:'Fixture 大麦pet2',fields:pet2}],equipment:[{name:'Fixture tank1',fields:tank}]});const bytes=new Uint8Array(0x170),v=new DataView(bytes.buffer);v.setUint32(0xa4,73,true);v.setUint32(0xa8,74,true);v.setUint32(0x70,4000,true);v.setUint32(0x74,1000,true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});}store.close();store=undefined;evidence.fixture={ownedPets:[{instance:73,petId:1,maxHp:600},{instance:75,petId:2,maxHp:700}],sameTank1:74};
  const session=pages[0].sessionId;let selector='[data-home-pet-preview]';
  async function ready(id=2){await waitUntil(session,`(()=>{const p=document.querySelector('${selector}');return p?.dataset.status==='ready'&&p.dataset.renderedPetId==='${id}'&&Number(p.dataset.meshes)>0})()`);}
  async function home(){await nativeClick(session,'[data-room-card-home]');await waitUntil(session,`document.querySelector('[data-role-tab="pet"]')`);await nativeClick(session,'[data-role-tab="pet"]');await waitUntil(session,`document.querySelector('[data-owned-role="75"]')?.matches(':enabled')`);await nativeClick(session,'[data-owned-role="75"]');await ready();}
  async function shop(){await nativeClick(session,'[data-room-card-shop]');await waitUntil(session,`document.querySelector('[data-shop-root-category="Pet"]')?.matches(':enabled')`);if(!await evaluate(session,`Boolean(document.querySelector('${selector}'))`))await nativeClick(session,'[data-shop-root-category="Pet"]');await ready();}
  async function witness(name){await evaluate(session,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url),element=document.querySelector('${selector}'),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===element.querySelector('canvas')),scene=engine.scenes[0];const w=window[${JSON.stringify(name)}]={element,engine,scene,draws:0,samples:[],materials:[],busy:[]};const record=()=>{const meshes=scene.meshes.filter(m=>m.isEnabled()&&m.getTotalVertices()>0);for(const mesh of meshes){if(!w.materials.some(m=>m.uniqueId===mesh.uniqueId))w.materials.push({uniqueId:mesh.uniqueId,name:mesh.name,vertices:mesh.getTotalVertices(),material:mesh.material?.name,metadata:mesh.material?.metadata,textures:mesh.material?.getActiveTextures().map(t=>({name:t.name,url:t.url,ready:t.isReady()})),morphTargets:mesh.morphTargetManager?.numTargets??0});if(!mesh.previewWitness){mesh.previewWitness=true;mesh.onAfterRenderObservable.add(()=>w.draws++);}}const root=scene.getTransformNodeByName('pet-preview-2');if(root&&w.samples.length<60)w.samples.push({time:root.metadata?.time,morph:meshes.flatMap(m=>Array.from({length:m.morphTargetManager?.numTargets??0},(_,i)=>m.morphTargetManager.getTarget(i).influence)),alpha:scene.activeCamera.alpha});};w.observer=scene.onAfterRenderObservable.add(record);const container=element.closest('dialog');w.busyObserver=new MutationObserver(()=>w.busy.push({busy:container.getAttribute('aria-busy'),sameElement:w.element===document.querySelector('${selector}'),sameEngine:w.engine.getRenderingCanvas()===document.querySelector('${selector}')?.querySelector('canvas'),sceneDisposed:w.scene.isDisposed,engineDisposed:w.engine.isDisposed}));w.busyObserver.observe(container,{attributes:true,attributeFilter:['aria-busy']});record();})()`);await waitUntil(session,`window[${JSON.stringify(name)}].draws>0&&window[${JSON.stringify(name)}].samples.length>=6`);}
  async function saved(name){return evaluate(session,`(()=>{const w=window[${JSON.stringify(name)}];return {dataset:{...w.element.dataset},draws:w.draws,samples:w.samples,materials:w.materials,busy:w.busy}})()`);}
  async function stable(name){assert(await evaluate(session,`(()=>{const w=window[${JSON.stringify(name)}];return w.element===document.querySelector('${selector}')&&!w.engine.isDisposed&&!w.scene.isDisposed&&w.engine.getRenderingCanvas()===w.element.querySelector('canvas')})()`));}
  async function disposed(name){const r=await evaluate(session,`(()=>{const w=window[${JSON.stringify(name)}];w.busyObserver.disconnect();return {engine:w.engine.isDisposed,scene:w.scene.isDisposed,connected:w.element.isConnected,frames:w.element.dataset.frames}})()`);assert(r.engine&&r.scene&&!r.connected);await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);assert.equal(await evaluate(session,`window[${JSON.stringify(name)}].element.dataset.frames`),r.frames);return r;}
  async function shot(suffix){const result=await command('Page.captureScreenshot',{format:'png'},session);await writeFile(output+'-'+suffix+'.png',Buffer.from(result.data,'base64'));}
  function sourceRect(suffix){const l=ui.layouts.find(l=>l.path.endsWith(suffix)),c=l.windows.find(c=>c.name==='picModel'),rect=c.properties.AbsoluteRect.match(/-?[0-9]+(?:[.][0-9]+)?/g).map(Number);let x=rect[0],y=rect[1];for(let p=c.parent;p;){const o=l.windows.find(c=>c.name===p),r=o.properties.AbsoluteRect.match(/-?[0-9]+(?:[.][0-9]+)?/g).map(Number);x+=r[0];y+=r[1];p=o.parent;}return{x,y,width:rect[2]-rect[0],height:rect[3]-rect[1]};}
  async function sizes(kind,name){const expected=sourceRect(kind==='home'?'myhome_petpage.xml':'shop_petpage.xml'),stage=kind==='home'?'.home-roles-stage':'.shop-source-stage',out=[];for(const[width,height]of[[800,600],[1920,1080],[3840,2160]]){const scale=Math.min(width/800,height/600);await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);await waitUntil(session,`(()=>{const p=document.querySelector('${selector}'),r=p.getBoundingClientRect(),c=p.querySelector('canvas');return Math.abs(r.width-${expected.width*scale})<1&&c.width===Math.round(r.width)&&c.height===Math.round(r.height)})()`);const actual=await evaluate(session,`(()=>{const p=document.querySelector('${selector}'),r=p.getBoundingClientRect(),s=document.querySelector('${stage}').getBoundingClientRect(),c=p.querySelector('canvas');return{x:r.x-s.x,y:r.y-s.y,width:r.width,height:r.height,canvasWidth:c.width,canvasHeight:c.height}})()`);out.push({viewportWidth:width,viewportHeight:height,scale,...actual});for(const[k,v]of Object.entries(expected))assert(Math.abs(actual[k]-v*scale)<1,`${kind} ${width} ${k}`);await stable(name);await shot(kind+'-'+width);}await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},session);await waitUntil(session,`Math.abs(document.querySelector('${selector}').getBoundingClientRect().width-${expected.width*1.2})<1`);return{source:expected,observed:out};}
  if(lateOnly){
    let paused;const completed=[];ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.sessionId!==session)return;if(m.method==='Fetch.requestPaused')paused=m.params;if(['Network.loadingFinished','Network.loadingFailed'].includes(m.method))completed.push({method:m.method,...m.params});});await command('Fetch.enable',{patterns:[{urlPattern:'*Data/Pet/002/n1.glb',requestStage:'Response'}]},session);
    await nativeClick(session,'[data-room-card-home]');await waitUntil(session,`document.querySelector('[data-role-tab="pet"]')`);await nativeClick(session,'[data-role-tab="pet"]');await waitUntil(session,`document.querySelector('[data-owned-role="75"]')?.matches(':enabled')`);await nativeClick(session,'[data-owned-role="75"]');const deadline=Date.now()+10000;while(!paused&&Date.now()<deadline)await new Promise(r=>setTimeout(r,25));assert(paused,'Real pet2 response must be paused');
    await evaluate(session,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url),element=document.querySelector('${selector}'),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===element.querySelector('canvas'));window.latePreview={element,engine,scene:engine.scenes[0],EngineStore,busyObserver:{disconnect(){}}};})()`);evidence.paused={requestId:paused.requestId,networkId:paused.networkId,url:paused.request.url,status:paused.responseStatusCode,preview:await evaluate(session,`({...window.latePreview.element.dataset})`)};assert.equal(evidence.paused.preview.status,'loading');
    await nativeClick(session,'[data-roles-close]');await waitUntil(session,`!document.querySelector('#home-roles[open]')`);evidence.lateDisposed=await disposed('latePreview');await command('Fetch.continueResponse',{requestId:paused.requestId},session);await command('Fetch.disable',{},session);const completionDeadline=Date.now()+10000;while(!completed.some(e=>e.requestId===paused.networkId)&&Date.now()<completionDeadline)await new Promise(r=>setTimeout(r,25));evidence.responseCompleted=completed.find(e=>e.requestId===paused.networkId);assert(evidence.responseCompleted,'Paused original model response must finish or fail');await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);evidence.afterResponse=await evaluate(session,`(()=>{const w=window.latePreview;return{engineDisposed:w.engine.isDisposed,sceneDisposed:w.scene.isDisposed,frames:w.element.dataset.frames,connected:w.element.isConnected,mounted:!!document.querySelector('[data-home-pet-preview]'),registered:w.EngineStore.Instances.includes(w.engine)}})()`);assert(evidence.afterResponse.engineDisposed&&evidence.afterResponse.sceneDisposed&&!evidence.afterResponse.connected&&!evidence.afterResponse.mounted&&!evidence.afterResponse.registered);assert.equal(evidence.afterResponse.frames,evidence.lateDisposed.frames);
    await home();await witness('lateReopened');evidence.lateReopened=await saved('lateReopened');await shot('late-reopened');await nativeClick(session,'[data-roles-close]');await waitUntil(session,`!document.querySelector('#home-roles[open]')`);evidence.lateFinalDisposed=await disposed('lateReopened');
  }else{
  await home();await witness('homePreview');evidence.home=await saved('homePreview');assert(evidence.home.materials.some(m=>m.morphTargets>0));assert(evidence.home.materials.some(m=>m.textures?.some(t=>t.ready)));evidence.sourceGlb={path:'Data/Pet/002/n1.glb',material:'11005.tga',duration:6401};assert(new Set(evidence.home.samples.map(s=>JSON.stringify(s.morph))).size>1);evidence.homeSizes=await sizes('home','homePreview');
  await nativeClick(session,'[data-owned-role="73"]');await ready(1);await stable('homePreview');await nativeClick(session,'[data-owned-role="75"]');await ready(2);await stable('homePreview');await nativeClick(session,'.home-role-use');await waitUntil(session,`document.querySelector('.home-role-use').dataset.selectedInstance==='75'&&document.querySelector('#home-roles').getAttribute('aria-busy')==='false'`);await stable('homePreview');evidence.homeConfirmed=await saved('homePreview');
  await nativeClick(session,'[data-role-tab="tank"]');await waitUntil(session,`!document.querySelector('${selector}')`);evidence.homeCategoryDisposed=await disposed('homePreview');await nativeClick(session,'[data-role-tab="pet"]');await ready();await witness('homeReopened');await nativeClick(session,'[data-roles-close]');await waitUntil(session,`!document.querySelector('#home-roles[open]')`);evidence.homeCloseDisposed=await disposed('homeReopened');await home();await witness('homeFinal');evidence.homeReopen=await saved('homeFinal');await nativeClick(session,'[data-roles-close]');await waitUntil(session,`!document.querySelector('#home-roles[open]')`);evidence.homeFinalDisposed=await disposed('homeFinal');
  selector='[data-shop-pet-preview]';await shop();await witness('shopPreview');evidence.shop=await saved('shopPreview');assert(new Set(evidence.shop.samples.map(s=>JSON.stringify(s.morph))).size>1);evidence.shopSizes=await sizes('shop','shopPreview');await nativeClick(session,'[data-pet-shop-refresh]');await waitUntil(session,`document.querySelector('#account-shop').getAttribute('aria-busy')==='false'`);await stable('shopPreview');await nativeClick(session,'[data-pet-shop-buy]');await waitUntil(session,`document.querySelector('[data-pet-shop-status]').value.includes('已购买')`);await stable('shopPreview');await nativeClick(session,'[data-pet-shop-buy]');await waitUntil(session,`document.querySelector('[data-pet-shop-status]').value.includes('余额不足')`);await stable('shopPreview');evidence.shopConfirmed=await saved('shopPreview');for(const row of evidence.shopConfirmed.busy)assert(row.sameElement&&row.sameEngine&&!row.sceneDisposed&&!row.engineDisposed);await shot('shop-confirmed');
  await nativeClick(session,'[data-shop-root-category="Item"]');await waitUntil(session,`!document.querySelector('${selector}')`);evidence.shopCategoryDisposed=await disposed('shopPreview');await nativeClick(session,'[data-shop-root-category="Pet"]');await ready();await witness('shopReopened');await nativeClick(session,'[data-shop-close]');await waitUntil(session,`!document.querySelector('#account-shop[open]')`);evidence.shopCloseDisposed=await disposed('shopReopened');await shop();await witness('shopFinal');evidence.shopReopen=await saved('shopFinal');await nativeClick(session,'[data-shop-close]');await waitUntil(session,`!document.querySelector('#account-shop[open]')`);evidence.shopFinalDisposed=await disposed('shopFinal');}evidence.status='PASS';console.log('PASS: '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)for(const[i,p]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},p.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
