import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
const WebSocket=createRequire(import.meta.url)('ws');
const rematchLeaveOnly=false;
const roundOnly=process.argv.includes('--round-only');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-scene-effect20-052-'+(roundOnly?'round-':'')+runId;
const traceOutput=resolve(output+'-server.jsonl');
const trace=async()=>{try{return (await readFile(traceOutput,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch(error){if(error.code==='ENOENT')return [];throw error;}};
const directory=await mkdtemp(join(tmpdir(),'cdtank-scene-effect20-052-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];
const evidence={status:'RUNNING',rematchLeaveOnly,roundOnly,ports:{server:3302,vite:5332,cdp:9532},mapId:20,tankId:1,
  scope:'Ordinary0020 dual001/twoCPU/Ready/autopilot source052 retained placement trees, actual sprite draws/animation, texture/alpha, silent052 and Leave/reentry. No player position/HP/time/camera/notification injection; software320x180, default autoplay; round retention separately rule-verified.'};
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
  const env={...process.env,PORT:'3302',ACCOUNT_DB_PATH:database,CDTANK_BREACH_TRACE:traceOutput};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','--import','./tests/observers/breach-runtime.ts','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5332,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3302',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9532',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9532/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9532');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5332',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu')&&!document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url),engine=EngineStore.LastCreatedEngine,scene=EngineStore.LastCreatedScene;
      engine.setHardwareScalingLevel(4);engine.resize();window.breachScene=scene;
      window.breach={frames:0,draws:[],counts:{},captures:{},spawns:[],release:[],sounds:[]};
      const {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.breachBattle=this;return reconcile.apply(this,args);};
      const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');
      const spawn=EffectRuntime.prototype.spawnSceneEffect,release=EffectRuntime.prototype.releaseSceneEffect;
      EffectRuntime.prototype.spawnSceneEffect=async function(name,matrix,id){const handle=await spawn.call(this,name,matrix,id);window.breach.spawns.push({name,matrix:[...matrix],id,handle});return handle;};
      EffectRuntime.prototype.releaseSceneEffect=function(handle){window.breach.release.push(handle);return release.call(this,handle);};
      for(const path of ['/src/audio/effect-skill-sound.ts','/src/audio/effect-sound.ts']){
        const module=await import(path),type=module.EffectSkillSound??module.EffectSound,play=type.prototype.play;
        type.prototype.play=function(reference,...args){window.breach.sounds.push({reference,args});return play.call(this,reference,...args);};
      }
      const observe=mesh=>{mesh.onBeforeRenderObservable.add(()=>{
        const id=mesh.metadata?.sourceScenePlacementId,node=mesh.metadata?.sourceNode;
        if(!id||![2988,2989].includes(node))return;
        const key=id+':'+node;window.breach.counts[key]=(window.breach.counts[key]??0)+1;
        const row={id,node,frame:window.breach.frames,positions:Array.from(mesh.getVerticesData('position')??[]),colors:Array.from(mesh.getVerticesData('color')??[]),uvs:Array.from(mesh.getVerticesData('uv')??[]),textures:mesh.material.getActiveTextures().map(t=>t.url)};
        const prev=window.breach.draws.filter(r=>r.id===id&&r.node===node);
        if(prev.length<3&&!prev.some(r=>JSON.stringify(r.positions)===JSON.stringify(row.positions)))window.breach.draws.push(row);
        window.breach.current??=[];window.breach.current.push(row);
      });};scene.meshes.forEach(observe);scene.onNewMeshAddedObservable.add(observe);
      scene.onAfterRenderObservable.add(()=>{
        window.breach.frames++;
        const ids=[...new Set((window.breach.current??[]).map(r=>r.id))];
        for(const id of ids)if(new Set(window.breach.current.filter(r=>r.id===id).map(r=>r.node)).size===2&&!window.breach.captures[id])window.breach.captures[id]={frame:window.breach.frames,draws:window.breach.current.filter(r=>r.id===id),canvas:engine.getRenderingCanvas().toDataURL('image/png')};
        window.breach.current=[];
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
  console.log('Ordinary0020 dual001/twoCPU source052 actual sprite draws');
  const source=JSON.parse(await readFile('recovery/output/web-assets/scene-effects-0020.json','utf8'));
  const snapshot=()=>Promise.all(pages.map(page=>evaluate(page.sessionId,`({observed:window.breach,instances:window.breachBattle.effects.instances.filter(i=>i.scenePlacement).map(i=>({handle:i.handle,id:i.sourceScenePlacementId,matrix:i.tree.parentMatrix,nodes:i.tree.nodes.map(n=>({node:n.definition.index,retain:n.lifecycle.retainWhenEnded,phase:n.lifecycle.phase,elapsed:n.lifecycle.elapsed,appearance:n.sprite?.history.entries[0]}))}))})`)));
  evidence.loaded=await snapshot();
  if(roundOnly){
    const finishGate=Date.now()+210000;
    let finished=false;
    while(Date.now()<finishGate){
      finished=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'`);
      if(finished)break;await new Promise(r=>setTimeout(r,1000));
    }
    assert(finished,'OrdinaryCPU match naturally finishes');
    for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'`);
    evidence.finished=await snapshot();
    evidence.finishedWorld=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
    for(const page of pages)await nativeClick(page.sessionId,'[data-rematch]');
    for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).match.round===2`);
    evidence.rematch=await snapshot();
    for(const [index,page]of evidence.rematch.entries()){
      assert.deepEqual(page.instances.map(r=>r.handle),evidence.loaded[index].instances.map(r=>r.handle));
      assert.equal(page.observed.spawns.length,5);
      assert(page.instances.every((r,n)=>r.nodes.every((node,k)=>node.elapsed>=evidence.finished[index].instances[n].nodes[k].elapsed)));
    }
    for(const s of [guest,host])if(await evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='WAITING'`))await nativeClick(s,'[data-ready]');
    for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'&&JSON.parse(document.querySelector('#battle-status').dataset.world).match.round===2`);
    const drawGate=Date.now()+45000;let common;
    while(Date.now()<drawGate){
      const observed=await snapshot();
      common=source.effects.map(r=>r.id).find(id=>observed.every((page,index)=>[2988,2989].every(node=>(page.observed.counts[id+':'+node]??0)>(evidence.finished[index].observed.counts[id+':'+node]??0))));
      if(common){evidence.round2=observed;break;}await new Promise(r=>setTimeout(r,250));
    }
    assert(common,'Both source sprites naturally draw in round2');evidence.commonPlacementId=common;
    for(const [index,page]of evidence.round2.entries()){
      assert.deepEqual(page.instances.map(r=>r.handle),evidence.loaded[index].instances.map(r=>r.handle));
      assert.equal(page.observed.spawns.length,5);
      assert(page.instances.every((r,n)=>r.nodes.every((node,k)=>node.elapsed>evidence.finished[index].instances[n].nodes[k].elapsed)));
    }
    for(const page of pages)await nativeClick(page.sessionId,'#leave');
    for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
    evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({instances:window.breachBattle.effects.instances.length,ownedHandles:window.breachBattle.sceneEffects.handles.length,sourceMeshes:window.breachScene.meshes.filter(m=>m.metadata?.sourceScenePlacementId).length})`)));
    assert(evidence.cleanup.every(row=>Object.values(row).every(value=>value===0)));
    evidence.status='PASS';console.log('PASS: natural finish/rematch retains same five052 trees, advancing clocks and round2 actual dual sprite draws');
  }else{
  for(const page of evidence.loaded){
    assert.deepEqual(page.instances.map(i=>i.id),source.effects.map(i=>i.id));
    for(const instance of page.instances){assert.deepEqual(instance.matrix,source.effects.find(r=>r.id===instance.id).matrix);assert(instance.nodes.every(n=>n.retain));}
  }
  const gate=Date.now()+85000;let common;
  while(Date.now()<gate){
    const observations=await snapshot();
    common=source.effects.map(r=>r.id).find(id=>observations.every(o=>[2988,2989].every(node=>o.observed.draws.filter(d=>d.id===id&&d.node===node).length>=2)));
    if(common){evidence.observed=observations;break;}await new Promise(r=>setTimeout(r,300));
  }
  assert(common,'Both pages naturally submit both052 sprites at the same source placement');evidence.commonPlacementId=common;
  for(const [index,o] of evidence.observed.entries()){
    assert.equal(o.observed.spawns.length,5,'No per-frame scene spawning');
    assert(o.instances.every(i=>i.nodes.every(n=>n.phase===2&&n.elapsed>0)));
    assert(o.observed.sounds.every(s=>s.reference&&s.reference!=='052'),'No empty object name or052 sound creation');
    for(const node of [2988,2989]){
      const draws=o.observed.draws.filter(d=>d.id===common&&d.node===node);assert(draws.length>=2);
      assert(new Set(draws.map(d=>JSON.stringify(d.positions))).size>=2,'Natural rotating sprite vertices');
      for(const draw of draws){
        assert(draw.textures.every(t=>t.endsWith('/Data/effect/xy/FlareBrightOrange_yellow3.png')));
        assert.equal(draw.positions.length,18);assert.equal(draw.colors.length,24);
        const expected=(node===2988?102:168)/255;
        for(let v=0;v<6;v++){assert.deepEqual(draw.colors.slice(v*4,v*4+3),[1,1,1]);assert(Math.abs(draw.colors[v*4+3]-expected)<1e-7);}
        const x=draw.positions.filter((_,i)=>i%3===0).reduce((a,b)=>a+b,0)/6;
        const y=draw.positions.filter((_,i)=>i%3===1).reduce((a,b)=>a+b,0)/6;
        const z=draw.positions.filter((_,i)=>i%3===2).reduce((a,b)=>a+b,0)/6;
        const pos=source.effects.find(r=>r.id===common).position;
        assert(Math.abs(x+pos[0])<.001&&Math.abs(y-pos[1])<.001&&Math.abs(z-pos[2])<.001,'Source placement geometry centre');
      }
    }
    const capture=o.observed.captures[common];assert(capture&&capture.draws.length>=2);
    await writeFile(output+'-natural-'+(index+1)+'.png',Buffer.from(capture.canvas.split(',')[1],'base64'));
  }
  const cleanup=()=>Promise.all(pages.map(p=>evaluate(p.sessionId,`({instances:window.breachBattle.effects.instances.length,ownedHandles:window.breachBattle.sceneEffects.handles.length,sourceMeshes:window.breachScene.meshes.filter(m=>m.metadata?.sourceScenePlacementId).length,sceneVoices:window.breachBattle.effects.skillSound.voices.size,battleVoices:window.breachBattle.sound.voices.size})`)));
  for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await cleanup();for(const row of evidence.cleanup)assert.deepEqual(row,{instances:0,ownedHandles:0,sourceMeshes:0,sceneVoices:0,battleVoices:0});
  if(!await evaluate(host,`document.querySelector('#create-room-controls').open`))await nativeClick(host,'#create-room-controls > summary');
  await nativeClick(host,'#create-room');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world||'null')?.mapLoaded`);
  const nextRoom=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(nextRoom)})`);await nativeSelect(guest,'#room',nextRoom);await nativeClick(guest,'#join');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world||'null')?.mapLoaded`);
  evidence.reentry=await snapshot();
  for(const [index,page]of evidence.reentry.entries()){
    assert.equal(page.instances.length,5);assert.equal(page.observed.spawns.length,10);
    assert(page.instances.every(i=>!evidence.loaded[index].instances.some(old=>old.handle===i.handle)));
  }
  for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.reentryCleanup=await cleanup();for(const row of evidence.reentryCleanup)assert.deepEqual(row,{instances:0,ownedHandles:0,sourceMeshes:0,sceneVoices:0,battleVoices:0});
  evidence.serverTrace=await trace();evidence.status='PASS';console.log('PASS: dual natural052 sprites, five retained map trees, texture/alpha/silence and Leave/reentry');
  }
}catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.serverTrace=await trace();if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.breach`).catch(e=>({error:String(e)}))));throw error;}
finally{
  evidence.output=output+'.json';console.log(evidence.output);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
