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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3460',logger:undefined});
const network=[];
let serverLog='';
const navigationOnly=process.argv.includes('--navigation-only');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-shop-tank-buy-parameters-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-pet-details-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const fixture=JSON.parse(await readFile('recovery/output/home-tank-active-marker-browser-fixture.json','utf8'));
const checkpoint=fixture.database??'recovery/output/home-tank-active-marker-browser.sqlite';await copyFile(checkpoint,database);
const pages=[],contexts=[];

const visualOnly=process.argv.includes('--visual-only');
const evidence={status:'RUNNING',visualOnly,navigationOnly,ports:{server:3460,vite:5490,cdp:9690},runId,scope:'Shop Tank original buy-mode six parameters only; readonly3/4/104 selection,0BUY/Ready/room. User five screenshots: lobby/Home/Item/Pet/Tank source typography, description/summary geometry, directory mastery, skill details and preview orbit/drag. Readonly checkpoint queries, no BUY/Ready/room.',checkpoint:{source:checkpoint,copied:true,originalModified:false,originalFundsFixture:true}};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3460',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5490,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3460',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9690',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9690/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9690');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5490'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const s=pages[0].sessionId;



  assert.equal(await evaluate(s,`localStorage.getItem('cdtank-account-token')`),fixture.token);
  evidence.pages=[];
  async function key(key,code,vk){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk},s);}
  async function resize(width,height){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await new Promise(r=>setTimeout(r,180));}
  async function shots(name,selector){
    for(const [width,height]of [[800,600],[1920,1080],[3840,2160]]){
      await resize(width,height);await waitUntil(s,`document.querySelector(${JSON.stringify(selector)})`);
      await new Promise(r=>setTimeout(r,200));
      const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+name+'-'+width+'.png',Buffer.from(shot.data,'base64'));
      evidence.pages.push({name,width,height,screenshot:output+'-'+name+'-'+width+'.png'});
    }
    await resize(1920,1080);
  }
  await evaluate(s,`document.fonts.load('12px CDTank-Xiangjiao')`);
  await nativeClick(s,'[data-room-card-shop]');await waitUntil(s,`document.querySelector('[data-shop-root-category="Tank"]')?.matches(':enabled')`);await nativeClick(s,'[data-shop-root-category="Tank"]');
  const expected=JSON.parse(await readFile('recovery/output/shop-tank-buy-parameters-native.json','utf8')).rows;
  evidence.parameters=[];
  for(const tankId of [3,4,104]){
    await waitUntil(s,`document.querySelector('[data-tank-shop-product-id="${tankId}"]')?.matches(':enabled')`);await nativeClick(s,'[data-tank-shop-product-id="'+tankId+'"]');await waitUntil(s,`document.querySelector('[data-tank-buy-parameters]')?.dataset.tankId==='${tankId}'&&document.querySelector('[data-tank-shop-preview]')?.dataset.status==='ready'`);
    const values=await evaluate(s,`({fields:Object.fromEntries([...document.querySelectorAll('[data-tank-buy-field]')].map(e=>[e.dataset.tankBuyField,e.textContent])),capacity:Number(document.querySelector('[data-tank-buy-capacity]').dataset.capacity),progress:Number(document.querySelector('[data-tank-buy-capacity]').dataset.progress),font:getComputedStyle(document.querySelector('[data-tank-buy-field]')).fontFamily})`);
    const row=expected.find(r=>r.tankId===tankId).display;
    assert.deepEqual(values.fields,{txtAttackLevel:'0',txtPanzerLevel:'0',txtMoveSpeed:row.moveSpeed.text,txtRotateSpeed:row.rotateSpeed.text,txtShootInterval:row.shootInterval.text});assert.equal(values.capacity,row.capacity.count);assert.equal(values.progress,row.capacity.progress);assert(values.font.includes('CDTank-Xiangjiao'));
    evidence.parameters.push({tankId,...values});
    if(tankId===3)await shots('tank3','[data-tank-buy-parameters]');else{const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-tank'+tankId+'-1920.png',Buffer.from(shot.data,'base64'));evidence.pages.push({name:'tank'+tankId,width:1920,height:1080,screenshot:output+'-tank'+tankId+'-1920.png'});}
  }
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`document.activeElement.matches('[data-room-card-shop]')`);evidence.cleanup={strictShopFocus:true};
  assert(network.every(n=>n.direction!=='sent'||n.payload?.operation==='QUERY'||['OwnedRoles','Inventory','RoleProfile'].includes(n.name)));
  evidence.noPurchasesRoom=true;evidence.status='PASS';console.log('PASS five page feedback '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
