import {installMap02EnvironmentObserver} from './observers/map02-environment-prepared-browser.mjs';
import {installMap02WaterNaturalObserver} from './observers/map02-water-natural-browser.mjs';
import {createSceneObjects, syncSceneObjectCollision} from '../apps/server/src/battle/environment.ts';
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
const output='recovery/output/browser-map02-water-natural-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-map02-water-natural-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store,aux;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3600,vite:5630,cdp:9830},mapId:2,modeId:1,ammo:2001,scope:'Map02 mode1 new south/east water entry using ordinary four authenticated accounts, W/A/D and current NAV/static clearance. Natural water/waves draw and temporal whole views, normal dual Leave. No old north-bank route/source/native, active state or camera injection.'};
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
  const env={...process.env,PORT:'3600',ACCOUNT_DB_PATH:database};delete env.MATCH_MIN_PLAYERS;delete env.MATCH_TIME_LIMIT_SECONDS;
  let log='';server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5630,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3600',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9830',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9830/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9830');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5630',browserContextId});
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
    await evaluate(page.sessionId,'('+installMap02WaterNaturalObserver.toString()+')()');
  }
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="1"]')`);await nativeClick(host,'[data-map-selector-mode="1"]');await nativeClick(host,`[data-map-selector-map="${mapId}"]`);await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
  const joinPoint=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...joinPoint},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...joinPoint},guest);
  await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
  aux=await connectBreachAuxiliary('ws://127.0.0.1:3600',roomId,2);
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
  const goals=[{x:-850,y:0.023438245058059692,z:-620},{x:-250,y:0,z:-400}];
  const waterTarget={x:-754.5454711914062,z:-257.8947448730469};
  const field=createRoomBattlefield(2);
  const objects=createSceneObjects({mode:1,map:{mapId:2}});
  syncSceneObjectCollision({map:{mapId:2},battlefield:field,sceneObjects:objects},0);
  const original=createOriginalBotNavigation(field),clearance=Math.hypot(49/2,52/2);
  const navigation={cacheKey:'water-nav-static',reachable:original.reachable,canTraverse:(a,b)=>{if(!original.canTraverse(a,b))return false;const p=field.move(a,b,clearance);return Math.hypot(p.x-b.x,p.z-b.z)<.01;}};
  const held=new Map(pages.map(p=>[p.sessionId,new Set()]));
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
  const failures=[];
  evidence.inputs=[];evidence.arrivals=[];evidence.views=[];
  for(const [index,page]of pages.entries()){
    const session=page.sessionId,goal=goals[index];
    const deadline=Date.now()+120000;let arrived=false;
    while(Date.now()<deadline){
      await command('Page.bringToFront',{},session);
      const w=await world(session),me=w.players.find(p=>p.id===w.playerId);
      if(w.phase!=='PLAYING'||!me?.alive)break;
      const near=Math.hypot(me.x-goal.x,me.z-goal.z)<55;
      const route=near?[]:findBotPath(field,{x:me.x,y:me.y,z:me.z},goal,navigation);
      if(!near&&!route.length){failures.push('side'+index+' new entry route unavailable');break;}
      const point=near?waterTarget:(route.find(p=>Math.hypot(p.x-me.x,p.z-me.z)>25)??goal);
      const bearing=Math.atan2(point.x-me.x,point.z-me.z),turn=Math.atan2(Math.sin(bearing-me.yaw),Math.cos(bearing-me.yaw));
      if(near&&Math.abs(turn)<.08){arrived=true;evidence.arrivals.push({side:index,goal,world:w});break;}
      const keys=new Set();if(Math.abs(turn)>.07)keys.add(turn>0?'KeyA':'KeyD');if(!near&&Math.abs(turn)<.15)keys.add('KeyW');
      evidence.inputs.push({side:index,tick:w.tick,x:me.x,z:me.z,goal,route,keys:[...keys]});
      await setKeys(session,keys);await new Promise(r=>setTimeout(r,120));
    }
    await setKeys(session,new Set());
    if(!arrived){failures.push('side'+index+' new water entry not reached');continue;}
    await evaluate(session,"window.waterNaturalStage='bank'");
    for(let view=0;view<3;view++){
      await new Promise(r=>setTimeout(r,700));
      const observed=await evaluate(session,'window.waterNatural');
      const state=await world(session);
      const screenshot=await command('Page.captureScreenshot',{format:'png'},session);
      const file=output+'-natural-'+index+'-'+view+'.png';
      await writeFile(file,Buffer.from(screenshot.data,'base64'));
      evidence.views.push({side:index,view,file,world:state,observed});
    }
    await evaluate(session,'window.waterNaturalStage=null');
  }
  for(const page of pages)await setKeys(page.sessionId,new Set());
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.waterNatural')));
  for(const [index,row]of evidence.observed.entries()){
    if(!row.draws.some(d=>d.name==='water')||!row.draws.some(d=>d.name==='waves'))failures.push('side'+index+' new bank actual draw missing');
  }
  await aux.leave((await world(host)).match.round);
  for(const page of pages){
    await waitUntil(page.sessionId,"document.querySelector('[data-summary-leave], [data-leave-room]')?.matches(':enabled')");
    const selector=await evaluate(page.sessionId,"document.querySelector('[data-summary-leave]')?'[data-summary-leave]':'[data-leave-room]'");
    await nativeClick(page.sessionId,selector);
  }
  for(const page of pages)await waitUntil(page.sessionId,"!document.querySelector('#battle-status').dataset.world");
  evidence.environmentAfterLeave=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.map02Environment')));
  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,'({players:window.waterNaturalBattle.players.size,roots:window.waterNaturalBattle.battlefield.plantRoots.size,effects:window.waterNaturalBattle.effects.instances.length,sceneVoices:window.waterNaturalBattle.effects.skillSound.voices.size,battleVoices:window.waterNaturalBattle.sound.voices.size})')));
  if(evidence.cleanup.some(row=>Object.values(row).some(value=>value!==0)))failures.push('Normal Leave resources not cleared');
  evidence.failures=failures;evidence.status=failures.length?'INCOMPLETE':'AWAITING_WHOLE_TEMPORAL_REVIEW';
  console.log(evidence.status+': '+output+'.json');
}catch(error){
  evidence.status='FAIL';evidence.error=String(error);
  if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.waterNatural').catch(e=>({error:String(e)}))));
  throw error;
}finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();
  if(ws){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
  await aux?.disconnect();await vite?.close();await stop(server);await stop(chrome);
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  await writeFile('recovery/output/map02-water-natural-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
