import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
const WebSocket=createRequire(import.meta.url)('ws');
const directory=await mkdtemp(join(tmpdir(),'cdtank-environment-sound21-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3287,vite:5317,cdp:9517},mapId:21,tankId:105,
  scope:'Ordinary mode5/0021 two webpages CPU/autopilot movement and fire: original BG loops, camera distance gain, sound volume mute/restore, rematch, leave and real disconnect/reentry. Native input; browser default autoplay policy.'};
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
  const env={...process.env,PORT:'3287',ACCOUNT_DB_PATH:database};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5317,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3287',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9517',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9517/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9517');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5317',browserContextId});
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
      MapEnvironmentSound.prototype.load=async function(id){window.environmentOwner=this;await load.call(this,id);for(const [id,v]of this.voices){const row={id,name:v.placement.name,src:v.audio.src,loop:v.audio.loop,playing:false};v.audio.addEventListener('playing',()=>{row.playing=true;});window.environment.sounds.push(row);}window.environment.loads.push({mapId:id,count:this.voices.size});};
      MapEnvironmentSound.prototype.clear=function(){for(const v of this.voices.values())window.environmentOld.push(v);clear.call(this);window.environment.clears.push({count:this.voices.size});};
      window.environmentState=()=>{const o=window.environmentOwner,b=window.environmentBattle,c=o?.context,l=c?.listener;return {world:JSON.parse(document.querySelector('#battle-status').dataset.world||'null'),count:o?.voices.size??0,context:c?.state,sharedContext:c===b?.effects.audioContext(),volume:o?.master?.gain.value,listener:l?[l.positionX.value,l.positionY.value,l.positionZ.value]:[],voices:Array.from(o?.voices.values()??[]).map(v=>({id:v.placement.id,name:v.placement.name,position:[v.panner.positionX.value,v.panner.positionY.value,v.panner.positionZ.value],gain:v.gain.gain.value,loop:v.audio.loop,paused:v.audio.paused,time:v.audio.currentTime,duration:v.audio.duration,src:v.audio.src})),old:window.environmentOld.map(v=>({id:v.placement.id,paused:v.audio.paused,time:v.audio.currentTime}))};};
      MapEnvironmentSound.prototype.update=function(){update.call(this);if(performance.now()-window.environment.lastSample>1000&&this.voices.size){window.environment.lastSample=performance.now();window.environment.samples.push(window.environmentState());}};
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
  console.log('Normal0021 original105 two webpages+CPU/autopilot PLAYING; original environment loops');
  const snapshot=()=>Promise.all(pages.map(p=>evaluate(p.sessionId,'window.environmentState()')));
  for(const page of pages)await waitUntil(page.sessionId,`window.environmentState().count===3&&window.environmentState().voices.every(v=>!v.paused&&v.time>0)&&window.environmentState().context==='running'`);
  evidence.playing=await snapshot();
  const source=JSON.parse(await readFile('recovery/output/web-assets/scene-environment-sound-0021.json','utf8'));
  for(const row of evidence.playing){assert(row.sharedContext);assert.equal(row.count,3);for(const v of row.voices){const placement=source.sounds.find(s=>s.id===v.id);assert.deepEqual(v.position,placement.position);assert(v.loop&&v.src.endsWith('/audio/sound/'+placement.name+'.wav'));}}
  const key=async(session,selector,value)=>{await nativeClick(session,selector);await command('Input.dispatchKeyEvent',{type:'keyDown',key:value,code:value,windowsVirtualKeyCode:value==='Home'?36:35},session);await command('Input.dispatchKeyEvent',{type:'keyUp',key:value,code:value,windowsVirtualKeyCode:value==='Home'?36:35},session);};
  await key(host,'#sound-volume','Home');await waitUntil(host,'window.environmentState().volume===0');
  evidence.muted=await snapshot();assert(evidence.muted[0].voices.every(v=>!v.paused));
  await key(host,'#sound-volume','End');await waitUntil(host,'window.environmentState().volume===1');
  evidence.restored=await snapshot();assert(evidence.restored[0].voices.every(v=>!v.paused));
  const gate=Date.now()+210000;let finished=false;
  while(Date.now()<gate){finished=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'`);if(finished)break;await new Promise(r=>setTimeout(r,1000));}
  assert(finished,'Ordinary natural mode5 match finishes');
  evidence.finished=await snapshot();
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.environment')));
  for(const o of evidence.observed){assert.equal(o.loads.length,1,'One map load during first round');assert.equal(o.sounds.length,3);assert(o.samples.length>2);for(const name of ['BG06','BG11','BG12']){const samples=o.samples.flatMap(s=>s.voices.filter(v=>v.name===name).map(v=>({listener:s.listener,...v})));assert(new Set(samples.map(v=>JSON.stringify(v.listener))).size>1,'Native moving camera listener');assert(new Set(samples.map(v=>v.gain.toFixed(4))).size>1,name+' native movement distance gain changes');}}
  assert(evidence.finished.every(r=>r.count===3&&r.voices.every(v=>!v.paused)));
  for(const page of pages)await nativeClick(page.sessionId,'[data-rematch]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'&&JSON.parse(document.querySelector('#battle-status').dataset.world).match.round===2`);
  evidence.rematch=await snapshot();
  for(const [i,row]of evidence.rematch.entries()){assert.equal(row.count,3);assert.equal(row.old.length,0);assert(row.voices.every(v=>v.time>=evidence.finished[i].voices.find(old=>old.id===v.id).time),'Existing loops continue across rematch');}
  for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.leave=await snapshot();for(const row of evidence.leave){assert.equal(row.count,0);assert(row.old.every(v=>v.paused));}
  await nativeClick(host,'#create-room');await waitUntil(host,`window.environmentState().count===3&&window.environmentState().world?.mapLoaded`);
  await nativeClick(host,'#sound-volume');await waitUntil(host,`window.environmentState().voices.every(v=>!v.paused&&v.time>0)`);
  evidence.reentry=await snapshot();assert.equal(evidence.reentry[0].count,3);assert.equal(evidence.reentry[0].old.length,3);
  await stop(server);
  for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.disconnect=await snapshot();for(const row of evidence.disconnect){assert.equal(row.count,0);assert(row.old.every(v=>v.paused));}
  const restartEnv={...process.env,PORT:'3287',ACCOUNT_DB_PATH:database};delete restartEnv.MATCH_TIME_LIMIT_SECONDS;delete restartEnv.MATCH_MIN_PLAYERS;
  let restartLog='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env:restartEnv,stdio:['ignore','pipe','pipe']});for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{restartLog+=String(d);});
  const restartGate=Date.now()+15000;while(!restartLog.includes('Server started')&&Date.now()<restartGate&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));assert(restartLog.includes('Server started'),restartLog);
  await nativeClick(host,'#leave');await nativeClick(host,'#create-room');await waitUntil(host,`window.environmentState().count===3&&window.environmentState().world?.mapLoaded`);await nativeClick(host,'#sound-volume');await waitUntil(host,`window.environmentState().voices.every(v=>!v.paused&&v.time>0)`);
  evidence.disconnectReentry=await snapshot();assert.equal(evidence.disconnectReentry[0].count,3);assert.equal(evidence.disconnectReentry[0].old.length,6);
  await nativeClick(host,'#leave');await waitUntil(host,`!document.querySelector('#battle-status').dataset.world`);
  evidence.final=await snapshot();for(const row of evidence.final){assert.equal(row.count,0);assert(row.old.every(v=>v.paused));}
  evidence.status='PASS';console.log('PASS: dual-page original BG loops/positions/moving camera distance gains/mute-restore/rematch no duplicates/leave/real disconnect and reentry');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.environment`).catch(e=>({error:String(e)}))));throw error;}
finally{
  await writeFile('recovery/output/browser-scene-environment-sound21.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
