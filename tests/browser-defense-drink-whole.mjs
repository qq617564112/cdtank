import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile, copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
const WebSocket=createRequire(import.meta.url)('ws');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-defense-drink-whole-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-defense-whole-'));
const database=join(directory,'accounts.sqlite');
const checkpoint='recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
await copyFile(checkpoint+'-checkpoint.sqlite',database);
const identities=JSON.parse(await readFile(checkpoint+'-identity.private.json','utf8')).accounts;

let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3513,vite:5543,cdp:9743},mapId:7,item:5,
  scope:'Genuine purchased tank3/pet2 checkpoint with disclosed funds fixture; normal BUY5/Home item-page slot4/mode4map7/Ready/nativeDigit5. Original108 seven drawable nodes, whole low-resolution canvas, SE40 naturalend, missing ww051 request and normal Leave. No buff/damage reconstruction acceptance or second-slot010/SE02 claim; no live pose/HP/time/event/camera injection.',visibleAccepted:false};
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
  const deadline = Date.now() + 10000;
  let point;
  while (Date.now() < deadline) {
    point = await evaluate(session, `(async()=>{
      const candidates=[...document.querySelectorAll(${JSON.stringify(selector)})];
      for(const element of candidates){
        if(element.disabled||!element.getClientRects().length)continue;
        const rect=element.getBoundingClientRect(),x=rect.x+rect.width/2,y=rect.y+rect.height/2;
        const hit=document.elementFromPoint(x,y);
        if(hit===element||element.contains(hit)){
          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          const current=document.elementFromPoint(x,y);
          if(current===element||element.contains(current))return{x,y};
        }
      }
      return null;
    })()`);
    if(point)break;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert(point, 'No enabled unobstructed click point: '+selector);
  evidence.clicks??=[];evidence.clicks.push({selector,point});
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
  const env={...process.env,PORT:'3513',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'120'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5543,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3513',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9743',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9743/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9743');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5543',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  for(const[index,page]of pages.entries()){
    await evaluate(page.sessionId,`localStorage.setItem('cdtank-account-token',${JSON.stringify(identities[index].token)})`);
    await command('Page.reload',{},page.sessionId);
    await waitUntil(page.sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')===${JSON.stringify(identities[index].token)}`);
  }
  store=new AccountStore(database);
  for(const[index,page]of pages.entries())assert.equal(store.open(identities[index].token).accountId,identities[index].accountId);
  store.close();store=undefined;
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  evidence.fixture={source:checkpoint+'-checkpoint.sqlite',accountBinding:'strict existing accountId/token',roles:'Actual BUYtank3/pet2',inventory:'Copied genuine role-purchase checkpoint; item5 obtained through this run normal Shop BUY',newProfileOrInventoryImport:false};
  await nativeClick(host,'[data-room-card-shop]');
  await waitUntil(host,`document.querySelector('#account-shop')?.open&&document.querySelector('#account-shop').getAttribute('aria-busy')==='false'`);
  evidence.balanceBefore=await evaluate(host,`document.querySelector('[data-shop-balance]').textContent`);
  await nativeClick(host,'[data-shop-category="Item"]');
  await waitUntil(host,`document.querySelector('[data-shop-product-id="5"]')`,5000);
  evidence.shopScroll=[];
  for(let step=0;step<12;step++){
    const state=await evaluate(host,`(()=>{
      const list=document.querySelector('[data-shop-item]'),row=document.querySelector('[data-shop-product-id="5"]');
      const r=row.getBoundingClientRect(),l=list.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
      const hit=document.elementFromPoint(x,y);
      return {scroll:list.scrollTop,height:list.clientHeight,total:list.scrollHeight,rowY:r.y,
        visible:y>l.top&&y<l.bottom&&(hit===row||row.contains(hit)),
        wheel:{x:l.x+l.width/2,y:l.y+l.height/2},delta:y>l.bottom?180:-180};
    })()`);
    evidence.shopScroll.push(state);
    if(state.visible)break;
    await command('Input.dispatchMouseEvent',{type:'mouseWheel',...state.wheel,deltaX:0,deltaY:state.delta},host);
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert(evidence.shopScroll.at(-1).visible,'5 must be visible after ordinary Shop wheel input');
  await nativeClick(host,'[data-shop-product-id="5"]');
  await waitUntil(host,`document.querySelector('[data-shop-item]').dataset.selectedItem==='5'`);
  await nativeSelect(host,'[data-shop-currency]','MONEY');
  await nativeClick(host,'[data-shop-quantity]');
  for(const type of ['keyDown','keyUp'])await command('Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2},host);
  await command('Input.insertText',{text:'1'},host);
  await nativeClick(host,'[data-shop-buy]');
  await waitUntil(host,`document.querySelector('[data-shop-status]').value.includes('已购买')&&document.querySelector('#account-shop').dataset.purchasedInstance`);
  const itemInstance=Number(await evaluate(host,`document.querySelector('#account-shop').dataset.purchasedInstance`));
  evidence.purchase=await evaluate(host,`({status:document.querySelector('[data-shop-status]').value,balance:document.querySelector('[data-shop-balance]').textContent,instance:document.querySelector('#account-shop').dataset.purchasedInstance})`);
  assert(itemInstance>0);
  await nativeClick(host,'[data-shop-close]');
  await nativeClick(host,'[data-room-card-home]');
  await waitUntil(host,`document.querySelector('[data-source-control="rdoItem"]')&&!document.querySelector('[data-source-control="rdoItem"]').disabled`);
  evidence.homeBeforeItemTab=await evaluate(host,`({item:document.querySelector('[data-source-control="rdoItem"]').getAttribute('aria-pressed'),weapon:document.querySelector('[data-source-control="rdoWeapon"]').getAttribute('aria-pressed'),instances:[...document.querySelectorAll('[data-inventory-instance]')].map(e=>({id:e.dataset.inventoryInstance,text:e.textContent})),slots:[...document.querySelectorAll('[data-kitbag-slot]')].map(e=>({slot:e.dataset.kitbagSlot,id:e.dataset.instanceId}))})`);
  await nativeClick(host,'[data-source-control="rdoItem"]');
  evidence.homePage=await evaluate(host,`({item:document.querySelector('[data-source-control="rdoItem"]').getAttribute('aria-pressed'),weapon:document.querySelector('[data-source-control="rdoWeapon"]').getAttribute('aria-pressed')})`);
  await waitUntil(host,`document.querySelector('[data-inventory-instance="${itemInstance}"]')`);
  await nativeClick(host,`[data-inventory-instance="${itemInstance}"]`);
  await nativeClick(host,'[data-kitbag-slot="4"]');
  await waitUntil(host,`document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='${itemInstance}'`);
  evidence.inventoryBefore=await evaluate(host,`({item:document.querySelector('[data-inventory-instance="${itemInstance}"]').textContent,slot:document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId})`);
  await nativeClick(host,'[data-home-close]');
  await waitUntil(host,`!document.querySelector('#home-inventory[open]')`);
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
      engine.setHardwareScalingLevel(4);engine.resize();window.muzzleScene=scene;
      window.muzzle={events:[],effects:[],sounds:[],frames:0,frameTimes:[],resultFrames:[],canvas:{width:engine.getRenderWidth(),height:engine.getRenderHeight()}};
      const {BattleSkillEffects}=await import('/src/match/skills/battle-skill-effects.ts');const event=BattleSkillEffects.prototype.event;
      BattleSkillEffects.prototype.event=function(value,...args){window.muzzle.currentEvent=value;window.muzzle.events.push(value);try{return event.call(this,value,...args);}finally{window.muzzle.currentEvent=null;}};
      window.muzzle.treeSounds=[];
      const {EffectSound}=await import('/src/audio/effect-sound.ts');const treePlay=EffectSound.prototype.play;
      EffectSound.prototype.play=function(reference,parameter){const handle=treePlay.call(this,reference,parameter);window.muzzleTreeSound=this;
        if(reference.toLowerCase()==='ww051'){const voice=this.voices.get(handle);window.muzzle.treeSounds.push({reference,parameter,handle,ended:voice?.ended,media:!!voice?.audio});}return handle;};
      const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');const add=EffectRuntime.prototype.addInstance;
      EffectRuntime.prototype.addInstance=function(view,tree,...args){const handle=add.call(this,view,tree,...args);window.muzzleRuntime=this;
        if(tree.root.definition.index===2917&&window.muzzle.currentEvent?.type==='itemUsed'&&window.muzzle.currentEvent?.skillId===5){const instance=this.instances.find(i=>i.handle===handle);
          const row={handle,event:window.muzzle.currentEvent,root:2917,owner:view?.root.name??null,attached:!!tree.parentMatrix,nodes:instance.draws.map(d=>d.node.definition.index),rendered:[],firstDraw:{},currentNodes:[],vertices:{},textures:{},expired:false};window.muzzle.effects.push(row);instance.resultRow=row;}return handle;};
      const draw=EffectRuntime.prototype.draw;
      EffectRuntime.prototype.draw=function(instance,d){draw.call(this,instance,d);const row=instance.resultRow;if(!row)return;
        const mesh=d.sprite?.mesh??d.particle?.sprite.mesh??d.overlay?.mesh;
        if(mesh?.onBeforeRenderObservable&&!mesh.resultObserved){mesh.resultObserved=true;mesh.onBeforeRenderObservable.add(()=>{
          const node=d.node.definition.index,frame=window.muzzle.frames+1,vertices=mesh.getTotalVertices();
          if(vertices===0)return;
          if(row.lastDrawFrame!==frame)row.currentNodes=[];
          if(!row.currentNodes.includes(node))row.currentNodes.push(node);
          if(!row.rendered.includes(node))row.rendered.push(node);
          row.firstDraw[node]??={frame,elapsed:instance.tree.root.lifecycle.elapsed,vertices};
          row.lastDrawFrame=window.muzzle.frames+1;row.vertices[d.node.definition.index]=mesh.getTotalVertices();row.textures[d.node.definition.index]=mesh.material.getActiveTextures()[0]?.url;
        });}};
      const remove=EffectRuntime.prototype.remove;
      EffectRuntime.prototype.remove=function(index){const instance=this.instances[index];if(instance.resultRow)instance.resultRow.expired=instance.tree.quiescent;return remove.call(this,index);};
      const {EffectSkillSound}=await import('/src/audio/effect-skill-sound.ts');const play=EffectSkillSound.prototype.play;
      EffectSkillSound.prototype.play=function(reference,selector,position){const handle=play.call(this,reference,selector,position);window.muzzleSkillSound=this;
        if(reference==='SE40'&&window.muzzle.currentEvent?.skillId===5){const voice=this.voices.get(handle),row={event:window.muzzle.currentEvent,reference,selector,position:[...position],handle,played:false,ended:false,loop:voice?.audio.loop,src:voice?.audio.src,postGainPeak:0};window.muzzle.sounds.push(row);
          if(voice){const analyser=this.context.createAnalyser();analyser.fftSize=256;voice.gain.connect(analyser);
            const timer=setInterval(()=>{const samples=new Float32Array(256);analyser.getFloatTimeDomainData(samples);row.postGainPeak=Math.max(row.postGainPeak,...samples.map(Math.abs));},10);
            voice.audio.addEventListener('playing',()=>{row.played=true;});voice.audio.addEventListener('ended',()=>{row.ended=true;clearInterval(timer);analyser.disconnect();});}}return handle;};
      scene.onAfterRenderObservable.add(()=>{
        const row=window.muzzle.effects.find(effect=>effect.lastDrawFrame===window.muzzle.frames+1);
        if(row&&window.muzzle.resultFrames.length<3){const instance=window.muzzleRuntime.instances.find(value=>value.handle===row.handle),elapsed=instance?.tree.root.lifecycle.elapsed;
          if(instance&&(!window.muzzle.resultFrames.length||elapsed-window.muzzle.resultFrames.at(-1).elapsed>.30)){
            window.muzzle.resultFrames.push({handle:row.handle,rendered:[...row.rendered],nodesThisFrame:[...row.currentNodes],frame:window.muzzle.frames+1,elapsed,canvas:engine.getRenderingCanvas().toDataURL('image/png')});}}
        window.muzzle.frames++;if(window.muzzle.frameTimes.length<1000)window.muzzle.frameTimes.push(engine.getDeltaTime());
      });
    })()`);
  }

  for(const session of [guest,host]){await waitUntil(session,`document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await nativeClick(session,'[data-waiting-ready]');}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  const world=session=>evaluate(session,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  evidence.initial=await Promise.all(pages.map(page=>world(page.sessionId)));
  const key=async(session,type,code,key,windowsVirtualKeyCode)=>command('Input.dispatchKeyEvent',{type,code,key,windowsVirtualKeyCode},session);
  evidence.inputs=[];
  await nativeClick(guest,'#world');
  const aimDeadline=Date.now()+22000;let ready=false;
  while(Date.now()<aimDeadline){
    const state=await world(guest),actor=state.players.find(player=>player.id===state.playerId),target=state.players.find(player=>player.id!==state.playerId);
    const desired=Math.atan2(target.x-actor.x,target.z-actor.z);
    const error=Math.atan2(Math.sin(desired-actor.yaw),Math.cos(desired-actor.yaw));
    evidence.inputs.push({tick:state.tick,id:actor.id,x:actor.x,z:actor.z,yaw:actor.yaw,error});
    if(Math.abs(error)<.10){await new Promise(resolve=>setTimeout(resolve,250));
      const next=await world(guest),me=next.players.find(player=>player.id===next.playerId);
      const residual=Math.atan2(Math.sin(desired-me.yaw),Math.cos(desired-me.yaw));
      if(Math.abs(residual)<.10){ready=true;break;}continue;}
    const code=error>0?'KeyA':'KeyD',letter=error>0?'a':'d',virtual=error>0?65:68;
    await key(guest,'keyDown',code,letter,virtual);
    await new Promise(resolve=>setTimeout(resolve,Math.min(300,Math.max(25,Math.abs(error)/.65*600))));
    await key(guest,'keyUp',code,letter,virtual);await new Promise(resolve=>setTimeout(resolve,160));
  }
  assert(ready,'Normal observer body heading did not settle toward owner; no use');
  evidence.beforeUse=await Promise.all(pages.map(page=>world(page.sessionId)));
  await nativeClick(host,'#world');
  for(const type of ['keyDown','keyUp'])await key(host,type,'Digit5','5',53);
  await waitUntil(host,`window.muzzle.events.some(event=>event.type==='itemUsed'&&event.skillId===5)`,5000);
  for(const page of pages)await waitUntil(page.sessionId,`window.muzzle.effects.some(effect=>effect.expired)&&window.muzzle.sounds.some(sound=>sound.played&&sound.ended)`,12000);
  evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.muzzle')));
  evidence.drawScope=evidence.observed.map(row=>({
    expected:[2918,2919,2920,2922,2923,2924,3106],
    actual:[...new Set(row.effects.flatMap(effect=>effect.rendered))],
    missing:[2918,2919,2920,2922,2923,2924,3106].filter(node=>!row.effects.some(effect=>effect.rendered.includes(node))),
    wholeCaptures:row.resultFrames.length,
    sound:row.sounds.map(sound=>({reference:sound.reference,played:sound.played,ended:sound.ended,postGainPeak:sound.postGainPeak})),
    missingTreeRequests:row.treeSounds,
  }));
  evidence.finalWorld=await Promise.all(pages.map(page=>world(page.sessionId)));
  for(const[index,value]of evidence.observed.entries()){
    for(const[frame,capture]of (value.resultFrames??[]).entries()){
      const file=output+'-result-canvas-'+(index+1)+'-'+frame+'.png';
      await writeFile(file,Buffer.from(capture.canvas.split(',')[1],'base64'));delete capture.canvas;capture.file=file;
    }
    if(value.actualResultFrame?.canvas){delete value.actualResultFrame.canvas;
      value.actualResultFrame.file=value.resultFrames?.[0]?.file;}
    const shot=await command('Page.captureScreenshot',{format:'png'},pages[index].sessionId);await writeFile(output+'-actual-'+(index+1)+'.png',Buffer.from(shot.data,'base64'));
  }
  for(const page of pages){await nativeClick(page.sessionId,'[data-source-control="btnExit"][data-leave-room], [data-summary-leave]');await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);}
  evidence.cleanup=await Promise.all(pages.map(page=>evaluate(page.sessionId,`({world:document.querySelector('#battle-status').dataset.world??null,instances:window.muzzleRuntime.instances.length,meshes:window.muzzleScene.meshes.filter(m=>m.metadata?.originalEffect).length,voices:window.muzzleSkillSound?.voices.size??0,treeVoices:window.muzzleTreeSound?.voices.size??0})`)));
  for(const row of evidence.cleanup){assert(!row.world);assert.equal(row.instances,0);assert.equal(row.meshes,0);assert.equal(row.voices,0);assert.equal(row.treeVoices,0);}
  store=new AccountStore(database);
  evidence.inventoryAfterLeave=store.inventory(identities[0].accountId).records.find(record=>record.instanceId===itemInstance);
  store.close();store=undefined;
  evidence.status='PASS_ORIGINAL108_SCOPE_PENDING_PIXEL_REVIEW';console.log(evidence.status+': '+output+'.json');
}catch(error){
  evidence.status='INCOMPLETE';evidence.error=String(error);
  if(ws)for(const[index,page]of pages.entries()){
    evidence.failureScope??=[];evidence.failureScope.push(await evaluate(page.sessionId,`({state:document.querySelector('#battle-status')?.dataset.world,observer:window.muzzle,home:{item:document.querySelector('[data-source-control=\"rdoItem\"]')?.getAttribute('aria-pressed'),weapon:document.querySelector('[data-source-control=\"rdoWeapon\"]')?.getAttribute('aria-pressed'),instances:[...document.querySelectorAll('[data-inventory-instance]')].map(e=>({id:e.dataset.inventoryInstance,text:e.textContent})),slots:[...document.querySelectorAll('[data-kitbag-slot]')].map(e=>({slot:e.dataset.kitbagSlot,id:e.dataset.instanceId}))}})`).catch(e=>({error:String(e)})));
    const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(index+1)+'.png',Buffer.from(shot.data,'base64'));
  }
  for(const[index,row]of (evidence.failureScope??[]).entries()){
    for(const[frame,capture]of (row.observer?.resultFrames??[]).entries()){
      if(!capture.canvas)continue;const file=output+'-preserved-canvas-'+(index+1)+'-'+frame+'.png';
      await writeFile(file,Buffer.from(capture.canvas.split(',')[1],'base64'));delete capture.canvas;capture.file=file;
    }
  }
  evidence.failureCleanup=[];
  if(ws)for(const page of pages){
    try{await nativeClick(page.sessionId,'[data-source-control="btnExit"][data-leave-room], [data-summary-leave]');
      await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
      evidence.failureCleanup.push(await evaluate(page.sessionId,`({world:document.querySelector('#battle-status').dataset.world??null,instances:window.muzzleRuntime?.instances.length??null,meshes:window.muzzleScene?.meshes.filter(m=>m.metadata?.originalEffect).length??null,voices:window.muzzleSkillSound?.voices.size??null})`));}
    catch(cleanupError){evidence.failureCleanup.push({error:String(cleanupError)});}
  }
  throw error;
}finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');store?.close();
  if(ws){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  await writeFile('recovery/output/defense-drink-whole-process-cleanup.json',JSON.stringify({ports:evidence.ports,tempRemoved:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
