import {installMap02EnvironmentObserver} from './observers/map02-environment-prepared-browser.mjs';
import {installScenePlant02ContactObserver} from './observers/scene-plant02-contact-browser.mjs';
import {createRoomBattlefield} from '../apps/server/src/battlefield.ts';
import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation.ts';
import {findBotPath} from '../apps/server/src/battle/cpu/navigation.ts';
import {connectBreachAuxiliary} from './helpers/breach-auxiliary.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
const WebSocket=createRequire(import.meta.url)('ws');
const mapId=2;
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-plant02-contact-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-plant02-contact-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store,aux;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3593,vite:5623,cdp:9823},mapId:2,modeId:1,ammo:2001,scope:'Formal React four authenticated accounts, mode1/map2 new source327 ordinary NAV W/A/D contact. Authoritative scenePlantHidden transaction and fullsnapshot source-root hidden, movement/dual state/Leave; environmental initial load observer only. No old327 pixel gate, active injection, sound/effect addition or new source/native investigation. 1280x720.'};
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
  const env={...process.env,PORT:'3593',ACCOUNT_DB_PATH:database};delete env.MATCH_MIN_PLAYERS;delete env.MATCH_TIME_LIMIT_SECONDS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5623,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3593',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9823',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9823/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9823');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});

  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5623',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
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
    await evaluate(page.sessionId,'('+installScenePlant02ContactObserver.toString()+')()');
  }
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="1"]')`);await nativeClick(host,'[data-map-selector-mode="1"]');await nativeClick(host,`[data-map-selector-map="${mapId}"]`);await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
  const joinPoint=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...joinPoint},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...joinPoint},guest);
  await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
  aux=await connectBreachAuxiliary('ws://127.0.0.1:3593',roomId,2);
  evidence.auxiliaryPlayers=aux.members.map(m=>({playerId:m.playerId,accountId:m.accountId}));
  await aux.ready(1);
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);

  for(const session of [guest,host]){
    await waitUntil(session,"document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled");
    await nativeClick(session,'[data-waiting-ready]');
  }
  for(const page of pages)await waitUntil(page.sessionId,"JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'");
  const world=session=>evaluate(session,"JSON.parse(document.querySelector('#battle-status').dataset.world)");
  evidence.initial=await Promise.all(pages.map(p=>world(p.sessionId)));
  assert(evidence.initial.every(w=>w.mode===1&&w.mapId===2&&w.match.sceneObjects.filter(o=>o.id.startsWith('ENV:')).length===60&&w.match.sceneObjects.filter(o=>o.id.startsWith('CASTLE:')).length===2),'Formal map2 original Castle and named ENV identities coexist');
  assert(evidence.initial.every(w=>w.match.scenePlants?.length===29),'All29 original Map02 Plant snapshot identities');
  const placements=JSON.parse(await readFile('recovery/output/web-assets/scene-placements.json','utf8')).find(value=>value.id==='0002');
  const target=placements.records.find(value=>value.id==='327'&&value.className==='SYcScnObjPlant');
  assert(target);evidence.target=target;
  const goal={x:target.matrix[12],y:target.position[1],z:target.matrix[14]};
  const field=createRoomBattlefield(2),navigation=createOriginalBotNavigation(field);
  const ready=new Set(),held=new Map(pages.map(p=>[p.sessionId,new Set()]));
  async function setKeys(session,keys){
    const previous=held.get(session);
    for(const code of new Set([...previous,...keys])){
      if(previous.has(code)===keys.has(code))continue;
      await command('Input.dispatchKeyEvent',{type:keys.has(code)?'keyDown':'keyUp',code,key:code==='Space'?' ':code.startsWith('Key')?code.slice(3).toLowerCase():code,windowsVirtualKeyCode:({Space:32,KeyW:87,KeyS:83,KeyA:65,KeyD:68,ArrowLeft:37,ArrowRight:39})[code]},session);
    }
    held.set(session,keys);
  }
  evidence.inputs=[];
  for(const page of pages)await nativeClick(page.sessionId,'#world');
  console.log('Formal map0002/mode1 four authenticated accounts PLAYING');
  const routeDeadline=Date.now()+60000;
  while(Date.now()<routeDeadline){
    await command('Page.bringToFront',{},host);
    const w=await world(host),me=w.players.find(p=>p.id===w.playerId),state=w.match.scenePlants.find(p=>p.sourcePlacementId==='327');
    if(state?.hidden){evidence.hiddenWorld=w;break;}
    if(w.phase!=='PLAYING'||!me.alive)break;
    const path=findBotPath(field,{x:me.x,y:me.y,z:me.z},goal,navigation);
    const point=path.find(p=>Math.hypot(p.x-me.x,p.z-me.z)>25)??goal;
    const bearing=Math.atan2(point.x-me.x,point.z-me.z),turn=Math.atan2(Math.sin(bearing-me.yaw),Math.cos(bearing-me.yaw));
    const keys=new Set();if(Math.abs(turn)>.07)keys.add(turn>0?'KeyA':'KeyD');if(Math.abs(turn)<.15)keys.add('KeyW');
    evidence.inputs.push({tick:w.tick,id:me.id,x:me.x,z:me.z,goal,path,keys:[...keys]});
    await setKeys(host,keys);await new Promise(r=>setTimeout(r,120));
  }
  for(const page of pages)await setKeys(page.sessionId,new Set());
  await new Promise(r=>setTimeout(r,1500));
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.plantContact')));
  evidence.environment=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.map02Environment')));
  evidence.finalWorld=await Promise.all(pages.map(p=>world(p.sessionId)));
  const failures=[];
  evidence.acceptedTransactions=evidence.observed.map(v=>v.events.filter(e=>e.targetId==='PLANT:327'));
  if(JSON.stringify(evidence.acceptedTransactions[0])!==JSON.stringify(evidence.acceptedTransactions[1]))failures.push('Plant accepted transactions differ');
  for(const [index,v]of evidence.observed.entries()){
    if(v.events.filter(e=>e.targetId==='PLANT:327'&&e.type==='scenePlantHidden').length!==1)failures.push('side'+index+' ordinary source327 first contact missing');
    if(!v.snapshots.some(s=>s.hidden)||!v.rootStates.some(s=>s.hidden&&!s.rootEnabled&&s.owners===29))failures.push('side'+index+' source327 authoritative hidden/root correspondence missing');
    const screenshot=await command('Page.captureScreenshot',{format:'png'},pages[index].sessionId);
    await writeFile(output+'-actual-'+(index+1)+'.png',Buffer.from(screenshot.data,'base64'));
  }
  if(!evidence.hiddenWorld)failures.push('Ordinary movement did not reach source327 contact');
  await aux.leave(1);
  for(const page of pages)await nativeClick(page.sessionId,'[data-leave-room]');
  for(const page of pages)await waitUntil(page.sessionId,"!document.querySelector('#battle-status').dataset.world");
  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,'({breakables:window.plantContactBattle.battlefield.breakables.size,plantMeshes:window.plantContactBattle.scene.meshes.filter(m=>m.metadata?.sourcePlantSway).length,instances:window.plantContactBattle.effects.instances.length,sceneVoices:window.plantContactBattle.effects.skillSound.voices.size,battleVoices:window.plantContactBattle.sound.voices.size})')));
  for(const row of evidence.cleanup)if(Object.values(row).some(n=>n!==0))failures.push('ordinary Leave cleanup incomplete');
  evidence.environmentAfterLeave=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.map02Environment')));
  evidence.plantOwnerCleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,'({roots:window.plantContactBattle.battlefield.plantRoots.size,snapshots:window.plantContactBattle.battlefield.plantSnapshots.size,round:window.plantContactBattle.battlefield.plantRound??null})')));
  if(evidence.plantOwnerCleanup.some(row=>row.roots||row.snapshots||row.round!==null))failures.push('Plant root/snapshot ledger cleanup missing');
  evidence.failures=failures;evidence.status=failures.length?'INCOMPLETE':'PASS';
  console.log(evidence.status+': '+output+'.json');
}catch(error){
  evidence.status='FAIL';evidence.error=String(error);
  if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.plantContact').catch(e=>({error:String(e)}))));
  throw error;
}finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();
  if(ws){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
  await aux?.disconnect();await vite?.close();await stop(server);await stop(chrome);
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  await writeFile('recovery/output/plant02-contact-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
