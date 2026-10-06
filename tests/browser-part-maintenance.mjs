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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3612',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-part-maintenance-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-part-maintenance-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const fixturePath='recovery/output/browser-pet-skill-learning-2026-10-05T19-11-44-269Z-checkpoint-fixture.json';
const fixture=JSON.parse(await readFile(fixturePath,'utf8'));const checkpoint=fixture.database;
const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
const beforeFunds=output+'-before-funds.sqlite';
{const db=new DatabaseSync(database,{readOnly:true});try{await backup(db,beforeFunds);}finally{db.close();}}
const db=new DatabaseSync(database),account=db.prepare('SELECT id FROM accounts WHERE token=?').get(fixture.token);assert(account);
const row=db.prepare('SELECT payload FROM role_profiles WHERE account_id=?').get(account.id);assert(row);
const bytes=Uint8Array.from(row.payload),view=new DataView(bytes.buffer);
const originalWallet={money:view.getUint32(0x70,true),tokens:view.getUint32(0x74,true)};
view.setUint32(0x70,500000,true);view.setUint32(0x74,1000,true);
db.prepare('UPDATE role_profiles SET payload=? WHERE account_id=?').run(bytes,account.id);db.close();
const pages=[],contexts=[];
const evidence={status:'RUNNING',runId,ports:{server:3612,vite:5642,cdp:9842},scope:'Part14003 new ordinary BUY then six confirmed maintenance choices, source quote displays/three whole frames/wallet/raw remaining minutes/Close; same page readonly ownedPet currentrank projection, no Tank actions/Pet BUYSELL/restart matrix',fixture:{source:checkpoint,beforeFunds,originalWallet,funds:{money:500000,tokens:1000},earnedFundsProved:false,ownedOrMinutesInjected:false},frames:[],actions:[]};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3612',ACCOUNT_DB_PATH:database};server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5642,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3612',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9842',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9842/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9842');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['PartMaintenance','TankMaintenance','OwnedRoleSale','Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop','RoleProfile','Kitbag','TankTextures','CreateRoom','JoinRoom','LeaveRoom'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5642'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

  }

  const s=pages[0].sessionId;
  const last=name=>network.filter(n=>n.direction==='received'&&n.name===name&&n.success).at(-1)?.response;
  await nativeClick(s,'[data-room-card-shop]');
  await waitUntil(s,`document.querySelector('[data-shop-root-category="Part"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-root-category="Part"]');
  await waitUntil(s,`document.querySelector('[data-part-product-source-row="14003"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-part-product-source-row="14003"]');
  await waitUntil(s,`document.querySelector('[data-part-buy]')?.matches(':enabled')`);
  await nativeClick(s,'[data-part-buy]');
  await waitUntil(s,`document.querySelector('[data-part-status]')?.textContent.includes('可在装备页配置')&&document.querySelector('[data-part-buy]')?.matches(':enabled')`);
  const purchase=last('Shop');assert.equal(purchase.purchased.itemTableId,14003);assert.equal(purchase.purchased.ownedQuantity,1);
  const instanceId=purchase.purchased.instanceId;evidence.purchase=purchase;evidence.instanceId=instanceId;
  await nativeClick(s,'[data-shop-root-category="Mend"]');
  await waitUntil(s,`document.querySelector('[data-mend-select-page="Part"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-mend-select-page="Part"]');
  await waitUntil(s,`document.querySelector('[data-mend-owned-part-row][data-mend-owned-instance="${instanceId}"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-mend-owned-part-row][data-mend-owned-instance="'+instanceId+'"]');
  const initial=last('PartMaintenance'),part=initial.parts.find(p=>p.instanceId===instanceId);assert(part?.canMaintain);assert.equal(part.remainingMinutes,1);
  const controls=[['Coin',0,['4','20','40']],['Money',1,['20000','100000','200000']]];
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const metrics=await evaluate(s,`(()=>{const rect=e=>e.getBoundingClientRect().toJSON();return {quotes:['Coin','Money'].flatMap(currency=>[0,1,2].map(i=>{const t=document.querySelector('[data-source-control="txt'+currency+i+'"]'),button=document.querySelector('[data-source-control="btn'+currency+'Mend'+i+'"]');return {currency,index:i,text:t.textContent,textBounds:rect(t),button:rect(button),enabled:!button.disabled};}))};})()`);
    const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+width+'-quotes.png';await writeFile(path,Buffer.from(shot.data,'base64'));evidence.frames.push({viewport:[width,height],metrics,path});
    for(const [label,,expected] of controls)for(let i=0;i<3;i++){const q=metrics.quotes.find(q=>q.currency===label&&q.index===i);assert.equal(q.text,expected[i]);assert(q.enabled);assert(q.textBounds.left>=q.button.left-1&&q.textBounds.right<=q.button.right+1&&q.textBounds.top>=q.button.top-1&&q.textBounds.bottom<=q.button.bottom+1);assert(q.textBounds.left>=0&&q.textBounds.right<=width&&q.textBounds.top>=0&&q.textBounds.bottom<=height);}
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);
  let expectedMinutes=1,expectedMoney=initial.money,expectedTokens=initial.tokens;
  assert.equal(expectedMoney,purchase.money);assert.equal(expectedTokens,purchase.tokens);
  for(const [label,currency] of controls)for(const [index,days] of [1,7,30].entries()){
    const quote=part.quotes.find(q=>q.currency===currency&&q.days===days);assert(quote);
    const count=network.filter(n=>n.direction==='sent'&&n.name==='PartMaintenance'&&n.payload.operation==='MAINTAIN').length;
    await nativeClick(s,'[data-source-control="btn'+label+'Mend'+index+'"]');
    await waitUntil(s,`document.querySelector('[data-mend-shop-page]')?.getAttribute('aria-busy')==='false'&&document.querySelector('[data-mend-status]')?.textContent==='保养已确认'`);
    const result=last('PartMaintenance');expectedMinutes+=days*1440;if(currency===0)expectedTokens-=quote.cost;else expectedMoney-=quote.cost;
    assert.equal(result.maintained.instanceId,instanceId);assert.equal(result.maintained.remainingMinutes,expectedMinutes);assert.equal(result.money,expectedMoney);assert.equal(result.tokens,expectedTokens);
    const record=result.inventory.records.find(r=>r.instanceId===instanceId);assert.equal(record.ownedQuantity,expectedMinutes);assert.equal(record.itemTableId,14003);
    assert.equal(network.filter(n=>n.direction==='sent'&&n.name==='PartMaintenance'&&n.payload.operation==='MAINTAIN').length,count+1);
    await waitUntil(s,`document.querySelector('[data-mend-owned-instance="${instanceId}"] [data-mend-part-duration]')?.textContent==='（${Math.ceil(expectedMinutes/1440)}天）'&&document.querySelector('[data-source-control="txtMoney"]')?.textContent==='${expectedMoney}'&&document.querySelector('[data-source-control="txtCoin"]')?.textContent==='${expectedTokens}'`);
    evidence.actions.push({currency,days,result});
  }
  assert.equal(expectedMoney,purchase.money-320000);assert.equal(expectedTokens,purchase.tokens-640);assert.equal(expectedMinutes,109441);
  assert.equal(network.filter(n=>n.direction==='sent'&&n.name==='TankMaintenance'&&n.payload.operation==='MAINTAIN').length,0);
  async function closeShop(){await nativeClick(s,'[data-shop-close]');await waitUntil(s,`!document.querySelector('#account-shop[open]')&&document.activeElement.matches('[data-room-card-shop]')`);}
  await closeShop();evidence.partStrictClose=true;
  await nativeClick(s,'[data-room-card-shop]');await waitUntil(s,`document.querySelector('[data-shop-root-category="Pet"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-root-category="Pet"]');await waitUntil(s,`document.querySelector('[data-pet-shop-owned-tab]')?.matches(':enabled')`);
  await nativeClick(s,'[data-pet-shop-owned-tab]');await waitUntil(s,`document.querySelector('[data-pet-shop-source-row="3"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-pet-shop-source-row="3"]');
  const confirmed=last('OwnedRoleSale').owned.base.find(r=>new Map(r.fields).get(0)===3);assert(confirmed);
  const fields=new Map(confirmed.fields),catalog=JSON.parse(await readFile('recovery/output/web-assets/combat-catalog.json','utf8'));
  const expected=Array.from({length:6},(_,slot)=>{const base=fields.get(0x44+slot*4),rank=fields.get(0x5c+slot*4),id=base+Math.max(0,rank-1);return {slot,id,rank,name:catalog.skills.find(s=>s.skillId===id)?.name??''};});
  await waitUntil(s,`document.querySelector('[data-pet-directory-skill="0"]')?.dataset.skillLevel==='${expected[0].rank}'`);
  const actual=await evaluate(s,`[...document.querySelectorAll('[data-pet-directory-skill]')].map(e=>({slot:Number(e.dataset.petDirectorySkill),id:Number(e.dataset.skillId),rank:Number(e.dataset.skillLevel),name:e.querySelector('[data-source-control^="txtSkillName"]').textContent}))`);assert.deepEqual(actual,expected);evidence.ownedPetProjection={instanceId:3,expected,actual};
  await nativeClick(s,'[data-pet-shop-skill-open="0"]');await waitUntil(s,`document.querySelector('[data-pet-skill-dialog]')?.open&&document.querySelector('[data-pet-skill-dialog]')?.dataset.skillId==='${expected[0].id}'`);
  assert.equal(await evaluate(s,`document.querySelector('[data-pet-skill-dialog] [data-source-control="txtLv"]').textContent`),String(expected[0].rank));
  await nativeClick(s,'[data-pet-skill-close]');await waitUntil(s,`!document.querySelector('[data-pet-skill-dialog]')`);await closeShop();evidence.ownedPetStrictClose=true;
  assert.equal(network.filter(n=>n.direction==='sent'&&['PetShop','TankShop','OwnedRoleSale'].includes(n.name)&&['BUY','SELL'].includes(n.payload.operation)).length,0);
  evidence.status='PASS_FINITE_PART_MAINTENANCE_SIX_CHOICES_CONFIRMED_DURATION_WALLET_CLOSE_AND_OWNED_PET_RANK_SCOPE';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
  try{const db=new DatabaseSync(database,{readOnly:true});try{evidence.savedCheckpoint=output+'-checkpoint.sqlite';await backup(db,evidence.savedCheckpoint);}finally{db.close();}await writeFile(output+'-checkpoint-fixture.json',JSON.stringify({database:evidence.savedCheckpoint,token:fixture.token,source:checkpoint,fundsFixture:true,ownedOrMinutesInjected:false})+'\n');}catch(error){evidence.checkpointError=String(error);}
  evidence.network=network;
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
}
