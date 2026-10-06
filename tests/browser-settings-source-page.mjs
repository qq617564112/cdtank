import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3376',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-settings-source-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-settings-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];


const keyboardOnly=process.argv.includes('--navigation-only');
const evidence={status:'RUNNING',ports:{server:3376,vite:5426,cdp:9626},runId,scope:'UI50 formal Settings original major whole page and normal draft/save/default/cancel/focus scope; cycle/graphics/full107/1:1 incomplete.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3376',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'30'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5426,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3376',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9626',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9626/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9626');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Equipment','Inventory','TankShop','TankTextures','OwnedRoles','RoleProfile','Shop','Account'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5426',browserContextId});
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
  if(keyboardOnly){
    evidence.scope='UI50 post Escape interception keyboard-only: primary/secondary capture/conflict/cancel, source Close focus and retained advanced15 entry; no screenshots/save/audio repeat';
    await nativeClick(session,'[data-room-card-home]');await waitUntil(session,`document.querySelector('#home-inventory[open] #open-quick-chat-settings')?.matches(':enabled')`);await openSettings();
    await evaluate(session,`window.__settingsEscapedKeys=[];window.addEventListener('keydown',e=>window.__settingsEscapedKeys.push({code:e.code,target:e.target?.tagName,sourceOpen:!!document.querySelector('#source-settings[open]')}))`);
    const forward='[data-settings-key="forward"][data-settings-secondary="false"]',backup='[data-settings-key="fire"][data-settings-secondary="true"]';
    await nativeClick(session,forward);await press('q','KeyQ',81);assert.equal(await evaluate(session,`document.querySelector('${forward}').textContent`),'Q');
    await nativeClick(session,backup);await press('q','KeyQ',81);await waitUntil(session,`document.querySelector('[data-settings-status]').textContent.includes('已用于')`);await press('Escape','Escape',27);assert.equal(await evaluate(session,`document.querySelector('${backup}').textContent`),'');assert.equal(await evaluate(session,`!!document.querySelector('#source-settings[open]')`),true);
    await nativeClick(session,backup);await press('e','KeyE',69);assert.equal(await evaluate(session,`document.querySelector('${backup}').textContent`),'E');await press('Escape','Escape',27);await closedSettings();
    assert.deepEqual(await evaluate(session,`window.__settingsEscapedKeys`),[]);evidence.keyboard={primaryDraftQ:true,secondaryConflictRejected:true,captureEscapeKeptDialog:true,secondaryDraftE:true,normalEscapeClosed:true,windowKeydownEscapes:0};
    await openSettings();assert.equal(await evaluate(session,`document.querySelector('${forward}').textContent`),'W');assert.equal(await evaluate(session,`document.querySelector('${backup}').textContent`),'');await nativeClick(session,'[data-settings-close]');await closedSettings();evidence.cancelledDrafts={primary:true,secondary:true,sourceCloseFocus:true};
    await nativeClick(session,'#home-inventory[open] #open-key-settings');await waitUntil(session,`document.querySelector('#key-settings[open]')`);assert.equal(await evaluate(session,`document.querySelectorAll('#key-settings [data-key-action]').length`),15);evidence.advancedKeyEntry={retained:true,actions:15};await press('Escape','Escape',27);await waitUntil(session,`!document.querySelector('#key-settings[open]')`);
    await nativeClick(session,'[data-home-close]');await waitUntil(session,`!document.querySelector('#home-inventory[open]')`);assert.equal(await evaluate(session,`document.activeElement.hasAttribute('data-room-card-home')`),true);evidence.formalHomeFocus=true;
  }else{
  await nativeClick(session,'[data-room-card-home]');await waitUntil(session,`document.querySelector('#home-inventory[open] #open-quick-chat-settings')?.matches(':enabled')`);
  await openSettings();await evaluate(session,`window.__settingsEscapedKeys=[];window.addEventListener('keydown',e=>window.__settingsEscapedKeys.push(e.code))`);
  const forward='[data-settings-key="forward"][data-settings-secondary="false"]';
  await nativeClick(session,forward);await press('q','KeyQ',81);assert.equal(await evaluate(session,`document.querySelector('${forward}').textContent`),'Q');await input('[data-settings-quick-chat="F5"]','未保存草稿');await nativeClick(session,'[data-settings-cancel]');await closedSettings();
  await openSettings();assert.equal(await evaluate(session,`document.querySelector('${forward}').textContent`),'W');assert.equal(await evaluate(session,`document.querySelector('[data-settings-quick-chat="F5"]').value`),'');evidence.cancel={keyUnchanged:true,chatUnchanged:true,focusReturned:true};
  await nativeClick(session,forward);await press('s','KeyS',83);await waitUntil(session,`document.querySelector('[data-settings-status]').textContent.includes('已用于')`);assert.equal(await evaluate(session,`document.querySelector('${forward}').getAttribute('aria-pressed')`),'true');await press('Escape','Escape',27);assert.equal(await evaluate(session,`document.querySelector('${forward}').textContent`),'W');evidence.conflict={rejected:true,captureEscapeKeptDialog:true};
  for(const key of ['F5','F6','F7','F8','F9','F10','F11','F12'])await input(`[data-settings-quick-chat="${key}"]`,key==='F5'?'中文快捷内容':`中文${key}内容`);await nativeClick(session,forward);await press('q','KeyQ',81);
  const audio=await evaluate(session,`JSON.parse(localStorage.getItem('cdtank.audio-settings.v1')??'null')`);await nativeClick(session,'[data-settings-volume="music"]');await press('ArrowLeft','ArrowLeft',37);await waitUntil(session,`localStorage.getItem('cdtank.audio-settings.v1')!==null`);evidence.audio={previous:audio,stored:await evaluate(session,`JSON.parse(localStorage.getItem('cdtank.audio-settings.v1'))`),value:await evaluate(session,`document.querySelector('[data-settings-volume="music"]').value`)};assert.equal(evidence.audio.stored.music,Number(evidence.audio.value));
  evidence.sizes=[];
  for(const[width,height]of[[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);await waitUntil(session,`Math.abs(Number(getComputedStyle(document.querySelector('#source-settings')).zoom)-${Math.min(width/800,height/600)})<0.01`);await evaluate(session,`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
    const state=await evaluate(session,`(()=>{const stage=document.querySelector('[data-settings-source-page]'),r=stage.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,staticPictures:stage.querySelectorAll('.settings-source-picture').length,quickChats:stage.querySelectorAll('[data-settings-quick-chat]').length,basicKeyFields:stage.querySelectorAll('[data-settings-key]').length,volumes:stage.querySelectorAll('[data-settings-volume]').length,disabledOptions:stage.querySelectorAll('.settings-source-button:disabled').length,chat:document.querySelector('[data-settings-quick-chat="F5"]').value}})()`);assert.equal(state.chat,'中文快捷内容');assert.equal(state.quickChats,8);assert.equal(state.basicKeyFields,10);assert.equal(state.volumes,2);assert.equal(state.disabledOptions,10);assert(state.x>=-1&&state.y>=-1&&state.x+state.width<=width+1&&state.y+state.height<=height+1);evidence.sizes.push({viewport:{width,height},...state});await screenshot('settings-'+width);
  }
  await nativeClick(session,'[data-settings-confirm]');await closedSettings();const saved=await evaluate(session,`({keys:JSON.parse(localStorage.getItem('cdtank.key-bindings.v1')),chats:JSON.parse(localStorage.getItem('cdtank.quick-chat-settings.v1'))})`);assert.equal(saved.keys.forward,'KeyQ');assert.equal(saved.chats.F5,'中文快捷内容');for(const key of ['F6','F7','F8','F9','F10','F11','F12'])assert.equal(saved.chats[key],`中文${key}内容`);evidence.saved=saved;
  await openSettings();assert.equal(await evaluate(session,`document.querySelector('${forward}').textContent`),'Q');assert.equal(await evaluate(session,`document.querySelector('[data-settings-quick-chat="F5"]').value`),'中文快捷内容');await nativeClick(session,'[data-settings-default]');assert.equal(await evaluate(session,`document.querySelector('${forward}').textContent`),'W');assert.equal(await evaluate(session,`document.querySelector('[data-settings-quick-chat="F5"]').value`),'');await nativeClick(session,'[data-settings-cancel]');await closedSettings();
  await openSettings();assert.equal(await evaluate(session,`document.querySelector('${forward}').textContent`),'Q');assert.equal(await evaluate(session,`document.querySelector('[data-settings-quick-chat="F5"]').value`),'中文快捷内容');await press('Escape','Escape',27);await closedSettings();evidence.defaults={draftOnly:true,cancelPreservedSaved:true};assert.deepEqual(await evaluate(session,`window.__settingsEscapedKeys`),[]);evidence.keyboard={windowKeydownEscapes:0};
  await nativeClick(session,'#home-inventory[open] #open-key-settings');await waitUntil(session,`document.querySelector('#key-settings[open]')`);assert.equal(await evaluate(session,`document.querySelectorAll('#key-settings [data-key-action]').length`),15);evidence.advancedKeyEntry={retained:true,actions:15};await press('Escape','Escape',27);await waitUntil(session,`!document.querySelector('#key-settings[open]')`);
  await nativeClick(session,'[data-home-close]');await waitUntil(session,`!document.querySelector('#home-inventory[open]')`);assert.equal(await evaluate(session,`document.activeElement.hasAttribute('data-room-card-home')`),true);evidence.formalHomeFocus=true;  }
  evidence.status='PASS';console.log('PASS: '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)for(const[i,p]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},p.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
