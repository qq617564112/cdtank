import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3433',logger:undefined});
const network=[],httpResponses=[],upgrades=[];
const output='recovery/output/browser-release-proxy-'+new Date().toISOString().replace(/[:.]/g,'-');
const directory=await mkdtemp(join(tmpdir(),'cdtank-release-proxy-'));
const release=resolve('dist/release'),nginxRoot=resolve('recovery/output/nginx-runtime');
const evidence={status:'RUNNING',scope:'Real nginx static release and /game WebSocket proxy from two normal Chromium account contexts; Create/Join WAITING/public Chinese/Leave/reload identity. Local machine only.',fixtures:'None',ports:{server:3433,http:8433,cdp:9660}};
let server,nginx,chrome,ws,serverLog='',nginxLog='';
const pages=[],contexts=[];
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

try {
  const env={...process.env,PORT:'3433',ACCOUNT_DB_PATH:join(directory,'accounts.sqlite')};
  for(const key of ['NODE_PATH','NODE_OPTIONS','CONTENT_TABLES','WEB_ASSETS','SCENE_PLACEMENTS','BATTLEFIELDS','MATCH_MIN_PLAYERS','MATCH_TIME_LIMIT_SECONDS'])delete env[key];
  server=spawn(process.execPath,[join(release,'start.mjs')],{cwd:directory,env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>serverLog+=String(d));
  const deadline=Date.now()+15000;while(!serverLog.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(serverLog.includes('Server started'),serverLog);
  const site=(await readFile('deployment/nginx.conf.example','utf8')).replace('listen 8080;','listen 8433;').replace('/srv/cdtank/web',join(release,'web')).replace('127.0.0.1:3001','127.0.0.1:3433');
  const config=`daemon off;\npid ${join(directory,'nginx.pid')};\nerror_log stderr;\nevents {worker_connections 128;}\nhttp {client_body_temp_path ${join(directory,'body')}; proxy_temp_path ${join(directory,'proxy')}; fastcgi_temp_path ${join(directory,'fastcgi')}; uwsgi_temp_path ${join(directory,'uwsgi')}; scgi_temp_path ${join(directory,'scgi')}; include ${join(nginxRoot,'etc/nginx/mime.types')}; access_log ${join(directory,'access.log')}; ${site}}\n`;
  await writeFile(join(directory,'nginx.conf'),config);
  nginx=spawn(join(nginxRoot,'usr/sbin/nginx'),['-p',directory+'/', '-c',join(directory,'nginx.conf')],{stdio:['ignore','pipe','pipe']});
  for(const stream of [nginx.stdout,nginx.stderr])stream.on('data',d=>nginxLog+=String(d));
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:8433/')).status===200)break;}catch{}await new Promise(r=>setTimeout(r,50));}
  const response=await fetch('http://127.0.0.1:8433/');assert.equal(response.status,200);assert(response.headers.get('content-type').includes('text/html'));
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9660',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9660/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint);ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(r.service.name==='Account'&&r.ret?.isSucc)network.push({index:network.length,page:m.sessionId,direction:'received',name:'AccountIdentity',accountId:r.ret.res.accountId});if(['ListMaps','LobbyPlayers','LobbyChat','LobbyWhisper','FriendChat','Friends','CreateRoom','Join','Ready','Shop','TankShop','SelectRole','Leave','RoomChat','RoomSnapshot'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});
  ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.method==='Network.responseReceived'&&m.params.response.url.startsWith('http://127.0.0.1:8433/')){const r=m.params.response;httpResponses.push({url:r.url,status:r.status,mimeType:r.mimeType});}if(m.method==='Network.webSocketHandshakeResponseReceived')upgrades.push({page:m.sessionId,status:m.params.response.status});});
  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Network.enable',{},sessionId);await command('Page.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await command('Page.navigate',{url:'http://127.0.0.1:8433/'},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-home]')?.matches(':enabled')&&document.querySelector('[data-lobby-channel-toggle]')?.matches(':enabled')`);
  }
  const [s,b]=pages.map(p=>p.sessionId);
  const identities=network.filter(n=>n.name==='AccountIdentity');assert.equal(identities.length,2);assert.notEqual(identities[0].accountId,identities[1].accountId);
  assert.equal(upgrades.filter(u=>u.status===101).length,2);
  assert(httpResponses.some(r=>r.url.endsWith('.js')&&r.mimeType.includes('javascript')));
  assert(httpResponses.some(r=>r.url.endsWith('ui.json')&&r.status===200));
  await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},s).then(r=>writeFile(output+'-lobby.png',Buffer.from(r.data,'base64')));
  await nativeClick(s,'[data-room-card-create]');await waitUntil(s,`document.querySelector('[data-map-selector-map="7"]')`);
  await nativeClick(s,'[data-map-selector-map="7"]');await nativeClick(s,'[data-map-selector-confirm]');
  await waitUntil(s,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);await nativeClick(s,'[data-room-create-confirm]');
  await waitUntil(s,`document.querySelector('[data-formal-waiting-page]')&&document.querySelector('.source-waiting-chat')&&!document.querySelector('[data-room-create-dialog]')?.open`);
  const room=await evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);evidence.room=room;
  await waitUntil(b,`document.querySelector('[data-room-card-id="${room}"]')`);await nativeClick(b,`[data-room-card-id="${room}"]`);await nativeClick(b,'[data-room-card-express]');
  await waitUntil(b,`document.querySelector('[data-formal-waiting-page]')&&document.querySelector('.source-waiting-chat')`);
  const input='.source-waiting-chat [data-chat-input]';
  await nativeClick(s,input);await command('Input.insertText',{text:'发行反代中文双端'},s);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'},s);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13},s);
  for(const p of [s,b])await waitUntil(p,`[...document.querySelectorAll('[data-chat-text]')].some(e=>e.dataset.chatText.includes('发行反代中文双端'))`);
  await waitUntil(s,`document.querySelector('${input}').value===''`);evidence.publicChat={bothReceived:true,confirmedDraftCleared:true};
  await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},s).then(r=>writeFile(output+'-waiting.png',Buffer.from(r.data,'base64')));
  for(const p of [b,s]){await nativeClick(p,'[data-waiting-close]');await waitUntil(p,`!document.querySelector('.source-waiting-chat')&&document.activeElement.matches('[data-room-card-create]')&&document.activeElement.matches(':enabled')`);}
  const before=network.length;await command('Page.reload',{},s);await waitUntil(s,`document.querySelector('[data-room-card-home]')?.matches(':enabled')`);
  const after=network.slice(before).find(n=>n.name==='AccountIdentity');assert(after);assert.equal(after.accountId,identities[0].accountId);
  for(const name of ['CreateRoom','Join','RoomChat','Leave'])assert(network.some(n=>n.name===name&&n.direction==='received'&&n.success));
  assert(!network.some(n=>n.direction==='sent'&&['Ready','Shop','TankShop','SelectRole'].includes(n.name)));
  evidence.reloadIdentityPreserved=true;evidence.normalLeaveBoth=true;evidence.status='PASS_LOCAL_NGINX_FORMAL_WEB_PROXY_SCOPE';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
  evidence.network=network;evidence.http=httpResponses;evidence.upgrades=upgrades;
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await stop(chrome);await stop(nginx);await stop(server);
  await writeFile(output+'-nginx.log',nginxLog);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  evidence.cleaned=true;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
}
