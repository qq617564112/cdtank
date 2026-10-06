import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {DatabaseSync, backup} from 'node:sqlite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3429',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-home-pet-skill-source-page-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-home-pet-details-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];

const evidence={status:'RUNNING',ports:{server:3429,vite:5460,cdp:9663},runId,scope:'UI35 original14control skill page from confirmed OwnedRoles id/level and exactmetadata; funds-only profile + one actual pet2 BUY context; no learning/SelectRole/gameplay.'};
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
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3429',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'12'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5460,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3429',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9663',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9663/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9663');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['Equipment','OwnedRoles','Inventory','Shop','TankShop','SelectRole','PetShop'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<1;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Page.enable',{},sessionId);await command('Network.enable',{},sessionId);await command('Page.navigate',{url:'http://127.0.0.1:5460'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const s=pages[0].sessionId;

  store=new AccountStore(database);const account=store.open(await evaluate(s,`localStorage.getItem('cdtank-account-token')`));
  const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0x70,10000,true);view.setUint32(0x74,1000,true);
  store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});store.close();store=undefined;
  evidence.fixture={initialMoney:10000,initialTokens:1000,initialOwnedPets:0,rolesNotImported:true};
  await nativeClick(s,'[data-room-card-shop]');await waitUntil(s,`document.querySelector('[data-shop-root-category="Pet"]')?.matches(':enabled')`);
  await nativeClick(s,'[data-shop-root-category="Pet"]');await waitUntil(s,`document.querySelector('[data-pet-shop-product-id="2"]')?.matches(':enabled')`);
  for(const petId of [2]){
    await nativeClick(s,'[data-pet-shop-product-id="'+petId+'"]');await waitUntil(s,`document.querySelector('[data-pet-shop-buy]')?.matches(':enabled')`);
    await nativeClick(s,'[data-pet-shop-buy]');await waitUntil(s,`document.querySelector('[data-pet-shop-status]')?.textContent.includes('已购买')&&document.querySelector('[data-pet-shop-buy]')?.matches(':enabled')`);
  }
  await nativeClick(s,'[data-shop-close]');await waitUntil(s,`document.activeElement.matches('[data-room-card-shop]')`);
  await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('[data-home-name-open]')?.matches(':enabled')`);
  await nativeClick(s,'#home-inventory [data-role-tab="pet"]');await waitUntil(s,`document.querySelectorAll('#home-roles [data-owned-role]').length===1`);
  const owned=network.filter(row=>row.name==='OwnedRoles'&&row.success).at(-1).response.base;assert.equal(owned.length,1);const record=owned[0],fields=new Map(record.fields);await nativeClick(s,'#home-roles [data-owned-role="'+fields.get(0)+'"]');await waitUntil(s,`document.querySelector('[data-home-pet-view-skill="1"]')?.matches(':enabled')`);
  const skillId=fields.get(0x48),level=fields.get(0x60);evidence.confirmed={instanceId:fields.get(0),skillId,level};
  const token=await evaluate(s,`localStorage.getItem('cdtank-account-token')`);const checkpoint='recovery/output/home-pet-skill-source-browser.sqlite';const db=new DatabaseSync(database,{readOnly:true});try{await backup(db,checkpoint);}finally{db.close();}await writeFile('recovery/output/home-pet-skill-source-browser-fixture.json',JSON.stringify({token,accountId:account.accountId,database:checkpoint,confirmed:evidence.confirmed})+'\n',{mode:0o600});evidence.fixtureSaved={sqliteBackup:true,restored:false};
  async function key(key,code,vk,text){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:vk,...(text?{text}:{})},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:vk},s);}
  await nativeClick(s,'[data-home-pet-view-skill="1"]');await waitUntil(s,`document.querySelector('[data-pet-skill-dialog]')?.open&&document.activeElement.matches('[data-pet-skill-close]')`);evidence.resolutions=[];
  for(const [width,height] of [[800,600],[1920,1080],[3840,2160]]){
    await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('[data-pet-skill-dialog]').getBoundingClientRect().width-800*Math.min(${width}/800,${height}/600))<.2`);
    const actual=await evaluate(s,`(async()=>{const d=document.querySelector('[data-pet-skill-dialog]'),box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,inside:r.left>=-.2&&r.top>=-.2&&r.right<=innerWidth+.2&&r.bottom<=innerHeight+.2}};await Promise.all([...d.querySelectorAll('[data-source-asset]')].filter(e=>e.dataset.sourceAsset).map(e=>new Promise((r,j)=>{const i=new Image();i.onload=r;i.onerror=j;i.src='/'+e.dataset.sourceAsset;})));const catalog=await(await fetch('/combat-catalog.json')).json(),skill=catalog.skills.find(s=>s.skillId===Number(d.dataset.skillId));return {width:innerWidth,height:innerHeight,skillId:Number(d.dataset.skillId),name:d.querySelector('[data-source-control="txtSkillName"]').textContent,level:Number(d.querySelector('[data-source-control="txtLv"]').textContent),info:d.querySelector('[data-pet-skill-description]').textContent,expected:skill,controls:[...d.querySelectorAll('[data-source-control]')].map(e=>({name:e.dataset.sourceControl,box:box(e)})),frames:d.querySelectorAll('[data-source-frame]').length,learnDisabled:d.querySelector('[data-pet-skill-learn]').disabled,next:d.querySelector('[data-source-control="edtNextSkillDesc"]').textContent,cost:d.querySelector('[data-source-control="txtTechExpense"]').textContent};})()`);
    assert.equal(actual.controls.length,14);assert(actual.controls.every(c=>c.box.inside));assert.equal(actual.skillId,skillId);assert.equal(actual.level,level);assert.equal(actual.name,actual.expected.name);assert.equal(actual.info,actual.expected.info);assert(actual.learnDisabled);assert.equal(actual.next,'');assert.equal(actual.cost,'');delete actual.expected;evidence.resolutions.push(actual);const shot=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+width+'.png',Buffer.from(shot.data,'base64'));
  }
  await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},s);await waitUntil(s,`Math.abs(document.querySelector('[data-pet-skill-dialog]').getBoundingClientRect().width-1440)<.2`);await evaluate(s,`window.petSkillKeys=[];window.addEventListener('keydown',e=>window.petSkillKeys.push(e.code));`);
  const selector='[data-pet-skill-close]',point=await evaluate(s,`(()=>{const r=document.querySelector('${selector}').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`),read=()=>evaluate(s,`(()=>{const e=document.querySelector('${selector}');return {state:e.dataset.sourceButtonState,capture:e.hasPointerCapture(1),open:document.querySelector('[data-pet-skill-dialog]').open}})()`);
  await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'none',buttons:0,...point},s);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,modifiers:16,clickCount:1,...point},s);await waitUntil(s,`document.querySelector('${selector}').dataset.sourcePushed==='true'`);evidence.pressed=await read();assert(evidence.pressed.capture);const outside={x:point.x+160,y:point.y-130};await command('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,modifiers:16,...outside},s);evidence.outside=await read();await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...outside},s);await waitUntil(s,`document.querySelector('${selector}').dataset.sourcePushed==='false'`);evidence.release=await read();assert.equal(evidence.release.state,'Normal');assert(!evidence.release.capture&&evidence.release.open);
  await key('Escape','Escape',27);await waitUntil(s,`!document.querySelector('[data-pet-skill-dialog]')&&document.activeElement.matches('[data-home-pet-view-skill="1"]')`);evidence.escape={keys:await evaluate(s,'window.petSkillKeys'),sameViewButton:true};assert.deepEqual(evidence.escape.keys,[]);
  await nativeClick(s,'[data-home-pet-view-skill="0"]');await waitUntil(s,`document.querySelector('[data-pet-skill-dialog]')?.dataset.skillId==='${fields.get(0x44)}'`);await key('Enter','Enter',13,'\r');await waitUntil(s,`!document.querySelector('[data-pet-skill-dialog]')&&document.activeElement.matches('[data-home-pet-view-skill="0"]')`);evidence.secondSkillKeyboard={skillId:fields.get(0x44),sameViewButton:true};
  await nativeClick(s,'[data-roles-close]');await waitUntil(s,`document.activeElement.matches('[data-room-card-home]')&&document.activeElement.matches(':enabled')`);assert(!network.some(r=>r.direction==='sent'&&['SelectRole','Equipment','CreateRoom','Join','Ready'].includes(r.name)));evidence.noSelectionOrGameplay=true;evidence.status='PASS';console.log('PASS owned pet skill source page '+output);
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
