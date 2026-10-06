import {installCombatLocalHurtCameraObserver} from './observers/combat-local-hurt-camera.mjs';
import {AccountStore} from '../apps/server/src/account-store.ts';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
const WebSocket=createRequire(import.meta.url)('ws');
const lifecycleOnly=false;
const focused08=false;
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-combat-local-hurt-camera-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-combat-local-hurt-camera-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3312,vite:5342,cdp:9542},mapId:7,tankId:151,acceptanceTimeLimitSeconds:75,scope:'Independent /validation.html diagnostic entry with ordinary authenticated room/input authority; not official lobby acceptance. Ordinary mode4/map7 host151 guest001 plus twoCPU defaultmin4; normal hits trigger local three-part source eye shake only, actual camera view/base comparison, natural expiry, natural finish and same-room Rematch/Leave.',fourPartReference:['combat-hit-t01-0020-actual.json','combat-hit-t01-06-0020-actual.json','combat-hit-t01-07-0020-actual.json','combat-hit-t01-08-0020-actual.json']};
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
  const env={...process.env,PORT:'3312',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'75'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5342,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3312',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9542',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9542/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9542');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5342/validation.html',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu')&&!document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId,'('+installCombatLocalHurtCameraObserver.toString()+')()');
    await evaluate(sessionId,`window.hurtScene.getEngine().setHardwareScalingLevel(2);window.hurtScene.getEngine().resize()`);
  }
  store=new AccountStore(database);
  const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(r=>r.tankId===151&&r.part===0);
  const account=store.open(await evaluate(pages[0].sessionId,`localStorage.getItem('cdtank-account-token')`));
  const fields=value=>new Map(Object.entries(value).map(([k,v])=>[Number(k),v]));
  const equipment={name:'原151战车',fields:fields(native.equipment)},base={name:'原宠物',fields:fields(native.base)};
  equipment.fields.set(0x1c,72);equipment.fields.set(0x24,151);equipment.fields.set(0x28,1510011);equipment.fields.set(0x2c,1510012);equipment.fields.set(0x30,1510013);
  store.replaceRoleRecords(account.accountId,{base:[base],equipment:[equipment]});
  const bytes=new Uint8Array(0x170),profile=new DataView(bytes.buffer);profile.setUint32(0xa8,72,true);profile.setUint32(0xa4,base.fields.get(0),true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});store.close();store=undefined;
  evidence.focused08=focused08;
  evidence.accountSource={tankId:151,source:'world-role-attributes-native.json',scope:'Original role-record fixture imported before ordinary battle selection; no battle state mutation'};
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  await nativeClick(host,'#open-home');await waitUntil(host,`document.querySelector('[data-home-close]')`);await nativeClick(host,'[data-home-close]');
  if(!await evaluate(host,`document.querySelector('#create-room-controls').open`))await nativeClick(host,'#create-room-controls > summary');
  await nativeSelect(host,'#tank',151);await nativeSelect(host,'#room-mode',4);await waitUntil(host,`Array.from(document.querySelector('#room-map').options).some(o=>o.value==='7')`);await nativeSelect(host,'#room-map',7);await nativeClick(host,'#create-room');
  await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await nativeClick(guest,'#open-home');await waitUntil(guest,`document.querySelector('[data-home-close]')`);await nativeClick(guest,'[data-home-close]');await nativeSelect(guest,'#tank',1);
  await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})`);await nativeSelect(guest,'#room',roomId);await nativeClick(guest,'#join');
  for(let i=0;i<2;i++){await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===${3+i}`);}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).renderedPlayers===4`);
  for(const session of [guest,host])await nativeClick(session,'[data-ready]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  const victimId=evidence.initial[0].playerId;evidence.victimId=victimId;
  assert(evidence.initial.every(w=>w.mode===4&&w.mapId===7&&w.players.length===4));
  console.log('Ordinary diagnostic map7 host151 + guest001 + twoCPU PLAYING');
  for(const page of pages)await nativeClick(page.sessionId,'#world');
  const hurtDeadline=Date.now()+55000;
  while(Date.now()<hurtDeadline){
    const observations=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.hurt')));
    if(observations[0].shakes.length&&observations[0].framesObserved.some(r=>r.active&&r.viewDifference>1e-6)&&observations[0].framesObserved.some((r,i)=>!r.active&&r.viewDifference<1e-6&&observations[0].framesObserved.slice(0,i).some(v=>v.active))&&observations[0].events.some(e=>e.type==='hit'&&e.targetId!==victimId&&e.targetId&&observations[0].fourPartIds.includes(e.targetId)))break;
    await new Promise(r=>setTimeout(r,150));
  }
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.hurt')));
  const [local,remote]=evidence.observed;
  assert(local.shakes.length,'Ordinary local151 hit activates camera');
  assert(local.shakes.every(s=>s.parameter===1&&s.duration===.5&&s.strength===10));
  assert.equal(remote.shakes.length,0,'Remote151 and local001 never activate hurt camera');
  assert(local.framesObserved.some(r=>r.active&&r.viewDifference>1e-6),'Actual local rendered camera differs from base');
  assert(remote.framesObserved.every(r=>!r.active&&r.viewDifference<1e-6),'Remote camera remains source base view');
  assert(local.framesObserved.some((r,i)=>!r.active&&r.viewDifference<1e-6&&local.framesObserved.slice(0,i).some(v=>v.active)),'Natural shake ends and original base returns');
  assert(local.events.some(e=>e.type==='hit'&&local.fourPartIds.includes(e.targetId)),'Ordinary hit also reaches original four-part actor');
  const bilateral=local.events.filter(e=>e.type==='hit'&&e.targetId===victimId&&e.hurtSelector!==undefined);
  assert(bilateral.length&&bilateral.every(e=>remote.events.some(v=>JSON.stringify(e)===JSON.stringify(v))),'Same ordinary151 hit events on both webpages');
  console.log('PASS local151 ordinary hurt shake/real view and remote/four-part silence');
  console.log('Waiting ordinary natural finish for Rematch and Leave');
  while(await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase!=='FINISHED'`))await new Promise(r=>setTimeout(r,2000));
  evidence.finished=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  assert(evidence.finished.every(w=>['TIME_LIMIT','OBJECTIVE'].includes(w.match.result?.reason)));
  const round=evidence.finished[0].match.round;
  for(const page of pages)await nativeClick(page.sessionId,'[data-rematch]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).match.round===${round+1}&&JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.filter(p=>!p.isCpu).every(p=>{const v=window.hurtBattle.players.get(p.id);return v?.alive&&['01','02'].includes(v.activeAction);})`);
  evidence.rematch=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({world:JSON.parse(document.querySelector('#battle-status').dataset.world),actions:window.hurtBattle.players.actions,clear:window.hurt.roundClears})`)));
  assert(evidence.rematch.every(r=>r.clear.some(c=>!c.active&&c.elapsed===0)), 'Round clear removes camera shake');
  for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({players:window.hurtBattle.players.size,instances:window.hurtBattle.effects.instances.length,effectMeshes:window.hurtScene.meshes.filter(m=>m.metadata?.originalEffect).length,effectVoices:window.hurtBattle.effects.sound.voices.size,sceneVoices:window.hurtBattle.effects.skillSound.voices.size,battleVoices:window.hurtBattle.sound.voices.size,cameraActive:Number(window.hurtBattle.effects.cameraShake.state.active),cameraElapsed:window.hurtBattle.effects.cameraShake.state.elapsed})`)));
  assert(evidence.cleanup.every(r=>Object.values(r).every(v=>v===0)));
  evidence.status='PASS';console.log('PASS local151 original ordinary hurt camera/remote-four-part silence/natural restore/rematch/Leave');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.hurt').catch(e=>({error:String(e)}))));throw error;}
finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');console.log(output+'.json');store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
