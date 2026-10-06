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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3599',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-tank-maintenance-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-tank-maintenance-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const persistenceTail=process.argv.includes('--persistence-tail');
const tailIndex=process.argv.indexOf('--persistence-tail');
const fixturePath=persistenceTail?process.argv[tailIndex+1]:'recovery/output/browser-home-equipment-common-row-2026-10-05T14-42-06-024Z-checkpoint-fixture.json';
assert(fixturePath&&!fixturePath.startsWith('--'),'Persistence tail requires an explicit saved fixture');
const fixture=JSON.parse(await readFile(fixturePath,'utf8'));
const checkpoint=fixture.database??'recovery/output/home-tank-active-marker-browser.sqlite';const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
let originalMoney,originalTokens;
const beforeFunds=output+'-before-funds.sqlite';
if(!persistenceTail){
{const original=new DatabaseSync(database,{readOnly:true});try{await backup(original,beforeFunds);}finally{original.close();}}
const fundsDb=new DatabaseSync(database);
const account=fundsDb.prepare('SELECT id FROM accounts WHERE token = ?').get(fixture.token);assert(account);
const profileRow=fundsDb.prepare('SELECT payload FROM role_profiles WHERE account_id = ?').get(account.id);assert(profileRow);
const profileBytes=Uint8Array.from(profileRow.payload),fundsView=new DataView(profileBytes.buffer);
originalMoney=fundsView.getUint32(0x70,true);originalTokens=fundsView.getUint32(0x74,true);assert.equal(originalTokens,1000);
fundsView.setUint32(0x70,500000,true);
fundsDb.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(profileBytes,account.id);fundsDb.close();
}
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3599,vite:5629,cdp:9829},runId,scope:persistenceTail?'M6-03/UI54 persistence tail only: committed six-action checkpoint, wallet/minutes/day, strict Close and compiled sameDB restart; zero MAINTAIN and zero screenshots':'M6-03/UI54 new six quote display and six ordinary Tank maintenance actions, returned wallet/duration, compiled restart persistence/Close; no old row suite or Part maintenance',checkpoint:{source:checkpoint,copied:true,originalModified:false,originalFundsFixture:true,authority:'Saved ordinary TankShop BUY3/BUY4 from explicitly documented funds-only fixture; no role injection or new purchase'}};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3599',ACCOUNT_DB_PATH:database};server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5629,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3599',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9829',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9829/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9829');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['TankMaintenance','Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop','RoleProfile','Kitbag','TankTextures','CreateRoom','JoinRoom','LeaveRoom'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5629'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

  }

  const s=pages[0].sessionId;
  evidence.persistenceTail=persistenceTail;evidence.fixturePath=fixturePath;
  if(!persistenceTail)evidence.fundsFixture={beforeDatabase:beforeFunds,originalMoney,originalTokens,money:500000,roleOrExpiryInjected:false,sourceCopied:true};
  async function openMend(){
    await waitUntil(s,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')`);
    await nativeClick(s,'[data-room-card-shop]');
    await waitUntil(s,`document.querySelector('[data-shop-root-category="Mend"]')?.matches(':enabled')`);
    await nativeClick(s,'[data-shop-root-category="Mend"]');
    await waitUntil(s,`document.querySelector('[data-mend-owned-tank-row="1"]')?.matches(':enabled')`);
    await nativeClick(s,'[data-mend-owned-tank-row="1"]');
    await waitUntil(s,`document.querySelector('[data-source-control="btnCoinMend0"]')?.matches(':enabled')`);
  }
  const lastResult=()=>network.filter(n=>n.name==='TankMaintenance'&&n.direction==='received'&&n.success).at(-1)?.response;
  await openMend();
  const initial=lastResult();assert(initial);
  if(!persistenceTail){
  assert.equal(initial.money,500000);assert.equal(initial.tokens,1000);
  const originalTank=initial.tanks.find(t=>t.instanceId===1);assert.equal(originalTank.tankId,3);assert.equal(originalTank.remainingMinutes,0);
  evidence.initial=initial;evidence.frames=[];evidence.screenshots=[];
  const controls=[['Coin',0,['5','25','50']],[ 'Money',1,['25000','125000','250000']]];
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const metrics=await evaluate(s,`(()=>{const rect=e=>e.getBoundingClientRect().toJSON();return {quotes:['Coin','Money'].flatMap(currency=>[0,1,2].map(i=>{const t=document.querySelector('[data-source-control="txt'+currency+i+'"]'),button=document.querySelector('[data-source-control="btn'+currency+'Mend'+i+'"]');return {currency,index:i,text:t.textContent,textBounds:rect(t),button:rect(button),enabled:!button.disabled};}))};})()`);
    const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+width+'-quotes.png';await writeFile(path,Buffer.from(shot.data,'base64'));evidence.frames.push({viewport:[width,height],metrics,path});evidence.screenshots.push(path);await writeFile(output+'.json',JSON.stringify({...evidence,network},null,2)+'\n');
    for(const [label,,expected] of controls)for(let i=0;i<3;i++){const q=metrics.quotes.find(q=>q.currency===label&&q.index===i);assert.equal(q.text,expected[i]);assert(q.enabled);assert(q.textBounds.left>=q.button.left-1&&q.textBounds.right<=q.button.right+1&&q.textBounds.top>=q.button.top-1&&q.textBounds.bottom<=q.button.bottom+1);assert(q.textBounds.left>=0&&q.textBounds.right<=width&&q.textBounds.top>=0&&q.textBounds.bottom<=height);}
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);
  evidence.actions=[];let expectedMinutes=0,expectedMoney=500000,expectedTokens=1000;
  for(const [label,currency] of controls)for(const [index,days] of [1,7,30].entries()){
    const quote=originalTank.quotes.find(q=>q.currency===currency&&q.days===days);assert(quote);
    const before=network.filter(n=>n.name==='TankMaintenance'&&n.direction==='received'&&n.success&&n.response?.maintained).length;
    await nativeClick(s,'[data-source-control="btn'+label+'Mend'+index+'"]');
    await waitUntil(s,`!document.querySelector('[data-mend-shop-page]').matches('[aria-busy="true"]')&&document.querySelector('[data-mend-status]')?.textContent==='保养已确认'`);
    const result=lastResult();assert.equal(network.filter(n=>n.name==='TankMaintenance'&&n.direction==='received'&&n.success&&n.response?.maintained).length,before+1);
    expectedMinutes+=days*1440;if(currency===0)expectedTokens-=quote.cost;else expectedMoney-=quote.cost;
    assert.equal(result.money,expectedMoney);assert.equal(result.tokens,expectedTokens);assert.equal(result.maintained.instanceId,1);assert.equal(result.maintained.remainingMinutes,expectedMinutes);
    await waitUntil(s,`document.querySelector('[data-mend-owned-tank-row="1"] [data-home-owned-tank-days]')?.textContent===${JSON.stringify('（'+expectedMinutes/1440+'天）')}&&document.querySelector('[data-source-control="txtMoney"]')?.textContent==='${expectedMoney}'&&document.querySelector('[data-source-control="txtCoin"]')?.textContent==='${expectedTokens}'`);
    evidence.actions.push({currency,days,result});
  }
  assert.equal(expectedTokens,200);assert.equal(expectedMoney,100000);assert.equal(expectedMinutes,76*1440);
  }else{
    assert.equal(initial.money,100000);assert.equal(initial.tokens,200);
    const tank=initial.tanks.find(t=>t.instanceId===1);assert.equal(tank.tankId,3);assert.equal(tank.remainingMinutes,109440);
    await waitUntil(s,`document.querySelector('[data-mend-owned-tank-row="1"] [data-home-owned-tank-days]')?.textContent==='（76天）'&&document.querySelector('[data-source-control="txtMoney"]')?.textContent==='100000'&&document.querySelector('[data-source-control="txtCoin"]')?.textContent==='200'`);
    evidence.initial=initial;
  }
  async function closeMend(){await nativeClick(s,'[data-shop-close]');await waitUntil(s,`!document.querySelector('#account-shop[open]')&&document.activeElement.matches('[data-room-card-shop]')`);}
  await closeMend();evidence.strictShopClose=true;
  await command('Page.navigate',{url:'about:blank'},s);await stop(server);await startServer();
  await command('Page.navigate',{url:'http://127.0.0.1:5629'},s);await openMend();
  const persisted=lastResult();assert.equal(persisted.money,100000);assert.equal(persisted.tokens,200);assert.equal(persisted.tanks.find(t=>t.instanceId===1).remainingMinutes,76*1440);
  await waitUntil(s,`document.querySelector('[data-mend-owned-tank-row="1"] [data-home-owned-tank-days]')?.textContent==='（76天）'&&document.querySelector('[data-source-control="txtMoney"]')?.textContent==='100000'&&document.querySelector('[data-source-control="txtCoin"]')?.textContent==='200'`);
  evidence.compiledRestartSameDatabase={passed:true,result:persisted};await closeMend();evidence.restartStrictShopClose=true;
  const writes=network.filter(n=>n.direction==='sent'&&n.name==='TankMaintenance'&&n.payload?.operation==='MAINTAIN');assert.equal(writes.length,persistenceTail?0:6);assert.equal(new Set(writes.map(n=>n.payload.requestId)).size,persistenceTail?0:6);evidence.sentMaintain=writes.length;
  assert(network.every(n=>n.direction!=='sent'||['OwnedRoles','Inventory','RoleProfile'].includes(n.name)||n.payload?.operation==='QUERY'||n.name==='TankMaintenance'&&n.payload?.operation==='MAINTAIN'));
  evidence.status='PASS';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{if(pages.length&&!persistenceTail){try{const shot=await command('Page.captureScreenshot',{format:'png'},pages[0].sessionId);evidence.finalFrame=output+'-final.png';await writeFile(evidence.finalFrame,Buffer.from(shot.data,'base64'));}catch{}}const savedCheckpoint=output+'-checkpoint.sqlite';try{const db=new DatabaseSync(database,{readOnly:true});try{await backup(db,savedCheckpoint);}finally{db.close();}evidence.savedCheckpoint=savedCheckpoint;await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:savedCheckpoint,token:fixture.token,accountSource:checkpoint,originalFundsFixture:true,newFundsOrRecordsInjected:false},null,2)+'\n');}catch(error){evidence.checkpointSaveError=String(error);}evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
