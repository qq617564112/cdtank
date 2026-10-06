import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {DatabaseSync, backup} from 'node:sqlite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
import {classifyInventoryCategory} from '../apps/shared/combat/inventory-query.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3559',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-shop-owned-weapon-row-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-shop-owned-weapon-row-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const fixture=JSON.parse(await readFile('recovery/output/browser-home-inventory-weapon-row-2026-10-05T10-14-30-348Z-checkpoint-fixture.json','utf8'));
const checkpoint=fixture.database??'recovery/output/home-tank-active-marker-browser.sqlite';const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3559,vite:5589,cdp:9789},runId,scope:'UI53 original ownedWeapon factory/shared4b9251 row; saved lawful trap3003/qty1, source name/icon/type/independent quantity/selection/owned radio return/strictClose at three resolutions; no BUY, previous ownedItem or product region verification.',checkpoint:{source:checkpoint,copied:true,originalModified:false,originalFundsFixture:true}};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3559',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5589,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3559',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9789',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9789/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9789');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5589'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

  }

  const s=pages[0].sessionId;
  assert.equal(await evaluate(s,`localStorage.getItem('cdtank-account-token')`),fixture.token);
  evidence.fixture={database:checkpoint,copied:true,originalFundsFixture:true,newFundsOrRecordsInjected:false};
  await nativeClick(s,'[data-room-card-shop]');
  await waitUntil(s,`document.querySelector('[data-shop-source-product-grid]')&&document.querySelector('[data-shop-product-id="2"]')?.matches(':enabled')`);
  await waitUntil(s,`document.querySelector('[data-shop-owned-category="Weapon"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-owned-category="Weapon"]');
  await waitUntil(s,`document.querySelector('[data-shop-owned-instance="3"]')?.matches(':enabled')`);
  const inventory=network.filter(n=>n.direction==='received'&&n.name==='Inventory'&&n.success).at(-1)?.response;assert(inventory);
  const record=inventory.records.find(r=>r.instanceId===3);assert.equal(record.itemTableId,3003);assert.equal(record.ownedQuantity,1);
  const expected=inventory.records.filter(r=>classifyInventoryCategory(r.itemTableId)===2&&r.ownedQuantity>0);
  const catalog=await(await fetch('http://127.0.0.1:5589/combat-catalog.json')).json();
  const ui=await(await fetch('http://127.0.0.1:5589/ui.json')).json();
  const sets=ui.imagesets.filter(v=>v.attributes.Name==='daoju0'),set=sets.find(v=>v.path.includes('imagesets_dds/'))??sets[0];
  evidence.inventoryRecord=record;evidence.sourceCategoryRecords=inventory.records.filter(r=>classifyInventoryCategory(r.itemTableId)===2);evidence.screenshots=[];evidence.viewports=[];
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    await evaluate(s,`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
    await nativeClick(s,'[data-shop-owned-instance="3"]');
    const list=await evaluate(s,`(()=>{const e=document.querySelector('[data-shop-owned-list]'),rect=x=>x.getBoundingClientRect().toJSON();return {bounds:rect(e),rows:[...e.querySelectorAll('[data-shop-owned-instance]')].map(r=>({instanceId:Number(r.dataset.shopOwnedInstance),row:rect(r),name:r.querySelector('[data-shop-owned-row-name]')?.textContent,type:r.querySelector('[data-shop-owned-row-type]')?.textContent,quantity:r.querySelector('[data-shop-owned-row-quantity]')?.textContent,quantityRect:r.querySelector('[data-shop-owned-row-quantity]')?rect(r.querySelector('[data-shop-owned-row-quantity]')):null,icon:r.querySelector('.shop-owned-item-row-icon')?rect(r.querySelector('.shop-owned-item-row-icon')):null,nameRect:r.querySelector('[data-shop-owned-row-name]')?rect(r.querySelector('[data-shop-owned-row-name]')):null,asset:r.querySelector('.shop-owned-item-row-icon')?.dataset.sourceAsset,selected:r.getAttribute('aria-selected'),focused:document.activeElement===r}))};})()`);
    const frame=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+width+'.png';await writeFile(path,Buffer.from(frame.data,'base64'));evidence.screenshots.push(path);evidence.viewports.push({viewport:[width,height],list});await writeFile(output+'.json',JSON.stringify({...evidence,network},null,2)+'\n');
    assert.deepEqual(list.rows.map(r=>r.instanceId),expected.map(r=>r.instanceId));
    const row=list.rows.find(r=>r.instanceId===3),definition=catalog.items.find(v=>v.itemTableId===record.itemTableId);assert(definition);
    assert.equal(row.name,definition.name);assert.equal(row.type,'陷阱');assert.equal(row.quantity,'1');const image='data\\ui\\daoju\\'+String(definition.iconId).padStart(5,'0')+'.tga';assert.equal(row.asset,set.images.find(v=>v.Name===image)?.asset);assert.equal(row.selected,'true');assert(row.focused);
    const scale=row.row.width/161;assert(Math.abs(row.row.height/scale-56)<0.1);assert(Math.abs((row.icon.x-row.row.x)/scale-5)<0.1);assert(Math.abs((row.nameRect.x-row.row.x)/scale-44)<0.1);assert(row.quantityRect.right<=row.icon.right+0.5);assert(row.row.left>=list.bounds.left-0.5&&row.row.right<=list.bounds.right+0.5&&row.row.top>=list.bounds.top-0.5&&row.row.bottom<=list.bounds.bottom+0.5);
  }
  await nativeClick(s,'[data-shop-owned-category="Item"]');await waitUntil(s,`document.querySelector('[data-shop-owned-category="Item"]').getAttribute('aria-pressed')==='true'`);evidence.ownedItemRadioReturn=true;
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`!document.querySelector('#account-shop[open]')&&document.activeElement.matches('[data-room-card-shop]')`);evidence.strictShopOpener=true;
  assert(network.every(n=>n.direction!=='sent'||['OwnedRoles','Inventory','RoleProfile'].includes(n.name)||n.payload?.operation==='QUERY'));evidence.noBuyRepairSlotOrRoomWrites=true;evidence.status='PASS';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{if(pages.length){try{const shot=await command('Page.captureScreenshot',{format:'png'},pages[0].sessionId);evidence.finalFrame=output+'-final.png';await writeFile(evidence.finalFrame,Buffer.from(shot.data,'base64'));}catch{}}const savedCheckpoint=output+'-checkpoint.sqlite';try{const db=new DatabaseSync(database,{readOnly:true});try{await backup(db,savedCheckpoint);}finally{db.close();}evidence.savedCheckpoint=savedCheckpoint;await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:savedCheckpoint,token:fixture.token,accountSource:checkpoint,originalFundsFixture:true,newFundsOrRecordsInjected:false},null,2)+'\n');}catch(error){evidence.checkpointSaveError=String(error);}evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
