import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3425',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-lobby-intimate-source-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-lobby-intimate-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3425,vite:5455,cdp:9655},runId,scope:'UI05 original3control lobby intimate menu with actual readonly LobbyPlayers from two ordinary pages; three complete pages/capture/Chinese draft/real account selection/cancel/keyboard/composition/exclusive menus; no send/room/BUY.'};
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
  await command('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',buttons:1,clickCount:1,...point}, session);
  await command('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',buttons:0,clickCount:1,...point}, session);
}
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3425',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5455,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3425',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9655',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9655/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9655');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(r.service.name==='Account'&&r.ret?.isSucc)network.push({index:network.length,page:m.sessionId,direction:'received',name:'AccountIdentity',accountId:r.ret.res.accountId});if(['ListMaps','LobbyPlayers','LobbyChat','LobbyWhisper','FriendChat','Friends','CreateRoom','Join','Ready','Shop','TankShop','SelectRole'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});




  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);await command('Page.enable',{},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5455'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-home]')?.matches(':enabled')&&document.querySelector('[data-lobby-channel-toggle]')?.matches(':enabled')`);
  }
  const s=pages[0].sessionId;
  await command('Page.bringToFront',{},s);
  await waitUntil(s,`document.querySelectorAll('[data-lobby-player-account]').length===2`);

  const menu='[data-lobby-intimate-menu]',toggle='[data-lobby-intimate-toggle]',input='[data-lobby-chat-input]';
  async function key(key,code,vk,text){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,...(text?{text}: {})},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk},s);}
  async function open(){await nativeClick(s,toggle);await waitUntil(s,`document.querySelector('${menu}')&&document.activeElement.matches('[data-lobby-intimate-account]')`);}
  async function resize(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('[data-lobby-stage]').getBoundingClientRect().width-800*Math.min(${width}/800,${height}/600))<.2`);}
  await nativeClick(s,'[data-lobby-channel-toggle]');await waitUntil(s,`document.querySelector('[data-lobby-channel="whisper"]')`);await nativeClick(s,'[data-lobby-channel="whisper"]');await waitUntil(s,`document.querySelector('${toggle}')`);
  await nativeClick(s,input);await command('Input.insertText',{text:'对象中文草稿'},s);await key('ArrowLeft','ArrowLeft',37);
  const caret=await evaluate(s,`document.querySelector('${input}').selectionStart`);assert.equal(caret,5);
  await open();evidence.resolutions=[];
  for(const [width,height]of [[800,600],[1920,1080],[3840,2160]]){
    await resize(width,height);
    const result=await evaluate(s,`(async()=>{const root=document.querySelector('${menu}'),box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,inside:r.left>=-.2&&r.top>=-.2&&r.right<=innerWidth+.2&&r.bottom<=innerHeight+.2}};
      const images=[...root.querySelectorAll('[data-source-asset]')].filter(e=>e.dataset.sourceAsset);await Promise.all(images.map(e=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=reject;img.src='/'+e.dataset.sourceAsset;})));
      return {width:innerWidth,height:innerHeight,menu:box(root),controls:[...root.querySelectorAll('[data-source-control]')].map(e=>({name:e.dataset.sourceControl,box:box(e)})),frames:root.querySelectorAll('[data-source-frame]').length,images:images.map(e=>({asset:e.dataset.sourceAsset,box:box(e)})),rows:[...root.querySelectorAll('[data-lobby-intimate-account]')].map(e=>({accountId:e.dataset.lobbyIntimateAccount,name:e.textContent,selected:e.getAttribute('aria-selected'),asset:e.dataset.sourceSelectionAsset,box:box(e)})),binding:root.querySelector('[data-directory-binding]').dataset.directoryBinding,toggle:box(document.querySelector('${toggle}'))};})()`);
    evidence.resolutions.push(result);const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));
    assert.equal(result.controls.length,3);assert.equal(result.frames,8);assert.equal(result.rows.length,2);assert(result.controls.every(v=>v.box.inside));assert(result.rows.every(v=>v.box.inside&&v.name));assert(result.toggle.inside);assert.equal(result.binding,'web-confirmed-lobby-presence');
  }
  const queries=network.filter(n=>n.name==='LobbyPlayers'&&n.success);const confirmed=queries.at(-1)?.response.players;assert(confirmed&&confirmed.length===2,'Real two-account LobbyPlayers response');evidence.confirmedDirectory=confirmed;
  for(const row of evidence.resolutions[0].rows)assert(confirmed.some(p=>p.accountId===row.accountId&&p.name===row.name));
  await resize(1920,1080);
  await evaluate(s,`window.intimateEscapedKeys=[];window.addEventListener('keydown',e=>window.intimateEscapedKeys.push(e.code))`);
  await key('Escape','Escape',27);await waitUntil(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${toggle}')`);evidence.escape={keys:await evaluate(s,'window.intimateEscapedKeys'),strictToggleFocus:true};assert.deepEqual(evidence.escape.keys,[]);
  const point=await evaluate(s,`(()=>{const r=document.querySelector('${toggle}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const buttonState=()=>evaluate(s,`(()=>{const e=document.querySelector('${toggle}');return {state:e.dataset.sourceButtonState,pushed:e.dataset.sourcePushed,hasCapture:e.hasPointerCapture(1),menu:!!document.querySelector('${menu}')}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'none',buttons:0,...point},s);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,modifiers:16,clickCount:1,...point},s);await waitUntil(s,`document.querySelector('${toggle}').dataset.sourceButtonState==='Pushed'`);evidence.pressed=await buttonState();assert(evidence.pressed.hasCapture);
  const outside={x:point.x+180,y:point.y-170};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,...outside},s);evidence.capturedOutside=await buttonState();assert(evidence.capturedOutside.hasCapture);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,modifiers:0,clickCount:1,...outside},s);await waitUntil(s,`document.querySelector('${toggle}').dataset.sourcePushed==='false'`);evidence.released=await buttonState();assert(!evidence.released.hasCapture&&!evidence.released.menu);assert.equal(evidence.released.state,'Normal');
  const guestId=network.find(n=>n.name==='AccountIdentity'&&n.page===pages[1].sessionId)?.accountId;assert(guestId,'Second normal page confirmed identity');
  const guest=confirmed.find(p=>p.accountId===guestId);assert(guest);
  await open();await nativeClick(s,`[data-lobby-intimate-account="${guestId}"]`);await waitUntil(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${input}')&&document.querySelector('[data-lobby-whisper-target]').dataset.targetAccount==='${guestId}'`);
  const read=()=>evaluate(s,`({target:document.querySelector('[data-lobby-whisper-target]').value,accountId:document.querySelector('[data-lobby-whisper-target]').dataset.targetAccount,draft:document.querySelector('${input}').value,caret:document.querySelector('${input}').selectionStart,inputFocus:document.activeElement.matches('${input}')})`);
  evidence.mouseChoice=await read();assert.equal(evidence.mouseChoice.target,guest.name);assert.equal(evidence.mouseChoice.draft,'对象中文草稿');assert.equal(evidence.mouseChoice.caret,caret);
  await open();assert(await evaluate(s,`document.activeElement.dataset.lobbyIntimateAccount==='${guestId}'`));await key('Home','Home',36);await key('End','End',35);await key('Enter','Enter',13,'\r');await waitUntil(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${input}')`);evidence.keyboardChoice=await read();assert.equal(evidence.keyboardChoice.draft,'对象中文草稿');assert.equal(evidence.keyboardChoice.caret,caret);assert(confirmed.some(p=>p.accountId===evidence.keyboardChoice.accountId&&p.name===evidence.keyboardChoice.target));
  const beforeCancel=await read();await open();await key('Home','Home',36);await key('Escape','Escape',27);await waitUntil(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${toggle}')`);evidence.cancel=await read();assert.equal(evidence.cancel.accountId,beforeCancel.accountId);assert.equal(evidence.cancel.draft,beforeCancel.draft);
  await evaluate(s,`document.querySelector('[data-lobby-whisper-target]').focus();document.querySelector('[data-lobby-whisper-target]').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'中'}))`);await nativeClick(s,toggle);assert(await evaluate(s,`!document.querySelector('${menu}')&&document.activeElement.matches('[data-lobby-whisper-target]')`));await evaluate(s,`document.querySelector('[data-lobby-whisper-target]').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中'}))`);
  await open();await evaluate(s,`document.querySelector('[data-lobby-whisper-target]').focus();document.querySelector('[data-lobby-whisper-target]').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'中'}))`);await key('Escape','Escape',27);assert(await evaluate(s,`!!document.querySelector('${menu}')&&document.activeElement.matches('[data-lobby-whisper-target]')`));await evaluate(s,`document.querySelector('[data-lobby-whisper-target]').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中'}))`);await key('Escape','Escape',27);await waitUntil(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${toggle}')`);evidence.composition={scope:'Synthetic nickname composition state with native mouse/Escape, no OS candidate claim',blockedToggle:true,keptNativeEscape:true};
  await open();await nativeClick(s,'[data-lobby-emote-toggle]');await waitUntil(s,`!document.querySelector('${menu}')&&document.querySelector('[data-lobby-emote-menu]')`);await nativeClick(s,toggle);await waitUntil(s,`document.querySelector('${menu}')&&!document.querySelector('[data-lobby-emote-menu]')`);evidence.exclusiveMenus=true;await key('Escape','Escape',27);await waitUntil(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${toggle}')`);
  evidence.final={...await read(),strictToggleFocus:await evaluate(s,`document.activeElement.matches('${toggle}')`),keys:await evaluate(s,'window.intimateEscapedKeys')};assert.deepEqual(evidence.final.keys,[]);
  assert(!network.some(n=>n.direction==='sent'&&['LobbyChat','LobbyWhisper','FriendChat','CreateRoom','Join','Ready','Shop','TankShop','SelectRole'].includes(n.name)));evidence.noSendRoomPurchaseBattle=true;evidence.status='PASS';console.log('PASS lobby intimate source page '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
