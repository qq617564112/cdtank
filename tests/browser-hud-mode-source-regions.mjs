import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3422',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-hud-mode-source-regions-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-hud-mode-source-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3422,vite:5452,cdp:9652},runId,scope:'Source-static missing mode2..5 HUD regions only; mode2 three resolutions and mode3/4/5 each1920 first source views; source numeric fields empty; no gameplay outcomes/shots/purchase/old mode regression.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3422',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'300'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',plugins:[{name:'readonly-resource-ready',transform(source,id){if(id.endsWith('/src/match/battle.ts'))return source+'\nconst modeOldQuick=Battle.prototype.setQuickChats;Battle.prototype.setQuickChats=function(value){window.modeReadinessBattle=this;return modeOldQuick.call(this,value);};';}}],server:{port:5452,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3422',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9652',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9652/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9652');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
  const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5452',browserContextId});
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);const s=sessionId;
  await waitUntil(s,`document.querySelector('[data-room-card-home]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);

  evidence.modes=[];
  const suffixes={2:'conquer',3:'vip',4:'melee',5:'destroy'};
  async function resize(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('#original-battle-hud').getBoundingClientRect().width-800*Math.min(${width}/800,${height}/600))<.2`);}
  for(const mode of [2,3,4,5]){
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);
    await nativeClick(s,'[data-room-card-create]');await waitUntil(s,`document.querySelector('[data-map-selector-mode="${mode}"]')`);await nativeClick(s,`[data-map-selector-mode="${mode}"]`);await waitUntil(s,`document.querySelector('[data-map-selector-map]')`);
    const mapId=await evaluate(s,`document.querySelector('[data-map-selector-map]').dataset.mapSelectorMap`);await nativeClick(s,`[data-map-selector-map="${mapId}"]`);await nativeClick(s,'[data-map-selector-confirm]');await waitUntil(s,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);await nativeClick(s,'[data-room-create-confirm]');await waitUntil(s,`document.querySelector('[data-add-cpu]')?.matches(':enabled')&&!document.querySelector('[data-room-create-dialog]')?.open`);
    for(let i=0;i<3;i++){await nativeClick(s,'[data-add-cpu]');await waitUntil(s,`JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')?.players.length>=${i+2}&&document.querySelector('[data-add-cpu]')?.matches(':enabled')`);}
    await waitUntil(s,`window.modeReadinessBattle?.mapLoaded&&window.modeReadinessBattle?.players.resourcesReady&&!window.modeReadinessBattle.players.loadingError&&document.querySelector('[data-waiting-ready]')?.matches(':enabled')`,90000);
    await nativeClick(s,'[data-waiting-ready]');await waitUntil(s,`document.querySelector('[data-formal-battle-page]')&&document.querySelector('#original-battle-hud').dataset.mode==='${mode}'`,90000);
    await nativeClick(s,'[data-battle-play-summary]');await waitUntil(s,`document.querySelector('[data-battle-play-tools]').open`);
    const entry={mode,mapId,resolutions:[]};evidence.modes.push(entry);
    for(const [width,height]of mode===2?[[800,600],[1920,1080],[3840,2160]]:[[1920,1080]]){
      await resize(width,height);
      const result=await evaluate(s,`(async()=>{const hud=document.querySelector('#original-battle-hud'),path='ui/layouts/game_main_info_${suffixes[mode]}.xml',layout=window.modeReadinessBattle.originalHud.getSnapshot().data.layouts.find(l=>l.path===path),data=window.modeReadinessBattle.originalHud.getSnapshot().data;
        const visible=e=>{for(let p=e;p;p=p.parentElement)if(p.hidden)return false;return getComputedStyle(e).display!=='none';};
        const controls=[...hud.querySelectorAll('[data-source-layout="'+path+'"]')];const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,inside:r.left>=-.2&&r.top>=-.2&&r.right<=innerWidth+.2&&r.bottom<=innerHeight+.2}};
        const images=controls.filter(e=>layout.windows.find(c=>c.name===e.dataset.sourceControl).properties.Image).map(e=>{const c=layout.windows.find(c=>c.name===e.dataset.sourceControl),m=/^set:(\\S+) image:(.+)$/.exec(c.properties.Image),sets=data.imagesets.filter(v=>v.attributes.Name===m[1]),set=sets.find(v=>v.path.includes('imagesets_dds/'))??sets[0],expected=set.images.find(v=>v.Name===m[2]).asset;return {control:c.name,reference:c.properties.Image,expected,background:e.style.backgroundImage,visible:visible(e),box:box(e)};});
        await Promise.all(images.map(v=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=reject;i.src='/'+v.expected;})));
        const numeric=controls.filter(e=>e.matches('[data-mode-info-binding]')).map(e=>({control:e.dataset.sourceControl,binding:e.dataset.modeInfoBinding,text:e.textContent.trim()}));
        return {width:innerWidth,height:innerHeight,mode:hud.dataset.mode,controls:controls.map(e=>({control:e.dataset.sourceControl,visible:visible(e),box:box(e)})),images,numeric,multiply:controls.find(e=>e.dataset.sourceControl==='txtMultiply')?.dataset.value,timer:controls.find(e=>e.dataset.sourceControl==='txtRemainTime')?.dataset.value,otherModes:[...hud.querySelectorAll('[data-source-control="SheetWindow"]')].filter(e=>/game_main_info_/.test(e.dataset.sourceLayout)).map(e=>({layout:e.dataset.sourceLayout,visible:visible(e)})),objective:document.querySelector('[data-battle-play-tools] p')?.textContent,objectiveBox:box(document.querySelector('[data-battle-play-tools] p'))};})()`);
      entry.resolutions.push(result);const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-mode'+mode+'-'+width+'.png',Buffer.from(shot.data,'base64'));
      assert(result.images.every(i=>i.visible&&i.box.inside&&i.background.includes('/'+i.expected)));assert(result.numeric.every(n=>n.binding==='unbound'&&n.text===''));assert.equal(result.controls.length,mode<=3?6:5);assert.equal(result.images.length,mode<=3?2:1);assert(result.timer);assert.equal(result.otherModes.filter(m=>m.visible).length,1);assert(result.objective);if(mode>=4)assert.equal(result.multiply,'*');
    }
    await resize(1920,1080);await nativeClick(s,'[data-leave-room]');await waitUntil(s,`!document.querySelector('[data-formal-battle-page]')&&document.activeElement.matches('[data-room-card-create]')&&document.activeElement.matches(':enabled')`);entry.cleanup={strictCreate:true,sourceHudHidden:await evaluate(s,`document.querySelector('#original-battle-hud').hidden`)};assert(entry.cleanup.sourceHudHidden);
  }
  assert(!network.some(n=>n.direction==='sent'&&['RoomChat','RoomWhisper','FriendChat','Shop','TankShop','SelectRole'].includes(n.name)));evidence.noSendPurchase=true;evidence.noUserCombatInput=true;evidence.status='PASS';console.log('PASS HUD source mode static regions '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
