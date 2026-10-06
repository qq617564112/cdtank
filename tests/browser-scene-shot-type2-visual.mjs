import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile, copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {getBattlefield} from '../apps/server/src/battlefield.ts';
import {queryShotTarget} from '../apps/server/src/battle/shot-query.ts';
const queryField = getBattlefield(7);
const WebSocket=createRequire(import.meta.url)('ws');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-scene-shot-type2-visual-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-staticbox-result-'));
const database=join(directory,'accounts.sqlite');
const checkpoint='recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
await copyFile(checkpoint+'-checkpoint.sqlite',database);
const identities=JSON.parse(await readFile(checkpoint+'-identity.private.json','utf8')).accounts;

let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3454,vite:5484,cdp:9684},mapId:7,ammo:2001,
  scope:'Strict normal purchased checkpoint tank3/pet2; map7/mode4 Ready, normal Arrow aim toward source staticBOX29, host ordinary Space. Static result endpoint007/SE30 then remoteGA07, local silent, natural end and normal Leave. Static identity/result authority explicitly rebuilt; no position/HP/time/event injection.',visibleAccepted:false};
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
  const env={...process.env,PORT:'3454',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'120'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5484,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3454',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9684',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9684/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9684');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5484',browserContextId});
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
  const inventory=store.inventory(identities[0].accountId);
  const item=inventory.records.find(r=>r.itemTableId===3003);
  assert(item&&item.ownedQuantity===1,'Real checkpoint remaining one purchased trap');
  const instanceId=item.instanceId;store.close();store=undefined;
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  evidence.fixture={source:checkpoint+'-checkpoint.sqlite',accountBinding:'strict existing accountId/token',roles:'Actual BUYtank3/pet2',inventory:'Actual purchased3003 remaining1, native SQLite backup',newProfileOrInventoryImport:false};
  await nativeClick(host,'[data-room-card-home]');
  await waitUntil(host,`document.querySelector('[data-kitbag-slot="1"]')?.dataset.instanceId==='${instanceId}'`);
  evidence.inventoryBefore=await evaluate(host,`({item:document.querySelector('[data-inventory-instance="${instanceId}"]')?.textContent??null,slot:document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId})`);
  await nativeClick(host,'[data-home-close]');
  await waitUntil(host,`!document.querySelector('#home-inventory[open]')`);
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')`);await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
  const joinPoint=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...joinPoint},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...joinPoint},guest);
  await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).renderedPlayers===2`);

  for(const page of pages){
    await evaluate(page.sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world')),scene=engine.scenes[0];
      engine.setHardwareScalingLevel(4);engine.resize();window.muzzleScene=scene;window.muzzleCamera=scene.activeCamera;
      window.muzzleOutputContext=new AudioContext();await window.muzzleOutputContext.resume();
      window.muzzle={effects:[],sounds:[],events:[],results:[],lives:[],brokenDraws:[],sceneSounds:[],cameraInputs:[],frames:0,frameTimes:[],canvas:{width:engine.getRenderWidth(),height:engine.getRenderHeight()}};
      const {TankShotItemResult}=await import('/src/assets/tanks/shot-item-result.ts');
      const show=TankShotItemResult.prototype.show;
      TankShotItemResult.prototype.show=function(message,attackerId,localId,feedback){
        const row={event:window.muzzle.currentEvent,message,attackerId,localId,local:attackerId===localId,frame:window.muzzle.frames,feedback:0};
        window.muzzle.results.push(row);window.muzzle.currentResult=row;
        try{return show.call(this,message,attackerId,localId,()=>{row.feedback++;feedback();});}finally{window.muzzle.currentResult=null;}};
      const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');const add=EffectRuntime.prototype.addInstance;
      EffectRuntime.prototype.addInstance=function(view,tree){const handle=add.call(this,view,tree);window.muzzleRuntime=this;
        if(tree.root.definition.index===2432&&window.muzzle.currentResult){const instance=this.instances.find(i=>i.handle===handle);
          const row={handle,result:window.muzzle.currentResult,root:2432,owner:view?.root.name??null,nodes:instance.draws.map(d=>d.node.definition.index),world:!tree.parentMatrix,rendered:[],vertices:{},textures:{},expired:false};window.muzzle.effects.push(row);instance.resultRow=row;}return handle;};
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
        if(reference==='SE30'&&window.muzzle.currentResult){const voice=this.voices.get(handle),row={result:window.muzzle.currentResult,handle,reference,parameter,src:voice?.audio.src,played:false,ended:false,outputPeak:0,audioVolume:voice?.audio.volume,muted:voice?.audio.muted};window.muzzle.sounds.push(row);voice?.audio.addEventListener('playing',()=>{row.played=true;const stream=voice.audio.captureStream();if(stream.getAudioTracks().length){const source=window.muzzleOutputContext.createMediaStreamSource(stream),analyser=window.muzzleOutputContext.createAnalyser();analyser.fftSize=256;source.connect(analyser);const timer=setInterval(()=>{const samples=new Float32Array(256);analyser.getFloatTimeDomainData(samples);row.outputPeak=Math.max(row.outputPeak,...samples.map(Math.abs));},10);voice.audio.addEventListener('ended',()=>{clearInterval(timer);source.disconnect();analyser.disconnect();},{once:true});}});voice?.audio.addEventListener('ended',()=>{row.ended=true;});}return handle;};
      const {BattleSound}=await import('/src/audio/battle-sound.ts');const event=BattleSound.prototype.event;
      BattleSound.prototype.event=function(value,...args){window.muzzleSound=this;window.muzzle.currentEvent=value;window.muzzle.events.push(value);return event.call(this,value,...args);};
      const feedback=BattleSound.prototype.shotItemResult;
      BattleSound.prototype.shotItemResult=function(value,...args){const before=new Set(this.voices);const result=feedback.call(this,value,...args);
        for(const voice of this.voices){if(before.has(voice))continue;const row={result:window.muzzle.currentResult,...this.history.at(-1),loop:voice.source.loop,ended:false,postGainPeak:0};window.muzzle.gaSounds??=[];window.muzzle.gaSounds.push(row);const analyser=this.context.createAnalyser();analyser.fftSize=256;voice.attenuation.connect(analyser);const timer=setInterval(()=>{const samples=new Float32Array(256);analyser.getFloatTimeDomainData(samples);row.postGainPeak=Math.max(row.postGainPeak,...samples.map(Math.abs));},10);voice.source.addEventListener('ended',()=>{row.ended=true;clearInterval(timer);analyser.disconnect();});}return result;};
      const {EffectSkillSound}=await import('/src/audio/effect-skill-sound.ts');const scenePlay=EffectSkillSound.prototype.play;
      EffectSkillSound.prototype.play=function(reference,selector,position){const handle=scenePlay.call(this,reference,selector,position);
        if(reference==='GA41'){const voice=this.voices.get(handle);const row={event:window.muzzle.currentEvent,reference,selector,position:[...position],handle,played:false,ended:false,loop:voice?.audio.loop,src:voice?.audio.src};window.muzzle.sceneSounds.push(row);
          voice?.audio.addEventListener('playing',()=>{row.played=true;});voice?.audio.addEventListener('ended',()=>{row.ended=true;});}return handle;};
      scene.onBeforeRenderObservable.add(()=>{for(const mesh of scene.meshes){if(!mesh.metadata?.sourceBreachBroken||mesh.metadata.sourcePlacementId!=='79'||mesh.sceneResultObserved)continue;
        mesh.sceneResultObserved=true;mesh.onBeforeRenderObservable.add(()=>{window.muzzle.brokenDraws.push({id:mesh.metadata.sourcePlacementId,model:mesh.metadata.sourceModel,node:mesh.metadata.sourceModelNode,vertices:mesh.getTotalVertices(),frame:window.muzzle.frames+1});});}});
      scene.onAfterRenderObservable.add(()=>{
        window.muzzle.resultFrames??=[];
        if(window.muzzle.resultFrames.length>=3)return;
        const row=window.muzzle.effects.find(effect=>effect.lastDrawFrame===window.muzzle.frames+1);
        if(!row)return;
        const instance=window.muzzleRuntime?.instances.find(value=>value.handle===row.handle);
        if(!instance)return;
        const elapsed=instance.tree.root.lifecycle.elapsed;
        const previous=window.muzzle.resultFrames.at(-1);
        if(previous&&elapsed-previous.elapsed<.12)return;
        const capture={handle:row.handle,rendered:[...row.rendered],frame:window.muzzle.frames+1,elapsed,
          active:instance.tree.nodes.map(node=>({index:node.definition.index,phase:node.lifecycle.phase})),
          canvas:engine.getRenderingCanvas().toDataURL('image/png')};
        window.muzzle.resultFrames.push(capture);
        window.muzzle.actualResultFrame??=capture;
      });
      const {Battle}=await import('/src/match/battle.ts');const reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.muzzleBattle=this;return reconcile.apply(this,args);};
      const seen=new Map();scene.onAfterRenderObservable.add(()=>{const raw=document.querySelector('#battle-status')?.dataset.world;if(!raw||!window.muzzleBattle)return;const state=JSON.parse(raw);
        for(const player of state.players){const view=window.muzzleBattle.players.get(player.id);if(!view)continue;const key=player.alive+':'+view.activeAction;
          if(seen.get(player.id)!==key){seen.set(player.id,key);window.muzzle.lives.push({id:player.id,alive:player.alive,action:view.activeAction,hp:player.hp,maxHp:player.maxHp,deaths:player.deaths,frame:window.muzzle.frames});}}});
      scene.onAfterRenderObservable.add(()=>{window.muzzle.frames++;if(window.muzzle.frameTimes.length<3000)window.muzzle.frameTimes.push(engine.getDeltaTime());});
    })()`);
  }

  for(const session of [guest,host]){await waitUntil(session,`document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await nativeClick(session,'[data-waiting-ready]');}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  const world=session=>evaluate(session,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  evidence.initial=await Promise.all(pages.map(page=>world(page.sessionId)));
  const target=JSON.parse(await readFile('recovery/output/scene-shot-type2-entry.json','utf8')).selected;
  evidence.queryEntrance=target;evidence.inputs=[];
  evidence.settledAim=[];
  for(const page of [pages[1],pages[0]]){
    const session=page.sessionId;
    await nativeClick(session,'#world');
    const deadline=Date.now()+20000;
    let ready=false;
    while(Date.now()<deadline){
      const state=await world(session),actor=state.players.find(p=>p.id===state.playerId);
      const yaw=Math.atan2(target.result.point.x-actor.x,target.result.point.z-actor.z);
      const error=Math.atan2(Math.sin(yaw-actor.yaw-actor.aim),Math.cos(yaw-actor.yaw-actor.aim));
      const query=queryShotTarget(actor,{x:Math.sin(actor.yaw+actor.aim),y:0,z:Math.cos(actor.yaw+actor.aim)},
        new Map(state.players.map(player=>[player.id,player])),queryField,28,state.sceneCrushes??[]);
      evidence.inputs.push({tick:state.tick,id:actor.id,x:actor.x,z:actor.z,error,query});
      if((session===host?query.kind==='SCENE'&&query.targetId==='29':Math.abs(error)<.045)){
        // Require three later snapshots with the same released normal input angle.
        let stable=0,previousTick=state.tick;
        const stableDeadline=Date.now()+1800;
        while(Date.now()<stableDeadline&&stable<3){
          await new Promise(resolve=>setTimeout(resolve,60));
          const next=await world(session),nextActor=next.players.find(p=>p.id===next.playerId);
          if(next.tick===previousTick)continue;
          previousTick=next.tick;
          if(Math.abs(nextActor.aim-actor.aim)>.0001||Math.abs(nextActor.yaw-actor.yaw)>.0001)break;
          stable++;
        }
        if(stable===3){evidence.settledAim.push({id:actor.id,tick:state.tick,aim:actor.aim,yaw:actor.yaw,error,query,stableTicks:stable});ready=true;break;}
        continue;
      }
      const code=error>0?'ArrowLeft':'ArrowRight',windowsVirtualKeyCode=error>0?37:39;
      await command('Input.dispatchKeyEvent',{type:'keyDown',key:code,code,windowsVirtualKeyCode},session);
      await new Promise(resolve=>setTimeout(resolve,Math.min(100,Math.max(25,Math.abs(error)/.9*700))));
      await command('Input.dispatchKeyEvent',{type:'keyUp',key:code,code,windowsVirtualKeyCode},session);
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    assert(ready,'Released normal aim did not settle on required host BOX29/observer endpoint; no Space sent');
  }
  await nativeClick(host,'#world');
  const beforeFire=await world(host),shooter=beforeFire.players.find(player=>player.id===beforeFire.playerId);
  evidence.beforeFireQuery=queryShotTarget(shooter,{x:Math.sin(shooter.yaw+shooter.aim),y:0,z:Math.cos(shooter.yaw+shooter.aim)},new Map(beforeFire.players.map(player=>[player.id,player])),queryField,28,beforeFire.sceneCrushes??[]);
  assert(evidence.beforeFireQuery.kind==='SCENE'&&evidence.beforeFireQuery.targetId==='29','Final released query must remain BOX29; no fire otherwise');
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32},host);
  await waitUntil(host,`window.muzzle.events.some(e=>e.type==='sceneStaticHit')`,8000);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32},host);
  await waitUntil(guest,`window.muzzle.effects.some(e=>e.expired)&&window.muzzle.sounds.some(s=>s.played&&s.ended&&s.outputPeak>0)&&window.muzzle.gaSounds?.some(s=>s.ended&&s.postGainPeak>0)`,10000);
  evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.muzzle')));
  evidence.finalWorld=await Promise.all(pages.map(page=>world(page.sessionId)));
  for(const[index,value]of evidence.observed.entries()){
    for(const[frame,capture]of (value.resultFrames??[]).entries()){
      const file=output+'-result-canvas-'+(index+1)+'-'+frame+'.png';
      await writeFile(file,Buffer.from(capture.canvas.split(',')[1],'base64'));delete capture.canvas;capture.file=file;
    }
    if(value.actualResultFrame?.canvas){delete value.actualResultFrame.canvas;
      value.actualResultFrame.file=value.resultFrames?.[0]?.file;}
    const shot=await command('Page.captureScreenshot',{format:'png'},pages[index].sessionId);await writeFile(output+'-actual-'+(index+1)+'.png',Buffer.from(shot.data,'base64'));
  }
  for(const page of pages){await nativeClick(page.sessionId,'[data-source-control="btnExit"][data-leave-room], [data-summary-leave]');await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);}
  evidence.cleanup=await Promise.all(pages.map(page=>evaluate(page.sessionId,`({world:document.querySelector('#battle-status').dataset.world??null,instances:window.muzzleRuntime.instances.length,meshes:window.muzzleScene.meshes.filter(m=>m.metadata?.originalEffect).length,voices:window.muzzleSound.voices.size})`)));
  for(const row of evidence.cleanup){assert(!row.world);assert.equal(row.instances,0);assert.equal(row.meshes,0);assert.equal(row.voices,0);}
  evidence.status='PASS_RESULT_SCOPE_PENDING_PIXEL_REVIEW';console.log(evidence.status+': '+output+'.json');
}catch(error){
  evidence.status='INCOMPLETE';evidence.error=String(error);
  if(ws)for(const[index,page]of pages.entries()){
    evidence.failureScope??=[];evidence.failureScope.push(await evaluate(page.sessionId,`({state:document.querySelector('#battle-status')?.dataset.world,observer:window.muzzle})`).catch(e=>({error:String(e)})));
    const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(index+1)+'.png',Buffer.from(shot.data,'base64'));
  }throw error;
}finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');store?.close();
  if(ws){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  await writeFile('recovery/output/scene-shot-type2-process-cleanup.json',JSON.stringify({ports:evidence.ports,tempRemoved:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
