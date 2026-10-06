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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3369',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-tank-shop-texture-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-tank-shop-texture-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const rejectionOnly=process.argv.includes('--rejection-only');
const evidence={status:'RUNNING',ports:{server:3369,vite:5419,cdp:9619},runId,scope:'M5-10/UI-59 formal Tank rdoTexture, real owned instance list, existing configuration transaction and source controls; original parent attachment/currency imagery/full fidelity incomplete.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3369',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'30'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5419,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3369',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9619',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9619/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9619');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5419',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const session=pages[0].sessionId;
  store=new AccountStore(database);const account=store.open(await evaluate(session,`localStorage.getItem('cdtank-account-token')`));const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0x70,20000,true);view.setUint32(0x74,rejectionOnly ? 25 : 200,true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});store.close();store=undefined;evidence.fixture={money:20000,tokens:rejectionOnly ? 25 : 200,initialOwnedTank3:false};
  async function witness(name){await evaluate(session,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url);const element=document.querySelector('${selector}'),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===element.querySelector('canvas'));if(!engine)throw new Error('Product preview engine missing');const scene=engine.scenes[0],meshes=scene.meshes.filter(m=>m.isEnabled()&&m.getTotalVertices()>0);const w=window[${JSON.stringify(name)}]={element,engine,scene,draws:0,busy:[],materials:meshes.map(m=>({name:m.name,vertices:m.getTotalVertices(),textures:m.material?.getActiveTextures().map(t=>t.url??t.name)}))};for(const mesh of meshes)mesh.onAfterRenderObservable.add(()=>w.draws++);w.observer=new MutationObserver(()=>w.busy.push({busy:document.querySelector('#account-shop')?.getAttribute('aria-busy'),sameElement:w.element===document.querySelector('${selector}'),sameEngine:w.engine.getRenderingCanvas()===document.querySelector('${selector}')?.querySelector('canvas'),sceneDisposed:w.scene.isDisposed,engineDisposed:w.engine.isDisposed}));w.observer.observe(document.querySelector('#account-shop'),{attributes:true,attributeFilter:['aria-busy'],subtree:false});})()`);await waitUntil(session,`window[${JSON.stringify(name)}].draws>0`);}
  async function stable(name){assert(await evaluate(session,`(()=>{const w=window[${JSON.stringify(name)}];return w.element===document.querySelector('${selector}')&&w.engine.getRenderingCanvas()===w.element.querySelector('canvas')&&!w.engine.isDisposed&&!w.scene.isDisposed})()`),'Preview scene must remain mounted');}
  async function saved(name){return evaluate(session,`(()=>{const w=window[${JSON.stringify(name)}];return {dataset:{...w.element.dataset},draws:w.draws,materials:w.materials,busy:w.busy}})()`);}
  async function disposed(name){const result=await evaluate(session,`(()=>{const w=window[${JSON.stringify(name)}];w.observer.disconnect();return {engine:w.engine.isDisposed,scene:w.scene.isDisposed,connected:w.element.isConnected,frames:w.element.dataset.frames}})()`);assert.equal(result.engine,true);assert.equal(result.scene,true);assert.equal(result.connected,false);await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);assert.equal(await evaluate(session,`window[${JSON.stringify(name)}].element.dataset.frames`),result.frames);return result;}
  async function screenshot(suffix){const shot=await command('Page.captureScreenshot',{format:'png'},session);await writeFile(output+'-'+suffix+'.png',Buffer.from(shot.data,'base64'));}
  const selector='[data-tank-shop-texture-preview]';
  await nativeClick(session,'[data-room-card-shop]');await waitUntil(session,`document.querySelector('[data-shop-root-category="Tank"]')?.matches(':enabled')`);
  await nativeClick(session,'[data-shop-root-category="Tank"]');await waitUntil(session,`document.querySelector('[data-tank-shop-texture-tab]')?.matches(':enabled')`);
  await nativeClick(session,'[data-tank-shop-texture-tab]');await waitUntil(session,`document.querySelector('[data-tank-shop-texture-status]').value.includes('没有拥有')`);
  assert.equal(await evaluate(session,`document.querySelectorAll('[data-tank-shop-owned-instance]').length`),0);
  assert.equal(await evaluate(session,`document.querySelector('[data-tank-shop-texture-save]').disabled`),true);evidence.emptyOwned=true;
  await nativeClick(session,'[data-tank-shop-buy-tab]');await waitUntil(session,`document.querySelector('[data-tank-shop-buy]')?.matches(':enabled')`);
  await nativeClick(session,'[data-tank-shop-product-id="3"]');await nativeClick(session,'[data-tank-shop-buy]');await waitUntil(session,`document.querySelector('[data-tank-shop-status]').value.includes('已购买')`);
  const purchased=network.find(e=>e.name==='TankShop'&&e.direction==='received'&&e.response?.purchased)?.response.purchased;
  evidence.purchased=purchased;assert(purchased);const instance=purchased.fields.find(([offset])=>offset===0x1c)[1];
  await nativeClick(session,'[data-tank-shop-texture-tab]');await waitUntil(session,`document.querySelector('[data-tank-shop-owned-instance="${instance}"]')?.matches(':enabled')`);
  await nativeClick(session,`[data-tank-shop-owned-instance="${instance}"]`);
  async function ready(){await waitUntil(session,`(()=>{const p=document.querySelector('${selector}');return p?.dataset.status==='ready'&&p.dataset.renderedTankId==='3'&&Number(p.dataset.meshes)>0})()`);}
  await ready();await witness('firstPreview');evidence.initial=await saved('firstPreview');
  evidence.sizes=[];if(!rejectionOnly)for(const[width,height]of[[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);const scale=Math.min(width/800,height/600);
    await waitUntil(session,`Math.abs(document.querySelector('.shop-source-stage').getBoundingClientRect().width-${625*scale})<.2`);
    await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const page=await evaluate(session,`(()=>{const d=document.querySelector('#account-shop'),p=d.querySelector('${selector}'),r=p.getBoundingClientRect();return {preview:{x:r.x,y:r.y,w:r.width,h:r.height},regions:d.querySelectorAll('.tank-shop-source-picture').length,textureRegions:d.querySelectorAll('.tank-shop-texture-source-picture').length,selected:d.querySelector('[data-tank-shop-texture-tab]').getAttribute('aria-pressed'),count:d.querySelector('[data-source-control="txtListQuantity"]').textContent,saveDisabled:d.querySelector('[data-tank-shop-texture-save]').disabled,names:[...d.querySelectorAll('[data-texture-part]')].map(e=>e.textContent)}})()`);
    assert.equal(page.regions,38);assert.equal(page.textureRegions,9);assert.equal(page.selected,'true');assert.equal(page.count,'1');assert.equal(page.saveDisabled,true);assert(page.names.every(Boolean));await stable('firstPreview');evidence.sizes.push({width,height,scale,page});await screenshot('texture-'+width);
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},session);await waitUntil(session,`Math.abs(document.querySelector('.shop-source-stage').getBoundingClientRect().width-1125)<.2`);
  const press=async(key,code,vk)=>{await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk},session);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk},session);};
  await nativeClick(session,`[data-tank-shop-owned-instance="${instance}"]`);await press('End','End',35);await press('Home','Home',36);assert.equal(await evaluate(session,`document.activeElement.dataset.tankShopOwnedInstance`),String(instance));
  // Follow normal arrows to a source-confirmed paid turret candidate, without injecting state.
  const target=31011;let candidate;for(let index=0;index<25;index++){
    await nativeClick(session,'[data-source-control="btnIncTurretTexture"]');candidate=JSON.parse(await evaluate(session,`document.querySelector('[data-tank-shop-texture-status]').dataset.textureSelection`));if(candidate.U===target)break;
  }
  assert.equal(candidate.U,target);await ready();await stable('firstPreview');assert.equal(await evaluate(session,`document.querySelector('[data-tank-shop-texture-save]').disabled`),false);evidence.candidate=await saved('firstPreview');if(!rejectionOnly)await screenshot('candidate');
  if(rejectionOnly){
    const initialTextures=JSON.parse(evidence.initial.dataset.tankTextures);
    await nativeClick(session,'[data-tank-shop-texture-save]');await waitUntil(session,`document.querySelector('[data-tank-shop-texture-status]').value==='代币余额不足'&&document.querySelector('#account-shop').getAttribute('aria-busy')==='false'`);await ready();await stable('firstPreview');
    assert.deepEqual(JSON.parse(await evaluate(session,`document.querySelector('[data-tank-shop-texture-status]').dataset.textureSelection`)),initialTextures);
    const result=network.find(e=>e.name==='TankTextures'&&e.direction==='received');assert.equal(result.success,false);assert.equal(result.response.message,'代币余额不足');evidence.rejected=result;evidence.rejectedPreview=await saved('firstPreview');await screenshot('rejected');await nativeClick(session,'[data-tank-shop-texture-refresh]');await waitUntil(session,`document.querySelector('#account-shop').getAttribute('aria-busy')==='false'`);await ready();await stable('firstPreview');const role=network.filter(e=>e.name==='RoleProfile'&&e.direction==='received'&&e.success).at(-1).response.profile;assert.equal(new DataView(Uint8Array.from(role.bytes).buffer).getUint32(0x74,true),25);assert.deepEqual(JSON.parse(await evaluate(session,`document.querySelector('[data-tank-shop-texture-status]').dataset.textureSelection`)),initialTextures);evidence.rejectedProfile=role;
    await nativeClick(session,'[data-shop-close]');await waitUntil(session,`!document.querySelector('#account-shop[open]')`);evidence.closeDisposed=await disposed('firstPreview');assert.equal(await evaluate(session,`document.activeElement.hasAttribute('data-room-card-shop')`),true);
  }else{
  await nativeClick(session,'[data-tank-shop-texture-save]');await waitUntil(session,`document.querySelector('[data-tank-shop-texture-status]').value==='战车迷彩已保存'&&document.querySelector('#account-shop').getAttribute('aria-busy')==='false'`);await ready();await stable('firstPreview');evidence.saved=await saved('firstPreview');
  const result=network.find(e=>e.name==='TankTextures'&&e.direction==='received'&&e.success)?.response;assert.equal(result.confirmation.result,3);assert.equal(result.confirmation.textures.U,target);assert.equal(new DataView(Uint8Array.from(result.profile.bytes).buffer).getUint32(0x74,true),150);evidence.transaction=result;
  assert.equal(await evaluate(session,`document.querySelector('[data-tank-shop-texture-save]').disabled`),true);assert.equal(await evaluate(session,`document.activeElement.dataset.tankShopOwnedInstance`),String(instance));await screenshot('saved');
  await nativeClick(session,'[data-tank-shop-texture-refresh]');await waitUntil(session,`document.querySelector('#account-shop').getAttribute('aria-busy')==='false'`);await ready();await stable('firstPreview');assert.equal(JSON.parse(await evaluate(session,`document.querySelector('[data-tank-shop-texture-status]').dataset.textureSelection`)).U,target);evidence.refreshed=await saved('firstPreview');
  await nativeClick(session,'[data-tank-shop-buy-tab]');await waitUntil(session,`!document.querySelector('${selector}')`);evidence.buyDisposed=await disposed('firstPreview');
  await nativeClick(session,'[data-tank-shop-texture-tab]');await ready();await witness('secondPreview');assert.equal(JSON.parse(await evaluate(session,`document.querySelector('[data-tank-shop-texture-status]').dataset.textureSelection`)).U,target);
  await nativeClick(session,'[data-shop-close]');await waitUntil(session,`!document.querySelector('#account-shop[open]')`);evidence.closeDisposed=await disposed('secondPreview');assert.equal(await evaluate(session,`document.activeElement.hasAttribute('data-room-card-shop')`),true);
  }
  assert.equal(network.filter(e=>e.name==='TankTextures'&&e.direction==='sent').length,1);evidence.status='PASS';console.log('PASS: '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)for(const[i,p]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},p.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
