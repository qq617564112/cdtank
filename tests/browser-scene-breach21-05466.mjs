import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
const WebSocket=createRequire(import.meta.url)('ws');
const directory=await mkdtemp(join(tmpdir(),'cdtank-breach21-05466-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3285,vite:5315,cdp:9515},mapId:21,tankId:105,
  scope:'Ordinary mode5/0021 two webpages CPU/autopilot; obj05466 original POL to c9 actual draw/fade, GA13 audio, leave and same-room rematch. No world/event/position injection.'};
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
  const env={...process.env,PORT:'3285',ACCOUNT_DB_PATH:database};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5315,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3285',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9515',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9515/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9515');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5315',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu')&&!document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url),engine=EngineStore.LastCreatedEngine,scene=EngineStore.LastCreatedScene;
      engine.setHardwareScalingLevel(4);engine.resize();window.breachScene=scene;
      window.breach={events:[],sounds:[],draws:[],visuals:[],calls:[],captures:{},frames:0};
      const {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.breachBattle=this;return reconcile.apply(this,args);};
      const {ScenePreview}=await import('/src/assets/scenes/scene-preview.ts'),destroy=ScenePreview.prototype.destroyObject;
      ScenePreview.prototype.destroyObject=function(id,sound){window.breach.calls.push({id,frame:window.breach.frames});window.breach.currentDestroy=id;const result=destroy.call(this,id,sound);window.breach.currentDestroy=undefined;return result;};
      const {BattleSound}=await import('/src/audio/battle-sound.ts'),event=BattleSound.prototype.event;
      BattleSound.prototype.event=function(e,...args){window.breach.events.push(e);return event.call(this,e,...args);};
      const {EffectSkillSound}=await import('/src/audio/effect-skill-sound.ts'),play=EffectSkillSound.prototype.play;
      EffectSkillSound.prototype.play=function(reference,selector,position){const handle=play.call(this,reference,selector,position);if(reference==='GA13'){const voice=this.voices.get(handle),row={sourcePlacementId:window.breach.currentDestroy,handle,reference,selector,position:[...position],playing:false,ended:false,loop:voice?.audio.loop,src:voice?.audio.src};voice?.audio.addEventListener('playing',()=>{row.playing=true;});voice?.audio.addEventListener('ended',()=>{row.ended=true;row.duration=voice.audio.duration;});window.breach.sounds.push(row);}return handle;};
      const observe=mesh=>{if(mesh.breachObserved)return;mesh.breachObserved=true;mesh.onBeforeRenderObservable.add(()=>{const id=mesh.metadata?.sourcePlacementId??mesh.name.split('/')[0];if(!id||window.breachBattle?.battlefield.breakables.get(id)?.broken?.model!=='obj05466')return;const broken=!!mesh.metadata?.sourceBreachBroken;if(!broken&&window.breach.draws.some(d=>d.mesh===mesh.name&&!d.broken))return;window.breach.draws.push({id,mesh:mesh.name,broken,vertices:mesh.getTotalVertices(),sourceModel:mesh.metadata?.sourceModel,node:mesh.metadata?.sourceModelNode,positions:Array.from(mesh.getVerticesData('position')??[]).slice(0,24),frame:window.breach.frames+1});});};
      scene.meshes.forEach(observe);scene.onNewMeshAddedObservable.add(observe);
      scene.onAfterRenderObservable.add(()=>{window.breach.frames++;if(!window.breachBattle)return;const raw=document.querySelector('#battle-status')?.dataset.world;if(!raw)return;const state=JSON.parse(raw),preview=window.breachBattle.battlefield;
        for(const [id,v]of preview.breakables){if(v.broken?.model!=='obj05466')continue;const visual=v.state.snapshot(),key=id+':'+visual.fading+':'+visual.hidden;if(!window.breach.visuals.some(r=>r.key===key))window.breach.visuals.push({key,id,...visual,intactEnabled:v.root.isEnabled(),round:state.match.round,frame:window.breach.frames});
          const draws=window.breach.draws.filter(d=>d.id===id&&d.broken&&d.frame===window.breach.frames);if(draws.length===9&&!window.breach.captures[id])window.breach.captures[id]={id,frame:window.breach.frames,world:state,alpha:visual.alpha,draws,canvas:engine.getRenderingCanvas().toDataURL('image/png')};}
      });
    })()`);
  }
  store=new AccountStore(database);const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(r=>r.tankId===105&&r.part===0);
  for(const [index,page]of pages.entries()){
    const account=store.open(await evaluate(page.sessionId,`localStorage.getItem('cdtank-account-token')`));
    const fields=v=>new Map(Object.entries(v).map(([k,v])=>[Number(k),v]));
    const equipment={name:'明确导入原战车',fields:fields(native.equipment)},base={name:'明确导入原宠物',fields:fields(native.base)};
    equipment.fields.set(0x1c,72);equipment.fields.set(0x24,105);equipment.fields.set(0x28,1050011);equipment.fields.set(0x2c,1050012);equipment.fields.set(0x30,1050013);
    store.replaceRoleRecords(account.accountId,{base:[base],equipment:[equipment]});
    const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa8,72,true);view.setUint32(0xa4,base.fields.get(0),true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
  }
  store.close();store=undefined;
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  await nativeClick(host,'#open-home');await waitUntil(host,`document.querySelector('[data-home-close]')`);await nativeClick(host,'[data-home-close]');
  if(!await evaluate(host,`document.querySelector('#create-room-controls').open`))await nativeClick(host,'#create-room-controls > summary');
  await nativeSelect(host,'#tank',105);await nativeSelect(host,'#room-mode',5);await waitUntil(host,`Array.from(document.querySelector('#room-map').options).some(o=>o.value==='21')`);await nativeSelect(host,'#room-map',21);await nativeClick(host,'#create-room');
  await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===2`);await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===3`);
  await nativeClick(guest,'#open-home');await waitUntil(guest,`document.querySelector('[data-home-close]')`);await nativeClick(guest,'[data-home-close]');await nativeSelect(guest,'#tank',105);
  await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})`);await nativeSelect(guest,'#room',roomId);await nativeClick(guest,'#join');
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);
  for(const s of [guest,host])await nativeClick(s,'[data-ready]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  assert(evidence.initial.every(w=>w.mode===5&&w.mapId===21&&w.match.objectives.length===73));
  for(const page of pages)await nativeClick(page.sessionId,'[data-autopilot]');
  console.log('Normal0021 original105 two webpages+CPU/autopilot PLAYING; natural source wood barrel destroy');
  const gate=Date.now()+210000;let done=false;
  while(Date.now()<gate){
    const observations=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.breach`)));
    const common=Object.keys(observations[0].captures).find(id=>observations.every(o=>o.captures[id]&&o.sounds.some(s=>s.sourcePlacementId===id&&s.playing&&s.ended)&&o.visuals.some(v=>v.id===id&&v.hidden)));
    done=!!common;if(common)for(const page of pages)await evaluate(page.sessionId,`window.breach.capture=window.breach.captures[${JSON.stringify(common)}];Object.keys(window.breach.captures).filter(id=>id!==${JSON.stringify(common)}).forEach(id=>{delete window.breach.captures[id].canvas;});`);
    if(done)break;await new Promise(r=>setTimeout(r,1000));
  }
  assert(done,'Natural obj05466 destruction must produce nine original c9 draws, GA13 and fade hidden on both pages');
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.breach`)));
  const id=evidence.observed[0].capture.id;
  assert(evidence.observed.every(o=>o.capture.id===id),'Both pages observe the same source barrel actual draw');
  for(const [index,o]of evidence.observed.entries()){
    assert(o.sounds.some(s=>s.sourcePlacementId===id&&s.reference==='GA13'&&s.playing&&s.ended&&!s.loop),'Same barrel GA13 real playing/ended');
    assert(o.draws.some(d=>d.id===id&&!d.broken&&d.vertices>0),'Actual intact source POL draws');
    assert.equal(new Set(o.draws.filter(d=>d.id===id&&d.broken).map(d=>d.node)).size,9);
    assert(o.draws.filter(d=>d.id===id&&d.broken).every(d=>d.sourceModel==='Data/scnobj/obj05466/c9.CVD'),'Correct source model');
    assert(new Set(o.draws.filter(d=>d.id===id&&d.broken&&d.node===0).map(d=>JSON.stringify(d.positions))).size>1,'Actual source CVD pose changes');
    assert(o.visuals.some(v=>v.id===id&&v.fading&&!v.hidden&&!v.intactEnabled));assert(o.visuals.some(v=>v.id===id&&v.hidden));
    await writeFile(`recovery/output/browser-scene-breach21-05466-natural-${index+1}.png`,Buffer.from(o.capture.canvas.split(',')[1],'base64'));delete o.capture.canvas;
  }
  evidence.destroyed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  const cleanup=()=>Promise.all(pages.map(p=>evaluate(p.sessionId,`({breakables:window.breachBattle.battlefield.breakables.size,brokenMeshes:window.breachScene.meshes.filter(m=>m.metadata?.sourceBreachBroken).length,instances:window.breachBattle.effects.instances.length,sceneVoices:window.breachBattle.effects.skillSound.voices.size,battleVoices:window.breachBattle.sound.voices.size})`)));
  const finishGate=Date.now()+210000;let finished=false;
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
  evidence.status='PASS';console.log('PASS: dual-page natural0021 obj05466 POL/c9 nine actual draws/GA13/fade/hide and same-room rematch/leave cleanup');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.breach`).catch(e=>({error:String(e)}))));throw error;}
finally{
  await writeFile('recovery/output/browser-scene-breach21-05466.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
