import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, copyFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3386',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-home-tank-active-marker-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-tank-active-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3386,vite:5436,cdp:9636},runId,scope:'UI32 source current tank marker from confirmed Profile+a8/OwnedRoles instance; normal selection and read-only candidate distinction.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3386',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  const reused=process.argv.includes('--preview-only')?JSON.parse(await readFile('recovery/output/home-tank-active-marker-browser-fixture.json','utf8')):undefined;
  if(reused)await copyFile(reused.database,database);
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5436,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3386',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9636',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9636/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9636');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Page.enable',{},sessionId);
    if(reused)await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(reused.token)+')'},sessionId);
    await command('Page.navigate',{url:'http://127.0.0.1:5436'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);
    if(reused)assert(await evaluate(sessionId,`localStorage.getItem('cdtank-account-token')`)==reused.token,'Reuse confirmed account identity');

  }
  const s=pages[0].sessionId;

  if(!reused){
  store=new AccountStore(database);const account=store.open(await evaluate(s,`localStorage.getItem('cdtank-account-token')`));
  const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0x70,20000,true);view.setUint32(0x74,1000,true);
  store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});store.close();store=undefined;
  evidence.fixture={initialMoney:20000,initialTokens:1000,initialOwnedTanks:0,rolesNotImported:true};
  await nativeClick(s,'[data-room-card-shop]');await waitUntil(s,`document.querySelector('[data-shop-root-category="Tank"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-root-category="Tank"]');await waitUntil(s,`document.querySelector('[data-tank-shop-product-id="3"]')?.matches(':enabled')`);
  for(const tankId of [3,4]){
    await nativeClick(s,'[data-tank-shop-product-id="'+tankId+'"]');await waitUntil(s,`document.querySelector('[data-tank-shop-buy]')?.matches(':enabled')`);
    await nativeClick(s,'[data-tank-shop-buy]');await waitUntil(s,`document.querySelector('[data-tank-shop-status]')?.textContent.includes('已购买')&&document.querySelector('[data-tank-shop-buy]')?.matches(':enabled')`);
  }
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`document.activeElement.matches('[data-room-card-shop]')`);
  }
  await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('[data-home-name-open]')?.matches(':enabled')`);
  await nativeClick(s,'#home-inventory [data-role-tab="tank"]');await waitUntil(s,`document.querySelectorAll('#home-roles [data-owned-role]').length===2`);

  const owned=network.filter(row=>row.name==='OwnedRoles'&&row.success).at(-1).response.equipment;
  const active=owned.find(record=>new Map(record.fields).get(0x24)===3),other=owned.find(record=>new Map(record.fields).get(0x24)===4);
  const activeId=new Map(active.fields).get(0x1c),otherId=new Map(other.fields).get(0x1c);
  if(reused){
    await nativeClick(s,'#home-roles [data-owned-role="'+otherId+'"]');
    await waitUntil(s,`document.querySelector('[data-role-preview]')?.dataset.status==='ready'&&document.querySelector('[data-role-preview]')?.dataset.instanceId==='${otherId}'`);
    evidence.preview=await evaluate(s,`({ready:document.querySelector('[data-role-preview]').dataset.status,instance:Number(document.querySelector('[data-role-preview]').dataset.instanceId),tankId:Number(document.querySelector('[data-role-preview]').dataset.tankId),marker:!!document.querySelector('[data-home-tank-already-used]'),buttonEnabled:document.querySelector('.home-tank-source-use').matches(':enabled'),confirmedInstance:Number(document.querySelector('.home-tank-source-use').dataset.selectedInstance)})`);
    assert(!evidence.preview.marker&&evidence.preview.buttonEnabled);assert.equal(evidence.preview.confirmedInstance,activeId);
    const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-candidate-ready-1920.png',Buffer.from(shot.data,'base64'));
    await nativeClick(s,'[data-roles-close]');await waitUntil(s,`document.activeElement.matches('[data-room-card-home]')&&document.activeElement.matches(':enabled')`);
    assert(!network.some(r=>r.direction==='sent'&&(r.name==='SelectRole'||r.payload?.operation==='BUY')));evidence.noPurchaseOrSelectRole=true;evidence.finalHomeFocus=true;evidence.reusedActualFixture=true;evidence.status='PASS';console.log('PASS read-only confirmed candidate marker/ready preview whole1920/strict Home focus; zero BUY/SelectRole');
  }else{
  await nativeClick(s,'#home-roles [data-owned-role="'+activeId+'"]');
  await waitUntil(s,`document.querySelector('.home-tank-source-use')?.matches(':enabled')`);
  assert(!await evaluate(s,`!!document.querySelector('[data-home-tank-already-used]')`),'Not selected until server confirmation');
  await nativeClick(s,'.home-tank-source-use');
  await waitUntil(s,`document.querySelector('[data-home-tank-already-used]')&&document.querySelector('.home-tank-source-use').dataset.selectedInstance==='${activeId}'`);
  const confirmed=network.findLast(r=>r.name==='SelectRole'&&r.success);assert(confirmed);
  const profileId=new DataView(Uint8Array.from(confirmed.response.profile.bytes).buffer).getUint32(0xa8,true);assert.equal(profileId,activeId);
  evidence.states=[];
  for(const [instanceId,alreadyUsed,label] of [[activeId,true,'active'],[otherId,false,'candidate'],[activeId,true,'returned-active']]){
    await nativeClick(s,'#home-roles [data-owned-role="'+instanceId+'"]');
    await waitUntil(s,`document.querySelector('#home-roles [data-owned-role="${instanceId}"]').getAttribute('aria-pressed')==='true'`);
    const actual=await evaluate(s,`(()=>{const m=document.querySelector('[data-home-tank-already-used]'),b=document.querySelector('.home-tank-source-use'),r=m?.getBoundingClientRect(),q=b.getBoundingClientRect();return {marker:!!m,buttonDisabled:b.disabled,confirmedInstance:Number(b.dataset.selectedInstance),asset:m?.dataset.sourceAsset,visible:m?!!r.width&&!!r.height:false,sameRect:m?Math.abs(r.x-q.x)<.1&&Math.abs(r.y-q.y)<.1&&Math.abs(r.width-q.width)<.1&&Math.abs(r.height-q.height)<.1:null,source:m?.dataset.sourceControl,stateSource:m?.dataset.stateSource}})()`);
    assert.equal(actual.marker,alreadyUsed);assert.equal(actual.buttonDisabled,alreadyUsed);assert.equal(actual.confirmedInstance,activeId);
    if(alreadyUsed){assert(actual.visible&&actual.sameRect);assert.equal(actual.source,'picAlreadyUsed');}
    evidence.states.push({instanceId,alreadyUsed,label,...actual});
    if(label!=='returned-active'){const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+label+'-1920.png',Buffer.from(shot.data,'base64'));}
  }
  assert.equal(network.filter(r=>r.name==='SelectRole'&&r.direction==='sent').length,1);evidence.singleActualSelectRole=true;
  await nativeClick(s,'[data-roles-close]');await waitUntil(s,`document.activeElement.matches('[data-room-card-home]')&&document.activeElement.matches(':enabled')`);evidence.finalHomeFocus=true;
  const token=await evaluate(s,`localStorage.getItem('cdtank-account-token')`);
  await stop(server);server=undefined;
  const {DatabaseSync}=require('node:sqlite');const snapshot=new DatabaseSync(database);snapshot.exec('PRAGMA wal_checkpoint(TRUNCATE)');snapshot.close();
  const target='recovery/output/home-tank-active-marker-browser.sqlite';await copyFile(database,target);
  const check=new DatabaseSync(target,{readOnly:true});assert.equal(check.prepare('SELECT COUNT(*) AS n FROM role_records').get().n,2);check.close();
  await writeFile('recovery/output/home-tank-active-marker-browser-fixture.json',JSON.stringify({token,expectedOwnedCount:2,expectedActiveInstance:activeId,database:target})+'\n',{mode:0o600});evidence.fixtureSavedAndReadOnlyCountVerified=true;
  evidence.status='PASS';console.log('PASS confirmed current tank source marker/current-vs-candidate two 1920 pages/one actual SelectRole/strict Home focus');
  }
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
