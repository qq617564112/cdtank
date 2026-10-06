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
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3431',logger:undefined});
const network=[];
let serverLog='';
const navigationOnly=process.argv.includes('--navigation-only');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-shop-mend-source-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-pet-details-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const fixture=JSON.parse(await readFile('recovery/output/home-tank-active-marker-browser-fixture.json','utf8'));
const checkpoint=fixture.database??'recovery/output/home-tank-active-marker-browser.sqlite';await copyFile(checkpoint,database);
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3431,vite:5462,cdp:9665},runId,scope:'UI54 original67controls and confirmed owned directory; readonly marker checkpoint, no repair/BUY/room/gameplay.',checkpoint:{source:checkpoint,copied:true,originalModified:false,originalFundsFixture:true}};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3431',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5462,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3431',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9665',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9665/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9665');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(fixture.token)+');'},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5462'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const s=pages[0].sessionId;



  assert.equal(await evaluate(s,`localStorage.getItem('cdtank-account-token')`),fixture.token);
  await nativeClick(s,'[data-room-card-shop]');await waitUntil(s,`document.querySelector('[data-shop-root-category="Mend"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-root-category="Mend"]');await waitUntil(s,`document.querySelector('[data-mend-shop-page]')?.getAttribute('aria-busy')==='false'&&document.querySelectorAll('[data-mend-owned-instance]').length===2`);
  const roles=network.filter(r=>r.name==='OwnedRoles'&&r.success).at(-1).response;
  const expected=roles.equipment.map(r=>({id:new Map(r.fields).get(0x1c),name:r.name}));assert.equal(expected.length,2);
  const account=network.filter(r=>r.name==='RoleProfile'&&r.success).at(-1).response;const profileBytes=new DataView(Uint8Array.from(account.profile.bytes).buffer);
  evidence.expected={owned:expected,money:profileBytes.getUint32(0x70,true),tokens:profileBytes.getUint32(0x74,true)};
  evidence.resolutions=[];
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);
    await waitUntil(s,`Math.abs(document.querySelector('.shop-source-stage').getBoundingClientRect().width-625*Math.min(${width}/800,${height}/600))<.2`);
    const actual=await evaluate(s,`(async()=>{const d=document.querySelector('[data-mend-shop-page]');await Promise.all([...d.querySelectorAll('[data-source-asset]')].filter(e=>e.dataset.sourceAsset).map(e=>new Promise((r,j)=>{const i=new Image();i.onload=r;i.onerror=j;i.src='/'+e.dataset.sourceAsset;})));return {width:innerWidth,height:innerHeight,controls:[...d.querySelectorAll('[data-source-control]')].map(e=>{const r=e.getBoundingClientRect();return {name:e.dataset.sourceControl,hidden:e.hidden,inside:e.hidden||r.left>=-.2&&r.top>=-.2&&r.right<=innerWidth+.2&&r.bottom<=innerHeight+.2}}),frames:d.querySelectorAll('[data-source-frame]').length,owned:[...d.querySelectorAll('[data-mend-owned-instance]')].map(e=>({id:Number(e.dataset.mendOwnedInstance),name:e.textContent})),money:Number(d.querySelector('[data-source-control="txtMoney"]').textContent),tokens:Number(d.querySelector('[data-source-control="txtCoin"]').textContent),quantity:Number(d.querySelector('[data-source-control="txtListQuantity"]').textContent),repairs:[...d.querySelectorAll('[data-mend-repair]')].map(e=>({disabled:e.disabled,binding:e.dataset.mendRepairBinding})),costs:[...d.querySelectorAll('[data-source-control]')].filter(e=>/^txt(?:Coin|Money)\d/.test(e.dataset.sourceControl)).map(e=>e.textContent)};})()`);
    assert.equal(actual.controls.length,67);assert(actual.controls.every(c=>c.inside));assert.deepEqual(actual.owned,expected);assert.equal(actual.money,evidence.expected.money);assert.equal(actual.tokens,evidence.expected.tokens);assert.equal(actual.quantity,2);assert.equal(actual.repairs.length,6);assert(actual.repairs.every(e=>e.disabled&&e.binding==='unbound'));assert.equal(actual.costs.length,6);assert(actual.costs.every(c=>c===''));evidence.resolutions.push(actual);
    const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('.shop-source-stage').getBoundingClientRect().width-1125)<.2`);
  await evaluate(s,`window.mendEscapedKeys=[];window.addEventListener('keydown',e=>window.mendEscapedKeys.push(e.code));`);
  await nativeClick(s,'[data-mend-owned-instance="'+expected[0].id+'"]');
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowDown',code:'ArrowDown',windowsVirtualKeyCode:40},s);
  await waitUntil(s,`document.activeElement.dataset.mendOwnedInstance==='${expected[1].id}'&&document.activeElement.getAttribute('aria-selected')==='true'`);evidence.selection={secondKeyboard:true,keys:await evaluate(s,'window.mendEscapedKeys')};assert.deepEqual(evidence.selection.keys,[]);
  await nativeClick(s,'[data-mend-select-page="Part"]');evidence.parts=[];
  for(const category of ['Common','Hat','Mark']){await nativeClick(s,'[data-mend-category="'+category+'"]');const actual=await evaluate(s,`({category:document.querySelector('[data-mend-category="${category}"]').getAttribute('aria-pressed'),count:document.querySelectorAll('[data-mend-owned-instance]').length,quantity:document.querySelector('[data-source-layout="ui/layouts/shop_mendpage.xml"][data-source-control="txtListQuantity"]').textContent})`);assert.equal(actual.category,'true');assert.equal(actual.count,0);assert.equal(actual.quantity,'0');evidence.parts.push({categoryName:category,...actual});}
  await nativeClick(s,'[data-mend-select-page="Tank"]');await waitUntil(s,`document.querySelectorAll('[data-mend-owned-instance]').length===2`);
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`document.activeElement.matches('[data-room-card-shop]')&&document.activeElement.matches(':enabled')`);evidence.close={strictShop:true};
  assert(network.every(r=>r.direction!=='sent'||r.payload?.operation==='QUERY'||['OwnedRoles','Inventory','RoleProfile'].includes(r.name)));evidence.noWrites=true;evidence.status='PASS';console.log('PASS shop mend readonly source '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
