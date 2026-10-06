import {connectBreachAuxiliary} from './helpers/breach-auxiliary.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
const WebSocket=createRequire(import.meta.url)('ws');
const mapId=7;
const navCastle=process.argv.includes('--nav-castle');
const se07Only=process.argv.includes('--se07-only');
const audioRematch=process.argv.includes('--audio-rematch');
const c2Only=process.argv.includes('--c2-only')||audioRematch||se07Only;
const audioInspect=audioRematch||se07Only;
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-result-music-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-result-music-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store,aux;
const pages=[],contexts=[];
const evidence={status:'RUNNING',c2Only,audioRematch,se07Only,navCastle,ports:{server:3565,vite:5595,cdp:9795},mapId,ammo:2001,
  scope:'New original result music only: formal map7/mode4 four authenticated players, normal host Arrow/Space2001 inputs and natural 60s configured TIME_LIMIT. Original pre-room tank/pet records explicit; no active position/HP/result/time/camera injection. Read-only media samples are not final speaker output.'};
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
async function waitUntil(session, expression, timeout = 45000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      return await evaluate(session, `(async()=>{const deadline=Date.now()+${timeout};while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#room-map-info')?.value+' tanks='+document.querySelector('#tank')?.options.length+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
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
  const env={...process.env,PORT:'3565',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'60'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5595,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3565',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9795',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9795/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9795');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5595',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  store=new AccountStore(database);const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(r=>r.tankId===1&&r.part===0);
  for(const [index,page]of pages.entries()){
    const account=store.open(await evaluate(page.sessionId,`localStorage.getItem('cdtank-account-token')`));
    const fields=v=>new Map(Object.entries(v).map(([k,v])=>[Number(k),v]));
    const equipment={name:'明确导入原战车',fields:fields(native.equipment)},base={name:'明确导入原宠物',fields:fields(native.base)};
    equipment.fields.set(0x1c,72);equipment.fields.set(0x24,1);equipment.fields.set(0x28,index?10021:10011);equipment.fields.set(0x2c,index?10022:10012);equipment.fields.set(0x30,index?10023:10013);
    store.replaceRoleRecords(account.accountId,{base:[base],equipment:[equipment]});

    const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa8,72,true);view.setUint32(0xa4,base.fields.get(0),true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
  }
  store.close();store=undefined;
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  for(const page of pages){await nativeClick(page.sessionId,'[data-room-card-home]');await waitUntil(page.sessionId,`document.querySelector('#home-inventory[open] [data-source-control="btnClose"]')`);await nativeClick(page.sessionId,'[data-home-close]');await waitUntil(page.sessionId,`!document.querySelector('#home-inventory[open]')`);}
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')`);await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,`[data-map-selector-map="${mapId}"]`);await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
  const joinPoint=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...joinPoint},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...joinPoint},guest);
  await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
  aux=await connectBreachAuxiliary('ws://127.0.0.1:3565',roomId,2);
  evidence.auxiliaryPlayers=aux.members.map(m=>({playerId:m.playerId,accountId:m.accountId}));
  await aux.ready(1);
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);

  for(const page of pages)await evaluate(page.sessionId,`(async()=>{
    window.resultMusic={transitions:[],waves:[],ended:[],errors:[]};window.resultMusicTasks=[];
    const audio=document.querySelector('audio[data-source-audio="battle-music"]');if(!audio)throw new Error('Formal single music owner missing');
    const state=()=>({id:audio.dataset.musicId,src:audio.getAttribute('src'),loop:audio.loop,time:audio.currentTime,duration:audio.duration,paused:audio.paused,state:audio.dataset.state,volume:audio.volume});
    audio.addEventListener('playing',()=>{const row=state();window.resultMusic.transitions.push(row);if(!['190','191'].includes(row.id))return;
      const task=(async()=>{const stream=audio.captureStream(),context=new AudioContext();await context.resume();const source=context.createMediaStreamSource(stream),analyser=context.createAnalyser(),mute=context.createGain();mute.gain.value=0;source.connect(analyser);analyser.connect(mute);mute.connect(context.destination);
        const samples=new Float32Array(analyser.fftSize);let peak=0,sum=0,count=0;try{for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,20));analyser.getFloatTimeDomainData(samples);for(const x of samples){peak=Math.max(peak,Math.abs(x));sum+=x*x;count++;}}window.resultMusic.waves.push({...row,peak,rms:Math.sqrt(sum/count),tracks:stream.getAudioTracks().length,scope:'captureStream read-only media samples; not speaker/post-volume waveform'});}finally{source.disconnect();analyser.disconnect();mute.disconnect();await context.close();}})().catch(error=>window.resultMusic.errors.push(String(error)));window.resultMusicTasks.push(task);
    });
    audio.addEventListener('ended',()=>window.resultMusic.ended.push(state()));
    const {Battle}=await import('/src/match/battle.ts');const reconcile=Battle.prototype.reconcile;Battle.prototype.reconcile=function(...args){window.resultBattle=this;return reconcile.apply(this,args);};
  })()`);
  for(const session of [guest,host]){await waitUntil(session,`document.querySelector('[data-waiting-ready]')?.matches(':enabled')`);await nativeClick(session,'[data-waiting-ready]');}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.fixture='Original tank1/pet1 pre-room records; four authenticated Ready players. Host ordinary native Arrow aim and Space against guest, other accounts normal idle; configured60s limit, no active clock or state adjustment.';
  const world=session=>evaluate(session,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  evidence.initial=await Promise.all(pages.map(page=>world(page.sessionId)));
  evidence.inputs=[];
  let held=new Set();
  async function setKeys(keys){for(const code of new Set([...held,...keys])){if(held.has(code)===keys.has(code))continue;await command('Input.dispatchKeyEvent',{type:keys.has(code)?'keyDown':'keyUp',code,key:code==='Space'?' ':code,windowsVirtualKeyCode:{Space:32,ArrowLeft:37,ArrowRight:39}[code]},host);}held=keys;}
  await nativeClick(host,'#world');
  const targetId=evidence.initial[1].playerId;
  const inputDeadline=Date.now()+35000;
  while(Date.now()<inputDeadline){
    const current=await world(host),me=current.players.find(player=>player.id===current.playerId),target=current.players.find(player=>player.id===targetId);
    if(current.phase!=='PLAYING'||!me||!target)break;
    const bearing=Math.atan2(target.x-me.x,target.z-me.z),error=Math.atan2(Math.sin(bearing-me.yaw-me.aim),Math.cos(bearing-me.yaw-me.aim)),distance=Math.hypot(target.x-me.x,target.z-me.z);
    const keys=new Set();
    if(me.alive&&target.alive){if(Math.abs(error)>.035)keys.add(error>0?'ArrowLeft':'ArrowRight');if(Math.abs(error)<.06&&distance<950)keys.add('Space');}
    evidence.inputs.push({tick:current.tick,actor:me.id,target:target.id,x:me.x,z:me.z,yaw:me.yaw,aim:me.aim,targetHP:target.hp,targetAlive:target.alive,distance,error,keys:[...keys]});
    await setKeys(keys);
    if(!target.alive){evidence.naturalKill=current;break;}
    await new Promise(resolve=>setTimeout(resolve,120));
  }
  await setKeys(new Set());
  console.log('Formal map7/mode4 ordinary Arrow/Space inputs complete; natural TIME_LIMIT pending');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'`,90000);
  evidence.finished=await Promise.all(pages.map(page=>evaluate(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  const failures=[];
  if(JSON.stringify(evidence.finished[0].match.result)!==JSON.stringify(evidence.finished[1].match.result))failures.push('Frozen results differ');
  const ownOutcomes=evidence.finished.map(world=>world.match.result.players.find(player=>player.id===world.playerId).outcome);
  evidence.outcomes=ownOutcomes;
  for(const [i,page]of pages.entries())if(ownOutcomes[i]!=='DRAW')await waitUntil(page.sessionId,`window.resultMusic.waves.length>0||window.resultMusic.errors.length>0`,15000);
  for(const [i,page]of pages.entries())if(ownOutcomes[i]!=='DRAW')await waitUntil(page.sessionId,`window.resultMusic.ended.length>0`,90000);
  evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,`(async()=>{await Promise.all(window.resultMusicTasks);return window.resultMusic;})()`)));
  for(const [i,row]of evidence.observed.entries()){
    const expected=ownOutcomes[i]==='WIN'?'190':ownOutcomes[i]==='LOSE'?'191':null;
    const resultRows=row.transitions.filter(v=>['190','191'].includes(v.id));
    if(expected){if(resultRows.length!==1||resultRows[0].id!==expected||resultRows[0].loop)failures.push('side'+i+' result once identity mismatch');if(!row.waves.some(v=>v.id===expected&&v.peak>0))failures.push('side'+i+' real result media output missing');if(!row.ended.some(v=>v.id===expected))failures.push('side'+i+' natural end missing');}
    else if(resultRows.length)failures.push('DRAW incorrectly selected result song');
    if(row.errors.length)failures.push('side'+i+' observer errors');
  }
  if(!ownOutcomes.includes('WIN')||!ownOutcomes.includes('LOSE'))failures.push('Dual WIN/LOSE outcome coverage incomplete');
  for(const [i,page]of pages.entries()){const screenshot=await command('Page.captureScreenshot',{format:'png'},page.sessionId);await writeFile(output+'-summary-'+(i+1)+'.png',Buffer.from(screenshot.data,'base64'));}
  for(const page of pages){await nativeClick(page.sessionId,'[data-summary-leave]');await waitUntil(page.sessionId,`!document.querySelector('#battle-status')?.dataset.world`);}
  await aux.leave(1);
  evidence.cleanup=await Promise.all(pages.map(page=>evaluate(page.sessionId,`({world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null'),music:[...document.querySelectorAll('audio[data-source-audio="battle-music"]')].map(a=>({id:a.dataset.musicId,loop:a.loop,state:a.dataset.state})),effects:window.resultBattle.effects?.activeInstanceCount,meshes:window.resultBattle.effects?.meshCount})`)));
  for(const [i,row]of evidence.cleanup.entries())if(row.world!==null||row.music.length!==1||row.music[0].id!=='183'||!row.music[0].loop)failures.push('side'+i+' normal Leave/lobby music owner mismatch');
  evidence.failures=failures;evidence.status=failures.length?'INCOMPLETE':'PASS';console.log(evidence.status+': '+output+'.json');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,`window.resultMusic`).catch(error=>({error:String(error)}))));throw error;}
finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
  await aux?.disconnect();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  await writeFile('recovery/output/result-music-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,serverSignal:server?.signalCode,chromeExit:chrome?.exitCode,chromeSignal:chrome?.signalCode},null,2)+'\n');
}
