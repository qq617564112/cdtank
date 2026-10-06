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
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-tank-pet-death-presentation-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-tank-pet-death-presentation-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store,aux;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3578,vite:5608,cdp:9808},mapId,ammo:2001,
  scope:'New original pet-type death sprite only: ordinary map7/mode4 Arrow/Space until guest natural death, original pre-room tank1/pet1 explicit. Selected PetTable1/PetType2 qualifies120/dogd. Existing09/HP/respawn/effects/audio proofs reused. No active HP/position/event/clock injection; only new sprite/draw/silence/expiry/dualLeave.'};
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
  const env={...process.env,PORT:'3578',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'60'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5608,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3578',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9808',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9808/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9808');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5608',browserContextId});
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
  aux=await connectBreachAuxiliary('ws://127.0.0.1:3578',roomId,2);
  evidence.auxiliaryPlayers=aux.members.map(m=>({playerId:m.playerId,accountId:m.accountId}));
  await aux.ready(1);
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);

  for(const page of pages)await evaluate(page.sessionId,`(async()=>{
    const source=await(await fetch('/src/render/scene-runtime.ts')).text();
    const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);
    const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world')),scene=engine.scenes[0];
    engine.setHardwareScalingLevel(2);engine.resize();window.petDeathScene=scene;
    window.petDeath={events:[],snapshots:[],shows:[],effects:[],captures:{},frame:0};
    const {Battle}=await import('/src/match/battle.ts');
    const reconcile=Battle.prototype.reconcile;Battle.prototype.reconcile=function(...args){
      if(!this.petDeathObserved){this.petDeathObserved=true;this.client.listenMsg('RoomEvent',event=>{if(event.roomId===this.roomFeed.roomId&&['destroy','respawn'].includes(event.type))window.petDeath.events.push({...event});});}
      return reconcile.apply(this,args);};
    const {BattlePlayers}=await import('/src/render/battle-players.ts');
    const playerReconcile=BattlePlayers.prototype.reconcile;
    BattlePlayers.prototype.reconcile=function(players,...args){
      const snapshot=players.map(player=>({id:player.id,alive:player.alive,previousLife:this.presentedLife.get(player.id)??null,petId:player.petId,hp:player.hp,deaths:player.deaths}));
      window.petDeath.snapshots.push({frame:window.petDeath.frame,players:snapshot});
      const previous=window.petDeathSnapshot;window.petDeathSnapshot=snapshot;
      try{return playerReconcile.call(this,players,...args);}finally{window.petDeathSnapshot=previous;}
    };
    const {TankPetDeathPresentation}=await import('/src/assets/tanks/tank-pet-death-presentation.ts');
    const show=TankPetDeathPresentation.prototype.show;
    TankPetDeathPresentation.prototype.show=function(view,petType,localView){
      const id=view.root.name.replace(/^player-/,''),snapshot=window.petDeathSnapshot?.find(player=>player.id===id);
      const row={id,petType,isLocal:view===localView,snapshot,frame:window.petDeath.frame};window.petDeath.shows.push(row);
      const previous=window.petDeathCall;window.petDeathCall=row;
      try{const handle=show.call(this,view,petType,localView);row.handle=handle;return handle;}finally{window.petDeathCall=previous;}
    };
    const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');
    const spawn=EffectRuntime.prototype.spawnAttachedEffect;
    EffectRuntime.prototype.spawnAttachedEffect=function(view,effectId,tag,oneShot,localView){
      const handle=spawn.call(this,view,effectId,tag,oneShot,localView);window.petDeathRuntime=this;
      if([119,120].includes(effectId)){
        const instance=this.instances.find(value=>value.handle===handle);
        const row={...window.petDeathCall,handle,effectId,tag,oneShot,owner:view.root.name,
          liveParent:instance?.tree.parentMatrix===view.primaryTag('tag_efcenter'),
          nodes:instance?.tree.nodes.map(node=>({index:node.definition.index,type:node.definition.type}))??[],
          draws:[],expired:false};window.petDeath.effects.push(row);if(instance)instance.petDeathRow=row;
      }
      return handle;
    };
    const runtimeDraw=EffectRuntime.prototype.draw;
    EffectRuntime.prototype.draw=function(instance,draw){const result=runtimeDraw.call(this,instance,draw);
      const row=instance.petDeathRow,mesh=draw.sprite?.mesh;if(!row||!mesh)return result;
      mesh.petDeathCurrent={node:draw.node.definition.index,elapsed:instance.tree.root.lifecycle.elapsed,
        frame:window.petDeath.frame,parent:Array.from(instance.tree.parentMatrix??[])};
      if(!mesh.petDeathObserved){mesh.petDeathObserved=true;
        mesh.onBeforeRenderObservable.add(()=>{row.draws.push({...mesh.petDeathCurrent,
          positions:mesh.getVerticesData('position'),indices:mesh.getIndices(),
          textures:mesh.material?.getActiveTextures().map(texture=>texture.url)??[]});row.lastFrame=window.petDeath.frame;});
      }
      return result;
    };
    const remove=EffectRuntime.prototype.remove;
    EffectRuntime.prototype.remove=function(index){const instance=this.instances[index];
      if(instance.petDeathRow){instance.petDeathRow.expired=instance.tree.quiescent;instance.petDeathRow.removedFrame=window.petDeath.frame;}
      return remove.call(this,index);
    };
    scene.onAfterRenderObservable.add(()=>{
      const row=window.petDeath.effects.find(effect=>effect.lastFrame===window.petDeath.frame),draw=row?.draws.at(-1);
      if(draw){const stage=draw.elapsed<2.5?'first':draw.elapsed<3.5?'middle':'late';
        if(!window.petDeath.captures[stage])window.petDeath.captures[stage]={elapsed:draw.elapsed,frame:window.petDeath.frame,
          effectId:row.effectId,handle:row.handle,canvas:engine.getRenderingCanvas().toDataURL('image/png')};}
      window.petDeath.frame++;
    });
  })()`);
  for(const session of [guest,host]){await waitUntil(session,`document.querySelector('[data-waiting-ready]')?.matches(':enabled')`);await nativeClick(session,'[data-waiting-ready]');}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.fixture='Original tank1/pet1 pre-room records; four authenticated Ready players. Host ordinary native Arrow aim and Space until guest natural death, other accounts normal idle; configured60s limit, no active clock or state adjustment.';
  const world=session=>evaluate(session,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  evidence.initial=await Promise.all(pages.map(page=>world(page.sessionId)));
  evidence.inputs=[];
  let held=new Set();
  async function setKeys(keys){for(const code of new Set([...held,...keys])){if(held.has(code)===keys.has(code))continue;await command('Input.dispatchKeyEvent',{type:keys.has(code)?'keyDown':'keyUp',code,key:code==='Space'?' ':code,windowsVirtualKeyCode:{Space:32,ArrowLeft:37,ArrowRight:39}[code]},host);}held=keys;}
  await nativeClick(host,'#world');
  const targetId=evidence.initial[1].playerId;
  const inputDeadline=Date.now()+25000;
  while(Date.now()<inputDeadline){
    const current=await world(host),me=current.players.find(player=>player.id===current.playerId),target=current.players.find(player=>player.id===targetId);
    if(current.phase!=='PLAYING'||!me||!target)break;
    const bearing=Math.atan2(target.x-me.x,target.z-me.z),error=Math.atan2(Math.sin(bearing-me.yaw-me.aim),Math.cos(bearing-me.yaw-me.aim)),distance=Math.hypot(target.x-me.x,target.z-me.z);
    const keys=new Set();
    if(me.alive&&target.alive){if(Math.abs(error)>.035)keys.add(error>0?'ArrowLeft':'ArrowRight');if(Math.abs(error)<.06&&distance<950)keys.add('Space');}
    evidence.inputs.push({tick:current.tick,actor:me.id,target:target.id,x:me.x,z:me.z,yaw:me.yaw,aim:me.aim,targetHP:target.hp,targetAlive:target.alive,distance,error,keys:[...keys]});
    await setKeys(keys);
    if(!target.alive){evidence.deathWorld=current;break;}
    await new Promise(resolve=>setTimeout(resolve,120));
  }
  await setKeys(new Set());
  const expiryDeadline=Date.now()+30000;
  while(Date.now()<expiryDeadline){
    const ready=await Promise.all(pages.map(page=>evaluate(page.sessionId,`window.petDeath.effects.some(effect=>effect.id===${JSON.stringify(targetId)}&&effect.expired)`)));
    if(ready.every(Boolean))break;
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  evidence.afterInputs=await Promise.all(pages.map(page=>world(page.sessionId)));
  evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.petDeath')));
  const failures=[];
  if(!evidence.deathWorld)failures.push('Ordinary input did not cause target death');
  for(const [index,row]of evidence.observed.entries()){
    for(const [stage,capture]of Object.entries(row.captures)){
      const path=output+'-'+stage+'-'+(index+1)+'.png';
      await writeFile(path,Buffer.from(capture.canvas.split(',')[1],'base64'));delete capture.canvas;capture.path=path;
    }
    const shows=row.shows.filter(show=>show.id===targetId),effects=row.effects.filter(effect=>effect.id===targetId);
    if(shows.length!==1||shows[0].petType!==2||shows[0].snapshot?.petId!==1||shows[0].snapshot?.previousLife!==true||shows[0].snapshot?.alive!==false)failures.push('side'+index+' original same-actor pet classification/death transition missing');
    if(effects.length!==1||effects[0].effectId!==120||effects[0].tag!==0||!effects[0].oneShot||!effects[0].liveParent)failures.push('side'+index+' original120/live center ownership missing');
    if(!effects.some(effect=>effect.draws.some(draw=>draw.node===3031&&draw.textures.some(texture=>texture.endsWith('/Data/effect/xy/dogd.png')))))failures.push('side'+index+' original dogd actual draw missing');
    if(effects.some(effect=>effect.nodes.some(node=>node.type===4)))failures.push('side'+index+' pet death source unexpectedly has tree sound');
    if(!effects.some(effect=>effect.expired))failures.push('side'+index+' natural pet death effect expiry missing');
    if(!Object.keys(row.captures).length)failures.push('side'+index+' callback canvas missing');
    if(!row.events.some(event=>event.type==='destroy'&&event.targetId===targetId))failures.push('side'+index+' formal ordinary destroy missing');
  }
  for(const page of pages){
    const selector=await evaluate(page.sessionId,`document.querySelector('[data-leave-room]')?'[data-leave-room]':document.querySelector('[data-summary-leave]')?'[data-summary-leave]':null`);
    assert(selector,'Formal battle or summary Leave exists');await nativeClick(page.sessionId,selector);
    await waitUntil(page.sessionId,`!document.querySelector('#battle-status')?.dataset.world`);
  }
  await aux.leave(1);
  evidence.cleanup=await Promise.all(pages.map(page=>evaluate(page.sessionId,`({world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null'),effects:window.petDeathRuntime.instances.length,petEffects:window.petDeathRuntime.instances.filter(instance=>[3027,3029].includes(instance.tree.root.definition.index)).length,petMeshes:window.petDeathScene.meshes.filter(mesh=>mesh.petDeathObserved).length,voices:window.petDeathRuntime.sound.voices.size,skillVoices:window.petDeathRuntime.skillSound.voices.size})`)));
  for(const [index,row]of evidence.cleanup.entries())if(row.world!==null||row.effects!==0||row.petEffects!==0||row.petMeshes!==0||row.voices!==0||row.skillVoices!==0)failures.push('side'+index+' normal Leave cleanup incomplete');
  evidence.failures=failures;evidence.status=failures.length?'INCOMPLETE':'PASS_FINITE_PET_DEATH_SPRITE_NORMAL_LEAVE';console.log(evidence.status+': '+output+'.json');
}catch(error){
  evidence.status='FAIL';evidence.error=String(error);
  if(ws){
    evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.petDeath').catch(error=>({error:String(error)}))));
    evidence.failureLeave=[];
    for(const page of pages){
      try{
        const selector=await evaluate(page.sessionId,`document.querySelector('[data-leave-room]')?'[data-leave-room]':document.querySelector('[data-summary-leave]')?'[data-summary-leave]':null`);
        if(selector){await nativeClick(page.sessionId,selector);await waitUntil(page.sessionId,`!document.querySelector('#battle-status')?.dataset.world`,15000);}
        evidence.failureLeave.push(await evaluate(page.sessionId,`({selector:${JSON.stringify(selector)},world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null')})`));
      }catch(leaveError){evidence.failureLeave.push({error:String(leaveError)});}
    }
  }
  throw error;
}
finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
  await aux?.disconnect();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  await writeFile('recovery/output/tank-pet-death-presentation-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,serverSignal:server?.signalCode,chromeExit:chrome?.exitCode,chromeSignal:chrome?.signalCode},null,2)+'\n');
}
