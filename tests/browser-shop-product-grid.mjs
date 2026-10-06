import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {DatabaseSync, backup} from 'node:sqlite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
import {classifyItemId} from '../apps/shared/combat/item-hotkeys.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3555',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-shop-product-grid-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-shop-product-grid-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const fixture=JSON.parse(await readFile('recovery/output/browser-home-inventory-item-row-2026-10-05T09-57-14-424Z-checkpoint-fixture.json','utf8'));
const checkpoint=fixture.database??'recovery/output/home-tank-active-marker-browser.sqlite';const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3555,vite:5585,cdp:9785},runId,scope:'UI53 original two-column product region; normal Shop QUERY/all offered source rows/secondary currentprices/selection/three full viewports/Close. No BUY, repair or old owned-list validation.',checkpoint:{source:checkpoint,copied:true,originalModified:false,originalFundsFixture:true}};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3555',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5585,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3555',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9785',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9785/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9785');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5585'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

  }

  const s=pages[0].sessionId;
  assert.equal(await evaluate(s,`localStorage.getItem('cdtank-account-token')`),fixture.token);
  evidence.fixture={database:checkpoint,copied:true,originalFundsFixture:true,newFundsOrRecordsInjected:false};
  await nativeClick(s,'[data-room-card-shop]');
  await waitUntil(s,`document.querySelector('[data-shop-source-product-grid]')&&document.querySelector('[data-shop-product-id="2"]')?.matches(':enabled')`);
  const shop=network.filter(n=>n.direction==='received'&&n.name==='Shop'&&n.success).at(-1)?.response;assert(shop);
  const offered=shop.items.filter(item=>{const type=classifyItemId(item.itemTableId);return !(type>=8&&type<=12)&&type!==3;});assert(offered.length>=2);
  evidence.offered=offered.map(item=>({itemTableId:item.itemTableId,name:item.name}));
  evidence.currentOfferedCount=offered.length;evidence.currentSourceRowCount=Math.ceil(offered.length/2);
  evidence.viewports=[];evidence.screenshots=[];
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    await evaluate(s,`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
    await nativeClick(s,'[data-shop-product-id="1"]');
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',windowsVirtualKeyCode:35},s);
    await command('Input.dispatchKeyEvent',{type:'keyUp',key:'End',code:'End',windowsVirtualKeyCode:35},s);
    const last=offered.at(-1);
    await waitUntil(s,`document.querySelector('[data-shop-product-id="${last.itemTableId}"]').getAttribute('aria-selected')==='true'`);
    const tail=await evaluate(s,`(()=>{const e=document.querySelector('[data-shop-source-product-grid]'),r=e.querySelector('[data-shop-product-id="${last.itemTableId}"]'),rect=x=>x.getBoundingClientRect().toJSON();return {id:Number(r.dataset.shopProductId),list:rect(e),row:rect(r),scrollTop:e.scrollTop,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,focus:document.activeElement===r,selected:r.getAttribute('aria-selected')};})()`);
    const bottomShot=await command('Page.captureScreenshot',{format:'png'},s),bottomPath=output+'-'+width+'-bottom.png';await writeFile(bottomPath,Buffer.from(bottomShot.data,'base64'));evidence.screenshots.push(bottomPath);evidence.bottoms??=[];evidence.bottoms.push({viewport:[width,height],tail});await writeFile(output+'.json',JSON.stringify({...evidence,network},null,2)+'\n');
    assert.equal(tail.id,last.itemTableId);assert.equal(tail.selected,'true');assert(tail.focus);assert(tail.scrollTop>0);assert(tail.row.top>=tail.list.top-1&&tail.row.bottom<=tail.list.bottom+1,'last row visible within actual list clip');
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Home',code:'Home',windowsVirtualKeyCode:36},s);
    await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Home',code:'Home',windowsVirtualKeyCode:36},s);
    for(const id of [1,2]){
      await nativeClick(s,'[data-shop-product-id="'+id+'"]');assert.equal(await evaluate(s,`document.querySelector('[data-shop-product-id="${id}"]').getAttribute('aria-selected')`),'true');
      const updated=await evaluate(s,`({name:document.querySelector('[data-description-type-binding="confirmed-item-name-getter"]').textContent,info:document.querySelector('[data-shop-description-text]').textContent})`);
      const expected=offered.find(item=>item.itemTableId===id);evidence.selectionUpdates??=[];evidence.selectionUpdates.push({viewport:[width,height],id,updated});assert.equal(updated.name,expected.name);assert.equal(updated.info,expected.info);
    }
    const grid=await evaluate(s,`(()=>{const e=document.querySelector('[data-shop-source-product-grid]'),rect=x=>x.getBoundingClientRect().toJSON();return {bounds:rect(e),scrollTop:e.scrollTop,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,rows:[...e.querySelectorAll('[data-shop-source-product-row]')].map(r=>({id:Number(r.dataset.shopProductId),name:r.querySelector('[data-shop-product-row-name]').textContent,type:r.querySelector('[data-shop-product-row-type]').textContent,price:r.querySelector('[data-shop-product-row-price]').textContent,priceProvider:r.querySelector('[data-shop-product-row-price]').dataset.priceProvider,quantity:r.querySelector('[data-shop-product-row-quantity]').textContent,row:rect(r),icon:rect(r.querySelector('.shop-product-row-icon')),nameRect:rect(r.querySelector('[data-shop-product-row-name]')),selected:r.getAttribute('aria-selected'),inside:r.getBoundingClientRect().left>=0&&r.getBoundingClientRect().right<=innerWidth&&r.getBoundingClientRect().top>=0&&r.getBoundingClientRect().bottom<=innerHeight}))};})()`);
    evidence.viewports.push({viewport:[width,height],grid});
    const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+width+'.png';await writeFile(path,Buffer.from(shot.data,'base64'));evidence.screenshots.push(path);await writeFile(output+'.json',JSON.stringify({...evidence,network},null,2)+'\n');
    assert.equal(grid.rows.length,offered.length);
    const scale=grid.rows[0].row.width/171;
    grid.existingInset={x:(grid.rows[0].row.x-grid.bounds.x)/scale,y:(grid.rows[0].row.y-grid.bounds.y)/scale};
    for(const [index,row] of grid.rows.entries()){
      const item=offered[index];assert.equal(row.id,item.itemTableId);assert.equal(row.name,item.name);assert.equal(row.price,item.moneyPrice+'金币 / '+item.tokenPrice+'软星币');assert.equal(row.priceProvider,'shop-query-both-prices');assert.equal(row.quantity,'');assert(row.inside);
      assert(Math.abs(row.row.height/scale-56)<0.1);assert(Math.abs((row.row.x-grid.rows[0].row.x)/scale-(index%2)*171)<0.1);assert(Math.abs((row.row.y-grid.rows[0].row.y)/scale-Math.floor(index/2)*56)<0.1);assert(Math.abs((row.icon.x-row.row.x)/scale-14)<0.1);assert(Math.abs((row.nameRect.x-row.row.x)/scale-53)<0.1);
    }
  }
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`!document.querySelector('#account-shop[open]')&&document.activeElement.matches('[data-room-card-shop]')`);evidence.strictShopOpener=true;
  assert(network.every(n=>n.direction!=='sent'||['OwnedRoles','Inventory','RoleProfile'].includes(n.name)||n.payload?.operation==='QUERY'));evidence.noBuyRepairSlotOrRoomWrites=true;evidence.status='PASS';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{if(pages.length){try{const shot=await command('Page.captureScreenshot',{format:'png'},pages[0].sessionId);evidence.finalFrame=output+'-final.png';await writeFile(evidence.finalFrame,Buffer.from(shot.data,'base64'));}catch{}}const savedCheckpoint=output+'-checkpoint.sqlite';try{const db=new DatabaseSync(database,{readOnly:true});try{await backup(db,savedCheckpoint);}finally{db.close();}evidence.savedCheckpoint=savedCheckpoint;await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:savedCheckpoint,token:fixture.token,accountSource:checkpoint,originalFundsFixture:true,newFundsOrRecordsInjected:false},null,2)+'\n');}catch(error){evidence.checkpointSaveError=String(error);}evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
