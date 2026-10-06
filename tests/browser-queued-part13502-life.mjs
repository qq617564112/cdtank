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
const output='recovery/output/browser-queued-part13502-life-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-queued-part13502-life-'));
const database=join(directory,'accounts.sqlite');
const checkpoint='recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
await copyFile(checkpoint+'-checkpoint.sqlite',database);
const identities=JSON.parse(await readFile(checkpoint+'-identity.private.json','utf8')).accounts;
let server,chrome,vite,ws,serverLog="";
const runtimeErrors=[];
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3465,vite:5495,cdp:9695},mapId:7,itemId:17032,
  scope:'Actual purchased tank3/pet2 checkpoint, authenticated Shop BUY17032/Equipment PART0 API, ordinary React mode4/map7 Ready; first13502 natural death-stop/respawn32 dual draw/canvas and Leave. Existing source/transaction/lifecycle proof reused, no live state injection.', checkpoint:checkpoint+'-checkpoint.sqlite'};
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
  const env={...process.env,PORT:'3465',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'120'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);serverLog+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5495,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3465',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9695',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9695/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9695');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  if(['Runtime.exceptionThrown','Log.entryAdded'].includes(message.method))runtimeErrors.push({sessionId:message.sessionId,method:message.method,params:message.params});
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});

  const purchaser=new WsClient(serviceProto,{server:'ws://127.0.0.1:3465',logger:undefined});
  try{
    assert((await purchaser.connect()).isSucc);
    assert((await purchaser.callApi('Account',{token:identities[0].token})).isSucc);
    const purchase=await purchaser.callApi('Shop',{operation:'BUY',itemTableId:17032,quantity:1,currency:'MONEY',requestId:'part13502_life'});assert(purchase.isSucc);evidence.purchase=purchase.res;
    const instanceId=purchase.res.purchased.instanceId;
    const equipment=await purchaser.callApi('Equipment',{operation:'EQUIP',target:'PART',slot:0,instanceId});assert(equipment.isSucc);evidence.equipment=equipment.res;
  }finally{await purchaser.disconnect();}
  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await command('Page.enable',{},sessionId);await command('Runtime.enable',{},sessionId);await command('Log.enable',{},sessionId);
    await command('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("cdtank-account-token",'+JSON.stringify(identities[index].token)+')'},sessionId);
    await command('Page.navigate',{url:'http://127.0.0.1:5495'},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);
    await evaluate(sessionId,`(async()=>{const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url);const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world'));engine.setHardwareScalingLevel(2);engine.resize();})()`);
  }
  for(const page of pages)await evaluate(page.sessionId,`(async()=>{
    window.lifeLoadStages=[];window.lifeDisconnects=[];
    for(const [path,name,method]of[
      ['/src/assets/scenes/scene-preview.ts','ScenePreview','load'],
      ['/src/assets/scenes/map-scene-effects.ts','MapSceneEffects','load'],
      ['/src/render/battle-players.ts','BattlePlayers','loadPlayer'],
      ['/src/audio/map-environment-sound.ts','MapEnvironmentSound','load']]){
      const prototype=(await import(path))[name].prototype,original=prototype[method];
      prototype[method]=function(...args){const row={name,method,argument:typeof args[0]==='object'?args[0]?.id:args[0],startedAt:performance.now(),state:'pending'};window.lifeLoadStages.push(row);const result=original.apply(this,args);result.then(()=>{row.state='resolved';row.endedAt=performance.now();},error=>{row.state='rejected';row.error=String(error);row.endedAt=performance.now();});return result;};
    }
    const {Battle}=await import('/src/match/battle.ts'),enter=Battle.prototype.enter;
    Battle.prototype.enter=function(...args){window.lifeLoadingBattle=this;if(!this.client.lifeObserved){this.client.lifeObserved=true;this.client.flows.postDisconnectFlow.push(input=>{window.lifeDisconnects.push({at:performance.now(),reason:input.reason,isManual:input.isManual,code:input.code,mapLoaded:this.mapLoaded,resourcesReady:this.players.resourcesReady,loadingError:this.players.loadingError});return input;});}return enter.apply(this,args);};
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
    const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world')),scene=engine.scenes[0];
    engine.setHardwareScalingLevel(2);engine.resize();window.glowScene=scene;
    window.glow={notifications:[],effects:[],frame:0,captures:[],life:[],lifeCaptures:[],snapshots:[],treeSounds:[],skillSounds:[]};
    const {EffectSound}=await import('/src/audio/effect-sound.ts'),soundPlay=EffectSound.prototype.play;
    EffectSound.prototype.play=function(...args){window.glow.treeSounds.push(args);return soundPlay.apply(this,args);};
    const {EffectSkillSound}=await import('/src/audio/effect-skill-sound.ts'),skillPlay=EffectSkillSound.prototype.play;
    EffectSkillSound.prototype.play=function(...args){window.glow.skillSounds.push(args);return skillPlay.apply(this,args);};
    const {BattleSkillEffects}=await import('/src/match/skills/battle-skill-effects.ts');const play=BattleSkillEffects.prototype.play;
    BattleSkillEffects.prototype.play=function(message){if(message.skillId===13502)window.glow.notifications.push({...message,frame:window.glow.frame});return play.call(this,message);};
    const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');const add=EffectRuntime.prototype.addInstance;
    EffectRuntime.prototype.addInstance=function(view,tree){window.glowRuntime=this;const handle=add.call(this,view,tree);if(tree.root.definition.index===2755){const instance=this.instances.find(i=>i.handle===handle);const row={handle,root:2755,owner:view?.root.name,nodes:instance.draws.map(d=>d.node.definition.index),rendered:[]};window.glow.effects.push(row);instance.glowRow=row;}return handle;};
    const draw=EffectRuntime.prototype.draw;EffectRuntime.prototype.draw=function(instance,d){draw.call(this,instance,d);const row=instance.glowRow;if(!row)return;const mesh=d.sprite?.mesh??d.particle?.sprite.mesh??d.overlay?.mesh;if(mesh?.onBeforeRenderObservable&&!mesh.glowObserved){mesh.glowObserved=true;mesh.onBeforeRenderObservable.add(()=>{if(!row.rendered.includes(d.node.definition.index))row.rendered.push(d.node.definition.index);row.lastFrame=window.glow.frame+1;});}};
    const {Battle}=await import('/src/match/battle.ts');const reconcile=Battle.prototype.reconcile;Battle.prototype.reconcile=function(...args){window.glowBattle=this;window.glowRuntime=this.effects;return reconcile.apply(this,args);};
    let snapshotTick=-1;
    scene.onAfterRenderObservable.add(()=>{window.glow.frame++;const world=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');if(world&&world.tick!==snapshotTick){snapshotTick=world.tick;window.glow.snapshots.push(world);}if(world&&window.glowRuntime){const p=world.players.find(p=>p.id==='P1'),v=window.glowBattle?.players.get('P1');if(p&&v){const active=window.glowRuntime.instances.filter(i=>i.tree.root.definition.index===2755&&i.owner?.root.name==='player-P1');const row={tick:world.tick,alive:p.alive,hp:p.hp,maxHp:p.maxHp,deaths:p.deaths,action:v.activeAction,handles:active.map(i=>i.handle),frame:window.glow.frame};window.glow.life.push(row);const stage=!p.alive&&active.length===0?'dead':p.alive&&p.deaths>0&&active.some(i=>i.glowRow?.lastFrame===window.glow.frame)?'revived':undefined;if(stage&&window.glow.lifeCaptures.filter(c=>c.stage===stage).length<3)window.glow.lifeCaptures.push({...row,stage,world,canvas:engine.getRenderingCanvas().toDataURL('image/png')});}}if(window.glow.captures.length>=3)return;const row=window.glow.effects.find(e=>e.rendered.length&&e.lastFrame===window.glow.frame);if(row)window.glow.captures.push({handle:row.handle,frame:window.glow.frame,rendered:[...row.rendered],treeVoices:window.glowRuntime.sound.voices.size,skillVoices:window.glowRuntime.skillSound.voices.size,world,canvas:engine.getRenderingCanvas().toDataURL('image/png')});});
  })()`);}
  for(const s of [guest,host]){await waitUntil(s,`document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await nativeClick(s,'[data-waiting-ready]');}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  console.log('Two purchased ordinary accounts PLAYING; purchased17032 queued32 observer active');
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  const victimId=evidence.initial[0].playerId;
  assert.equal(victimId,'P1');
  await nativeClick(guest,'#world');
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32},guest);
  let aimHeld,dead=false,done=false;
  const releaseAim=async()=>{if(aimHeld){await command('Input.dispatchKeyEvent',{type:'keyUp',key:aimHeld,code:aimHeld,windowsVirtualKeyCode:aimHeld==='ArrowLeft'?37:39},guest);aimHeld=undefined;}};
  const deadlineLife=Date.now()+100000;
  while(Date.now()<deadlineLife){
    const state=await evaluate(guest,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world),me=w.players.find(p=>p.id===w.playerId),target=w.players.find(p=>p.id==='P1'),yaw=me.yaw+me.aim,desired=Math.atan2(target.x-me.x,target.z-me.z);return{alive:target.alive,angle:Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw))}})()`);
    if(!state.alive&&!dead){dead=true;await command('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32},guest);await releaseAim();}
    if(!dead){const next=Math.abs(state.angle)<0.05?undefined:state.angle>0?'ArrowLeft':'ArrowRight';if(next!==aimHeld){await releaseAim();if(next){aimHeld=next;await command('Input.dispatchKeyEvent',{type:'keyDown',key:next,code:next,windowsVirtualKeyCode:next==='ArrowLeft'?37:39},guest);}}}
    const readiness=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.glow.lifeCaptures.some(c=>c.stage==='dead')&&window.glow.lifeCaptures.filter(c=>c.stage==='revived').length>=3`)));
    if(readiness.every(Boolean)){done=true;break;}await new Promise(r=>setTimeout(r,200));
  }
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32},guest);await releaseAim();
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.glow`)));
  for(const [i,o]of evidence.observed.entries()){for(const[j,frame]of [...o.captures,...o.lifeCaptures].entries()){await writeFile(output+'-canvas-'+(i+1)+'-'+j+'.png',Buffer.from(frame.canvas.split(',')[1],'base64'));frame.path=output+'-canvas-'+(i+1)+'-'+j+'.png';delete frame.canvas;}}
  assert(done,'Natural death removes13502 and natural respawn replays32 on both ordinary pages');
  for(const o of evidence.observed){assert(o.life.some(l=>!l.alive&&l.hp===0&&l.handles.length===0));assert(o.lifeCaptures.some(c=>c.stage==='revived'&&c.hp===c.maxHp&&c.hp===700));assert(o.effects.length>=2);}
  for(const page of pages)await nativeClick(page.sessionId,'[data-leave-room]');
  for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);

  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({instances:window.glowRuntime?.instances.length??null,meshes:window.glowScene.meshes.filter(m=>m.metadata?.originalEffect).length,skillVoices:window.glowRuntime?.skillSound.voices.size??null,treeVoices:window.glowRuntime?.sound.voices.size??null,battleVoices:window.glowBattle?.sound.voices.size??null,world:document.querySelector('#battle-status').dataset.world??null})`)));
  evidence.status=evidence.observed.every(v=>v.effects.some(e=>e.rendered.includes(2828))&&v.captures.length)?'PASS_NATURAL_LIFE_RENDER_PENDING_PIXEL_REVIEW':'INCOMPLETE';
  console.log(evidence.status+': '+output+'.json');
}catch(error){if(ws)for(const[i,page]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.glow`).catch(e=>({error:String(e)}))));throw error;}
finally{
  evidence.runtimeErrors=runtimeErrors;
  await writeFile(output+'-server.log',serverLog);
  if(ws)evidence.loading=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({stages:window.lifeLoadStages,disconnects:window.lifeDisconnects,status:document.querySelector('#battle-status')?.value,world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null'),mapLoaded:window.lifeLoadingBattle?.mapLoaded,resourcesReady:window.lifeLoadingBattle?.players.resourcesReady,loadingError:window.lifeLoadingBattle?.players.loadingError})`).catch(error=>({error:String(error)}))));
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});await writeFile('recovery/output/queued-part13502-life-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
