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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3617',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-stack-item-sale-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-stack-sale-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const tailIndex=process.argv.indexOf('--unreached-tail');
const firstPath=tailIndex>=0?process.argv[tailIndex+1]:undefined;
assert(tailIndex<0||firstPath&&!firstPath.startsWith('--'));
const first=firstPath?JSON.parse(await readFile(firstPath,'utf8')):undefined;
const fixturePath=firstPath?firstPath.replace(/\.json$/,'-checkpoint-fixture.json'):'recovery/output/browser-part-sale-2026-10-05T20-20-26-723Z-checkpoint-fixture.json';
const fixture=JSON.parse(await readFile(fixturePath,'utf8')),checkpoint=fixture.database;
const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const pages=[],contexts=[];
const evidence={status:'RUNNING',runId,ports:{server:3617,vite:5647,cdp:9847},fixture:{source:checkpoint,previousFundsFixture:true,newFundsOrRecordsInjected:false,earnedBalancesProved:false},scope:'Ordinary Item and Weapon BUY2 if needed, real owned-instance quantity confirmation cancel/partial/full, original quantity dialog three resolutions, confirmed inventory/parentMoney/strictClose',wholeFrames:[],actions:[],firstPath,reusedActions:first?.actions,diagnostics:[],runtime:[]};
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
  evidence.diagnostics.push({kind:'hitTarget',selector,point});
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},session);
  await command('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',clickCount:1,...point}, session);
  await command('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',clickCount:1,...point}, session);
}
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3617',ACCOUNT_DB_PATH:database};server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5647,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3617',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9847',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9847/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9847');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(['Runtime.exceptionThrown','Runtime.consoleAPICalled'].includes(m.method))evidence.runtime.push({method:m.method,params:m.params});});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['StackItemSale','PartSale','PartMaintenance','OwnedRoleSale','Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop','RoleProfile','Kitbag','TankTextures','CreateRoom','JoinRoom','LeaveRoom'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Runtime.enable',{},sessionId);await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5647'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

  }

  const s=pages[0].sessionId;
  await evaluate(s,`(()=>{window.__stackSaleObservedEvents=[];for(const type of ['click','dblclick','keydown'])document.addEventListener(type,event=>{window.__stackSaleObservedEvents.push({type,detail:event.detail,key:event.key,trusted:event.isTrusted,target:event.target.outerHTML?.slice(0,800),path:event.composedPath().filter(n=>n instanceof Element).slice(0,5).map(n=>({tag:n.tagName,data:{...n.dataset}}))});},true);})()`);
  const last=()=>network.filter(n=>n.direction==='received'&&n.name==='StackItemSale'&&n.success).at(-1)?.response;
  const sales=()=>network.filter(n=>n.direction==='sent'&&n.name==='StackItemSale'&&n.payload.operation==='SELL').length;
  async function fill(selector,text) {
    await nativeClick(s,selector);
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},s);
    await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},s);
    await command('Input.insertText',{text:String(text)},s);
  }
  async function openQuantity(selector,enter=false) {
    await nativeClick(s,selector);
    await waitUntil(s,`document.querySelector(${JSON.stringify(selector)})?.matches(':enabled')&&document.querySelector(${JSON.stringify(selector)})?.dataset.stackSaleAvailable==='true'`);
    if(enter) {
      await nativeClick(s,selector);
      await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},s);
      await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},s);
    } else {
      const point=await evaluate(s,`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...point},s);
      await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...point},s);
    }
    try {await waitUntil(s,`document.querySelector('[data-stack-sale-confirm]')?.open&&document.querySelector('[data-stack-sale-ok]')?.matches(':enabled')`);}finally{evidence.diagnostics.push({kind:'openQuantity',enter,selector,dom:await evaluate(s,`(()=>({events:window.__stackSaleObservedEvents,button:document.querySelector(${JSON.stringify(selector)})?.outerHTML,dialog:document.querySelector('[data-stack-sale-confirm]')?.outerHTML,active:document.activeElement?.outerHTML,status:document.querySelector('[data-stack-sale-status]')?.textContent,shopOpen:document.querySelector('#account-shop')?.open}))()`).catch(String)});}
    assert.equal(await evaluate(s,`document.querySelector('[data-stack-sale-confirm] [role="document"]').textContent`),'请输入你想要售出的道具的数量。');
  }
  await nativeClick(s,'[data-room-card-shop]');
  await waitUntil(s,`document.querySelector('[data-shop-owned-category="Item"]')?.matches(':enabled')&&document.querySelector('[data-shop-buy]')?.matches(':enabled')`);
  evidence.initial=last();assert(evidence.initial);
  for(const category of ['Item','Weapon']) {
    await nativeClick(s,'[data-shop-category="'+category+'"]');
    await waitUntil(s,`document.querySelector('[data-shop-category="${category}"]')?.getAttribute('aria-pressed')==='true'`);
    const shop=network.filter(n=>n.direction==='received'&&n.name==='Shop'&&n.success).at(-1)?.response;
    const itemTableId=category==='Item'?1:3003;
    assert(shop.items.some(i=>i.itemTableId===itemTableId));
    assert(itemTableId,'Qualified Weapon3003/2011 product absent');
    await waitUntil(s,`document.querySelector('[data-shop-owned-category="${category}"]')?.matches(':enabled')`);
    await nativeClick(s,'[data-shop-owned-category="'+category+'"]');
    await waitUntil(s,`document.querySelector('[data-shop-owned-category="${category}"]')?.getAttribute('aria-pressed')==='true'`);
    let quote=last().quotes.find(q=>q.itemTableId===itemTableId&&q.canSell&&q.ownedQuantity>=2);
    if(!quote) {
      await nativeClick(s,'[data-shop-product-id="'+itemTableId+'"]');
      await fill('[data-shop-quantity]',2);
      assert.equal(await evaluate(s,`document.querySelector('[data-shop-currency]').value`),'MONEY');
      const before=network.length;await nativeClick(s,'[data-shop-buy]');
      await waitUntil(s,`document.querySelector('[data-shop-buy]')?.matches(':enabled')&&document.querySelector('[data-shop-quantity]').value==='2'`);
      const bought=network.filter(n=>n.index>=before&&n.direction==='received'&&n.name==='Shop'&&n.success&&n.response.purchased).at(-1)?.response;
      assert(bought?.purchased);assert.equal(bought.purchased.itemTableId,itemTableId);
      for(let i=0;i<100&&!last()?.quotes.some(q=>q.instanceId===bought.purchased.instanceId&&q.ownedQuantity>=2);i++)await new Promise(r=>setTimeout(r,50));
      quote=last().quotes.find(q=>q.instanceId===bought.purchased.instanceId&&q.canSell&&q.ownedQuantity>=2);assert(quote);
      evidence.actions.push({kind:'normalBUY',category,response:bought});
    }
    const selector='[data-shop-owned-instance="'+quote.instanceId+'"]';
    await waitUntil(s,`document.querySelector(${JSON.stringify(selector)})?.matches(':enabled')`);
    await openQuantity(selector);
    const beforeCancel=sales(),beforeInventory=last().inventory;
    if(category==='Item')for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]) {
      await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
      await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
      const metrics=await evaluate(s,`(()=>{const d=document.querySelector('[data-stack-sale-confirm]'),input=d.querySelector('input'),ok=d.querySelector('[data-stack-sale-ok]');return{bounds:d.getBoundingClientRect().toJSON(),input:input.getBoundingClientRect().toJSON(),ok:ok.getBoundingClientRect().toJSON(),text:d.textContent,enabled:!ok.disabled,inputFont:getComputedStyle(input).fontFamily}})()`);
      assert(metrics.enabled);for(const box of [metrics.bounds,metrics.input,metrics.ok])assert(box.left>=0&&box.top>=0&&box.right<=width&&box.bottom<=height);
      assert(Math.abs(metrics.bounds.width-307*Math.min(width/800,height/600))<2,'Dialog single-scale width');
      const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+width+'-quantity.png';await writeFile(path,Buffer.from(shot.data,'base64'));evidence.wholeFrames.push({width,height,path,metrics});
    }
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);
    await nativeClick(s,'[data-stack-sale-cancel]');await waitUntil(s,`!document.querySelector('[data-stack-sale-confirm]')`);
    assert.equal(sales(),beforeCancel);assert.deepEqual(last().inventory,beforeInventory);
    evidence.actions.push({kind:'cancelNoSale',category});
    for(const stage of ['partial','full']) {
      await openQuantity(selector,true);
      const before=last(),currentQuote=before.quotes.find(q=>q.instanceId===quote.instanceId);assert(currentQuote);
      const quantity=stage==='partial'?1:currentQuote.ownedQuantity;
      await fill('[data-stack-sale-quantity]',quantity);
      await waitUntil(s,`document.querySelector('[data-stack-sale-ok]')?.matches(':enabled')`);
      const beforeCount=sales();await nativeClick(s,'[data-stack-sale-ok]');
      await waitUntil(s,`!document.querySelector('[data-stack-sale-confirm]')`);
      const result=last();assert.deepEqual(result.sold,{instanceId:quote.instanceId,itemTableId,quantity,price:currentQuote.unitPrice*quantity,result:2});
      assert.equal(result.money,before.money+currentQuote.unitPrice*quantity);assert.equal(sales(),beforeCount+1);
      const record=result.inventory.records.find(r=>r.instanceId===quote.instanceId);
      if(stage==='partial'){assert(record);assert.equal(record.ownedQuantity,currentQuote.ownedQuantity-quantity);}else assert.equal(record,undefined);
      await waitUntil(s,`document.querySelector('[data-source-layout="ui/layouts/shop_itempage.xml"][data-source-control="txtMoney"]')?.textContent==='${result.money}'`);
      evidence.actions.push({kind:stage,category,requestQuantity:quantity,response:result});
    }
  }
  evidence.final=last();assert.equal(evidence.final.money,178980);
  const requests=network.filter(n=>n.direction==='sent'&&n.name==='StackItemSale'&&n.payload.operation==='SELL');assert.equal(requests.length,4);assert.equal(new Set(requests.map(n=>n.payload.requestId)).size,4);
  assert.equal(evidence.actions.filter(a=>a.kind==='normalBUY').length+(first?.actions.filter(a=>a.kind==='normalBUY').length??0),2);
  for(const a of evidence.actions.filter(a=>a.kind==='partial'||a.kind==='full')){assert.equal(a.requestQuantity,1);assert.equal(a.response.sold.price,5);}
  assert.equal(network.filter(n=>n.direction==='received'&&n.name==='Shop'&&n.success).at(-1).response.tokens,360);
  assert.equal(network.filter(n=>n.direction==='sent'&&(['PartSale','OwnedRoleSale','PartMaintenance','TankMaintenance'].includes(n.name)&&n.payload?.operation!=='QUERY')).length,0);
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`!document.querySelector('#account-shop[open]')&&document.activeElement.matches('[data-room-card-shop]')`);evidence.strictClose=true;
  evidence.status='PASS_FINITE_STACK_ITEM_WEAPON_QUANTITY_CANCEL_PARTIAL_FULL_CONFIRMED_WALLET_LIST_CLOSE_SCOPE';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(pages[0]?.sessionId)evidence.failureDOM=await evaluate(pages[0].sessionId,`(()=>({events:window.__stackSaleObservedEvents,owned:[...document.querySelectorAll('[data-shop-owned-instance]')].map(n=>n.outerHTML),dialog:document.querySelector('[data-stack-sale-confirm]')?.outerHTML,active:document.activeElement?.outerHTML,shopOpen:document.querySelector('#account-shop')?.open,bodyText:document.body.innerText.slice(-3000)}))()`).catch(String);throw error;}
finally{
  try{const db=new DatabaseSync(database,{readOnly:true});try{evidence.savedCheckpoint=output+'-checkpoint.sqlite';await backup(db,evidence.savedCheckpoint);}finally{db.close();}await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:evidence.savedCheckpoint,token:fixture.token,source:checkpoint,newFundsOrRecordsInjected:false})+'\n');}catch(error){evidence.checkpointError=String(error);}
  evidence.network=network;
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
}
