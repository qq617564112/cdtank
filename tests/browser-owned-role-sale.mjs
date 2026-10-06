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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3610',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-owned-role-sale-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-owned-role-sale-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const fixturePath='recovery/output/browser-pet-skill-learning-2026-10-05T19-11-44-269Z-checkpoint-fixture.json';
const fixture=JSON.parse(await readFile(fixturePath,'utf8'));
const checkpoint=fixture.database;
const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const pages=[],contexts=[];
const evidence={status:'RUNNING',runId,ports:{server:3610,vite:5640,cdp:9840},fixture:{source:checkpoint,originalFundsFixture:true,newFundsOrRecordsInjected:false,earnedBalancesProved:false},scope:'Ordinary new BUY Tank3/Pet2, normal Home selected-sale disabled, restore another owned role, confirmed SELL owned instance/list/money and Close, three resolutions enabled controls; no prior row suite or network rejection matrix',actions:[],wholeFrames:[]};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3610',ACCOUNT_DB_PATH:database};server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5640,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3610',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9840',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9840/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9840');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['OwnedRoleSale','Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop','RoleProfile','Kitbag','TankTextures','CreateRoom','JoinRoom','LeaveRoom'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5640'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

  }

  const s=pages[0].sessionId;
  const last=(name)=>network.filter(n=>n.direction==='received'&&n.name===name&&n.success).at(-1)?.response;
  async function openShop(kind){
    await nativeClick(s,'[data-room-card-shop]');
    await waitUntil(s,`document.querySelector('[data-shop-root-category="${kind}"]')?.matches(':enabled')`);
    await nativeClick(s,'[data-shop-root-category="'+kind+'"]');
    await waitUntil(s,`document.querySelector('[data-${kind.toLowerCase()}-shop-buy]')?.matches(':enabled')`);
  }
  async function closeShop(){
    await nativeClick(s,'[data-shop-close]');
    await waitUntil(s,`!document.querySelector('#account-shop[open]')&&document.activeElement.matches('[data-room-card-shop]')`);
  }
  async function own(kind,instance){
    const k=kind.toLowerCase();
    await nativeClick(s,'[data-'+k+'-shop-owned-tab]');
    await waitUntil(s,`document.querySelector('[data-${k}-shop-source-row="${instance}"]')?.matches(':enabled')`);
    await nativeClick(s,'[data-'+k+'-shop-source-row="'+instance+'"]');
    await waitUntil(s,`document.querySelector('[data-selected-${k}]')?.dataset.${k==='tank'?'selectedTank':'selectedPet'}==='${instance}'`);
  }
  async function selectHome(kind,instance){
    const k=kind.toLowerCase(),use=k==='tank'?'btnUse':'btnUseMe';
    await nativeClick(s,'[data-room-card-home]');
    await waitUntil(s,`document.querySelector('#home-inventory [data-role-tab="${k}"]')?.matches(':enabled')`);
    await nativeClick(s,'#home-inventory [data-role-tab="'+k+'"]');
    await waitUntil(s,`document.querySelector('#home-roles [data-owned-role="${instance}"]')?.matches(':enabled')`);
    await nativeClick(s,'#home-roles [data-owned-role="'+instance+'"]');
    await waitUntil(s,`document.querySelector('#home-roles [data-source-control="${use}"]')?.matches(':enabled')`);
    await nativeClick(s,'#home-roles [data-source-control="'+use+'"]');
    await waitUntil(s,`document.querySelector('#home-roles [data-source-control="${use}"]')?.dataset.selectedInstance==='${instance}'`);
    const response=last('SelectRole');assert(response?.profile);evidence.actions.push({kind,selectInstance:instance,response});
    await nativeClick(s,'[data-roles-close]');
    await waitUntil(s,`!document.querySelector('#home-roles[open]')&&document.activeElement.matches('[data-room-card-home]')`);
  }
  for(const [kind,definitionId,offset,group] of [['Tank',3,0x1c,'equipment'],['Pet',2,0,'base']]){
    const k=kind.toLowerCase();
    await openShop(kind);
    await waitUntil(s,`document.querySelector('[data-${k}-shop-product-id="${definitionId}"]')?.matches(':enabled')`);
    await nativeClick(s,'[data-'+k+'-shop-product-id="'+definitionId+'"]');
    await nativeClick(s,'[data-'+k+'-shop-buy]');
    await waitUntil(s,`document.querySelector('[data-${k}-shop-status]')?.textContent.includes('已购买')&&document.querySelector('[data-${k}-shop-buy]')?.matches(':enabled')`);
    const purchase=last(kind+'Shop');assert(purchase?.purchased);
    const instance=new Map(purchase.purchased.fields).get(offset);assert(instance!==undefined);
    await own(kind,instance);
    const initial=last('OwnedRoleSale');assert(initial);
    const alternative=initial.owned[group].find(r=>new Map(r.fields).get(offset)!==instance);assert(alternative,'Saved real alternative owned role');
    const alternativeId=new Map(alternative.fields).get(offset);
    const quote=initial.quotes.find(q=>q.kind===k&&q.instanceId===instance);assert(quote?.canSell);
    await closeShop();
    await selectHome(kind,instance);
    await openShop(kind);await own(kind,instance);
    assert.equal(await evaluate(s,`document.querySelector('[data-${k}-shop-sell]').disabled`),true);
    assert.equal(last('OwnedRoleSale').quotes.find(q=>q.kind===k&&q.instanceId===instance)?.selected,true);
    evidence.actions.push({kind,selectedRejectControl:true,instance});
    await closeShop();await selectHome(kind,alternativeId);
    await openShop(kind);await own(kind,instance);
    await waitUntil(s,`document.querySelector('[data-${k}-shop-sell]')?.matches(':enabled')`);
    const before=last('OwnedRoleSale');
    for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
      await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
      await new Promise(r=>setTimeout(r,150));
      const metrics=await evaluate(s,`(()=>{const b=document.querySelector('[data-${k}-shop-sell]'),r=b.getBoundingClientRect();return {enabled:!b.disabled,bounds:r.toJSON(),viewport:{width:innerWidth,height:innerHeight},money:document.querySelector('[data-${k}-shop-balance]').textContent}})()`);
      assert(metrics.enabled&&metrics.bounds.x>=0&&metrics.bounds.y>=0&&metrics.bounds.right<=width&&metrics.bounds.bottom<=height);
      const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+k+'-'+width+'-enabled.png';
      await writeFile(path,Buffer.from(shot.data,'base64'));evidence.wholeFrames.push({kind,width,height,path,metrics});
    }
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);
    await nativeClick(s,'[data-'+k+'-shop-sell]');
    await waitUntil(s,`document.querySelector('[data-confirm-binding="owned-${k}-sale"] [data-source-confirm-ok]')?.matches(':enabled')`);
    const countBefore=network.filter(n=>n.direction==='sent'&&n.name==='OwnedRoleSale'&&n.payload.operation==='SELL').length;
    await nativeClick(s,'[data-confirm-binding="owned-'+k+'-sale"] [data-source-confirm-ok]');
    await waitUntil(s,`!document.querySelector('[data-confirm-binding="owned-${k}-sale"]')&&document.querySelector('[data-${k}-shop-status]')?.textContent.includes('已出售')`);
    const result=last('OwnedRoleSale');assert.deepEqual(result.sold,{kind:k,instanceId:instance,price:quote.price,result:2});
    assert.equal(result.money,before.money+quote.price);
    assert.equal(result.owned[group].some(r=>new Map(r.fields).get(offset)===instance),false);
    assert.equal(await evaluate(s,`Boolean(document.querySelector('[data-${k}-shop-source-row="${instance}"]'))`),false);
    assert((await evaluate(s,`document.querySelector('[data-${k}-shop-balance]').textContent`)).includes(String(result.money)));
    assert((await evaluate(s,`document.querySelector('[data-shop-page] [data-source-control="txtMoney"]')?.textContent`)).includes(String(result.money)));
    assert.equal(network.filter(n=>n.direction==='sent'&&n.name==='OwnedRoleSale'&&n.payload.operation==='SELL').length,countBefore+1);
    evidence.actions.push({kind,definitionId,instance,quote,purchase,before,result});
    await closeShop();
  }
  evidence.strictClose=true;evidence.status='PASS_FINITE_OWNED_TANK_PET_BUY_SELECT_REJECT_CONFIRMED_SALE_LIST_WALLET_CLOSE_SCOPE';
  console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
  try{const db=new DatabaseSync(database,{readOnly:true});try{evidence.savedCheckpoint=output+'-checkpoint.sqlite';await backup(db,evidence.savedCheckpoint);}finally{db.close();}await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:evidence.savedCheckpoint,token:fixture.token,source:checkpoint,newFundsOrRecordsInjected:false})+'\n');}catch(error){evidence.checkpointError=String(error);}
  evidence.network=network;
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
}
