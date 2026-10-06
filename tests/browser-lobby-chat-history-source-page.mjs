import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3436',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-lobby-chat-history-source-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-lobby-chat-history-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[],clients=[];

const evidence={status:'RUNNING',ports:{server:3436,vite:5464,cdp:9667},runId,scope:'UI01 original lobby history viewport and scrollbar with two normal authenticated accounts and real public messages; source complete three pages/wheel/arrows/drag/keyboard/autobottom; no room/BUY/relationship writes.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3436',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5464,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3436',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9667',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9667/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9667');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(r.service.name==='Account'&&r.ret?.isSucc)network.push({index:network.length,page:m.sessionId,direction:'received',name:'AccountIdentity',accountId:r.ret.res.accountId});if(['ListMaps','LobbyPlayers','LobbyChat','LobbyWhisper','FriendChat','Friends','CreateRoom','Join','Ready','Shop','TankShop','SelectRole'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});




  const client=new WsClient(serviceProto,{server:'ws://127.0.0.1:3436',logger:undefined});clients.push(client);assert((await client.connect()).isSucc);
  const sender=await client.callApi('Account',{});assert(sender.isSucc);evidence.senderAccountId=sender.res.accountId;
  assert((await client.callApi('DisplayName',{name:'历史玩家'})).isSucc);
  const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
  const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
  const {sessionId:s}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId:s});
  await command('Network.enable',{},s);await command('Page.enable',{},s);await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);await command('Page.navigate',{url:'http://127.0.0.1:5464'},s);
  const log='[data-lobby-chat-log]',bar='[data-lobby-history-scrollbar]',thumb='[data-lobby-history-scroll-thumb]',up='[data-lobby-history-scroll-arrow="up"]',down='[data-lobby-history-scroll-arrow="down"]';
  await waitUntil(s,`document.querySelectorAll('[data-lobby-player-account]').length===2&&document.querySelector('[data-lobby-chat-input]')`);
  async function key(key,code,vk,text){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,...(text?{text}: {})},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk},s);}
  async function resize(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('[data-lobby-stage]').getBoundingClientRect().width-800*Math.min(${width}/800,${height}/600))<.2`);}
  const metrics=()=>evaluate(s,`(()=>{const l=document.querySelector('${log}'),t=document.querySelector('${thumb}');return {scroll:l.scrollTop,page:l.clientHeight,document:l.scrollHeight,capture:t.hasPointerCapture(1),state:t.dataset.thumbState,focus:document.activeElement===t}})()`);
  const point=selector=>evaluate(s,`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),clip=e.closest('${bar}')?.getBoundingClientRect()??r,x=(Math.max(r.left,clip.left)+Math.min(r.right,clip.right))/2,y=(Math.max(r.top,clip.top)+Math.min(r.bottom,clip.bottom))/2;if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Control covered '+e.outerHTML);return {x,y}})()`);
  await nativeClick(s,'[data-lobby-chat-input]');await command('Input.insertText',{text:'普通网页历史首条'},s);await key('Enter','Enter',13,'\r');
  await waitUntil(s,`document.querySelector('${log}').textContent.includes('普通网页历史首条')&&!document.querySelector('[data-lobby-chat-input]').value`);
  evidence.messages=[];
  for(let i=0;i<18;i++){const text=`真实历史${String(i+1).padStart(2,'0')} 中文消息`;const ret=await client.callApi('LobbyChat',{text});assert(ret.isSucc);evidence.messages.push({text,result:ret.res});}
  await waitUntil(s,`document.querySelectorAll('${log} li').length===19&&!document.querySelector('${bar}').hidden`);
  evidence.resolutions=[];
  for(const [width,height]of [[800,600],[1920,1080],[3840,2160]]){
    await resize(width,height);const data=await evaluate(s,`(async()=>{const root=document.querySelector('[data-lobby-history]'),l=document.querySelector('${log}'),b=document.querySelector('${bar}'),box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,inside:r.left>=-.2&&r.top>=-.2&&r.right<=innerWidth+.2&&r.bottom<=innerHeight+.2}};
      const images=[b,...b.querySelectorAll('[data-source-asset]')].filter(e=>e.dataset.sourceAsset);await Promise.all(images.map(e=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=reject;img.src='/'+e.dataset.sourceAsset;})));
      return {width:innerWidth,height:innerHeight,root:box(root),log:box(l),bar:box(b),control:root.dataset.sourceControl,layout:root.dataset.sourceLayout,rows:[...l.querySelectorAll('li')].map(e=>({accountId:e.dataset.accountId,channel:e.dataset.lobbyMessageChannel,text:e.textContent})),images:images.map(e=>e.dataset.sourceAsset),scroll:l.scrollTop,page:l.clientHeight,document:l.scrollHeight};})()`);
    evidence.resolutions.push(data);const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));
    assert(data.root.inside&&data.log.inside&&data.bar.inside);assert.equal(data.control,'ChatTextBox');assert.equal(data.rows.length,19);assert.equal(data.page,114);assert(data.document>data.page);assert(Math.abs(data.bar.width-28.7*Math.min(width/800,height/600))<.2);
    for(const message of evidence.messages)assert(data.rows.some(row=>row.accountId===evidence.senderAccountId&&row.text.includes(message.text)));
  }
  await resize(1920,1080);await evaluate(s,`window.historyEscapedKeys=[];window.addEventListener('keydown',e=>window.historyEscapedKeys.push('down:'+e.code));window.addEventListener('keyup',e=>window.historyEscapedKeys.push('up:'+e.code))`);
  const wp=await point(log);await command('Input.dispatchMouseEvent',{type:'mouseWheel',...wp,deltaX:0,deltaY:-90},s);await waitUntil(s,`document.querySelector('${log}').scrollTop<document.querySelector('${log}').scrollHeight-document.querySelector('${log}').clientHeight`);evidence.wheel=await metrics();
  const p=await point(up),arrowState=()=>evaluate(s,`(()=>{const e=document.querySelector('${up}');return {state:e.dataset.arrowState,capture:e.hasPointerCapture(1),scroll:document.querySelector('${log}').scrollTop}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'none',buttons:0,...p},s);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,modifiers:16,clickCount:1,...p},s);evidence.arrowPressed=await arrowState();assert(evidence.arrowPressed.capture&&evidence.arrowPressed.state==='Pushed');
  const outside={x:p.x+95,y:p.y-20};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,...outside},s);evidence.arrowOutside=await arrowState();assert(evidence.arrowOutside.capture);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,modifiers:0,clickCount:1,...outside},s);evidence.arrowRelease=await arrowState();assert(!evidence.arrowRelease.capture&&evidence.arrowRelease.state==='Normal');assert.equal(evidence.arrowRelease.scroll,evidence.arrowPressed.scroll);
  await nativeClick(s,up);evidence.arrowClick=await metrics();assert(Math.abs(evidence.arrowClick.scroll-Math.max(0,evidence.arrowRelease.scroll-16))<1.1);
  const t=await point(thumb);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,modifiers:16,clickCount:1,...t},s);evidence.thumbPressed=await metrics();assert(evidence.thumbPressed.capture);
  const moved={x:t.x+45,y:t.y-8};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,...moved},s);evidence.thumbMoved=await metrics();assert(evidence.thumbMoved.capture&&evidence.thumbMoved.scroll<evidence.thumbPressed.scroll);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,modifiers:0,clickCount:1,...moved},s);evidence.thumbRelease=await metrics();assert(!evidence.thumbRelease.capture&&evidence.thumbRelease.state==='Normal');
  await key('Home','Home',36);evidence.home=await metrics();assert.equal(evidence.home.scroll,0);await key('End','End',35);evidence.end=await metrics();assert.equal(evidence.end.scroll,evidence.end.document-evidence.end.page);await key('Home','Home',36);
  const last=await client.callApi('LobbyChat',{text:'历史新消息自动到末尾'});assert(last.isSucc);await waitUntil(s,`document.querySelectorAll('${log} li').length===20&&Math.abs(document.querySelector('${log}').scrollTop-(document.querySelector('${log}').scrollHeight-document.querySelector('${log}').clientHeight))<1`);evidence.autoBottom=await metrics();
  evidence.windowKeys=await evaluate(s,'window.historyEscapedKeys');assert.deepEqual(evidence.windowKeys,[]);
  assert(!network.some(n=>n.direction==='sent'&&['LobbyWhisper','FriendChat','CreateRoom','Join','Ready','Shop','TankShop','SelectRole'].includes(n.name)));evidence.noRoomPurchaseRelationship=true;evidence.status='PASS';console.log('PASS lobby chat history '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');for(const client of clients)await client.disconnect();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
