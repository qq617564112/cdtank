import {installSceneBreach22Observer} from './observers/scene-breach22-browser.mjs';
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
const output='recovery/output/browser-breach22-'+runId;
const traceOutput=resolve(output+'-server.jsonl');
const trace=async()=>{try{return (await readFile(traceOutput,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch(error){if(error.code==='ENOENT')return [];throw error;}};
const directory=await mkdtemp(join(tmpdir(),'cdtank-breach22-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws;
const pages=[],contexts=[];
const evidence={status:'RUNNING',rematchLeaveOnly,ports:{server:3314,vite:5344,cdp:9544},mapId:22,tankId:1,
  scope:'Diagnostic validation.html ordinary authoritative mode5/0022 dual-web twoCPU/autopilot; both source model families natural destruction/c9/GA13+GA33, natural finish/rematch/Leave. Software320x180; no battle state injection; official lobby acceptance excluded.'};
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
  const env={...process.env,PORT:'3314',ACCOUNT_DB_PATH:database,CDTANK_BREACH_TRACE:traceOutput};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','--import','./tests/observers/breach22-runtime.ts','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5344,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3314',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9544',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9544/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9544');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5344/validation.html',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu')&&!document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId,`(${installSceneBreach22Observer.toString()})();`);
    await evaluate(sessionId,`window.breachScene.getEngine().setHardwareScalingLevel(4);window.breachScene.getEngine().resize();`);
  }
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  await nativeClick(host,'#open-home');await waitUntil(host,`document.querySelector('[data-home-close]')`);await nativeClick(host,'[data-home-close]');
  if(!await evaluate(host,`document.querySelector('#create-room-controls').open`))await nativeClick(host,'#create-room-controls > summary');
  await nativeSelect(host,'#tank',1);await nativeSelect(host,'#room-mode',5);await waitUntil(host,`Array.from(document.querySelector('#room-map').options).some(o=>o.value==='22')`);await nativeSelect(host,'#room-map',22);await nativeClick(host,'#create-room');
  await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===2`);await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===3`);
  await nativeClick(guest,'#open-home');await waitUntil(guest,`document.querySelector('[data-home-close]')`);await nativeClick(guest,'[data-home-close]');await nativeSelect(guest,'#tank',1);
  await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})`);await nativeSelect(guest,'#room',roomId);await nativeClick(guest,'#join');
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);
  for(const s of [guest,host]){await waitUntil(s,`document.querySelector('[data-ready]')&&!document.querySelector('[data-ready]').disabled`);await nativeClick(s,'[data-ready]');}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  assert(evidence.initial.every(w=>w.mode===5&&w.mapId===22&&w.match.objectives.length===46));
  for(const page of pages)await nativeClick(page.sessionId,'[data-autopilot]');
  const gate=Date.now()+210000;let ids={};
  while(Date.now()<gate){
    const observations=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.breach')));
    for(const model of ['obj05424','obj05469']) {
      const common=Object.keys(observations[0].captures).find(id=>observations[0].captures[id].model===model&&observations.every(o=>o.captures[id]&&o.sounds.some(s=>s.sourcePlacementId===id&&s.playing&&s.ended)&&o.visuals.some(v=>v.id===id&&v.hidden)));
      if(common)ids[model]=common;
    }
    if(Object.keys(ids).length===2)break;await new Promise(r=>setTimeout(r,500));
  }
  assert.equal(Object.keys(ids).length,2,'Dual original c9/GA13+GA33 playing-ended/hidden');
  evidence.targetIds=ids;evidence.traceOutput=traceOutput;
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.breach')));
  for(const [index,o]of evidence.observed.entries())for(const [model,id]of Object.entries(ids)){
    const reference='Data/scnobj/'+model+'/c9.CVD',cue=model==='obj05469'?'GA33':'GA13';
    assert.equal(o.sounds.filter(s=>s.sourcePlacementId===id).length,1);
    assert(o.sounds.some(s=>s.sourcePlacementId===id&&s.reference===cue&&s.playing&&s.ended&&!s.loop));
    assert(o.draws.some(d=>d.id===id&&!d.broken&&d.vertices>0));
    assert.deepEqual([...new Set(o.captures[id].draws.map(d=>d.node))].sort((a,b)=>a-b),o.geometryNodes[reference]);
    assert(o.captures[id].draws.every(d=>d.sourceModel===reference));
    assert(o.geometryNodes[reference].some(node=>new Set(o.draws.filter(d=>d.id===id&&d.broken&&d.node===node).map(d=>JSON.stringify(d.positions))).size>1));
    await writeFile(output+'-'+model+'-natural-'+(index+1)+'.png',Buffer.from(o.captures[id].canvas.split(',')[1],'base64'));
  }
  evidence.destroyed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  const finishDeadline=Date.now()+210000;
  while(Date.now()<finishDeadline){if(await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'`))break;await new Promise(r=>setTimeout(r,500));}
  evidence.finished=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  assert(evidence.finished.every(w=>w.phase==='FINISHED'));
  for(const page of pages)await nativeClick(page.sessionId,'[data-rematch]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).match.round===2`);
  for(const page of pages)await waitUntil(page.sessionId,`window.breachBattle.battlefield.breakables.size===46&&[...window.breachBattle.battlefield.breakables.values()].every(v=>{const s=v.state.snapshot();return s.alpha===1&&!s.fading&&!s.hidden&&v.root.isEnabled()})`);
  evidence.rematch=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({world:JSON.parse(document.querySelector('#battle-status').dataset.world),objects:[...window.breachBattle.battlefield.breakables].map(([id,v])=>({id,...v.state.snapshot(),intactEnabled:v.root.isEnabled(),soundPlayed:v.soundPlayed,model:v.broken.model}))})`)));
  assert(evidence.rematch.every(r=>r.world.match.objectives.length===46&&r.world.match.objectives.every(o=>o.hp===200)&&r.objects.length===46&&r.objects.every(o=>o.alpha===1&&!o.hidden&&!o.fading&&o.intactEnabled&&!o.soundPlayed)));
  const cleanup=()=>Promise.all(pages.map(p=>evaluate(p.sessionId,`({breakables:window.breachBattle.battlefield.breakables.size,brokenMeshes:window.breachScene.meshes.filter(m=>m.metadata?.sourceBreachBroken).length,instances:window.breachBattle.effects.instances.length,sceneVoices:window.breachBattle.effects.skillSound.voices.size,battleVoices:window.breachBattle.sound.voices.size})`)));
  for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await cleanup();for(const row of evidence.cleanup)assert.deepEqual(row,{breakables:0,brokenMeshes:0,instances:0,sceneVoices:0,battleVoices:0});
  evidence.serverTrace=await trace();
  evidence.status='PASS';console.log('PASS: ordinary0022 both models dual original c9/GA13+GA33, natural finish/rematch/Leave');
}catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.serverTrace=await trace();if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.breach`).catch(e=>({error:String(e)}))));throw error;}
finally{
  evidence.output=output+'.json';console.log(evidence.output);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
