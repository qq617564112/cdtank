import {installSceneBreach04Observer} from './observers/scene-breach04-browser.mjs';
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
const mapId=4;
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-breach04-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-breach04-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store,aux;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3361,vite:5391,cdp:9591},mapId:4,modeId:1,ammo:2001,scope:'Formal React four authenticated players, explicit pre-room original tank/pet source records, ordinary NAV keyboard single-player firing at source479; original c9/GA13 actual draw/output/end/hidden and Leave. No active position/state/HP/event injection. Software640x360.'};
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
  const env={...process.env,PORT:'3361',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'180'};delete env.MATCH_MIN_PLAYERS;
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
    await evaluate(page.sessionId,'('+installSceneBreach04Observer.toString()+')()');
    await evaluate(page.sessionId,'window.breachScene.getEngine().setHardwareScalingLevel(2);window.breachScene.getEngine().resize()');
  }
  for(const session of [guest,host]){
    await waitUntil(session,"document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled");
    await nativeClick(session,'[data-waiting-ready]');
  }
  for(const page of pages)await waitUntil(page.sessionId,"JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'");
  const world=session=>evaluate(session,"JSON.parse(document.querySelector('#battle-status').dataset.world)");
  evidence.initial=await Promise.all(pages.map(p=>world(p.sessionId)));
  assert(evidence.initial.every(w=>w.mode===1&&w.mapId===4&&w.match.sceneObjects.length===17),'Formal original map4 ENV identities');
  const target=evidence.initial[0].match.sceneObjects.find(o=>o.id==='ENV:479');
  assert(target,'Authoritative source479 target');
  evidence.target=target;
  evidence.fixture='Explicit pre-room original tank1/pet1 records; four normally authenticated accounts, two formal React renderers and two idle protocol players. No active values injected.';
  const field=createRoomBattlefield(4),navigation=createOriginalBotNavigation(field);
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
  console.log('Formal map0004/mode1 four authenticated accounts PLAYING');
  const routeDeadline=Date.now()+145000;
  while(Date.now()<routeDeadline){
    for(const page of pages){
      const w=await world(page.sessionId),me=w.players.find(p=>p.id===w.playerId),object=w.match.sceneObjects.find(o=>o.id===target.id),keys=new Set();
      if(me.alive&&object.hp>0){
        if(!ready.has(page.sessionId)){
          const goal={x:page.sessionId===host?-125.5214:-149.5214,y:0,z:-430.9815};
          const arrivalDistance=page.sessionId===host?65:30;
          if(Math.hypot(me.x-goal.x,me.z-goal.z)<arrivalDistance)ready.add(page.sessionId);
          else {
            const path=findBotPath(field,{x:me.x,y:me.y,z:me.z},goal,navigation),point=path.find(p=>Math.hypot(p.x-me.x,p.z-me.z)>25)??goal;
            const bearing=Math.atan2(point.x-me.x,point.z-me.z),turn=Math.atan2(Math.sin(bearing-me.yaw),Math.cos(bearing-me.yaw));
            if(Math.abs(turn)>.07)keys.add(turn>0?'KeyA':'KeyD');
            if(Math.abs(turn)<.15)keys.add('KeyW');
            evidence.inputs.push({tick:w.tick,id:me.id,x:me.x,z:me.z,targetHP:object.hp,goal,path,keys:[...keys]});
            await setKeys(page.sessionId,keys);continue;
          }
        }
        const angle=Math.atan2(object.x-me.x,object.z-me.z),error=Math.atan2(Math.sin(angle-me.yaw-me.aim),Math.cos(angle-me.yaw-me.aim));
        if(Math.abs(error)>.05)keys.add(error>0?'ArrowLeft':'ArrowRight');
        if(page.sessionId===guest&&ready.size===2&&Math.abs(error)<.09)keys.add('Space');
        evidence.inputs.push({tick:w.tick,id:me.id,x:me.x,z:me.z,targetHP:object.hp,error,keys:[...keys]});
      }
      await setKeys(page.sessionId,keys);
    }
    const w=await world(host);
    if(w.match.sceneObjects.find(o=>o.id===target.id).hp===0){evidence.destroyedAtInput=w;break;}
    if(w.phase==='FINISHED')break;
    await new Promise(r=>setTimeout(r,120));
  }
  for(const page of pages)await setKeys(page.sessionId,new Set());
  await new Promise(r=>setTimeout(r,4500));
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.breach')));
  evidence.finalWorld=await Promise.all(pages.map(p=>world(p.sessionId)));
  if(evidence.finalWorld[1].match.sceneObjects.find(o=>o.id===target.id).hp===0){
    let me;
    const turnDeadline=Date.now()+10000;
    while(Date.now()<turnDeadline){
      const w=await world(guest);me=w.players.find(p=>p.id===w.playerId);
      const angle=Math.atan2(target.x-me.x,target.z-me.z),error=Math.atan2(Math.sin(angle-me.yaw),Math.cos(angle-me.yaw));
      if(Math.abs(error)<.06)break;
      await setKeys(guest,new Set([error>0?'KeyA':'KeyD']));await new Promise(r=>setTimeout(r,80));
    }
    await setKeys(guest,new Set());
    const before=await world(guest),player=before.players.find(p=>p.id===before.playerId);
    const length=Math.hypot(target.x-player.x,target.z-player.z),dx=(target.x-player.x)/length,dz=(target.z-player.z)/length;
    await setKeys(guest,new Set(['KeyW']));await new Promise(r=>setTimeout(r,2000));await setKeys(guest,new Set());
    const after=await world(guest),moved=after.players.find(p=>p.id===after.playerId);
    evidence.passage={normalKeys:['KeyA/KeyD','KeyW'],durationMs:2000,before,after,beforeProjection:(player.x-target.x)*dx+(player.z-target.z)*dz,afterProjection:(moved.x-target.x)*dx+(moved.z-target.z)*dz,afterDistance:Math.hypot(moved.x-target.x,moved.z-target.z)};
  }

  const resource=JSON.parse(await readFile('recovery/output/web-assets/scene-breach-0004.json','utf8')).resources.find(r=>r.reference==='Data/scnobj/obj05466/c9.CVD');
  const sourceNodes=resource.nodes.flatMap((n,i)=>n.parts.length?[i]:[]);
  evidence.sourceGeometryNodes=sourceNodes;
  const failures=[];
  if(!evidence.passage||evidence.passage.beforeProjection>=0||evidence.passage.afterProjection<=25)failures.push('ordinary passage after destroyed source release missing');
  for(const [index,v]of evidence.observed.entries()){
    const events=v.events.filter(e=>e.targetId===target.id&&['sceneObjectHit','sceneObjectDestroyed'].includes(e.type));
    if(!events.some(e=>e.type==='sceneObjectDestroyed'))failures.push('side'+index+' ordinary authoritative destruction missing');
    const sound=v.sounds.filter(s=>s.sourcePlacementId==='479');
    if(sound.length!==1||sound[0].reference!=='GA13'||!sound[0].playing||!sound[0].ended||sound[0].loop||!(sound[0].outputPeak>0)||!(sound[0].masterGain>0))failures.push('side'+index+' original GA13 once audible/end missing');
    const nodes=[...new Set(v.draws.filter(d=>d.id==='479'&&d.broken).map(d=>d.node))].sort((a,b)=>a-b);
    if(JSON.stringify(nodes)!==JSON.stringify(sourceNodes))failures.push('side'+index+' original c9 geometry actual draw incomplete');
    if(!sourceNodes.some(node=>new Set(v.draws.filter(d=>d.id==='479'&&d.broken&&d.node===node).map(d=>JSON.stringify(d.positions))).size>1))failures.push('side'+index+' original c9 pose change missing');
    if(!v.visuals.some(s=>s.id==='479'&&s.fading&&!s.hidden&&!s.intactEnabled)||!v.visuals.some(s=>s.id==='479'&&s.hidden))failures.push('side'+index+' natural fade/hidden missing');
    const capture=v.captures['479'];
    if(!capture)failures.push('side'+index+' ordinary canvas missing');
    else await writeFile(output+'-natural-'+(index+1)+'.png',Buffer.from(capture.canvas.split(',')[1],'base64'));
    for(const value of Object.values(v.captures))delete value.canvas;
    const screenshot=await command('Page.captureScreenshot',{format:'png'},pages[index].sessionId);
    await writeFile(output+'-actual-'+(index+1)+'.png',Buffer.from(screenshot.data,'base64'));
  }
  const transactions=evidence.observed.map(v=>v.events.filter(e=>e.targetId===target.id&&['sceneObjectHit','sceneObjectDestroyed'].includes(e.type)));
  if(JSON.stringify(transactions[0])!==JSON.stringify(transactions[1]))failures.push('Accepted transactions differ between webpages');
  evidence.acceptedTransactions=transactions;
  await aux.leave(1);
  for(const page of pages)await nativeClick(page.sessionId,'[data-leave-room]');
  for(const page of pages)await waitUntil(page.sessionId,"!document.querySelector('#battle-status').dataset.world");
  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,'({breakables:window.breachBattle.battlefield.breakables.size,brokenMeshes:window.breachScene.meshes.filter(m=>m.metadata?.sourceBreachBroken).length,instances:window.breachBattle.effects.instances.length,sceneVoices:window.breachBattle.effects.skillSound.voices.size,battleVoices:window.breachBattle.sound.voices.size})')));
  for(const row of evidence.cleanup)if(Object.values(row).some(n=>n!==0))failures.push('ordinary Leave cleanup incomplete');
  evidence.failures=failures;evidence.status=failures.length?'INCOMPLETE':'PASS';
  console.log(evidence.status+': '+output+'.json');
}catch(error){
  evidence.status='FAIL';evidence.error=String(error);
  if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.breach').catch(e=>({error:String(e)}))));
  throw error;
}finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();
  if(ws){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
  await aux?.disconnect();await vite?.close();await stop(server);await stop(chrome);
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  await writeFile('recovery/output/breach04-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
