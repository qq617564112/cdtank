import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
const WebSocket=createRequire(import.meta.url)('ws');
const twoAccounts=process.argv.includes('--two-accounts');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-combat-shot-player-result-2007-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-shot-player-result-2007-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3365,vite:5395,cdp:9595},mapId:7,ammo:2007,
  scope:'Formal React map7/mode4 normal2007 hit -> authority burn snapshot -> original014/tag0 retained SE03 selector-1 -> authoritative expiry or death/Leave. Pre-room inventory15 instance77 tank1/pet1 fixture; 9sec burn/damage/flight rebuilt. No active state injection.'};
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
  const env={...process.env,PORT:'3365',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'120'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5395,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3365',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9595',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9595/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9595');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5395',browserContextId});
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
    store.replaceInventory(account.accountId,[{instanceId:77,itemTableId:2007,ownedQuantity:15,battleQuantity:0,state:0,field8:0,float24Bits:0,float28Bits:0,float2cBits:0}]);store.assign(account.accountId,77,1);

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
  await evaluate(host,`(async()=>{
    const {RoomConnection}=await import('/src/network/rooms.ts');window.burnCpu=[];
    const cpu=RoomConnection.prototype.cpu;RoomConnection.prototype.cpu=async function(request){
      const row={request,sentAt:performance.now()};window.burnCpu.push(row);
      try{const value=await cpu.call(this,request);row.returnedAt=performance.now();row.success=true;return value;}
      catch(error){row.returnedAt=performance.now();row.error=String(error);throw error;}
    };
  })()`);
  evidence.cpuClicks=[];
  for(let count=0;count<(twoAccounts?0:1);count++){
    await waitUntil(host,"!document.querySelector('[data-room-create-dialog][open]')&&!document.querySelector('[data-source-notice][open]')&&document.querySelector('[data-formal-waiting-page] [data-add-cpu]')&&!document.querySelector('[data-formal-waiting-page] [data-add-cpu]').disabled",12000);
    const point=await evaluate(host,`(async()=>{const e=document.querySelector('[data-formal-waiting-page] [data-add-cpu]');e.scrollIntoView({block:'nearest'});await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,top=document.elementFromPoint(x,y);return {x,y,matched:top===e||e.contains(top),top:top?.outerHTML.slice(0,350),disabled:e.disabled}})()`);
    evidence.cpuClicks.push(point);assert(point.matched&&!point.disabled,'ordinary CPU pointer matches enabled control');
    await command('Page.bringToFront',{},host);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:point.x,y:point.y},host);
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:point.x,y:point.y},host);
    await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===${count+3}`,12000);
  }
  evidence.cpuRequests=await evaluate(host,'window.burnCpu');
  evidence.playerRoute=twoAccounts?'two normal accounts; host sole shooter; no CPU':'two normal accounts and CPU';
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).renderedPlayers===${twoAccounts?2:3}`);
  for(const page of pages){
    await evaluate(page.sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world')),scene=engine.scenes[0];
      engine.setHardwareScalingLevel(2);engine.resize();window.muzzleScene=scene;window.muzzleCamera=scene.activeCamera;
      window.muzzle={captures:{},effects:[],sounds:[],events:[],results:[],lives:[],snapshots:[],frames:0,frameTimes:[],canvas:{width:engine.getRenderWidth(),height:engine.getRenderHeight()}};
      const {AmmoBurnPresentation}=await import('/src/assets/tanks/ammo-burn-presentation.ts');
      const reconcileBurn=AmmoBurnPresentation.prototype.reconcile;
      AmmoBurnPresentation.prototype.reconcile=function(players,context,playing){
        window.muzzle.currentBurns=players.filter(p=>p.ammoBurn).map(p=>({id:p.id,alive:p.alive,burn:{...p.ammoBurn},owner:this.role(p.id)?.root.name}));
        for(const row of window.muzzle.currentBurns){const key=context+':'+row.id+':'+row.burn.startedAt;
          if(!window.muzzle.results.some(r=>r.key===key))window.muzzle.results.push({...row,key,frame:window.muzzle.frames});}
        try{return reconcileBurn.call(this,players,context,playing);}finally{window.muzzle.currentBurn=null;}
      };
      const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');
      const attached=EffectRuntime.prototype.spawnAttachedEffect;
      EffectRuntime.prototype.spawnAttachedEffect=function(view,id,tag,oneShot,...args){
        if(id===14)window.muzzle.currentBurn=window.muzzle.currentBurns?.find(r=>r.owner===view.root.name);
        return attached.call(this,view,id,tag,oneShot,...args);
      };
      const add=EffectRuntime.prototype.addInstance;
      EffectRuntime.prototype.addInstance=function(view,tree,...args){const handle=add.call(this,view,tree,...args);window.muzzleRuntime=this;
        if(tree.root.definition.index===2449){const instance=this.instances.find(i=>i.handle===handle);
          const row={handle,burn:window.muzzle.currentBurn,root:2449,owner:view.root.name,nodes:instance.draws.map(d=>d.node.definition.index),liveParent:tree.parentMatrix===view.primaryTag('tag_efcenter'),rendered:[],vertices:{},textures:{},stopped:false,released:false};window.muzzle.effects.push(row);instance.resultRow=row;}return handle;};
      const draw=EffectRuntime.prototype.draw;
      EffectRuntime.prototype.draw=function(instance,d){draw.call(this,instance,d);const row=instance.resultRow;if(!row)return;
        row.liveParent&&=instance.tree.parentMatrix===instance.owner.primaryTag('tag_efcenter');
        const mesh=d.sprite?.mesh??d.particle?.sprite.mesh??d.overlay?.mesh;
        if(mesh?.onBeforeRenderObservable&&!mesh.resultObserved){mesh.resultObserved=true;mesh.onBeforeRenderObservable.add(()=>{
          if(!row.rendered.includes(d.node.definition.index))row.rendered.push(d.node.definition.index);
          row.vertices[d.node.definition.index]=mesh.getTotalVertices();row.textures[d.node.definition.index]=mesh.material.getActiveTextures()[0]?.url;
        });}};
      const stopEffect=EffectRuntime.prototype.stopEffect;
      EffectRuntime.prototype.stopEffect=function(handle){const row=this.instances.find(i=>i.handle===handle)?.resultRow;
        if(row){row.stopped=true;row.stopFrame=window.muzzle.frames;row.stopSnapshot=window.muzzle.currentSnapshot??JSON.parse(document.querySelector('#battle-status').dataset.world||'null');}
        return stopEffect.call(this,handle);};
      const remove=EffectRuntime.prototype.remove;
      EffectRuntime.prototype.remove=function(index){const row=this.instances[index].resultRow;if(row){row.released=true;row.releaseFrame=window.muzzle.frames;}return remove.call(this,index);};
      const {EffectSkillSound}=await import('/src/audio/effect-skill-sound.ts');const play=EffectSkillSound.prototype.play;
      EffectSkillSound.prototype.play=function(reference,selector,position){const handle=play.call(this,reference,selector,position);
        if(reference==='SE03'&&window.muzzle.currentBurn){window.muzzleSkillSound=this;const voice=this.voices.get(handle);
          const row={burn:window.muzzle.currentBurn,handle,reference,selector,position:[...position],loop:voice?.audio.loop,src:voice?.audio.src,context:this.context?.state,played:false,stopped:false,outputPeak:0,postGainPeak:0};window.muzzle.sounds.push(row);
          if(voice){voice.audio.addEventListener('playing',()=>{row.played=true;});const analyser=this.context.createAnalyser(),post=this.context.createAnalyser();analyser.fftSize=post.fftSize=256;voice.source.connect(analyser);voice.gain.connect(post);
            row.timer=setInterval(()=>{for(const [node,key]of [[analyser,'outputPeak'],[post,'postGainPeak']]){const samples=new Float32Array(256);node.getFloatTimeDomainData(samples);row[key]=Math.max(row[key],...samples.map(Math.abs));}},10);
            row.disconnect=()=>{clearInterval(row.timer);analyser.disconnect();post.disconnect();};}}
        return handle;};
      const stopSound=EffectSkillSound.prototype.stop;
      EffectSkillSound.prototype.stop=function(handle){const row=window.muzzle.sounds.find(r=>r.handle===handle);if(row){row.stopped=true;row.disconnect?.();delete row.disconnect;delete row.timer;}return stopSound.call(this,handle);};
      const {BattleSound}=await import('/src/audio/battle-sound.ts');const event=BattleSound.prototype.event;
      BattleSound.prototype.event=function(value,...args){window.muzzleSound=this;window.muzzle.currentEvent=value;if(['fire','hit','destroy','respawn'].includes(value.type))window.muzzle.events.push(value);return event.call(this,value,...args);};
      const {Battle}=await import('/src/match/battle.ts');const reconcile=Battle.prototype.reconcile;
      const render=Battle.prototype.render;Battle.prototype.render=function(...args){window.muzzleBattle=this;window.muzzleRuntime=this.effects;return render.apply(this,args);};
      Battle.prototype.reconcile=function(...args){window.muzzleBattle=this;const s=args[0];
        if(s){const row={tick:s.tick,serverTime:s.serverTime,phase:s.phase,players:s.players.map(p=>({id:p.id,alive:p.alive,hp:p.hp,ammoBurn:p.ammoBurn}))};window.muzzle.currentSnapshot=row;window.muzzle.snapshots.push(row);}
        return reconcile.apply(this,args);};
      const seen=new Map();scene.onAfterRenderObservable.add(()=>{const raw=document.querySelector('#battle-status')?.dataset.world;if(!raw||!window.muzzleBattle)return;const state=JSON.parse(raw);
        for(const player of state.players){const view=window.muzzleBattle.players.get(player.id);if(!view)continue;const key=player.alive+':'+view.activeAction;
          if(seen.get(player.id)!==key){seen.set(player.id,key);window.muzzle.lives.push({id:player.id,alive:player.alive,action:view.activeAction,hp:player.hp,maxHp:player.maxHp,deaths:player.deaths,frame:window.muzzle.frames});}}});
      scene.onAfterRenderObservable.add(()=>{for(const row of window.muzzle.effects){if(row.rendered.length===3&&!window.muzzle.captures[row.handle])window.muzzle.captures[row.handle]={burn:row.burn,canvas:engine.getRenderingCanvas().toDataURL('image/png')};}window.muzzle.frames++;if(window.muzzle.frameTimes.length<3000)window.muzzle.frameTimes.push(engine.getDeltaTime());});
    })()`);
  }
  for(const s of [guest,host]){await waitUntil(s,`window.muzzleBattle?.players.resourcesReady&&!window.muzzleBattle.players.loadingError&&document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await nativeClick(s,'[data-waiting-ready]');}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  console.log('Normal map0007 PLAYING: '+evidence.playerRoute);
  const key=async(s,key,code,windowsVirtualKeyCode)=>{await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode},s);};
  const world=s=>evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  const ids=await Promise.all(pages.map(async p=>(await world(p.sessionId)).playerId));
  evidence.initial=await Promise.all(pages.map(p=>world(p.sessionId)));
  for(const page of pages){await nativeClick(page.sessionId,'#world');await key(page.sessionId,'2','Digit2',50);await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.find(p=>p.id===JSON.parse(document.querySelector('#battle-status').dataset.world).playerId).ammoItemId===2007`);}
  evidence.inputs=[];
  const held=new Map(pages.map(p=>[p.sessionId,new Set()]));
  const setKeys=async(s,keys)=>{const old=held.get(s);for(const code of new Set([...old,...keys]))if(old.has(code)!==keys.has(code))await command('Input.dispatchKeyEvent',{type:keys.has(code)?'keyDown':'keyUp',key:code==='Space'?' ':code,code,windowsVirtualKeyCode:({Space:32,ArrowLeft:37,ArrowRight:39})[code]},s);held.set(s,keys);};
  const gate=Date.now()+45000;let firstBurnAt=0;
  while(Date.now()<gate){
    const snapshots=await Promise.all(pages.map(p=>world(p.sessionId)));
    if(!firstBurnAt&&snapshots.some(w=>w.players.some(p=>p.ammoBurn)))firstBurnAt=Date.now();
    for(const [index,page]of pages.entries()){
      const w=snapshots[index],me=w.players.find(p=>p.id===w.playerId),keys=new Set();
      if(!firstBurnAt&&(!twoAccounts||index===0)&&w.phase==='PLAYING'&&me.alive&&me.ammoItemId===2007){
        const target=w.players.filter(p=>p.id!==me.id&&p.alive).sort((a,b)=>Math.hypot(a.x-me.x,a.z-me.z)-Math.hypot(b.x-me.x,b.z-me.z))[0];
        if(target){const angle=Math.atan2(target.x-me.x,target.z-me.z),error=Math.atan2(Math.sin(angle-me.yaw-me.aim),Math.cos(angle-me.yaw-me.aim));if(Math.abs(error)>.025)keys.add(error>0?'ArrowLeft':'ArrowRight');if(Math.abs(error)<.04)keys.add('Space');evidence.inputs.push({tick:w.tick,id:me.id,target:target.id,x:me.x,z:me.z,error,keys:[...keys]});}
      }
      await setKeys(page.sessionId,keys);
    }
    if(firstBurnAt&&Date.now()-firstBurnAt>13000)break;
    if(snapshots[0].phase==='FINISHED')break;
    await new Promise(r=>setTimeout(r,100));
  }
  for(const page of pages)await setKeys(page.sessionId,new Set());
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.muzzle')));
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  evidence.sameHit=evidence.observed[0].events.filter(e=>e.type==='hit'&&e.shotPlayerResult?.itemId===2007&&evidence.observed[1].events.some(f=>same(e,f)));
  evidence.finalSnapshot=await Promise.all(pages.map(p=>world(p.sessionId)));
  for(const [i,v]of evidence.observed.entries()){
    for(const [handle,capture]of Object.entries(v.captures)){await writeFile(output+'-natural-'+(i+1)+'-'+handle+'.png',Buffer.from(capture.canvas.split(',')[1],'base64'));delete capture.canvas;}
    const shot=await command('Page.captureScreenshot',{format:'png'},pages[i].sessionId);await writeFile(output+'-actual-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));
  }
  for(const page of pages)await nativeClick(page.sessionId,'[data-leave-room]');
  for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({instances:window.muzzleRuntime?.instances.length,meshes:window.muzzleScene.meshes.filter(m=>m.metadata?.originalEffect).length,voices:window.muzzleSound?.voices.size,skillVoices:window.muzzleSkillSound?.voices.size,state:document.querySelector('[data-source-audio="battle-sound"]').dataset.state})`)));
  assert(evidence.sameHit.length,'Same ordinary2007 hit on both pages');
  for(const v of evidence.observed){
    assert(v.effects.some(r=>r.rendered.length===3&&r.liveParent&&r.stopped&&r.released),'actual014 three original nodes/live parent/authority stop/release');
    assert(v.sounds.some(r=>r.selector===-1&&r.loop&&r.played&&r.stopped&&r.outputPeak>0&&r.postGainPeak>0),'real retained SE03 postgain output and stop');
    for(const r of v.results){assert.equal(v.effects.filter(e=>e.burn?.id===r.id&&e.burn?.burn.startedAt===r.burn.startedAt).length,1,'epoch starts once');}
  }
  for(const row of evidence.cleanup)assert.deepEqual(row,{instances:0,meshes:0,voices:0,skillVoices:0,state:'stopped'});
  evidence.status='PASS';console.log('PASS: '+output+'.json');
}catch(error){if(ws)for(const[i,page]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.muzzle`).catch(e=>({error:String(e)}))));throw error;}
finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});await writeFile('recovery/output/combat-shot-player-result-2007-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
