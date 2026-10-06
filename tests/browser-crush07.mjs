import {installSceneCrush07Observer} from './observers/scene-crush07-browser.mjs';
import {queryShotTarget} from '../apps/server/src/battle/shot-query.ts';
import {syncSceneObjectCollision} from '../apps/server/src/battle/environment.ts';
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
const mapId=7;
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-crush07-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-crush07-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store,aux;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3361,vite:5391,cdp:9591},mapId:7,modeId:1,ammo:2001,scope:'Formal React four authenticated players, pre-room original tank/pet source records, ordinary NAV and single host2001 shooter at originalCrush76; source051 silent smoke, hidden guard, natural end/round reset/Leave. No active position/state/HP/event injection. Software640x360.'};
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
  const env={...process.env,PORT:'3361',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'75'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5391,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3361',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9591',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9591/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9591');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5391',browserContextId});
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
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="1"]')`);await nativeClick(host,'[data-map-selector-mode="1"]');await nativeClick(host,`[data-map-selector-map="${mapId}"]`);await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
  const joinPoint=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...joinPoint},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...joinPoint},guest);
  await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
  aux=await connectBreachAuxiliary('ws://127.0.0.1:3361',roomId,2);
  evidence.auxiliaryPlayers=aux.members.map(m=>({playerId:m.playerId,accountId:m.accountId}));
  await aux.ready(1);
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);

  for(const page of pages){
    await evaluate(page.sessionId,'('+installSceneCrush07Observer.toString()+')()');
    await evaluate(page.sessionId,'window.crushScene.getEngine().setHardwareScalingLevel(2);window.crushScene.getEngine().resize()');
  }
  for(const session of [guest,host]){
    await waitUntil(session,"document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled");
    await nativeClick(session,'[data-waiting-ready]');
  }
  for(const page of pages)await waitUntil(page.sessionId,"JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'");
  const world=session=>evaluate(session,"JSON.parse(document.querySelector('#battle-status').dataset.world)");
  evidence.initial=await Promise.all(pages.map(p=>world(p.sessionId)));
  assert(evidence.initial.every(w=>w.mode===1&&w.mapId===7&&w.match.sceneCrushes.length===3),'Formal map7 Crush identities');
  const target=evidence.initial[0].match.sceneCrushes.find(o=>o.id==='CRUSH:76');
  assert(target,'Authoritative source76 target');
  const route=JSON.parse(await readFile('recovery/output/scene-crush07-route.json','utf8'));
  const source=JSON.parse(await readFile('recovery/output/web-assets/scene-placements.json','utf8')).find(m=>m.id==='0007').records.find(p=>p.id==='76');
  evidence.target=target;evidence.routeEvidence='scene-crush07-route.json';
  evidence.fixture='Original tank1/pet1 owned records before room; four authenticated accounts, two React renderers and two idle normal players.';
  const field=createRoomBattlefield(7),navigation=createOriginalBotNavigation(field);
  const queryField=createRoomBattlefield(7);
  evidence.shooter='host';evidence.observerArrivalTolerance=80;
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
  console.log('Formal mode1/map7 four players PLAYING, ordinary NAV to source76');
  const routeDeadline=Date.now()+65000;
  let hiddenAt;
  while(Date.now()<routeDeadline){
    for(const [index,page]of pages.entries()){
      const w=await world(page.sessionId),me=w.players.find(p=>p.id===w.playerId),object=w.match.sceneCrushes.find(o=>o.id===target.id),keys=new Set();
      if(w.phase!=='PLAYING')continue;
      if(me.alive){
        const goal=route.rows[index].goal;
        if(!ready.has(page.sessionId)){
          if(Math.hypot(me.x-goal.x,me.z-goal.z)<(index===0?45:80))ready.add(page.sessionId);
          else {
            const path=findBotPath(field,{x:me.x,y:me.y,z:me.z},goal,navigation),point=path.find(p=>Math.hypot(p.x-me.x,p.z-me.z)>25)??goal;
            const bearing=Math.atan2(point.x-me.x,point.z-me.z),turn=Math.atan2(Math.sin(bearing-me.yaw),Math.cos(bearing-me.yaw));
            if(Math.abs(turn)>.07)keys.add(turn>0?'KeyA':'KeyD');
            if(Math.abs(turn)<.15)keys.add('KeyW');
            evidence.inputs.push({tick:w.tick,id:me.id,x:me.x,z:me.z,hidden:object.hidden,goal,path,keys:[...keys]});
            await setKeys(page.sessionId,keys);continue;
          }
        }
        const angle=Math.atan2(source.matrix[12]-me.x,source.matrix[14]-me.z),error=Math.atan2(Math.sin(angle-me.yaw-me.aim),Math.cos(angle-me.yaw-me.aim));
        if(Math.abs(error)>.025)keys.add(error>0?'ArrowLeft':'ArrowRight');
        let query;
        if(page.sessionId===host&&Math.abs(error)<.03){
          syncSceneObjectCollision({map:{mapId:7},battlefield:queryField,sceneObjects:w.match.sceneObjects,sceneCrushes:w.match.sceneCrushes},Date.now());
          const direction=me.yaw+me.aim;
          query=queryShotTarget(me,{x:Math.sin(direction),y:0,z:Math.cos(direction)},new Map(w.players.map(p=>[p.id,p])),queryField,28,w.match.sceneCrushes);
          if(object.hidden||query.targetId===target.id)keys.add('Space');
        }
        evidence.inputs.push({tick:w.tick,id:me.id,x:me.x,z:me.z,hidden:object.hidden,error,query,keys:[...keys]});
      }
      await setKeys(page.sessionId,keys);
    }
    const w=await world(host);
    if(w.match.sceneCrushes.find(o=>o.id===target.id).hidden){hiddenAt??=Date.now();if(Date.now()-hiddenAt>3300)break;}
    if(w.phase==='FINISHED')break;
    await new Promise(r=>setTimeout(r,70));
  }
  for(const page of pages)await setKeys(page.sessionId,new Set());
  await new Promise(r=>setTimeout(r,1500));
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'({frames:window.crush07.frames,events:window.crush07.events,calls:window.crush07.calls,starts:window.crush07.starts,releases:window.crush07.releases,phases:window.crush07.phases,draws:window.crush07.draws,counts:window.crush07.counts,captures:window.crush07.captures,sounds:window.crush07.sounds})')));
  evidence.finalWorld=await Promise.all(pages.map(p=>world(p.sessionId)));
  const failures=[];
  for(const [index,row]of evidence.observed.entries()){
    const accepted=row.events.filter(e=>e.type==='sceneCrushed'&&e.sceneCrush?.placementId==='76');
    if(accepted.length!==1||!accepted[0].shotItemResult)failures.push('side'+index+' single formal ShotItem Crush transaction missing');
    if(accepted.length===1&&row.events.filter(e=>e.type==='fire'&&e.playerId===accepted[0].playerId).length<2)failures.push('side'+index+' further ordinary fire for hidden repeat boundary missing');
    if(row.starts.filter(s=>s.id==='76').length!==1)failures.push('side'+index+' original051 startup once missing');
    if(!row.starts.some(s=>s.id==='76'&&s.soundNodes?.length===0))failures.push('side'+index+' original051 silent consumer branch missing');
    if(!row.calls.some(c=>c.id==='76'&&c.beforeConsumedShot===false&&c.afterConsumedShot===true&&c.afterEnabled===false))failures.push('side'+index+' immediate original object hide missing');
    if(!row.phases.some(p=>p.id==='76'&&p.phases[1]===3))failures.push('side'+index+' original051 natural end missing');
    if(!row.draws.some(d=>d.id==='76'&&d.sourceNode===2971&&d.textures.includes('/Data/effect/effect/yan1.png')))failures.push('side'+index+' original051 draw/texture missing');
    if(row.captures['76'])await writeFile(output+'-natural-'+(index+1)+'.png',Buffer.from(row.captures['76'].canvas.split(',')[1],'base64'));
    else failures.push('side'+index+' original051 canvas missing');
    for(const capture of Object.values(row.captures))delete capture.canvas;
    const screenshot=await command('Page.captureScreenshot',{format:'png'},pages[index].sessionId);
    await writeFile(output+'-actual-'+(index+1)+'.png',Buffer.from(screenshot.data,'base64'));
  }
  evidence.acceptedTransactions=evidence.observed.map(row=>row.events.filter(e=>e.type==='sceneCrushed'&&e.sceneCrush?.placementId==='76'));
  if(JSON.stringify(evidence.acceptedTransactions[0])!==JSON.stringify(evidence.acceptedTransactions[1]))failures.push('dual accepted transactions differ');
  let leaveRound=1;
  if(evidence.finalWorld.every(w=>w.match.sceneCrushes.find(o=>o.id===target.id).hidden)){
    console.log('Formal76 hidden, captured; waiting for natural FINISHED then normal Rematch');
    await waitUntil(host,"JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'",100000);
    evidence.finished=await Promise.all(pages.map(p=>world(p.sessionId)));
    await aux.rematch(1);
    for(const page of pages)await nativeClick(page.sessionId,'[data-rematch]');
    for(const page of pages)await waitUntil(page.sessionId,"(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='PLAYING'&&w.match.round===2})()");
    await new Promise(r=>setTimeout(r,500));
    evidence.rematch=await Promise.all(pages.map(p=>evaluate(p.sessionId,"({world:JSON.parse(document.querySelector('#battle-status').dataset.world),owners:[...window.crushPreview.crushes].map(([id,o])=>({id,enabled:o.enabled,hidden:o.hidden,sourceEnabled:o.sourceEnabled,rootEnabled:o.root.isEnabled()})),trees:window.crushRuntime.instances.filter(i=>i.crushRetained).map(i=>({id:i.sourceScenePlacementId,handle:i.handle,phases:i.tree.nodes.map(n=>n.lifecycle.phase)})),starts:window.crush07.starts})")));
    for(const [index,row]of evidence.rematch.entries())if(!row.owners.every(o=>o.rootEnabled===o.sourceEnabled&&o.hidden===!o.sourceEnabled)||row.trees.some(t=>t.phases.some(p=>p===1||p===2))||row.starts.filter(s=>s.id==='76').length!==1)failures.push('side'+index+' round2 reset/replay guard missing');
    leaveRound=2;
  }else failures.push('ordinary rematch reset not reached');
  await aux.leave(leaveRound);
  for(const page of pages)await nativeClick(page.sessionId,'[data-leave-room]');
  for(const page of pages)await waitUntil(page.sessionId,"!document.querySelector('#battle-status').dataset.world");
  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.crush07.cleanup()')));
  for(const row of evidence.cleanup)if(Object.values(row).some(v=>v!==0))failures.push('ordinary Leave cleanup incomplete');
  evidence.failures=failures;evidence.status=failures.length?'INCOMPLETE':'PASS';
  console.log(evidence.status+': '+output+'.json');
}catch(error){
  evidence.status='FAIL';evidence.error=String(error);
  throw error;
}finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();
  if(ws){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
  await aux?.disconnect();await vite?.close();await stop(server);await stop(chrome);
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  await writeFile('recovery/output/crush07-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
