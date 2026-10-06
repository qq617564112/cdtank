import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation';
import {getBattlefield} from '../apps/server/src/battlefield';
import {findBotPath} from '../apps/server/src/battle/cpu/navigation';
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
const visualOnly=true;
const near66=false;
const lifecycleOnly=process.argv.includes('--lifecycle-only');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-scene-animation-0018-route-'+(roundOnly?'round-':'')+runId;
const traceOutput=resolve(output+'-server.jsonl');
const trace=async()=>{try{return (await readFile(traceOutput,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch(error){if(error.code==='ENOENT')return [];throw error;}};
const directory=await mkdtemp(join(tmpdir(),'cdtank-scene-animation-0018-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];
const evidence={status:'RUNNING',visualOnly,near66,rematchLeaveOnly,roundOnly,ports:{server:3307,vite:5337,cdp:9537},mapId:18,tankId:1,
  scope:'Ordinary0018 dual001/twoCPU/Ready/autopilot General66–69 CVD five geometry nodes/one empty parent/dynamic tracks/vertices/texture and Leave/reentry; no player/clock/camera/notification injection. Software320x180; Web start0/rate1 convention.'};
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
  const env={...process.env,PORT:'3307',ACCOUNT_DB_PATH:database,CDTANK_BREACH_TRACE:traceOutput};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','--import','./tests/observers/breach-runtime.ts','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5337,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3307',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9537',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9537/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9537');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5337',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu')&&!document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore,Vector3,Matrix,Viewport}=await import(url),engine=EngineStore.LastCreatedEngine,scene=EngineStore.LastCreatedScene;
      engine.setHardwareScalingLevel(${near66||visualOnly?1:4});engine.resize();window.breachScene=scene;
      window.breach={frames:0,draws:[],counts:{},captures:[],worlds:[]};
      const {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.breachBattle=this;return reconcile.apply(this,args);};
      const observe=mesh=>{mesh.onBeforeRenderObservable.add(()=>{
        if(!['66','67','68','69'].includes(mesh.metadata?.sourcePlacementId)||!mesh.metadata?.sourceSceneModel)return;
        const animation=window.breachBattle.battlefield.animations.find(a=>a.placementId===mesh.metadata.sourcePlacementId),node=mesh.metadata.sourceSceneModelNode;
        if(!animation)return;
        const renderer=animation.renderer,clock=renderer.animations[node];
        const row={id:animation.placementId,node,frame:window.breach.frames+1,positions:Array.from(mesh.getVerticesData('position')??[]),uvs:Array.from(mesh.getVerticesData('uv')??[]),indices:Array.from(mesh.getIndices()??[]),texture:mesh.material.getActiveTextures().map(t=>t.url),worldMatrix:Array.from(mesh.getWorldMatrix().m),placementMatrix:animation.matrix,
          clocks:renderer.animations.map(c=>c?{time:c.time,loops:c.loops,matrix:c.matrix,rate:c.rate}:null),source:mesh.metadata.sourceSceneModel};
        window.breach.counts[animation.placementId+':'+node]=(window.breach.counts[animation.placementId+':'+node]??0)+1;
        const old=window.breach.draws.filter(d=>d.node===node&&d.id===animation.placementId);
        if(old.length<3&&(!old.length||row.clocks[node].time!==old[old.length-1].clocks[node].time))window.breach.draws.push(row);
        window.breach.current??=[];window.breach.current.push(row);
      });};scene.meshes.forEach(observe);scene.onNewMeshAddedObservable.add(observe);
      scene.onAfterRenderObservable.add(()=>{
        window.breach.frames++;
        const raw=document.querySelector('#battle-status')?.dataset.world;if(raw&&window.breach.frames%20===0){const world=JSON.parse(raw);window.breach.worlds.push({frame:window.breach.frames,world});}
        for(const id of ['66','67','68','69'])if(new Set((window.breach.current??[]).filter(r=>r.id===id).map(r=>r.node)).size===5&&!window.breach.captures.some(c=>c.id===id)&&(()=>{const w=JSON.parse(raw||'null');if(w?.phase!=='PLAYING'||w.tick<20||id!=='69')return false;
          const transform=scene.activeCamera.getViewMatrix().multiply(scene.activeCamera.getProjectionMatrix()),viewport=new Viewport(0,0,engine.getRenderWidth(),engine.getRenderHeight());
          const points=window.breach.current.filter(r=>r.id===id).flatMap(r=>{const points=[];for(let i=0;i<r.positions.length;i+=3)points.push(Vector3.Project(new Vector3(...r.positions.slice(i,i+3)),Matrix.Identity(),transform,viewport));return points;});
          const x=points.map(p=>p.x),y=points.map(p=>p.y),z=points.map(p=>p.z);
          return Math.min(...x)>=0&&Math.max(...x)<=viewport.width&&Math.min(...y)>=0&&Math.max(...y)<=viewport.height&&Math.max(...x)-Math.min(...x)>=30&&Math.max(...y)-Math.min(...y)>=20&&Math.min(...z)>0&&Math.max(...z)<1;
        })()){
          const world=JSON.parse(raw);window.breach.captures.push({id,frame:window.breach.frames,world,draws:window.breach.current.filter(r=>r.id===id),camera:{view:Array.from(scene.activeCamera.getViewMatrix().m),projection:Array.from(scene.activeCamera.getProjectionMatrix().m),position:scene.activeCamera.globalPosition.asArray(),target:scene.activeCamera.getTarget().asArray(),width:engine.getRenderWidth(),height:engine.getRenderHeight()},canvas:engine.getRenderingCanvas().toDataURL('image/png')});
        }
        window.breach.current=[];
      });
    })()`);
  }
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  await nativeClick(host,'#open-home');await waitUntil(host,`document.querySelector('[data-home-close]')`);await nativeClick(host,'[data-home-close]');
  if(!await evaluate(host,`document.querySelector('#create-room-controls').open`))await nativeClick(host,'#create-room-controls > summary');
  await nativeSelect(host,'#tank',1);await nativeSelect(host,'#room-mode',4);await waitUntil(host,`Array.from(document.querySelector('#room-map').options).some(o=>o.value==='18')`);await nativeSelect(host,'#room-map',18);await nativeClick(host,'#create-room');
  await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===2`);await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===3`);
  await nativeClick(guest,'#open-home');await waitUntil(guest,`document.querySelector('[data-home-close]')`);await nativeClick(guest,'[data-home-close]');await nativeSelect(guest,'#tank',1);
  await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})`);await nativeSelect(guest,'#room',roomId);await nativeClick(guest,'#join');
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);
  for(const s of [guest,host])await nativeClick(s,'[data-ready]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  assert(evidence.initial.every(w=>w.mode===4&&w.mapId===18));
  evidence.owners=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.breachBattle.battlefield.animations.map(a=>({id:a.placementId,matrix:a.matrix,geometryNodes:a.renderer.meshes.map(m=>m.metadata.sourceSceneModelNode),clocks:a.renderer.animations.map(c=>c?{time:c.time,rate:c.rate,matrix:c.matrix}:null)}))`)));
  if(!lifecycleOnly)for(const page of pages)await nativeClick(page.sessionId,'[data-autopilot]');
  console.log('Ordinary0018 dual001/twoCPU General66–69 source CVD actual draws');
  if(!lifecycleOnly){
  await new Promise(r=>setTimeout(r,2500));
  for(const page of pages)await nativeClick(page.sessionId,'[data-autopilot]');
  evidence.routeInputs=[];
  const held=new Map(pages.map(p=>[p.sessionId,new Set()]));
  const keys=async(session,next)=>{const old=held.get(session),codes={KeyW:87,KeyA:65,KeyD:68};for(const [type,values]of [['keyUp',[...old].filter(k=>!next.has(k))],['keyDown',[...next].filter(k=>!old.has(k))]])for(const code of values)await command('Input.dispatchKeyEvent',{type,code,key:code.slice(3).toLowerCase(),windowsVirtualKeyCode:codes[code]},session);held.set(session,next);};
  for(const page of pages)await nativeClick(page.sessionId,'#world');
  const gate=Date.now()+(visualOnly?60000:75000);let complete=false;
  while(Date.now()<gate){
    const observations=await Promise.all(pages.map(p=>evaluate(p.sessionId,'({frames:window.breach.frames,draws:window.breach.draws.map(d=>({id:d.id,node:d.node})),captures:window.breach.captures.map(c=>({id:c.id,frame:c.frame}))})')));
    if(visualOnly&&observations.every(o=>o.captures.length>0)){evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.breach')));complete=true;break;}
    const common=(visualOnly?['69']:near66?['66']:['66','67','68','69']).find(id=>observations.every(o=>[0,2,3,4,5].every(node=>o.draws.filter(d=>d.id===id&&d.node===node).length===3)&&o.captures.some(c=>c.id===id)));
    if(common){evidence.commonPlacement=common;evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.breach')));complete=true;break;}
    for(const [index,page]of pages.entries()){
      const world=await evaluate(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`),player=world.players.find(p=>p.id===world.playerId);
      const targets=[{id:'66',x:272.762939453125,z:1267.0318603515625},{id:'67',x:-319.60919189453125,z:1269.3758544921875},{id:'68',x:-321.70135498046875,z:-1199.89501953125},{id:'69',x:270.45098876953125,z:-1197.5472412109375}];const sourceTarget=targets.find(t=>t.id==='69');
      const goal={x:sourceTarget.x,y:player.y,z:sourceTarget.z+340};
      const field=getBattlefield(18),sourceNavigation=createOriginalBotNavigation(field);
      const navigation={...sourceNavigation,cacheKey:sourceNavigation.cacheKey+':box26',canTraverse:(a,b)=>sourceNavigation.canTraverse(a,b)&&Math.hypot(field.move(a,b,26).x-b.x,field.move(a,b,26).z-b.z)<.01};
      const route=findBotPath(field,{x:player.x,y:player.y,z:player.z},goal,navigation);
      const waypoint=route.find(p=>Math.hypot(p.x-player.x,p.z-player.z)>45);
      const target=waypoint??sourceTarget;
      const bearing=Math.atan2(target.x-player.x,target.z-player.z),turn=Math.atan2(Math.sin(bearing-player.yaw),Math.cos(bearing-player.yaw));
      const next=new Set();
      if(near66||visualOnly||[0,2,3,4,5].some(node=>observations[index].draws.filter(d=>d.id===target.id&&d.node===node).length<3)){
        if(Math.abs(turn)>.07)next.add(turn>0?'KeyA':'KeyD');
        if(Math.abs(turn)<.15&&!!waypoint&&Math.hypot(target.x-player.x,target.z-player.z)>45)next.add('KeyW');
      }
      await command('Page.bringToFront',{},page.sessionId);
      await keys(page.sessionId,new Set());
      await keys(page.sessionId,next);
      await new Promise(resolve=>setTimeout(resolve,350));
      await keys(page.sessionId,new Set());
      evidence.routeInputs.push({route,goal,page:index+1,frame:observations[index].frames,tick:world.tick,player,bearing,keys:[...next]});
    }
    await new Promise(r=>setTimeout(r,300));
  }
  for(const page of pages)await keys(page.sessionId,new Set());
  assert(complete,'Natural movement brings General66–69 five geometry nodes into both views');
  for(const [index,o]of evidence.observed.entries()){
    if(visualOnly){const capture=o.captures[0];await writeFile(output+'-visible-'+(index+1)+'.png',Buffer.from(capture.canvas.split(',')[1],'base64'));continue;}
    assert([0,2,3,4,5].every(node=>o.counts[evidence.commonPlacement+':'+node]>=2));
    for(const node of [0,2,3,4,5]){
      const rows=o.draws.filter(d=>d.id===evidence.commonPlacement&&d.node===node);assert.equal(new Set(rows.map(d=>d.clocks[node].time)).size,3);
      if(node!==0)assert.equal(new Set(rows.map(d=>JSON.stringify(d.positions))).size,3);
      assert(rows.every(d=>d.id===evidence.commonPlacement&&d.source==='Data/scnobj/obj05018/obj05018.CVD'&&d.texture[0].endsWith('/Data/scnobj/obj05018/obj05018.png')));
      assert(rows.every(d=>d.clocks[node].rate===1&&d.clocks[node].time>=0));
    }
    assert(o.worlds.some(row=>row.world.players.some(p=>!p.isCpu&&p.isAutopilot)));
    await writeFile(output+'-natural-'+(index+1)+'.png',Buffer.from(o.captures.find(c=>c.id===evidence.commonPlacement).canvas.split(',')[1],'base64'));
  }
  }else{evidence.lifecycleOnly=true;}
  if(near66||visualOnly){evidence.status='PASS';console.log('PASS: ordinary PLAYING dual same-frame source draw canvas; visual recognition requires image review');}else{
  const cleanup=()=>Promise.all(pages.map(p=>evaluate(p.sessionId,`({animations:window.breachBattle.battlefield.animations.length,sourceMeshes:window.breachScene.meshes.filter(m=>m.metadata?.sourceSceneModel).length,sourceTextures:window.breachScene.textures.filter(t=>t.url?.includes('obj05018.png')).length,instances:window.breachBattle.effects.instances.length,sceneVoices:window.breachBattle.effects.skillSound.voices.size,battleVoices:window.breachBattle.sound.voices.size})`)));
  const leave=async()=>{for(const page of pages){if(!await evaluate(page.sessionId,`!!document.querySelector('#battle-status').dataset.world`))continue;const waiting=await evaluate(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world||'null')?.phase==='WAITING'`);if(waiting){if(!await evaluate(page.sessionId,`!!document.querySelector('[data-waiting-close]')`))await nativeClick(page.sessionId,'[data-open-waiting-room]');await waitUntil(page.sessionId,`!!document.querySelector('[data-waiting-close]')`);await nativeClick(page.sessionId,'[data-waiting-close]');}else await nativeClick(page.sessionId,'#leave');await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);}};
  await leave();
  evidence.cleanup=await cleanup();assert(evidence.cleanup.every(row=>Object.values(row).every(v=>v===0)));
  if(!await evaluate(host,`document.querySelector('#create-room-controls').open`))await nativeClick(host,'#create-room-controls > summary');
  await nativeClick(host,'#create-room');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world||'null')?.mapLoaded`);
  const room=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(room)})`);await nativeSelect(guest,'#room',room);await nativeClick(guest,'#join');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world||'null')?.mapLoaded`);
  evidence.reentry=await cleanup();assert(evidence.reentry.every(row=>row.animations===4&&row.sourceMeshes===20&&row.sourceTextures===4));
  await leave();
  evidence.reentryCleanup=await cleanup();assert(evidence.reentryCleanup.every(row=>Object.values(row).every(v=>v===0)));
  evidence.status='PASS';console.log('PASS: General66–69 dual five geometry nodes/one empty parent, dynamic source tracks/vertices, texture/PNG and Leave/reentry');
}
}catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.serverTrace=await trace();if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.breach`).catch(e=>({error:String(e)}))));throw error;}
finally{
  evidence.output=output+'.json';console.log(evidence.output);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
