import {connectBreachAuxiliary} from './helpers/breach-auxiliary.mjs';
import {installCombatHurt151Observer} from './observers/combat-hurt151-browser.mjs';
import {AccountStore} from '../apps/server/src/account-store.ts';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
const WebSocket=createRequire(import.meta.url)('ws');
const only08=process.env.HURT151_VISIBLE_ONLY08==='1';
const lifecycleOnly=process.env.HURT151_LIFECYCLE_ONLY==='1';
const focused08=process.env.HURT151_FOCUSED08==='1';
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-combat-hurt151-visible-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-combat-hurt151-visible-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store,aux;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3310,vite:5340,cdp:9540},mapId:7,tankId:151,acceptanceTimeLimitSeconds:lifecycleOnly?60:240,scope:'Ordinary mode4/map7 two webpages plus two authenticated protocol players, default minimum4, original151 M/X/Y fourhurt selectors. Normal keyboard/look, source meshes and clocks, death09/respawn01, natural configured deadline, Rematch and Leave.',fourPartReference:['combat-hit-t01-0020-actual.json','combat-hit-t01-06-0020-actual.json','combat-hit-t01-07-0020-actual.json','combat-hit-t01-08-0020-actual.json']};
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
  const env={...process.env,PORT:'3310',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:lifecycleOnly?'60':'240'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5340,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3310',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9540',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9540/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9540');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5340',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu')&&!document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId,'('+installCombatHurt151Observer.toString()+')()');
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
  aux=await connectBreachAuxiliary('ws://127.0.0.1:3310',roomId,2);await aux.ready(1);
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).renderedPlayers===4`);
  for(const session of [guest,host])await nativeClick(session,'[data-ready]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  const victimId=evidence.initial[0].playerId;evidence.victimId=victimId;
  assert(evidence.initial.every(w=>w.mode===4&&w.mapId===7&&w.players.length===4));
  console.log('Ordinary map7 host151 + guest001 + two authenticated auxiliary players PLAYING; four original hurt selectors');
  const codes={KeyW:87,KeyS:83,KeyA:65,KeyD:68,Space:32};
  const key=async(session,code,down)=>{await command('Page.bringToFront',{},session);await command('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',key:code==='Space'?' ':code.slice(3).toLowerCase(),code,windowsVirtualKeyCode:codes[code]},session);};
  const world=()=>evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world)`),wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
  let observerHeld;const observerKeys=async(next)=>{if(observerHeld===next)return;if(observerHeld)await key(guest,observerHeld,false);observerHeld=next;if(next)await key(guest,next,true);};
  let held;const release=async()=>{if(held){await key(host,held,false);held=undefined;}};
  for(const page of pages)await nativeClick(page.sessionId,'#world');
  evidence.stages=[];
  for(const [selector,action,gap]of (only08?[[4,'08',-Math.PI/2]]:[[2,'06',0],[3,'07',Math.PI/2],[4,'08',-Math.PI/2]])){
    const stage={selector,action,gap,inputs:[],complete:false,fired:false};evidence.stages.push(stage);
    const gate=Date.now()+85000;
    while(Date.now()<gate){
      const observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.hurt')));
      const finished=observed.every(o=>o.events.some(e=>e.type==='hit'&&e.targetId===victimId&&e.hurtSelector===selector)&&o.captures.some(c=>c.id===victimId&&c.action===action)&&o.states.some((s,i)=>s.id===victimId&&s.action===action&&s.alive&&s.clocks.length===3&&s.clocks.every(c=>c.overMessage===0)&&o.states.slice(i+1).some(n=>n.id===victimId&&n.alive&&['01','02'].includes(n.action))));
      if(finished){stage.complete=true;await release();break;}
      const w=await world(),victim=w.players.find(p=>p.id===victimId),cpu=w.players.find(p=>p.id==='P2');
      if(w.phase!=='PLAYING')break;
      if(!victim.alive||!cpu){await release();await new Promise(r=>setTimeout(r,100));continue;}
      const bearing=Math.atan2(victim.x-cpu.x,victim.z-cpu.z),turn=wrap(bearing-cpu.yaw),distance=Math.hypot(victim.x-cpu.x,victim.z-cpu.z);
      const alreadyHit=observed[0].events.some(e=>e.type==='hit'&&e.playerId==='P2'&&e.targetId===victimId&&e.hurtSelector===selector);
      const victimError=wrap(cpu.yaw+gap-victim.yaw);
      await observerKeys(Math.abs(turn)>.08?(turn>0?'KeyA':'KeyD'):distance>100?'KeyW':undefined);
      if(!stage.fired&&distance<=100&&Math.abs(turn)<.08&&Math.abs(victimError)<.08){await key(guest,'Space',true);await new Promise(r=>setTimeout(r,80));await key(guest,'Space',false);stage.fired=true;stage.inputs.push({tick:w.tick,attackerKeys:['Space'],duration:80,distance});}
      const error=wrap(cpu.yaw+gap-victim.yaw),code=Math.abs(error)>.1?(error>0?'KeyA':'KeyD'):undefined;
      if(held!==code){await release();if(code){held=code;await key(host,code,true);}}
      stage.inputs.push({attackerKeys:observerHeld?[observerHeld]:[],distance,tick:w.tick,victim:{x:victim.x,z:victim.z,yaw:victim.yaw,hp:victim.hp},cpu:{id:cpu.id,x:cpu.x,z:cpu.z,yaw:cpu.yaw},error,keys:held?[held]:[]});
      await new Promise(r=>setTimeout(r,110));
    }
    await release();await observerKeys(undefined);
    evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.hurt')));
    await writeFile(output+'-'+action+'-checkpoint.json',JSON.stringify({...evidence,status:stage.complete?'STAGE_CAPTURED_LIFECYCLE_PENDING':'FAIL'},null,2)+'\n');
    assert(stage.complete,'Both webpages original151 '+action+' natural hit/draw/finish/base');
    console.log('PASS original151 selector'+selector+' -> '+action+' dual actual draw/finish/base');
  }
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.hurt')));
  await aux.leave(1);
  for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({players:window.hurtBattle.players.size,instances:window.hurtBattle.effects.instances.length,effectMeshes:window.hurtScene.meshes.filter(m=>m.metadata?.originalEffect).length,effectVoices:window.hurtBattle.effects.sound.voices.size,sceneVoices:window.hurtBattle.effects.skillSound.voices.size,battleVoices:window.hurtBattle.sound.voices.size})`)));
  assert(evidence.cleanup.every(r=>Object.values(r).every(v=>v===0)));
  evidence.status='PASS';console.log('PASS original151 ordinary player shots06/07/08 dual visible source captures and Leave');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.hurt').catch(e=>({error:String(e)}))));throw error;}
finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');console.log(output+'.json');store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await aux?.disconnect();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
