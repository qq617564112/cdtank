import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
const WebSocket=createRequire(import.meta.url)('ws');
const rematchLeaveOnly=process.argv.includes('--rematch-leave-only');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-breach20-05462-'+runId;
const traceOutput=resolve(output+'-server.jsonl');
const trace=async()=>{try{return (await readFile(traceOutput,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch(error){if(error.code==='ENOENT')return [];throw error;}};
const directory=await mkdtemp(join(tmpdir(),'cdtank-breach20-05462-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];
const evidence={status:'RUNNING',rematchLeaveOnly,ports:{server:3293,vite:5323,cdp:9523},mapId:20,tankId:1,
  scope:rematchLeaveOnly?'Ordinary0020 two webpages/CPU/autopilot natural finish, normal rematch source model and collision restoration, normal leave resource cleanup. No state/camera injection; default autoplay.':'Ordinary mode5/0020 two webpages CPU/autopilot: selectedobj05462 original seven-node c9/GA41 destruction and sourceOBB footprint, rebuilt fade collision release and actual CPU entry, normal rematch restoration/leave. No state/camera injection; default autoplay; software framebuffer320x180.'};
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
  const env={...process.env,PORT:'3293',ACCOUNT_DB_PATH:database,CDTANK_BREACH_TRACE:traceOutput};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','--import','./tests/observers/breach-runtime.ts','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5323,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3293',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9523',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9523/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9523');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5323',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu')&&!document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url),engine=EngineStore.LastCreatedEngine,scene=EngineStore.LastCreatedScene;
      engine.setHardwareScalingLevel(4);engine.resize();window.breachScene=scene;
      window.breach={events:[],sounds:[],draws:[],visuals:[],calls:[],hitStages:[],captures:{},frames:0};
      const {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.breachBattle=this;return reconcile.apply(this,args);};
      const {ScenePreview}=await import('/src/assets/scenes/scene-preview.ts'),destroy=ScenePreview.prototype.destroyObject;
      ScenePreview.prototype.destroyObject=function(id,sound){window.breach.calls.push({id,frame:window.breach.frames});window.breach.currentDestroy=id;const result=destroy.call(this,id,sound);window.breach.currentDestroy=undefined;return result;};
      const {BattleSound}=await import('/src/audio/battle-sound.ts'),event=BattleSound.prototype.event;
      BattleSound.prototype.event=function(e,...args){window.breach.events.push(e);return event.call(this,e,...args);};
      const {EffectSkillSound}=await import('/src/audio/effect-skill-sound.ts'),play=EffectSkillSound.prototype.play;
      EffectSkillSound.prototype.play=function(reference,selector,position){const handle=play.call(this,reference,selector,position);if(reference==='GA41'){const voice=this.voices.get(handle),row={sourcePlacementId:window.breach.currentDestroy,handle,reference,selector,position:[...position],playing:false,ended:false,loop:voice?.audio.loop,src:voice?.audio.src};voice?.audio.addEventListener('playing',()=>{row.playing=true;});voice?.audio.addEventListener('ended',()=>{row.ended=true;row.duration=voice.audio.duration;});window.breach.sounds.push(row);}return handle;};
      const library=await(await fetch('/scene-breach-0020.json')).json();
      const counts=Object.fromEntries(library.resources.map(r=>[r.reference,r.nodes.length]));
      window.breach.framesById={};
      const observe=mesh=>{if(mesh.breachObserved)return;mesh.breachObserved=true;mesh.onBeforeRenderObservable.add(()=>{
        const id=mesh.metadata?.sourcePlacementId??mesh.name.split('/')[0],value=window.breachBattle?.battlefield.breakables.get(id);
        if(value?.broken?.model!=='obj05462'||!mesh.getTotalVertices())return;const broken=!!mesh.metadata?.sourceBreachBroken;
        const row={id,model:value.broken.model,mesh:mesh.name,broken,vertices:mesh.getTotalVertices(),sourceModel:mesh.metadata?.sourceModel,node:mesh.metadata?.sourceModelNode,positions:Array.from(mesh.getVerticesData('position')??[]).slice(0,24),matrix:Array.from(mesh.getWorldMatrix().m),textures:mesh.material?.getActiveTextures().map(t=>t.url),frame:window.breach.frames+1};
        if(broken){window.breach.framesById[id]??=[];window.breach.framesById[id].push(row);}
        const previous=window.breach.draws.filter(d=>d.mesh===row.mesh&&d.broken===broken);
        if(previous.length<3&&!previous.some(d=>JSON.stringify(d.positions)===JSON.stringify(row.positions)))window.breach.draws.push(row);
      });};scene.meshes.forEach(observe);scene.onNewMeshAddedObservable.add(observe);
      scene.onAfterRenderObservable.add(()=>{window.breach.frames++;if(!window.breachBattle)return;const raw=document.querySelector('#battle-status')?.dataset.world;if(!raw)return;
        const world=JSON.parse(raw),preview=window.breachBattle.battlefield;
        for(const [id,v]of preview.breakables){if(v.broken?.model!=='obj05462')continue;const visual=v.state.snapshot(),key=id+':'+world.match.round+':'+visual.fading+':'+visual.hidden;
          if(!window.breach.visuals.some(r=>r.key===key))window.breach.visuals.push({key,id,...visual,intactEnabled:v.root.isEnabled(),round:world.match.round,frame:window.breach.frames});
          const draws=window.breach.framesById[id]??[],reference='Data/scnobj/'+v.broken.model+'/c9.CVD';
          if(new Set(draws.map(d=>d.node)).size===counts[reference]&&!window.breach.captures[id])window.breach.captures[id]={id,model:v.broken.model,frame:window.breach.frames,world,alpha:visual.alpha,draws,canvas:engine.getRenderingCanvas().toDataURL('image/png')};
        }window.breach.framesById={};
      });
    })()`);
  }
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  await nativeClick(host,'#open-home');await waitUntil(host,`document.querySelector('[data-home-close]')`);await nativeClick(host,'[data-home-close]');
  if(!await evaluate(host,`document.querySelector('#create-room-controls').open`))await nativeClick(host,'#create-room-controls > summary');
  await nativeSelect(host,'#tank',1);await nativeSelect(host,'#room-mode',5);await waitUntil(host,`Array.from(document.querySelector('#room-map').options).some(o=>o.value==='20')`);await nativeSelect(host,'#room-map',20);await nativeClick(host,'#create-room');
  await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===2`);await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===3`);
  await nativeClick(guest,'#open-home');await waitUntil(guest,`document.querySelector('[data-home-close]')`);await nativeClick(guest,'[data-home-close]');await nativeSelect(guest,'#tank',1);
  await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})`);await nativeSelect(guest,'#room',roomId);await nativeClick(guest,'#join');
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);
  for(const s of [guest,host])await nativeClick(s,'[data-ready]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  assert(evidence.initial.every(w=>w.mode===5&&w.mapId===20&&w.match.objectives.length===117));
  if(rematchLeaveOnly)for(const page of pages)await nativeClick(page.sessionId,'[data-autopilot]');
  console.log(rematchLeaveOnly?'Normal0020 ordinary001 two webpages+CPU/autopilot PLAYING; natural remaining-time finish/rematch/leave':'Normal0020 ordinary001 two webpages+CPU PLAYING; normal keyboard320 aiming/fire/navigation');
  let id='320';
  evidence.navigation={targetId:'SCN:320',reason:'Both human spawns coincide near319 (~332 units); target320 is the nearest source05462.',samples:[]};
  const held=new Map(pages.map(p=>[p.sessionId,new Set()]));
  const keyCodes={KeyW:87,KeyS:83,KeyA:65,KeyD:68,ArrowLeft:37,ArrowRight:39,Space:32};
  const setKeys=async(session,next)=>{const old=held.get(session);for(const [type,keys]of [['keyUp',[...old].filter(k=>!next.has(k))],['keyDown',[...next].filter(k=>!old.has(k))]])for(const code of keys)await command('Input.dispatchKeyEvent',{type,code,key:code==='Space'?' ':code.startsWith('Key')?code.slice(3).toLowerCase():code,windowsVirtualKeyCode:keyCodes[code]},session);held.set(session,next);};
  const navigationStages=new Map(pages.map(p=>[p.sessionId,'APPROACH']));
  const navigate=async()=>{for(const p of pages){const w=await evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`),me=w.players.find(v=>v.id===w.playerId),target=w.match.objectives.find(o=>o.id==='SCN:320'),heading=Math.atan2(target.x-me.x,target.z-me.z),turn=Math.atan2(Math.sin(heading-me.yaw),Math.cos(heading-me.yaw)),aim=Math.atan2(Math.sin(heading-me.yaw-me.aim),Math.cos(heading-me.yaw-me.aim)),distance=Math.hypot(target.x-me.x,target.z-me.z),released=target.hp===0&&w.serverTime-target.destroyedAt>2100;const keys=new Set();if(Math.abs(turn)>.08)keys.add(turn>0?'KeyA':'KeyD');if(Math.abs(aim)>.08)keys.add(aim>0?'ArrowLeft':'ArrowRight');let stage=navigationStages.get(p.sessionId);if(target.hp===0&&stage==='APPROACH'&&distance<15)stage='RETREAT';if(stage==='RETREAT'&&distance>=160)stage='POST_SHOT';navigationStages.set(p.sessionId,stage);if(stage==='RETREAT'){if(Math.abs(turn)<.15)keys.add('KeyS');}else if(stage==='POST_SHOT'){if(Math.abs(aim)<.08)keys.add('Space');}else{if(target.hp>0&&Math.abs(aim)<.12)keys.add('Space');if((target.hp===0||distance>260)&&Math.abs(turn)<.25&&distance>3)keys.add('KeyW');}await setKeys(p.sessionId,keys);evidence.navigation.samples.push({tick:w.tick,playerId:me.id,x:me.x,y:me.y,z:me.z,yaw:me.yaw,aim:me.aim,distance,stage,targetHp:target.hp,destroyedAt:target.destroyedAt,keys:[...keys]});}};

  if(!rematchLeaveOnly){
  const gate=Date.now()+120000;let done=false;
  while(Date.now()<gate){
    await navigate();
    const observations=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.breach`)));
    const records=await trace();const collisionComplete=id=>{const rows=records.filter(r=>r.round===1&&(r.targetId??r.event?.targetId)==='SCN:'+id);return ['INTACT','FADING','RELEASED'].every(phase=>rows.some(r=>r.kind==='collisionPhase'&&r.phase===phase))&&rows.some(r=>r.kind==='actorEnteredClearedFootprint')&&rows.some(r=>r.kind==='projectileCrossedClearedFootprint')&&rows.some(r=>r.kind==='ordinaryProjectileImpact');};
    const common=Object.keys(observations[0].captures).find(id=>id==='320'&&collisionComplete(id)&&observations.every(o=>o.captures[id]&&o.sounds.some(s=>s.sourcePlacementId===id&&s.playing&&s.ended)&&o.visuals.some(v=>v.id===id&&v.hidden)));
    done=!!common;if(common)for(const page of pages)await evaluate(page.sessionId,`window.breach.capture=window.breach.captures[${JSON.stringify(common)}];Object.keys(window.breach.captures).filter(id=>id!==${JSON.stringify(common)}).forEach(id=>{delete window.breach.captures[id].canvas;});`);
    if(done)break;await new Promise(r=>setTimeout(r,150));
  }
  for(const p of pages)await setKeys(p.sessionId,new Set());
  assert(done,'Same natural source destruction dual c9/GA41/hide, collision release, CPU entry and ordinary surviving projectile crossing');
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.breach`)));
  id=evidence.observed[0].capture.id;evidence.targetId='SCN:'+id;evidence.traceOutput=traceOutput;evidence.collision=(await trace()).filter(r=>r.round===1&&(r.targetId??r.event?.targetId)===evidence.targetId);
  const phases=Object.fromEntries(evidence.collision.filter(r=>r.kind==='collisionPhase').map(r=>[r.phase,r]));assert(phases.INTACT.covered&&phases.FADING.covered&&!phases.RELEASED.covered);assert(!phases.INTACT.navigation.valid&&!phases.FADING.navigation.valid&&phases.RELEASED.navigation.valid);assert.equal(phases.INTACT.boxHit.boxId,evidence.targetId);assert.equal(phases.FADING.boxHit.boxId,evidence.targetId);assert.notEqual(phases.RELEASED.boxHit?.boxId,evidence.targetId);if(phases.RELEASED.serverTime!==undefined)assert(phases.RELEASED.serverTime-phases.RELEASED.destroyedAt>2000);assert(phases.RELEASED.navigationRevision>phases.FADING.navigationRevision);

  assert(evidence.observed.every(o=>o.capture.id===id),'Both pages observe the same source barrel actual draw');
  for(const [index,o]of evidence.observed.entries()){
    assert(o.sounds.some(s=>s.sourcePlacementId===id&&s.reference==='GA41'&&s.playing&&s.ended&&!s.loop),'Same barrel GA41 real playing/ended');
    assert(o.draws.some(d=>d.id===id&&!d.broken&&d.vertices>0),'Actual intact source POL draws');
    assert.equal(new Set(o.capture.draws.map(d=>d.node)).size,o.capture.draws.length);
    assert(o.draws.filter(d=>d.id===id&&d.broken).every(d=>d.sourceModel==='Data/scnobj/'+o.capture.model+'/c9.CVD'),'Correct source model');
    assert(new Set(o.draws.filter(d=>d.id===id&&d.broken&&d.node===0).map(d=>JSON.stringify(d.positions))).size>1,'Actual source CVD pose changes');
    assert(o.visuals.some(v=>v.id===id&&v.fading&&!v.hidden&&!v.intactEnabled));assert(o.visuals.some(v=>v.id===id&&v.hidden));
    await writeFile(output+'-natural-'+(index+1)+'.png',Buffer.from(o.capture.canvas.split(',')[1],'base64'));delete o.capture.canvas;
  }
  }
  evidence.targetId='SCN:'+id;
  evidence.destroyed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  const cleanup=()=>Promise.all(pages.map(p=>evaluate(p.sessionId,`({breakables:window.breachBattle.battlefield.breakables.size,brokenMeshes:window.breachScene.meshes.filter(m=>m.metadata?.sourceBreachBroken).length,instances:window.breachBattle.effects.instances.length,sceneVoices:window.breachBattle.effects.skillSound.voices.size,battleVoices:window.breachBattle.sound.voices.size})`)));
  if(!rematchLeaveOnly)for(const page of pages)await nativeClick(page.sessionId,'[data-autopilot]');
  const finishWorld=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  evidence.finishWait={remaining:finishWorld.remaining,allowanceSeconds:15};
  const finishGate=Date.now()+(finishWorld.remaining+15)*1000;let finished=false;
  while(Date.now()<finishGate){finished=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'`);if(finished)break;await new Promise(r=>setTimeout(r,1000));}
  assert(finished,'Ordinary natural mode5 match finishes');
  evidence.finished=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  for(const page of pages)await nativeClick(page.sessionId,'[data-rematch]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'&&JSON.parse(document.querySelector('#battle-status').dataset.world).match.round===2`);
  for(const page of pages)await waitUntil(page.sessionId,`window.breachBattle.battlefield.round===2&&window.breachBattle.battlefield.breakables.get(${JSON.stringify(id)}).root.isEnabled()`);
  evidence.rematch=await Promise.all(pages.map(p=>evaluate(p.sessionId,`(()=>{const preview=window.breachBattle.battlefield,v=preview.breakables.get(${JSON.stringify(id)});return {world:JSON.parse(document.querySelector('#battle-status').dataset.world),intactEnabled:v.root.isEnabled(),visual:v.state.snapshot(),soundPlayed:v.soundPlayed,brokenMeshes:window.breachScene.meshes.filter(m=>m.metadata?.sourceBreachBroken&&m.metadata.sourcePlacementId===${JSON.stringify(id)}).map(m=>({enabled:m.isEnabled()}))};})()`)));
  for(const row of evidence.rematch){assert(row.intactEnabled);assert.deepEqual(row.visual,{fading:false,hidden:false,alpha:1});assert(!row.soundPlayed);assert(row.brokenMeshes.every(m=>!m.enabled));assert(row.world.match.objectives.every(o=>o.hp===o.maxHp));}
  for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await cleanup();for(const row of evidence.cleanup)assert.deepEqual(row,{breakables:0,brokenMeshes:0,instances:0,sceneVoices:0,battleVoices:0});
  evidence.serverTrace=await trace();assert(evidence.serverTrace.some(r=>r.kind==='collisionPhase'&&r.round===2&&(r.targetId??r.event?.targetId)===evidence.targetId&&r.phase==='INTACT'&&r.covered&&!r.navigation.valid&&r.boxHit?.boxId===evidence.targetId));assert(evidence.serverTrace.some(r=>r.kind==='roomLeaveCleanup'&&r.activeDynamicBoxes===0));
  evidence.status='PASS';console.log('PASS: ordinary0020 natural rematch collision/visual restoration and leave');
}catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.serverTrace=await trace();if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.breach`).catch(e=>({error:String(e)}))));throw error;}
finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
