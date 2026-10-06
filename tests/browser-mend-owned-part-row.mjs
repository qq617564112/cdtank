import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile, copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {DatabaseSync, backup} from 'node:sqlite';
import {classifyItemId} from '../apps/shared/combat/item-hotkeys.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3540',logger:undefined});
const network=[];
let serverLog='';
const navigationOnly=process.argv.includes('--navigation-only');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-mend-owned-part-row-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-mend-owned-part-row-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const fixture=JSON.parse(await readFile('recovery/output/home-tank-active-marker-browser-fixture.json','utf8'));
const checkpoint=fixture.database??'recovery/output/home-tank-active-marker-browser.sqlite';const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3540,vite:5570,cdp:9770},runId,scope:'UI54 new original161x56 populated Part row; one authorized ordinary14003 BUY from legal copied checkpoint, then only readonly row display/selection/Close. No repair/expiry/binding.',checkpoint:{source:checkpoint,copied:true,originalModified:false,originalFundsFixture:true}};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3540',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5570,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3540',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9770',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9770/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9770');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop','RoleProfile'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5570'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

  }

  const s=pages[0].sessionId;
  assert.equal(await evaluate(s,`localStorage.getItem('cdtank-account-token')`),fixture.token);
  evidence.fixture={database:checkpoint,copied:true,originalFundsFixture:true,newFundsOrRecordsInjected:false};
  await nativeClick(s,'[data-room-card-shop]');await waitUntil(s,`document.querySelector('[data-shop-root-category="Part"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-root-category="Part"]');await waitUntil(s,`document.querySelector('[data-part-buy]')?.matches(':enabled')&&document.querySelector('[data-part-product-id="14003"]')`);
  const query=network.filter(n=>n.direction==='received'&&n.name==='Shop'&&n.success).at(-1)?.response;
  const product=query?.items.find(p=>p.itemTableId===14003);assert(product&&product.moneyPrice>0&&query.money>=product.moneyPrice,'authorized14003 is actually offered and affordable');
  evidence.offeredProduct=product;evidence.moneyBefore=query.money;
  await nativeClick(s,'[data-part-product-id="14003"]');await waitUntil(s,`document.querySelector('[data-part-shop-item]').dataset.selectedPart==='14003'&&document.querySelector('[data-part-buy]')?.matches(':enabled')`);
  assert.equal(await evaluate(s,`document.querySelector('[data-part-currency]').value`),'MONEY');
  await nativeClick(s,'[data-part-buy]');await waitUntil(s,`document.querySelector('[data-part-buy]')?.matches(':enabled')&&document.querySelector('[data-part-status]').textContent.includes('已购买')`);
  const purchase=network.find(n=>n.direction==='received'&&n.name==='Shop'&&n.success&&n.response.purchased?.itemTableId===14003)?.response;assert(purchase?.purchased);assert.equal(purchase.money,query.money-product.moneyPrice);evidence.purchase=purchase;
  const buyRequests=network.filter(n=>n.direction==='sent'&&n.name==='Shop'&&n.payload?.operation==='BUY');assert.equal(buyRequests.length,1);assert.equal(buyRequests[0].payload.quantity,1);assert.equal(buyRequests[0].payload.itemTableId,14003);
  await nativeClick(s,'[data-shop-root-category="Mend"]');await waitUntil(s,`document.querySelector('[data-mend-shop-page]')?.getAttribute('aria-busy')==='false'`);
  await nativeClick(s,'[data-mend-select-page="Part"]');await nativeClick(s,'[data-mend-category="Common"]');
  await waitUntil(s,`document.querySelector('[data-mend-owned-instance="${purchase.purchased.instanceId}"][data-mend-owned-part-row]')`);
  const response=network.filter(n=>n.direction==='received'&&n.name==='Inventory'&&n.success).at(-1)?.response;
  const record=response?.records.find(r=>r.instanceId===purchase.purchased.instanceId);assert(record&&record.itemTableId===14003);assert.equal(record.ownedQuantity,1);evidence.inventoryRecord=record;
  evidence.rows=[];evidence.screenshots=[];
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    const scale=Math.min(width/800,height/600);
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('.shop-source-stage').getBoundingClientRect().width-625*${scale})<.2`);
    await evaluate(s,`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
    await nativeClick(s,`[data-mend-owned-instance="${record.instanceId}"]`);
    const row=await evaluate(s,`(async()=>{const row=document.querySelector('[data-mend-owned-instance="${record.instanceId}"]'),icon=row.querySelector('.mend-part-icon'),root=document.querySelector('[data-mend-shop-page]');if(icon.dataset.sourceAsset)await new Promise((r,j)=>{const i=new Image();i.onload=r;i.onerror=j;i.src='/'+icon.dataset.sourceAsset});const rect=e=>e.getBoundingClientRect().toJSON();return {viewport:[innerWidth,innerHeight],row:rect(row),icon:rect(icon),iconAsset:icon.dataset.sourceAsset,name:row.querySelector('[data-mend-part-name]').textContent,type:row.querySelector('[data-mend-part-type]').textContent,duration:row.querySelector('[data-mend-part-duration]').textContent,sourceQuantity:Number(row.querySelector('[data-mend-part-duration]').dataset.sourceOwnedQuantity),selected:row.getAttribute('aria-selected'),focus:document.activeElement===row,repairs:[...root.querySelectorAll('[data-mend-repair]')].map(b=>b.disabled),costs:[...root.querySelectorAll('[data-source-control]')].filter(e=>['txtCoin0','txtCoin1','txtCoin2','txtMoney0','txtMoney1','txtMoney2'].includes(e.dataset.sourceControl)).map(e=>e.textContent),naturalList:{scrollHeight:row.parentElement.scrollHeight,clientHeight:row.parentElement.clientHeight}};})()`);
    evidence.rows.push(row);
    assert(Math.abs(row.row.width-161*scale)<.2&&Math.abs(row.row.height-56*scale)<.2);assert(Math.abs(row.icon.width-32*scale)<.2&&Math.abs(row.icon.height-32*scale)<.2);assert(row.iconAsset);assert.equal(row.name,product.name);assert.equal(row.type,'装甲类');assert.equal(row.sourceQuantity,record.ownedQuantity);assert.equal(row.duration,`（${Math.ceil((record.ownedQuantity>>>0)/1440)}天）`);assert.equal(row.selected,'true');assert(row.focus);assert(row.repairs.length===6&&row.repairs.every(Boolean));assert(row.costs.length===6&&row.costs.every(v=>v===''));
    const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+width+'.png';await writeFile(path,Buffer.from(shot.data,'base64'));evidence.screenshots.push(path);
  }
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`!document.querySelector('#account-shop[open]')&&document.activeElement.matches('[data-room-card-shop]')`);evidence.strictShopOpener=true;
  assert(network.every(n=>n.direction!=='sent'||['OwnedRoles','Inventory','RoleProfile'].includes(n.name)||n.payload?.operation==='QUERY'||n.name==='Shop'&&n.payload?.operation==='BUY'&&n.payload.itemTableId===14003&&n.payload.quantity===1));evidence.noRepairBindingOrRoomWrites=true;evidence.status='PASS';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{if(pages.length){try{const shot=await command('Page.captureScreenshot',{format:'png'},pages[0].sessionId);evidence.finalFrame=output+'-final.png';await writeFile(evidence.finalFrame,Buffer.from(shot.data,'base64'));}catch{}}const savedCheckpoint=output+'-checkpoint.sqlite';try{const db=new DatabaseSync(database,{readOnly:true});try{await backup(db,savedCheckpoint);}finally{db.close();}evidence.savedCheckpoint=savedCheckpoint;await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:savedCheckpoint,token:fixture.token,accountSource:checkpoint,originalFundsFixture:true,newFundsOrRecordsInjected:false},null,2)+'\n');}catch(error){evidence.checkpointSaveError=String(error);}evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
