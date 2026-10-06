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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3379',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-home-name-source-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-name-'));
const database=join(directory,'accounts.sqlite');
const historyFixture = process.argv.includes('--populated-only') ? JSON.parse(await readFile('recovery/output/account-history-browser-fixture.json','utf8')) : undefined;
if(historyFixture)await copyFile('recovery/output/account-history-browser.sqlite',database);
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const readabilityOnly=process.argv.includes('--readability-only');

const evidence={status:'RUNNING',ports:{server:3379,vite:5429,cdp:9629},runId,scope:'UI36 source nickname normal player entrance, current authoritative DisplayName query/save, Chinese/cancel/real rejection, Home whole page and focus; original input-dialog callback binding unproved.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3379',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5429,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3379',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9629',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9629/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9629');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['DisplayName'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:historyFixture?'about:blank':'http://127.0.0.1:5429',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    if(historyFixture){await command('Page.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(historyFixture.token)+')'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5429'},sessionId);}
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);
    if(historyFixture)assert.equal(await evaluate(sessionId,'localStorage.getItem("cdtank-account-token")==='+JSON.stringify(historyFixture.token)),true,'Existing legal fixture account must actually be reused');

  }
  const s=pages[0].sessionId;
  await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('[data-home-name-open]')?.matches(':enabled')`);
  const confirmed=await evaluate(s,`document.querySelector('[data-source-control="txtPlayerName"]').textContent`);evidence.originalName=confirmed;
  async function openName(){await nativeClick(s,'[data-home-name-open]');await waitUntil(s,`document.querySelector('[data-home-name-dialog]')?.getAttribute('aria-busy')==='false'`);}
  async function inputText(value){await nativeClick(s,'[data-home-name-input]');await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},s);await command('Input.insertText',{text:value},s);assert.equal(await evaluate(s,`document.querySelector('[data-home-name-input]').value`),value);}
  if(process.argv.includes('--keyboard-only')){
    await openName();
    await evaluate(s,`(()=>{window.homeNameLeakedKeys=[];window.addEventListener('keydown',e=>window.homeNameLeakedKeys.push(e.code));document.querySelector('[data-home-name-input]').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'中'}))})()`);
    const before=network.length;
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},s);
    assert(await evaluate(s,`!!document.querySelector('[data-home-name-dialog]')`));assert(!network.slice(before).some(r=>r.direction==='sent'&&r.payload?.name));
    const compositionDraft=await evaluate(s,`document.querySelector('[data-home-name-input]').value`);
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);
    assert(await evaluate(s,`document.querySelector('[data-home-name-dialog]')?.open`),'Native Escape during composition must preserve dialog');
    assert.equal(await evaluate(s,`document.querySelector('[data-home-name-input]').value`),compositionDraft);
    assert(!network.slice(before).some(r=>r.direction==='sent'&&r.payload?.name));
    evidence.compositionEscape={nativeKey:true,dialogPreserved:true,draftPreserved:true,noSave:true};
    await evaluate(s,`document.querySelector('[data-home-name-input]').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中文'}))`);
    await inputText('键盘中文草稿');
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);
    await waitUntil(s,`!document.querySelector('[data-home-name-dialog]')&&document.activeElement.matches('[data-home-name-open]')`);
    evidence.keyboard={syntheticCompositionGate:true,nativeEnterNoSave:true,nativeChineseInput:true,nativeEscapeCancel:true,windowLeakedKeys:await evaluate(s,`window.homeNameLeakedKeys`)};assert.deepEqual(evidence.keyboard.windowLeakedKeys,[]);
    await nativeClick(s,'[data-home-close]');await waitUntil(s,`document.activeElement.matches('[data-room-card-home]')`);
    evidence.status='PASS';console.log('PASS directed composition Enter gate/native Chinese draft/Escape cancel/current source button focus/zero window leaked keys');
  }else{
  await openName();assert.equal(await evaluate(s,`document.querySelector('[data-home-name-input]').value`),confirmed);
  await inputText('中文取消候选');const beforeCancel=network.length;await nativeClick(s,'[data-home-name-cancel]');await waitUntil(s,`!document.querySelector('[data-home-name-dialog]')&&document.activeElement.matches('[data-home-name-open]')`);assert(!network.slice(beforeCancel).some(r=>r.direction==='sent'&&r.payload?.name));assert.equal(await evaluate(s,`document.querySelector('[data-source-control="txtPlayerName"]').textContent`),confirmed);evidence.cancelPreserves=true;
  await openName();evidence.sizes=[];
  for(const [width,height]of [[800,600],[1920,1080],[3840,2160]]){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);const box=await evaluate(s,`(()=>{const r=document.querySelector('[data-home-name-stage]').getBoundingClientRect();return {viewport:{width:innerWidth,height:innerHeight},x:r.x,y:r.y,width:r.width,height:r.height}})()`);assert(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);evidence.sizes.push(box);const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));}
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  await inputText('超过十六字符的昵称应当在真实服务器明确拒绝');await nativeClick(s,'[data-home-name-confirm]');await waitUntil(s,`document.querySelector('[data-home-name-dialog]').getAttribute('aria-busy')==='false'&&document.querySelector('[data-home-name-status]').textContent.includes('昵称应为')`);assert.equal(await evaluate(s,`document.querySelector('[data-home-name-input]').value`),'超过十六字符的昵称应当在真实服务器明确拒绝');evidence.rejection={status:await evaluate(s,`document.querySelector('[data-home-name-status]').textContent`),preservedName:await evaluate(s,`document.querySelector('#home-inventory [data-source-control="txtPlayerName"]').textContent`)};assert.equal(evidence.rejection.preservedName,confirmed);
  await inputText('普通中文昵称');await nativeClick(s,'[data-home-name-confirm]');await waitUntil(s,`!document.querySelector('[data-home-name-dialog]')&&document.querySelector('[data-source-control="txtPlayerName"]').textContent==='普通中文昵称'&&document.activeElement.matches('[data-home-name-open]')`);evidence.confirmedChinese=true;
  await openName();assert.equal(await evaluate(s,`document.querySelector('[data-home-name-input]').value`),'普通中文昵称');await nativeClick(s,'[data-home-name-cancel]');await nativeClick(s,'[data-home-close]');await waitUntil(s,`document.activeElement.matches('[data-room-card-home]')`);evidence.finalHomeFocus=true;
  evidence.status='PASS';console.log('PASS source nickname current authoritative Chinese cancel/save/reject/query/focus and three-resolution whole page; original binding unproved');
  }
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
