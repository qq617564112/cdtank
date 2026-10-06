import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3421',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-battle-emote-shared-consumers-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-battle-emote-shared-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3421,vite:5451,cdp:9651},runId,scope:'UI12 original complete 32-control emote menu in ordinary formal PLAYING; three resolutions, source toggle capture, native Escape/TabEnter and Chinese caret insertion; no send/purchase/old channel or IME permission replay.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3421',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'300'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'readonly-resource-ready',transform(source,id){if(id.endsWith('/src/match/battle.ts'))return source+'\nconst emoteOldQuick=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.emoteReadinessBattle=this;return emoteOldQuick.call(this,value);};';}}],server:{port:5451,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3421',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9651',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9651/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9651');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['CreateRoom','Join','Leave','ExitRoom','Ready','AddCpu','RoomChat','RoomWhisper','FriendChat','PlayerInput','Shop','TankShop','SelectRole'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});



  const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
  const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5451',browserContextId});
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);const s=sessionId;
  await waitUntil(s,`document.querySelector('[data-room-card-home]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);
  await nativeClick(s,'[data-room-card-create]');await waitUntil(s,`document.querySelector('[data-map-selector-map="7"]')`);await nativeClick(s,'[data-map-selector-map="7"]');await nativeClick(s,'[data-map-selector-confirm]');await waitUntil(s,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);await nativeClick(s,'[data-room-create-confirm]');await waitUntil(s,`document.querySelector('[data-add-cpu]')?.matches(':enabled')&&!document.querySelector('[data-room-create-dialog]')?.open`);
  for(let i=0;i<3;i++){await nativeClick(s,'[data-add-cpu]');await waitUntil(s,`JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')?.players.length>=${i+2}&&document.querySelector('[data-add-cpu]')?.matches(':enabled')`);}
  await waitUntil(s,`window.emoteReadinessBattle?.mapLoaded&&window.emoteReadinessBattle?.players.resourcesReady&&!window.emoteReadinessBattle.players.loadingError&&document.querySelector('[data-waiting-ready]')?.matches(':enabled')`,90000);
  await nativeClick(s,'[data-waiting-ready]');await waitUntil(s,`document.querySelector('[data-formal-battle-page]')&&document.querySelector('.source-battle-chat')&&document.querySelector('[data-source-control="btnPublic"]')`,90000);evidence.actualPlaying=true;

  const menu='[data-chat-emote-menu]',toggle='.source-battle-chat [data-source-control="btnExpandEmotion"]',input='.source-battle-chat [data-chat-input]';
  async function press(key,code,vk){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,...(key==='Enter'?{text:'\r'}:{})},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk},s);}
  async function open(){await nativeClick(s,toggle);await waitUntil(s,`!document.querySelector('${menu}').hidden`);}
  async function resize(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('.source-chat-stage').getBoundingClientRect().width-301*Math.min(${width}/800,${height}/600))<.2`);}
  await open();evidence.resolutions=[];
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    await resize(width,height);
    const result=await evaluate(s,`(async()=>{const ui=await(await fetch('/ui.json')).json(),layout=ui.layouts.find(l=>l.path.endsWith('/game_main_emotelist.xml')),d=document.querySelector('${menu}');
      const asset=reference=>{const m=/^set:(\\S+) image:(.+)$/.exec(reference),sets=ui.imagesets.filter(s=>s.attributes.Name===m[1]),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return set.images.find(i=>i.Name===m[2]).asset;};
      const layers=[...d.querySelectorAll('[data-source-frame],[data-source-image]')].map(e=>{const c=layout.windows.find(c=>c.name===e.parentElement.dataset.sourceControl),key=e.dataset.sourceFrame??'Image';return {control:c.name,property:key,asset:e.dataset.sourceAsset,expected:asset(c.properties[key])};});
      const choices=[...d.querySelectorAll('[data-chat-emote-choice]')].map(e=>({id:Number(e.dataset.chatEmoteChoice),name:e.dataset.sourceControl,asset:e.dataset.sourceAsset,expected:asset(layout.windows.find(w=>w.name===e.dataset.sourceControl).properties.Image)}));
      await Promise.all([...layers,...choices].map(l=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=reject;i.src='/'+l.asset;})));
      const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,inside:r.left>=-.2&&r.top>=-.2&&r.right<=innerWidth+.2&&r.bottom<=innerHeight+.2}};
      return {width:innerWidth,height:innerHeight,scale:d.getBoundingClientRect().width/194,menu:box(d),frames:d.querySelectorAll('[data-source-frame]').length,layers,choices,controls:[...d.querySelectorAll('[data-source-control]')].map(e=>({name:e.dataset.sourceControl,box:box(e)})),toggleState:document.querySelector('${toggle}').dataset.sourceButtonState};})()`);
    evidence.resolutions.push(result);const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));
    assert(result.menu.inside);assert.equal(result.frames,8);assert.equal(result.controls.length,32);assert.equal(result.choices.length,30);assert(result.controls.every(c=>c.box.inside));assert([...result.layers,...result.choices].every(l=>l.asset===l.expected));
  }
  await resize(1920,1080);await waitUntil(s,`document.activeElement.matches('[data-chat-emote-choice]')`);
  await evaluate(s,`window.emoteEscapedKeys=[];window.addEventListener('keydown',e=>window.emoteEscapedKeys.push(e.code))`);
  await press('Escape','Escape',27);await waitUntil(s,`document.querySelector('${menu}').hidden&&document.activeElement.matches('${toggle}')`);evidence.escape={keys:await evaluate(s,'window.emoteEscapedKeys'),strictToggle:true};assert.deepEqual(evidence.escape.keys,[]);
  const point=await evaluate(s,`(()=>{const e=document.querySelector('${toggle}'),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const state=()=>evaluate(s,`(()=>{const e=document.querySelector('${toggle}');return {state:e.dataset.sourceButtonState,pushed:e.dataset.sourcePushed,capture:e.hasPointerCapture(1),menuHidden:document.querySelector('${menu}').hidden}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},s);await waitUntil(s,`document.querySelector('${toggle}').dataset.sourceButtonState==='Hover'`);evidence.hover=await state();
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...point},s);await waitUntil(s,`document.querySelector('${toggle}').dataset.sourceButtonState==='Pushed'`);evidence.pressed=await state();assert.equal(evidence.pressed.state,'Pushed');assert(evidence.pressed.capture);
  const outside={x:point.x+90,y:point.y};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,...outside},s);evidence.heldOutside=await state();assert(evidence.heldOutside.capture);assert.equal(evidence.heldOutside.state,'Hover');
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...outside},s);await waitUntil(s,`document.querySelector('${toggle}').dataset.sourcePushed==='false'`);evidence.releasedOutside=await state();assert.equal(evidence.releasedOutside.state,'Normal');assert(!evidence.releasedOutside.capture&&evidence.releasedOutside.menuHidden);
  await open();evidence.beforeFastEscape=await evaluate(s,`({active:document.activeElement.outerHTML,withinMenu:!!document.activeElement.closest('${menu}')})`);await press('Escape','Escape',27);await waitUntil(s,`document.querySelector('${menu}').hidden&&document.activeElement.matches('${toggle}')`);evidence.fastEscape={keys:await evaluate(s,'window.emoteEscapedKeys'),strictToggle:true};assert.deepEqual(evidence.fastEscape.keys,[]);
  await nativeClick(s,input);await command('Input.insertText',{text:'甲乙'},s);await press('ArrowLeft','ArrowLeft',37);await open();await nativeClick(s,'[data-chat-emote-choice="1"]');await waitUntil(s,`document.activeElement.matches('${input}')`);evidence.mouseInsert=await evaluate(s,`({draft:document.querySelector('${input}').value,caret:document.querySelector('${input}').selectionStart,focused:document.activeElement.matches('${input}')})`);assert.equal(evidence.mouseInsert.draft,'甲'+String.fromCharCode(0x2581)+'乙');assert.equal(evidence.mouseInsert.caret,2);
  await press('Escape','Escape',27);await waitUntil(s,`document.querySelector('${menu}').hidden&&document.activeElement.matches('${toggle}')`);
  await open();await waitUntil(s,`document.activeElement.matches('[data-chat-emote-choice="1"]')`);await press('Tab','Tab',9);assert(await evaluate(s,`document.activeElement.matches('[data-chat-emote-choice="2"]')`));await press('Enter','Enter',13);await waitUntil(s,`document.activeElement.matches('${input}')`);evidence.keyboardInsert=await evaluate(s,`({draft:document.querySelector('${input}').value,caret:document.querySelector('${input}').selectionStart,focused:document.activeElement.matches('${input}')})`);assert.equal(evidence.keyboardInsert.draft,'甲'+String.fromCharCode(0x2581,0x2582)+'乙');assert.equal(evidence.keyboardInsert.caret,3);
  await nativeClick(s,'[data-leave-room]');await waitUntil(s,`!document.querySelector('[data-formal-battle-page]')&&document.activeElement.matches('[data-room-card-create]')&&document.activeElement.matches(':enabled')`);evidence.cleanup={menuUnmounted:await evaluate(s,`!document.querySelector('${menu}')`),strictCreate:true};assert(evidence.cleanup.menuUnmounted);
  assert(!network.some(n=>n.direction==='sent'&&['RoomChat','RoomWhisper','FriendChat','Shop','TankShop','SelectRole'].includes(n.name)));evidence.noSendOrPurchase=true;evidence.status='PASS';console.log('PASS battle original emote menu '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
