import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3457',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-settings-display-mode-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-settings-display-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];



const evidence={status:'RUNNING',resolutions:[1920],screenshots:[],ports:{server:3457,vite:5487,cdp:9687},runId,scope:'UI50 source display radios with real browser Fullscreen API; native gesture and confirmed selection, draft/modal/focus only. No device-mode/Apply claim or save/send/room/BUY.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3457',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'30'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5487,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3457',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9687',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9687/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9687');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5487',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);
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
  const field='[data-settings-quick-chat="F5"]';
  await nativeClick(session,field);await command('Input.insertText',{text:'窗口全屏中文草稿'},session);
  const draft=await evaluate(session,`document.querySelector('${field}').value`);
  await evaluate(session,`(()=>{window.displayModeEvents=[];document.addEventListener('fullscreenchange',()=>window.displayModeEvents.push({fullscreen:document.fullscreenElement===document.documentElement,open:!!document.querySelector('#source-settings[open]')}));})()`);
  async function readMode(){return evaluate(session,`({fullscreen:document.fullscreenElement===document.documentElement,enabled:document.fullscreenEnabled,activeElement:document.activeElement?.tagName,activeSource:document.activeElement?.dataset.sourceControl,open:!!document.querySelector('#source-settings[open]'),withinDialog:document.querySelector('#source-settings')?.contains(document.activeElement),draft:document.querySelector('${field}')?.value,windowSelected:document.querySelector('[data-settings-display-mode="window"]')?.getAttribute('aria-pressed'),fullSelected:document.querySelector('[data-settings-display-mode="fullscreen"]')?.getAttribute('aria-pressed'),checkmarks:[...document.querySelectorAll('[data-settings-display-mode]')].map(e=>({mode:e.dataset.settingsDisplayMode,checkmark:!!e.querySelector('[data-room-button-image="CheckMarkImage"]'),images:[...e.querySelectorAll('[data-source-asset]')].map(i=>i.dataset.sourceAsset)})),events:window.displayModeEvents,status:document.querySelector('[data-settings-status]')?.value})`);}
  evidence.initial=await readMode();assert(!evidence.initial.fullscreen);assert.equal(evidence.initial.windowSelected,'true');assert.equal(evidence.initial.fullSelected,'false');
  await nativeClick(session,'[data-settings-display-mode="fullscreen"]');
  await waitUntil(session,`document.fullscreenElement===document.documentElement&&document.querySelector('[data-settings-display-mode="fullscreen"]')?.getAttribute('aria-pressed')==='true'`);
  evidence.entered=await readMode();assert(evidence.entered.open&&evidence.entered.withinDialog);assert.equal(evidence.entered.draft,draft);assert.equal(evidence.entered.windowSelected,'false');assert(evidence.entered.checkmarks.find(x=>x.mode==='fullscreen').checkmark);assert(evidence.entered.events.some(x=>x.fullscreen));
  await screenshot('1920');evidence.screenshots.push(output+'-1920.png');
  await nativeClick(session,'[data-settings-display-mode="window"]');
  await waitUntil(session,`!document.fullscreenElement&&document.querySelector('[data-settings-display-mode="window"]')?.getAttribute('aria-pressed')==='true'`);
  evidence.exited=await readMode();assert(evidence.exited.open&&evidence.exited.withinDialog);assert.equal(evidence.exited.draft,draft);assert.equal(evidence.exited.fullSelected,'false');assert(evidence.exited.checkmarks.find(x=>x.mode==='window').checkmark);assert(evidence.exited.events.some(x=>!x.fullscreen));
  await nativeClick(session,'[data-settings-close]');await closedSettings();evidence.strictSettingsOpener=true;
  await nativeClick(session,'[data-home-close]');await waitUntil(session,`!document.querySelector('#home-inventory[open]')&&document.activeElement.matches('[data-room-card-home]')&&document.activeElement.matches(':enabled')`);evidence.strictHomeFocus=true;
  evidence.noSaveSendPurchaseRoom=true;evidence.status='PASS';console.log('PASS settings display mode '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);store?.close();await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
