import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
const WebSocket=createRequire(import.meta.url)('ws');
const directory=await mkdtemp(join(tmpdir(),'cdtank-environment-sound05-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-scene-environment-sound05-'+runId;
const evidence={status:'RUNNING',ports:{server:3319,vite:5349,cdp:9549},mapId:5,tankId:1,
  scope:'Diagnostic validation.html ordinary mode1/map5 dual001+twoCPU Ready/autopilot; four original spatial loops and nonzero browser master-output signal, Leave/reentry/Leave; default autoplay.'};
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
  const env={...process.env,PORT:'3319',ACCOUNT_DB_PATH:database};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5349,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3319',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9549',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9549/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9549');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5349/validation.html',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu')&&!document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url),engine=EngineStore.LastCreatedEngine;engine.setHardwareScalingLevel(4);engine.resize();
      window.environment={samples:[],loads:[],clears:[],sounds:[],lastSample:0};window.environmentOld=[];
      const {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.environmentBattle=this;return reconcile.apply(this,args);};
      const {MapEnvironmentSound}=await import('/src/audio/map-environment-sound.ts');
      const load=MapEnvironmentSound.prototype.load,update=MapEnvironmentSound.prototype.update,clear=MapEnvironmentSound.prototype.clear;
      MapEnvironmentSound.prototype.load=async function(id){window.environmentOwner=this;await load.call(this,id);for(const [id,v]of this.voices){v.disconnectCalls=[];for(const key of ['source','panner','gain']){const node=v[key],disconnect=node.disconnect;node.disconnect=function(...args){v.disconnectCalls.push(key);return disconnect.apply(this,args);};}const row={id,name:v.placement.name,src:v.audio.src,loop:v.audio.loop,playing:false};v.audio.addEventListener('playing',()=>{row.playing=true;});window.environment.sounds.push(row);}if(this.master){window.environmentAnalyser=this.context.createAnalyser();window.environmentAnalyser.fftSize=256;this.master.connect(window.environmentAnalyser);}window.environment.loads.push({mapId:id,count:this.voices.size});};
      MapEnvironmentSound.prototype.clear=function(){for(const v of this.voices.values())window.environmentOld.push(v);clear.call(this);window.environment.clears.push({count:this.voices.size});};
      window.environmentState=()=>{const signal=new Float32Array(256);window.environmentAnalyser?.getFloatTimeDomainData(signal);const outputPeak=Math.max(...signal.map(Math.abs));const o=window.environmentOwner,b=window.environmentBattle,c=o?.context,l=c?.listener;return {outputPeak,world:JSON.parse(document.querySelector('#battle-status').dataset.world||'null'),count:o?.voices.size??0,context:c?.state,sharedContext:c===b?.effects.audioContext(),volume:o?.master?.gain.value,listener:l?[l.positionX.value,l.positionY.value,l.positionZ.value]:[],voices:Array.from(o?.voices.values()??[]).map(v=>({id:v.placement.id,name:v.placement.name,position:[v.panner.positionX.value,v.panner.positionY.value,v.panner.positionZ.value],gain:v.gain.gain.value,loop:v.audio.loop,paused:v.audio.paused,time:v.audio.currentTime,duration:v.audio.duration,src:v.audio.src})),old:window.environmentOld.map(v=>({id:v.placement.id,paused:v.audio.paused,time:v.audio.currentTime,disconnectCalls:v.disconnectCalls}))};};
      MapEnvironmentSound.prototype.update=function(){update.call(this);if(performance.now()-window.environment.lastSample>1000&&this.voices.size){window.environment.lastSample=performance.now();window.environment.samples.push(window.environmentState());}};
    })()`);
  }
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  await nativeClick(host,'#open-home');await waitUntil(host,`document.querySelector('[data-home-close]')`);await nativeClick(host,'[data-home-close]');
  if(!await evaluate(host,`document.querySelector('#create-room-controls').open`))await nativeClick(host,'#create-room-controls > summary');
  await nativeSelect(host,'#tank',1);await nativeSelect(host,'#room-mode',1);await waitUntil(host,`Array.from(document.querySelector('#room-map').options).some(o=>o.value==='5')`);await nativeSelect(host,'#room-map',5);await nativeClick(host,'#create-room');
  await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===2`);await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===3`);
  await nativeClick(guest,'#open-home');await waitUntil(guest,`document.querySelector('[data-home-close]')`);await nativeClick(guest,'[data-home-close]');await nativeSelect(guest,'#tank',1);
  await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})`);await nativeSelect(guest,'#room',roomId);await nativeClick(guest,'#join');
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return w?.mapLoaded&&w.renderedPlayers===4})()`);
  for(const s of [guest,host]){await waitUntil(s,`document.querySelector('[data-ready]')&&!document.querySelector('[data-ready]').disabled`);await nativeClick(s,'[data-ready]');const readyDeadline=Date.now()+15000;while(Date.now()<readyDeadline){const acknowledged=await evaluate(s,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='PLAYING'||w.match.readyPlayerIds.includes(w.playerId)})()`);if(acknowledged)break;await new Promise(r=>setTimeout(r,500));if(await evaluate(s,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='WAITING'&&!w.match.readyPlayerIds.includes(w.playerId)&&!!document.querySelector('[data-ready]')&&!document.querySelector('[data-ready]').disabled})()`))await nativeClick(s,'[data-ready]');}}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  assert(evidence.initial.every(w=>w.mode===1&&w.mapId===5&&w.players.length===4));
  const snapshot=()=>Promise.all(pages.map(p=>evaluate(p.sessionId,'window.environmentState()')));
  for(const page of pages)await waitUntil(page.sessionId,`window.environmentState().count===4&&window.environmentState().voices.every(v=>!v.paused&&v.time>0)&&window.environmentState().context==='running'`);
  evidence.playing=await snapshot();
  const source=JSON.parse(await readFile('recovery/output/web-assets/scene-environment-sound-0005.json','utf8'));
  for(const row of evidence.playing){assert(row.sharedContext);assert.equal(row.count,4);for(const v of row.voices){const placement=source.sounds.find(s=>s.id===v.id);assert.deepEqual(v.position,placement.position);assert(v.loop&&v.src.endsWith('/audio/sound/'+placement.name+'.wav'));}}
  for(const page of pages)await nativeClick(page.sessionId,'[data-autopilot]');
  const soundDeadline=Date.now()+75000;let complete=false;
  while(Date.now()<soundDeadline){
    const observations=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.environment')));
    complete=observations.every(o=>o.sounds.length===4&&o.sounds.every(s=>s.playing)&&o.samples.some(s=>s.outputPeak>1e-5)&&new Set(o.samples.map(s=>JSON.stringify(s.listener))).size>1&&['161','217','218','219'].every(id=>{const times=o.samples.map(s=>s.voices.find(v=>v.id===id)?.time).filter(t=>t!==undefined);return times.some((t,i)=>i&&t<times[i-1]-.5);}));
    if(complete)break;await new Promise(r=>setTimeout(r,500));
  }
  assert(complete,'Four actual loops/playing and nonzero mixed signal at browser output');
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.environment')));
  evidence.outputState=await snapshot();
  for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.leave=await snapshot();for(const row of evidence.leave){assert.equal(row.count,0);assert.equal(row.old.length,4);assert(row.old.every(v=>v.paused&&JSON.stringify(v.disconnectCalls)===JSON.stringify(['source','panner','gain'])));}
  await nativeClick(host,'#create-room');await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const reentryRoomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(reentryRoomId)})`);await nativeSelect(guest,'#room',reentryRoomId);await nativeClick(guest,'#join');
  for(let i=0;i<2;i++){await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===${3+i}`);}
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return w?.mapLoaded&&w.renderedPlayers===4})()`);
  for(const s of [guest,host]){await waitUntil(s,`document.querySelector('[data-ready]')&&!document.querySelector('[data-ready]').disabled`);await nativeClick(s,'[data-ready]');const readyDeadline=Date.now()+15000;while(Date.now()<readyDeadline){const acknowledged=await evaluate(s,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='PLAYING'||w.match.readyPlayerIds.includes(w.playerId)})()`);if(acknowledged)break;await new Promise(r=>setTimeout(r,500));if(await evaluate(s,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='WAITING'&&!w.match.readyPlayerIds.includes(w.playerId)&&!!document.querySelector('[data-ready]')&&!document.querySelector('[data-ready]').disabled})()`))await nativeClick(s,'[data-ready]');}}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'&&window.environmentState().count===4&&window.environmentState().voices.every(v=>!v.paused&&v.time>0)`);
  evidence.reentry=await snapshot();evidence.reentryObserved=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.environment')));
  assert(evidence.reentry.every(r=>r.count===4&&r.old.length===4&&r.old.every(v=>v.paused)));
  for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.finalLeave=await snapshot();assert(evidence.finalLeave.every(r=>r.count===0&&r.old.length===8&&r.old.every(v=>v.paused)));
  evidence.status='PASS';console.log('PASS: map5 four source loops/nonzero browser output/spatial movement/Leave/reentry/Leave');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.environment`).catch(e=>({error:String(e)}))));throw error;}
finally{
  evidence.output=output+'.json';console.log(evidence.output);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
