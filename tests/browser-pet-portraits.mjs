import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const require=createRequire(import.meta.url),WebSocket=require('ws'),{WsClient}=require('tsrpc'),{TransportDataUtil}=require('tsrpc-base-client');
const decoder=new WsClient(serviceProto,{server:'ws://127.0.0.1:3245',logger:undefined});
const network=[];
let serverLog='';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const waitingExitOnly=process.argv.includes('--waiting-reentry-exit');
const lifecycleOnly=waitingExitOnly||process.argv.includes('--lifecycle-only');
const layoutLifecycleOnly=lifecycleOnly||process.argv.includes('--layout-lifecycle');
const output='recovery/output/browser-pet-portraits-'+(waitingExitOnly?'waiting-reentry-exit-':lifecycleOnly?'lifecycle-only-':layoutLifecycleOnly?'layout-lifecycle-':'')+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-pet-portraits-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3245,vite:5405,cdp:9605},runId,layoutLifecycleOnly,lifecycleOnly,waitingExitOnly,scope:'Two ordinary pages Home pet2/pet1 with same tank1, authoritative petId/HP, real source local/remote portraits and fire expression, source rectangles800/1920/3840, Leave and Homepet1 re-entry; no purchase/restart/native or pose/event injection.'};
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
      return await evaluate(session, `(async()=>{const deadline=Date.now()+${timeout};while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#room-map-info')?.value+' tanks='+document.querySelector('#tank')?.options.length+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
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
async function nativeSelect(session, selector, value) {
  const index = await evaluate(session, `Array.from(document.querySelector(${JSON.stringify(selector)}).options).filter(o=>!o.disabled).findIndex(o=>o.value===${JSON.stringify(String(value))})`);
  assert(index >= 0, `${selector} option ${value}`);
  await nativeClick(session, selector);
  const press = async (key, code, windowsVirtualKeyCode) => {
    await command('Input.dispatchKeyEvent', {type:'keyDown',key,code,windowsVirtualKeyCode}, session);
    await command('Input.dispatchKeyEvent', {type:'keyUp',key,code,windowsVirtualKeyCode}, session);
  };
  await press('Home', 'Home', 36);
  for(let step=0;step<index;step++)await press('ArrowDown', 'ArrowDown', 40);
  await press('Enter', 'Enter', 13);
  await waitUntil(session, `document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(String(value))}`);
  assert.equal(await evaluate(session, `document.querySelector(${JSON.stringify(selector)}).value`), String(value));
}
async function startServer(){const start=serverLog.length;const env={...process.env,PORT:'3245',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'90'};delete env.MATCH_MIN_PLAYERS;server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});const deadline=Date.now()+15000;while(!serverLog.slice(start).includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(serverLog.slice(start).includes('Server started'),serverLog.slice(start));}
try {
  await startServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5405,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3245',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9605',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9605/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9605');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
ws.on('message',raw=>{const m=JSON.parse(String(raw));if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(m.method))return;const frame=m.params.response;if(frame.opcode!==2)return;const bytes=new Uint8Array(Buffer.from(frame.payloadData,'base64'));if(bytes.length===1&&bytes[0]===0)return;const received=m.method.endsWith('Received');let parsed;if(received)parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);else{const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');assert(envelope.isSucc);const service=decoder.serviceMap.id2Service[envelope.value.serviceId],payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);assert(payload.isSucc);parsed={isSucc:true,result:{type:service.type,service,...(service.type==='api'?{req:payload.value}:{msg:payload.value})}};}assert(parsed.isSucc);const r=parsed.result;if(['TankShop','Shop','OwnedRoles','RoleProfile','SelectRole','Account','CreateRoom','Cpu','Ready','Leave','RoomSnapshot','RoomEvent','PlayerInput'].includes(r.service.name))network.push({index:network.length,page:m.sessionId,direction:received?'received':'sent',name:r.service.name,kind:r.type,...(r.ret?{success:r.ret.isSucc,response:r.ret.isSucc?r.ret.res:r.ret.err}:{payload:r.msg??r.req})});});

  for(let index=0;index<(waitingExitOnly?1:2);index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5405',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  const ui=JSON.parse(await readFile('recovery/output/web-assets/ui.json','utf8')),sourcePet=JSON.parse(await readFile('recovery/output/pet-purchase-source-sol.json','utf8')).pet.values;store=new AccountStore(database);const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(r=>r.tankId===1&&r.part===0);
  for(const [index,page]of pages.entries()){const account=store.open(await evaluate(page.sessionId,`localStorage.getItem('cdtank-account-token')`));const base=new Map(Object.keys(native.base).map(k=>[Number(k),0])),tank=new Map(Object.keys(native.equipment).map(k=>[Number(k),0]));base.set(0,73);base.set(8,1);base.set(0x2c,600);base.set(0x34,5);base.set(0x3c,10);tank.set(0x1c,74);tank.set(0x24,1);tank.set(0x3c,100);tank.set(0x40,70);tank.set(0x4c,15);tank.set(0x50,30);tank.set(0x58,2001);const pet2=new Map(base);pet2.set(0,75);pet2.set(8,2);pet2.set(0x2c,700);pet2.set(0x34,20);pet2.set(0x3c,8);for(let i=0;i<6;i++){pet2.set(0x44+i*4,Number(sourcePet['Skill'+i]));pet2.set(0x5c+i*4,Number(sourcePet['SkillLv'+i]));}store.replaceRoleRecords(account.accountId,{base:[{name:'Fixture pet1',fields:base},{name:'Fixture 大麦pet2',fields:pet2}],equipment:[{name:'Fixture tank1',fields:tank}]});const bytes=new Uint8Array(0x170),v=new DataView(bytes.buffer);v.setUint32(0xa4,waitingExitOnly?75:index===0?73:75,true);v.setUint32(0xa8,74,true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});}store.close();store=undefined;evidence.fixture={ownedPets:[{instance:73,petId:1,maxHp:600},{instance:75,petId:2,maxHp:700}],sameTank1:74};
  const host=pages[0].sessionId,peer=pages[1]?.sessionId;
  async function select(s,id){await nativeClick(s,'[data-room-card-home]');await waitUntil(s,`document.querySelector('[data-role-tab="pet"]')`);await nativeClick(s,'[data-role-tab="pet"]');await waitUntil(s,`document.querySelector('[data-owned-role="${id}"]')?.matches(':enabled')`);await nativeClick(s,`[data-owned-role="${id}"]`);if(await evaluate(s,`document.querySelector('.home-role-use').dataset.selectedInstance!=='${id}'`))await nativeClick(s,'.home-role-use');await waitUntil(s,`document.querySelector('.home-role-use').dataset.selectedInstance==='${id}'`);await nativeClick(s,'[data-roles-close]');}
  await select(host,waitingExitOnly?73:75);if(!waitingExitOnly)await select(peer,73);evidence.homeRequests=network.filter(e=>e.name==='SelectRole');assert(evidence.homeRequests.some(e=>e.page===host&&e.payload?.kind==='pet'&&e.payload.instanceId===(waitingExitOnly?73:75)));if(!waitingExitOnly)assert(evidence.homeRequests.some(e=>e.page===peer&&e.payload?.kind==='pet'&&e.payload.instanceId===73));
  const world=s=>evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  async function shot(s,suffix){const result=await command('Page.captureScreenshot',{format:'png'},s);await writeFile(output+'-'+suffix+'.png',Buffer.from(result.data,'base64'));}
  async function create(){await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')`);await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world&&!document.querySelector('[data-room-create-dialog][open]')`);}
  const icon=(id)=>`[data-player-id="${id}"] [data-source-control^="picPlayerIcon"][role="img"]`;
  async function portrait(s,id,petId,local){const selector=icon(id),definition=ui.portraits.find(p=>p.petId===petId);await waitUntil(s,`document.querySelector(${JSON.stringify(selector)})?.dataset.petId==='${petId}'`);return evaluate(s,`(async()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),url=getComputedStyle(e).backgroundImage.slice(5,-2);const image=new Image();image.src=url;await image.decode();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const visible=r.width>0&&r.height>0&&!e.hidden&&getComputedStyle(e).display!=='none';return {petId:e.dataset.petId,tankId:e.dataset.tankId,expression:e.dataset.expression,url,decodedWidth:image.naturalWidth,decodedHeight:image.naturalHeight,visible,expected:${JSON.stringify(local?definition.asset:definition.remoteAsset)}}})()`);}
  if(!waitingExitOnly){
  await create();const roomId=(await world(host)).roomId;await waitUntil(peer,`document.querySelector('[data-room-card-id="${roomId}"]')?.matches(':enabled')`);await command('Page.bringToFront',{},peer);const point=await evaluate(peer,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);for(const type of ['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,button:'left',clickCount:2,...point},peer);await waitUntil(peer,`document.querySelector('#battle-status')?.dataset.world`);await nativeClick(host,'[data-add-cpu]');for(const s of [host,peer])await waitUntil(s,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.mapLoaded&&w.renderedPlayers===3})()`);for(const s of [peer,host]){await waitUntil(s,`document.querySelector('[data-waiting-ready]')?.matches(':enabled')`);await nativeClick(s,'[data-waiting-ready]');}for(const s of [host,peer])await waitUntil(s,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all([world(host),world(peer)]);const ownerId=evidence.initial[0].playerId,peerId=evidence.initial[1].playerId;for(const w of evidence.initial){const p=w.players.find(p=>p.id===ownerId),q=w.players.find(p=>p.id===peerId);assert.equal(p.petId,2);assert.equal(p.maxHp,700);assert.equal(q.petId,1);assert.equal(q.maxHp,600);assert.equal(p.tankId,q.tankId);assert(w.players.filter(p=>p.isCpu).every(p=>p.petId===undefined));}
  if(!layoutLifecycleOnly){
  evidence.portraits=await Promise.all([portrait(host,ownerId,2,true),portrait(peer,ownerId,2,false),portrait(host,peerId,1,false),portrait(peer,peerId,1,true)]);for(const p of evidence.portraits){assert(p.visible&&p.decodedWidth>0);assert(p.url.endsWith(p.expected));}await shot(host,'owner-pet2-normal');await shot(peer,'peer-remote-pet2');
  await evaluate(host,`window.portraitStates=[];const capture=()=>{const e=document.querySelector(${JSON.stringify(icon(ownerId))});if(e){const row={expression:e.dataset.expression,url:getComputedStyle(e).backgroundImage,at:performance.now()};if(window.portraitStates.at(-1)?.expression!==row.expression)window.portraitStates.push(row);}};capture();window.portraitObserver=new MutationObserver(capture);window.portraitObserver.observe(document.querySelector('#original-battle-hud'),{subtree:true,attributes:true,attributeFilter:['data-expression','style']});`);
  await command('Page.bringToFront',{},host);await evaluate(host,`document.activeElement?.blur()`);await command('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32},host);await waitUntil(host,`document.querySelector(${JSON.stringify(icon(ownerId))}).dataset.expression==='attack'`,5000);evidence.attack=await portrait(host,ownerId,2,true);assert(evidence.attack.url.endsWith(ui.portraits.find(p=>p.petId===2).expressions.attack));await shot(host,'owner-pet2-attack');await command('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32},host);assert(network.some(e=>e.page===host&&e.name==='RoomEvent'&&e.direction==='received'&&e.payload.type==='fire'&&e.payload.playerId===ownerId));
  await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.find(p=>p.id==='${ownerId}').hp<700`,20000);evidence.naturalHit=await Promise.all([world(host),world(peer)]);evidence.expressions=await evaluate(host,`window.portraitStates`);const snapshots=network.filter(e=>e.name==='RoomSnapshot'&&e.direction==='received');const shared=snapshots.find(a=>a.page===host&&a.payload.players.find(p=>p.id===ownerId)?.hp<700&&snapshots.some(b=>b.page===peer&&b.payload.tick===a.payload.tick&&JSON.stringify(b.payload.players.find(p=>p.id===ownerId))===JSON.stringify(a.payload.players.find(p=>p.id===ownerId))));assert(shared,'Same target petId/HP must match on both connections');evidence.sharedTarget={tick:shared.payload.tick,owner:shared.payload.players.find(p=>p.id===ownerId),peer:snapshots.find(b=>b.page===peer&&b.payload.tick===shared.payload.tick).payload.players.find(p=>p.id===ownerId)};
  }else evidence.reusedCore='browser-pet-portraits-2026-10-04T13-04-51-712Z.json';
  if(!lifecycleOnly){
  evidence.sizes=[];const layout=ui.layouts.find(l=>l.path==='ui/layouts/game_main.xml');for(const[width,height]of [[800,600],[1920,1080],[3840,2160]]){const scale=Math.min(width/800,height/600);await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},host);await waitUntil(host,`document.querySelector('#original-battle-hud').style.transform==='scale(${scale})'`);const controls=await evaluate(host,`(()=>{const h=document.querySelector('#original-battle-hud').getBoundingClientRect();return [...document.querySelectorAll('#original-battle-hud [data-source-control]')].filter(e=>e.dataset.sourceControl.startsWith('picPlayerIcon')&&!e.dataset.sourceControl.includes('Bg')&&e.getAttribute('role')==='img'&&!e.hidden&&e.dataset.petId!==undefined).map(e=>{const r=e.getBoundingClientRect();return{name:e.dataset.sourceControl,x:r.x-h.x,y:r.y-h.y,width:r.width,height:r.height,petId:e.dataset.petId,url:getComputedStyle(e).backgroundImage}})})()`);evidence.sizes.push({width,height,scale,controls});for(const c of controls){let source=layout.windows.find(w=>w.name===c.name),rect=source.properties.AbsoluteRect.match(/-?[0-9]+(?:[.][0-9]+)?/g).map(Number),x=rect[0],y=rect[1];for(let parent=source.parent;parent;){const p=layout.windows.find(w=>w.name===parent),r=p.properties.AbsoluteRect.match(/-?[0-9]+(?:[.][0-9]+)?/g).map(Number);x+=r[0];y+=r[1];parent=p.parent;}for(const[k,v]of Object.entries({x,y,width:rect[2]-rect[0],height:rect[3]-rect[1]}))assert(Math.abs(c[k]-v*scale)<1,`${c.name} ${k}: ${c[k]} expected ${v*scale}`);}await shot(host,'portraits-'+width);}
  await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},host);await waitUntil(host,`document.querySelector('#original-battle-hud').style.transform==='scale(1.2)'`);
  }else evidence.reusedLayout='browser-pet-portraits-layout-lifecycle-2026-10-04T13-09-09-391Z.json';
  for(const s of [peer,host]){await nativeClick(s,'[data-battle-play-summary]');await nativeClick(s,'[data-leave-room]');await waitUntil(s,`!document.querySelector('#battle-status').dataset.world&&document.querySelector('#original-battle-hud').hidden`);}evidence.leaveCleanup=await Promise.all([host,peer].map(s=>evaluate(s,`({hidden:document.querySelector('#original-battle-hud').hidden,images:document.querySelectorAll('#original-battle-hud [role="img"]').length,players:document.querySelectorAll('#original-battle-hud [data-player-id]').length})`)));for(const c of evidence.leaveCleanup)assert(c.hidden&&c.images===0&&c.players===0);
  }else evidence.reusedLifecycle='browser-pet-portraits-lifecycle-only-2026-10-04T13-13-34-434Z.json';
  if(!waitingExitOnly)await select(host,73);evidence.changedPet=network.filter(e=>e.page===host&&e.name==='SelectRole').slice(-2);assert(evidence.changedPet.some(e=>e.payload?.kind==='pet'&&e.payload.instanceId===73));await create();await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players[0].petId===1`);evidence.reentered=await world(host);const newId=evidence.reentered.playerId;assert.equal(evidence.reentered.players.find(p=>p.id===newId).tankId,1);assert.equal(evidence.reentered.players.find(p=>p.id===newId).maxHp,600);evidence.newPortrait=await portrait(host,newId,1,true);assert(evidence.newPortrait.url.endsWith(ui.portraits.find(p=>p.petId===1).asset));assert(evidence.newPortrait.visible);await shot(host,'reentered-pet1');await nativeClick(host,'[data-waiting-close]');await waitUntil(host,`!document.querySelector('#battle-status').dataset.world&&document.querySelector('#original-battle-hud').hidden&&document.querySelectorAll('#original-battle-hud [role="img"],#original-battle-hud [data-player-id]').length===0`);evidence.finalCleanup=true;evidence.status='PASS';console.log('PASS: '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)for(const[i,p]of pages.entries()){const result=await command('Page.captureScreenshot',{format:'png'},p.sessionId).catch(()=>null);if(result)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(result.data,'base64'));}throw error;}
finally{evidence.network=network;await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'.log',serverLog);store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
