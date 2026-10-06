import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {getBattlefield} from '../apps/server/src/battlefield.ts';
import {createRoleFreeAim} from '../apps/server/src/battle/roles/free-aim.ts';
const field=getBattlefield(2);
const WebSocket=createRequire(import.meta.url)('ws');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-muzzle-block-map2-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-muzzle-b-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3288,vite:5318,cdp:9518},mapId:2,tankId:105,
  scope:'Four ordinary webpages source min4, two observed mode1/map2 normal spawn/CDP turn/move/Space. Rebuilt muzzle-segment terrainHit true surface XYZ, no projectile; source scene/free immediate shotDisplay world007/SE30 actual draw/play/expiry. Default autoplay. Normal camera follow; no state/camera injection.'};
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
  const env={...process.env,PORT:'3288',ACCOUNT_DB_PATH:database};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5318,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3288',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9518',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9518/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9518');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});

  for(let index=0;index<4;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5318',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu')&&!document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);const engine=EngineStore.LastCreatedEngine,scene=EngineStore.LastCreatedScene;
      engine.setHardwareScalingLevel(4);engine.resize();window.muzzleScene=scene;window.muzzleCamera=scene.activeCamera;
      window.muzzle={effects:[],sounds:[],events:[],requests:[],lives:[],captures:{},frames:0,frameTimes:[],canvas:{width:engine.getRenderWidth(),height:engine.getRenderHeight()}};
      const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');const add=EffectRuntime.prototype.addInstance;
      EffectRuntime.prototype.addInstance=function(view,tree){const handle=add.call(this,view,tree);
        if(tree.root.definition.index===2432){window.muzzleRuntime=this;const instance=this.instances.find(i=>i.handle===handle);
          instance.shotRow={handle,event:window.muzzle.currentEvent,root:2432,owner:view?.root.name??null,origin:[...tree.origin],world:!tree.parentMatrix,nodes:instance.draws.map(d=>d.node.definition.index),rendered:[],vertices:{},textures:{},expired:false};window.muzzle.effects.push(instance.shotRow);}
        return handle;};
      const spawnWorld=EffectRuntime.prototype.spawnWorldEffect;
      EffectRuntime.prototype.spawnWorldEffect=function(name,origin){window.muzzleRuntime=this;const handle=spawnWorld.call(this,name,origin);window.muzzle.requests.push({event:window.muzzle.currentEvent,name,origin:[...origin],handle,frame:window.muzzle.frames});return handle;};
      const draw=EffectRuntime.prototype.draw;
      EffectRuntime.prototype.draw=function(instance,d){draw.call(this,instance,d);const row=instance.shotRow;if(!row)return;
        const mesh=d.sprite?.mesh??d.particle?.sprite.mesh??d.overlay?.mesh;
        if(mesh&&!mesh.shotObserved){mesh.shotObserved=true;mesh.onBeforeRenderObservable.add(()=>{
          if(!row.rendered.includes(d.node.definition.index))row.rendered.push(d.node.definition.index);row.lastDrawFrame=window.muzzle.frames+1;
          row.vertices[d.node.definition.index]=mesh.getTotalVertices();row.textures[d.node.definition.index]=mesh.material.getActiveTextures()[0]?.url;
        });}};
      const remove=EffectRuntime.prototype.remove;
      EffectRuntime.prototype.remove=function(index){const instance=this.instances[index];if(instance.shotRow)instance.shotRow.expired=instance.tree.quiescent;return remove.call(this,index);};
      const {EffectSound}=await import('/src/audio/effect-sound.ts');const play=EffectSound.prototype.play;
      EffectSound.prototype.play=function(reference,parameter){const handle=play.call(this,reference,parameter);
        if(reference==='SE30'){const voice=this.voices.get(handle),row={event:window.muzzle.currentEvent,handle,reference,parameter,src:voice?.audio?.src??null,loop:voice?.audio?.loop??null,volume:voice?.audio?.volume,played:false,ended:false};
          voice?.audio?.addEventListener('playing',()=>{row.played=true;});voice?.audio?.addEventListener('ended',()=>{row.ended=true;row.duration=voice.audio.duration;});window.muzzle.sounds.push(row);}
        return handle;};
      const {BattleSound}=await import('/src/audio/battle-sound.ts');const event=BattleSound.prototype.event;
      BattleSound.prototype.event=function(value,...args){window.muzzleSound=this;window.muzzle.currentEvent=value;if(['fire','terrainHit','hit','destroy','respawn'].includes(value.type))window.muzzle.events.push({...value,observedBullets:args[0]?.bullets?.filter(b=>b.ownerId===value.playerId).length});return event.call(this,value,...args);};
      const {Battle}=await import('/src/match/battle.ts');const reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.muzzleBattle=this;return reconcile.apply(this,args);};
      const seen=new Map();
      scene.onAfterRenderObservable.add(()=>{window.muzzle.frames++;if(window.muzzle.frameTimes.length<4000)window.muzzle.frameTimes.push(engine.getDeltaTime());
        const raw=document.querySelector('#battle-status')?.dataset.world;if(!raw||!window.muzzleBattle)return;
        const state=JSON.parse(raw);for(const player of state.players){const view=window.muzzleBattle.players.get(player.id);if(!view)continue;
          const key=player.alive+':'+view.activeAction;
          if(seen.get(player.id)!==key){seen.set(player.id,key);window.muzzle.lives.push({id:player.id,alive:player.alive,action:view.activeAction,hp:player.hp,maxHp:player.maxHp,deaths:player.deaths,frame:window.muzzle.frames});}}
        for(const row of window.muzzle.effects.filter(r=>r.lastDrawFrame===window.muzzle.frames&&r.rendered.length>0)){if(row.event?.playerId&&(!window.muzzle.captures[row.event.playerId]||window.muzzle.captures[row.event.playerId].handle!==row.handle||window.muzzle.captures[row.event.playerId].rendered.length<row.rendered.length))window.muzzle.captures[row.event.playerId]={handle:row.handle,event:row.event,origin:[...row.origin],rendered:[...row.rendered],frame:window.muzzle.frames,world:state,canvas:engine.getRenderingCanvas().toDataURL('image/png')};}
      });
    })()`);
  }
  store=new AccountStore(database);const native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(r=>r.tankId===105&&r.part===0);
  for(const [index,page]of pages.entries()){
    const account=store.open(await evaluate(page.sessionId,`localStorage.getItem('cdtank-account-token')`));
    const fields=v=>new Map(Object.entries(v).map(([k,v])=>[Number(k),v]));
    const equipment={name:'明确导入原战车',fields:fields(native.equipment)},base={name:'明确导入原宠物',fields:fields(native.base)};
    equipment.fields.set(0x1c,72);equipment.fields.set(0x24,105);equipment.fields.set(0x28,1050011);equipment.fields.set(0x2c,1050012);equipment.fields.set(0x30,1050013);
    store.replaceRoleRecords(account.accountId,{base:[base],equipment:[equipment]});
    const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa8,72,true);view.setUint32(0xa4,base.fields.get(0),true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
  }
  store.close();store=undefined;
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  await nativeClick(host,'#open-home');await waitUntil(host,`document.querySelector('[data-home-close]')`);await nativeClick(host,'[data-home-close]');
  if(!await evaluate(host,`document.querySelector('#create-room-controls').open`))await nativeClick(host,'#create-room-controls > summary');
  await nativeSelect(host,'#tank',105);await nativeSelect(host,'#room-mode',1);await waitUntil(host,`Array.from(document.querySelector('#room-map').options).some(o=>o.value==='2')`);await nativeSelect(host,'#room-map',2);await nativeClick(host,'#create-room');
  await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  for(const page of pages.slice(1)){const session=page.sessionId;await nativeClick(session,'#open-home');await waitUntil(session,`document.querySelector('[data-home-close]')`);await nativeClick(session,'[data-home-close]');await nativeSelect(session,'#tank',105);await nativeClick(session,'#refresh-rooms');await waitUntil(session,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})`);await nativeSelect(session,'#room',roomId);await nativeClick(session,'#join');}
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);
  for(const page of [...pages.slice(1),pages[0]])await nativeClick(page.sessionId,'[data-ready]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  assert(evidence.initial.every(s=>s.mapId===2&&s.mode===1&&s.players.length===4));
  let controlled=host;
  const own=async()=>evaluate(controlled,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.players.find(p=>p.id===s.playerId)})()`);
  const key=async(code,down)=>command('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',key:code==='Space'?' ':code.startsWith('Arrow')?code:code.slice(-1).toLowerCase(),code,windowsVirtualKeyCode:code==='Space'?32:code==='ArrowLeft'?37:code==='ArrowRight'?39:code.charCodeAt(3)},controlled);
  await nativeClick(host,'#world');
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const pulse=async(code,ms=80)=>{await key(code,true);await new Promise(r=>setTimeout(r,ms));await key(code,false);await new Promise(r=>setTimeout(r,150));};
  const turnTo=async(heading)=>{const gate=Date.now()+15000;while(Date.now()<gate){const p=await own(),diff=wrap(heading-p.yaw);if(Math.abs(diff)<.04)return;await pulse(diff>0?'KeyA':'KeyD',Math.abs(diff)>.5?300:80);}};
  const probe=(p,angle)=>{const a=createRoleFreeAim(p,{x:Math.sin(angle),y:0,z:Math.cos(angle)},0),dx=a.x-Math.fround(p.x),dz=a.z-Math.fround(p.z),length=Math.hypot(dx,dz),start={x:p.x,y:p.y+20,z:p.z},end={x:p.x+30*dx/length,y:start.y,z:p.z+30*dz/length};return {actor:p,start,end,surface:field.firstSurfaceHit(start,end,1)};};
  evidence.route=[];
  controlled=guest;await nativeClick(guest,'#world');const peerGoal={x:-1550,z:1090},peerGate=Date.now()+60000;
  while(Date.now()<peerGate){const p=await own();if(Math.hypot(peerGoal.x-p.x,peerGoal.z-p.z)<35)break;const desired=Math.atan2(peerGoal.x-p.x,peerGoal.z-p.z);if(Math.abs(wrap(desired-p.yaw))>.08)await turnTo(desired);await pulse('KeyW',300);}
  evidence.peerNear=await own();controlled=host;await nativeClick(host,'#world');
  await turnTo(5*Math.PI/36);evidence.turned=await own();console.log('Normal map2 source route5 turn',JSON.stringify(evidence.turned));
  let obstruction;const goal={x:-1476.5,z:1168.66},moveGate=Date.now()+60000;
  while(Date.now()<moveGate){const p=await own(),row=probe(p,p.yaw+p.aim);evidence.route.push(row);if(row.surface){obstruction=row;break;}if(Math.hypot(goal.x-p.x,goal.z-p.z)<3)break;const desired=Math.atan2(goal.x-p.x,goal.z-p.z);if(Math.abs(wrap(desired-p.yaw))>.06)await turnTo(desired);await pulse('KeyW',200);}
  if(!obstruction){const p=await own();const candidates=[];for(let a=-Math.PI;a<Math.PI;a+=.02){const row=probe(p,a);if(row.surface)candidates.push({...row,angle:a});}evidence.nearSurfaceAngles=candidates.map(v=>({angle:v.angle,surface:v.surface}));assert(candidates.length,'Known route5 near-source location has reachable muzzle surface');const desired=candidates.sort((a,b)=>Math.abs(wrap(a.angle-p.yaw-p.aim))-Math.abs(wrap(b.angle-p.yaw-p.aim)))[0].angle;const gate=Date.now()+12000;while(Date.now()<gate){const actor=await own(),row=probe(actor,actor.yaw+actor.aim);evidence.route.push(row);if(row.surface){obstruction=row;break;}const diff=wrap(desired-actor.yaw-actor.aim);await pulse(diff>0?'ArrowLeft':'ArrowRight',80);}}
  evidence.obstruction=obstruction;assert(obstruction,'Ordinary route5 move and native turret aim reaches blocked muzzle');
  evidence.beforeFire=await own();
  await key('Space',true);await new Promise(r=>setTimeout(r,120));await key('Space',false);
  for(const page of pages.slice(0,2))await waitUntil(page.sessionId,`window.muzzle.events.some(e=>e.type==='terrainHit'&&e.playerId===${JSON.stringify(evidence.initial[0].playerId)})&&window.muzzle.effects.some(e=>e.rendered.length>0&&e.expired)&&window.muzzle.sounds.some(s=>s.played&&s.ended)`);
  for(const page of pages.slice(0,2))await waitUntil(page.sessionId,`window.muzzle.effects.filter(e=>e.event?.playerId===${JSON.stringify(evidence.initial[0].playerId)}).every(e=>e.expired)&&window.muzzle.sounds.filter(s=>s.event?.playerId===${JSON.stringify(evidence.initial[0].playerId)}).every(s=>s.ended)`);
  evidence.firstShot=await Promise.all(pages.slice(0,2).map(p=>evaluate(p.sessionId,'window.muzzle')));
  for(const [i,o]of evidence.firstShot.entries()){const c=o.captures[evidence.initial[0].playerId];if(c){await writeFile(output+'-first-'+(i+1)+'.png',Buffer.from(c.canvas.split(',')[1],'base64'));for(const row of Object.values(o.captures))delete row.canvas;}}
  evidence.observed=await Promise.all(pages.slice(0,2).map(p=>evaluate(p.sessionId,'window.muzzle')));
  const hits=evidence.observed.map(o=>o.events.find(e=>e.type==='terrainHit'&&e.playerId===evidence.initial[0].playerId));
  assert.deepEqual(hits[0],hits[1],'Authority terrainHit payload identical both clients');
  assert.equal(hits[0].targetId,'terrain');assert.equal(hits[0].observedBullets,0);assert(Math.abs(hits[0].y-evidence.beforeFire.y-20)<.05);
  const fire=evidence.observed[0].events.find(e=>e.type==='fire'&&e.playerId===evidence.initial[0].playerId);
  assert(fire.shotDisplay&&fire.shotDisplay.itemId===2001);assert.equal(fire.shotDisplay.y,25);
  const actor={...evidence.beforeFire,x:fire.x,y:fire.y,z:fire.z};const a=createRoleFreeAim(actor,{x:Math.sin(actor.yaw+actor.aim),y:0,z:Math.cos(actor.yaw+actor.aim)},0),dx=a.x-Math.fround(actor.x),dz=a.z-Math.fround(actor.z),length=Math.hypot(dx,dz),start={x:actor.x,y:actor.y+20,z:actor.z},end={x:actor.x+30*dx/length,y:actor.y+20,z:actor.z+30*dz/length};const surface=field.firstSurfaceHit(start,end,1);assert(surface);evidence.authoritySurface={start,end,surface,expected:{x:start.x+(end.x-start.x)*surface.fraction,y:start.y,z:start.z+(end.z-start.z)*surface.fraction}};
  for(const axis of ['x','y','z'])assert(Math.abs(hits[0][axis]-evidence.authoritySurface.expected[axis])<.1,'Network-rounded authority surface '+axis);
  for(const [i,o]of evidence.observed.entries()){
    assert(o.events.some(e=>e.type==='fire'&&JSON.stringify(e.shotDisplay)===JSON.stringify(fire.shotDisplay)));
    const fx=o.effects.find(e=>e.event?.shotDisplay&&JSON.stringify(e.event.shotDisplay)===JSON.stringify(fire.shotDisplay)&&e.rendered.length>0&&e.expired);assert(fx,'Same source immediate endpoint actual source geometry nodes and expiry');assert.deepEqual(fx.origin,[fire.shotDisplay.x,fire.shotDisplay.y,fire.shotDisplay.z].map(Math.fround));assert(fx.world);assert(o.sounds.some(v=>v.event?.shotDisplay&&JSON.stringify(v.event.shotDisplay)===JSON.stringify(fire.shotDisplay)&&v.reference==='SE30'&&v.played&&v.ended&&!v.loop));
    assert(o.requests.every(r=>r.event?.type==='fire'),'No terrainHit effect invented');
    const capture=o.captures[fire.playerId];assert(capture,'Same source shooter actual framebuffer capture');await writeFile(output+'-'+(i+1)+'.png',Buffer.from(capture.canvas.split(',')[1],'base64'));for(const row of Object.values(o.captures))delete row.canvas;
  }
  evidence.afterFire=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));assert(hits.every(e=>e.observedBullets===0),'Blocked firing owner creates no bullet');
  for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({instances:window.muzzleBattle.effects.instances.length,effectMeshes:window.muzzleScene.meshes.filter(m=>m.metadata?.originalEffect).length,effectVoices:window.muzzleBattle.effects.sound.voices.size,battleVoices:window.muzzleBattle.sound.voices.size,players:window.muzzleBattle.players.size})`)));
  for(const row of evidence.cleanup)assert.deepEqual(row,{instances:0,effectMeshes:0,effectVoices:0,battleVoices:0,players:0});
  evidence.status='PASS';console.log('PASS: normal map2 route5 muzzle terrainHit true surface/no bullet, dual original007 actual source geometry/SE30 play-end/expiry and leave');
}catch(error){evidence.status='FAIL';evidence.error=String(error);console.error('Evidence',output+'.json');if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.muzzle`).catch(e=>({error:String(e)}))));throw error;}
finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
