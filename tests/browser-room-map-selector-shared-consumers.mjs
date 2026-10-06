import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3415',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-room-map-selector-shared-consumers-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-map-shared-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3415,vite:5445,cdp:9645},runId,scope:process.argv.includes('--button-readability-only')?'UI48/UI49 directed transparent button/readability and Normal/Hover/Pushed/Selected; one1920PNG, no geometry/navigation replay.':'UI48/UI49 whole source frame/mask/mode consumers and normal draft selection/cancel/confirm/Escape; 0CreateRoom/Ready/BUY/battle.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3415',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5445,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3415',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9645',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9645/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9645');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['ListMaps','CreateRoom','Join','Leave','ExitRoom','Ready','Shop','TankShop','SelectRole'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});



  const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
  const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5445',browserContextId});
  const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);const s=sessionId;
  await waitUntil(s,`document.querySelector('[data-room-card-home]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);
  const modal='[data-room-map-selector]';
  async function open(){await nativeClick(s,'[data-room-card-create]');await waitUntil(s,`document.querySelector('${modal}')?.open&&document.querySelector('[data-map-selector-map]')`);}
  async function home(){await waitUntil(s,`!document.querySelector('${modal}')?.open&&document.activeElement.matches('[data-room-card-create]')&&document.activeElement.matches(':enabled')`);}
  async function resize(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('[data-map-selector-stage]').getBoundingClientRect().width-800*Math.min(${width}/800,${height}/600))<.2`);}
  await open();
  const response=network.find(n=>n.name==='ListMaps'&&n.direction==='received'&&n.success);assert(response);evidence.catalog=response.response.maps;
  evidence.initial=await evaluate(s,`({mode:Number(document.querySelector('[data-map-selector-mode][aria-pressed="true"]').dataset.mapSelectorMode),mapId:Number(document.querySelector('[data-map-selector-map][aria-pressed="true"]').dataset.mapSelectorMap)})`);
  evidence.resolutions=[];
  for(const [width,height]of (process.argv.includes('--button-readability-only')?[]:[[800,600],[1920,1080],[3840,2160]])){
    await resize(width,height);
    const result=await evaluate(s,`(async()=>{const ui=await(await fetch('/ui.json')).json(),d=document.querySelector('${modal}'),stage=d.querySelector('[data-map-selector-stage]'),r=stage.getBoundingClientRect();
      const asset=reference=>{const m=/^set:(\\S+) image:(.+)$/.exec(reference),sets=ui.imagesets.filter(s=>s.attributes.Name===m[1]),set=sets.find(s=>s.path.includes('imagesets_dds/'))??sets[0];return set.images.find(i=>i.Name===m[2]).asset;};
      const layers=[...d.querySelectorAll('[data-source-frame],[data-source-image]')].map(e=>{const owner=e.parentElement,l=ui.layouts.find(l=>owner.dataset.sourceLayout.endsWith(l.path.split('/').at(-1))),c=l.windows.find(c=>c.name===owner.dataset.sourceControl),key=e.dataset.sourceFrame??'Image';return {control:c.name,property:key,asset:e.dataset.sourceAsset,expected:c.properties[key]?asset(c.properties[key]):null};});
      await Promise.all(layers.map(l=>new Promise((resolve,reject)=>{const image=new Image();image.onload=resolve;image.onerror=reject;image.src='/'+l.asset;})));
      const box=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,inside:b.left>=-.2&&b.top>=-.2&&b.right<=innerWidth+.2&&b.bottom<=innerHeight+.2}};
      return {width:innerWidth,height:innerHeight,scale:r.width/800,stage:box(stage),root:box(d.querySelector('[data-source-control="SheetWindow"]')),mask:box(d.querySelector('[data-source-control="picBackgroundMask"]')),controls:[...d.querySelectorAll('[data-source-layout="ui/layouts/selectgamemode.xml"]')].map(e=>e.dataset.sourceControl),layers,frameCount:d.querySelectorAll('[data-source-frame]').length,maps:[...d.querySelectorAll('[data-map-selector-map]')].map(e=>({mapId:Number(e.dataset.mapSelectorMap),name:e.querySelector('[data-source-control="txtMapName"]').textContent,box:box(e)})),page:d.querySelector('[data-map-selector-page]').textContent,previous:d.querySelector('[data-map-selector-previous]').dataset.sourceButtonState,next:d.querySelector('[data-map-selector-next]').dataset.sourceButtonState,toolbar:box(d.querySelector('[data-map-selector-web-confirm]')),focusWithin:d.contains(document.activeElement)};})()`);
    assert(result.stage.inside&&result.root.inside&&result.mask.inside&&result.toolbar.inside);assert.equal(result.frameCount,12);assert.equal(new Set(result.controls).size,23);assert(result.layers.every(l=>!l.expected||l.asset===l.expected));assert(result.maps.every(m=>m.box.inside));assert.equal(result.previous,'Disabled');assert.equal(result.next,'Disabled');
    const expected=evidence.catalog.filter(m=>m.mode===evidence.initial.mode);assert.deepEqual(result.maps.map(m=>({mapId:m.mapId,name:m.name})),expected.map(m=>({mapId:m.mapId,name:m.name})));
    const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));evidence.resolutions.push(result);
  }
  await resize(1920,1080);
  if(process.argv.includes('--button-readability-only')){
    const selector='[data-map-selector-mode="2"]';
    const point=await evaluate(s,`(()=>{const e=document.querySelector('${selector}'),r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    const state=()=>evaluate(s,`(()=>{const e=document.querySelector('${selector}');return {state:e.dataset.sourceButtonState,pushed:e.dataset.sourcePushed,background:getComputedStyle(e).backgroundColor,layers:[...e.querySelectorAll('[data-room-button-image]')].map(i=>({property:i.dataset.roomButtonImage,asset:i.dataset.sourceAsset}))}})()`);
    await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:300,y:30},s);evidence.normal=await state();assert.equal(evidence.normal.state,'Normal');assert.equal(evidence.normal.background,'rgba(0, 0, 0, 0)');
    await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point},s);await waitUntil(s,`document.querySelector('${selector}').dataset.sourceButtonState==='Hover'`);evidence.hover=await state();
    await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...point},s);await waitUntil(s,`document.querySelector('${selector}').dataset.sourceButtonState==='Pushed'`);evidence.pressed=await state();
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...point},s);await waitUntil(s,`document.querySelector('${selector}').getAttribute('aria-pressed')==='true'`);evidence.selected=await state();assert(evidence.selected.layers.some(l=>l.property==='CheckMarkImage'));
    await nativeClick(s,`[data-map-selector-mode="${evidence.initial.mode}"]`);await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:300,y:30},s);
    const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-1920-final.png',Buffer.from(shot.data,'base64'));
    evidence.finalScreenshot=output+'-1920-final.png';evidence.navigationReplayed=false;await nativeClick(s,'[data-map-selector-close]');await home();evidence.status='PASS';console.log('PASS directed source button transparent/readability states '+output);
  }else{
  const alt=evidence.catalog.find(m=>m.mode!==evidence.initial.mode);assert(alt);
  await nativeClick(s,`[data-map-selector-mode="${alt.mode}"]`);await nativeClick(s,`[data-map-selector-map="${alt.mapId}"]`);
  await nativeClick(s,'[data-map-selector-close]');await home();evidence.closeFocus=true;
  await open();evidence.cancelPreserved=await evaluate(s,`({mode:Number(document.querySelector('[data-map-selector-mode][aria-pressed="true"]').dataset.mapSelectorMode),mapId:Number(document.querySelector('[data-map-selector-map][aria-pressed="true"]').dataset.mapSelectorMap)})`);assert.deepEqual(evidence.cancelPreserved,evidence.initial);
  await evaluate(s,`window.mapEscapedKeys=[];window.addEventListener('keydown',e=>window.mapEscapedKeys.push(e.code))`);
  evidence.beforeEscape=await evaluate(s,`({active:document.activeElement.dataset.sourceControl,within:document.querySelector('${modal}').contains(document.activeElement)})`);assert(evidence.beforeEscape.within);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},s);await home();evidence.escape={keys:await evaluate(s,'window.mapEscapedKeys'),strictCreateFocus:true};assert.deepEqual(evidence.escape.keys,[]);
  await open();await nativeClick(s,`[data-map-selector-mode="${alt.mode}"]`);await nativeClick(s,`[data-map-selector-map="${alt.mapId}"]`);await nativeClick(s,'[data-map-selector-confirm]');
  await waitUntil(s,`!document.querySelector('${modal}')?.open&&document.querySelector('[data-room-create-dialog]')?.open&&document.querySelector('[data-room-create-close]')`);
  evidence.confirm={mode:alt.mode,mapId:alt.mapId,name:await evaluate(s,`document.querySelector('[data-room-create-dialog] [data-source-control="txtMapName"]').textContent`)};assert.equal(evidence.confirm.name,alt.name);
  await nativeClick(s,'[data-room-create-close]');await home();
  await open();evidence.confirmPersisted=await evaluate(s,`({mode:Number(document.querySelector('[data-map-selector-mode][aria-pressed="true"]').dataset.mapSelectorMode),mapId:Number(document.querySelector('[data-map-selector-map][aria-pressed="true"]').dataset.mapSelectorMap)})`);assert.deepEqual(evidence.confirmPersisted,{mode:alt.mode,mapId:alt.mapId});await nativeClick(s,'[data-map-selector-close]');await home();
  assert(!network.some(n=>n.direction==='sent'&&['CreateRoom','Ready','Shop','TankShop','SelectRole','Join'].includes(n.name)));evidence.noRoomPurchaseBattle=true;evidence.status='PASS';console.log('PASS source map selector whole page/draft/navigation '+output);
  }
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
