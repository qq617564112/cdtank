import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
const WebSocket=createRequire(import.meta.url)('ws');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-combat-shot-player-result-2010-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-shot-player-result-2010-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3378,vite:5408,cdp:9608},mapId:7,ammo:2010,
  scope:'Limited actual original smoke; all one drawing node separately recorded, missing short strips not assumed. Formal React dual normal accounts map7/mode4, host sole ordinary2010 shooter and guest observer. Original013 live victim tag/spatialSE14/natural end/Leave; pre-room original tank1/pet1 and2010 inventory15/instance77 disclosed, damage and flight remain rebuilt.'};
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
  const env={...process.env,PORT:'3378',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'120'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5408,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3378',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9608',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9608/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9608');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5408',browserContextId});
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
    store.replaceInventory(account.accountId,[{instanceId:77,itemTableId:2010,ownedQuantity:15,battleQuantity:0,state:0,field8:0,float24Bits:0,float28Bits:0,float2cBits:0}]);store.assign(account.accountId,77,1);

    const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa8,72,true);view.setUint32(0xa4,base.fields.get(0),true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
  }
  store.close();store=undefined;
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  for(const page of pages){await nativeClick(page.sessionId,'[data-room-card-home]');await waitUntil(page.sessionId,`document.querySelector('#home-inventory[open] [data-source-control="btnClose"]')`);await nativeClick(page.sessionId,'[data-home-close]');await waitUntil(page.sessionId,`!document.querySelector('#home-inventory[open]')`);}
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')`);await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
  const joinPoint=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...joinPoint},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...joinPoint},guest);
  await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).renderedPlayers===2`);
  for(const page of pages){
    await evaluate(page.sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world')),scene=engine.scenes[0];
      engine.setHardwareScalingLevel(4);engine.resize();window.muzzleScene=scene;window.muzzleCamera=scene.activeCamera;
      window.muzzle={captures:{},effects:[],sounds:[],events:[],results:[],lives:[],frames:0,frameTimes:[],canvas:{width:engine.getRenderWidth(),height:engine.getRenderHeight()}};
      const {TankShotPlayerResult}=await import('/src/assets/tanks/shot-player-result.ts');
      const show=TankShotPlayerResult.prototype.showPlayerResult;
      TankShotPlayerResult.prototype.showPlayerResult=function(victim,itemId,localView){
        const row={event:window.muzzle.currentEvent,victim:victim.root.name,itemId,local:victim===localView,position:[-victim.root.position.x,victim.root.position.y,victim.root.position.z],frame:window.muzzle.frames};
        window.muzzle.results.push(row);window.muzzle.currentResult=row;try{return show.call(this,victim,itemId,localView);}finally{window.muzzle.currentResult=null;}};
      const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');const add=EffectRuntime.prototype.addInstance;
      EffectRuntime.prototype.addInstance=function(view,tree){const handle=add.call(this,view,tree);window.muzzleRuntime=this;
        if(tree.root.definition.index===2748&&window.muzzle.currentResult){const instance=this.instances.find(i=>i.handle===handle);
          const row={handle,result:window.muzzle.currentResult,root:2748,owner:view.root.name,nodes:instance.draws.map(d=>d.node.definition.index),liveParent:tree.parentMatrix===view.primaryTag('tag_efcenter'),rendered:[],vertices:{},textures:{},expired:false,frameCaptures:0};window.muzzle.effects.push(row);instance.resultRow=row;}return handle;};
      const draw=EffectRuntime.prototype.draw;
      EffectRuntime.prototype.draw=function(instance,d){draw.call(this,instance,d);const row=instance.resultRow;if(!row)return;
        row.liveParent&&=instance.tree.parentMatrix===instance.owner.primaryTag('tag_efcenter');
        const mesh=d.sprite?.mesh??d.particle?.sprite.mesh??d.overlay?.mesh;
        if(mesh?.onBeforeRenderObservable&&!mesh.resultObserved){mesh.resultObserved=true;mesh.onBeforeRenderObservable.add(()=>{
          if(!row.rendered.includes(d.node.definition.index))row.rendered.push(d.node.definition.index);
          row.vertices[d.node.definition.index]=mesh.getTotalVertices();row.textures[d.node.definition.index]=mesh.material.getActiveTextures()[0]?.url;
        });}};
      const remove=EffectRuntime.prototype.remove;
      EffectRuntime.prototype.remove=function(index){const i=this.instances[index];if(i.resultRow)i.resultRow.expired=i.tree.quiescent;return remove.call(this,index);};
      const {EffectSkillSound}=await import('/src/audio/effect-skill-sound.ts');const play=EffectSkillSound.prototype.play;
      EffectSkillSound.prototype.play=function(reference,selector,position){const handle=play.call(this,reference,selector,position);
        if(reference==='SE14'&&window.muzzle.currentResult){window.muzzleSkillSound=this;const voice=this.voices.get(handle);
          const row={result:window.muzzle.currentResult,handle,reference,selector,position:[...position],loop:voice?.audio.loop,src:voice?.audio.src,context:this.context.state,played:false,ended:false,outputPeak:0,postGainPeak:0};window.muzzle.sounds.push(row);
          if(voice){voice.audio.addEventListener('playing',()=>{row.played=true;});const analyser=this.context.createAnalyser();analyser.fftSize=256;voice.source.connect(analyser);const post=this.context.createAnalyser();post.fftSize=256;voice.gain.connect(post);
            const interval=setInterval(()=>{const samples=new Float32Array(256);analyser.getFloatTimeDomainData(samples);row.outputPeak=Math.max(row.outputPeak,...samples.map(Math.abs));post.getFloatTimeDomainData(samples);row.postGainPeak=Math.max(row.postGainPeak,...samples.map(Math.abs));},10);
            voice.audio.addEventListener('ended',()=>{row.ended=true;clearInterval(interval);analyser.disconnect();post.disconnect();},{once:true});}}
        return handle;};
      const {BattleSound}=await import('/src/audio/battle-sound.ts');const event=BattleSound.prototype.event;
      BattleSound.prototype.event=function(value,...args){window.muzzleSound=this;window.muzzle.currentEvent=value;if(['fire','hit','destroy','respawn'].includes(value.type))window.muzzle.events.push(value);return event.call(this,value,...args);};
      const {Battle}=await import('/src/match/battle.ts');const reconcile=Battle.prototype.reconcile;
      const render=Battle.prototype.render;Battle.prototype.render=function(...args){window.muzzleBattle=this;return render.apply(this,args);};
      Battle.prototype.reconcile=function(...args){window.muzzleBattle=this;return reconcile.apply(this,args);};
      const seen=new Map();scene.onAfterRenderObservable.add(()=>{const raw=document.querySelector('#battle-status')?.dataset.world;if(!raw||!window.muzzleBattle)return;const state=JSON.parse(raw);
        for(const player of state.players){const view=window.muzzleBattle.players.get(player.id);if(!view)continue;const key=player.alive+':'+view.activeAction;
          if(seen.get(player.id)!==key){seen.set(player.id,key);window.muzzle.lives.push({id:player.id,alive:player.alive,action:view.activeAction,hp:player.hp,maxHp:player.maxHp,deaths:player.deaths,frame:window.muzzle.frames});}}});
      scene.onAfterRenderObservable.add(()=>{
        for(const row of window.muzzle.effects){
          const instance=window.muzzleRuntime?.instances.find(i=>i.handle===row.handle);if(!instance)continue;
          const elapsed=instance.tree.root.lifecycle.elapsed;
          const phase=elapsed<.3?'early':elapsed<.6?'smoke':'late';
          if(row.frameCaptures>=3||window.muzzle.captures[row.handle+'-'+phase])continue;
          const key=row.handle+'-'+phase;row.frameCaptures++;
          const meshes=instance.draws.map(d=>{const mesh=d.sprite?.mesh??d.particle?.sprite.mesh;const colors=mesh?.getVerticesData('color');return {node:d.node.definition.index,vertices:mesh?.getTotalVertices(),maxAlpha:colors?Math.max(...colors.filter((_,i)=>i%4===3)):0};});
          window.muzzle.captures[key]={event:row.result.event,elapsed,meshes,active:instance.tree.nodes.map(n=>({node:n.definition.index,phase:n.lifecycle.phase,elapsed:n.lifecycle.elapsed})),canvas:engine.getRenderingCanvas().toDataURL('image/png')};
        }
        window.muzzle.frames++;if(window.muzzle.frameTimes.length<3000)window.muzzle.frameTimes.push(engine.getDeltaTime());
      });
    })()`);
  }
  for(const s of [guest,host]){await waitUntil(s,`window.muzzleBattle?.players.resourcesReady&&!window.muzzleBattle.players.loadingError&&document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await nativeClick(s,'[data-waiting-ready]');}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  console.log('Normal map0007/mode4 dual accounts PLAYING; host sole2010 shooter');
  const key=async(s,key,code,windowsVirtualKeyCode)=>{await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode},s);};
  const world=s=>evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  const ids=await Promise.all(pages.map(async p=>(await world(p.sessionId)).playerId));
  evidence.initial=await Promise.all(pages.map(p=>world(p.sessionId)));
  for(const page of pages){await nativeClick(page.sessionId,'#world');await key(page.sessionId,'2','Digit2',50);await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.find(p=>p.id===JSON.parse(document.querySelector('#battle-status').dataset.world).playerId).ammoItemId===2010`);}
  evidence.inputs=[];
  const held=new Map(pages.map(p=>[p.sessionId,new Set()]));
  const setKeys=async(s,keys)=>{const old=held.get(s);for(const code of new Set([...old,...keys]))if(old.has(code)!==keys.has(code))await command('Input.dispatchKeyEvent',{type:keys.has(code)?'keyDown':'keyUp',key:code==='Space'?' ':code,code,windowsVirtualKeyCode:({Space:32,ArrowLeft:37,ArrowRight:39})[code]},s);held.set(s,keys);};
  const gate=Date.now()+60000;let done=false, firstHit=false;
  while(Date.now()<gate){
    for(const [index,page]of pages.entries()){const w=await world(page.sessionId),me=w.players.find(p=>p.id===w.playerId),keys=new Set();
      if(index===0&&!firstHit&&w.phase==='PLAYING'&&me.alive&&me.ammoItemId===2010){const target=w.players.filter(p=>p.id!==me.id&&p.alive).sort((a,b)=>Math.hypot(a.x-me.x,a.z-me.z)-Math.hypot(b.x-me.x,b.z-me.z))[0];if(target){const angle=Math.atan2(target.x-me.x,target.z-me.z),error=Math.atan2(Math.sin(angle-me.yaw-me.aim),Math.cos(angle-me.yaw-me.aim));if(Math.abs(error)>.025)keys.add(error>0?'ArrowLeft':'ArrowRight');if(Math.abs(error)<.04)keys.add('Space');evidence.inputs.push({tick:w.tick,id:me.id,target:target.id,x:me.x,z:me.z,error,keys:[...keys]});}}
      await setKeys(page.sessionId,keys);}
    const values=await Promise.all(pages.map(p=>evaluate(p.sessionId,'({effects:window.muzzle.effects,sounds:window.muzzle.sounds})')));
    firstHit ||= values.some(v=>v.effects.length>0);
    done=values.every(v=>v.effects.some(e=>e.rendered.includes(2752)&&e.expired&&e.liveParent)&&v.sounds.some(r=>r.played&&r.ended&&r.outputPeak>0&&r.postGainPeak>0));if(done)break;
    if((await world(host)).phase==='FINISHED')break;await new Promise(r=>setTimeout(r,100));
  }
  for(const page of pages)await setKeys(page.sessionId,new Set());
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.muzzle`)));
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  evidence.sameHit=evidence.observed[0].events.filter(e=>e.type==='hit'&&e.shotPlayerResult?.itemId===2010&&evidence.observed[1].events.some(f=>same(e,f)));
  assert(evidence.sameHit.length,'Identical legal result hit on both pages');
  evidence.sameRenderedHit=evidence.sameHit.filter(e=>evidence.observed.every(v=>v.effects.some(r=>same(r.result.event,e)&&r.rendered.length===1&&r.expired&&r.liveParent)&&v.sounds.some(r=>same(r.result.event,e)&&r.played&&r.ended&&r.outputPeak>0&&r.postGainPeak>0)));
  evidence.allNodesOnBothPages=evidence.sameRenderedHit.length>0;
  for(const [i,v]of evidence.observed.entries()){
    for(const r of v.results.filter(r=>r.itemId===2010)){assert.equal(r.itemId,2010);assert.equal(r.event.type,'hit');assert.equal(r.event.shotPlayerResult.itemId,2010);}
    for(const r of v.sounds){assert.deepEqual(r.position,r.result.position);assert.equal(r.selector,1);assert.equal(r.loop,false);assert(r.src);}


    evidence.nodeCoverage??=[];evidence.nodeCoverage.push(v.effects.map(r=>({nodes:r.nodes,rendered:r.rendered})));
    for(const [handle,capture]of Object.entries(v.captures)){await writeFile(output+'-natural-'+(i+1)+'-'+handle+'.png',Buffer.from(capture.canvas.split(',')[1],'base64'));delete capture.canvas;}
    const shot=await command('Page.captureScreenshot',{format:'png'},pages[i].sessionId);await writeFile(output+'-actual-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}
  for(const page of pages)await nativeClick(page.sessionId,'[data-leave-room]');
  for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({instances:window.muzzleRuntime.instances.length,meshes:window.muzzleScene.meshes.filter(m=>m.metadata?.originalEffect).length,voices:window.muzzleSound.voices.size,skillVoices:window.muzzleSkillSound.voices.size,state:document.querySelector('[data-source-audio="battle-sound"]').dataset.state})`)));
  for(const row of evidence.cleanup)assert.deepEqual(row,{instances:0,meshes:0,voices:0,skillVoices:0,state:'stopped'});
  assert(evidence.observed.every(v=>v.effects.some(r=>r.rendered.includes(2752)&&r.expired&&r.liveParent)&&v.sounds.some(r=>r.played&&r.ended&&r.postGainPeak>0)),'same ordinary hit original smoke/SE14 ends on both pages');
  evidence.status='PASS_LIMITED_PLAYER_SCOPE';console.log(evidence.status+': '+output+'.json');
}catch(error){if(ws)for(const[i,page]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.muzzle`).catch(e=>({error:String(e)}))));throw error;}
finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});await writeFile('recovery/output/combat-shot-player-result-2010-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
