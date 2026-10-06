import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile, copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
const WebSocket=createRequire(import.meta.url)('ws');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-combat-death-t03-whole-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-death-t03-'));
const database=join(directory,'accounts.sqlite');
const checkpoint='recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
await copyFile(checkpoint+'-checkpoint.sqlite',database);
const identities=JSON.parse(await readFile(checkpoint+'-identity.private.json','utf8')).accounts;
let server,chrome,vite,ws;
const pages=[],contexts=[];
const runtimeErrors=[];
const loadStages=[];
const evidence={status:'RUNNING',ports:{server:3502,vite:5532,cdp:9732},mapId:7,tankId:3,
  checkpointSource:checkpoint+'-checkpoint.sqlite',fixture:'Actual purchased tank3/pet2 accounts from native checkpoint, no new owned/inventory/profile data',
  sourceClock:{originalDurationTicks:5601,originalTailTicks:5501,ticksPerSecond:4800,currentRespawnSeconds:3},scope:'Normal0007 two purchased tank3/pet2 webpages; nativeSpace/aim produces reachable natural09/respawn01; original5501 actor-tick tail can complete within current3s respawn, original003 empty death ELK and normal Leave. Fixed production camera, no live state/event/time injection; 640x360 software canvas.'};
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
async function waitUntil(session, expression) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      return await evaluate(session, `(async()=>{const deadline=Date.now()+45000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#room-map-info')?.value+' tanks='+document.querySelector('#tank')?.options.length+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
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
  await waitUntil(session,`document.querySelector(${JSON.stringify(selector)})&&!document.querySelector(${JSON.stringify(selector)}).disabled`);
  const point = await evaluate(session, `(async()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return {x,y}})()`);
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
  const env={...process.env,PORT:'3502',ACCOUNT_DB_PATH:database};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5532,strictPort:true,host:'127.0.0.1',hmr:false,watch:{ignored:['**/interface/resources/source-multiline*','**/interface/lobby/waiting-room.tsx','**/interface/lobby/waiting-room.css']},proxy:{'/game':{target:'ws://127.0.0.1:3502',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9732',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9732/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9732');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  if(message.method==='Runtime.exceptionThrown'||message.method==='Log.entryAdded')
    runtimeErrors.push({sessionId:message.sessionId,method:message.method,params:message.params});
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
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await command('Page.enable',{},sessionId);
    await command('Runtime.enable',{},sessionId);await command('Log.enable',{},sessionId);
    await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(identities[index].token)+')'},sessionId);
    await command('Page.navigate',{url:'http://127.0.0.1:5532'},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);
    await evaluate(sessionId,`(async()=>{
      window.deathLoadStages=[];
      for(const [path,name,method] of [
        ['/src/assets/scenes/scene-preview.ts','ScenePreview','load'],
        ['/src/assets/scenes/map-scene-effects.ts','MapSceneEffects','load'],
        ['/src/render/battle-players.ts','BattlePlayers','loadPlayer'],
        ['/src/audio/map-environment-sound.ts','MapEnvironmentSound','load']]){
        const module=await import(path),prototype=module[name].prototype,original=prototype[method];
        prototype[method]=function(...args){
          const row={name,method,argument:typeof args[0]==='object'?args[0]?.id:args[0],
            startedAt:performance.now(),state:'pending'};window.deathLoadStages.push(row);
          const result=original.apply(this,args);
          result.then(()=>{row.state='resolved';row.endedAt=performance.now();},error=>{
            row.state='rejected';row.error=String(error);row.endedAt=performance.now();});
          return result;
        };
      }
    })()`);
  }
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')`);await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')`);
  const joinPoint=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...joinPoint},guest);
  await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...joinPoint},guest);
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===2})()`);
  for(const page of pages){const sessionId=page.sessionId;
    await evaluate(sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore,Vector3,Matrix}=await import(url),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world')),scene=engine.scenes[0];engine.setHardwareScalingLevel(2);engine.resize();window.deathScene=scene;
      window.death={messages:[],effectStarts:[],sounds:[],events:[],killSounds:[],lives:[],draws:[],captures:{},frames:0,tailFrames:{},clockSamples:[]};
      const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts'),message=EffectRuntime.prototype.message,add=EffectRuntime.prototype.addInstance;
      EffectRuntime.prototype.message=function(view,value){window.death.currentMessage={owner:view.root.name,tankId:view.tankId,...value};const before=this.instances.length,result=message.call(this,view,value);if(value.action==='09')window.death.messages.push({...window.death.currentMessage,before,after:this.instances.length});window.death.currentMessage=undefined;return result;};
      EffectRuntime.prototype.addInstance=function(view,tree){if(window.death.currentMessage?.action==='09')window.death.effectStarts.push({message:window.death.currentMessage,root:tree.root.definition.index});return add.call(this,view,tree);};
      const {EffectSound}=await import('/src/audio/effect-sound.ts'),play=EffectSound.prototype.play;
      EffectSound.prototype.play=function(reference,parameter){window.death.sounds.push({reference,parameter,message:window.death.currentMessage});return play.call(this,reference,parameter);};
      const {BattleSound}=await import('/src/audio/battle-sound.ts'),event=BattleSound.prototype.event;
      BattleSound.prototype.event=function(value,snapshot,localId){const before=new Set(this.voices),result=event.call(this,value,snapshot,localId);if(['destroy','respawn'].includes(value.type))window.death.events.push(value);if(value.type==='destroy'){for(const voice of this.voices){if(before.has(voice))continue;const row={event:value,soundId:this.history.at(-1)?.soundId,position:voice.position,started:this.context.state==='running',ended:false};const end=voice.source.onended;voice.source.onended=e=>{row.ended=true;end?.call(voice.source,e);};window.death.killSounds.push(row);}}return result;};
      const {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.deathBattle=this;return reconcile.apply(this,args);};
      const observe=mesh=>{if(mesh.t03Observed||!mesh.onBeforeRenderObservable)return;mesh.t03Observed=true;mesh.onBeforeRenderObservable.add(()=>{if(!window.deathBattle||!mesh.getTotalVertices())return;for(const {id}of window.deathBattle.players.actions){const view=window.deathBattle.players.get(id);if(view.tankId!==3||!['09','01'].includes(view.activeAction))continue;const screen=Vector3.Project(view.root.position,Matrix.Identity(),scene.getTransformMatrix(),scene.activeCamera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight()));if(JSON.parse(document.querySelector('#battle-status').dataset.world||'{}').playerId!==id&&(screen.z<0||screen.z>1||screen.x<0||screen.x>engine.getRenderWidth()||screen.y<0||screen.y>engine.getRenderHeight()))continue;if(view.activeAction==='01'){const snapshot=JSON.parse(document.querySelector('#battle-status').dataset.world||'{}'),player=snapshot.players?.find(p=>p.id===id);if(!player?.alive||player.deaths<1||!window.death.events.some(e=>e.type==='respawn'&&e.playerId===id))continue;}const c=view.current?.components.find(c=>c.assets.meshes.includes(mesh));if(!c)continue;const clocks=structuredClone(view.root.metadata.actionClocks??[]),clock=clocks.find(v=>v.part===c.part);if(!clock)continue;const tail=view.activeAction==='09'&&clock.overMessage===0;const row={id,part:c.part,action:view.activeAction,time:clock.time,overMessage:clock.overMessage,frame:window.death.frames+1,mesh:mesh.name,asset:c.action.asset,vertices:mesh.getTotalVertices(),textures:mesh.material.getActiveTextures().map(t=>t.url),position:{...view.root.position},matrix:Array.from(mesh.getWorldMatrix().m),morph:Array.from({length:Math.min(mesh.morphTargetManager?.numTargets??0,8)},(_,i)=>mesh.morphTargetManager.getTarget(i).influence)};if(!window.death.draws.some(d=>d.id===id&&d.part===c.part&&d.action===view.activeAction&&d.overMessage===clock.overMessage))window.death.draws.push(row);if(tail){const key=id+':'+c.part;window.death.tailFrames[key]??=[];if(!window.death.tailFrames[key].includes(row.frame))window.death.tailFrames[key].push(row.frame);window.death.lastTail={id,frame:row.frame,clocks};}if(view.activeAction==='09'){if(clock.time>=300)window.death.lastDraw={id,frame:row.frame,clocks};}else window.death.lastRevive={id,frame:row.frame,clocks};}});};scene.meshes.forEach(observe);scene.onNewMeshAddedObservable.add(observe);
      const seen=new Map();scene.onAfterRenderObservable.add(()=>{window.death.frames++;const raw=document.querySelector('#battle-status')?.dataset.world;if(!raw||!window.deathBattle)return;const world=JSON.parse(raw);for(const player of world.players.filter(p=>p.tankId===3)){const view=window.deathBattle.players.get(player.id);if(!view)continue;const clocks=structuredClone(view.root.metadata.actionClocks??[]);if((!player.alive||player.deaths>0)&&window.death.clockSamples.length<400)window.death.clockSamples.push({id:player.id,alive:player.alive,hp:player.hp,action:view.activeAction,clocks,frame:window.death.frames,tick:world.tick});const key=player.alive+':'+view.activeAction+':'+clocks.map(c=>c.overMessage).join(',');if(seen.get(player.id)!==key){seen.set(player.id,key);window.death.lives.push({id:player.id,alive:player.alive,action:view.activeAction,hp:player.hp,maxHp:player.maxHp,deaths:player.deaths,clocks,frame:window.death.frames});}}
        for(const stage of ['lastDraw','lastTail','lastRevive']){const row=window.death[stage];if(!row||row.frame!==window.death.frames)continue;const key=row.id+':'+stage;if(!window.death.captures[key])window.death.captures[key]={...row,world,canvas:engine.getRenderingCanvas().toDataURL('image/png')};}
      });
    })()`);
  }
  for(const s of [guest,host])await nativeClick(s,'[data-waiting-ready]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  const victimId=evidence.initial[0].playerId;
  assert(evidence.initial.every(s=>s.players.filter(p=>!p.isCpu).every(p=>p.tankId===3)));
  console.log('Normal0007 tank003 two webpages PLAYING; nativeSpace and natural destroy09/respawn01');
  const shooter=guest;
  await nativeClick(shooter,'#world');
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32},shooter);
  const gate=Date.now()+100000;let done=false,released=false,aimHeld;
  const releaseAim=async()=>{if(aimHeld){await command('Input.dispatchKeyEvent',{type:'keyUp',key:aimHeld,code:aimHeld,windowsVirtualKeyCode:aimHeld==='ArrowLeft'?37:39},shooter);aimHeld=undefined;}};
  while(Date.now()<gate){
    const state=await evaluate(shooter,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world),me=w.players.find(p=>p.id===w.playerId),target=w.players.find(p=>p.id===${JSON.stringify(victimId)}),yaw=me.yaw+me.aim,desired=Math.atan2(target.x-me.x,target.z-me.z);return {alive:target.alive,angle:Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw))}})()`);
    if(!state.alive&&!released){await command('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32},shooter);await releaseAim();released=true;}
    if(!released){const next=Math.abs(state.angle)<.05?undefined:state.angle>0?'ArrowLeft':'ArrowRight';if(next!==aimHeld){await releaseAim();if(next){aimHeld=next;await command('Input.dispatchKeyEvent',{type:'keyDown',key:next,code:next,windowsVirtualKeyCode:next==='ArrowLeft'?37:39},shooter);}}}
    const observations=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.death')));
    done=observations.every(o=>['M','U','X','Y'].every(part=>o.draws.some(d=>d.id===victimId&&d.part===part&&d.action==='09'))&&o.lives.some(l=>l.id===victimId&&l.alive&&l.action==='01'&&l.deaths>0&&l.hp===l.maxHp)&&o.captures[victimId+':lastDraw']&&['M','U','X','Y'].every(part=>o.draws.some(d=>d.id===victimId&&d.part===part&&d.action==='01'))&&o.captures[victimId+':lastRevive']);
    if(done)break;await new Promise(r=>setTimeout(r,100));
  }
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32},shooter);
  await releaseAim();
  assert(done,'Both pages original003 four09 reachable draws / natural3s respawn01; original actor-tick tail scope recorded separately');
  evidence.victimId=victimId;evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.death')));
  evidence.sameDestroy=evidence.observed[0].events.filter(e=>e.type==='destroy'&&e.targetId===victimId&&evidence.observed[1].events.some(f=>JSON.stringify(e)===JSON.stringify(f)));assert(evidence.sameDestroy.length);
  for(const [i,o]of evidence.observed.entries()){assert.equal(o.effectStarts.length,0,'Original003 has no09 ELK');assert(o.messages.filter(m=>m.owner==='player-'+victimId).some(m=>m.part==='M'&&m.identifier===1416378268));assert(o.messages.every(m=>m.before===m.after));assert(o.sounds.every(s=>s.message?.action!=='09'));assert(!o.sounds.some(s=>['GA12','ww154'].includes(s.reference)));for(const d of o.draws.filter(d=>d.id===victimId&&d.action==='09')){assert(d.time>=1&&d.time<=5501,'Original actor ticks advance to or hold the5501 tail');assert.equal(d.asset,'Data/role/003/09'+d.part+'.glb');assert(d.vertices>0);}for(const stage of ['lastDraw','lastTail','lastRevive']){const c=o.captures[victimId+':'+stage];assert(c);await writeFile(output+'-'+stage+'-'+(i+1)+'.png',Buffer.from(c.canvas.split(',')[1],'base64'));}for(const c of Object.values(o.captures))delete c.canvas;}
  const cleanup=()=>Promise.all(pages.map(p=>evaluate(p.sessionId,`({instances:window.deathBattle.effects.instances.length,effectMeshes:window.deathScene.meshes.filter(m=>m.metadata?.originalEffect).length,effectVoices:window.deathBattle.effects.sound.voices.size,battleVoices:window.deathBattle.sound.voices.size,players:window.deathBattle.players.size})`)));
  for(const page of pages)await nativeClick(page.sessionId,'[data-source-control=\"btnExit\"][data-leave-room], [data-summary-leave]');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);evidence.cleanup=await cleanup();for(const row of evidence.cleanup)assert.deepEqual(row,{instances:0,effectMeshes:0,effectVoices:0,battleVoices:0,players:0});
  evidence.status='PASS_T03_DEATH_RESPAWN_PENDING_PIXEL_REVIEW';console.log(evidence.status+': '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);console.error('Evidence',output+'.json');if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.death`).catch(e=>({error:String(e)}))));throw error;}
finally{
  evidence.runtimeErrors=runtimeErrors;
  if(ws)for(const page of pages)loadStages.push(await evaluate(page.sessionId,'window.deathLoadStages').catch(error=>({error:String(error)})));
  evidence.loadStages=loadStages;
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  await writeFile('recovery/output/combat-death-t03-whole-process-cleanup.json',JSON.stringify({ports:evidence.ports,tempRemoved:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
