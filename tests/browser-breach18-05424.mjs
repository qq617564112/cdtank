import {connectBreachAuxiliary} from './helpers/breach-auxiliary.mjs';
import {installSceneBreach18Observer} from './observers/scene-breach18-05424-browser.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
const WebSocket=createRequire(import.meta.url)('ws');
const rematchLeaveOnly=false;
const lifecycleOnly=process.argv.includes('--lifecycle-only');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-breach18-05424-'+runId;
const traceOutput=resolve(output+'-server.jsonl');
const trace=async()=>{try{return (await readFile(traceOutput,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch(error){if(error.code==='ENOENT')return [];throw error;}};
const directory=await mkdtemp(join(tmpdir(),'cdtank-breach18-05424-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,aux;
const pages=[],contexts=[];
const evidence={status:'RUNNING',lifecycleOnly,acceptanceTimeLimitSeconds:lifecycleOnly?60:undefined,rematchLeaveOnly,ports:{server:3308,vite:5338,cdp:9538},mapId:18,tankId:1,
  scope:lifecycleOnly?'Ordinary mode4/map18 default minimum4: two640x360 webpages plus two authenticated protocol players; reconstructed acceptance timeLimit60s. Normal wood-box damage/GA13/hidden, natural TIME_LIMIT, normal rematch and Leave. No state/position/camera/clock injection.':'Ordinary mode4/map18 default minimum4/timeLimit300: two640x360 webpages plus two authenticated protocol players. Original05424 intactPOL/c9 ten-node actual draw and GA13 once-ended, hidden, normal movement into cleared source OBB, natural TIME_LIMIT. No state/position/HP/camera/clock injection or original GPU equivalence.'};
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
  const env={...process.env,PORT:'3308',ACCOUNT_DB_PATH:database,CDTANK_BREACH_TRACE:traceOutput};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;if(lifecycleOnly)env.MATCH_TIME_LIMIT_SECONDS='60';
  let log='';server=spawn(process.execPath,['--import','tsx','--import','./tests/observers/breach-runtime.ts','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5338,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3308',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9538',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9538/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9538');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5338',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu')&&!document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId, '('+installSceneBreach18Observer.toString()+')()');
    await evaluate(sessionId, `window.breachScene.getEngine().setHardwareScalingLevel(2);window.breachScene.getEngine().resize()`);
  }
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  await nativeClick(host,'#open-home');await waitUntil(host,`document.querySelector('[data-home-close]')`);await nativeClick(host,'[data-home-close]');
  if(!await evaluate(host,`document.querySelector('#create-room-controls').open`))await nativeClick(host,'#create-room-controls > summary');
  await nativeSelect(host,'#tank',1);await nativeSelect(host,'#room-mode',4);await waitUntil(host,`Array.from(document.querySelector('#room-map').options).some(o=>o.value==='18')`);await nativeSelect(host,'#room-map',18);await nativeClick(host,'#create-room');
  await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  aux=await connectBreachAuxiliary('ws://127.0.0.1:3308',roomId,2);
  evidence.auxiliaryPlayers=aux.members.map(m=>({playerId:m.playerId,accountId:m.accountId}));
  for(const page of pages.slice(1)){
    const guest=page.sessionId;
    await nativeClick(guest,'#open-home');await waitUntil(guest,`document.querySelector('[data-home-close]')`);await nativeClick(guest,'[data-home-close]');await nativeSelect(guest,'#tank',1);
    await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})`);await nativeSelect(guest,'#room',roomId);await nativeClick(guest,'#join');
  }
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);
  await aux.ready(1);
  for(const s of [...pages.slice(1).map(p=>p.sessionId),host])await nativeClick(s,'[data-ready]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  assert(evidence.initial.every(w=>w.mode===4&&w.mapId===18&&w.match.sceneObjects.length===34));
  const observedPages=pages.slice(0,2);
  const inputs=[];evidence.routeInputs=inputs;
  const reached=[false,false];
  const backed=[false,false];
  const lastPositions=[undefined,undefined];
  const stuck=[0,0];
  const press=async(session,code,milliseconds)=>{await command('Page.bringToFront',{},session);const key=code==='Space'?' ':code.startsWith('Key')?code.slice(3).toLowerCase():code;const values={key,code,windowsVirtualKeyCode:({KeyW:87,KeyA:65,KeyD:68,KeyS:83,ArrowLeft:37,ArrowRight:39,Space:32})[code]};await command('Input.dispatchKeyEvent',{type:'keyDown',...values},session);await new Promise(r=>setTimeout(r,milliseconds));await command('Input.dispatchKeyEvent',{type:'keyUp',...values},session);};
  for(const page of observedPages){await nativeClick(page.sessionId,'#world');await press(page.sessionId,'KeyW',350);}
  console.log('Ordinary0018 default four human players; native keyboard aim/Space toward original05424 ENV:87');
  const gate=Date.now()+60000;let done=false,id='87';
  while(Date.now()<gate){
    const observations=await Promise.all(observedPages.map(p=>evaluate(p.sessionId,'({capture:window.breach.captures["87"],sounds:window.breach.sounds,visuals:window.breach.visuals})')));
    if(observations.every(o=>(lifecycleOnly||o.capture)&&o.sounds.some(s=>s.sourcePlacementId==='87'&&s.playing&&s.ended)&&o.visuals.some(v=>v.id==='87'&&v.hidden))){done=true;break;}
    for(const [index,page]of observedPages.entries()){
      const world=await evaluate(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`),player=world.players.find(p=>p.id===world.playerId),target=world.match.sceneObjects.find(o=>o.sourcePlacementId==='87');
      const bearing=Math.atan2(target.x-player.x,target.z-player.z),error=Math.atan2(Math.sin(bearing-player.yaw),Math.cos(bearing-player.yaw)),distance=Math.hypot(target.x-player.x,target.z-player.z);
      if(!player.alive){inputs.push({page:index+1,tick:world.tick,player,target,keys:[],reason:'natural death'});continue;}
      if(lastPositions[index]&&Math.hypot(player.x-lastPositions[index].x,player.z-lastPositions[index].z)<.05)stuck[index]++;else stuck[index]=0;
      lastPositions[index]={x:player.x,z:player.z};
      if(distance<65&&stuck[index]>=3)reached[index]=true;
      let code,duration;
      if(reached[index]&&!backed[index]){code='KeyS';duration=1400;backed[index]=true;}
      else if(Math.abs(error)>.1){code=error>0?'KeyA':'KeyD';duration=90;}
      else if(!reached[index]){code='KeyW';duration=350;}
      else if(index===0&&reached.every(Boolean)&&backed.every(Boolean)&&target.hp>0){code='Space';duration=220;}
      if(code){await press(page.sessionId,code,duration);inputs.push({page:index+1,tick:world.tick,player,target,bearing,error,distance,reached:[...reached],keys:[code],duration});}

    }
    await new Promise(r=>setTimeout(r,120));
  }
  evidence.routeInputs=inputs;
  assert(done,'Same natural05424 destruction dual original c9/GA13 playing-ended/hidden');
  evidence.targetId='ENV:'+id;evidence.traceOutput=traceOutput;
  for(const page of observedPages)await evaluate(page.sessionId,`window.breach.capture=window.breach.captures[${JSON.stringify(id)}];`);
  evidence.observed=await Promise.all(observedPages.map(p=>evaluate(p.sessionId,'window.breach')));
  const library=JSON.parse(await readFile('recovery/output/web-assets/scene-breach-0018.json','utf8')),resource=library.resources.find(r=>r.reference==='Data/scnobj/obj05424/c9.CVD'),sourceNodes=resource.nodes.map((n,i)=>n.parts.length?i:null).filter(i=>i!==null);
  evidence.sourceGeometryNodes=sourceNodes;
  if(!lifecycleOnly)for(const [index,o]of evidence.observed.entries()){
    assert(o.sounds.some(s=>s.sourcePlacementId===id&&s.reference==='GA13'&&s.playing&&s.ended&&!s.loop));
    assert.equal(o.sounds.filter(s=>s.sourcePlacementId===id).length,1,'Single original GA13 for same source destruction');
    assert(o.draws.some(d=>d.id===id&&!d.broken&&d.vertices>0));
    assert(o.capture.draws.length>=sourceNodes.length-1);
    assert.deepEqual([...new Set(o.draws.filter(d=>d.id===id&&d.broken).map(d=>d.node))].sort((a,b)=>a-b),sourceNodes,'All ten source nodes actually draw across recorded frames');
    assert(o.capture.draws.every(d=>d.sourceModel===resource.reference));
    assert(sourceNodes.some(node=>new Set(o.draws.filter(d=>d.id===id&&d.broken&&d.node===node).map(d=>JSON.stringify(d.positions))).size>1),'Actual original CVD pose changes');
    assert(o.visuals.some(v=>v.id===id&&v.fading&&!v.hidden&&!v.intactEnabled));assert(o.visuals.some(v=>v.id===id&&v.hidden));
    await writeFile(output+'-natural-'+(index+1)+'.png',Buffer.from(o.capture.canvas.split(',')[1],'base64'));
  }
  evidence.destroyed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  if(!lifecycleOnly){
  const beforeCross=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  await press(host,'KeyW',2200);
  const afterCross=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  evidence.clearedMovement={before:beforeCross,after:afterCross,normalKeys:['KeyW'],duration:2200};
  }
  await writeFile(output+'-visual.json',JSON.stringify({...evidence,status:'VISUAL_CAPTURED_LIFECYCLE_PENDING'},null,2)+'\n');
  console.log('Ordinary target destroyed/GA13 ended/hidden; waiting configured natural deadline for normal rematch');
  let naturalPolls=0;
  while(await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase!=='FINISHED'`)){await new Promise(r=>setTimeout(r,2000));if(++naturalPolls%15===0)console.log('Natural deadline remaining',await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).remaining`));}
  evidence.finished=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  evidence.auxiliaryAtFinish=aux.members.map(m=>({playerId:m.playerId,isConnected:m.client.isConnected,snapshot:m.snapshot}));
  assert(evidence.auxiliaryAtFinish.every(m=>m.isConnected));
  const round=evidence.finished[0].match.round;
  await aux.rematch(round);
  for(const page of pages)await nativeClick(page.sessionId,'[data-rematch]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).match.round===${round+1}&&JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const objects=[...window.breachBattle.battlefield.breakables.values()].filter(v=>v.broken?.model==='obj05424');return objects.length===18&&objects.every(v=>{const state=v.state.snapshot();return !state.fading&&!state.hidden&&state.alpha===1&&v.root.isEnabled()&&!v.soundPlayed;});})()`);
  evidence.rematch=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({world:JSON.parse(document.querySelector('#battle-status').dataset.world),objects:[...window.breachBattle.battlefield.breakables].filter(([id,v])=>v.broken?.model==='obj05424').map(([id,v])=>({id,...v.state.snapshot(),intactEnabled:v.root.isEnabled(),soundPlayed:v.soundPlayed}))})`)));
  assert(evidence.rematch.every(row=>row.world.match.sceneObjects.length===34&&row.world.match.sceneObjects.every(o=>o.hp===200&&!o.destroyedAt)&&row.objects.length===18&&row.objects.every(o=>!o.fading&&!o.hidden&&o.alpha===1&&o.intactEnabled&&!o.soundPlayed)));
  const cleanup=()=>Promise.all(pages.map(p=>evaluate(p.sessionId,`({breakables:window.breachBattle.battlefield.breakables.size,brokenMeshes:window.breachScene.meshes.filter(m=>m.metadata?.sourceBreachBroken).length,instances:window.breachBattle.effects.instances.length,sceneVoices:window.breachBattle.effects.skillSound.voices.size,battleVoices:window.breachBattle.sound.voices.size})`)));
  await aux.leave(2);
  for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await cleanup();for(const row of evidence.cleanup)assert.deepEqual(row,{breakables:0,brokenMeshes:0,instances:0,sceneVoices:0,battleVoices:0});
  evidence.serverTrace=await trace();
  evidence.status='PASS';console.log(lifecycleOnly?'PASS: ordinary0018 source87 destruction/GA13/hidden, natural60s TIME_LIMIT, normal rematch/Leave':'PASS: ordinary0018 same05424 dual original c9 meshes/animation, GA13 once-ended, hidden, normal crossing, natural TIME_LIMIT and rematch/Leave');
}catch(error){evidence.status='FAIL';evidence.error=String(error);evidence.serverTrace=await trace();if(ws)evidence.observed=await Promise.all(pages.slice(0,2).map(p=>evaluate(p.sessionId,`window.breach`).catch(e=>({error:String(e)}))));throw error;}
finally{
  evidence.output=output+'.json';console.log(evidence.output);await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await aux?.disconnect();
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
