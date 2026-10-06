import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
const WebSocket=createRequire(import.meta.url)('ws');
const directory=await mkdtemp(join(tmpdir(),'cdtank-death-09-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3271,vite:5301,cdp:9501},mapId:7,tankId:105,
  scope:'Current React two webpages; original105 role sources; normal map0007 CPU/Ready/Space; authoritative death09/ELK Effect6 GA12/natural expiry/respawn01 and leave/reentry. Reduced canvas resolution; ww154 absent.'};
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
  const env={...process.env,PORT:'3271',ACCOUNT_DB_PATH:database};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5301,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3271',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9501',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9501/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9501');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5301',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu')&&!document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);const engine=EngineStore.LastCreatedEngine,scene=EngineStore.LastCreatedScene;
      engine.setHardwareScalingLevel(4);engine.resize();window.muzzleScene=scene;window.muzzleCamera=scene.activeCamera;
      window.muzzle={effects:[],sounds:[],events:[],messages:[],lives:[],frames:0,frameTimes:[],canvas:{width:engine.getRenderWidth(),height:engine.getRenderHeight()}};
      const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');const add=EffectRuntime.prototype.addInstance;
      EffectRuntime.prototype.addInstance=function(view,tree){const handle=add.call(this,view,tree);
        if(tree.root.definition.index===2504){window.muzzleRuntime=this;const instance=this.instances.find(i=>i.handle===handle);
          instance.deathRow={handle,owner:view.root.name,nodes:instance.draws.map(d=>d.node.definition.index),liveParent:tree.parentMatrix===view.primaryTag('tag_efcenter'),matrix:Array.from(tree.parentMatrix),matrixChanged:false,rendered:[],vertices:{},textures:{},expired:false};
          window.muzzle.effects.push(instance.deathRow);}
        return handle;};
      const message=EffectRuntime.prototype.message;
      EffectRuntime.prototype.message=function(view,value){if(value.action==='09')window.muzzle.messages.push({owner:view.root.name,...value});return message.call(this,view,value);};
      const draw=EffectRuntime.prototype.draw;
      EffectRuntime.prototype.draw=function(instance,d){draw.call(this,instance,d);const row=instance.deathRow;if(!row)return;
        row.liveParent&&=instance.tree.parentMatrix===instance.owner.primaryTag('tag_efcenter');
        row.matrixChanged||=Array.from(instance.tree.parentMatrix).some((v,i)=>Math.abs(v-row.matrix[i])>0.00001);
        const mesh=d.sprite?.mesh??d.particle?.sprite.mesh??d.overlay?.mesh;
        if(mesh&&!mesh.deathObserved){mesh.deathObserved=true;mesh.onBeforeRenderObservable.add(()=>{
          if(!row.rendered.includes(d.node.definition.index))row.rendered.push(d.node.definition.index);
          row.lastDrawFrame=window.muzzle.frames+1;row.vertices[d.node.definition.index]=mesh.getTotalVertices();row.textures[d.node.definition.index]=mesh.material.getActiveTextures()[0]?.url;
        });}};
      const remove=EffectRuntime.prototype.remove;
      EffectRuntime.prototype.remove=function(index){const instance=this.instances[index];if(instance.deathRow)instance.deathRow.expired=instance.tree.quiescent;return remove.call(this,index);};
      const {EffectSound}=await import('/src/audio/effect-sound.ts');const play=EffectSound.prototype.play;
      EffectSound.prototype.play=function(reference,parameter){const handle=play.call(this,reference,parameter);
        if(['GA12','ww154'].includes(reference)){const voice=this.voices.get(handle),row={handle,reference,src:voice?.audio?.src??null,missing:!voice?.audio,loop:voice?.audio?.loop??null,played:false,ended:false};
          voice?.audio?.addEventListener('playing',()=>{row.played=true;});voice?.audio?.addEventListener('ended',()=>{row.ended=true;});window.muzzle.sounds.push(row);}
        return handle;};
      const {BattleSound}=await import('/src/audio/battle-sound.ts');const event=BattleSound.prototype.event;
      BattleSound.prototype.event=function(value,...args){window.muzzleSound=this;if(['destroy','respawn'].includes(value.type))window.muzzle.events.push(value);return event.call(this,value,...args);};
      const {Battle}=await import('/src/match/battle.ts');const reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.muzzleBattle=this;return reconcile.apply(this,args);};
      const seen=new Map();
      scene.onAfterRenderObservable.add(()=>{window.muzzle.frames++;if(window.muzzle.frameTimes.length<4000)window.muzzle.frameTimes.push(engine.getDeltaTime());
        const world=document.querySelector('#battle-status')?.dataset.world;if(!world||!window.muzzleBattle)return;
        const state=JSON.parse(world);for(const player of state.players.filter(p=>p.tankId===105)){
          const view=window.muzzleBattle.players.get(player.id);if(!view)continue;
          const clocks=view.root.metadata.actionClocks??[],key=player.alive+':'+view.activeAction+':'+clocks.map(c=>c.overMessage).join(',');
          if(seen.get(player.id)!==key){seen.set(player.id,key);window.muzzle.lives.push({id:player.id,alive:player.alive,action:view.activeAction,hp:player.hp,maxHp:player.maxHp,deaths:player.deaths,position:{x:player.x,y:player.y,z:player.z},clocks,
            visible:view.current.root.isEnabled(),components:view.current.components.map(c=>({part:c.part,asset:c.action.asset,vertices:c.assets.meshes.reduce((n,m)=>n+m.getTotalVertices(),0)})),frame:window.muzzle.frames});}
        }
        if(!window.muzzle.deathFrame&&window.muzzleRuntime){
          const id=state.players.find(p=>!p.isCpu)?.id,player=state.players.find(p=>p.id===id);
          const row=window.muzzle.effects.find(e=>e.owner==='player-'+id&&e.lastDrawFrame===window.muzzle.frames&&e.rendered.includes(2508)&&e.rendered.includes(2509));
          const view=id&&window.muzzleBattle.players.get(id);
          if(player&&!player.alive&&view?.activeAction==='09'&&row){
            window.muzzle.deathFrame={owner:id,frame:window.muzzle.frames,effectHandle:row.handle,rendered:[...row.rendered],clocks:view.root.metadata.actionClocks,
              world:state,canvas:engine.getRenderingCanvas().toDataURL('image/png')};
          }
        }
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
  await nativeSelect(host,'#tank',105);await nativeSelect(host,'#room-mode',4);await waitUntil(host,`Array.from(document.querySelector('#room-map').options).some(o=>o.value==='7')`);await nativeSelect(host,'#room-map',7);await nativeClick(host,'#create-room');
  await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===2`);
  await nativeClick(guest,'#open-home');await waitUntil(guest,`document.querySelector('[data-home-close]')`);await nativeClick(guest,'[data-home-close]');await nativeSelect(guest,'#tank',105);
  await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})`);await nativeSelect(guest,'#room',roomId);await nativeClick(guest,'#join');
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===3})()`);
  for(const page of pages){
    const s=page.sessionId;await nativeClick(s,'#world');const point=await evaluate(s,`(()=>{const r=document.querySelector('#world').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    for(let i=0;i<3;i++){if(await evaluate(s,`window.muzzleCamera.radius>=4000`))break;await command('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaX:0,deltaY:1500},s);await new Promise(r=>setTimeout(r,100));}
  }
  for(const s of [guest,host])await nativeClick(s,'[data-ready]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  const victimId=evidence.initial[0].playerId;
  assert(evidence.initial.every(s=>s.players.filter(p=>!p.isCpu).every(p=>p.tankId===105)),'Both human accounts use original105');
  console.log('Normal0007 original105 two accounts+CPU PLAYING; waiting real server death/revive');
  for(const page of pages){await nativeClick(page.sessionId,'#world');await command('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32},page.sessionId);}
  const gate=Date.now()+90000;let done=false,released=false;
  while(Date.now()<gate){
    const observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.muzzle`)));
    if(!released&&observed.some(o=>o.lives.some(r=>r.id===victimId&&!r.alive))){for(const page of pages)await command('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32},page.sessionId);released=true;}
    done=observed.every(o=>o.lives.some(r=>r.id===victimId&&!r.alive&&r.action==='09'&&r.clocks.every(c=>c.overMessage===0))&&o.lives.some(r=>r.id===victimId&&r.alive&&r.action==='01'&&r.deaths>0&&r.hp===r.maxHp)&&o.effects.some(e=>e.owner==='player-'+victimId&&e.expired&&e.rendered.includes(2508)&&e.rendered.includes(2509))&&o.sounds.some(s=>s.reference==='GA12'&&s.played&&s.ended)&&o.deathFrame);
    if(done)break;await new Promise(r=>setTimeout(r,250));
  }
  assert(done,'Both pages must observe original09 finish, actual Effect6 sprite/strip expiry, GA12 completion and authoritative full-health respawn01');
  for(const page of pages)await command('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32},page.sessionId);
  evidence.victimId=victimId;evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.muzzle`)));
  for(const [index,value]of evidence.observed.entries()){
    await writeFile(`recovery/output/browser-combat-death-09-natural-${index+1}.png`,Buffer.from(value.deathFrame.canvas.split(',')[1],'base64'));
    delete value.deathFrame.canvas;
  }
  const common=evidence.observed[0].events.filter(e=>e.type==='destroy'&&e.targetId===victimId&&evidence.observed[1].events.some(f=>JSON.stringify(e)===JSON.stringify(f)));assert(common.length);evidence.sameDestroy=common;
  for(const value of evidence.observed){
    assert(value.effects.some(e=>e.owner==='player-'+victimId&&e.nodes.length===11&&e.rendered.length===11&&e.liveParent&&e.matrixChanged&&e.expired));
    assert(value.sounds.filter(s=>s.reference==='ww154').every(s=>s.missing&&!s.played));
    assert(value.messages.some(m=>m.action==='09'&&m.identifier===1416378268));
  }
  for(const [i,page]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId);await writeFile(`recovery/output/browser-combat-death-09-${i+1}.png`,Buffer.from(shot.data,'base64'));}
  const cleanup=()=>Promise.all(pages.map(p=>evaluate(p.sessionId,`({instances:window.muzzleRuntime.instances.length,effectMeshes:window.muzzleScene.meshes.filter(m=>m.metadata?.originalEffect).length,effectVoices:window.muzzleRuntime.sound.voices.size,battleVoices:window.muzzleSound.voices.size,players:window.muzzleBattle.players.size})`)));
  for(const page of pages)await nativeClick(page.sessionId,'#leave');
  for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await cleanup();for(const row of evidence.cleanup)assert.deepEqual(row,{instances:0,effectMeshes:0,effectVoices:0,battleVoices:0,players:0});
  await nativeClick(host,'#create-room');await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const room2=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);await nativeClick(host,'[data-add-cpu]');
  await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(room2)})`);await nativeSelect(guest,'#room',room2);await nativeClick(guest,'#join');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).renderedPlayers===3&&!document.querySelector('[data-ready]').disabled`);
  for(const session of [guest,host])await nativeClick(session,'[data-ready]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.reentry=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({world:JSON.parse(document.querySelector('#battle-status').dataset.world),players:window.muzzleBattle.players.actions})`)));
  for(const result of evidence.reentry)assert(result.world.players.filter(p=>!p.isCpu).every(p=>p.tankId===105&&p.alive&&p.deaths===0));
  for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.reentryCleanup=await cleanup();for(const row of evidence.reentryCleanup)assert.deepEqual(row,{instances:0,effectMeshes:0,effectVoices:0,battleVoices:0,players:0});
  evidence.status='PASS';console.log('PASS: current React dual-page realCPU destroy original10509/Effect6 actual draws/live tag/GA12 natural completion and respawn01/leave/reentry cleanup');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.muzzle`).catch(e=>({error:String(e)}))));throw error;}
finally{
  await writeFile('recovery/output/browser-combat-death-09.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
