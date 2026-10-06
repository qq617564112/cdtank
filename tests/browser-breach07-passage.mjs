import {connectBreachAuxiliary} from './helpers/breach-auxiliary.mjs';
import {getSceneBreakables} from '../apps/server/src/scene-objects.ts';
import {segmentBox} from '../apps/server/src/battlefield.ts';
import {installSceneBreach07Observer} from './observers/scene-breach07-browser.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
const WebSocket=createRequire(import.meta.url)('ws');
const rematchLeaveOnly=false;
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-breach07-passage-'+runId;
const traceOutput=resolve(output+'-server.jsonl');
const trace=async()=>{try{return (await readFile(traceOutput,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch(error){if(error.code==='ENOENT')return [];throw error;}};
const directory=await mkdtemp(join(tmpdir(),'cdtank-breach07-passage-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,aux;
const pages=[],contexts=[];
const evidence={status:'RUNNING',rematchLeaveOnly,ports:{server:3321,vite:5351,cdp:9551},mapId:7,tankId:1,
  scope:'Passage only ordinary mode1/map7 fourhuman connections(two webpages and two authenticated heartbeat auxiliary players), native turn/W/aim/Space to ENV50, intact blocking/destruction/fade release/sourceOBB entry/opposite exit and Leave; visual/fullXYZ/audio/rematch evidence reused, no battle state injection.'};
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
  const env={...process.env,PORT:'3321',ACCOUNT_DB_PATH:database,CDTANK_BREACH_TRACE:traceOutput};env.MATCH_TIME_LIMIT_SECONDS='120';delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','--import','./tests/observers/breach07-runtime.ts','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5351,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3321',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9551',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9551/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9551');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5351/validation.html',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu')&&!document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId,`(${installSceneBreach07Observer.toString()})();`);
    await evaluate(sessionId,`window.breachScene.getEngine().setHardwareScalingLevel(4);window.breachScene.getEngine().resize();`);
  }
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  await nativeClick(host,'#open-home');await waitUntil(host,`document.querySelector('[data-home-close]')`);await nativeClick(host,'[data-home-close]');
  if(!await evaluate(host,`document.querySelector('#create-room-controls').open`))await nativeClick(host,'#create-room-controls > summary');
  await nativeSelect(host,'#tank',1);await nativeSelect(host,'#room-mode',1);await waitUntil(host,`Array.from(document.querySelector('#room-map').options).some(o=>o.value==='7')`);await nativeSelect(host,'#room-map',7);await nativeClick(host,'#create-room');
  await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  aux=await connectBreachAuxiliary('ws://127.0.0.1:3321',roomId,2);
  evidence.auxiliaryPlayers=aux.members.map(m=>({playerId:m.playerId,accountId:m.accountId}));
  await nativeClick(guest,'#open-home');await waitUntil(guest,`document.querySelector('[data-home-close]')`);await nativeClick(guest,'[data-home-close]');await nativeSelect(guest,'#tank',1);
  await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})`);await nativeSelect(guest,'#room',roomId);await nativeClick(guest,'#join');
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);
  await aux.ready(1);
  for(const s of [guest,host]){await waitUntil(s,`document.querySelector('[data-ready]')&&!document.querySelector('[data-ready]').disabled`);await nativeClick(s,'[data-ready]');const readyDeadline=Date.now()+15000;while(Date.now()<readyDeadline){const acknowledged=await evaluate(s,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='PLAYING'||w.match.readyPlayerIds.includes(w.playerId)})()`);if(acknowledged)break;await new Promise(r=>setTimeout(r,500));if(await evaluate(s,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='WAITING'&&!w.match.readyPlayerIds.includes(w.playerId)&&!!document.querySelector('[data-ready]')&&!document.querySelector('[data-ready]').disabled})()`))await nativeClick(s,'[data-ready]');}}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  assert(evidence.initial.every(w=>w.mode===1&&w.mapId===7&&w.match.sceneObjects.length===10));
  const inputs=[];evidence.routeInputs=inputs;evidence.acceptanceTimeLimitSeconds=120;
  const session=guest,targetSource=getSceneBreakables(7).find(o=>o.id==='50');
  const read=()=>evaluate(session,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world);return {world:w,player:w.players.find(p=>p.id===w.playerId),target:w.match.sceneObjects.find(o=>o.sourcePlacementId==='50')}})()`);
  const key=(type,code)=>command('Input.dispatchKeyEvent',{type,code,key:code==='Space'?' ':code.startsWith('Key')?code.slice(3).toLowerCase():code,windowsVirtualKeyCode:({KeyW:87,KeyA:65,KeyD:68,ArrowLeft:37,ArrowRight:39,Space:32})[code]},session);
  const press=async(code,ms)=>{await key('keyDown',code);await new Promise(r=>setTimeout(r,ms));await key('keyUp',code);};
  await nativeClick(session,'#world');
  const passageDeadline=Date.now()+105000;let last,stalls=0,aligned=false,entered=false,exited=false,heldForward=false;
  while(Date.now()<passageDeadline){
    const row=await read(),p=row.player,t=row.target;if(row.world.phase!=='PLAYING')break;
    const bearing=Math.atan2(t.x-p.x,t.z-p.z),error=Math.atan2(Math.sin(bearing-p.yaw),Math.cos(bearing-p.yaw)),aimError=Math.atan2(Math.sin(bearing-p.yaw-p.aim),Math.cos(bearing-p.yaw-p.aim)),distance=Math.hypot(t.x-p.x,t.z-p.z);
    const inside=segmentBox({x:p.x,y:t.y,z:p.z},{x:p.x,y:t.y,z:p.z},targetSource,0)!==undefined;
    if(last&&Math.hypot(p.x-last.x,p.z-last.z)<.1)stalls++;else stalls=0;last={x:p.x,z:p.z};
    inputs.push({tick:row.world.tick,remaining:row.world.remaining,player:p,target:t,error,aimError,distance,inside,heldForward});
    if(inside&&t.hp===0)entered=true;
    if(entered&&!inside&&p.z<t.z-40){exited=true;break;}
    if(t.hp===0){if(!heldForward){await key('keyDown','KeyW');heldForward=true;}await new Promise(r=>setTimeout(r,80));continue;}
    if(!aligned){
      if(distance<80&&stalls>3){aligned=true;evidence.blocked=inputs.slice(-4);}
      else if(Math.abs(error)>.035){await press(error>0?'KeyA':'KeyD',40);}
      else await press('KeyW',160);
    }else{
      if(Math.abs(aimError)>.045)await press(aimError>0?'ArrowLeft':'ArrowRight',40);
      else{await key('keyDown','KeyW');heldForward=true;await press('Space',220);await key('keyUp','KeyW');heldForward=false;}
    }
  }
  if(heldForward)await key('keyUp','KeyW');evidence.entered=entered;evidence.exited=exited;
  assert(entered&&exited,'Ordinary player enters released original barrel OBB and exits opposite side');
  evidence.final=await read();await aux.leave(1);
  for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({breakables:window.breachBattle.battlefield.breakables.size,brokenMeshes:window.breachScene.meshes.filter(m=>m.metadata?.sourceBreachBroken).length,instances:window.breachBattle.effects.instances.length,sceneVoices:window.breachBattle.effects.skillSound.voices.size,battleVoices:window.breachBattle.sound.voices.size})`)));
  assert(evidence.cleanup.every(r=>Object.values(r).every(v=>v===0)));
  evidence.serverTrace=await trace();
  evidence.status='PASS';console.log('PASS: ordinarymap7 fourhuman native movement blocked/destroy/released OBB entry/opposite exit/Leave');
}catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.serverTrace=await trace();if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.breach`).catch(e=>({error:String(e)}))));throw error;}
finally{
  evidence.output=output+'.json';console.log(evidence.output);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await aux?.disconnect();
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
