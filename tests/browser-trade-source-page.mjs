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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3608',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-trade-source-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-trade-browser-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const persistenceTail=process.argv.includes('--persistence-tail');
const tailIndex=process.argv.indexOf('--persistence-tail');
const firstPath=persistenceTail?process.argv[tailIndex+1]:undefined;
assert(!persistenceTail||firstPath&&!firstPath.startsWith('--'),'Tail requires explicit first raw');
const first=persistenceTail?JSON.parse(await readFile(firstPath,'utf8')):undefined;
const source=persistenceTail?firstPath.replace(/\.json$/,''):'recovery/output/pet-learning-network-2026-10-05T19-06-05-701Z';
const identities=JSON.parse(await readFile(source+'-identity.private.json','utf8')).accounts;
const original=new DatabaseSync(persistenceTail?first.savedCheckpoint:source+'-checkpoint.sqlite',{readOnly:true});try{await backup(original,database);}finally{original.close();}
if(!persistenceTail){
const fixtureDb=new DatabaseSync(database);
const preServiceBalances=[{originality:50,skillPoints:200},{originality:25,skillPoints:100}];
try{for(const [i,identity] of identities.entries()){
  const row=fixtureDb.prepare('SELECT payload FROM role_profiles WHERE account_id = ?').get(identity.accountId);assert(row);
  const bytes=Uint8Array.from(row.payload),view=new DataView(bytes.buffer);view.setUint32(0x7c,preServiceBalances[i].originality,true);view.setUint32(0x80,preServiceBalances[i].skillPoints,true);
  fixtureDb.prepare('UPDATE role_profiles SET payload = ? WHERE account_id = ?').run(bytes,identity.accountId);
}}finally{fixtureDb.close();}
}
const pages=[],contexts=[];
const evidence={status:'RUNNING',runId,ports:{server:3608,vite:5638,cdp:9838},persistenceTail,firstPath,fixture:{source:persistenceTail?first.savedCheckpoint:source+'-checkpoint.sqlite',preServiceBalances:persistenceTail?undefined:[{originality:50,skillPoints:200},{originality:25,skillPoints:100}],earnedBalancesProved:false,fundsMoneyInjected:false,ownedRecordsInjected:false},scope:'Dual ordinary lobby PlayerInfo trade reject/accept, draft survives QUERY, source Show/UNSHOW/dual-confirm partial stack+Pet+money/originality/points, three main whole frames/detail readability, persisted confirmed result and strictClose; no restart/movement matrix'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3608',ACCOUNT_DB_PATH:database};server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5638,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3608',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9838',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9838/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9838');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Trade','TradeState','Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop','RoleProfile','Kitbag','TankTextures','CreateRoom','JoinRoom','LeaveRoom'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(identities[index].token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5638'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-shop]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

  }

  const sessions=pages.map(p=>p.sessionId);
  const latest=i=>network.filter(n=>n.page===sessions[i]&&(n.name==='TradeState'&&n.direction==='received'||n.name==='Trade'&&n.direction==='received'&&n.success)).map(n=>n.response??n.payload).at(-1);
  async function input(s,selector,value){
    await nativeClick(s,selector);
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},s);
    await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},s);
    await command('Input.insertText',{text:String(value)},s);
  }
  if(!persistenceTail){
  for(const [i,s] of sessions.entries()){
    await nativeClick(s,'[data-room-card-shop]');
    await waitUntil(s,`document.querySelector('[data-shop-product-id="1"]')?.matches(':enabled')`);
    await nativeClick(s,'[data-shop-product-id="1"]');await input(s,'[data-shop-quantity]',i===0?2:5);
    await nativeClick(s,'[data-shop-buy]');
    await waitUntil(s,`document.querySelector('[data-shop-status]')?.textContent.includes('已购买')&&!document.querySelector('#account-shop').matches('[aria-busy="true"]')`);
    await nativeClick(s,'[data-shop-close]');await waitUntil(s,`!document.querySelector('#account-shop[open]')`);
  }
  const before=sessions.map((s,i)=>latest(i).account);evidence.before=before;
  async function invite(){
    const s=sessions[0],selector='[data-lobby-player-account="'+identities[1].accountId+'"]';
    await waitUntil(s,`document.querySelector(${JSON.stringify(selector)})`);
    await nativeClick(s,selector);
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'F10',code:'F10',windowsVirtualKeyCode:121,modifiers:8},s);
    await command('Input.dispatchKeyEvent',{type:'keyUp',key:'F10',code:'F10',windowsVirtualKeyCode:121,modifiers:8},s);
    await waitUntil(s,`document.querySelector('[data-player-info-exchange]')?.matches(':enabled')`);
    await nativeClick(s,'[data-player-info-exchange]');
    await waitUntil(sessions[1],`document.querySelector('[data-confirm-binding="web-trade-invitation"]')?.open&&document.querySelector('[data-source-confirm-ok]')?.matches(':enabled')`);
  }
  async function closeTrade(i){await nativeClick(sessions[i],'[data-trade-close]');await waitUntil(sessions[i],`!document.querySelector('[data-trade-page]')`);}
  await invite();await nativeClick(sessions[1],'[data-source-confirm-cancel]');
  for(const s of sessions)await waitUntil(s,`document.querySelector('[data-trade-page]')?.dataset.tradePhase==='CANCELLED'`);
  evidence.rejected=latest(0);for(const i of [0,1])await closeTrade(i);
  await invite();await nativeClick(sessions[1],'[data-source-confirm-ok]');
  for(const s of sessions)await waitUntil(s,`document.querySelector('[data-trade-page]')?.dataset.tradePhase==='OPEN'&&document.querySelector('[data-trade-show]')?.matches(':enabled')`);
  const baseline=sessions.map((s,i)=>latest(i).account);evidence.baseline=baseline;
  const stack=baseline[1].inventory.records.find(r=>r.itemTableId===1);assert.equal(stack.ownedQuantity,5);
  const pet=baseline[1].owned.base.find(r=>new Map(r.fields).get(8)===2&&new Map(r.fields).get(0x6c)===1);assert(pet);
  const petInstance=new Map(pet.fields).get(0);
  await nativeClick(sessions[1],'[data-trade-record-toggle="item:'+stack.instanceId+'"]');
  await input(sessions[1],'[aria-label$="提供数量"]',3);
  await nativeClick(sessions[1],'[data-trade-tab="pet"]');
  await nativeClick(sessions[1],'[data-trade-record-toggle="pet:'+petInstance+'"]');
  await input(sessions[0],'[data-trade-amount="money"]',100);
  const queryCount=()=>network.filter(n=>n.page===sessions[0]&&n.direction==='received'&&n.name==='Trade'&&n.success).length;
  const startQueries=queryCount();
  await evaluate(sessions[0],`new Promise(resolve=>setTimeout(resolve,2400))`);
  assert.equal(await evaluate(sessions[0],`document.querySelector('[data-trade-amount="money"]').value`),'100');assert(queryCount()>startQueries);evidence.queryPreservedDraft=true;
  for(const [i,values] of [[0,{money:100,originality:5,skillPoints:10}],[1,{money:200,originality:3,skillPoints:20}]]){
    for(const [field,value] of Object.entries(values))await input(sessions[i],'[data-trade-amount="'+field+'"]',value);
    await nativeClick(sessions[i],'[data-trade-show]');
    await waitUntil(sessions[i],`document.querySelector('[data-trade-show]').getAttribute('aria-label')==='撤回展示'&&!document.querySelector('[data-trade-page]').matches('[aria-busy="true"]')`);
  }
  await waitUntil(sessions[0],`document.querySelector('[data-trade-show]')?.getAttribute('aria-label')==='展示'&&document.querySelector('[data-trade-show]')?.matches(':enabled')`);
  await nativeClick(sessions[0],'[data-trade-show]');
  await waitUntil(sessions[0],`document.querySelector('[data-trade-confirm]')?.matches(':enabled')`);
  const shown=latest(0);evidence.shown=shown;
  const donor=shown.session.parties.find(p=>p.accountId===identities[1].accountId);assert.equal(donor.offer.records.find(r=>r.kind==='item').quantity,3);assert.equal(donor.records.find(r=>r.kind==='item').item.ownedQuantity,5);
  assert.equal(await evaluate(sessions[0],`document.querySelector('[data-source-control="txtOtherItemCount0"]').textContent`),'3');
  await nativeClick(sessions[0],'[data-trade-show]');await waitUntil(sessions[0],`document.querySelector('[data-trade-show]').getAttribute('aria-label')==='展示'&&document.querySelector('[data-trade-confirm]').disabled`);evidence.unshow=true;
  await nativeClick(sessions[0],'[data-trade-show]');await waitUntil(sessions[0],`document.querySelector('[data-trade-confirm]')?.matches(':enabled')`);
  await nativeClick(sessions[0],'[data-trade-offer-record="Other:1"] .trade-source-grid-detail');
  await waitUntil(sessions[0],`document.querySelector('[data-trade-detail="pet"]')?.open`);
  await nativeClick(sessions[1],'[data-trade-show]');
  await waitUntil(sessions[1],`document.querySelector('[data-trade-show]').getAttribute('aria-label')==='展示'`);
  await waitUntil(sessions[0],`!document.querySelector('[data-trade-detail]')`);
  evidence.peerUnshowClosesDetail=true;
  await nativeClick(sessions[1],'[data-trade-show]');
  await waitUntil(sessions[0],`document.querySelector('[data-trade-confirm]')?.matches(':enabled')`);
  evidence.frames=[];
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    const s=sessions[0];await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const metrics=await evaluate(s,`(()=>{const d=document.querySelector('[data-trade-page]'),rect=e=>e.getBoundingClientRect().toJSON(),glyph=e=>{const range=document.createRange();range.selectNodeContents(e);return [...range.getClientRects()].map(r=>r.toJSON());};return {texts:['txtMyName','txtOtherName','txtOtherMoney','txtOtherOriginality','txtOtherTech','txtOtherItemCount0'].map(name=>{const e=d.querySelector('[data-source-control="'+name+'"]');return {name,text:e.textContent,bounds:rect(e),glyph:glyph(e)};}),controls:['show','confirm','cancel','close'].map(name=>({name,bounds:rect(d.querySelector('[data-trade-'+name+']'))})),offerRecords:d.querySelectorAll('[data-trade-offer-record]').length};})()`);
    for(const t of metrics.texts)for(const r of t.glyph)assert(r.left>=-.5&&r.top>=-.5&&r.right<=width+.5&&r.bottom<=height+.5);
    for(const c of metrics.controls)assert(c.bounds.left>=0&&c.bounds.top>=0&&c.bounds.right<=width&&c.bounds.bottom<=height);
    const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+width+'-trade.png';await writeFile(path,Buffer.from(shot.data,'base64'));evidence.frames.push({viewport:[width,height],metrics,path});
    await writeFile(output+'.json',JSON.stringify({...evidence,network},null,2)+'\n');
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessions[0]);
  await nativeClick(sessions[0],'[data-trade-offer-record="Other:1"] .trade-source-grid-detail');
  await waitUntil(sessions[0],`document.querySelector('[data-trade-detail="pet"]')?.open`);
  assert.equal(await evaluate(sessions[0],`document.querySelector('[data-trade-detail] [data-source-control="txtName"]').textContent`),pet.name);
  const detailShot=await command('Page.captureScreenshot',{format:'png'},sessions[0]);evidence.detailWhole=output+'-pet-detail.png';await writeFile(evidence.detailWhole,Buffer.from(detailShot.data,'base64'));
  await nativeClick(sessions[0],'[data-trade-detail-close]');await waitUntil(sessions[0],`!document.querySelector('[data-trade-detail]')`);
  await nativeClick(sessions[0],'[data-trade-confirm]');await waitUntil(sessions[0],`document.querySelector('[data-trade-confirm]').disabled&&!document.querySelector('[data-trade-page]').matches('[aria-busy="true"]')`);
  await waitUntil(sessions[1],`document.querySelector('[data-trade-confirm]')?.matches(':enabled')`);await nativeClick(sessions[1],'[data-trade-confirm]');
  for(const s of sessions)await waitUntil(s,`document.querySelector('[data-trade-page]')?.dataset.tradePhase==='COMPLETED'`);
  const final=sessions.map((s,i)=>latest(i).account);evidence.final=final;
  assert.equal(final[0].wallet.money,baseline[0].wallet.money+100);assert.equal(final[1].wallet.money,baseline[1].wallet.money-100);
  assert.equal(final[0].wallet.originality,48);assert.equal(final[1].wallet.originality,27);assert.equal(final[0].wallet.skillPoints,210);assert.equal(final[1].wallet.skillPoints,90);
  assert.equal(final[0].inventory.records.find(r=>r.itemTableId===1).ownedQuantity,5);assert.equal(final[1].inventory.records.find(r=>r.itemTableId===1).ownedQuantity,2);
  assert(!final[1].owned.base.some(r=>new Map(r.fields).get(0)===petInstance));assert(final[0].owned.base.some(r=>r.name===pet.name&&new Map(r.fields).get(0x6c)===1));
  for(const i of [0,1])await closeTrade(i);evidence.strictCloseBoth=true;
  const native=new DatabaseSync(database,{readOnly:true});
  try{evidence.persisted=identities.map((identity,i)=>{const bytes=Uint8Array.from(native.prepare('SELECT payload FROM role_profiles WHERE account_id=?').get(identity.accountId).payload),v=new DataView(bytes.buffer);const wallet={money:v.getUint32(0x70,true),originality:v.getUint32(0x7c,true),skillPoints:v.getUint32(0x80,true)};assert.deepEqual(wallet,final[i].wallet);return {wallet,owned:native.prepare('SELECT record FROM role_records WHERE account_id=?').all(identity.accountId).map(r=>JSON.parse(r.record)),inventory:native.prepare('SELECT record FROM inventory WHERE account_id=?').all(identity.accountId).map(r=>JSON.parse(r.record))};});}finally{native.close();}
  assert(!network.some(n=>n.direction==='sent'&&['SelectRole','CreateRoom','JoinRoom','Equipment'].includes(n.name)));
  evidence.status='PASS_FINITE_NORMAL_TRADE_INVITE_DRAFT_SHOW_UNSHOW_PARTIAL_RECORD_SCALAR_DUAL_CONFIRM_PERSISTENCE_CLOSE_SCOPE';
  }else{
    for(const [i,s] of sessions.entries()){
      await waitUntil(s,`document.querySelector('[data-lobby-player-account="${identities[1-i].accountId}"]')`);
      const result=latest(i);assert(result?.account);assert.deepEqual(result.account,first.final[i]);
    }
    evidence.restoredAccounts=sessions.map((s,i)=>latest(i).account);
    const native=new DatabaseSync(database,{readOnly:true});
    try{evidence.native=identities.map((identity,i)=>{
      const profile=native.prepare('SELECT payload,strings FROM role_profiles WHERE account_id=?').get(identity.accountId);
      assert.deepEqual({bytes:[...profile.payload],strings:JSON.parse(profile.strings)},first.final[i].profile);
      const rows=native.prepare('SELECT kind,record FROM role_records WHERE account_id=? ORDER BY instance_id').all(identity.accountId);
      const owned={base:rows.filter(r=>r.kind==='base').map(r=>JSON.parse(r.record)),equipment:rows.filter(r=>r.kind!=='base').map(r=>JSON.parse(r.record))};
      assert.deepEqual(owned,first.final[i].owned);
      const inventory=native.prepare('SELECT record FROM inventory WHERE account_id=? ORDER BY instance_id').all(identity.accountId).map(r=>JSON.parse(r.record));
      assert.deepEqual(inventory,first.final[i].inventory.records);
      return {owned,inventory,profileMatched:true};
    });}finally{native.close();}
    const host=sessions[0],guest=sessions[1],selector='[data-lobby-player-account="'+identities[1].accountId+'"]';
    await nativeClick(host,selector);
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'F10',code:'F10',windowsVirtualKeyCode:121,modifiers:8},host);
    await command('Input.dispatchKeyEvent',{type:'keyUp',key:'F10',code:'F10',windowsVirtualKeyCode:121,modifiers:8},host);
    await waitUntil(host,`document.querySelector('[data-player-info-exchange]')?.matches(':enabled')`);
    await nativeClick(host,'[data-player-info-exchange]');
    await waitUntil(guest,`document.querySelector('[data-confirm-binding="web-trade-invitation"]')?.open&&document.querySelector('[data-source-confirm-ok]')?.matches(':enabled')`);
    await nativeClick(guest,'[data-source-confirm-ok]');
    for(const s of sessions)await waitUntil(s,`document.querySelector('[data-trade-page]')?.dataset.tradePhase==='OPEN'&&document.querySelector('[data-trade-show]')?.matches(':enabled')`);
    for(const s of sessions){await nativeClick(s,'[data-trade-show]');await waitUntil(s,`document.querySelector('[data-trade-show]').getAttribute('aria-label')==='撤回展示'`);}
    const shown=latest(0).session;assert(shown.parties.every(p=>p.shown));
    for(const party of shown.parties)assert.deepEqual(party.offer,{money:0,originality:0,skillPoints:0,records:[]});
    await waitUntil(host,`document.querySelector('[data-trade-confirm]')?.matches(':enabled')`);await nativeClick(host,'[data-trade-confirm]');
    await waitUntil(guest,`document.querySelector('[data-trade-confirm]')?.matches(':enabled')`);await nativeClick(guest,'[data-trade-confirm]');
    for(const [i,s] of sessions.entries()){
      await waitUntil(s,`document.querySelector('[data-trade-page]')?.dataset.tradePhase==='COMPLETED'`);
      assert.deepEqual(latest(i).account,first.final[i]);
    }
    evidence.zeroOfferNewSession=latest(0).session;evidence.accountsUnchanged=true;
    for(const s of sessions){await nativeClick(s,'[data-trade-close]');await waitUntil(s,`!document.querySelector('[data-trade-page]')`);assert(await evaluate(s,`!document.querySelector('dialog[open]')&&document.activeElement!==document.body`));}
    evidence.strictCloseBoth=true;
    const writes=network.filter(n=>n.direction==='sent'&&n.name==='Trade'&&n.payload.operation!=='QUERY');
    assert.equal(writes.filter(n=>n.payload.operation==='INVITE').length,1);assert.equal(writes.filter(n=>n.payload.operation==='RESPOND').length,1);
    assert.equal(writes.filter(n=>n.payload.operation==='SHOW').length,2);assert.equal(writes.filter(n=>n.payload.operation==='CONFIRM').length,2);
    assert(!network.some(n=>n.direction==='sent'&&n.payload?.operation==='BUY'));
    evidence.status='PASS_FINITE_TRADE_SETTLED_CHECKPOINT_NATIVE_AND_NEW_ZERO_OFFER_COMPLETED_CLOSE_SCOPE';
  }
  console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
  evidence.network=network;
  try{const db=new DatabaseSync(database,{readOnly:true});try{evidence.savedCheckpoint=output+'-checkpoint.sqlite';await backup(db,evidence.savedCheckpoint);}finally{db.close();}await writeFile(output+'-identity.private.json',JSON.stringify({accounts:identities})+'\n',{mode:0o600});}catch(error){evidence.checkpointError=String(error);}
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.processCleanup={chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,serverStopped:server?.exitCode!==null||server?.signalCode!==null,viteClosed:true,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
}
