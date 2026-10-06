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
const output='recovery/output/browser-scene-animation-0021-'+(roundOnly?'round-':'')+runId;
const traceOutput=resolve(output+'-server.jsonl');
const trace=async()=>{try{return (await readFile(traceOutput,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch(error){if(error.code==='ENOENT')return [];throw error;}};
const directory=await mkdtemp(join(tmpdir(),'cdtank-scene-animation-0021-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];
const evidence={status:'RUNNING',rematchLeaveOnly,roundOnly,ports:{server:3305,vite:5335,cdp:9535},mapId:21,tankId:1,
  scope:'Ordinary0021 dual001/twoCPU/Ready/autopilot General170 CVD three source nodes/dynamic tracks/vertices/texture and Leave/reentry; no player/clock/camera/notification injection. Software320x180; Web start0/rate1 convention.'};
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
  const env={...process.env,PORT:'3305',ACCOUNT_DB_PATH:database,CDTANK_BREACH_TRACE:traceOutput};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','--import','./tests/observers/breach-runtime.ts','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5335,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3305',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9535',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9535/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9535');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5335',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu')&&!document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url),engine=EngineStore.LastCreatedEngine,scene=EngineStore.LastCreatedScene;
      engine.setHardwareScalingLevel(4);engine.resize();window.breachScene=scene;
      window.breach={frames:0,draws:[],counts:{},captures:[],worlds:[]};
      const {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.breachBattle=this;return reconcile.apply(this,args);};
      const observe=mesh=>{mesh.onBeforeRenderObservable.add(()=>{
        if(mesh.metadata?.sourcePlacementId!=='170'||!mesh.metadata?.sourceSceneModel)return;
        const animation=window.breachBattle.battlefield.animations.find(a=>a.placementId==='170'),node=mesh.metadata.sourceSceneModelNode;
        if(!animation)return;
        const renderer=animation.renderer,clock=renderer.animations[node];
        const row={id:'170',node,frame:window.breach.frames+1,positions:Array.from(mesh.getVerticesData('position')??[]),uvs:Array.from(mesh.getVerticesData('uv')??[]),indices:Array.from(mesh.getIndices()??[]),texture:mesh.material.getActiveTextures().map(t=>t.url),worldMatrix:Array.from(mesh.getWorldMatrix().m),placementMatrix:animation.matrix,
          clocks:renderer.animations.map(c=>c?{time:c.time,loops:c.loops,matrix:c.matrix,rate:c.rate}:null),source:mesh.metadata.sourceSceneModel};
        window.breach.counts[node]=(window.breach.counts[node]??0)+1;
        const old=window.breach.draws.filter(d=>d.node===node);
        if(old.length<3&&!old.some(d=>JSON.stringify(d.positions)===JSON.stringify(row.positions)))window.breach.draws.push(row);
        window.breach.current??=[];window.breach.current.push(row);
      });};scene.meshes.forEach(observe);scene.onNewMeshAddedObservable.add(observe);
      scene.onAfterRenderObservable.add(()=>{
        window.breach.frames++;
        const raw=document.querySelector('#battle-status')?.dataset.world;if(raw&&window.breach.frames%20===0){const world=JSON.parse(raw);window.breach.worlds.push({frame:window.breach.frames,world});}
        if(new Set((window.breach.current??[]).map(r=>r.node)).size===3&&window.breach.captures.length<1){
          const world=JSON.parse(raw);window.breach.captures.push({frame:window.breach.frames,world,draws:window.breach.current,canvas:engine.getRenderingCanvas().toDataURL('image/png')});
        }
        window.breach.current=[];
      });
    })()`);
  }
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  await nativeClick(host,'#open-home');await waitUntil(host,`document.querySelector('[data-home-close]')`);await nativeClick(host,'[data-home-close]');
  if(!await evaluate(host,`document.querySelector('#create-room-controls').open`))await nativeClick(host,'#create-room-controls > summary');
  await nativeSelect(host,'#tank',1);await nativeSelect(host,'#room-mode',5);await waitUntil(host,`Array.from(document.querySelector('#room-map').options).some(o=>o.value==='21')`);await nativeSelect(host,'#room-map',21);await nativeClick(host,'#create-room');
  await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===2`);await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===3`);
  await nativeClick(guest,'#open-home');await waitUntil(guest,`document.querySelector('[data-home-close]')`);await nativeClick(guest,'[data-home-close]');await nativeSelect(guest,'#tank',1);
  await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})`);await nativeSelect(guest,'#room',roomId);await nativeClick(guest,'#join');
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);
  for(const s of [guest,host])await nativeClick(s,'[data-ready]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  assert(evidence.initial.every(w=>w.mode===5&&w.mapId===21));
  for(const page of pages)await nativeClick(page.sessionId,'[data-autopilot]');
  console.log('Ordinary0021 dual001/twoCPU General170 source CVD actual draws');
  await new Promise(r=>setTimeout(r,2500));
  for(const page of pages)await nativeClick(page.sessionId,'[data-autopilot]');
  evidence.routeInputs=[];
  const held=new Map(pages.map(p=>[p.sessionId,new Set()]));
  const keys=async(session,next)=>{const old=held.get(session),codes={KeyW:87,KeyA:65,KeyD:68};for(const [type,values]of [['keyUp',[...old].filter(k=>!next.has(k))],['keyDown',[...next].filter(k=>!old.has(k))]])for(const code of values)await command('Input.dispatchKeyEvent',{type,code,key:code.slice(3).toLowerCase(),windowsVirtualKeyCode:codes[code]},session);held.set(session,next);};
  for(const page of pages)await nativeClick(page.sessionId,'#world');
  const gate=Date.now()+100000;let complete=false;
  while(Date.now()<gate){
    const observations=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.breach')));
    if(observations.every(o=>[0,1,2].every(node=>o.draws.filter(d=>d.node===node).length===3)&&o.captures.length===1)){evidence.observed=observations;complete=true;break;}
    for(const [index,page]of pages.entries()){
      const world=await evaluate(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`),player=world.players.find(p=>p.id===world.playerId);
      const bearing=Math.atan2(-751.9048461914062-player.x,-970.8339233398438-player.z),turn=Math.atan2(Math.sin(bearing-player.yaw),Math.cos(bearing-player.yaw));
      const next=new Set();
      if([0,1,2].some(node=>observations[index].draws.filter(d=>d.node===node).length<3)){
        if(Math.abs(turn)>.07)next.add(turn>0?'KeyA':'KeyD');
        if(Math.abs(turn)<.15&&Math.hypot(-751.9048461914062-player.x,-970.8339233398438-player.z)>500)next.add('KeyW');
      }
      await keys(page.sessionId,next);evidence.routeInputs.push({page:index+1,frame:observations[index].frames,tick:world.tick,player,bearing,keys:[...next]});
    }
    await new Promise(r=>setTimeout(r,300));
  }
  for(const page of pages)await keys(page.sessionId,new Set());
  assert(complete,'Natural movement brings General170 three animated nodes into both views');
  for(const [index,o]of evidence.observed.entries()){
    assert.deepEqual(Object.keys(o.counts).sort(),['0','1','2']);
    for(const node of [0,1,2]){
      const rows=o.draws.filter(d=>d.node===node);assert.equal(new Set(rows.map(d=>JSON.stringify(d.positions))).size,3);
      assert(rows.every(d=>d.id==='170'&&d.source==='Data/scnobj/obj05025/obj05025.CVD'&&d.texture[0].endsWith('/Data/scnobj/obj05025/obj05025.png')));
      assert(rows.every(d=>d.clocks[node].rate===1&&d.clocks[node].time>=0));
    }
    assert(o.worlds.some(row=>row.world.players.some(p=>!p.isCpu&&p.isAutopilot)));
    await writeFile(output+'-natural-'+(index+1)+'.png',Buffer.from(o.captures[0].canvas.split(',')[1],'base64'));
  }
  const cleanup=()=>Promise.all(pages.map(p=>evaluate(p.sessionId,`({animations:window.breachBattle.battlefield.animations.length,sourceMeshes:window.breachScene.meshes.filter(m=>m.metadata?.sourceSceneModel).length,sourceTextures:window.breachScene.textures.filter(t=>t.url?.includes('obj05025.png')).length,instances:window.breachBattle.effects.instances.length,sceneVoices:window.breachBattle.effects.skillSound.voices.size,battleVoices:window.breachBattle.sound.voices.size})`)));
  for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await cleanup();assert(evidence.cleanup.every(row=>Object.values(row).every(v=>v===0)));
  if(!await evaluate(host,`document.querySelector('#create-room-controls').open`))await nativeClick(host,'#create-room-controls > summary');
  await nativeClick(host,'#create-room');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world||'null')?.mapLoaded`);
  const room=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(room)})`);await nativeSelect(guest,'#room',room);await nativeClick(guest,'#join');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world||'null')?.mapLoaded`);
  evidence.reentry=await cleanup();assert(evidence.reentry.every(row=>row.animations===1&&row.sourceMeshes===3&&row.sourceTextures===1));
  for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.reentryCleanup=await cleanup();assert(evidence.reentryCleanup.every(row=>Object.values(row).every(v=>v===0)));
  evidence.status='PASS';console.log('PASS: General170 dual three original CVD nodes, dynamic source tracks/vertices, texture/PNG and Leave/reentry');
}catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.serverTrace=await trace();if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.breach`).catch(e=>({error:String(e)}))));throw error;}
finally{
  evidence.output=output+'.json';console.log(evidence.output);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
