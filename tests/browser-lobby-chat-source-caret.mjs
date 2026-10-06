import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3464',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-lobby-chat-source-caret-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-lobby-caret-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3464,vite:5494,cdp:9694},runId,resolutions:[],screenshots:[],scope:'UI01/M5-12 original input CaratImage consumer, normal Chinese drafts/native selection/scroll/blur and synthetic composition lifecycle; three complete Lobby resolutions plus whisper1920. No send/BUY/room or OSIME claim.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3464',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5494,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3464',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9694',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9694/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9694');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['CreateRoom','Join','Leave','ExitRoom','Shop','TankShop','PetShop','SelectRole','Ready','LobbyChat','LobbyWhisper','FriendChat'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});


  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5494',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);
  }
  const session=pages[0].sessionId;
  async function press(key,code,windowsVirtualKeyCode,modifiers=0){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode,modifiers},session);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode,modifiers},session);}
  const input='[data-lobby-chat-input]';
  await waitUntil(session,`document.querySelector('[data-lobby-chat-caret="edtNormalUserInput"]')&&document.querySelector('${input}')`);
  evidence.states=[];
  const read=name=>evaluate(session,`(()=>{const c=document.querySelector('[data-lobby-chat-caret="${name}"]'),brush=c.querySelector('i'),e=document.querySelector('${name==='edtIntimateNameInput'?'[data-lobby-whisper-target]':input}'),r=c.getBoundingClientRect(),b=brush.getBoundingClientRect();return {name:'${name}',viewport:{width:innerWidth,height:innerHeight},stageWidth:document.querySelector('[data-lobby-stage]').getBoundingClientRect().width,stageScale:document.querySelector('[data-lobby-stage]').getBoundingClientRect().width/800,asset:c.dataset.sourceAsset,index:Number(c.dataset.sourceCaretIndex),scroll:Number(c.dataset.sourceScroll),focused:c.dataset.sourceFocused,visibility:getComputedStyle(c).visibility,blink:brush.style.opacity,brushWidth:b.width,sourceWidth:Number(c.dataset.sourceCaretWidth),draft:e.value,selection:[e.selectionStart,e.selectionEnd],direction:e.selectionDirection,nativeScroll:e.scrollLeft,nativeCaret:getComputedStyle(e).caretColor,withinInput:r.x===e.getBoundingClientRect().x&&r.y===e.getBoundingClientRect().y,font:getComputedStyle(e).fontFamily}})()`);
  async function type(selector,text){await nativeClick(session,selector);await press('a','KeyA',65,2);await command('Input.insertText',{text},session);assert.equal(await evaluate(session,`document.querySelector(${JSON.stringify(selector)}).value`),text);}
  if (!process.argv.includes('--render-tail-only')) {
  await type(input,'中文大厅草稿');
  await press('Home','Home',36);await waitUntil(session,`document.querySelector('[data-lobby-chat-caret="edtNormalUserInput"]').dataset.sourceCaretIndex==='0'`);evidence.states.push(await read('edtNormalUserInput'));
  await press('End','End',35);await waitUntil(session,`document.querySelector('[data-lobby-chat-caret="edtNormalUserInput"]').dataset.sourceCaretIndex==='6'`);evidence.states.push(await read('edtNormalUserInput'));
  await press('ArrowLeft','ArrowLeft',37,8);await waitUntil(session,`document.querySelector('[data-lobby-chat-caret="edtNormalUserInput"]').dataset.sourceCaretIndex==='5'`);const backward=await read('edtNormalUserInput');assert.equal(backward.direction,'backward');assert.deepEqual(backward.selection,[5,6]);evidence.states.push(backward);
  await type(input,'中文'.repeat(34)+'末尾');await press('End','End',35);await waitUntil(session,`Number(document.querySelector('[data-lobby-chat-caret="edtNormalUserInput"]').dataset.sourceScroll)>0`);const long=await read('edtNormalUserInput');assert.equal(long.index,70);assert.equal(long.scroll,long.nativeScroll);evidence.states.push(long);
  await type(input,'组合中文草稿');await evaluate(session,`document.querySelector('${input}').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'中'}));`);
  await command('Input.insertText',{text:'测试'},session);await evaluate(session,`document.querySelector('${input}').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'测试'}));`);await press('End','End',35);evidence.syntheticComposition=await read('edtNormalUserInput');assert.equal(evidence.syntheticComposition.draft,'组合中文草稿测试');
  }
  await type(input,'中文大厅草稿');
  for(const [width,height]of [[800,600],[1920,1080],[3840,2160]]) {
    const trace={target:{width,height},before:await read('edtNormalUserInput')};(evidence.resizeTrace??=[]).push(trace);
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
    trace.afterDispatch=await read('edtNormalUserInput');
    await waitUntil(session,`Math.abs(document.querySelector('[data-lobby-stage]').getBoundingClientRect().width-800*Math.min(${width}/800,${height}/600))<.2`);
    await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    trace.afterReact=await read('edtNormalUserInput');
    await waitUntil(session,`document.querySelector('[data-lobby-chat-caret="edtNormalUserInput"] i')?.style.opacity==='1'`);
    const state=await read('edtNormalUserInput');evidence.states.push({...state,viewport:{width,height}});assert.equal(state.asset,'ui/regions/60/236.png');assert.equal(state.focused,'true');assert(state.withinInput);assert(Math.abs(state.brushWidth-Math.round(Math.min(width/800,height/600)))<.2);
    const shot=await command('Page.captureScreenshot',{format:'png'},session);const path=output+'-'+width+'.png';await writeFile(path,Buffer.from(shot.data,'base64'));evidence.resolutions.push({width,height});evidence.screenshots.push(path);
  }
  await waitUntil(session,`document.querySelector('[data-lobby-chat-caret="edtNormalUserInput"] i').style.opacity==='0'`);evidence.blinkHidden=true;
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},session);
  await nativeClick(session,'[data-lobby-channel-toggle]');await waitUntil(session,`document.querySelector('[data-lobby-channel="whisper"]')`);await nativeClick(session,'[data-lobby-channel="whisper"]');
  await waitUntil(session,`document.querySelector('[data-lobby-chat-caret="edtIntimateChatInput"]')&&document.querySelector('[data-lobby-chat-caret="edtIntimateNameInput"]')`);
  await type('[data-lobby-whisper-target]','中文目标未发送');await press('End','End',35);const target=await read('edtIntimateNameInput');assert.equal(target.focused,'true');assert.equal(target.index,7);evidence.states.push(target);
  await type(input,'中文密语草稿');await press('End','End',35);const whisper=await read('edtIntimateChatInput');assert.equal(whisper.focused,'true');assert.equal(whisper.index,6);evidence.states.push(whisper);
  const blurredTarget=await read('edtIntimateNameInput');assert.equal(blurredTarget.focused,'false');assert.equal(blurredTarget.visibility,'hidden');evidence.targetBlur=blurredTarget;
  await waitUntil(session,`document.querySelector('[data-lobby-chat-caret="edtIntimateChatInput"] i').style.opacity==='1'`);const shot=await command('Page.captureScreenshot',{format:'png'},session);const path=output+'-whisper-1920.png';await writeFile(path,Buffer.from(shot.data,'base64'));evidence.screenshots.push(path);
  await press('Escape','Escape',27);await waitUntil(session,`document.querySelector('[data-lobby-chat-caret="edtIntimateChatInput"]').dataset.sourceFocused==='false'`);evidence.escapeBlur=await read('edtIntimateChatInput');assert.equal(evidence.escapeBlur.visibility,'hidden');assert.equal(evidence.escapeBlur.draft,'中文密语草稿');
  assert(!network.some(n=>n.direction==='sent'&&['LobbyChat','LobbyWhisper','FriendChat','Shop','TankShop','PetShop'].includes(n.name)));
  assert(!network.some(n=>n.direction==='sent'&&['CreateRoom','Join','Ready','Leave','SelectRole'].includes(n.name)));evidence.noRoomOrAccountMutation=true;evidence.status='PASS';console.log('PASS lobby source input caret '+output);

}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'-server.log',serverLog);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
