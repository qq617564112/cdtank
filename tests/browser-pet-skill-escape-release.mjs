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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3488',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-pet-skill-escape-release-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-pet-details-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3488,vite:5518,cdp:9718},runId,scope:'UI35 Home/Shop child skill native Escape down/up, strict opener and subsequent parent close; readonly checkpoint, no transactions or screenshots.'};
const fixture=JSON.parse(await readFile('recovery/output/home-pet-skill-source-browser-fixture.json','utf8'));
const sourceDb=new DatabaseSync(fixture.database,{readOnly:true});try{await backup(sourceDb,database);}finally{sourceDb.close();}
evidence.checkpoint={source:fixture.database,readOnly:true,copied:true,originalFundsFixture:true,newInjection:false};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3488',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5518,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3488',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9718',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9718/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9718');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop','CreateRoom','Join','Ready'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+')'},sessionId);await command('Network.enable',{},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5518'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const s=pages[0].sessionId;

  evidence.fixtureTokenIdentityMatched=await evaluate(s,'localStorage.getItem("cdtank-account-token")==='+JSON.stringify(fixture.token));assert(evidence.fixtureTokenIdentityMatched);
  await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('[data-home-name-open]')?.matches(':enabled')`);
  await nativeClick(s,'#home-inventory [data-role-tab="pet"]');await waitUntil(s,`document.querySelectorAll('#home-roles [data-owned-role]').length===1`);
  const owned=network.filter(row=>row.name==='OwnedRoles'&&row.success).at(-1).response.base;assert.equal(owned.length,1);const record=owned[0],fields=new Map(record.fields);await nativeClick(s,'#home-roles [data-owned-role="'+fields.get(0)+'"]');await waitUntil(s,`document.querySelector('[data-home-pet-view-skill="1"]')?.matches(':enabled')`);
  const skillId=fields.get(0x48),level=fields.get(0x60);evidence.confirmed={instanceId:fields.get(0),skillId,level};
  await nativeClick(s,'[data-home-pet-view-skill="1"]');await waitUntil(s,`document.querySelector('[data-pet-skill-dialog]')?.open&&document.activeElement.matches('[data-pet-skill-close]')`);evidence.resolutions=[];
  async function escape(parent,opener,label){
    await evaluate(s,`window.petSkillKeys=[];window.addEventListener('keydown',e=>window.petSkillKeys.push('down:'+e.code));window.addEventListener('keyup',e=>window.petSkillKeys.push('up:'+e.code))`);
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);
    const down=await evaluate(s,`(()=>{const d=document.querySelector('[data-pet-skill-dialog]');return {open:!!d?.open,focus:!!d?.contains(document.activeElement),parent:!!document.querySelector(${JSON.stringify(parent)}),keys:window.petSkillKeys}})()`);
    assert(down.open&&down.focus&&down.parent);assert.deepEqual(down.keys,[]);
    await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);
    await waitUntil(s,`!document.querySelector('[data-pet-skill-dialog]')&&document.activeElement.matches(${JSON.stringify(opener)})`);
    const up=await evaluate(s,`({parent:!!document.querySelector(${JSON.stringify(parent)}),keys:window.petSkillKeys})`);assert(up.parent);assert.deepEqual(up.keys,[]);
    evidence[label]={down,up,strictOpener:true};
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);
    assert(await evaluate(s,`!!document.querySelector(${JSON.stringify(parent)})`));
    await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);
    await waitUntil(s,`!document.querySelector(${JSON.stringify(parent)})`);
    assert.deepEqual(await evaluate(s,'window.petSkillKeys'),[]);evidence[label].parentNextEscapeClosed=true;
  }
  await escape('#home-roles','[data-home-pet-view-skill="1"]','home');
  await waitUntil(s,`document.activeElement.matches('[data-room-card-home]')`);
  await nativeClick(s,'[data-room-card-shop]');await waitUntil(s,`document.querySelector('[data-shop-root-category="Pet"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-root-category="Pet"]');await waitUntil(s,`document.querySelector('[data-pet-shop-product-id="2"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-pet-shop-product-id="2"]');await waitUntil(s,`document.querySelector('[data-pet-shop-skill-open="1"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-pet-shop-skill-open="1"]');await waitUntil(s,`document.querySelector('[data-pet-skill-dialog]')?.open`);
  await escape('#account-shop','[data-pet-shop-skill-open="1"]','shop');
  await waitUntil(s,`document.activeElement.matches('[data-room-card-shop]')`);
  assert(!network.some(r=>r.direction==='sent'&&(['SelectRole','CreateRoom','Join','Ready'].includes(r.name)||(['Shop','PetShop','TankShop','Equipment'].includes(r.name)&&r.payload?.operation!=='QUERY'))));
  evidence.noTransactions=true;evidence.noScreenshots=true;evidence.status='PASS';console.log('PASS pet skill child Escape '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
