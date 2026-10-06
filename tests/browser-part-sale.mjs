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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3615',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-part-sale-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-part-sale-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const tailIndex=process.argv.indexOf('--unreached-tail');
const firstPath=tailIndex>=0?process.argv[tailIndex+1]:undefined;
assert(tailIndex<0||firstPath&&!firstPath.startsWith('--'),'Tail requires explicit first raw');
const first=firstPath?JSON.parse(await readFile(firstPath,'utf8')):undefined;
const fixturePath=firstPath?firstPath.replace(/\.json$/,'-checkpoint-fixture.json'):'recovery/output/browser-part-maintenance-2026-10-05T20-04-54-539Z-checkpoint-fixture.json';
const fixture=JSON.parse(await readFile(fixturePath,'utf8')),checkpoint=fixture.database;
const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const pages=[],contexts=[];
const evidence={status:'RUNNING',runId,unreachedTail:Boolean(firstPath),firstPath,reusedWholeFrames:first?.wholeFrames,ports:{server:3615,vite:5645,cdp:9845},fixture:{source:checkpoint,previousFundsFixture:true,newFundsOrRecordsInjected:false,earnedBalancesProved:false},scope:'Existing ordinary Part14003 whole instance selected row doubleClick -> confirmation711 cancel -> Enter confirm SELL result1, confirmed inventory/money/parentheader/Close, three enabled-owned-row frames; no BUY/maintenance/role sale suite',wholeFrames:[]};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3615',ACCOUNT_DB_PATH:database};server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5645,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3615',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9845',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9845/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9845');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['PartSale','PartMaintenance','OwnedRoleSale','Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop','RoleProfile','Kitbag','TankTextures','CreateRoom','JoinRoom','LeaveRoom'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5645'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

  }

  const s=pages[0].sessionId;
  const last=()=>network.filter(n=>n.direction==='received'&&n.name==='PartSale'&&n.success).at(-1)?.response;
  await nativeClick(s,'[data-room-card-shop]');
  await waitUntil(s,`document.querySelector('[data-shop-root-category="Part"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-root-category="Part"]');
  await waitUntil(s,`document.querySelector('[data-part-owned-instance][data-part-sale-available="true"]')?.matches(':enabled')`);
  const initial=last();assert(initial);const quote=initial.quotes.find(q=>q.itemTableId===14003&&q.canSell);assert(quote);evidence.initial=initial;evidence.quote=quote;
  const selector='[data-part-owned-instance="'+quote.instanceId+'"]';
  await nativeClick(s,selector);
  if(!firstPath)for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const metrics=await evaluate(s,`(()=>{const row=document.querySelector(${JSON.stringify(selector)}),r=row.getBoundingClientRect();return {enabled:!row.disabled,available:row.dataset.partSaleAvailable==='true',selected:row.getAttribute('aria-selected'),bounds:r.toJSON(),text:row.textContent}})()`);
    assert(metrics.enabled&&metrics.available&&metrics.selected==='true');assert(metrics.bounds.left>=0&&metrics.bounds.top>=0&&metrics.bounds.right<=width&&metrics.bounds.bottom<=height);
    const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+width+'-owned.png';await writeFile(path,Buffer.from(shot.data,'base64'));evidence.wholeFrames.push({width,height,path,metrics});
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);
  await nativeClick(s,selector);
  const point=await evaluate(s,`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...point},s);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...point},s);
  await waitUntil(s,`document.querySelector('[data-confirm-binding="owned-part-sale"] [data-source-confirm-ok]')?.matches(':enabled')&&document.querySelector('[data-confirm-binding="owned-part-sale"] [role="document"]')?.textContent==='你确定出售该零件吗？'`);
  assert((await evaluate(s,`document.querySelector('[data-confirm-binding="owned-part-sale"]').textContent`)).includes('你确定出售该零件吗？'));
  await nativeClick(s,'[data-confirm-binding="owned-part-sale"] [data-source-confirm-cancel]');
  await waitUntil(s,`!document.querySelector('[data-confirm-binding="owned-part-sale"]')`);
  assert.equal(network.filter(n=>n.direction==='sent'&&n.name==='PartSale'&&n.payload.operation==='SELL').length,0);assert.deepEqual(last(),initial);evidence.cancelNoSale=true;
  await nativeClick(s,selector);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},s);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},s);
  await waitUntil(s,`document.querySelector('[data-confirm-binding="owned-part-sale"] [data-source-confirm-ok]')?.matches(':enabled')`);evidence.enterOpensConfirm=true;
  await nativeClick(s,'[data-confirm-binding="owned-part-sale"] [data-source-confirm-ok]');
  await waitUntil(s,`!document.querySelector('[data-confirm-binding="owned-part-sale"]')&&document.querySelector('[data-part-status]')?.textContent.includes('已出售')`);
  const result=last();assert.deepEqual(result.sold,{instanceId:quote.instanceId,itemTableId:14003,price:quote.price,result:1});assert.equal(result.money,initial.money+quote.price);
  assert.deepEqual(result.inventory.records,initial.inventory.records.filter(r=>r.instanceId!==quote.instanceId));
  assert.equal(await evaluate(s,`Boolean(document.querySelector(${JSON.stringify(selector)}))`),false);
  assert.equal(await evaluate(s,`document.querySelector('[data-source-layout="ui/layouts/shop_partpage.xml"][data-source-control="txtMoney"]').textContent`),String(result.money));
  assert.equal(network.filter(n=>n.direction==='sent'&&n.name==='PartSale'&&n.payload.operation==='SELL').length,1);evidence.result=result;
  assert.equal(network.filter(n=>n.direction==='sent'&&(['BUY','MAINTAIN'].includes(n.payload?.operation)||n.name==='OwnedRoleSale'&&n.payload?.operation==='SELL')).length,0);
  await nativeClick(s,'[data-shop-root-category="Item"]');
  await waitUntil(s,`document.querySelector('[data-source-layout="ui/layouts/shop_itempage.xml"][data-source-control="txtMoney"]')?.textContent==='${result.money}'`);evidence.parentItemMoneyConfirmed=true;
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`!document.querySelector('#account-shop[open]')&&document.activeElement.matches('[data-room-card-shop]')`);evidence.strictClose=true;
  evidence.status='PASS_FINITE_PART_WHOLE_INSTANCE_DOUBLECLICK_CANCEL_ENTER_CONFIRM_SALE_LIST_WALLET_CLOSE_SCOPE';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
  try{const db=new DatabaseSync(database,{readOnly:true});try{evidence.savedCheckpoint=output+'-checkpoint.sqlite';await backup(db,evidence.savedCheckpoint);}finally{db.close();}await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:evidence.savedCheckpoint,token:fixture.token,source:checkpoint,newFundsOrRecordsInjected:false})+'\n');}catch(error){evidence.checkpointError=String(error);}
  evidence.network=network;
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
}
