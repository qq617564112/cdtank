import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {HISTORY_INTRO_CONTENT} from '../apps/web/src/interface/account/history-intro-content.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3527',logger:undefined});
const renderTailOnly=process.argv.includes('--render-tail-only');
const network=[],accountIds=new Map(),httpFailures=[],markers=[];let uiBlocked=true;
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-history-intro-source-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-history-intro-source-page-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={httpFailures,markers,status:'RUNNING',ports:{server:3527,vite:5557,cdp:9757},runId,scope:'UI23/M5-15 original fourbody source introduction through validation host; formal Login navigation absent'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3527',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5557,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3527',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9757',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9757/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9757');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(r.service.name==='Account'&&r.ret?.isSucc)accountIds.set(m.sessionId,r.ret.res.accountId);if(['History','Kitbag','DisplayName','Friends','Blacklist','Equipment','Inventory','Shop','TankShop','PetShop','SelectRole','CreateRoom','Join','Ready','AddCpu','RoomChat','RoomWhisper','FriendChat'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});



  for(let i=0;i<1;i++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Network.enable',{},sessionId);await command('Page.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await command('Page.navigate',{url:'http://127.0.0.1:5557/validation.html'},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-open-history-intro]')?.matches(':enabled')`);
  }

  const s=pages[0].sessionId;
  assert.equal(await evaluate(s,'location.pathname'),'/validation.html');evidence.renderTailOnly=renderTailOnly;evidence.validationHost=true;evidence.formalLoginNavigation=false;
  evidence.hostOverflowBefore=await evaluate(s,`getComputedStyle(document.documentElement).overflow`);
  await nativeClick(s,'[data-open-history-intro]');
  await waitUntil(s,`document.querySelector('[data-history-intro-dialog]')?.open&&document.querySelector('[data-history-intro-body]')`);
  await evaluate(s,`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
  evidence.states=[];evidence.screenshots=[];
  async function read(){return evaluate(s,`(()=>{const b=document.querySelector('[data-history-intro-body]'),bar=document.querySelector('[data-history-intro-scrollbar]'),thumb=document.querySelector('[data-history-intro-scroll-thumb]');return {clientViewport:[document.documentElement.clientWidth,document.documentElement.clientHeight],bodyRect:b.getBoundingClientRect().toJSON(),closeRect:document.querySelector('[data-history-intro-close]').getBoundingClientRect().toJSON(),pageRect:document.querySelector('[data-history-intro-page]').getBoundingClientRect().toJSON(),text:b.value,readonly:b.readOnly,caret:[b.selectionStart,b.selectionEnd],scroll:b.scrollTop,height:b.clientHeight,extent:b.scrollHeight-b.clientHeight,listScale:b.getBoundingClientRect().height/b.clientHeight,metricScale:Number(bar.dataset.scrollScale),barVisible:!bar.hidden,thumb:thumb.getBoundingClientRect().toJSON(),thumbState:thumb.dataset.thumbState,capture:[1,2,3,4].some(id=>thumb.hasPointerCapture(id)),tabs:[...document.querySelectorAll('[data-history-intro-tab]')].map(e=>({name:e.dataset.historyIntroTab,selected:e.getAttribute('aria-pressed')})),controls:[...document.querySelectorAll('[data-history-intro-page] [data-source-control]')].map(e=>({name:e.dataset.sourceControl,rect:e.getBoundingClientRect().toJSON()}))}})()`);}
  async function key(key,code,vk,type){await command('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk},s);}
  async function press(keyName,code,vk){await key(keyName,code,vk,'keyDown');await key(keyName,code,vk,'keyUp');}
  for(const [width,height] of (process.argv.includes('--viewport-800-only')?[[800,600]]:[[800,600],[1920,1080],[3840,2160]])){
    const scale=Math.min(width/800,height/600);
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    await waitUntil(s,`Math.abs(document.querySelector('[data-history-intro-stage]').getBoundingClientRect().width-800*${scale})<.2`);
    await evaluate(s,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    for(const page of HISTORY_INTRO_CONTENT){
      await nativeClick(s,`[data-history-intro-tab="${page.control}"]`);
      await waitUntil(s,`document.querySelector('[data-history-intro-body]').dataset.sourceStringRecord==='${page.recordId}'`);
      const state=await read();assert.equal(state.text,page.text);assert(state.readonly);assert.equal(state.scroll,0);assert.deepEqual(state.caret,[0,0]);assert.equal(state.tabs.filter(t=>t.selected==='true').length,1);assert.equal(state.tabs.find(t=>t.selected==='true').name,page.control);assert(Math.abs(state.metricScale-state.listScale)<.01);assert(Math.abs(state.listScale-scale)<.01);
      assert(state.pageRect.left>=-.2&&state.pageRect.top>=-.2&&state.pageRect.right<=width+.2&&state.pageRect.bottom<=height+.2,'source page within viewport');assert(state.pageRect.right<=state.clientViewport[0]+.2&&state.pageRect.bottom<=state.clientViewport[1]+.2,'source within usable client viewport');assert.equal(state.controls.length,10);for(const rect of [state.bodyRect,state.closeRect])assert(rect.left>=0&&rect.top>=0&&rect.right<=width+.2&&rect.bottom<=height+.2);state.viewport=[width,height];state.record=page.recordId;evidence.states.push(state);
      const path=output+'-'+width+'-'+page.control+'.png';const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(path,Buffer.from(shot.data,'base64'));evidence.screenshots.push(path);
    }
    if(!renderTailOnly){
    let before=await read();assert(before.barVisible&&before.extent>0,'original Staff naturally overflows');assert(before.thumb.height>=10-.1);
    await nativeClick(s,'[data-history-intro-scroll-arrow="down"]');let after=await read();assert(after.scroll>before.scroll);evidence.states.push({operation:'arrow',width,before:before.scroll,after:after.scroll});
    const pt=await evaluate(s,`(()=>{const r=document.querySelector('[data-history-intro-body]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await command('Input.dispatchMouseEvent',{type:'mouseWheel',...pt,deltaX:0,deltaY:22*scale},s);await waitUntil(s,`document.querySelector('[data-history-intro-body]').scrollTop>${after.scroll}`);after=await read();evidence.states.push({operation:'wheel',width,after});
    await evaluate(s,`(()=>{document.querySelector('[data-history-intro-scroll-thumb]').focus();return true})()`);
    await press('Home','Home',36);assert.equal((await read()).scroll,0);await press('End','End',35);after=await read();assert(Math.abs(after.scroll-after.extent)<1);await press('Home','Home',36);
    before=await read();const point={x:before.thumb.x+before.thumb.width/2,y:before.thumb.y+before.thumb.height/2};
    await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},s);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point},s);const held=await read();assert(held.capture&&held.thumbState==='Pushed');
    const outside={x:point.x-100*scale,y:point.y+20*scale};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,...outside},s);const moved=await read();assert(moved.capture&&moved.scroll>before.scroll);
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...outside},s);const released=await read();assert(!released.capture&&released.thumbState==='Normal');evidence.states.push({operation:'outsideThumbSnapshot',width,held,moved,released});
    }
  }
  await nativeClick(s,'[data-history-intro-close]');await waitUntil(s,`!document.querySelector('[data-history-intro-dialog]')&&document.activeElement.matches('[data-open-history-intro]')`);evidence.sourceCloseStrictOpener=true;evidence.hostOverflowAfter=await evaluate(s,`getComputedStyle(document.documentElement).overflow`);assert.equal(evidence.hostOverflowAfter,evidence.hostOverflowBefore);evidence.rootScrollRestored=true;
  await nativeClick(s,'[data-open-history-intro]');await waitUntil(s,`document.querySelector('[data-history-intro-body]')?.dataset.sourceStringRecord==='737'`);
  await key('Escape','Escape',27,'keyDown');assert(await evaluate(s,`Boolean(document.querySelector('[data-history-intro-dialog]')?.open)`));await key('Escape','Escape',27,'keyUp');await waitUntil(s,`!document.querySelector('[data-history-intro-dialog]')&&document.activeElement.matches('[data-open-history-intro]')`);evidence.escapeDownUpStrictOpener=true;
  assert(!network.some(n=>n.direction==='sent'&&!(n.name==='DisplayName'&&n.kind==='api'&&Object.keys(n.payload??{}).length===0)));evidence.noTrackedAccountRoomWrites=true;evidence.status='PASS';console.log('PASS '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{if(evidence.status==='FAIL'&&pages.length){try{const shot=await command('Page.captureScreenshot',{format:'png'},pages[0].sessionId);evidence.failureFrame=output+'-failure.png';await writeFile(evidence.failureFrame,Buffer.from(shot.data,'base64'));}catch{}}evidence.network=network;await writeFile(output+'-server.log',serverLog);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});evidence.processCleanup={serverStopped:server?.exitCode!==null||server?.signalCode!==null,chromeStopped:chrome?.exitCode!==null||chrome?.signalCode!==null,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');}
