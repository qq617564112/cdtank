import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile, copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3378',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-home-battle-summary-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-summary-'));
const database=join(directory,'accounts.sqlite');
const historyFixture = process.argv.includes('--populated-only') ? JSON.parse(await readFile('recovery/output/account-history-browser-fixture.json','utf8')) : undefined;
if(historyFixture)await copyFile('recovery/output/account-history-browser.sqlite',database);
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const readabilityOnly=process.argv.includes('--readability-only');

const evidence={status:'RUNNING',ports:{server:3378,vite:5428,cdp:9628},runId,scope:'UI36/UI38 whole Home player source saved statistics; real readonly History full-page query, refresh, normal close/reopen; original lifetime stats unproved.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3378',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5428,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3378',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9628',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9628/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9628');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['History','Inventory'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:historyFixture?'about:blank':'http://127.0.0.1:5428',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    if(historyFixture){await command('Page.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(historyFixture.token)+')'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5428'},sessionId);}
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);
    if(historyFixture)assert.equal(await evaluate(sessionId,'localStorage.getItem("cdtank-account-token")==='+JSON.stringify(historyFixture.token)),true,'Existing legal fixture account must actually be reused');

  }
  const s=pages[0].sessionId;
  if(readabilityOnly){await evaluate(s,`(async()=>{const {Battle}=await import('/src/match/battle.ts');const original=Battle.prototype.history;Battle.prototype.history=function(offset){return original.call(this,offset,1)}})()`);evidence.readonlyPaginationInstrument={requestedPageSize:1,originalProductionPageSize:50,recordsFabricated:false};}
  await nativeClick(s,'[data-room-card-home]');
  await waitUntil(s,`document.querySelector('[data-home-saved-summary]')?.getAttribute('aria-busy')==='false'&&document.querySelector('#home-inventory').getAttribute('aria-busy')==='false'`);
  async function state(){return evaluate(s,`({status:document.querySelector('[data-home-saved-summary-status]').textContent,values:[...document.querySelectorAll('[data-saved-summary-field]')].map(e=>({field:e.dataset.savedSummaryField,value:e.dataset.savedSummaryValue,text:e.textContent})),unknowns:[...document.querySelectorAll('[data-source-layout="ui/layouts/myhome_playerpage_battlesummary.xml"][data-source-control]')].map(e=>e.dataset.sourceControl),selected:document.querySelector('[data-home-saved-summary-tab]').getAttribute('aria-pressed')})`);}
  evidence.initial=await state();const response=network.filter(r=>r.name==='History'&&r.direction==='received'&&r.success).at(-1)?.response;
  assert(response);evidence.history=response;assert.equal(response.total,historyFixture?.expectedCount??0);assert.equal(evidence.initial.values.length,5);const historyPages=network.filter(r=>r.name==='History'&&r.direction==='received'&&r.success).map(r=>r.response);const confirmedRecords=historyPages.flatMap(p=>p.records);evidence.historyPages=historyPages;if(readabilityOnly){assert.deepEqual(historyPages.map(p=>p.offset),[0,1]);assert(historyPages.every(p=>p.records.length===1));}const expected={wins:confirmedRecords.filter(r=>r.result.outcome==='WIN').length,losses:confirmedRecords.filter(r=>r.result.outcome==='LOSE').length,draws:confirmedRecords.filter(r=>r.result.outcome==='DRAW').length,kills:confirmedRecords.reduce((n,r)=>n+r.result.kills,0),deaths:confirmedRecords.reduce((n,r)=>n+r.result.deaths,0)};assert(evidence.initial.values.every(v=>Number(v.value)===expected[v.field]&&v.text===v.value));evidence.expected=expected;assert.equal(evidence.initial.selected,'true');
  evidence.sizes=[];
  for(const [width,height]of (historyFixture?[[1920,1080]]:[[800,600],[1920,1080],[3840,2160]])){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const layout=await evaluate(s,`(()=>{const b=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};return {viewport:{width:innerWidth,height:innerHeight},stage:b(document.querySelector('[data-home-page]')),summary:b(document.querySelector('[data-home-saved-summary]')),image:b(document.querySelector('[data-source-control="xiamiandeditu"]')),fields:[...document.querySelectorAll('[data-saved-summary-field]')].map(e=>({...b(e),field:e.dataset.savedSummaryField})),assets:[...document.querySelectorAll('[data-home-saved-summary] [data-source-asset]')].map(e=>e.dataset.sourceAsset)}})()`);
    assert(layout.assets.length>0);assert(layout.fields.every(f=>f.x>=0&&f.y>=0&&f.x+f.width<=width&&f.y+f.height<=height));evidence.sizes.push(layout);
    const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  if(!readabilityOnly){const before=network.length;await nativeClick(s,'[data-home-saved-summary-refresh]');await waitUntil(s,`document.querySelector('[data-home-saved-summary]').getAttribute('aria-busy')==='false'`);evidence.refreshed=await state();assert.deepEqual(evidence.refreshed.values,evidence.initial.values);assert(network.slice(before).some(r=>r.name==='History'&&r.direction==='received'&&r.success));
  await nativeClick(s,'[data-home-close]');await waitUntil(s,`!document.querySelector('#home-inventory[open]')&&document.activeElement.matches('[data-room-card-home]')`);evidence.closeFocus=true;
  await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('[data-home-saved-summary]')?.getAttribute('aria-busy')==='false'`);evidence.reopened=await state();assert.deepEqual(evidence.reopened.values,evidence.initial.values);
  await nativeClick(s,'[data-home-close]');await waitUntil(s,`document.activeElement.matches('[data-room-card-home]')`);
  }
  evidence.status='PASS';evidence.fixtureScope=historyFixture?'readonly copy of existing legal natural two-round persisted History; original evidence DB unchanged':'new account real empty History';console.log('PASS real History five confirmed fields/whole Home/refresh/normal close-reopen-focus; original lifetime stats unproved');
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
  evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
