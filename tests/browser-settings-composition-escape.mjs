import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3444',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-settings-composition-escape-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-settings-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];


const keyboardOnly=process.argv.includes('--navigation-only');
const evidence={status:'RUNNING',resolutions:[],ports:{server:3444,vite:5472,cdp:9675},runId,scope:'UI50 keyboard-only composition lifecycle event with native CDP Escape on actual Chinese quick-chat draft; no screenshot/save/send/room/BUY/audio repeats; OS IME unproven.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3444',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'30'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5472,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3444',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9675',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9675/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9675');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Equipment','Inventory','TankShop','TankTextures','OwnedRoles','RoleProfile','Shop'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5472',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const session=pages[0].sessionId;

  async function screenshot(suffix){const shot=await command('Page.captureScreenshot',{format:'png'},session);await writeFile(output+'-'+suffix+'.png',Buffer.from(shot.data,'base64'));}
  async function press(key,code,windowsVirtualKeyCode,modifiers){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode,modifiers},session);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode,modifiers},session);}
  async function input(selector,value){await nativeClick(session,selector);await press('a','KeyA',65,2);await command('Input.insertText',{text:value},session);}
  async function openSettings(){await nativeClick(session,'#home-inventory[open] #open-quick-chat-settings');await waitUntil(session,`document.querySelector('#source-settings[open]')&&document.querySelector('[data-settings-confirm]')?.matches(':enabled')`);}
  async function closedSettings(){await waitUntil(session,`!document.querySelector('#source-settings[open]')`);assert.equal(await evaluate(session,`document.activeElement===document.querySelector('#home-inventory[open] #open-quick-chat-settings')`),true);}
  await nativeClick(session,'[data-room-card-home]');await waitUntil(session,`document.querySelector('#home-inventory[open] #open-quick-chat-settings')?.matches(':enabled')`);await openSettings();
  const field='[data-settings-quick-chat="F5"]';await nativeClick(session,field);
  const initial=await evaluate(session,`document.querySelector('${field}').value`);
  await command('Input.insertText',{text:'中文组合草稿'},session);
  const draft=await evaluate(session,`document.querySelector('${field}').value`);
  await evaluate(session,`(()=>{window.settingsEscapeKeys=[];window.addEventListener('keydown',e=>window.settingsEscapeKeys.push(e.code));document.querySelector('${field}').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'中'}));})()`);
  await press('Escape','Escape',27,0);
  evidence.compositionEscape=await evaluate(session,`({open:!!document.querySelector('#source-settings[open]'),draft:document.querySelector('${field}')?.value,focus:document.activeElement===document.querySelector('${field}'),windowKeys:window.settingsEscapeKeys})`);
  assert(evidence.compositionEscape.open);assert.equal(evidence.compositionEscape.draft,draft);assert(evidence.compositionEscape.focus);assert.deepEqual(evidence.compositionEscape.windowKeys,[]);
  await evaluate(session,`document.querySelector('#source-settings').dispatchEvent(new Event('cancel',{cancelable:true}))`);
  evidence.nativeCancelDuringComposition=await evaluate(session,`!!document.querySelector('#source-settings[open]')`);assert(evidence.nativeCancelDuringComposition);
  await evaluate(session,`document.querySelector('${field}').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中文'}))`);
  await press('Escape','Escape',27,0);await closedSettings();evidence.afterCompositionEscape={closed:true,strictOpener:true};
  await openSettings();assert.equal(await evaluate(session,`document.querySelector('${field}').value`),initial);evidence.cancelledDraft=true;
  await nativeClick(session,'[data-settings-close]');await closedSettings();
  await nativeClick(session,'[data-home-close]');await waitUntil(session,`!document.querySelector('#home-inventory[open]')&&document.activeElement.matches('[data-room-card-home]')&&document.activeElement.matches(':enabled')`);evidence.strictHomeFocus=true;
  evidence.noSaveSendPurchaseRoom=true;evidence.status='PASS';console.log('PASS settings composition Escape '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);store?.close();await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
