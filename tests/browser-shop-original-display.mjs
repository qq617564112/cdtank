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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3556',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-shop-original-display-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-shop-original-display-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const fixture=JSON.parse(await readFile('recovery/output/browser-home-inventory-item-row-2026-10-05T09-57-14-424Z-checkpoint-fixture.json','utf8'));
const checkpoint=fixture.database??'recovery/output/home-tank-active-marker-browser.sqlite';const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3556,vite:5586,cdp:9786},runId,scope:'UI53 original radio factory categories and metadata price/count consumers; readonly Shop QUERY/Item9/Weapon21/source fields/selected current prices/Close at three resolutions; no BUY or previous geometry/owned-list suite.',checkpoint:{source:checkpoint,copied:true,originalModified:false,originalFundsFixture:true}};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3556',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5586,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3556',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9786',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9786/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9786');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5586'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

  }

  const s=pages[0].sessionId;
  assert.equal(await evaluate(s,`localStorage.getItem('cdtank-account-token')`),fixture.token);
  evidence.fixture={database:checkpoint,copied:true,originalFundsFixture:true,newFundsOrRecordsInjected:false};
  await nativeClick(s,'[data-room-card-shop]');
  await waitUntil(s,`document.querySelector('[data-shop-source-product-grid]')&&document.querySelector('[data-shop-product-id="2"]')?.matches(':enabled')`);
  const shop=network.filter(n=>n.direction==='received'&&n.name==='Shop'&&n.success).at(-1)?.response;assert(shop);
  const sourceCategory=id=>{const kind=classifyItemId(id);return kind===1?'Item':kind===3||kind===4?'Weapon':undefined;};
  evidence.query=shop.items;
  const expected={Item:shop.items.filter(v=>sourceCategory(v.itemTableId)==='Item'),Weapon:shop.items.filter(v=>sourceCategory(v.itemTableId)==='Weapon')};
  assert.equal(expected.Item.length,9);assert.equal(expected.Weapon.length,21);
  assert(expected.Weapon.some(v=>v.itemTableId===3003));
  assert(shop.items.every(v=>v.getMethod!==undefined&&v.durable!==undefined));
  evidence.viewports=[];evidence.screenshots=[];
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    await evaluate(s,`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
    for(const kind of ['Item','Weapon']){
      await nativeClick(s,'[data-shop-category="'+kind+'"]');
      await waitUntil(s,`document.querySelector('[data-shop-category="${kind}"]').getAttribute('aria-pressed')==='true'`);
      const id=kind==='Item'?1:3003;
      await nativeClick(s,'[data-shop-product-id="'+id+'"]');
      const rows=await evaluate(s,`[...document.querySelectorAll('[data-shop-source-product-row]')].map(r=>({id:Number(r.dataset.shopProductId),name:r.querySelector('[data-shop-product-row-name]').textContent,type:r.querySelector('[data-shop-product-row-type]').textContent,price:r.querySelector('[data-shop-product-row-price]').textContent,quantity:r.querySelector('[data-shop-product-row-quantity]').textContent,priceProvider:r.querySelector('[data-shop-product-row-price]').dataset.priceProvider,quantityProvider:r.querySelector('[data-shop-product-row-quantity]').dataset.sourceQuantityField}))`);
      const selected=await evaluate(s,`({name:document.querySelector('[data-description-type-binding]').textContent,info:document.querySelector('[data-shop-description-text]').textContent,prices:document.querySelector('[data-shop-selected-query-prices]').textContent,selected:document.querySelector('[data-shop-product-id="${id}"]').getAttribute('aria-selected'),quantityInput:document.querySelector('[data-shop-quantity]').value,radios:[...document.querySelectorAll('[data-shop-category]')].map(r=>({kind:r.dataset.shopCategory,pressed:r.getAttribute('aria-pressed')}))})`);
      const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+width+'-'+kind+'.png';await writeFile(path,Buffer.from(shot.data,'base64'));evidence.screenshots.push(path);
      evidence.viewports.push({viewport:[width,height],category:kind,rows,selected});await writeFile(output+'.json',JSON.stringify({...evidence,network},null,2)+'\n');
      assert.deepEqual(rows.map(r=>r.id),expected[kind].map(v=>v.itemTableId));
      for(const row of rows){
        const item=expected[kind].find(v=>v.itemTableId===row.id);
        const price=item.getMethod===1?'购买价  金钱'+item.moneyPrice:item.getMethod===2?'购买价  星币'+Number((item.tokenPrice*0.1).toPrecision(16)):'';
        const eligible=item.itemTableId<=4000||item.itemTableId>=20001&&item.itemTableId<=21000;
        assert.equal(row.name,item.name);assert.equal(row.price,price);assert.equal(row.quantity,String(eligible&&item.durable!==0?item.durable:1));
        assert.equal(row.priceProvider,'original-item-getmethod');assert.equal(row.quantityProvider,'Item+0xf8/439950');
      }
      const item=shop.items.find(v=>v.itemTableId===id);
      assert.equal(selected.name,item.name);assert.equal(selected.info,item.info);assert.equal(selected.prices,item.moneyPrice+'金币 / '+item.tokenPrice+'软星币');assert.equal(selected.selected,'true');assert.equal(selected.quantityInput,'1');assert.equal(selected.radios.filter(r=>r.pressed==='true').length,1);
      if(kind==='Weapon'&&width===1920){
        const zero=expected.Weapon.find(v=>v.getMethod===0);assert(zero);
        await nativeClick(s,'[data-shop-product-id="'+zero.itemTableId+'"]');
        evidence.zeroMethodSelected=await evaluate(s,`({id:${zero.itemTableId},price:document.querySelector('[data-shop-product-id="${zero.itemTableId}"] [data-shop-product-row-price]').textContent,queryPrices:document.querySelector('[data-shop-selected-query-prices]').textContent,buyEnabled:document.querySelector('[data-shop-buy]').matches(':enabled')})`);
        const frame=await command('Page.captureScreenshot',{format:'png'},s),zeroPath=output+'-1920-zero-method.png';await writeFile(zeroPath,Buffer.from(frame.data,'base64'));evidence.screenshots.push(zeroPath);
        await writeFile(output+'.json',JSON.stringify({...evidence,network},null,2)+'\n');assert.equal(evidence.zeroMethodSelected.price,'');assert.equal(evidence.zeroMethodSelected.queryPrices,zero.moneyPrice+'金币 / '+zero.tokenPrice+'软星币');assert(evidence.zeroMethodSelected.buyEnabled);
      }
    }
  }
  await nativeClick(s,'[data-shop-category="Item"]');await waitUntil(s,`document.querySelector('[data-shop-category="Item"]').getAttribute('aria-pressed')==='true'&&document.querySelector('[data-shop-product-id="1"]')`);
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`!document.querySelector('#account-shop[open]')&&document.activeElement.matches('[data-room-card-shop]')`);evidence.strictShopOpener=true;
  assert(network.every(n=>n.direction!=='sent'||['OwnedRoles','Inventory','RoleProfile'].includes(n.name)||n.payload?.operation==='QUERY'));evidence.noBuyRepairSlotOrRoomWrites=true;evidence.status='PASS';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{if(pages.length){try{const shot=await command('Page.captureScreenshot',{format:'png'},pages[0].sessionId);evidence.finalFrame=output+'-final.png';await writeFile(evidence.finalFrame,Buffer.from(shot.data,'base64'));}catch{}}const savedCheckpoint=output+'-checkpoint.sqlite';try{const db=new DatabaseSync(database,{readOnly:true});try{await backup(db,savedCheckpoint);}finally{db.close();}evidence.savedCheckpoint=savedCheckpoint;await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:savedCheckpoint,token:fixture.token,accountSource:checkpoint,originalFundsFixture:true,newFundsOrRecordsInjected:false},null,2)+'\n');}catch(error){evidence.checkpointSaveError=String(error);}evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
