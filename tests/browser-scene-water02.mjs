import {connectBreachAuxiliary} from './helpers/breach-auxiliary.mjs';
import {getBattlefield} from '../apps/server/src/battlefield';
import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation';
import {findBotPath} from '../apps/server/src/battle/cpu/navigation';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
var WebSocket=createRequire(import.meta.url)('ws');
var directory=await mkdtemp(join(tmpdir(),'cdtank-water02-'));
var database=join(directory,'accounts.sqlite');
var server,chrome,vite,ws,aux;
var pages=[],contexts=[];
var runId=new Date().toISOString().replace(/[:.]/g,'-');
var output='recovery/output/browser-scene-water02-bank-'+runId;
var evidence={status:'RUNNING',ports:{server:3381,vite:5431,cdp:9631},mapId:2,tankId:1,
  scope:'Formal React legalmode1/map2 two renderers/two ordinary authenticated auxiliary players; corrected nativeUV/depth module; ordinary north-bank movement, river-facing canvas and Leave. No position/camera/state injection.'};
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
      return await evaluate(session, `(async()=>{var deadline=Date.now()+45000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#room-map-info')?.value+' tanks='+document.querySelector('#tank')?.options.length+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
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
  var env={...process.env,PORT:'3381',ACCOUNT_DB_PATH:database};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;
  var log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(var stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  var deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5431,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3381',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9631',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  var endpoint;for(var i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9631/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9631');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  var message = JSON.parse(String(raw));
  var callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});

  for(var index=0;index<2;index++){
    var {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    var {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5431/',browserContextId});
    var {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&!document.querySelector('[data-room-card-create]').disabled`);
    await evaluate(sessionId,`(async()=>{
      var source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      var {EngineStore}=await import(url),engine=EngineStore.LastCreatedEngine,scene=EngineStore.LastCreatedScene;
      window.sceneProof={frames:0,draws:[],counts:{},captures:{},spawns:[],releases:[]};
      var {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.sceneBattle=this;var w=args[0];if(w?.phase==='WAITING')window.sceneProof.initialPositions=Object.fromEntries(w.players.map(p=>[p.id,{x:p.x,z:p.z}]));return reconcile.apply(this,args);};
      var observe=mesh=>{
        if(!mesh.onBeforeRenderObservable)return;
        mesh.onBeforeRenderObservable.add(()=>{
          var id=mesh.metadata?.sourceSceneWater;if(!id||!mesh.getTotalVertices())return;
          var world=JSON.parse(document.querySelector('#battle-status').dataset.world||'null'),player=world?.players.find(p=>p.id===world.playerId);
          var baseline=window.sceneProof.initialPositions?.[player?.id];
          if(world?.phase!=='PLAYING'||!baseline||Math.hypot(player.x-baseline.x,player.z-baseline.z)<50)return;
          var goal=window.sceneProof.bankGoal;
          var bearing=Math.atan2(-750-player.x,-260-player.z);
          var facing=Math.atan2(Math.sin(bearing-player.yaw),Math.cos(bearing-player.yaw));
          if(!goal||Math.hypot(player.x-goal.x,player.z-goal.z)>100||Math.abs(facing)>.15)return;
          var water=window.sceneBattle?.battlefield.water;
          var texture=mesh.material?.albedoTexture?.url;
          var key=id+':'+texture;
          window.sceneProof.counts[id]=(window.sceneProof.counts[id]??0)+1;
          if(window.sceneProof.draws.some(r=>r.key===key))return;
          window.sceneProof.draws.push({key,id,name:mesh.name,frame:window.sceneProof.frames,
            positions:Array.from(mesh.getVerticesData('position')??[]),uvs:Array.from(mesh.getVerticesData('uv')??[]),
            indices:Array.from(mesh.getIndices()??[]),matrix:Array.from(mesh.getWorldMatrix().asArray()),
            texture,alpha:mesh.material?.alpha,textureMatrix:Array.from(mesh.material.albedoTexture.getTextureMatrix().asArray()),forceDepthWrite:mesh.material.forceDepthWrite,alphaIndex:mesh.alphaIndex,index:water?.textureIndex,offset:water?.offset,player});
          window.sceneProof.pendingCapture=id;
        });
      };
      scene.meshes.forEach(observe);scene.onNewMeshAddedObservable.add(observe);
      scene.onAfterRenderObservable.add(()=>{
        window.sceneProof.frames++;
        var id=window.sceneProof.pendingCapture;
        if(id){window.sceneProof.captures[id]={frame:window.sceneProof.frames,canvas:engine.getRenderingCanvas().toDataURL('image/png')};delete window.sceneProof.pendingCapture;}
      });
      window.sceneState=()=>({world:JSON.parse(document.querySelector('#battle-status').dataset.world||'null'),
        water:!!window.sceneBattle?.battlefield.water,index:window.sceneBattle?.battlefield.water?.textureIndex,
        offset:window.sceneBattle?.battlefield.water?.offset});
      window.sceneCleanup=()=>({owner:!!window.sceneBattle?.battlefield.water,
        meshes:scene.meshes.filter(m=>m.metadata?.sourceSceneWater).length,
        textures:scene.textures.filter(t=>t.url?.includes('/Data/image/water/CAUST')).length});
    })()`);
  }
  var host=pages[0].sessionId,guest=pages[1].sessionId;
  async function createRoom() {
    await nativeClick(host,'[data-room-card-create]');
    await waitUntil(host,`document.querySelector('[data-room-map-selector]')?.open&&document.querySelector('[data-map-selector-map="2"]')`);
    await nativeClick(host,'[data-map-selector-mode="1"]');
    await nativeClick(host,'[data-map-selector-map="2"]');
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
  aux=await connectBreachAuxiliary('ws://127.0.0.1:3381',roomId);
  evidence.auxiliaryPlayers=aux.members.map(m=>({playerId:m.playerId,accountId:m.accountId}));
  await aux.ready(1);
  for(var page of pages)await waitUntil(page.sessionId,`(()=>{var s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);
  for(var page of pages)await waitUntil(page.sessionId,`(()=>{var w=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return w?.mapLoaded&&w.renderedPlayers===4})()`);
  for(var s of [guest,host]){await waitUntil(s,`document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await nativeClick(s,'[data-waiting-ready]');var readyDeadline=Date.now()+15000;while(Date.now()<readyDeadline){var acknowledged=await evaluate(s,`(()=>{var w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='PLAYING'||w.match.readyPlayerIds.includes(w.playerId)})()`);if(acknowledged)break;await new Promise(r=>setTimeout(r,500));if(await evaluate(s,`(()=>{var w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='WAITING'&&!w.match.readyPlayerIds.includes(w.playerId)&&!!document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled})()`))await nativeClick(s,'[data-waiting-ready]');}}
  for(var page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  assert(evidence.initial.every(w=>w.mode===1&&w.mapId===2&&w.players.length===4));
  var snapshot=()=>Promise.all(pages.map(p=>evaluate(p.sessionId,'window.sceneState()')));
  evidence.loaded=await snapshot();
  assert(evidence.loaded.every(s=>s.water));
  evidence.routeInputs=[];
  var field=getBattlefield(2),navigation=createOriginalBotNavigation(field);
  var goals=[{x:-800,y:0,z:60},{x:-680,y:0,z:60}];
  for(var [index,page]of pages.entries())await evaluate(page.sessionId,`window.sceneProof.bankGoal=${JSON.stringify(goals[index])}`);
  var routeDeadline=Date.now()+90000;
  while(Date.now()<routeDeadline){
    var states=await snapshot();
    var observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.sceneProof')));
    if(observed.every(o=>o.captures.water&&o.captures.waves&&o.draws.filter(d=>d.id==='waves').length>=3))break;
    for(var [index,page]of pages.entries()){
      var world=states[index].world,player=world.players.find(p=>p.id===world.playerId);
      if(!player.alive)continue;
      if(observed[index].captures.water&&observed[index].captures.waves&&observed[index].draws.filter(d=>d.id==='waves').length>=3)continue;
      var goal=goals[index];
      var route=findBotPath(field,{x:player.x,y:player.y,z:player.z},goal,navigation);
      var near=Math.hypot(player.x-goal.x,player.z-goal.z)<80;
      var target=near?{x:-750,z:-260}:(route.find(p=>Math.hypot(p.x-player.x,p.z-player.z)>45)??goal);
      var bearing=Math.atan2(target.x-player.x,target.z-player.z);
      var turn=Math.atan2(Math.sin(bearing-player.yaw),Math.cos(bearing-player.yaw));
      var keys=[];
      if(Math.abs(turn)>.07)keys.push(turn>0?'KeyA':'KeyD');
      if(!near&&Math.abs(turn)<.15)keys.push('KeyW');
      await nativeClick(page.sessionId,'#world');
      for(var code of keys)await command('Input.dispatchKeyEvent',{type:'keyDown',code,key:code.slice(3).toLowerCase(),windowsVirtualKeyCode:{KeyA:65,KeyD:68,KeyW:87}[code]},page.sessionId);
      await new Promise(r=>setTimeout(r,keys.includes('KeyW')?350:50));
      for(var code of keys)await command('Input.dispatchKeyEvent',{type:'keyUp',code,key:code.slice(3).toLowerCase(),windowsVirtualKeyCode:{KeyA:65,KeyD:68,KeyW:87}[code]},page.sessionId);
      evidence.routeInputs.push({page:index+1,tick:world.tick,player,goal,route,keys});
    }
  }
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.sceneProof')));
  evidence.active=await snapshot();
  for(var [index,o]of evidence.observed.entries()){
    for(var id of ['water','waves'])if(o.captures[id])await writeFile(output+'-'+id+'-'+(index+1)+'.png',Buffer.from(o.captures[id].canvas.split(',')[1],'base64'));
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
  assert(evidence.leave.every(s=>!s.owner&&s.meshes===0&&s.textures===0));
  assert(evidence.observed.every(o=>o.captures.water&&o.captures.waves&&o.draws.filter(d=>d.id==='waves').length>=3),'Originalwater/waves draw and changing originalCAUST textures after ordinary movement');
  evidence.status='PASS';console.log('PASS: originalwater/waves first normalplayer output/Leave');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.sceneProof`).catch(e=>({error:String(e)}))));throw error;}
finally{
  if(ws){for(var p of pages){if(await evaluate(p.sessionId,`!!document.querySelector('[data-leave-room]')`).catch(()=>false))await nativeClick(p.sessionId,'[data-leave-room]').catch(()=>{});}evidence.finalCleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.sceneCleanup()').catch(e=>({error:String(e)}))));}
  evidence.output=output+'.json';console.log(evidence.output);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  await aux?.disconnect();
  if(ws){for(var p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  await writeFile('recovery/output/scene-water02-bank-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,serverClosed:server?.exitCode!==null||server?.signalCode!==null,chromeClosed:chrome?.exitCode!==null||chrome?.signalCode!==null,tempRemoved:true})+'\n');
}
