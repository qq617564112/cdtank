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
const navCastle=process.argv.includes('--nav-castle');
const se07Only=process.argv.includes('--se07-only');
const audioRematch=process.argv.includes('--audio-rematch');
const c2Only=process.argv.includes('--c2-only')||audioRematch||se07Only;
const audioInspect=audioRematch||se07Only;
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-castle-damage-text-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-castle-damage-text-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store,aux;
const pages=[],contexts=[];
const evidence={status:'RUNNING',c2Only,audioRematch,se07Only,navCastle,ports:{server:3562,vite:5592,cdp:9792},mapId,ammo:2001,
  scope:'New Castle damage bitmap text only. Ordinary map2/mode1/tank1/2001 keyboard aim/fire with two normal authenticated auxiliary players; original pre-room role fixture reused explicitly. No active state/event/camera injection; old Castle body/effects/audio acceptance is reused, not repeated. Software canvas640x360.'};
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
  const env={...process.env,PORT:'3562',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:audioRematch?'45':'180'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5592,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3562',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9792',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9792/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9792');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5592',browserContextId});
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
  aux=await connectBreachAuxiliary('ws://127.0.0.1:3562',roomId,2);
  evidence.auxiliaryPlayers=aux.members.map(m=>({playerId:m.playerId,accountId:m.accountId}));
  await aux.ready(1);
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);
  for(const page of pages){
    await evaluate(page.sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();
      const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world')),scene=engine.scenes[0];
      engine.setHardwareScalingLevel(2);engine.resize();window.castleScene=scene;
      window.castle={events:[],shows:[],records:[],releases:[],draws:[],captures:{},frame:0};
      const {ScenePreview}=await import('/src/assets/scenes/scene-preview.ts');
      const damage=ScenePreview.prototype.damageCastle;
      ScenePreview.prototype.damageCastle=function(result){window.castlePreview=this;window.castle.events.push({...result});window.castleActiveId=result.castleId;try{return damage.call(this,result);}finally{window.castleActiveId=undefined;}};
      const {SceneCastleDamageText}=await import('/src/assets/scenes/scene-castle-damage-text.ts');
      const show=SceneCastleDamageText.prototype.show;
      SceneCastleDamageText.prototype.show=function(x,y,delta){window.castle.shows.push({castleId:window.castleActiveId,x,y,delta,frame:window.castle.frame});return show.call(this,x,y,delta);};
      const {SceneCastleDamageTextRenderer}=await import('/src/render/scene-castle-damage-text-renderer.ts');
      const create=SceneCastleDamageTextRenderer.prototype.create;
      SceneCastleDamageTextRenderer.prototype.create=function(text){const handle=create.call(this,text);this.observedText??=new Map();this.observedText.set(handle,{text,castleId:window.castleActiveId});return handle;};
      const draw=SceneCastleDamageTextRenderer.prototype.draw;
      SceneCastleDamageTextRenderer.prototype.draw=function(record,viewport){draw.call(this,record,viewport);const identity=this.observedText?.get(record.handle);const sample={...record,...identity,viewport:{...viewport},frame:window.castle.frame};window.castle.records.push(sample);
        for(const {mesh,material,resource}of this.draws.get(record.handle)??[]){mesh.textSample={...sample,codepoint:resource.glyph.codepoint,asset:resource.glyph.asset};if(mesh.textObserved)continue;mesh.textObserved=true;
          mesh.onBeforeRenderObservable.add(()=>{window.castle.draws.push({...mesh.textSample,positions:mesh.getVerticesData('position'),uv:mesh.getVerticesData('uv'),indices:mesh.getIndices(),texture:material.getActiveTextures()[0]?.url});});}}
      const release=SceneCastleDamageTextRenderer.prototype.release;
      SceneCastleDamageTextRenderer.prototype.release=function(handle){window.castle.releases.push({handle,...this.observedText?.get(handle),frame:window.castle.frame});return release.call(this,handle);};
      scene.onAfterRenderObservable.add(()=>{const actual=window.castle.draws.filter(d=>d.frame===window.castle.frame);const row=actual.at(-1);
        if(row){const stage=row.elapsed<.5?'early':row.elapsed<.75?'fade':'late';if(!window.castle.captures[stage])window.castle.captures[stage]={frame:window.castle.frame,text:row.text,elapsed:row.elapsed,alpha:row.alpha,canvas:engine.getRenderingCanvas().toDataURL('image/png')};}
        window.castle.frame++;});
    })()`);
  }
  for(const s of [guest,host]){await waitUntil(s,`document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await nativeClick(s,'[data-waiting-ready]');}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  console.log('Normal map'+String(mapId).padStart(4,'0')+'/mode1 four players PLAYING');
  const world=s=>evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  evidence.fixture='Pre-room original tank1/pet1 role records and profile imported explicitly; no active values injected. Two authenticated Account/Join/Ready auxiliary players maintain ordinary heartbeats; no CPU click retry.';
  evidence.initial=await Promise.all(pages.map(p=>world(p.sessionId)));
  const first=await world(host),actor=first.players.find(p=>p.id===first.playerId);
  const target=first.match.sceneObjects.filter(o=>mapId===6?o.id==='CASTLE:81':mapId===5?o.id==='CASTLE:129':mapId===10?o.id==='CASTLE:93':mapId===11?o.id==='CASTLE:176':o.id.startsWith('CASTLE:')).sort((a,b)=>Math.hypot(a.x-actor.x,a.z-actor.z)-Math.hypot(b.x-actor.x,b.z-actor.z))[0];
  assert(target,'Authoritative original Castle exists');evidence.target=target;
  const held=new Map(pages.map(p=>[p.sessionId,new Set()]));
  async function setKeys(session,keys){const previous=held.get(session);for(const code of new Set([...previous,...keys])){if(previous.has(code)===keys.has(code))continue;await command('Input.dispatchKeyEvent',{type:keys.has(code)?'keyDown':'keyUp',code,key:code==='Space'?' ':code.startsWith('Key')?code.slice(3).toLowerCase():code,windowsVirtualKeyCode:({Space:32,KeyW:87,KeyS:83,KeyA:65,KeyD:68,ArrowLeft:37,ArrowRight:39})[code]},session);}held.set(session,keys);}
  const routeField=navCastle?createRoomBattlefield(mapId):undefined,routePolicy=routeField?createOriginalBotNavigation(routeField):undefined;
  const routeReady=new Set();evidence.navInputs=[];
  evidence.inputs=[];
  for(const p of pages)await nativeClick(p.sessionId,'#world');
  const routeDeadline=Date.now()+145000;
  let observerClose=false;
  while(Date.now()<routeDeadline){
    for(const p of pages){const w=await world(p.sessionId),me=w.players.find(v=>v.id===w.playerId),t=w.match.sceneObjects.find(o=>o.id===target.id);const keys=new Set();
      if(navCastle&&me.alive&&!routeReady.has(p.sessionId)){
        const goal=mapId===11?{x:p.sessionId===host?175:-25,y:0,z:-700}:mapId===10?{x:-850,y:0,z:p.sessionId===host?1000:800}:mapId===5?{x:1200,y:0,z:p.sessionId===host?560:442}:{x:p.sessionId===host?120:-120,y:0,z:-1400};
        if(Math.hypot(me.x-goal.x,me.z-goal.z)<45)routeReady.add(p.sessionId);
        else {const path=findBotPath(routeField,{x:me.x,y:me.y,z:me.z},goal,routePolicy),point=path.find(v=>Math.hypot(v.x-me.x,v.z-me.z)>30)??goal;
          const bearing=Math.atan2(point.x-me.x,point.z-me.z),turn=Math.atan2(Math.sin(bearing-me.yaw),Math.cos(bearing-me.yaw));
          if(Math.abs(turn)>.07)keys.add(turn>0?'KeyA':'KeyD');if(Math.abs(turn)<.15)keys.add('KeyW');
          evidence.navInputs.push({tick:w.tick,id:me.id,x:me.x,z:me.z,goal,path,keys:[...keys]});await setKeys(p.sessionId,keys);continue;}
      }
      if(me.alive&&t.hp>0){const angle=Math.atan2(t.x-me.x,t.z-me.z),error=Math.atan2(Math.sin(angle-me.yaw-me.aim),Math.cos(angle-me.yaw-me.aim)),turn=Math.atan2(Math.sin(angle-me.yaw),Math.cos(angle-me.yaw)),distance=Math.hypot(t.x-me.x,t.z-me.z);
        if(p.sessionId===host)observerClose=distance<420;
        if(Math.abs(error)>.05)keys.add(error>0?'ArrowLeft':'ArrowRight');
        if(distance>(audioInspect?400:650)){if(Math.abs(turn)>.08)keys.add(turn>0?'KeyA':'KeyD');if(Math.abs(turn)<.25)keys.add('KeyW');}
        if(p.sessionId===guest&&Math.abs(error)<.09&&distance<950&&t.hp===t.maxHp)keys.add('Space');
        evidence.inputs.push({tick:w.tick,id:me.id,x:me.x,z:me.z,targetHP:t.hp,distance,keys:[...keys]});}
      await setKeys(p.sessionId,keys);}
    const w=await world(host),t=w.match.sceneObjects.find(o=>o.id===target.id);if(t.hp<t.maxHp){evidence.stoppedAt=t;break;}
    if(w.phase==='FINISHED')break;
    await new Promise(r=>setTimeout(r,120));
  }
  for(const p of pages)await setKeys(p.sessionId,new Set());
  await new Promise(r=>setTimeout(r,3500));
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.castle`)));
  for(const [i,p]of pages.entries()){
    if(se07Only)continue;
    for(const [stage,capture]of Object.entries(evidence.observed[i].captures)){await writeFile(output+'-'+stage+'-'+(i+1)+'.png',Buffer.from(capture.canvas.split(',')[1],'base64'));delete capture.canvas;}
    const shot=await command('Page.captureScreenshot',{format:'png'},p.sessionId);await writeFile(output+'-actual-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}
  const sourceId=target.sourcePlacementId;
  const failures=[];
  for(const [i,v]of evidence.observed.entries()){
    if(!v.events.some(e=>e.castleId===sourceId&&e.delta>0))failures.push('side'+i+' ordinary accepted Castle damage missing');
    if(!v.shows.some(s=>s.castleId===sourceId))failures.push('side'+i+' text consumer event missing');
    if(!v.draws.some(d=>d.castleId===sourceId))failures.push('side'+i+' actual bitmap glyph draw missing');
    if(!v.releases.some(r=>r.castleId===sourceId))failures.push('side'+i+' natural text release missing');
    if(Object.keys(v.captures).length===0)failures.push('side'+i+' callback canvas missing');
  }
  if(JSON.stringify(evidence.observed[0].events)!==JSON.stringify(evidence.observed[1].events))failures.push('Accepted Castle transactions differ on clients');
  for(const p of pages){
    const selector=await evaluate(p.sessionId,`document.querySelector('[data-leave-room]')?'[data-leave-room]':document.querySelector('[data-summary-leave]')?'[data-summary-leave]':null`);
    assert(selector,'Formal battle or summary Leave exists');await nativeClick(p.sessionId,selector);
    await waitUntil(p.sessionId,`!document.querySelector('#battle-status')?.dataset.world`);
  }
  await aux.leave(1);
  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null'),castles:window.castlePreview?.castles.size,textMeshes:window.castleScene.meshes.filter(m=>m.name==='castle-damage-text-glyph').length,textMaterials:window.castleScene.materials.filter(m=>m.name==='castle-damage-text').length,textTextures:window.castleScene.textures.filter(t=>t.url?.includes('/ui/regions/8/')).length})`)));
  for(const row of evidence.cleanup)if(row.world!==null||row.castles!==0||row.textMeshes!==0||row.textMaterials!==0||row.textTextures!==0)failures.push('normal Leave text owner cleanup incomplete');
  evidence.failures=failures;evidence.status=failures.length?'INCOMPLETE':'PASS';console.log(evidence.status+': '+output+'.json');
}catch(error){if(ws)for(const[i,page]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.castle`).catch(e=>({error:String(e)}))));throw error;}
finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await aux?.disconnect();
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});await writeFile('recovery/output/castle-damage-text-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
