import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3463',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-role-shop-source-list-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-role-shop-list-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3463,vite:5493,cdp:9693},runId,resolutions:[],screenshots:[],scope:'UI56/UI57/M5-10 confirmed Tank/Pet directory natural rows and source shell; six complete source pages, mouse/key candidate and Close focus; QUERY only, no BUY/Equip/room. Native dynamic columns/factory unproven.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3463',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5493,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3463',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9693',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9693/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9693');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['CreateRoom','Join','Leave','ExitRoom','Shop','TankShop','PetShop','SelectRole','Ready','Equip'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});


  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5493',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')?.matches(':enabled')&&localStorage.getItem('cdtank-account-token')`);
  }
  const session=pages[0].sessionId;
  async function press(key,code,windowsVirtualKeyCode,modifiers=0){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode,modifiers},session);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode,modifiers},session);}
  await nativeClick(session,'[data-room-card-shop]');
  await waitUntil(session,`document.querySelector('[data-shop-root-category="Tank"]')?.matches(':enabled')`);
  evidence.pages=[];
  for (const [kind,count] of [['tank',10],['pet',8]]) {
    await nativeClick(session,`[data-shop-root-category="${kind==='tank'?'Tank':'Pet'}"]`);
    const identity=`[data-${kind}-shop-product-id]`, list=`[data-role-shop-list="${kind}"]`;
    await waitUntil(session,`document.querySelectorAll('${identity}').length===${count}&&document.querySelector('${identity}')?.matches(':enabled')`);
    const record={kind,count,states:[],sizes:[]};evidence.pages.push(record);
    const read=()=>evaluate(session,`(()=>{const l=document.querySelector('${list}'),shell=l.parentElement,bar=shell.querySelector('[data-role-shop-list-scrollbar]');return {height:l.clientHeight,document:l.scrollHeight,width:l.clientWidth,scroll:l.scrollTop,barHidden:bar.hidden,rows:[...l.querySelectorAll('${identity}')].map(e=>({id:Number(e.dataset.${kind}ShopProductId),text:e.textContent,selected:e.getAttribute('aria-selected'),height:e.getBoundingClientRect().height})),binding:l.dataset.directoryBinding}})()`);
    record.initial=await read();assert.equal(record.initial.rows.length,count);assert.equal(record.initial.binding,'web-confirmed-shop-query');
    const query=network.filter(n=>n.direction==='received'&&n.name===(kind==='tank'?'TankShop':'PetShop')&&n.success).at(-1)?.response;
    assert(query);const products=query[kind==='tank'?'tanks':'pets'];assert.equal(products.length,count);
    assert.deepEqual(record.initial.rows.map(r=>r.id),products.map(p=>p[kind+'Id']));record.confirmedIds=products.map(p=>p[kind+'Id']);
    const target=record.initial.rows[1].id;await nativeClick(session,`[data-${kind}-shop-product-id="${target}"]`);
    await waitUntil(session,`document.querySelector('[data-${kind}-shop-product-id="${target}"]').getAttribute('aria-selected')==='true'`);
    await press('End','End',35);await waitUntil(session,`document.querySelector('${identity}[aria-selected="true"]').dataset.${kind}ShopProductId==='${record.initial.rows.at(-1).id}'`);record.states.push({action:'End',...(await read())});
    await press('Home','Home',36);await waitUntil(session,`document.querySelector('${identity}[aria-selected="true"]').dataset.${kind}ShopProductId==='${record.initial.rows[0].id}'`);record.states.push({action:'Home',...(await read())});
    await waitUntil(session,`document.querySelector('${kind==='tank'?'[data-tank-shop-preview]':'[data-shop-pet-preview]'}')?.dataset.status==='ready'`);
    for(const [width,height]of [[800,600],[1920,1080],[3840,2160]]) {
      await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
      await evaluate(session,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
      const size=await evaluate(session,`(()=>{const l=document.querySelector('${list}'),r=l.getBoundingClientRect(),scale=Math.min(innerWidth/800,innerHeight/600);return {width:innerWidth,height:innerHeight,list:{x:r.x,y:r.y,width:r.width,height:r.height,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight},scale,font:getComputedStyle(l).fontFamily}})()`);
      assert(size.list.inside);assert(Math.abs(size.list.width-192*size.scale)<1);assert(Math.abs(size.list.height-279*size.scale)<1);
      record.sizes.push(size);evidence.resolutions.push({kind,width,height});
      const shot=await command('Page.captureScreenshot',{format:'png'},session);const image=output+'-'+kind+'-'+width+'.png';await writeFile(image,Buffer.from(shot.data,'base64'));evidence.screenshots.push(image);
    }
    record.final=await read();assert.equal(record.final.barHidden,record.final.document<=record.final.height);
  }
  await nativeClick(session,'[data-shop-close]');
  await waitUntil(session,`!document.querySelector('#account-shop[open]')&&document.activeElement===document.querySelector('[data-room-card-shop]')`);
  evidence.strictShopOpener=true;
  assert(!network.some(n=>n.direction==='sent'&&['Shop','TankShop','PetShop'].includes(n.name)&&n.payload?.operation==='BUY'));
  assert(!network.some(n=>n.direction==='sent'&&['CreateRoom','Join','Ready','Leave','SelectRole','Equip'].includes(n.name)));evidence.noRoomOrAccountMutation=true;evidence.status='PASS';console.log('PASS role shop source lists '+output);

}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'-server.log',serverLog);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
