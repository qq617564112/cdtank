import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3432',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-lobby-player-list-scroll-source-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-lobby-player-list-scroll-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[],clients=[];

const keyboardOnly=process.argv.includes('--keyboard-only');
const evidence={status:'RUNNING',ports:{server:3432,vite:5463,cdp:9666},runId,scope:'UI41 source scrollbar around actual overflowing LobbyPlayers; one ordinary browser and 35 Account-authenticated clients; no send/room/BUY/friend write.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3432',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5463,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3432',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9666',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9666/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9666');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(r.service.name==='Account'&&r.ret?.isSucc)network.push({index:network.length,page:m.sessionId,direction:'received',name:'AccountIdentity',accountId:r.ret.res.accountId});if(['ListMaps','LobbyPlayers','LobbyChat','LobbyWhisper','FriendChat','Friends','CreateRoom','Join','Ready','Shop','TankShop','SelectRole'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});




  for(let i=0;i<(keyboardOnly?2:35);i++){
    const client=new WsClient(serviceProto,{server:'ws://127.0.0.1:3432',logger:undefined});clients.push(client);
    assert((await client.connect()).isSucc);const account=await client.callApi('Account',{});assert(account.isSucc);
    const name=await client.callApi('DisplayName',{name:`名单玩家${String(i+1).padStart(2,'0')}`});assert(name.isSucc);
    (evidence.accounts??=[]).push({accountId:account.res.accountId,name:name.res.name});
  }
  const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
  const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
  const {sessionId:s}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId:s});
  await command('Network.enable',{},s);await command('Page.enable',{},s);
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);
  await command('Page.navigate',{url:'http://127.0.0.1:5463'},s);
  const list='[data-lobby-player-list]',bar='[data-player-list-scrollbar]',thumb='[data-player-list-scroll-thumb]',down='[data-player-list-scroll-arrow="down"]';
  await waitUntil(s,`document.querySelectorAll('[data-lobby-player-account]').length===${keyboardOnly?3:36}&&document.querySelector('${list}').dataset.sourceFontReady==='true'&&${keyboardOnly?'true':`!document.querySelector('${bar}').hidden`}`);
  async function key(key,code,vk){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk},s);}
  async function resize(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('[data-lobby-stage]').getBoundingClientRect().width-800*Math.min(${width}/800,${height}/600))<.2`);}
  const metrics=()=>evaluate(s,`(()=>{const l=document.querySelector('${list}'),t=document.querySelector('${thumb}'),b=document.querySelector('${bar}');return {scroll:l.scrollTop,height:l.clientHeight,document:l.scrollHeight,thumbState:t.dataset.thumbState,thumbCapture:t.hasPointerCapture(1),thumbHeight:t.getBoundingClientRect().height,barWidth:b.getBoundingClientRect().width}})()`);
  const point=selector=>evaluate(s,`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),clip=e.closest('${bar}')?.getBoundingClientRect()??r,x=(Math.max(r.left,clip.left)+Math.min(r.right,clip.right))/2,y=(Math.max(r.top,clip.top)+Math.min(r.bottom,clip.bottom))/2;if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Clipped control covered');return {x,y}})()`);
  if(keyboardOnly){
    evidence.scope='UI41 handled row keyboard isolation and existing profile/target focus; three ordinary Account clients, no new pictures/scroll/capture/send/room/BUY/relationship writes.';
    evidence.resolutions=[];
    await evaluate(s,`window.rowEscapedKeys=[];window.addEventListener('keydown',e=>window.rowEscapedKeys.push('down:'+e.code));window.addEventListener('keyup',e=>window.rowEscapedKeys.push('up:'+e.code))`);
    await nativeClick(s,'[data-lobby-player-index="0"]');
    const selectedIndex=()=>evaluate(s,`Number(document.activeElement.dataset.lobbyPlayerIndex)`);
    await key('ArrowDown','ArrowDown',40);assert.equal(await selectedIndex(),1);
    await key('ArrowUp','ArrowUp',38);assert.equal(await selectedIndex(),0);
    await key('End','End',35);assert.equal(await selectedIndex(),2);
    await key('Home','Home',36);assert.equal(await selectedIndex(),0);
    evidence.navigation={ArrowDown:1,ArrowUp:0,End:2,Home:0};
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'F10',code:'F10',windowsVirtualKeyCode:121,modifiers:8},s);
    await command('Input.dispatchKeyEvent',{type:'keyUp',key:'F10',code:'F10',windowsVirtualKeyCode:121,modifiers:8},s);
    const original=await evaluate(s,`document.querySelector('[data-lobby-player-index="0"]').dataset.lobbyPlayerAccount`);
    await waitUntil(s,`document.querySelector('[data-player-info]')?.open&&document.activeElement.matches('[data-player-info-close]')`);
    await key('Escape','Escape',27);await waitUntil(s,`!document.querySelector('[data-player-info]')&&document.activeElement.dataset.lobbyPlayerAccount===${JSON.stringify(original)}`);
    evidence.profileReturn={accountId:original,strictRowFocus:true};
    await nativeClick(s,'[data-lobby-chat-input]');await command('Input.insertText',{text:'键盘选择草稿'},s);
    await nativeClick(s,'[data-lobby-player-index="1"]');const target=await evaluate(s,`({accountId:document.activeElement.dataset.lobbyPlayerAccount,name:document.activeElement.textContent})`);
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},s);
    await waitUntil(s,`document.activeElement.matches('[data-lobby-chat-input]')&&document.querySelector('[data-lobby-whisper-target]').dataset.targetAccount===${JSON.stringify(target.accountId)}`);
    evidence.targetChoice=await evaluate(s,`({accountId:document.querySelector('[data-lobby-whisper-target]').dataset.targetAccount,name:document.querySelector('[data-lobby-whisper-target]').value,draft:document.querySelector('[data-lobby-chat-input]').value,inputFocus:document.activeElement.matches('[data-lobby-chat-input]')})`);
    assert.equal(evidence.targetChoice.name,target.name);assert.equal(evidence.targetChoice.draft,'键盘选择草稿');
    evidence.windowKeys=await evaluate(s,'window.rowEscapedKeys');assert.deepEqual(evidence.windowKeys,[]);
    assert(!network.some(n=>n.direction==='sent'&&['LobbyChat','LobbyWhisper','FriendChat','CreateRoom','Join','Ready','Shop','TankShop','SelectRole'].includes(n.name)));
    evidence.noSendRoomPurchaseBattle=true;evidence.status='PASS';console.log('PASS player row keyboard-only '+output);
  }else{
  evidence.resolutions=[];
  for(const [width,height]of [[800,600],[1920,1080],[3840,2160]]){
    await resize(width,height);await waitUntil(s,`Math.abs(document.querySelector('${bar}').getBoundingClientRect().width-8.5*Math.min(${width}/800,${height}/600))<.2`);
    const data=await evaluate(s,`(async()=>{const root=document.querySelector('${bar}'),l=document.querySelector('${list}'),box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth+.2&&r.bottom<=innerHeight+.2}};
      const images=[...root.querySelectorAll('[data-source-asset]'),root].filter(e=>e.dataset.sourceAsset);await Promise.all(images.map(e=>new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=reject;image.src='/'+e.dataset.sourceAsset;})));
      return {width:innerWidth,height:innerHeight,list:box(l),bar:box(root),scroll:l.scrollTop,document:l.scrollHeight,page:l.clientHeight,rows:[...l.querySelectorAll('[data-lobby-player-account]')].map(e=>({accountId:e.dataset.lobbyPlayerAccount,name:e.textContent})),images:images.map(e=>e.dataset.sourceAsset),binding:root.dataset.scrollGeometryBinding};})()`);
    evidence.resolutions.push(data);const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));
    assert(data.list.inside&&data.bar.inside&&data.document>data.page);assert.equal(data.rows.length,36);assert.equal(data.binding,'web-list-dimensions');
  }
  const confirmed=network.filter(n=>n.name==='LobbyPlayers'&&n.success).at(-1)?.response.players;assert.equal(confirmed?.length,36);evidence.confirmedDirectory=confirmed;
  for(const row of evidence.resolutions[0].rows)assert(confirmed.some(p=>p.accountId===row.accountId&&p.name===row.name));
  await resize(1920,1080);await evaluate(s,`window.playerListEscapedKeys=[];window.addEventListener('keydown',e=>window.playerListEscapedKeys.push(e.code))`);
  const wheelPoint=await point(list);await command('Input.dispatchMouseEvent',{type:'mouseWheel',...wheelPoint,deltaX:0,deltaY:70},s);await waitUntil(s,`document.querySelector('${list}').scrollTop>0`);evidence.wheel=await metrics();
  const p=await point(down),arrowState=()=>evaluate(s,`(()=>{const e=document.querySelector('${down}');return {state:e.dataset.arrowState,capture:e.hasPointerCapture(1),scroll:document.querySelector('${list}').scrollTop}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'none',buttons:0,...p},s);
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,modifiers:16,clickCount:1,...p},s);evidence.arrowPressed=await arrowState();assert(evidence.arrowPressed.capture);assert.equal(evidence.arrowPressed.state,'Pushed');
  const outside={x:p.x-90,y:p.y-50};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,...outside},s);evidence.arrowOutside=await arrowState();assert(evidence.arrowOutside.capture);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,modifiers:0,clickCount:1,...outside},s);evidence.arrowReleased=await arrowState();assert(!evidence.arrowReleased.capture);assert.equal(evidence.arrowReleased.state,'Normal');assert.equal(evidence.arrowReleased.scroll,evidence.arrowPressed.scroll);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'none',buttons:0,...p},s);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...p},s);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...p},s);
  evidence.arrowClick=await metrics();assert(Math.abs(evidence.arrowClick.scroll-Math.min(evidence.arrowReleased.scroll+14,evidence.arrowClick.document-evidence.arrowClick.height))<1.1);
  const t=await point(thumb);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,modifiers:16,clickCount:1,...t},s);evidence.thumbPressed=await metrics();assert(evidence.thumbPressed.thumbCapture);
  const moved={x:t.x-35,y:t.y-70};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,...moved},s);evidence.thumbMoved=await metrics();assert(evidence.thumbMoved.thumbCapture&&evidence.thumbMoved.scroll<evidence.thumbPressed.scroll);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,modifiers:0,clickCount:1,...moved},s);evidence.thumbReleased=await metrics();assert(!evidence.thumbReleased.thumbCapture);assert.equal(evidence.thumbReleased.thumbState,'Normal');
  await key('End','End',35);evidence.end=await metrics();assert.equal(evidence.end.scroll,evidence.end.document-evidence.end.height);await key('Home','Home',36);evidence.home=await metrics();assert.equal(evidence.home.scroll,0);
  await nativeClick(s,'[data-lobby-player-index="0"]');const selected=await evaluate(s,`document.activeElement.dataset.lobbyPlayerAccount`);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'F10',code:'F10',windowsVirtualKeyCode:121,modifiers:8},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'F10',code:'F10',windowsVirtualKeyCode:121},s);
  await waitUntil(s,`document.querySelector('[data-player-info]')?.open&&document.activeElement.matches('[data-player-info-close]')`);await key('Escape','Escape',27);
  await waitUntil(s,`!document.querySelector('[data-player-info]')&&document.activeElement.dataset.lobbyPlayerAccount===${JSON.stringify(selected)}`);
  evidence.profileReturn={accountId:selected,strictRowFocus:true,keys:await evaluate(s,'window.playerListEscapedKeys')};
  // Existing row F10 belongs to the existing list handler; scrollbar Home/End and modal Escape are isolated.
  assert.deepEqual(evidence.profileReturn.keys,['F10']);
  assert(!network.some(n=>n.direction==='sent'&&['LobbyChat','LobbyWhisper','FriendChat','CreateRoom','Join','Ready','Shop','TankShop','SelectRole'].includes(n.name)));
  evidence.noSendRoomPurchaseBattle=true;evidence.status='PASS';console.log('PASS player list scrollbar '+output);
  }
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');for(const client of clients)await client.disconnect();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
