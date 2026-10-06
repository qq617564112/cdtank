import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3416',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-lobby-channel-shared-consumers-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-channel-shared-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3416,vite:5446,cdp:9646},runId,scope:process.argv.includes('--keyboard-only')?'UI03 keyboard-only nativeTab/Enter(corrected char contract) selection/inputfocus/Chinese draft; no new images or prior capture replay.':'UI03 original six-control lobby channel menu frame/buttons, three resolutions and normal selection/capture/Escape/Chinese draft, no old delivery/room/relationship transactions.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3416',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5446,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3416',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9646',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9646/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9646');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['ListMaps','LobbyChat','LobbyWhisper','FriendChat','Friends','CreateRoom','Join','Ready','Shop','TankShop','SelectRole'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});



  const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
  const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5446',browserContextId});
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);const s=sessionId;
  await waitUntil(s,`document.querySelector('[data-room-card-home]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);
  const menu='[data-lobby-channel-menu]',toggle='[data-lobby-channel-toggle]',input='[data-lobby-chat-input]';
  async function open(){await nativeClick(s,toggle);await waitUntil(s,`document.querySelector('${menu}')&&document.activeElement.matches('[data-lobby-channel][aria-checked="true"]')`);}
  async function resize(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('[data-lobby-stage]').getBoundingClientRect().width-800*Math.min(${width}/800,${height}/600))<.2`);}
  await open();evidence.resolutions=[];
  if(!process.argv.includes('--keyboard-only')){
  for(const [width,height]of [[800,600],[1920,1080],[3840,2160]]){
    await resize(width,height);
    const result=await evaluate(s,`(async()=>{const ui=await(await fetch('/ui.json')).json(),layout=ui.layouts.find(l=>l.path.endsWith('/chat_channellist_lobby.xml')),d=document.querySelector('${menu}'),r=d.getBoundingClientRect();
      const asset=reference=>{const m=/^set:(\\S+) image:(.+)$/.exec(reference),sets=ui.imagesets.filter(s=>s.attributes.Name===m[1]),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return set.images.find(i=>i.Name===m[2]).asset;};
      const layers=[...d.querySelectorAll('[data-source-frame],[data-source-image]')].map(e=>{const c=layout.windows.find(c=>c.name===e.parentElement.dataset.sourceControl),key=e.dataset.sourceFrame??'Image';return {control:c.name,property:key,asset:e.dataset.sourceAsset,expected:asset(c.properties[key])};});
      await Promise.all(layers.map(l=>new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=reject;image.src='/'+l.asset;})));
      const box=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,inside:b.left>=-.2&&b.top>=-.2&&b.right<=innerWidth+.2&&b.bottom<=innerHeight+.2}};
      return {width:innerWidth,height:innerHeight,scale:r.width/48,menu:box(d),layers,frameCount:d.querySelectorAll('[data-source-frame]').length,controls:[...d.querySelectorAll('[data-source-control]')].map(e=>({name:e.dataset.sourceControl,box:box(e)})),radios:[...d.querySelectorAll('button')].map(e=>({name:e.dataset.sourceControl,disabled:e.disabled,state:e.dataset.sourceButtonState,selected:e.getAttribute('aria-checked'),layers:[...e.querySelectorAll('[data-room-button-image]')].map(i=>({property:i.dataset.roomButtonImage,asset:i.dataset.sourceAsset}))})),focus:document.activeElement.dataset.sourceControl};})()`);
    assert(result.menu.inside);assert.equal(result.frameCount,8);assert.equal(result.controls.length,6);assert(result.controls.every(c=>c.box.inside));assert(result.layers.every(l=>l.asset===l.expected));assert.equal(result.radios.find(r=>r.name==='rdoGM').state,'Disabled');assert.equal(result.radios.find(r=>r.name==='rdoGM').layers.length,0);assert.equal(result.focus,'rdoPublic');
    const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));evidence.resolutions.push(result);
  }
  await resize(1920,1080);
  const radio='[data-lobby-channel="whisper"]';
  const point=await evaluate(s,`(()=>{const r=document.querySelector('${radio}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const state=()=>evaluate(s,`(()=>{const e=document.querySelector('${radio}');return {hasCapture:e.hasPointerCapture(1),state:e.dataset.sourceButtonState,pushed:e.dataset.sourcePushed,layers:[...e.querySelectorAll('[data-room-button-image]')].map(i=>({property:i.dataset.roomButtonImage,asset:i.dataset.sourceAsset}))}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},s);await waitUntil(s,`document.querySelector('${radio}').dataset.sourceButtonState==='Hover'`);evidence.hover=await state();
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...point},s);await waitUntil(s,`document.querySelector('${radio}').dataset.sourceButtonState==='Pushed'`);evidence.pressed=await state();
  const outside={x:point.x+120,y:point.y};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,...outside},s);evidence.capturedOutside=await state();assert(evidence.capturedOutside.hasCapture);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...outside},s);await waitUntil(s,`document.querySelector('${radio}').dataset.sourcePushed==='false'`);evidence.releasedOutside=await state();assert(!evidence.releasedOutside.hasCapture);assert(await evaluate(s,`!!document.querySelector('${menu}')&&document.querySelector('${menu} [aria-checked="true"]').dataset.lobbyChannel==='public'`));
  await evaluate(s,`window.channelEscapedKeys=[];window.addEventListener('keydown',e=>window.channelEscapedKeys.push(e.code))`);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);await waitUntil(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${toggle}')`);evidence.escape={keys:await evaluate(s,'window.channelEscapedKeys'),strictToggleFocus:true};assert.deepEqual(evidence.escape.keys,[]);
  await nativeClick(s,input);await command('Input.insertText',{text:'频道中文草稿'},s);evidence.chineseDraft=await evaluate(s,`document.querySelector('${input}').value`);assert.equal(evidence.chineseDraft,'频道中文草稿');
  evidence.selections=[];
  for(const channel of ['whisper','friend','public']){
    await open();await nativeClick(s,`[data-lobby-channel="${channel}"]`);await waitUntil(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${input}')`);
    const result=await evaluate(s,`({channel:document.querySelector('${toggle}').dataset.sourceControl,draft:document.querySelector('${input}').value,inputFocus:document.activeElement.matches('${input}'),whisper:!!document.querySelector('[data-lobby-whisper-target]')})`);assert.equal(result.draft,evidence.chineseDraft);assert.equal(result.whisper,channel==='whisper');evidence.selections.push(result);
  }
  await nativeClick(s,input);await evaluate(s,`document.querySelector('${input}').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'中'}))`);await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',windowsVirtualKeyCode:13},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},s);await evaluate(s,`document.querySelector('${input}').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中'}))`);evidence.composition={scope:'synthetic composition state with nativeEnter; no OS candidate claim',draft:await evaluate(s,`document.querySelector('${input}').value`)};assert.equal(evidence.composition.draft,evidence.chineseDraft);
    await open();
  }else{
    await nativeClick(s,input);await command('Input.insertText',{text:'键盘频道草稿'},s);await open();
  }
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},s);assert(await evaluate(s,`document.activeElement.matches('[data-lobby-channel="whisper"]')`));await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',windowsVirtualKeyCode:13},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},s);await waitUntil(s,`!document.querySelector('${menu}')&&document.activeElement.matches('${input}')`);evidence.keyboardSelect=true;
  evidence.keyboardFinal=await evaluate(s,`({channel:document.querySelector('${toggle}').dataset.sourceControl,draft:document.querySelector('${input}').value,inputFocus:document.activeElement.matches('${input}')})`);assert.equal(evidence.keyboardFinal.channel,'btnPrivateChannel');
  assert(!network.some(n=>n.direction==='sent'&&['LobbyChat','LobbyWhisper','FriendChat','CreateRoom','Join','Ready','Shop','TankShop','SelectRole'].includes(n.name)));evidence.noSendRoomPurchaseBattle=true;evidence.status='PASS';console.log('PASS original lobby channel menu consumers '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
