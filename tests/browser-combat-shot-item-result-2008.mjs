import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile, copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {connectBreachAuxiliary} from './helpers/breach-auxiliary.mjs';
const WebSocket=createRequire(import.meta.url)('ws');
const leaveTailOnly=process.argv.includes('--leave-tail-only');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-combat-shot-item-result-2008-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-shot-item-result-2008-'));
const database=join(directory,'accounts.sqlite');
const checkpoint='recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
await copyFile(checkpoint+'-checkpoint.sqlite',database);
const identities=JSON.parse(await readFile(checkpoint+'-identity.private.json','utf8')).accounts;
let server,chrome,vite,ws,store,aux;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3520,vite:5550,cdp:9750},mapId:7,ammo:2008,
  leaveTailOnly,
  scope:'Formal React dual page map7/mode1 ordinary2008 sourceENV79 normal Arrow aim/Space; both players use normal turret input toward the observed source object; remote result111 actual draws and2DSE43/GA09; source broken and cleanup; no original slow-duration or damage-policy acceptance. No injected state/events/camera.'};
if(leaveTailOnly)evidence.scope='Only normal Leave completion: reuse accepted2008 remote presentation contract; ordinary auxLeave/hostLeave reaches guest FINISHED, source summary btnClose/data-summary-leave calls the formal Leave API and returns LOBBY; dual worldnull/resourcezero. Original visual/audio acceptance remains in the preserved second raw.';
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
  const deadline = Date.now() + 10000;
  let point;
  while (Date.now() < deadline) {
    point = await evaluate(session, `(async()=>{
      const candidates=[...document.querySelectorAll(${JSON.stringify(selector)})];
      for(const element of candidates){
        if(element.disabled||!element.getClientRects().length)continue;
        const rect=element.getBoundingClientRect(),x=rect.x+rect.width/2,y=rect.y+rect.height/2;
        const hit=document.elementFromPoint(x,y);
        if(hit===element||element.contains(hit)){
          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          const current=document.elementFromPoint(x,y);
          if(current===element||element.contains(current))return{x,y};
        }
      }
      return null;
    })()`);
    if(point)break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert(point, 'No enabled unobstructed click point: '+selector);
  evidence.clicks??=[];evidence.clicks.push({selector,point});
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
  const env={...process.env,PORT:'3520',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'120'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5550,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3520',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9750',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9750/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9750');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5550',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  for(const[index,page]of pages.entries()){
    await evaluate(page.sessionId,`localStorage.setItem('cdtank-account-token',${JSON.stringify(identities[index].token)})`);
    await command('Page.reload',{},page.sessionId);
    await waitUntil(page.sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')===${JSON.stringify(identities[index].token)}`);
  }
  store=new AccountStore(database);
  for(const[index,page]of pages.entries())assert.equal(store.open(identities[index].token).accountId,identities[index].accountId);
  store.close();store=undefined;
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  evidence.fixture={source:checkpoint+'-checkpoint.sqlite',roles:'True BUYtank3/pet2',inventory:'Normal new ShopBUY2008 in copied genuine checkpoint',newProfileOrInventoryImport:false,originalFundsFixture:true};
  await nativeClick(host,'[data-room-card-shop]');await waitUntil(host,`document.querySelector('#account-shop')?.open&&document.querySelector('#account-shop').getAttribute('aria-busy')==='false'`);
  await nativeClick(host,'[data-shop-category="Weapon"]');await waitUntil(host,`document.querySelector('[data-shop-product-id="2008"]')`);
  for(let step=0;step<12;step++){
    const row=await evaluate(host,`(()=>{const list=document.querySelector('[data-shop-item]'),item=document.querySelector('[data-shop-product-id="2008"]'),l=list.getBoundingClientRect(),r=item.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return{visible:y>l.top&&y<l.bottom&&(hit===item||item.contains(hit)),x:l.x+l.width/2,y:l.y+l.height/2,delta:y>l.bottom?180:-180};})()`);
    if(row.visible)break;await command('Input.dispatchMouseEvent',{type:'mouseWheel',x:row.x,y:row.y,deltaX:0,deltaY:row.delta},host);await new Promise(resolve=>setTimeout(resolve,100));
  }
  await nativeClick(host,'[data-shop-product-id="2008"]');await waitUntil(host,`document.querySelector('[data-shop-item]').dataset.selectedItem==='2008'`);await nativeSelect(host,'[data-shop-currency]','MONEY');
  await nativeClick(host,'[data-shop-quantity]');for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},host);await command('Input.insertText',{text:'10'},host);
  await waitUntil(host,`document.querySelector('[data-shop-quantity]').value==='10'`);await nativeClick(host,'[data-shop-buy]');await waitUntil(host,`document.querySelector('[data-shop-status]').value.includes('已购买')&&document.querySelector('#account-shop').dataset.purchasedInstance`);
  const instanceId=Number(await evaluate(host,`document.querySelector('#account-shop').dataset.purchasedInstance`));assert(instanceId>0);
  evidence.purchase=await evaluate(host,`({status:document.querySelector('[data-shop-status]').value,balance:document.querySelector('[data-shop-balance]').textContent,instanceId:document.querySelector('#account-shop').dataset.purchasedInstance})`);
  await nativeClick(host,'[data-shop-close]');await waitUntil(host,`!document.querySelector('#account-shop[open]')`);
  await nativeClick(host,'[data-room-card-home]');await nativeClick(host,'[data-source-control="rdoWeapon"]');await waitUntil(host,`document.querySelector('[data-inventory-instance="${instanceId}"]')?.matches(':enabled')`);
  assert((await evaluate(host,`document.querySelector('[data-inventory-instance="${instanceId}"]').textContent`)).includes('×10'));
  await nativeClick(host,`[data-inventory-instance="${instanceId}"]`);await nativeClick(host,'[data-kitbag-slot="1"]');await waitUntil(host,`document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId==='${instanceId}'`);
  evidence.inventoryBefore=await evaluate(host,`({item:document.querySelector('[data-inventory-instance="${instanceId}"]').textContent,slot:document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId})`);
  await nativeClick(host,'[data-home-close]');await waitUntil(host,`!document.querySelector('#home-inventory[open]')`);
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="1"]')`);await nativeClick(host,'[data-map-selector-mode="1"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
  const joinPoint=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...joinPoint},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...joinPoint},guest);
  await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
  aux=await connectBreachAuxiliary('ws://127.0.0.1:3520',roomId,2);evidence.auxiliaryPlayers=aux.members.map(m=>({playerId:m.playerId,accountId:m.accountId}));await aux.ready(1);
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);
  for(const page of pages){
    await evaluate(page.sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world')),scene=engine.scenes[0];
      engine.setHardwareScalingLevel(4);engine.resize();window.muzzleScene=scene;window.muzzleCamera=scene.activeCamera;
      window.muzzleOutputContext=new AudioContext();const resumeOutput=()=>{void window.muzzleOutputContext.resume();};window.addEventListener('pointerdown',resumeOutput);window.addEventListener('keydown',resumeOutput);
      window.muzzle={effects:[],sounds:[],events:[],results:[],lives:[],brokenDraws:[],sceneSounds:[],cameraInputs:[],resultFrames:[],frames:0,frameTimes:[],canvas:{width:engine.getRenderWidth(),height:engine.getRenderHeight()}};
      const {TankShotItemResult}=await import('/src/assets/tanks/shot-item-result.ts');
      const show=TankShotItemResult.prototype.show;
      TankShotItemResult.prototype.show=function(message,attackerId,localId,feedback){
        const row={event:window.muzzle.currentEvent,message,attackerId,localId,local:attackerId===localId,frame:window.muzzle.frames,feedback:0};
        window.muzzle.results.push(row);window.muzzle.currentResult=row;
        try{return show.call(this,message,attackerId,localId,()=>{row.feedback++;feedback();});}finally{window.muzzle.currentResult=null;}};
      const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');const add=EffectRuntime.prototype.addInstance;
      EffectRuntime.prototype.addInstance=function(view,tree,...args){const handle=add.call(this,view,tree,...args);window.muzzleRuntime=this;
        if(tree.root.definition.index===2871&&window.muzzle.currentResult){const instance=this.instances.find(i=>i.handle===handle);
          const row={handle,result:window.muzzle.currentResult,root:2871,owner:view?.root.name??null,nodes:instance.draws.map(d=>d.node.definition.index),world:!tree.parentMatrix,rendered:[],vertices:{},textures:{},expired:false};window.muzzle.effects.push(row);instance.resultRow=row;}return handle;};
      const draw=EffectRuntime.prototype.draw;
      EffectRuntime.prototype.draw=function(instance,d){draw.call(this,instance,d);const row=instance.resultRow;if(!row)return;

        const mesh=d.sprite?.mesh??d.particle?.sprite.mesh??d.overlay?.mesh;
        if(mesh?.onBeforeRenderObservable&&!mesh.resultObserved){mesh.resultObserved=true;mesh.onBeforeRenderObservable.add(()=>{
          if(!row.rendered.includes(d.node.definition.index))row.rendered.push(d.node.definition.index);
          row.lastDrawFrame=window.muzzle.frames+1;
          row.vertices[d.node.definition.index]=mesh.getTotalVertices();row.textures[d.node.definition.index]=mesh.material.getActiveTextures()[0]?.url;
        });}};
      const remove=EffectRuntime.prototype.remove;
      EffectRuntime.prototype.remove=function(index){const i=this.instances[index];if(i.resultRow)i.resultRow.expired=i.tree.quiescent;return remove.call(this,index);};
      const {EffectSound}=await import('/src/audio/effect-sound.ts');const play=EffectSound.prototype.play;
      EffectSound.prototype.play=function(reference,parameter){const handle=play.call(this,reference,parameter);
        if(reference==='SE43'&&window.muzzle.currentResult){const voice=this.voices.get(handle),row={result:window.muzzle.currentResult,handle,reference,parameter,src:voice?.audio.src,played:false,ended:false,outputPeak:0,audioVolume:voice?.audio.volume,muted:voice?.audio.muted};window.muzzle.sounds.push(row);voice?.audio.addEventListener('playing',()=>{row.played=true;const stream=voice.audio.captureStream();if(stream.getAudioTracks().length){const source=window.muzzleOutputContext.createMediaStreamSource(stream),analyser=window.muzzleOutputContext.createAnalyser();analyser.fftSize=256;source.connect(analyser);const timer=setInterval(()=>{const samples=new Float32Array(256);analyser.getFloatTimeDomainData(samples);row.outputPeak=Math.max(row.outputPeak,...samples.map(Math.abs));},10);voice.audio.addEventListener('ended',()=>{clearInterval(timer);source.disconnect();analyser.disconnect();},{once:true});}});voice?.audio.addEventListener('ended',()=>{row.ended=true;});}return handle;};
      const {BattleSound}=await import('/src/audio/battle-sound.ts');const event=BattleSound.prototype.event;
      BattleSound.prototype.event=function(value,...args){window.muzzleSound=this;window.muzzle.currentEvent=value;window.muzzle.events.push(value);return event.call(this,value,...args);};
      const feedback=BattleSound.prototype.shotItemResult;
      BattleSound.prototype.shotItemResult=function(value,...args){const before=new Set(this.voices);const result=feedback.call(this,value,...args);
        for(const voice of this.voices){if(before.has(voice))continue;const row={result:window.muzzle.currentResult,...this.history.at(-1),loop:voice.source.loop,ended:false,postGainPeak:0};window.muzzle.gaSounds??=[];window.muzzle.gaSounds.push(row);const analyser=this.context.createAnalyser();analyser.fftSize=256;voice.attenuation.connect(analyser);const timer=setInterval(()=>{const samples=new Float32Array(256);analyser.getFloatTimeDomainData(samples);row.postGainPeak=Math.max(row.postGainPeak,...samples.map(Math.abs));},10);voice.source.addEventListener('ended',()=>{row.ended=true;clearInterval(timer);analyser.disconnect();});}return result;};
      const {EffectSkillSound}=await import('/src/audio/effect-skill-sound.ts');const scenePlay=EffectSkillSound.prototype.play;
      EffectSkillSound.prototype.play=function(reference,selector,position){const handle=scenePlay.call(this,reference,selector,position);
        if(reference==='GA41'){const voice=this.voices.get(handle);const row={event:window.muzzle.currentEvent,reference,selector,position:[...position],handle,played:false,ended:false,loop:voice?.audio.loop,src:voice?.audio.src};window.muzzle.sceneSounds.push(row);
          voice?.audio.addEventListener('playing',()=>{row.played=true;});voice?.audio.addEventListener('ended',()=>{row.ended=true;});}return handle;};
      scene.onBeforeRenderObservable.add(()=>{for(const mesh of scene.meshes){if(!mesh.metadata?.sourceBreachBroken||mesh.metadata.sourcePlacementId!=='79'||!mesh.onBeforeRenderObservable||mesh.sceneResultObserved)continue;
        mesh.sceneResultObserved=true;mesh.onBeforeRenderObservable.add(()=>{window.muzzle.brokenDraws.push({id:mesh.metadata.sourcePlacementId,model:mesh.metadata.sourceModel,node:mesh.metadata.sourceModelNode,vertices:mesh.getTotalVertices(),frame:window.muzzle.frames+1});});}});
      scene.onAfterRenderObservable.add(()=>{
        const row=window.muzzle.effects.find(value=>value.lastDrawFrame===window.muzzle.frames+1);
        if(!${leaveTailOnly}&&row&&window.muzzle.resultFrames.length<3){const instance=window.muzzleRuntime.instances.find(value=>value.handle===row.handle),elapsed=instance?.tree.root.lifecycle.elapsed;
          if(instance&&(!window.muzzle.resultFrames.length||elapsed-window.muzzle.resultFrames.at(-1).elapsed>.30))window.muzzle.resultFrames.push({handle:row.handle,rendered:[...row.rendered],frame:window.muzzle.frames+1,elapsed,canvas:engine.getRenderingCanvas().toDataURL('image/png')});}
      });
      const {Battle}=await import('/src/match/battle.ts');const reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.muzzleBattle=this;return reconcile.apply(this,args);};
      const seen=new Map();scene.onAfterRenderObservable.add(()=>{const raw=document.querySelector('#battle-status')?.dataset.world;if(!raw||!window.muzzleBattle)return;const state=JSON.parse(raw);
        for(const player of state.players){const view=window.muzzleBattle.players.get(player.id);if(!view)continue;const key=player.alive+':'+view.activeAction;
          if(seen.get(player.id)!==key){seen.set(player.id,key);window.muzzle.lives.push({id:player.id,alive:player.alive,action:view.activeAction,hp:player.hp,maxHp:player.maxHp,deaths:player.deaths,frame:window.muzzle.frames});}}});
      scene.onAfterRenderObservable.add(()=>{window.muzzle.frames++;if(window.muzzle.frameTimes.length<3000)window.muzzle.frameTimes.push(engine.getDeltaTime());});
    })()`);
  }
  for(const s of [guest,host]){await waitUntil(s,`window.muzzleBattle?.players.resourcesReady&&!window.muzzleBattle.players.loadingError&&document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await nativeClick(s,'[data-waiting-ready]');}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  console.log('Normal map0007/mode1 four accounts PLAYING; host ordinary2008 sourceENV79');
  const key=async(s,key,code,windowsVirtualKeyCode)=>{await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode},s);};
  const world=s=>evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  const ids=await Promise.all(pages.map(async p=>(await world(p.sessionId)).playerId));
  evidence.initial=await Promise.all(pages.map(p=>world(p.sessionId)));
  await nativeClick(host,'#world');await key(host,'2','Digit2',50);await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.find(p=>p.id===JSON.parse(document.querySelector('#battle-status').dataset.world).playerId).ammoItemId===2008`);
  const manualWorld=await world(host),manualActor=manualWorld.players.find(p=>p.id===manualWorld.playerId);
  const manualTarget=manualWorld.match.sceneObjects.filter(o=>o.hp>0).sort((a,b)=>
    Math.hypot(a.x-manualActor.x,a.z-manualActor.z)-Math.hypot(b.x-manualActor.x,b.z-manualActor.z))[0];
  evidence.manualRoute={actor:manualActor,target:manualTarget,inputs:'Normal Arrow aim and Space, one nearest enabled source object'};
  assert.equal(manualTarget.id,'ENV:79','Same supported normal spawn route');
  for(const page of pages){const aimingSession=page.sessionId;await nativeClick(aimingSession,'#world');
  const aimDeadline=Date.now()+20000;let ready=false;
  while(Date.now()<aimDeadline){const state=await world(aimingSession),actor=state.players.find(p=>p.id===state.playerId);
    const delta=Math.atan2(manualTarget.x-actor.x,manualTarget.z-actor.z)-actor.yaw-actor.aim;
    const error=Math.atan2(Math.sin(delta),Math.cos(delta));
    evidence.aimSamples??=[];evidence.aimSamples.push({session:aimingSession,tick:state.tick,yaw:actor.yaw,aim:actor.aim,error});
    if(Math.abs(error)<.035){await new Promise(r=>setTimeout(r,250));const next=await world(aimingSession),me=next.players.find(p=>p.id===next.playerId),d=Math.atan2(manualTarget.x-me.x,manualTarget.z-me.z)-me.yaw-me.aim;
      if(Math.abs(Math.atan2(Math.sin(d),Math.cos(d)))<.035){ready=true;break;}continue;}
    const code=error>0?'ArrowLeft':'ArrowRight',windowsVirtualKeyCode=error>0?37:39;
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:code,code,windowsVirtualKeyCode},aimingSession);
    await new Promise(r=>setTimeout(r,Math.min(100,Math.max(25,Math.abs(error)/.9*600))));
    await command('Input.dispatchKeyEvent',{type:'keyUp',key:code,code,windowsVirtualKeyCode},aimingSession);
    await new Promise(r=>setTimeout(r,180));
  }
  assert(ready,'Released ordinary source-object aim not stable; no fire');
  evidence.cameraInputs??=[];evidence.cameraInputs.push({session:aimingSession,world:await world(aimingSession)});
  }
  await nativeClick(host,'#world');
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32},host);
  try{await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).match.sceneObjects.find(o=>o.id==='ENV:79').hp===0`,18000);}finally{await command('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32},host);}
  const gate=Date.now()+15000;let done=false;
  while(Date.now()<gate){const values=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({effects:window.muzzle.effects,sounds:window.muzzle.sounds,gaSounds:window.muzzle.gaSounds,brokenDraws:window.muzzle.brokenDraws,sceneSounds:window.muzzle.sceneSounds,frames:window.muzzle.frames,actualResultFrame:window.muzzle.resultFrames.length>0})`)));
    done=leaveTailOnly?values.some(v=>v.effects.length>0)&&values.every(v=>v.effects.every(e=>e.expired)&&v.sounds.every(r=>r.ended)&&(v.gaSounds??[]).every(r=>r.ended)):values.some(v=>v.effects.some(e=>e.rendered.length===2&&e.expired&&e.world)&&v.sounds.some(r=>r.played&&r.ended&&r.outputPeak>0)&&v.gaSounds?.some(r=>r.ended&&r.postGainPeak>0)&&v.actualResultFrame);if(done)break;
    if(values.every(v=>v.frames>0)&&await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'`))break;
    await new Promise(r=>setTimeout(r,250));}
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.muzzle`)));
  evidence.finalWorld=await Promise.all(pages.map(p=>world(p.sessionId)));
  evidence.sceneResults=evidence.observed.map(v=>v.results.length);
  evidence.sceneHits=evidence.observed.map(v=>v.events.filter(e=>e.type==='sceneObjectHit').length);
  evidence.newResultPresentation=done;
  if(done&&!leaveTailOnly){for(const v of evidence.observed){const local=v.results.filter(r=>r.local);for(const r of local)assert.equal(r.feedback,0);if(local.length){assert.equal(v.effects.length,0);assert.equal(v.sounds.length,0);assert.equal(v.gaSounds?.length??0,0);}}
    const remote=evidence.observed.find(v=>v.results.some(r=>!r.local));assert(remote);assert(remote.effects.some(r=>r.world&&r.rendered.length===2&&r.expired&&Object.values(r.vertices).every(n=>n>0)&&Object.values(r.textures).every(Boolean)));}

  if(!leaveTailOnly)for(const[index,page]of pages.entries()){
    for(const[frame,capture]of evidence.observed[index].resultFrames.entries()){
      const file=output+'-result-canvas-'+(index+1)+'-'+frame+'.png';await writeFile(file,Buffer.from(capture.canvas.split(',')[1],'base64'));delete capture.canvas;capture.file=file;
    }
    const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId);await writeFile(output+'-actual-'+(index+1)+'.png',Buffer.from(shot.data,'base64'));
  }
  await aux.leave(1);
  evidence.normalLeave=[];
  await nativeClick(host,'[data-leave-room]');
  await waitUntil(host,`!document.querySelector('#battle-status')?.dataset.world&&document.querySelector('[data-room-card-create]')`);
  evidence.normalLeave.push({actor:'host',control:'data-leave-room',worldNull:true,phase:'LOBBY'});
  await waitUntil(guest,`document.querySelector('[data-match-panel]')?.dataset.phase==='FINISHED'&&document.querySelector('[data-battle-summary-page]')?.getAttribute('aria-busy')==='false'&&document.querySelector('[data-summary-leave]')?.matches(':enabled')`);
  const summary=await command('Page.captureScreenshot',{format:'png'},guest);await writeFile(output+'-summary-leave.png',Buffer.from(summary.data,'base64'));
  await nativeClick(guest,'[data-summary-leave]');
  await waitUntil(guest,`!document.querySelector('#battle-status')?.dataset.world&&document.querySelector('[data-room-card-create]')`);
  evidence.normalLeave.push({actor:'guest',control:'data-summary-leave',source:'game_summary.xml btnClose',worldNull:true,phase:'LOBBY'});
  for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  for(const page of pages)await evaluate(page.sessionId,`window.muzzleOutputContext.close()`);
  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({instances:window.muzzleRuntime.instances.length,meshes:window.muzzleScene.meshes.filter(m=>m.metadata?.originalEffect).length,voices:window.muzzleSound.voices.size,state:document.querySelector('[data-source-audio="battle-sound"]').dataset.state})`)));
  for(const row of evidence.cleanup)assert.deepEqual(row,{instances:0,meshes:0,voices:0,state:'stopped'});
  evidence.status=leaveTailOnly?'PASS_NORMAL_LEAVE_TAIL':done?'PASS':evidence.observed.some(v=>v.results.length)?'PARTIAL_CLIPPED':'ROUTE_NOT_OBSERVED';console.log(evidence.status+': '+output+'.json');
}catch(error){if(ws)for(const[i,page]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}evidence.status='FAIL';evidence.error=String(error);if(ws){
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.muzzle`).catch(e=>({error:String(e)}))));
  for(const[index,value]of evidence.observed.entries())for(const[frame,capture]of(value?.resultFrames??[]).entries())if(capture.canvas){const file=output+'-result-canvas-'+(index+1)+'-'+frame+'.png';await writeFile(file,Buffer.from(capture.canvas.split(',')[1],'base64'));delete capture.canvas;capture.file=file;}
  evidence.failureLeave=[];await aux?.leave(1).catch(()=>{});
  for(const page of pages){try{if(await evaluate(page.sessionId,`Boolean(document.querySelector('[data-leave-room]'))`)){await nativeClick(page.sessionId,'[data-leave-room]');await waitUntil(page.sessionId,`!document.querySelector('#battle-status')?.dataset.world`);evidence.failureLeave.push({normalLeave:true});}}catch(leaveError){evidence.failureLeave.push({error:String(leaveError)});}}
}throw error;}
finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await aux?.disconnect();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});await writeFile('recovery/output/combat-shot-item-result-2008-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
