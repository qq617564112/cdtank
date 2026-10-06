import {connectBreachAuxiliary} from './helpers/breach-auxiliary.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
var WebSocket=createRequire(import.meta.url)('ws');
var directory=await mkdtemp(join(tmpdir(),'cdtank-breach07-shared-intact-'));
var database=join(directory,'accounts.sqlite');
var server,chrome,vite,ws,aux;
var pages=[],contexts=[];
var browserErrors=[];
var runId=new Date().toISOString().replace(/[:.]/g,'-');
var output='recovery/output/browser-scene-breach07-shared-intact-'+runId;
var evidence={status:'RUNNING',ports:{server:3541,vite:5571,cdp:9771},mapId:7,tankId:1,
  scope:'Formal React legalmode4/map7 two renderers/two ordinary authenticated auxiliary players; original Breach obj05423 texture-times-packed-diffuse/9placement opaque material consumer; ordinary spawn W/turn and first-renderer original NAV approach, host source material full canvas and dual Leave; guest material pixels remain unverified. No position/camera/state injection.'};
async function stop(child){if(child?.exitCode===null&&child.signalCode===null){var done=new Promise(r=>child.once('exit',r));child.kill();await done;}}
var sequence = 0;
var pending = new Map();
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    var id = ++sequence;
    pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, sessionId}));
  });
}
async function evaluate(session, expression) {
  var result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}, session);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitUntil(session, expression) {
  var deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      return await evaluate(session, `(async()=>{var deadline=Date.now()+30000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#room-map-info')?.value+' tanks='+document.querySelector('#tank')?.options.length+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed')
          && !String(error).includes('Inspected target navigated or closed')) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Page navigation timeout');
}
async function nativeClick(session, selector) {
  await waitUntil(session, `document.querySelector(${JSON.stringify(selector)})&&!document.querySelector(${JSON.stringify(selector)}).disabled`);
  await command('Page.bringToFront', {}, session);
  var point = await evaluate(session, `(()=>{var e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});var r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',clickCount:1,...point}, session);
  await command('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',clickCount:1,...point}, session);
}
try {
  var env={...process.env,PORT:'3541',ACCOUNT_DB_PATH:database};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;
  var log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(var stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  var deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5571,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3541',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9771',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  var endpoint;for(var i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9771/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9771');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  var message = JSON.parse(String(raw));
  if(message.method==='Runtime.exceptionThrown')browserErrors.push({sessionId:message.sessionId,
    text:message.params.exceptionDetails.text,description:message.params.exceptionDetails.exception?.description});
  var callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});

  for(var index=0;index<2;index++){
    var {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    var {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5571/',browserContextId});
    var {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Runtime.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&!document.querySelector('[data-room-card-create]').disabled`);
    await evaluate(sessionId,`(async()=>{
      var source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      var {EngineStore}=await import(url),engine=EngineStore.LastCreatedEngine,scene=EngineStore.LastCreatedScene;
      window.sceneProof={frames:0,draws:{},captures:{}};
      var {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.sceneBattle=this;var w=args[0];if(w?.phase==='WAITING')window.sceneProof.initialPositions=Object.fromEntries(w.players.map(p=>[p.id,{x:p.x,z:p.z}]));return reconcile.apply(this,args);};
      var observedSources=new WeakSet();
      var observe=mesh=>{
        mesh=mesh.sourceMesh??mesh;
        if(typeof mesh._draw!=='function'||typeof mesh._processRendering!=='function')return;
        if(observedSources.has(mesh))return;
        observedSources.add(mesh);
        var rendering=mesh._processRendering,draw=mesh._draw,context;
        mesh._processRendering=function(...args){
          var subMesh=args[1],batch=args[4];
          context={hardwareInstanced:args[5],instances:(batch?.visibleInstances?.[subMesh?._id]??[]).map(m=>({name:m.name,matrix:Array.from(m.getWorldMatrix().asArray())}))};
          try{return rendering.apply(this,args);}finally{context=undefined;}
        };
        mesh._draw=function(...args){
          var result=draw.apply(this,args);
          var material=this.material,shader=material?.metadata?.sourceBreachShader;if(!shader||material.metadata.sourceBreachModel!=='obj05423')return result;
          var world=JSON.parse(document.querySelector('#battle-status').dataset.world||'null'),player=world?.players.find(p=>p.id===world.playerId);
          if(world?.phase!=='PLAYING'||!player||!window.sceneProof.inputCompleted)return result;
          var record=window.sceneProof.draws[this.name];
          if(!record){record=window.sceneProof.draws[this.name]={name:this.name,shader,kind:material.metadata.sourceBreachKind,count:0,vertices:this.getTotalVertices(),matrix:Array.from(this.getWorldMatrix().asArray()),texture:material.getActiveTextures().map(t=>t.name),positionSample:Array.from(this.getVerticesData('position')??[]).slice(0,9),colorSample:Array.from(this.getVerticesData('color')??[]).slice(0,12),player};}
          record.count++;record.lastBatch=context;
          (record.drawFrames??=[]).push(window.sceneProof.frames+1);
          if(this.name.startsWith('58/')&&!window.sceneProof.captures.natural)window.sceneProof.pendingCapture=true;
          return result;
        };
      };
      scene.meshes.forEach(observe);scene.onNewMeshAddedObservable.add(observe);
      scene.onAfterRenderObservable.add(()=>{window.sceneProof.frames++;
        if(window.sceneProof.pendingCapture){window.sceneProof.captures.natural={frame:window.sceneProof.frames,canvas:engine.getRenderingCanvas().toDataURL('image/png')};delete window.sceneProof.pendingCapture;}});
      window.sceneState=()=>({world:JSON.parse(document.querySelector('#battle-status').dataset.world||'null'),owner:!!window.sceneBattle?.battlefield.breachMaterial,
        replacements:window.sceneBattle?.battlefield.breachMaterial?.replacements.length});
      window.sceneCleanup=()=>({owner:!!window.sceneBattle?.battlefield.breachMaterial,materials:scene.materials.filter(m=>['breach21-intact/','breach06-05423-intact/'].some(prefix=>m.name.startsWith(prefix))).length});
    })()`);
  }
  var host=pages[0].sessionId,guest=pages[1].sessionId;
  async function createRoom() {
    await nativeClick(host,'[data-room-card-create]');
    await waitUntil(host,`document.querySelector('[data-room-map-selector]')?.open&&document.querySelector('[data-map-selector-mode="4"]')`);
    await nativeClick(host,'[data-map-selector-mode="4"]');
    await nativeClick(host,'[data-map-selector-map="7"]');
    await nativeClick(host,'[data-map-selector-confirm]');
    await waitUntil(host,`document.querySelector('[data-room-create-dialog]')?.open&&document.querySelector('[data-room-create-confirm]')`);
    await nativeClick(host,'[data-room-create-confirm]');
    await waitUntil(host,`document.querySelector('#battle-status').dataset.world&&!document.querySelector('[data-room-create-dialog][open]')`);
  }
  async function joinRoom(roomId) {
    await waitUntil(guest,`document.querySelector('[data-room-card-id="'+${JSON.stringify(roomId)}+'"]')`);
    await nativeClick(guest,'[data-room-card-id="'+roomId+'"]');
    await nativeClick(guest,'[data-room-card-express]');
  }
  await createRoom();
  var roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await joinRoom(roomId);
  aux=await connectBreachAuxiliary('ws://127.0.0.1:3541',roomId);
  evidence.auxiliaryPlayers=aux.members.map(m=>({playerId:m.playerId,accountId:m.accountId}));
  await aux.ready(1);
  for(var page of pages)await waitUntil(page.sessionId,`(()=>{var s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);
  for(var page of pages)await waitUntil(page.sessionId,`(()=>{var w=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return w?.mapLoaded&&w.renderedPlayers===4})()`);
  for(var s of [guest,host]){await waitUntil(s,`document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await nativeClick(s,'[data-waiting-ready]');var readyDeadline=Date.now()+15000;while(Date.now()<readyDeadline){var acknowledged=await evaluate(s,`(()=>{var w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='PLAYING'||w.match.readyPlayerIds.includes(w.playerId)})()`);if(acknowledged)break;await new Promise(r=>setTimeout(r,500));if(await evaluate(s,`(()=>{var w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='WAITING'&&!w.match.readyPlayerIds.includes(w.playerId)&&!!document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled})()`))await nativeClick(s,'[data-waiting-ready]');}}
  for(var page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  assert(evidence.initial.every(w=>w.mode===4&&w.mapId===7&&w.players.length===4));
  var snapshot=()=>Promise.all(pages.map(p=>evaluate(p.sessionId,'window.sceneState()')));
  evidence.loaded=await snapshot();
  assert(evidence.loaded.every(s=>s.owner&&s.replacements===2));
  evidence.routeInputs=[];
  for(var [index,page]of pages.entries()){
    await nativeClick(page.sessionId,'#world');
    var before=await evaluate(page.sessionId,'window.sceneState()');
    await command('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w',windowsVirtualKeyCode:87},page.sessionId);
    await new Promise(r=>setTimeout(r,1600));
    await command('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w',windowsVirtualKeyCode:87},page.sessionId);
    await command('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyA',key:'a',windowsVirtualKeyCode:65},page.sessionId);
    await new Promise(r=>setTimeout(r,250));
    await command('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyA',key:'a',windowsVirtualKeyCode:65},page.sessionId);
    evidence.routeInputs.push({page:index+1,keys:['KeyW','KeyA'],before,after:await evaluate(page.sessionId,'window.sceneState()')});
    await evaluate(page.sessionId,'window.sceneProof.inputCompleted=true');
  }
  // Navigate only the first renderer to the new original Breach cluster.
  var sourceRoute=JSON.parse(await readFile('recovery/output/scene-breach07-shared-intact-entry-route.json','utf8'));
  evidence.sourceApproach={route:sourceRoute.route,inputs:[],reached:false};
  evidence.spawnObserved=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.sceneProof')));
  await evaluate(host,'window.sceneProof.inputCompleted=false;window.sceneProof.draws={};window.sceneProof.captures={};delete window.sceneProof.pendingCapture');
  await nativeClick(host,'#world');
  var held=new Set(),waypointIndex=0,approachDeadline=Date.now()+60000;
  async function setApproachKeys(next){
    for(var [type,keys]of [['keyUp',[...held].filter(k=>!next.has(k))],['keyDown',[...next].filter(k=>!held.has(k))]]){
      for(var code of keys)await command('Input.dispatchKeyEvent',{type,code,key:code.slice(3).toLowerCase(),windowsVirtualKeyCode:{KeyW:87,KeyA:65,KeyD:68}[code]},host);
    }
    held=next;
  }
  try{
    while(Date.now()<approachDeadline){
      var state=await evaluate(host,'window.sceneState()'),world=state.world;
      if(world?.phase!=='PLAYING')break;
      var player=world.players.find(p=>p.id===world.playerId);
      while(waypointIndex<sourceRoute.route.length&&Math.hypot(sourceRoute.route[waypointIndex].x-player.x,sourceRoute.route[waypointIndex].z-player.z)<18)waypointIndex++;
      if(waypointIndex===sourceRoute.route.length){evidence.sourceApproach.reached=true;break;}
      var target=sourceRoute.route[waypointIndex],bearing=Math.atan2(target.x-player.x,target.z-player.z);
      var turn=Math.atan2(Math.sin(bearing-player.yaw),Math.cos(bearing-player.yaw)),next=new Set();
      if(Math.abs(turn)>.07)next.add(turn>0?'KeyA':'KeyD');
      if(Math.abs(turn)<.15)next.add('KeyW');
      await setApproachKeys(next);
      evidence.sourceApproach.inputs.push({waypointIndex,player:{x:player.x,z:player.z,yaw:player.yaw},keys:[...next]});
      await new Promise(r=>setTimeout(r,100));
    }
  }finally{await setApproachKeys(new Set());}
  if(evidence.sourceApproach.reached){
    var targetBarrel=JSON.parse(await readFile('recovery/output/web-assets/scene-placements.json','utf8')).find(s=>s.id==='0007').records.find(p=>p.id==='58'&&p.model==='obj05423');
    var aimDeadline=Date.now()+10000;
    while(Date.now()<aimDeadline){
      var state=await evaluate(host,'window.sceneState()'),world=state.world;
      if(world?.phase!=='PLAYING')break;
      var player=world.players.find(p=>p.id===world.playerId);
      var bearing=Math.atan2(targetBarrel.position[0]-player.x,targetBarrel.position[2]-player.z);
      var turn=Math.atan2(Math.sin(bearing-player.yaw),Math.cos(bearing-player.yaw));
      evidence.sourceApproach.targetBearing=bearing;evidence.sourceApproach.targetYawError=turn;
      if(Math.abs(turn)<.07)break;
      await setApproachKeys(new Set([turn>0?'KeyA':'KeyD']));
      await new Promise(r=>setTimeout(r,100));
    }
    await setApproachKeys(new Set());
  }
  evidence.sourceApproach.endpoint=await evaluate(host,'window.sceneState()');
  await evaluate(host,'window.sceneProof.inputCompleted=true');
  var drawDeadline=Date.now()+5000;
  while(Date.now()<drawDeadline&&!await evaluate(host,'!!window.sceneProof.captures.natural'))await new Promise(r=>setTimeout(r,100));
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.sceneProof')));
  evidence.active=await snapshot();
  for(var [index,o]of evidence.observed.entries()){
    for(var id of ['natural'])if(o.captures[id])await writeFile(output+'-'+id+'-'+(index+1)+'.png',Buffer.from(o.captures[id].canvas.split(',')[1],'base64'));
    var screenshot=await command('Page.captureScreenshot',{format:'png'},pages[index].sessionId);
    await writeFile(output+'-actual-'+(index+1)+'.png',Buffer.from(screenshot.data,'base64'));
  }
  for(var page of [pages[1],pages[0]]){
    var selector=await evaluate(page.sessionId,`['[data-leave-room]','[data-waiting-close]','[data-summary-leave]'].find(s=>{var e=document.querySelector(s);return e&&!e.disabled;})`);
    assert(selector,'Normal phase source exit');
    await nativeClick(page.sessionId,selector);
    await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  }
  await aux.leave(1);
  evidence.leave=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.sceneCleanup()')));
  assert(evidence.leave.every(s=>!s.owner&&s.materials===0));
  assert(evidence.sourceApproach.reached&&evidence.observed[0].captures.natural&&Object.values(evidence.observed[0].draws).some(d=>d.kind===0&&d.name.startsWith('58/')), 'Original intact Breach58 material actual draw after ordinary input release');
  evidence.status='PASS_HOST_MATERIAL_NORMAL_LEAVE';console.log('PASS: originalBreach07 shared intact material normalplayer output/Leave');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.sceneProof`).catch(e=>({error:String(e)}))));throw error;}
finally{
  if(ws){for(var [index,p]of pages.entries()){
    if(evidence.status==='FAIL'){
      var screen=await command('Page.captureScreenshot',{format:'png'},p.sessionId).catch(()=>null);
      if(screen)await writeFile(output+'-failure-actual-'+(index+1)+'.png',Buffer.from(screen.data,'base64'));
    }
    if(await evaluate(p.sessionId,`!!document.querySelector('[data-leave-room]')`).catch(()=>false)){
      await nativeClick(p.sessionId,'[data-leave-room]').catch(()=>{});
      await waitUntil(p.sessionId,`!document.querySelector('#battle-status').dataset.world`).catch(error=>{
        evidence.leaveError=String(error);
      });
    }
  }evidence.finalCleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.sceneCleanup()').catch(e=>({error:String(e)}))));}
  evidence.browserErrors=browserErrors;
  if(ws)evidence.finalLoadState=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({status:document.querySelector('#battle-status')?.value,world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null'),resourcesReady:window.sceneBattle?.resourcesReady,loadingError:String(window.sceneBattle?.loadingError??''),generalOwner:!!window.sceneBattle?.battlefield.breachMaterial})`).catch(e=>({error:String(e)}))));
  await writeFile(output+'-server.log',log??'');
  evidence.output=output+'.json';console.log(evidence.output);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  await aux?.disconnect();
  if(ws){for(var p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  await writeFile('recovery/output/scene-breach07-shared-intact-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,serverClosed:server?.exitCode!==null||server?.signalCode!==null,chromeClosed:chrome?.exitCode!==null||chrome?.signalCode!==null,tempRemoved:true})+'\n');
}
