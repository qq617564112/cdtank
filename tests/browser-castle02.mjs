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
const mapId=process.argv.includes('--map11')?11:process.argv.includes('--map10')?10:process.argv.includes('--map5')?5:process.argv.includes('--map6')?6:2;
const navCastle=process.argv.includes('--nav-castle');
const se07Only=process.argv.includes('--se07-only');
const audioRematch=process.argv.includes('--audio-rematch');
const c2Only=process.argv.includes('--c2-only')||audioRematch||se07Only;
const audioInspect=audioRematch||se07Only;
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-combat-castle'+String(mapId).padStart(2,'0')+'-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-castle02-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store,aux;
const pages=[],contexts=[];
const evidence={status:'RUNNING',c2Only,audioRematch,se07Only,navCastle,ports:{server:3361,vite:5391,cdp:9591},mapId,ammo:2001,
  scope:'Formal React dual page legal selected map/mode1 with two authenticated stationary auxiliary players; normal keyboard aim/fire source Castle, accepted authoritative HP transactions and original model/effect/spatial sound; no active state/event/camera injection. Explicit pre-room source account records; software canvas320x180.'};
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
  const env={...process.env,PORT:'3361',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:audioRematch?'45':'180'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5391,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3361',ws:true,rewrite:()=> '/'}}}});await vite.listen();
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
    await evaluate(page.sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();
      const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world')),scene=engine.scenes[0];
      engine.setHardwareScalingLevel(4);engine.resize();window.castleScene=scene;
      window.castle={events:[],eventFrames:[],effects:[],sounds:[],draws:[],captures:{},frame:0};
      const {ScenePreview}=await import('/src/assets/scenes/scene-preview.ts');
      const advance=ScenePreview.prototype.advance;ScenePreview.prototype.advance=function(...args){window.castlePreview=this;return advance.apply(this,args);};
      const damage=ScenePreview.prototype.damageCastle;
      ScenePreview.prototype.damageCastle=function(result){window.castlePreview=this;window.castle.events.push({...result});window.castle.eventFrames.push({transaction:window.castle.events.length,frame:window.castle.frame,time:performance.now(),currentHP:result.currentHP});return damage.call(this,result);};
      const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');
      const update=EffectRuntime.prototype.update;EffectRuntime.prototype.update=function(...args){window.castleRuntime=this;window.castleAudio=this.skillSound;return update.apply(this,args);};
      const spawn=EffectRuntime.prototype.spawnCastleEffect;
      EffectRuntime.prototype.spawnCastleEffect=function(name,matrix){const handle=spawn.call(this,name,matrix);window.castleRuntime=this;
        const row={name,handle,startMatrix:[...matrix],draws:[],ended:false};window.castle.effects.push(row);const instance=this.instances.find(i=>i.handle===handle);if(instance)instance.castleRow=row;return handle;};
      const draw=EffectRuntime.prototype.draw;
      EffectRuntime.prototype.draw=function(instance,d){draw.call(this,instance,d);const row=instance.castleRow;if(!row)return;
        const mesh=d.sprite?.mesh??d.particle?.sprite.mesh??d.overlay?.mesh;
        if(mesh&&!mesh.castleObserved){mesh.castleObserved=true;mesh.onBeforeRenderObservable.add(()=>{const node=d.node.definition.index;if(!row.draws.some(r=>r.node===node))row.draws.push({node,vertices:mesh.getTotalVertices(),texture:mesh.material.getActiveTextures()[0]?.url});});}};
      const remove=EffectRuntime.prototype.remove;
      EffectRuntime.prototype.remove=function(index){const value=this.instances[index];if(value.castleRow)value.castleRow.ended=value.tree.quiescent;return remove.call(this,index);};
      const {EffectSkillSound}=await import('/src/audio/effect-skill-sound.ts');const play=EffectSkillSound.prototype.play,stop=EffectSkillSound.prototype.stop;
      EffectSkillSound.prototype.play=function(name,selector,position){const handle=play.call(this,name,selector,position);window.castleAudio=this;
        if(['ga48','se03','se07'].includes(name.toLowerCase())){const voice=this.voices.get(handle),row={name,handle,selector,position:[...position],played:false,ended:false,stopped:false,loop:voice?.audio.loop,src:voice?.audio.src};window.castle.sounds.push(row);
          if(voice){voice.castleRow=row;
            if(${audioInspect}){const analyser=this.context.createAnalyser();analyser.fftSize=256;voice.gain.connect(analyser);voice.castleAnalyser=analyser;row.outputPeak=0;row.masterGain=this.master.gain.value;
              voice.castleSample=setInterval(()=>{const data=new Float32Array(256);analyser.getFloatTimeDomainData(data);const peak=Math.max(...data.map(Math.abs));if(peak>row.outputPeak){row.outputPeak=peak;row.outputGain=voice.gain.gain.value;row.outputTime=voice.audio.currentTime;}},20);}
            voice.audio.addEventListener('playing',()=>{row.played=true;});voice.audio.addEventListener('ended',()=>{row.ended=true;});}}
        return handle;};
      EffectSkillSound.prototype.stop=function(handle){const voice=this.voices.get(handle);if(voice?.castleRow)voice.castleRow.stopped=true;if(voice?.castleSample){clearInterval(voice.castleSample);voice.gain.disconnect(voice.castleAnalyser);voice.castleAnalyser.disconnect();}return stop.call(this,handle);};
      scene.onBeforeRenderObservable.add(()=>{for(const mesh of scene.meshes){if(!mesh.metadata?.sourceCastlePlacementId||mesh.castleObserved)continue;mesh.castleObserved=true;
        mesh.onBeforeRenderObservable.add(()=>{const m=mesh.metadata;window.castle.draws.push({id:m.sourceCastlePlacementId,model:m.sourceCastleModel,action:m.sourceCastleAction,vertices:mesh.getTotalVertices(),world:mesh.getWorldMatrix().asArray(),textures:mesh.material?.getActiveTextures().map(t=>t.url),frame:window.castle.frame});if(window.castle.draws.length>4000)window.castle.draws.splice(0,500);});}});
      scene.onAfterRenderObservable.add(()=>{window.castle.frame++;const event=window.castle.events.at(-1);if(!event)return;
        const key=event.currentHP===0?'dead':event.currentHP<Math.trunc(event.maxHP/3)?'low':event.currentHP<=1600?'smoke':null;
        if(!${se07Only}&&key&&!window.castle.captures[key]&&window.castle.draws.some(d=>d.frame===window.castle.frame-1&&d.id===event.castleId))window.castle.captures[key]={frame:window.castle.frame,hp:event.currentHP,canvas:engine.getRenderingCanvas().toDataURL('image/png')};});
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
        if(Math.abs(error)<.09&&distance<(audioInspect?420:950)&&(!c2Only||p.sessionId===guest)&&(!audioInspect||observerClose)&&(!navCastle||routeReady.size===2))keys.add('Space');
        evidence.inputs.push({tick:w.tick,id:me.id,x:me.x,z:me.z,targetHP:t.hp,distance,keys:[...keys]});}
      await setKeys(p.sessionId,keys);}
    const w=await world(host),t=w.match.sceneObjects.find(o=>o.id===target.id);if(t.hp===0||c2Only&&t.hp>0&&(audioRematch?t.hp<=1600:t.hp<Math.trunc(t.maxHp/3))){evidence.stoppedAt=t;break;}
    if(w.phase==='FINISHED')break;
    await new Promise(r=>setTimeout(r,120));
  }
  for(const p of pages)await setKeys(p.sessionId,new Set());
  await new Promise(r=>setTimeout(r,3500));
  evidence.audioOutput=await Promise.all(pages.map(p=>evaluate(p.sessionId,`(async()=>{const a=window.castleAudio;if(!a)return {missing:true};const taps=[...a.voices].filter(([h,v])=>v.castleRow).map(([h,v])=>{const analyser=a.context.createAnalyser();analyser.fftSize=256;v.gain.connect(analyser);return{h,v,analyser,start:v.audio.currentTime};});await new Promise(r=>setTimeout(r,300));return{context:a.context.state,voices:taps.map(({h,v,analyser,start})=>{const data=new Float32Array(256);analyser.getFloatTimeDomainData(data);v.gain.disconnect(analyser);analyser.disconnect();return{handle:h,name:v.castleRow.name,gain:v.gain.gain.value,paused:v.audio.paused,start,end:v.audio.currentTime,loop:v.audio.loop,peak:Math.max(...data.map(Math.abs))};})};})()`)));
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.castle`)));
  for(const [i,p]of pages.entries()){
    if(se07Only)continue;
    for(const [stage,capture]of Object.entries(evidence.observed[i].captures)){await writeFile(output+'-'+stage+'-'+(i+1)+'.png',Buffer.from(capture.canvas.split(',')[1],'base64'));delete capture.canvas;}
    const shot=await command('Page.captureScreenshot',{format:'png'},p.sessionId);await writeFile(output+'-actual-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}
  const sourceId=target.sourcePlacementId;
  const failures=[];
  for(const [i,v]of evidence.observed.entries()){
    if(!c2Only&&!v.events.some(e=>e.castleId===sourceId&&e.currentHP===0))failures.push('side'+i+' natural lethal transaction missing');
    if(!audioInspect&&!v.draws.some(d=>d.id===sourceId&&d.action==='c2'))failures.push('side'+i+' c2 actual draw missing');
    if(!c2Only&&!v.draws.some(d=>d.id===sourceId&&d.action==='c3'))failures.push('side'+i+' c3 actual draw missing');
    if(!c2Only&&!v.effects.some(e=>e.name==='040'&&e.draws.length))failures.push('side'+i+' smoke actual draw missing');
    if(!c2Only&&!v.effects.some(e=>e.name==='039'&&e.draws.length))failures.push('side'+i+' death effect actual draw missing');
    for(const name of (c2Only?[]:['ga48','se03','se07']))if(!v.sounds.some(s=>s.name.toLowerCase()===name&&s.played))failures.push('side'+i+' '+name+' playback missing');
    if(!c2Only&&v.sounds.some(s=>s.selector===-1&&!s.stopped))failures.push('side'+i+' smoke loop not stopped');
  }
  assert.deepEqual(evidence.observed[0].events,evidence.observed[1].events,'Accepted Castle transactions equal on both clients');
  if(se07Only)for(const [i,v]of evidence.observed.entries())if(!v.sounds.some(s=>s.name.toLowerCase()==='se07'&&s.outputPeak>0&&s.masterGain>0))failures.push('side'+i+' se07 actual output missing');
  let leaveRound=1;
  if(audioRematch){
    for(const [i,v]of evidence.observed.entries())for(const name of ['ga48','se03'])if(!v.sounds.some(s=>s.name.toLowerCase()===name&&s.outputPeak>0&&s.masterGain>0))failures.push('side'+i+' '+name+' actual output missing');
    console.log('Audio captured; waiting for ordinary match deadline and Rematch');
    await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'`,190000);
    evidence.finished=await Promise.all(pages.map(p=>world(p.sessionId)));
    await aux.rematch(1);
    for(const p of pages)await nativeClick(p.sessionId,'[data-rematch]');
    for(const p of pages)await waitUntil(p.sessionId,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='PLAYING'&&w.match.round===2})()`);
    await new Promise(r=>setTimeout(r,500));
    evidence.rematch=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({world:JSON.parse(document.querySelector('#battle-status').dataset.world),castles:[...window.castlePreview.castles].map(([id,v])=>({id,state:v.presentation.state.snapshot(),action:v.visual.current?.resource.name})),oldEffectsActive:window.castleRuntime.instances.filter(i=>i.castleRow).length,oldVoices:window.castleAudio.voices.size,sounds:window.castle.sounds})`)));
    for(const [i,v]of evidence.rematch.entries()){
      if(v.world.match.sceneObjects.find(o=>o.id==='CASTLE:304').hp!==2000||v.castles.some(c=>c.state.stage!==2||c.state.mask!==0||c.action!=='n1')||v.oldEffectsActive!==0||v.oldVoices!==0)failures.push('side'+i+' ordinary Rematch Castle reset incomplete');
    }
    leaveRound=2;
  }
  await aux.leave(leaveRound);
  for(const p of pages)await nativeClick(p.sessionId,'[data-leave-room]');
  for(const p of pages)await waitUntil(p.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({castles:window.castlePreview?.castles.size,instances:window.castleRuntime?.instances.length,voices:window.castleAudio?.voices.size,meshes:window.castleScene.meshes.filter(m=>m.metadata?.sourceCastlePlacementId).length})`)));
  for(const row of evidence.cleanup)if(row.castles!==0||row.instances!==0||row.voices!==0||row.meshes!==0)failures.push('leave cleanup incomplete');
  evidence.failures=failures;evidence.status=failures.length?'INCOMPLETE':'PASS';console.log(evidence.status+': '+output+'.json');
}catch(error){if(ws)for(const[i,page]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.castle`).catch(e=>({error:String(e)}))));throw error;}
finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await aux?.disconnect();
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});await writeFile('recovery/output/combat-castle02-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
