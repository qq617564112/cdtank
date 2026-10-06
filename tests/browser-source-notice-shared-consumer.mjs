import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3414',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-source-notice-shared-consumer-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-source-notice-shared-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3414,vite:5444,cdp:9644},runId,scope:process.argv.includes('--navigation-only')?'M5-15/UI40 corrected native capture release/Space/Escape and cleanup only; no screenshots or resolution replay.':'M5-15/UI40 original notification complete frame/button shared consumers, actual no-recipient Invite rejection and three resolutions; no Ready/purchase/battle.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3414',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5444,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3414',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9644',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9644/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9644');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['CreateRoom','Join','Leave','ExitRoom','Ready','RoomInvite','PlayerInput','Shop','TankShop','SelectRole'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});



  const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
  const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5444',browserContextId});
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);const s=sessionId;
  await waitUntil(s,`document.querySelector('[data-room-card-home]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);
  await nativeClick(s,'[data-room-card-create]');
  await waitUntil(s,`document.querySelector('[data-map-selector-map="7"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-map-selector-map="7"]');await nativeClick(s,'[data-map-selector-confirm]');
  await waitUntil(s,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);
  await nativeClick(s,'[data-room-create-confirm]');
  await waitUntil(s,`!document.querySelector('[data-room-create-dialog]')?.open&&document.querySelector('[data-waiting-invite]')?.matches(':enabled')`);
  async function rejection(){const start=network.length;await nativeClick(s,'[data-waiting-invite]');await waitUntil(s,`document.querySelector('[data-source-notice]')?.open`);const response=network.slice(start).find(r=>r.name==='RoomInvite'&&r.direction==='received');assert(response&&!response.success);assert.equal(response.response.code,'INVITE_EMPTY');const message=await evaluate(s,`document.querySelector('[data-source-notice] [data-source-control="txtMessage"]').textContent`);assert(message.includes(response.response.message));return {code:response.response.code,message};}
  async function restore(){await waitUntil(s,`!document.querySelector('[data-source-notice]')?.open&&document.querySelector('[data-waiting-invite]')?.matches(':enabled')&&document.activeElement.matches('[data-waiting-invite]')`);}
  async function resize(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('.source-notice-stage').getBoundingClientRect().width-315*Math.min(${width}/800,${height}/600))<.2`);}
  const button='[data-source-notice] [data-source-control="btnOK"]';
  async function state(){return evaluate(s,`(()=>{const e=document.querySelector(${JSON.stringify(button)});return {hasCapture:e.hasPointerCapture(window.noticePointerId??1),state:e.dataset.sourceButtonState,pushed:e.dataset.sourcePushed,hovering:e.dataset.sourceHovering,layer:[...e.querySelectorAll('[data-room-button-image]')].map(i=>({property:i.dataset.roomButtonImage,asset:i.dataset.sourceAsset})),open:document.querySelector('[data-source-notice]').open,focused:document.activeElement===e}})()`);}
  evidence.rejection=await rejection();evidence.resolutions=[];
  for(const [width,height]of (process.argv.includes('--navigation-only')?[]:[[800,600],[1920,1080],[3840,2160]])){
    await resize(width,height);
    const page=await evaluate(s,`(async()=>{const ui=await(await fetch('/ui.json')).json(),layout=ui.layouts.find(l=>l.path.endsWith('notify_dialog.xml')),d=document.querySelector('[data-source-notice]'),stage=d.querySelector('.source-notice-stage'),box=stage.getBoundingClientRect(),scale=box.width/315;
      const asset=reference=>{const m=/^set:(\\S+) image:(.+)$/.exec(reference),sets=ui.imagesets.filter(s=>s.attributes.Name===m[1]),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return set.images.find(i=>i.Name===m[2]).asset;};
      const layers=[...d.querySelectorAll('[data-source-frame],[data-source-image]')].map(e=>{const c=layout.windows.find(c=>c.name===e.parentElement.dataset.sourceControl),key=e.dataset.sourceFrame??'Image';return {control:c.name,property:key,asset:e.dataset.sourceAsset,expected:asset(c.properties[key])};});
      await Promise.all(layers.map(l=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=reject;i.src='/'+l.asset;})));
      return {width:innerWidth,height:innerHeight,scale,stage:{x:box.x,y:box.y,width:box.width,height:box.height},insideViewport:box.x>=0&&box.y>=0&&box.right<=innerWidth+.2&&box.bottom<=innerHeight+.2,controls:[...d.querySelectorAll('[data-source-control]')].map(e=>e.dataset.sourceControl),frameCount:d.querySelectorAll('[data-source-frame]').length,centerCount:d.querySelectorAll('[data-source-image]').length,layers,message:d.querySelector('[data-source-control="txtMessage"]').textContent,confirm:${'document.querySelector('+JSON.stringify(button)+')'}.dataset.sourceButtonState};})()`);
    assert(page.insideViewport);assert.equal(page.frameCount,16);assert.equal(page.centerCount,2);assert.deepEqual([...new Set(page.controls)].sort(),['SheetWindow','picBackgroundMask','shangkuang','xiakuang','txtMessage','btnOK'].sort());assert(page.layers.every(l=>l.asset===l.expected));assert.equal(page.message,evidence.rejection.message);
    const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));evidence.resolutions.push(page);
  }
  await resize(1920,1080);
  await evaluate(s,`window.noticePointerEvents=[];for(const type of ['pointerdown','pointermove','pointerup','gotpointercapture','lostpointercapture','pointercancel','click'])document.addEventListener(type,e=>{if(type==='pointerdown')window.noticePointerId=e.pointerId;const b=document.querySelector(${JSON.stringify(button)}),r=b?.getBoundingClientRect();window.noticePointerEvents.push({type,hasCapture:b?.hasPointerCapture(e.pointerId??window.noticePointerId??1),detail:e.detail,pointerType:e.pointerType,pointerId:e.pointerId,button:e.button,buttons:e.buttons,x:e.clientX,y:e.clientY,target:e.target.closest?.('[data-source-control]')?.dataset.sourceControl,open:document.querySelector('[data-source-notice]')?.open,pushed:b?.dataset.sourcePushed,rect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null});},true)`);
  const point=await evaluate(s,`(()=>{const e=document.querySelector(${JSON.stringify(button)}),r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Button not hit');return {x,y}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},s);await waitUntil(s,`document.querySelector(${JSON.stringify(button)}).dataset.sourceButtonState==='Hover'`);evidence.hover=await state();assert.equal(evidence.hover.layer[0].property,'HoverImage');
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...point},s);await waitUntil(s,`document.querySelector(${JSON.stringify(button)}).dataset.sourceButtonState==='Pushed'`);evidence.pressed=await state();assert.equal(evidence.pressed.layer[0].property,'PushedImage');
  const outside={x:point.x+180,y:point.y};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,...outside},s);await waitUntil(s,`document.querySelector(${JSON.stringify(button)}).dataset.sourceButtonState==='Hover'`);evidence.capturedOutside=await state();assert.equal(evidence.capturedOutside.pushed,'true');assert(evidence.capturedOutside.open);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...outside},s);await evaluate(s,`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);evidence.pointerEvents=await evaluate(s,'window.noticePointerEvents');evidence.releasedOutside=await state();assert(evidence.releasedOutside.open,'Captured release outside must preserve notice');assert.equal(evidence.releasedOutside.pushed,'false','Physical mouse release must clear held state');
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32},s);await waitUntil(s,`document.querySelector(${JSON.stringify(button)}).dataset.sourceButtonState==='Pushed'`);evidence.keyboardPressed=await state();
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32},s);await restore();evidence.keyboardConfirmRestored=true;
  evidence.escapeRejection=await rejection();await evaluate(s,`window.noticeEscapedKeys=[];window.addEventListener('keydown',e=>window.noticeEscapedKeys.push(e.code))`);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);await restore();evidence.escape={keys:await evaluate(s,'window.noticeEscapedKeys'),strictInviteFocus:true};assert.deepEqual(evidence.escape.keys,[]);
  await nativeClick(s,'[data-waiting-room] [data-source-control="btnClose"]');await waitUntil(s,`!document.querySelector('[data-waiting-room]')&&document.activeElement.matches('[data-room-card-create]')&&document.activeElement.matches(':enabled')`);evidence.leaveCleaned=true;
  assert(!network.some(r=>r.direction==='sent'&&(r.name==='Ready'||r.name==='PlayerInput'||r.name==='SelectRole'||r.payload?.operation==='BUY')));evidence.noReadyPurchaseOrBattle=true;evidence.status='PASS';console.log(process.argv.includes('--navigation-only')?'PASS corrected native capture release/Space/Escape and cleanup only; no new screenshots':'PASS actual Invite rejection/source notice complete six controls/shared frames and button capture/three resolutions/native keyboard confirm/Escape focus and Leave cleanup');
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
