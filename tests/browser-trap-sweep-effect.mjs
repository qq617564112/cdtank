import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile, copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';
const {WsClient}=createRequire(import.meta.url)('tsrpc');
const WebSocket=createRequire(import.meta.url)('ws');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-trap-sweep-effect-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-trap-sweep-effect-'));
const database=join(directory,'accounts.sqlite');
const checkpoint='recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
await copyFile(checkpoint+'-checkpoint.sqlite',database);
const identities=JSON.parse(await readFile(checkpoint+'-identity.private.json','utf8')).accounts;
let server,chrome,vite,ws,serverLog='';
const runtimeErrors=[];
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3467,vite:5497,cdp:9697},mapId:7,itemId:12,
  scope:'Actual purchased tank3/pet2 checkpoint, authenticated Shop BUY12/Kitbag slot4 API, ordinary React mode4/map7 Ready; first normal Digit2 placement/Digit5 sweep original019/GA35 dual render/audio/natural end/Leave. Existing source/transaction/lifecycle proof reused, no live state injection.', checkpoint:checkpoint+'-checkpoint.sqlite'};
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
  const env={...process.env,PORT:'3467',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'120'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);serverLog+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5497,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3467',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9697',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9697/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9697');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  if(['Runtime.exceptionThrown','Log.entryAdded'].includes(message.method))runtimeErrors.push({sessionId:message.sessionId,method:message.method,params:message.params});
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});

  const purchaser=new WsClient(serviceProto,{server:'ws://127.0.0.1:3467',logger:undefined});
  try{
    assert((await purchaser.connect()).isSucc);
    assert((await purchaser.callApi('Account',{token:identities[0].token})).isSucc);
    const purchase=await purchaser.callApi('Shop',{operation:'BUY',itemTableId:12,quantity:1,currency:'MONEY',requestId:'sweep_effect_first'});assert(purchase.isSucc);evidence.purchase=purchase.res;
    const instanceId=purchase.res.purchased.instanceId;
    const assignment=await purchaser.callApi('Kitbag',{operation:'ASSIGN',slot:4,instanceId});evidence.assignment=assignment;assert(assignment.isSucc);
  }finally{await purchaser.disconnect();}
  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await command('Page.enable',{},sessionId);await command('Runtime.enable',{},sessionId);await command('Log.enable',{},sessionId);
    await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(identities[index].token)+')'},sessionId);
    await command('Page.navigate',{url:'http://127.0.0.1:5497'},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);
    await evaluate(sessionId,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url);const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world'));engine.setHardwareScalingLevel(2);engine.resize();})()`);
  }
  for(const page of pages)await evaluate(page.sessionId,`(async()=>{
    window.sweepLoadStages=[];window.sweepDisconnects=[];
    for(const [path,name,method]of[
      ['/src/assets/scenes/scene-preview.ts','ScenePreview','load'],
      ['/src/assets/scenes/map-scene-effects.ts','MapSceneEffects','load'],
      ['/src/render/battle-players.ts','BattlePlayers','loadPlayer'],
      ['/src/audio/map-environment-sound.ts','MapEnvironmentSound','load']]){
      const prototype=(await import(path))[name].prototype,original=prototype[method];
      prototype[method]=function(...args){const row={name,method,startedAt:performance.now(),state:'pending'};window.sweepLoadStages.push(row);const result=original.apply(this,args);result.then(()=>{row.state='resolved';row.endedAt=performance.now();},error=>{row.state='rejected';row.error=String(error);row.endedAt=performance.now();});return result;};
    }
    const {Battle}=await import('/src/match/battle.ts'),enter=Battle.prototype.enter;
    Battle.prototype.enter=function(...args){window.sweepLoadingBattle=this;this.client.flows.postDisconnectFlow.push(input=>{window.sweepDisconnects.push({at:performance.now(),reason:input.reason,isManual:input.isManual});return input;});return enter.apply(this,args);};
  })()`);
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')`);await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
  const joinPoint=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...joinPoint},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...joinPoint},guest);
  await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===2})()`);
  for(const page of pages){await evaluate(page.sessionId,`(async()=>{
    const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world')),scene=engine.scenes[0];window.sweepScene=scene;
    window.sweep={frames:0,events:[],effects:[],sounds:[],captures:[],snapshots:[]};
    const {BattleSkillEffects}=await import('/src/match/skills/battle-skill-effects.ts'),event=BattleSkillEffects.prototype.event;
    BattleSkillEffects.prototype.event=function(value){if(value.type==='itemUsed'&&value.skillId===12)window.sweep.events.push(value);return event.call(this,value);};
    const {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
    Battle.prototype.reconcile=function(...args){window.sweepBattle=this;window.sweepRuntime=this.effects;return reconcile.apply(this,args);};
    const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts'),add=EffectRuntime.prototype.addInstance;
    EffectRuntime.prototype.addInstance=function(view,tree){const handle=add.call(this,view,tree);if(tree.root.definition.index===2469){const i=this.instances.find(i=>i.handle===handle);const row={handle,owner:view?.root.name,root:2469,nodes:i.draws.map(d=>d.node.definition.index),rendered:[],draws:[],expired:false};i.sweepRow=row;window.sweep.effects.push(row);}return handle;};
    const draw=EffectRuntime.prototype.draw;EffectRuntime.prototype.draw=function(i,d){draw.call(this,i,d);const row=i.sweepRow;if(!row)return;const meshes=d.model?.meshes??[];for(const mesh of meshes){if(!mesh.onBeforeRenderObservable||mesh.sweepObserved)continue;mesh.sweepObserved=true;mesh.onBeforeRenderObservable.add(()=>{if(!row.rendered.includes(d.node.definition.index))row.rendered.push(d.node.definition.index);row.lastFrame=window.sweep.frames+1;row.lastElapsed=d.node.lifecycle.elapsed;if(row.draws.length<20)row.draws.push({node:d.node.definition.index,frame:window.sweep.frames+1,model:mesh.metadata?.sourceModel,vertices:mesh.getTotalVertices(),textures:mesh.material.getActiveTextures().map(t=>t.url),matrix:Array.from(mesh.getWorldMatrix().m)});});}};
    const remove=EffectRuntime.prototype.remove;EffectRuntime.prototype.remove=function(index){const i=this.instances[index];if(i.sweepRow){i.sweepRow.expired=i.tree.quiescent;i.sweepRow.removedAt=performance.now();}return remove.call(this,index);};
    const {EffectSkillSound}=await import('/src/audio/effect-skill-sound.ts'),play=EffectSkillSound.prototype.play;
    EffectSkillSound.prototype.play=function(reference,selector,position){const handle=play.call(this,reference,selector,position);if(reference==='GA35'){const voice=this.voices.get(handle),row={reference,selector,position:[...position],handle,src:voice?.audio.src,loop:voice?.audio.loop,context:this.context?.state,played:false,ended:false,postGainPeak:0};window.sweep.sounds.push(row);if(voice){voice.audio.addEventListener('playing',()=>row.played=true);const analyser=this.context.createAnalyser(),silent=this.context.createGain();analyser.fftSize=256;silent.gain.value=0;voice.gain.connect(analyser);analyser.connect(silent);silent.connect(this.context.destination);const interval=setInterval(()=>{const samples=new Float32Array(256);analyser.getFloatTimeDomainData(samples);row.postGainPeak=Math.max(row.postGainPeak,...samples.map(Math.abs));},10);voice.audio.addEventListener('ended',()=>{row.ended=true;clearInterval(interval);analyser.disconnect();silent.disconnect();},{once:true});}}return handle;};
    let lastTick=-1;scene.onAfterRenderObservable.add(()=>{window.sweep.frames++;const world=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');if(world&&world.tick!==lastTick){lastTick=world.tick;window.sweep.snapshots.push(world);}const row=window.sweep.effects.find(r=>r.lastFrame===window.sweep.frames);if(row&&row.rendered.includes(2470)&&row.rendered.includes(2827)&&window.sweep.captures.length<3&&(!window.sweep.captures.length||window.sweep.frames-window.sweep.captures.at(-1).frame>=2))window.sweep.captures.push({frame:window.sweep.frames,handle:row.handle,rendered:[...row.rendered],world,canvas:engine.getRenderingCanvas().toDataURL('image/png')});});
  })()`);}
  for(const s of [guest,host]){await waitUntil(s,`document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await nativeClick(s,'[data-waiting-ready]');}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  await nativeClick(host,'#world');
  const press=async(key,code,windowsVirtualKeyCode)=>{for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode},host);};
  await press('2','Digit2',50);
  await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).match.groundTraps.length===1`);
  await press('5','Digit5',53);
  for(const page of pages)await waitUntil(page.sessionId,`window.sweep.effects.some(e=>e.rendered.includes(2470)||e.rendered.includes(2827))&&window.sweep.captures.length===3&&window.sweep.sounds.some(s=>s.played&&s.postGainPeak>0&&s.ended)&&window.sweep.effects.every(e=>e.expired)`,30000);
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.sweep`)));
  for(const [i,o]of evidence.observed.entries()){for(const[j,c]of o.captures.entries()){await writeFile(output+'-canvas-'+(i+1)+'-'+j+'.png',Buffer.from(c.canvas.split(',')[1],'base64'));delete c.canvas;}}
  for(const page of pages)await nativeClick(page.sessionId,'[data-leave-room]');
  for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);

  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({instances:window.sweepRuntime?.instances.length??null,meshes:window.sweepScene.meshes.filter(m=>m.metadata?.originalEffect).length,skillVoices:window.sweepRuntime?.skillSound.voices.size??null,treeVoices:window.sweepRuntime?.sound.voices.size??null,battleVoices:window.sweepBattle?.sound.voices.size??null,world:document.querySelector('#battle-status').dataset.world??null})`)));
  for(const row of evidence.cleanup)assert.deepEqual(row,{instances:0,meshes:0,skillVoices:0,treeVoices:0,battleVoices:0,world:null});
  evidence.status='PASS_ORIGINAL019_AUDIO_END_LEAVE_PENDING_PIXEL_REVIEW';
  console.log(evidence.status+': '+output+'.json');
}catch(error){if(ws)for(const[i,page]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.sweep`).catch(e=>({error:String(e)}))));throw error;}
finally{
  evidence.runtimeErrors=runtimeErrors;
  await writeFile(output+'-server.log',serverLog);
  if(ws)evidence.terminal=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({stages:window.sweepLoadStages,disconnects:window.sweepDisconnects,status:document.querySelector('#battle-status')?.value,world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null'),mapLoaded:window.sweepLoadingBattle?.mapLoaded,resourcesReady:window.sweepLoadingBattle?.players.resourcesReady,loadingError:window.sweepLoadingBattle?.players.loadingError})`).catch(error=>({error:String(error)}))));
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});await writeFile('recovery/output/trap-sweep-effect-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
