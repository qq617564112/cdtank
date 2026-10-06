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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3523',logger:undefined});
const network=[],accountIds=new Map();
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-home-player-profile-numbers-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-player-profile-numbers-'));
const database=join(directory,'accounts.sqlite');
const fixture=JSON.parse(await readFile('recovery/output/home-tank-active-marker-browser-fixture.json','utf8'));
const checkpoint=fixture.database??'recovery/output/home-tank-active-marker-browser.sqlite';
const original=new DatabaseSync(checkpoint,{readOnly:true});try{await backup(original,database);}finally{original.close();}
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3523,vite:5553,cdp:9753},runId,scope:'Home source profile numbers readonly display at1920; zero, absent and explicit signed source-value fixture'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3523',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5553,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3523',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9753',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9753/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9753');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(r.service.name==='Account'&&r.ret?.isSucc)accountIds.set(m.sessionId,r.ret.res.accountId);if(['History','Kitbag','DisplayName','Friends','Blacklist','Equipment','Inventory','RoleProfile','Shop','TankShop','PetShop','SelectRole','CreateRoom','Join','Ready','AddCpu','RoomChat','RoomWhisper','FriendChat'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});



  for(let i=0;i<2;i++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Network.enable',{},sessionId);await command('Page.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    if(i===0)await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);
    await command('Page.navigate',{url:'http://127.0.0.1:5553'},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-home]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);
  }
  evidence.scope='Home source profile score/originality/tech readonly numbers,1920, missing profile blank, source Close/reopen; no earned policy';
  evidence.checkpoint={source:checkpoint,copied:true,originalModified:false,originalFundsFixture:true,profileValuesInjected:false};
  evidence.states=[];evidence.screenshots=[];
  async function inspectHome(p,label,expectedPresent) {
    const s=p.sessionId,networkStart=network.length;
    await nativeClick(s,'[data-room-card-home]');
    await waitUntil(s,`document.querySelector('#home-inventory [data-home-close]')?.matches(':enabled')&&document.querySelectorAll('[data-home-player-profile-number]').length===3`);
    await waitUntil(s,`!document.querySelector('#home-inventory')?.getAttribute('aria-busy')||document.querySelector('#home-inventory')?.getAttribute('aria-busy')==='false'`);
    const deadline=Date.now()+10000;
    while(!network.slice(networkStart).some(n=>n.page===s&&n.name==='RoleProfile'&&n.direction==='received'&&n.success)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,25));
    const response=network.slice(networkStart).find(n=>n.page===s&&n.name==='RoleProfile'&&n.direction==='received'&&n.success)?.response;
    assert(response,'RoleProfile success');
    const expected=response.playerSummary;
    assert(expectedPresent?expected:!expected);
    if(expected){const v=new DataView(Uint8Array.from(response.profile.bytes).buffer);assert.deepEqual(expected,{score:v.getInt32(0x5c,true),originality:v.getInt32(0x9c,true),tech:v.getInt32(0xa0,true)});}
    await waitUntil(s,`[...document.querySelectorAll('[data-home-player-profile-number]')].every(e=>e.textContent===(${JSON.stringify(expected??null)}?String((${JSON.stringify(expected??null)})[e.dataset.homePlayerProfileNumber]):''))`);
    await evaluate(s,`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
    const state=await evaluate(s,`(()=>{const dialog=document.querySelector('#home-inventory');return {viewport:[innerWidth,innerHeight],fields:[...dialog.querySelectorAll('[data-home-player-profile-number]')].map(e=>({field:e.dataset.homePlayerProfileNumber,text:e.textContent,rect:e.getBoundingClientRect().toJSON(),binding:e.dataset.profileBinding})),withinDialog:dialog.contains(document.activeElement)}})()`);
    for(const f of state.fields)assert.equal(f.text,expected?String(expected[f.field]):'');
    state.label=label;state.confirmedResponse=expected??null;state.profilePresent=Boolean(response.profile);evidence.states.push(state);
    const shot=await command('Page.captureScreenshot',{format:'png'},s),path=output+'-'+label+'-1920.png';await writeFile(path,Buffer.from(shot.data,'base64'));evidence.screenshots.push(path);
    await nativeClick(s,'[data-home-close]');await waitUntil(s,`!document.querySelector('#home-inventory[open]')&&document.activeElement.matches('[data-room-card-home]')`);
    if(expectedPresent){await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('[data-home-player-profile-number="score"]')?.textContent===${JSON.stringify(String(expected.score))}`);await nativeClick(s,'[data-home-close]');await waitUntil(s,`!document.querySelector('#home-inventory[open]')&&document.activeElement.matches('[data-room-card-home]')`);evidence.sameTokenReopen=true;}
  }
  await inspectHome(pages[0],'confirmed-zero',true);
  assert.deepEqual(evidence.states[0].confirmedResponse,{score:0,originality:0,tech:0});
  await inspectHome(pages[1],'absent',false);
  for(const p of pages)await command('Page.navigate',{url:'about:blank'},p.sessionId);
  await stop(server);
  const accountId=accountIds.get(pages[0].sessionId);assert(accountId,'Authenticated checkpoint identity');
  const db=new DatabaseSync(database,{readOnly:true});
  const row=db.prepare('SELECT payload, strings FROM role_profiles WHERE account_id = ?').get(accountId);db.close();
  assert(row?.payload?.length===368);
  const bytes=Uint8Array.from(row.payload),before=Uint8Array.from(bytes),view=new DataView(bytes.buffer);
  view.setInt32(0x5c,17,true);view.setInt32(0x9c,123456789,true);view.setInt32(0xa0,-1,true);
  const offsets=[0x5c,0x9c,0xa0],changedBytes=offsets.flatMap(o=>[o,o+1,o+2,o+3]);
  for(let i=0;i<368;i++)if(!changedBytes.includes(i))assert.equal(bytes[i],before[i]);
  const input=join(directory,'source-values.json');
  await writeFile(input,JSON.stringify({bytes:[...bytes],strings:JSON.parse(row.strings)}));
  const importer=spawn(process.execPath,['--import','tsx','apps/server/src/import-role-profile.ts',accountId,input],{env:{...process.env,ACCOUNT_DB_PATH:database},stdio:['ignore','pipe','pipe']});
  let importLog='';for(const stream of [importer.stdout,importer.stderr])stream.on('data',d=>{importLog+=String(d);});
  const importExit=await new Promise(r=>importer.once('exit',r));assert.equal(importExit,0,importLog);
  const restored=new DatabaseSync(database,{readOnly:true});
  const actual=restored.prepare('SELECT payload, strings FROM role_profiles WHERE account_id = ?').get(accountId);restored.close();
  assert.deepEqual([...actual.payload],[...bytes]);assert.equal(actual.strings,row.strings);
  evidence.sourceValueDisplayFixture={temporaryDatabaseOnly:true,formalProfileImportExit:importExit,payloadBytes:368,values:{score:17,originality:123456789,tech:-1},offsets,otherBytesUnchanged:true,stringsUnchanged:true,originalModified:false,earnedPolicyClaim:false};
  await startServer();
  await command('Page.navigate',{url:'http://127.0.0.1:5553'},pages[0].sessionId);
  await waitUntil(pages[0].sessionId,`document.querySelector('[data-room-card-home]')?.matches(':enabled')`);
  await inspectHome(pages[0],'source-values',true);
  assert.deepEqual(evidence.states[2].confirmedResponse,evidence.sourceValueDisplayFixture.values);
  assert(!network.some(n=>n.direction==='sent'&&(['Kitbag','SelectRole','CreateRoom','Join','Ready','AddCpu','RoomChat','RoomWhisper','FriendChat'].includes(n.name)||(['Shop','TankShop','PetShop','Equipment','Friends','Blacklist'].includes(n.name)&&n.payload?.operation!=='QUERY')||(n.name==='DisplayName'&&n.payload?.name!==undefined))));
  evidence.strictHomeOpener=true;evidence.noAccountRoomSendPurchaseWrite=true;evidence.status='PASS';console.log('PASS Home profile numbers '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{if(evidence.status==='FAIL'&&pages.length){try{const shot=await command('Page.captureScreenshot',{format:'png'},pages[0].sessionId);evidence.failureFrame=output+'-failure.png';await writeFile(evidence.failureFrame,Buffer.from(shot.data,'base64'));}catch{}}evidence.network=network;await writeFile(output+'-server.log',serverLog);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={serverStopped:server?.exitCode!==null||server?.signalCode!==null,chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
