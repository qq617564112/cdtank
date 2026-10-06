import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
const WebSocket=createRequire(import.meta.url)('ws');
const rematchLeaveOnly=false;
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-breach20-05435-'+runId;
const traceOutput=resolve(output+'-server.jsonl');
const trace=async()=>{try{return (await readFile(traceOutput,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch(error){if(error.code==='ENOENT')return [];throw error;}};
const directory=await mkdtemp(join(tmpdir(),'cdtank-breach20-05435-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];
const evidence={status:'RUNNING',rematchLeaveOnly,ports:{server:3300,vite:5330,cdp:9530},mapId:20,tankId:1,
  scope:'Ordinary mode5/0020 two001 webpages/twoCPU/autopilot natural destruction of one original05435; intactPOL, sourcec9 actual draws/animation, GA12 playing-ended, hidden and normalLeave. No state/position/HP/clock/camera injection; default autoplay; software320x180. Thinbounds unchanged, collision/pass-through and rematch excluded.'};
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
  const env={...process.env,PORT:'3300',ACCOUNT_DB_PATH:database,CDTANK_BREACH_TRACE:traceOutput};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','--import','./tests/observers/breach-runtime.ts','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5330,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3300',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9530',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9530/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9530');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5330',browserContextId});
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
      EffectSkillSound.prototype.play=function(reference,selector,position){const handle=play.call(this,reference,selector,position);if(reference==='GA12'){const voice=this.voices.get(handle),row={sourcePlacementId:window.breach.currentDestroy,handle,reference,selector,position:[...position],playing:false,ended:false,loop:voice?.audio.loop,src:voice?.audio.src};voice?.audio.addEventListener('playing',()=>{row.playing=true;});voice?.audio.addEventListener('ended',()=>{row.ended=true;row.duration=voice.audio.duration;});window.breach.sounds.push(row);}return handle;};
      const library=await(await fetch('/scene-breach-0020.json')).json();
      const counts=Object.fromEntries(library.resources.map(r=>[r.reference,r.nodes.filter(n=>n.parts.length).length]));
      window.breach.framesById={};
      const observe=mesh=>{if(mesh.breachObserved)return;mesh.breachObserved=true;mesh.onBeforeRenderObservable.add(()=>{
        const id=mesh.metadata?.sourcePlacementId??mesh.name.split('/')[0],value=window.breachBattle?.battlefield.breakables.get(id);
        if(value?.broken?.model!=='obj05435'||!mesh.getTotalVertices())return;const broken=!!mesh.metadata?.sourceBreachBroken;
        const row={id,model:value.broken.model,mesh:mesh.name,broken,vertices:mesh.getTotalVertices(),sourceModel:mesh.metadata?.sourceModel,node:mesh.metadata?.sourceModelNode,positions:Array.from(mesh.getVerticesData('position')??[]).slice(0,24),matrix:Array.from(mesh.getWorldMatrix().m),textures:mesh.material?.getActiveTextures().map(t=>t.url),frame:window.breach.frames+1};
        if(broken){window.breach.framesById[id]??=[];window.breach.framesById[id].push(row);}
        const previous=window.breach.draws.filter(d=>d.mesh===row.mesh&&d.broken===broken);
        if(previous.length<3&&!previous.some(d=>JSON.stringify(d.positions)===JSON.stringify(row.positions)))window.breach.draws.push(row);
      });};scene.meshes.forEach(observe);scene.onNewMeshAddedObservable.add(observe);
      scene.onAfterRenderObservable.add(()=>{window.breach.frames++;if(!window.breachBattle)return;const raw=document.querySelector('#battle-status')?.dataset.world;if(!raw)return;
        const world=JSON.parse(raw),preview=window.breachBattle.battlefield;
        for(const [id,v]of preview.breakables){if(v.broken?.model!=='obj05435')continue;const visual=v.state.snapshot(),key=id+':'+world.match.round+':'+visual.fading+':'+visual.hidden;
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
  for(const page of pages)await nativeClick(page.sessionId,'[data-autopilot]');
  console.log('Ordinary0020 two001 webpages+twoCPU natural input destruction; original05435/GA12');
  const gate=Date.now()+140000;let done=false,id;
  while(Date.now()<gate){
    const observations=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.breach')));
    const common=Object.keys(observations[0].captures).find(id=>observations.every(o=>o.captures[id]&&o.sounds.some(s=>s.sourcePlacementId===id&&s.playing&&s.ended)&&o.visuals.some(v=>v.id===id&&v.hidden)));
    if(common){id=common;done=true;break;}await new Promise(r=>setTimeout(r,500));
  }
  assert(done,'Same natural05435 destruction dual original c9/GA12 playing-ended/hidden');
  evidence.targetId='SCN:'+id;evidence.traceOutput=traceOutput;
  for(const page of pages)await evaluate(page.sessionId,`window.breach.capture=window.breach.captures[${JSON.stringify(id)}];`);
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.breach')));
  const library=JSON.parse(await readFile('recovery/output/web-assets/scene-breach-0020.json','utf8')),resource=library.resources.find(r=>r.reference==='Data/scnobj/obj05435/c9.CVD'),sourceNodes=resource.nodes.map((n,i)=>n.parts.length?i:null).filter(i=>i!==null);
  evidence.sourceGeometryNodes=sourceNodes;
  for(const [index,o]of evidence.observed.entries()){
    assert(o.sounds.some(s=>s.sourcePlacementId===id&&s.reference==='GA12'&&s.playing&&s.ended&&!s.loop));
    assert.equal(o.sounds.filter(s=>s.sourcePlacementId===id).length,1,'Single original GA12 for same source destruction');
    assert(o.draws.some(d=>d.id===id&&!d.broken&&d.vertices>0));
    assert.deepEqual([...new Set(o.capture.draws.map(d=>d.node))].sort((a,b)=>a-b),sourceNodes);
    assert(o.capture.draws.every(d=>d.sourceModel===resource.reference));
    assert(sourceNodes.some(node=>new Set(o.draws.filter(d=>d.id===id&&d.broken&&d.node===node).map(d=>JSON.stringify(d.positions))).size>1),'Actual original CVD pose changes');
    assert(o.visuals.some(v=>v.id===id&&v.fading&&!v.hidden&&!v.intactEnabled));assert(o.visuals.some(v=>v.id===id&&v.hidden));
    await writeFile(output+'-natural-'+(index+1)+'.png',Buffer.from(o.capture.canvas.split(',')[1],'base64'));
  }
  evidence.destroyed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  const cleanup=()=>Promise.all(pages.map(p=>evaluate(p.sessionId,`({breakables:window.breachBattle.battlefield.breakables.size,brokenMeshes:window.breachScene.meshes.filter(m=>m.metadata?.sourceBreachBroken).length,instances:window.breachBattle.effects.instances.length,sceneVoices:window.breachBattle.effects.skillSound.voices.size,battleVoices:window.breachBattle.sound.voices.size})`)));
  for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await cleanup();for(const row of evidence.cleanup)assert.deepEqual(row,{breakables:0,brokenMeshes:0,instances:0,sceneVoices:0,battleVoices:0});
  evidence.serverTrace=await trace();
  evidence.status='PASS';console.log('PASS: ordinary0020 same05435 dual original c9 meshes/animation, GA12 once/ended, hidden and normal Leave');
}catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.serverTrace=await trace();if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.breach`).catch(e=>({error:String(e)}))));throw error;}
finally{
  evidence.output=output+'.json';console.log(evidence.output);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
