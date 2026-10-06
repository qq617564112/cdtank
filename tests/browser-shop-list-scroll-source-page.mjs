import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile, copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {DatabaseSync, backup} from 'node:sqlite';
import {classifyItemId} from '../apps/shared/combat/item-hotkeys.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3437',logger:undefined});
const network=[];
let serverLog='';
const navigationOnly=process.argv.includes('--navigation-only');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-shop-list-scroll-source-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-pet-details-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const fixture=JSON.parse(await readFile('recovery/output/home-tank-active-marker-browser-fixture.json','utf8'));
const checkpoint=fixture.database??'recovery/output/home-tank-active-marker-browser.sqlite';await copyFile(checkpoint,database);
const pages=[],contexts=[];

const evidence={status:'RUNNING',navigationOnly,ports:{server:3437,vite:5465,cdp:9668},runId,scope:'UI53 original list scrollbars around confirmed Shop directory and legal Inventory; three complete pages and scroll/capture/keyboard/category/Close; no BUY/room/account or inventory injection.',checkpoint:{source:checkpoint,copied:true,originalModified:false,originalFundsFixture:true}};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3437',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5465,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3437',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9668',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9668/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9668');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop','RoleProfile'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5465'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const s=pages[0].sessionId;



  assert.equal(await evaluate(s,`localStorage.getItem('cdtank-account-token')`),fixture.token);
  await nativeClick(s,'[data-room-card-shop]');await waitUntil(s,`document.querySelector('[data-shop-item]')?.getAttribute('aria-busy')==='false'&&document.querySelector('[data-shop-root-category="Item"]')?.getAttribute('aria-pressed')==='true'`);
  const list='[data-shop-item]',shell='[data-source-control="lstShopItem"]',bar=shell+' [data-shop-list-scrollbar]',thumb=shell+' [data-shop-list-scroll-thumb]',up=shell+' [data-shop-list-scroll-arrow="up"]',down=shell+' [data-shop-list-scroll-arrow="down"]';
  await waitUntil(s,`document.querySelector('${list}').scrollHeight>document.querySelector('${list}').clientHeight&&!document.querySelector('${bar}').hidden`);
  const query=network.find(n=>n.name==='Shop'&&n.success);assert(query);const expected=query.response.items.filter(i=>{const type=classifyItemId(i.itemTableId);return !(type>=8&&type<=12)&&type!==3;});
  evidence.confirmedProducts=expected.map(i=>({id:i.itemTableId,name:i.name}));
  async function key(key,code,vk){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk},s);}
  async function resize(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('.shop-source-stage').getBoundingClientRect().width-625*Math.min(${width}/800,${height}/600))<.2`);}
  const metrics=()=>evaluate(s,`(()=>{const l=document.querySelector('${list}'),t=document.querySelector('${thumb}');return {scroll:l.scrollTop,page:l.clientHeight,document:l.scrollHeight,capture:t.hasPointerCapture(1),state:t.dataset.thumbState}})()`);
  const point=selector=>evaluate(s,`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),clip=e.closest('[data-shop-list-scrollbar]')?.getBoundingClientRect()??r,x=(Math.max(r.left,clip.left)+Math.min(r.right,clip.right))/2,y=(Math.max(r.top,clip.top)+Math.min(r.bottom,clip.bottom))/2;if(!e.contains(document.elementFromPoint(x,y)))throw new Error('Clipped control covered');return {x,y}})()`);
  evidence.resolutions=[];
  for(const [width,height]of (navigationOnly ? [] : [[800,600],[1920,1080],[3840,2160]])){
    await resize(width,height);const actual=await evaluate(s,`(async()=>{const root=document.querySelector('${shell}'),l=document.querySelector('${list}'),b=document.querySelector('${bar}'),left=document.querySelector('[data-source-control="lstMyItem"]'),box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,inside:r.left>=-.2&&r.top>=-.2&&r.right<=innerWidth+.2&&r.bottom<=innerHeight+.2}};
      const pictures=[...root.querySelectorAll('[data-source-asset]')].filter(e=>e.dataset.sourceAsset);await Promise.all(pictures.map(e=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=reject;img.src='/'+e.dataset.sourceAsset;})));
      return {width:innerWidth,height:innerHeight,root:box(root),left:box(left),bar:box(b),products:[...l.querySelectorAll('[data-shop-product-id]')].map(e=>({id:Number(e.dataset.shopProductId),name:e.textContent,selected:e.getAttribute('aria-selected')})),leftCount:left.querySelectorAll('[data-shop-owned-instance]').length,leftBarHidden:left.querySelector('[data-shop-list-scrollbar]').hidden,images:pictures.map(e=>e.dataset.sourceAsset),page:l.clientHeight,document:l.scrollHeight};})()`);
    evidence.resolutions.push(actual);const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));
    assert(actual.root.inside&&actual.left.inside&&actual.bar.inside);assert.equal(actual.products.length,expected.length);assert.equal(actual.page,279);assert(actual.document>actual.page);assert(Math.abs(actual.bar.width-8.5*Math.min(width/800,height/600))<.2);for(const p of expected)assert(actual.products.some(row=>row.id===p.itemTableId&&row.name.includes(p.name)));
  }
  await resize(1920,1080);await evaluate(s,`window.shopScrollKeys=[];window.addEventListener('keydown',e=>window.shopScrollKeys.push('down:'+e.code));window.addEventListener('keyup',e=>window.shopScrollKeys.push('up:'+e.code))`);
  // Ordinary row End makes the last confirmed product reachable, and supplies the initial bottom position.
  await nativeClick(s,'[data-shop-product-id="'+expected[0].itemTableId+'"]');await key('End','End',35);await waitUntil(s,`document.activeElement.dataset.shopProductId==='${expected.at(-1).itemTableId}'`);
  evidence.lastProduct={id:expected.at(-1).itemTableId,focused:true};const initial=await metrics();assert(initial.scroll>0);
  if(!navigationOnly){
  const p=await point(up),arrowState=()=>evaluate(s,`(()=>{const e=document.querySelector('${up}');return {state:e.dataset.arrowState,capture:e.hasPointerCapture(1),scroll:document.querySelector('${list}').scrollTop}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'none',buttons:0,...p},s);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,modifiers:16,clickCount:1,...p},s);evidence.pressed=await arrowState();assert(evidence.pressed.capture&&evidence.pressed.state==='Pushed');
  const outside={x:p.x-70,y:p.y-20};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,...outside},s);evidence.outside=await arrowState();assert(evidence.outside.capture);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,modifiers:0,clickCount:1,...outside},s);evidence.release=await arrowState();assert(!evidence.release.capture&&evidence.release.state==='Normal');assert.equal(evidence.release.scroll,evidence.pressed.scroll);
  }
  const click=async selector=>{const q=await point(selector);await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'none',buttons:0,...q},s);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...q},s);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...q},s);};
  await click(up);evidence.arrowUp=await metrics();assert(Math.abs(evidence.arrowUp.scroll-Math.max(0,initial.scroll-42))<=1/1.8);await click(down);evidence.arrowDown=await metrics();assert(Math.abs(evidence.arrowDown.scroll-Math.min(evidence.arrowDown.document-evidence.arrowDown.page,evidence.arrowUp.scroll+42))<=1/1.8);
  const wp=await point(list);await command('Input.dispatchMouseEvent',{type:'mouseWheel',...wp,deltaX:0,deltaY:-5},s);await waitUntil(s,`document.querySelector('${list}').scrollTop<${evidence.arrowDown.scroll}`);evidence.wheel=await metrics();
  const t=await point(thumb);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,modifiers:16,clickCount:1,...t},s);evidence.thumbPressed=await metrics();assert(evidence.thumbPressed.capture);
  const moved={x:t.x-40,y:t.y-10};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,...moved},s);evidence.thumbMoved=await metrics();assert(evidence.thumbMoved.capture&&evidence.thumbMoved.scroll<evidence.thumbPressed.scroll);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,modifiers:0,clickCount:1,...moved},s);evidence.thumbRelease=await metrics();assert(!evidence.thumbRelease.capture&&evidence.thumbRelease.state==='Normal');
  await key('End','End',35);evidence.end=await metrics();assert(Math.abs(evidence.end.scroll-(evidence.end.document-evidence.end.page))<=1/1.8);await key('Home','Home',36);evidence.home=await metrics();assert.equal(evidence.home.scroll,0);
  await nativeClick(s,'[data-shop-category="Weapon"]');await waitUntil(s,`document.querySelector('[data-shop-category="Weapon"]').getAttribute('aria-pressed')==='true'`);evidence.weapon={count:await evaluate(s,`document.querySelectorAll('[data-shop-product-id]').length`)};
  await nativeClick(s,'[data-shop-category="Item"]');await waitUntil(s,`document.querySelectorAll('[data-shop-product-id]').length===${expected.length}`);evidence.returnItem=true;
  evidence.windowKeys=await evaluate(s,'window.shopScrollKeys');assert.deepEqual(evidence.windowKeys,[]);
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`document.activeElement.matches('[data-room-card-shop]')&&document.activeElement.matches(':enabled')`);evidence.close={strictShop:true};
  assert(network.every(n=>n.direction!=='sent'||n.payload?.operation==='QUERY'||['OwnedRoles','Inventory','RoleProfile'].includes(n.name)));evidence.noWrites=true;evidence.status='PASS';console.log('PASS shop list source scroll '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
