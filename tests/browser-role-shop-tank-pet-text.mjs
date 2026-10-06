import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {DatabaseSync, backup} from 'node:sqlite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3569',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-role-shop-tank-pet-text-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-role-shop-tank-source-row-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const fixture=JSON.parse(await readFile('recovery/output/browser-home-inventory-item-row-2026-10-05T09-57-14-424Z-checkpoint-fixture.json','utf8'));
const checkpoint=fixture.database??'recovery/output/home-tank-active-marker-browser.sqlite';const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3569,vite:5599,cdp:9799},runId,scope:'UI57 original161x56 product4bbd0a row; formalTankQUERY name/icon and natural ten-row overflow/selection/Close three resolutions; three text outputs and extraicon unbound; Pet two new original text lines, noBUY/oldShop row suite',checkpoint:{source:checkpoint,copied:true,originalModified:false,originalFundsFixture:true}};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3569',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5599,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3569',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9799',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9799/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9799');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop','RoleProfile','Kitbag','TankTextures','CreateRoom','JoinRoom','LeaveRoom'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5599'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

  }

  const s=pages[0].sessionId;
  assert.equal(await evaluate(s,`localStorage.getItem('cdtank-account-token')`),fixture.token);
  evidence.fixture={database:checkpoint,copied:true,originalFundsFixture:true,newFundsOrRecordsInjected:false};
  await nativeClick(s,'[data-room-card-shop]');
  await waitUntil(s,`document.querySelector('[data-shop-root-category="Tank"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-root-category="Tank"]');
  await waitUntil(s,`document.querySelectorAll('[data-tank-shop-source-row]').length===10&&document.querySelector('[data-tank-shop-source-row]')?.matches(':enabled')`);
  const query=network.filter(n=>n.direction==='received'&&n.name==='TankShop'&&n.success).at(-1)?.response;
  assert(query);const products=query.tanks;
  const iconContract=JSON.parse(await readFile('recovery/output/role-shop-tank-source-icon-provider.json','utf8'));
  evidence.confirmedProducts=products.map(p=>({tankId:p.tankId,name:p.name}));
  evidence.screenshots=[];evidence.viewports=[];
  async function press(key,code,windowsVirtualKeyCode){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode},s);}
  const metrics=()=>evaluate(s,`(()=>{const list=document.querySelector('[data-role-shop-list="tank"]'),rect=e=>e.getBoundingClientRect().toJSON();return {scale:Math.min(innerWidth/800,innerHeight/600),list:rect(list),clientHeight:list.clientHeight,scrollHeight:list.scrollHeight,scrollTop:list.scrollTop,rows:[...list.querySelectorAll('[data-tank-shop-source-row]')].map(r=>({id:Number(r.dataset.tankShopProductId),bounds:rect(r),selected:r.getAttribute('aria-selected'),name:r.querySelector('[data-tank-row-name]').textContent,icon:r.querySelector('[data-tank-row-icon]').dataset.sourceAsset,iconBounds:rect(r.querySelector('[data-tank-row-icon]')),secondary:r.querySelector('[data-tank-row-secondary]').textContent,tertiary:r.querySelector('[data-tank-row-tertiary]').textContent,fourth:r.querySelector('[data-tank-row-fourth]').textContent}))};})()`);
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    await nativeClick(s,'[data-tank-shop-source-row="'+products[0].tankId+'"]');
    await press('Home','Home',36);
    await waitUntil(s,`document.querySelector('[data-tank-shop-source-row="${products[0].tankId}"]').getAttribute('aria-selected')==='true'`);
    const top=await metrics();const topShot=await command('Page.captureScreenshot',{format:'png'},s),topPath=output+'-'+width+'-top.png';await writeFile(topPath,Buffer.from(topShot.data,'base64'));evidence.screenshots.push(topPath);
    await press('End','End',35);
    await waitUntil(s,`document.querySelector('[data-tank-shop-source-row="${products.at(-1).tankId}"]').getAttribute('aria-selected')==='true'`);
    await evaluate(s,`new Promise(r=>requestAnimationFrame(r))`);
    const bottom=await metrics();const bottomShot=await command('Page.captureScreenshot',{format:'png'},s),bottomPath=output+'-'+width+'-bottom.png';await writeFile(bottomPath,Buffer.from(bottomShot.data,'base64'));evidence.screenshots.push(bottomPath);evidence.viewports.push({viewport:[width,height],top,bottom});
    await writeFile(output+'.json',JSON.stringify({...evidence,network},null,2)+'\n');
    assert.deepEqual(top.rows.map(r=>r.id),products.map(p=>p.tankId));
    for(let index=0;index<top.rows.length;index++){
      const row=top.rows[index],product=products[index],icon=iconContract.tanks.find(p=>p.tankId===product.tankId);
      assert.equal(row.name,product.name);assert(icon?.asset);assert.equal(row.icon,icon.asset);
      assert(Math.abs(row.bounds.width-161*top.scale)<1);assert(Math.abs(row.bounds.height-56*top.scale)<1);
      assert(Math.abs(row.iconBounds.width-32*top.scale)<1);assert(Math.abs(row.iconBounds.height-32*top.scale)<1);
      assert.equal(row.secondary,'');assert.equal(row.tertiary,'');assert.equal(row.fourth,'');
      if(index)assert(Math.abs(row.bounds.y-top.rows[index-1].bounds.y-56*top.scale)<1);
    }
    const last=bottom.rows.at(-1);assert(bottom.scrollHeight>bottom.clientHeight);assert(bottom.scrollTop>0);
    assert.equal(last.selected,'true');assert(last.bounds.top>=bottom.list.top-1&&last.bounds.bottom<=bottom.list.bottom+1);
    assert(last.bounds.left>=0&&last.bounds.right<=width&&last.bounds.top>=0&&last.bounds.bottom<=height);
  }
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`!document.querySelector('#account-shop[open]')&&document.activeElement.matches('[data-room-card-shop]')`);evidence.strictShopOpener=true;
  await nativeClick(s,'[data-room-card-shop]');
  await waitUntil(s,`document.querySelector('[data-shop-root-category="Pet"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-root-category="Pet"]');
  await waitUntil(s,`document.querySelectorAll('[data-pet-shop-source-row]').length===8`);
  const petProducts=network.filter(n=>n.direction==='received'&&n.name==='PetShop'&&n.success).at(-1)?.response.pets;assert(petProducts);
  const petSource=JSON.parse(await readFile('recovery/output/role-shop-pet-secondary-tertiary-native.json','utf8'));
  evidence.petText=[];
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    for(const id of [2,103]){
      await nativeClick(s,'[data-pet-shop-source-row="'+id+'"]');
      const rows=await evaluate(s,`(()=>{const rect=e=>e.getBoundingClientRect().toJSON();return [...document.querySelectorAll('[data-pet-shop-source-row]')].map(r=>({id:Number(r.dataset.petShopProductId),secondary:r.querySelector('[data-pet-row-secondary]').textContent,tertiary:r.querySelector('[data-pet-row-tertiary]').textContent,secondaryBounds:rect(r.querySelector('[data-pet-row-secondary]')),tertiaryBounds:rect(r.querySelector('[data-pet-row-tertiary]'))}));})()`);
      const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+width+'-pet-'+id+'.png';await writeFile(path,Buffer.from(shot.data,'base64'));evidence.screenshots.push(path);evidence.petText.push({viewport:[width,height],selected:id,rows,path});
      await writeFile(output+'.json',JSON.stringify({...evidence,network},null,2)+'\n');
      for(const row of rows){const original=petSource.rows.find(p=>p.petId===row.id),product=petProducts.find(p=>p.petId===row.id);assert(original&&product);assert.equal(product.tokenPrice,original.petCoin);assert.equal(row.secondary,original.text);assert.equal(row.tertiary,'购买价  星币'+original.actualNumericText);}
      const selected=rows.find(r=>r.id===id);assert(selected.secondaryBounds.left>=0&&selected.tertiaryBounds.right<=width);assert(selected.secondaryBounds.top>=0&&selected.tertiaryBounds.bottom<=height);
    }
  }
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`!document.querySelector('#account-shop[open]')&&document.activeElement.matches('[data-room-card-shop]')`);evidence.petStrictShopOpener=true;
  assert(network.every(n=>n.direction!=='sent'||['OwnedRoles','Inventory','RoleProfile'].includes(n.name)||n.payload?.operation==='QUERY'));evidence.noBuyRepairSlotOrRoomWrites=true;evidence.status='PASS';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{if(pages.length){try{const shot=await command('Page.captureScreenshot',{format:'png'},pages[0].sessionId);evidence.finalFrame=output+'-final.png';await writeFile(evidence.finalFrame,Buffer.from(shot.data,'base64'));}catch{}}const savedCheckpoint=output+'-checkpoint.sqlite';try{const db=new DatabaseSync(database,{readOnly:true});try{await backup(db,savedCheckpoint);}finally{db.close();}evidence.savedCheckpoint=savedCheckpoint;await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:savedCheckpoint,token:fixture.token,accountSource:checkpoint,originalFundsFixture:true,newFundsOrRecordsInjected:false},null,2)+'\n');}catch(error){evidence.checkpointSaveError=String(error);}evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
