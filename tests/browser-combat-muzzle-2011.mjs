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
const output='recovery/output/browser-combat-muzzle-2011-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-muzzle-2011-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3324,vite:5354,cdp:9554},mapId:7,ammo:2011,
  scope:'Formal React entry; two original-owned role fixtures and inventory imports; normal room/Ready/Digit2/Space/Digit1 inputs; server fire events; confirmed2011 Effect53/GA08 and return2001 Effect4/GA07. Reduced canvas resolution.'};
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
  const env={...process.env,PORT:'3324',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'120'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5354,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3324',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9554',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9554/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9554');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5354',browserContextId});
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
    store.replaceInventory(account.accountId,[{instanceId:77,itemTableId:2011,ownedQuantity:15,battleQuantity:0,state:0,field8:0,float24Bits:0,float28Bits:0,float2cBits:0}]);store.assign(account.accountId,77,1);
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
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===2})()`);
  for(const page of pages){
    await evaluate(page.sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world')),scene=engine.scenes[0];
      engine.setHardwareScalingLevel(8);engine.resize();window.muzzleScene=scene;window.muzzleCamera=scene.activeCamera;
      window.muzzle={effects:[],sounds:[],events:[],frames:0,frameTimes:[],canvas:{width:engine.getRenderWidth(),height:engine.getRenderHeight()}};
      const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');
      const add=EffectRuntime.prototype.addInstance;
      EffectRuntime.prototype.addInstance=function(view,tree){const handle=add.call(this,view,tree);
        if([2429,3004].includes(tree.root.definition.index)){window.muzzleRuntime=this;const instance=this.instances.find(i=>i.handle===handle);
          const row={handle,owner:view.root.name,root:tree.root.definition.index,nodes:instance.draws.map(d=>d.node.definition.index),
            liveParent:tree.parentMatrix===view.primaryTag('tag_efattack'),matrix:Array.from(tree.parentMatrix),matrixChanged:false,
            rendered:[],phase:window.muzzle.phase,vertices:{},textures:{},expired:false};window.muzzle.effects.push(row);instance.muzzleRow=row;
        }return handle;};
      const draw=EffectRuntime.prototype.draw;
      EffectRuntime.prototype.draw=function(instance,d){draw.call(this,instance,d);const row=instance.muzzleRow;if(!row)return;
        row.liveParent&&=instance.tree.parentMatrix===instance.owner.primaryTag('tag_efattack');
        row.matrixChanged||=Array.from(instance.tree.parentMatrix).some((v,i)=>Math.abs(v-row.matrix[i])>0.00001);
        const mesh=d.sprite?.mesh??d.particle?.sprite.mesh??d.overlay?.mesh;
        if(mesh&&!mesh.muzzleObserved){mesh.muzzleObserved=true;mesh.onBeforeRenderObservable.add(()=>{
          if(!row.rendered.includes(d.node.definition.index))row.rendered.push(d.node.definition.index);
          row.vertices[d.node.definition.index]=mesh.getTotalVertices();row.textures[d.node.definition.index]=mesh.material.getActiveTextures()[0]?.url;
        });}};
      const remove=EffectRuntime.prototype.remove;
      EffectRuntime.prototype.remove=function(index){const i=this.instances[index];if(i.muzzleRow)i.muzzleRow.expired=i.tree.quiescent;return remove.call(this,index);};
      const {BattleSound}=await import('/src/audio/battle-sound.ts');const event=BattleSound.prototype.event;
      BattleSound.prototype.event=function(value,snapshot,localId){window.muzzleSound=this;
        const before=new Set(this.voices);event.call(this,value,snapshot,localId);
        if(value.type==='fire'){window.muzzle.events.push(value);
          for(const voice of this.voices){if(before.has(voice))continue;
            const history=this.history.at(-1),row={...history,loop:voice.source.loop,duration:voice.source.buffer.duration,
              context:this.context.state,ended:false,position:voice.position};row.phase=window.muzzle.phase;row.outputPeak=0;const analyser=this.context.createAnalyser();analyser.fftSize=256;voice.attenuation.connect(analyser);const interval=setInterval(()=>{const samples=new Float32Array(256);analyser.getFloatTimeDomainData(samples);row.outputPeak=Math.max(row.outputPeak,...samples.map(Math.abs));},10);voice.source.addEventListener('ended',()=>{clearInterval(interval);analyser.disconnect();},{once:true});window.muzzle.sounds.push(row);
            voice.source.addEventListener('ended',()=>{row.ended=true;});
          }}};
      const {Battle}=await import('/src/match/battle.ts');const reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.muzzleBattle=this;const result=reconcile.apply(this,args);if(this.roomFeed.snapshot){const players=this.roomFeed.snapshot.players;window.muzzle.snapshots??=[];const states=players.map(p=>({id:p.id,alive:p.alive,ammoItemId:p.ammoItemId,selectedAmmoSlot:p.selectedAmmoSlot}));const key=JSON.stringify(states);if(window.muzzle.snapshots.at(-1)?.key!==key)window.muzzle.snapshots.push({key,states,phase:window.muzzle.phase,round:this.roomFeed.snapshot.match.round});}return result;};
      scene.onAfterRenderObservable.add(()=>{window.muzzle.frames++;if(window.muzzle.frameTimes.length<3000)window.muzzle.frameTimes.push(engine.getDeltaTime());});
    })()`);
  }
  for(const page of pages){
    const s=page.sessionId;const point=await evaluate(s,`(()=>{const r=document.querySelector('#world').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    for(let i=0;i<3;i++){if(await evaluate(s,`window.muzzleCamera.radius>=4000`))break;await command('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaX:0,deltaY:1500},s);await new Promise(r=>setTimeout(r,100));}
  }
  for(const s of [guest,host]){await waitUntil(s,`document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await nativeClick(s,'[data-waiting-ready]');}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  console.log('Normal map0007 room with two accounts PLAYING');
  const key=async(s,key,code,windowsVirtualKeyCode)=>{await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode},s);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode},s);};
  const world=s=>evaluate(s,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  const ids=await Promise.all(pages.map(async p=>(await world(p.sessionId)).playerId));
  evidence.initial=await Promise.all(pages.map(p=>world(p.sessionId)));
  for(const page of pages){await nativeClick(page.sessionId,'#world');await evaluate(page.sessionId,`window.muzzle.phase='special'`);await key(page.sessionId,'2','Digit2',50);}
  for(const [index,page]of pages.entries())await waitUntil(page.sessionId,`window.muzzleBattle.roomFeed.snapshot.players.find(p=>p.id===window.muzzleBattle.playerId)?.ammoItemId===2011`);
  evidence.confirmed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.muzzleBattle.roomFeed.snapshot`)));
  for(const page of pages)await command('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32},page.sessionId);
  for(const page of pages)await waitUntil(page.sessionId,`window.muzzle.effects.some(r=>r.root===3004&&r.rendered.length===6&&r.expired)&&window.muzzle.sounds.some(r=>r.skillId===2011&&r.ended&&r.outputPeak>0)`);
  for(const page of pages)await command('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32},page.sessionId);
  for(const [i,page]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId);await writeFile(output+'-special-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}
  for(const page of pages){await evaluate(page.sessionId,`window.muzzle.phase='returned'`);await key(page.sessionId,'1','Digit1',49);}
  for(const page of pages)await waitUntil(page.sessionId,`window.muzzleBattle.roomFeed.snapshot.players.find(p=>p.id===window.muzzleBattle.playerId)?.ammoItemId===2001`);
  evidence.returned=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.muzzleBattle.roomFeed.snapshot`)));
  for(const page of pages)await command('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32},page.sessionId);
  for(const page of pages)await waitUntil(page.sessionId,`window.muzzle.effects.some(r=>r.root===2429&&r.phase==='returned'&&r.rendered.length===5&&r.expired)&&window.muzzle.sounds.some(r=>r.skillId===2001&&r.phase==='returned'&&r.ended&&r.outputPeak>0)`);
  for(const page of pages)await command('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32},page.sessionId);
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.muzzle`)));
  const eventKey=e=>JSON.stringify(e);evidence.sameServerFire=evidence.observed[0].events.filter(e=>e.skillId===2011&&evidence.observed[1].events.some(f=>eventKey(f)===eventKey(e)));
  assert(evidence.sameServerFire.length>0,'Both pages observe identical ordinary server2011 fire');
  for(const value of evidence.observed){
    assert(value.effects.some(e=>e.root===3004&&e.rendered.length===6&&e.liveParent&&e.expired),'053 six source nodes in one actually submitted instance, live muzzle tag and natural expiry');
    assert(value.sounds.some(s=>s.skillId===2011&&s.soundId===49&&!s.loop&&s.context==='running'&&s.ended&&s.outputPeak>0),'Actual GA08 audio source/output and natural completion');
    assert(value.effects.filter(e=>e.root===3004&&e.rendered.length>0).every(e=>Object.values(e.vertices).every(v=>v>0)&&Object.values(e.textures).every(Boolean)));
  }
  console.log('Confirmed2011 dual053/GA08 and ordinary return2001 dual004/GA07 passed');
  for(const page of pages)await nativeClick(page.sessionId,'[data-leave-room]');
  for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({instances:window.muzzleRuntime.instances.length,meshes:window.muzzleScene.meshes.filter(m=>m.metadata?.originalEffect).length,voices:window.muzzleSound.voices.size,state:document.querySelector('[data-source-audio="battle-sound"]').dataset.state})`)));
  for(const row of evidence.cleanup)assert.deepEqual(row,{instances:0,meshes:0,voices:0,state:'stopped'});
  evidence.status='PASS';console.log('PASS: '+output+'.json');
}catch(error){if(ws)for(const[i,page]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.muzzle`).catch(e=>({error:String(e)}))));throw error;}
finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});await writeFile('recovery/output/combat-muzzle-2011-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
