import {connectBreachAuxiliary} from './helpers/breach-auxiliary.mjs';
import {installMap02EnvironmentObserver} from './observers/map02-environment-prepared-browser.mjs';
import {installMap02FullSessionObserver} from './observers/map02-full-session-browser.mjs';
import {installMap02ReconnectOwnerObserver} from './observers/map02-reconnect-owner-prepared-browser.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
const WebSocket=createRequire(import.meta.url)('ws');
const directory=await mkdtemp(join(tmpdir(),'cdtank-map02-reconnect-'));
const database=join(directory,'accounts.sqlite');
const output='recovery/output/browser-map02-active-reconnect-'+new Date().toISOString().replace(/[:.]/g,'-');
let server,chrome,vite,ws,store,aux,serverLog='';
const pages=[],contexts=[],connectionEvents=[];
const evidence={status:'RUNNING',ports:{server:3604,vite:5634,cdp:9834},mapId:2,modeId:1,
 scope:'Formal dual React pages, ordinary Create/Join/Ready/input, fixed Map02 mode1, two passive authenticated auxiliary accounts. Explicit original tank1/pet1 pre-room fixture. Actual browser WebSocket close under two seconds of CDP offline transport, automatic same-room same-player reconnect, resumed ordinary W input, dual complete state and normal Leave. No gameplay/camera/clock injection or new draw/audio/pixel gate. Reconstructed reconnection policy.'};
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
  await command('Page.bringToFront', {}, session);
  const point = await evaluate(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
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
try {
  const env={...process.env,PORT:'3604',ACCOUNT_DB_PATH:database};delete env.MATCH_MIN_PLAYERS;delete env.MATCH_TIME_LIMIT_SECONDS;
  server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});
  const deadline=Date.now()+15000;while(!serverLog.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(serverLog.includes('Server started'),serverLog);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5634,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3604',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9834',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9834/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9834');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  if (['Network.webSocketClosed', 'Network.webSocketFrameError'].includes(message.method)) connectionEvents.push({method: message.method, sessionId: message.sessionId, params: message.params, at: Date.now()});
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});

  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Network.enable',{},sessionId);
    await command('Page.navigate',{url:'http://127.0.0.1:5634'},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  store=new AccountStore(database);const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(r=>r.tankId===1&&r.part===0);
  for(const [index,page]of pages.entries()){
    const account=store.open(await evaluate(page.sessionId,`localStorage.getItem('cdtank-account-token')`));
    const fields=v=>new Map(Object.entries(v).map(([k,v])=>[Number(k),v]));
    const equipment={name:'明确导入原战车',fields:fields(native.equipment)},base={name:'明确导入原宠物',fields:fields(native.base)};
    equipment.fields.set(0x1c,72);equipment.fields.set(0x24,1);equipment.fields.set(0x28,index?10021:10011);equipment.fields.set(0x2c,index?10022:10012);equipment.fields.set(0x30,index?10023:10013);
    store.replaceRoleRecords(account.accountId,{base:[base],equipment:[equipment]});

    const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa8,72,true);view.setUint32(0xa4,base.fields.get(0),true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
  }
  store.close();store=undefined;
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  for(const page of pages){await nativeClick(page.sessionId,'[data-room-card-home]');await waitUntil(page.sessionId,`document.querySelector('#home-inventory[open] [data-source-control="btnClose"]')`);await nativeClick(page.sessionId,'[data-home-close]');await waitUntil(page.sessionId,`!document.querySelector('#home-inventory[open]')`);}
  for(const page of pages){
    await evaluate(page.sessionId,'('+installMap02EnvironmentObserver.toString()+')()');
    await evaluate(page.sessionId,'('+installMap02FullSessionObserver.toString()+')()');
    await evaluate(page.sessionId,'('+installMap02ReconnectOwnerObserver.toString()+')()');

  }
  const world=session=>evaluate(session,"JSON.parse(document.querySelector('#battle-status').dataset.world)");
  async function createJoin(){
    await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="${1}"]')`);await nativeClick(host,'[data-map-selector-mode="'+1+'"]');await nativeClick(host,'[data-map-selector-map="2"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);await nativeClick(host,'[data-room-create-confirm]');
    await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
    const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
    await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
    const point=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...point},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...point},guest);
    await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
    aux=await connectBreachAuxiliary('ws://127.0.0.1:3604',roomId,2);
    evidence.auxiliaryPlayers=aux.members.map(m=>({playerId:m.playerId}));
    return roomId;
  }
  async function ready(){
    await aux.ready((await world(host)).match.round);
    for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4&&document.querySelector('[data-waiting-ready]')?.matches(':enabled')})()`,90000);
    for(const session of [guest,host])await nativeClick(session,'[data-waiting-ready]');
    for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`,90000);
  }

  const capture=async label=>{const rows=[];for(const page of pages)rows.push(await evaluate(page.sessionId,'window.captureMap02ReconnectOwners('+JSON.stringify(label)+')'));return rows;};
  await createJoin();await ready();
  evidence.before=await Promise.all(pages.map(page=>world(page.sessionId)));
  evidence.ownerBefore=await capture('before-loss');
  assert(evidence.before.every(value=>value.roomId===evidence.before[0].roomId&&value.phase==='PLAYING'));
  await command('Page.bringToFront',{},host);await nativeClick(host,'#world');
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87},host);
  await new Promise(resolve=>setTimeout(resolve,700));
  const preLoss=await world(host);evidence.beforeLoss=preLoss;
  await command('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1},host);
  await evaluate(host,"(()=>{const socket=window.map02Battle.client._wsp._ws;if(socket?.readyState===WebSocket.OPEN)socket.close(4000,'transport interruption acceptance');})()");
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87},host);
  await waitUntil(host,"window.map02Battle.reconnecting===true",10000);
  evidence.disconnected=await evaluate(host,"({active:window.map02Battle.active,reconnecting:window.map02Battle.reconnecting,connected:window.map02Battle.isConnected,inputTimerActive:window.map02Battle.input.timer!==undefined,owners:window.captureMap02ReconnectOwners('disconnected')})");
  assert.equal(evidence.disconnected.active,true);assert.equal(evidence.disconnected.inputTimerActive,false);
  await new Promise(resolve=>setTimeout(resolve,2000));
  await command('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1},host);
  await waitUntil(host,"window.map02Battle.active&&window.map02Battle.isConnected&&!window.map02Battle.reconnecting&&JSON.parse(document.querySelector('#battle-status').dataset.world||'null')?.tick>"+preLoss.tick,35000);
  evidence.resumed=await Promise.all(pages.map(page=>world(page.sessionId)));
  evidence.ownerResumed=await capture('same-room-restored');
  for(const [index,after] of evidence.resumed.entries()){
    assert.equal(after.roomId,evidence.before[index].roomId);assert.equal(after.playerId,evidence.before[index].playerId);assert.equal(after.match.round,1);
    for(const key of ['battleOwner','sceneOwner','previewOwner','previewRevision','plantOwner','waterOwner','soundOwner','soundRevision'])assert.equal(evidence.ownerResumed[index][key],evidence.ownerBefore[index][key],key);
    assert.deepEqual(evidence.ownerResumed[index].voices.map(voice=>[voice.id,voice.audioOwner]),evidence.ownerBefore[index].voices.map(voice=>[voice.id,voice.audioOwner]));
  }
  const recovered=await world(host),local=recovered.players.find(player=>player.id===recovered.playerId);
  await nativeClick(host,'#world');await command('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87},host);
  await new Promise(resolve=>setTimeout(resolve,1200));await command('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87},host);
  await waitUntil(host,"JSON.parse(document.querySelector('#battle-status').dataset.world).tick>"+(recovered.tick+5));
  evidence.afterInput=await world(host);const moved=evidence.afterInput.players.find(player=>player.id===recovered.playerId);assert(Math.hypot(moved.x-local.x,moved.z-local.z)>1);
  const observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.map02Session')));
  const key=row=>`${row.match.round}/${row.phase}/${row.tick}`;const peer=new Map(observed[1].recentSnapshots.map(row=>[key(row),row]));let common=0;
  for(const row of observed[0].recentSnapshots){const remote=peer.get(key(row));if(remote){assert.deepEqual(row.players,remote.players);assert.deepEqual(row.match,remote.match);common++;}}assert(common>0);evidence.commonCompleteStates=common;
  await aux.leave((await world(host)).match.round);
  evidence.normalLeave=[];
  for(const page of pages){
    const session=page.sessionId;
    await waitUntil(session,`document.querySelector('[data-leave-room], [data-summary-leave]')?.matches(':enabled')`);
    const selector=await evaluate(session,`document.querySelector('[data-summary-leave]')?'[data-summary-leave]':'[data-leave-room]'`);
    await nativeClick(session,selector);
    await waitUntil(session,"!document.querySelector('#battle-status').dataset.world",30000);
    evidence.normalLeave.push(await evaluate(session,"({active:window.map02Battle.active,world:document.querySelector('#battle-status').dataset.world??null,players:window.map02Battle.players.size,inputTimerActive:window.map02Battle.input.timer!==undefined,owners:window.captureMap02ReconnectOwners('normal-leave')})"));
  }
  assert(evidence.normalLeave.every(value=>!value.active&&value.world===null&&value.players===0&&!value.inputTimerActive));
  evidence.status='PASS_FINITE_FIXED_MAP02_AUTOMATIC_SAME_ROOM_RECONNECT_INPUT_OWNER_LEAVE';
  console.log(evidence.status+': '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);throw error;}
finally{
 if(ws){evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.map02Session').catch(error=>({error:String(error)}))));evidence.owners=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.map02ReconnectOwners').catch(error=>({error:String(error)}))));evidence.environment=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.map02Environment').catch(error=>({error:String(error)}))));}
 evidence.connectionEvents=connectionEvents;store?.close();
 if(ws){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
 await aux?.disconnect();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
 evidence.cleanup={serverExit:server?.exitCode,chromeExit:chrome?.exitCode,tempRemoved:true};await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');await writeFile(output+'-server.log',serverLog);
}
