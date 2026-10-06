import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
var WebSocket=createRequire(import.meta.url)('ws');
var directory=await mkdtemp(join(tmpdir(),'cdtank-environment-sound07-'));
var database=join(directory,'accounts.sqlite');
var server,chrome,vite,ws;
var pages=[],contexts=[];
var runId=new Date().toISOString().replace(/[:.]/g,'-');
var output='recovery/output/browser-scene-environment-sound07-'+runId;
var evidence={status:'RUNNING',ports:{server:3323,vite:5353,cdp:9553},mapId:7,tankId:1,
  scope:'Formal React lobby ordinary mode1/map7 dual001+twoCPU Ready/autopilot; four original spatial loops and nonzero browser master-output signal, Leave/reentry/Leave; default autoplay.'};
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
  var env={...process.env,PORT:'3323',ACCOUNT_DB_PATH:database};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;
  var log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(var stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  var deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5353,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3323',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9553',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  var endpoint;for(var i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9553/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9553');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    var {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5353/',browserContextId});
    var {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&!document.querySelector('[data-room-card-create]').disabled`);
    await evaluate(sessionId,`(async()=>{
      var source=await(await fetch('/src/render/scene-runtime.ts')).text();var url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      var {EngineStore}=await import(url),engine=EngineStore.LastCreatedEngine;engine.setHardwareScalingLevel(4);engine.resize();
      window.environment={samples:[],loads:[],clears:[],sounds:[],lastSample:0};window.environmentOld=[];
      var {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.environmentBattle=this;return reconcile.apply(this,args);};
      var {MapEnvironmentSound}=await import('/src/audio/map-environment-sound.ts');
      var load=MapEnvironmentSound.prototype.load,update=MapEnvironmentSound.prototype.update,clear=MapEnvironmentSound.prototype.clear;
      MapEnvironmentSound.prototype.load=async function(id){window.environmentOwner=this;await load.call(this,id);function observeDisconnect(voice,key){var node=voice[key],disconnect=node.disconnect;node.disconnect=function(...args){voice.disconnectCalls.push(key);return disconnect.apply(this,args);};}for(var [placementId,v]of this.voices){v.disconnectCalls=[];for(var key of ['source','panner','gain'])observeDisconnect(v,key);var row={id:placementId,name:v.placement.name,src:v.audio.src,loop:v.audio.loop,playing:!v.audio.paused&&v.audio.currentTime>0};v.audio.addEventListener('playing',function(row){return ()=>{row.playing=true;};}(row));window.environment.sounds.push(row);}if(this.master){window.environmentAnalyser=this.context.createAnalyser();window.environmentAnalyser.fftSize=256;this.master.connect(window.environmentAnalyser);}window.environment.loads.push({mapId:id,count:this.voices.size});};
      MapEnvironmentSound.prototype.clear=function(){for(var v of this.voices.values())window.environmentOld.push(v);clear.call(this);window.environment.clears.push({count:this.voices.size});};
      window.environmentState=()=>{var signal=new Float32Array(256);window.environmentAnalyser?.getFloatTimeDomainData(signal);var outputPeak=Math.max(...signal.map(Math.abs));var o=window.environmentOwner,b=window.environmentBattle,c=o?.context,l=c?.listener;return {outputPeak,world:JSON.parse(document.querySelector('#battle-status').dataset.world||'null'),count:o?.voices.size??0,context:c?.state,sharedContext:c===b?.effects.audioContext(),volume:o?.master?.gain.value,listener:l?[l.positionX.value,l.positionY.value,l.positionZ.value]:[],voices:Array.from(o?.voices.values()??[]).map(v=>({id:v.placement.id,name:v.placement.name,position:[v.panner.positionX.value,v.panner.positionY.value,v.panner.positionZ.value],gain:v.gain.gain.value,loop:v.audio.loop,paused:v.audio.paused,time:v.audio.currentTime,duration:v.audio.duration,src:v.audio.src})),old:window.environmentOld.map(v=>({id:v.placement.id,paused:v.audio.paused,time:v.audio.currentTime,disconnectCalls:v.disconnectCalls}))};};
      MapEnvironmentSound.prototype.update=function(){update.call(this);if(performance.now()-window.environment.lastSample>1000&&this.voices.size){window.environment.lastSample=performance.now();window.environment.samples.push(window.environmentState());for(var voice of this.voices.values()){var row=window.environment.sounds.findLast(r=>r.id===voice.placement.id);if(row&&!voice.audio.paused&&voice.audio.currentTime>0)row.playing=true;}}};
    })()`);
  }
  var host=pages[0].sessionId,guest=pages[1].sessionId;
  async function createRoom() {
    await nativeClick(host,'[data-room-card-create]');
    await waitUntil(host,`document.querySelector('[data-room-map-selector]')?.open&&document.querySelector('[data-map-selector-map="7"]')`);
    await nativeClick(host,'[data-map-selector-mode="1"]');
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
  await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===2`);
  await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===3`);
  await joinRoom(roomId);
  for(var page of pages)await waitUntil(page.sessionId,`(()=>{var s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);
  for(var page of pages)await waitUntil(page.sessionId,`(()=>{var w=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return w?.mapLoaded&&w.renderedPlayers===4})()`);
  for(var s of [guest,host]){await waitUntil(s,`document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await nativeClick(s,'[data-waiting-ready]');var readyDeadline=Date.now()+15000;while(Date.now()<readyDeadline){var acknowledged=await evaluate(s,`(()=>{var w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='PLAYING'||w.match.readyPlayerIds.includes(w.playerId)})()`);if(acknowledged)break;await new Promise(r=>setTimeout(r,500));if(await evaluate(s,`(()=>{var w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='WAITING'&&!w.match.readyPlayerIds.includes(w.playerId)&&!!document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled})()`))await nativeClick(s,'[data-waiting-ready]');}}
  for(var page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  assert(evidence.initial.every(w=>w.mode===1&&w.mapId===7&&w.players.length===4));
  var snapshot=()=>Promise.all(pages.map(p=>evaluate(p.sessionId,'window.environmentState()')));
  for(var page of pages)await waitUntil(page.sessionId,`window.environmentState().count===3&&window.environmentState().voices.every(v=>!v.paused&&v.time>0)&&window.environmentState().context==='running'`);
  evidence.playing=await snapshot();
  var source=JSON.parse(await readFile('recovery/output/web-assets/scene-environment-sound-0007.json','utf8'));
  for(var row of evidence.playing){assert(row.sharedContext);assert.equal(row.count,3);for(var v of row.voices){var placement=source.sounds.find(s=>s.id===v.id);assert.deepEqual(v.position,placement.position);assert(v.loop&&v.src.endsWith('/audio/sound/'+placement.name+'.wav'));}}
  for(var page of pages)await nativeClick(page.sessionId,'[data-autopilot]');
  var soundDeadline=Date.now()+75000;var complete=false;
  while(Date.now()<soundDeadline){
    var observations=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.environment')));
    complete=observations.every(o=>o.sounds.length===3&&o.sounds.every(s=>s.playing)&&o.samples.some(s=>s.outputPeak>1e-5)&&new Set(o.samples.map(s=>JSON.stringify(s.listener))).size>1&&['72','73','74'].every(id=>{var times=o.samples.map(s=>s.voices.find(v=>v.id===id)?.time).filter(t=>t!==undefined);return times.some((t,i)=>i&&t<times[i-1]-.5);}));
    if(complete)break;await new Promise(r=>setTimeout(r,500));
  }
  assert(complete,'Three actual loops/playing and nonzero mixed signal at browser output');
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.environment')));
  evidence.outputState=await snapshot();
  for(var [index,page] of pages.entries()){var shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId);await writeFile(output+'-playing-'+(index+1)+'.png',Buffer.from(shot.data,'base64'));}
  for(var page of pages)await nativeClick(page.sessionId,'[data-leave-room]');for(var page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.leave=await snapshot();for(var row of evidence.leave){assert.equal(row.count,0);assert.equal(row.old.length,3);assert(row.old.every(v=>v.paused&&JSON.stringify(v.disconnectCalls)===JSON.stringify(['source','panner','gain'])));}
  await createRoom();
  var reentryRoomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await joinRoom(reentryRoomId);
  for(var i=0;i<2;i++){await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===${3+i}`);}
  for(var page of pages)await waitUntil(page.sessionId,`(()=>{var w=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return w?.mapLoaded&&w.renderedPlayers===4})()`);
  for(var s of [guest,host]){await waitUntil(s,`document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await nativeClick(s,'[data-waiting-ready]');var readyDeadline=Date.now()+15000;while(Date.now()<readyDeadline){var acknowledged=await evaluate(s,`(()=>{var w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='PLAYING'||w.match.readyPlayerIds.includes(w.playerId)})()`);if(acknowledged)break;await new Promise(r=>setTimeout(r,500));if(await evaluate(s,`(()=>{var w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='WAITING'&&!w.match.readyPlayerIds.includes(w.playerId)&&!!document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled})()`))await nativeClick(s,'[data-waiting-ready]');}}
  for(var page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'&&window.environmentState().count===3&&window.environmentState().voices.every(v=>!v.paused&&v.time>0)`);
  evidence.reentry=await snapshot();evidence.reentryObserved=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.environment')));
  assert(evidence.reentry.every(r=>r.count===3&&r.old.length===3&&r.old.every(v=>v.paused)));
  for(var page of pages)await nativeClick(page.sessionId,'[data-leave-room]');for(var page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.finalLeave=await snapshot();assert(evidence.finalLeave.every(r=>r.count===0&&r.old.length===6&&r.old.every(v=>v.paused)));
  evidence.status='PASS';console.log('PASS: map7 three source loops/nonzero browser output/spatial movement/Leave/reentry/Leave');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.environment`).catch(e=>({error:String(e)}))));throw error;}
finally{
  evidence.output=output+'.json';console.log(evidence.output);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  if(ws){for(var p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
