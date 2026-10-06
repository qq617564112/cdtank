import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
const WebSocket=createRequire(import.meta.url)('ws');
const directory=await mkdtemp(join(tmpdir(),'cdtank-scene-animation-0007-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3271,vite:5301,cdp:9501},mapId:7,resource:'Data/scnobj/obj05025/obj05025.CVD',
  scope:'Current React entry; original General32 CVD in0007; two original-owned role fixtures; normal room/CPU/Ready/movement/Space; natural source animation and leave/reentry. Reduced canvas resolution.'};
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
      window.muzzle={frames:0,frameTimes:[],draws:{},samples:[],events:[],canvas:{width:engine.getRenderWidth(),height:engine.getRenderHeight()}};
      window.animationMeshes=[];
      scene.onBeforeRenderObservable.add(()=>{
        for(const mesh of scene.meshes.filter(m=>m.metadata?.sourceSceneModel)){
          if(window.animationMeshes.includes(mesh))continue;window.animationMeshes.push(mesh);
          mesh.onBeforeRenderObservable.add(()=>{
            const index=mesh.metadata.sourceSceneModelNode;
            window.muzzle.draws[index]=(window.muzzle.draws[index]??0)+1;
            if(window.muzzle.samples.length<150)window.muzzle.samples.push({node:index,positions:Array.from(mesh.getVerticesData('position')).slice(0,9),
              source:mesh.metadata.sourceSceneModel,placement:mesh.metadata.sourcePlacementId,
              texture:mesh.material.getActiveTextures()[0]?.url,frame:window.muzzle.frames});
          });
        }
      });
      const {BattleSound}=await import('/src/audio/battle-sound.ts');const event=BattleSound.prototype.event;
      BattleSound.prototype.event=function(value,...args){if(value.type==='fire')window.muzzle.events.push(value);return event.call(this,value,...args);};
      const {ScenePreview}=await import('/src/assets/scenes/scene-preview.ts');const advance=ScenePreview.prototype.advance;
      ScenePreview.prototype.advance=function(delta){window.animationPreview=this;return advance.call(this,delta);};
      scene.onAfterRenderObservable.add(()=>{window.muzzle.frames++;if(window.muzzle.frameTimes.length<3000)window.muzzle.frameTimes.push(engine.getDeltaTime());});
    })()`);
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
  await nativeClick(host,'#open-home');await waitUntil(host,`document.querySelector('[data-home-close]')`);await nativeClick(host,'[data-home-close]');
  if(!await evaluate(host,`document.querySelector('#create-room-controls').open`))await nativeClick(host,'#create-room-controls > summary');
  await nativeSelect(host,'#room-mode',4);await waitUntil(host,`Array.from(document.querySelector('#room-map').options).some(o=>o.value==='7')`);await nativeSelect(host,'#room-map',7);await nativeClick(host,'#create-room');
  await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await nativeClick(host,'[data-add-cpu]');await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===2`);
  await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})`);await nativeSelect(guest,'#room',roomId);await nativeClick(guest,'#join');
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===3})()`);
  for(const page of pages){
    const s=page.sessionId;await nativeClick(s,'#world');const point=await evaluate(s,`(()=>{const r=document.querySelector('#world').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    for(let i=0;i<3;i++){if(await evaluate(s,`window.muzzleCamera.radius>=4000`))break;await command('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaX:0,deltaY:1500},s);await new Promise(r=>setTimeout(r,100));}
  }
  for(const s of [guest,host])await nativeClick(s,'[data-ready]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.beforeMovement=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).players`)));
  console.log('Normal0007 two accounts and CPU PLAYING; three source animation meshes loaded');
  for(const page of pages){await nativeClick(page.sessionId,'#world');
    for(const [code,key,windowsVirtualKeyCode]of [['Space',' ',32],['KeyW','w',87]])await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode},page.sessionId);}
  for(const page of pages)await waitUntil(page.sessionId,`window.muzzle.events.length>0&&Object.values(window.muzzle.draws).length===3&&Object.values(window.muzzle.draws).every(n=>n>8)`);
  await new Promise(r=>setTimeout(r,2200));
  for(const page of pages)for(const [code,key,windowsVirtualKeyCode]of [['Space',' ',32],['KeyW','w',87]])await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode},page.sessionId);
  evidence.afterMovement=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).players`)));
  assert(evidence.afterMovement.every((players,index)=>players.some(p=>!p.isCpu&&evidence.beforeMovement[index].some(q=>q.id===p.id&&Math.hypot(p.x-q.x,p.z-q.z)>1))),'Ordinary W movement must change player position');
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({...window.muzzle,world:JSON.parse(document.querySelector('#battle-status').dataset.world),animations:window.animationPreview.animations.map(a=>({clocks:a.renderer.animations.filter(Boolean).map(c=>({time:c.time,loops:c.loops})),meshes:a.renderer.meshes.map(m=>({name:m.name,metadata:m.metadata,vertices:m.getTotalVertices()}))}))})`)));
  for(const result of evidence.observed){
    assert.equal(result.animations.length,1);assert.equal(result.animations[0].meshes.length,3);
    assert(result.animations[0].clocks.every(c=>c.loops>0),'Original source clock must naturally wrap');
    for(let node=0;node<3;node++){
      const frames=result.samples.filter(s=>s.node===node);assert(frames.length>1,'Actual draw samples');
      assert(frames.some(s=>JSON.stringify(s.positions)!==JSON.stringify(frames[0].positions)),'Source node actual rendered geometry must move');
      assert(frames.every(s=>s.source===evidence.resource&&s.placement==='32'&&s.texture.includes('obj05025.png')));
    }
    assert(result.events.some(e=>e.skillId===2001));
  }
  evidence.framing=[];
  for(const page of pages){
    await nativeClick(page.sessionId,'#world');let frame;
    for(let pulse=0;pulse<100;pulse++){
      frame=await evaluate(page.sessionId,`(async()=>{const scene=window.muzzleScene,camera=scene.activeCamera,engine=scene.getEngine();
        const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {Vector3,Matrix}=await import(url);
        camera.getViewMatrix();camera.getProjectionMatrix();
        const centers=scene.meshes.filter(m=>m.metadata?.sourceSceneModel).map(m=>Vector3.Project(m.getBoundingInfo().boundingBox.centerWorld,Matrix.Identity(),scene.getTransformMatrix(),camera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight())).asArray());
        return {centers,player:JSON.parse(document.querySelector('#battle-status').dataset.world).players.find(p=>p.id===JSON.parse(document.querySelector('#battle-status').dataset.world).playerId)};})()`);
      if(frame.centers.length===3&&frame.centers.every(([x,y,z])=>x>100&&x<220&&y>15&&y<160&&z>0&&z<1))break;
      await command('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyA',key:'a',windowsVirtualKeyCode:65},page.sessionId);
      await new Promise(r=>setTimeout(r,100));
      await command('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyA',key:'a',windowsVirtualKeyCode:65},page.sessionId);
      await new Promise(r=>setTimeout(r,100));
    }
    assert(frame.centers.every(([x,y,z])=>x>100&&x<220&&y>15&&y<160&&z>0&&z<1),'Ordinary A turning must frame original CVD');evidence.framing.push(frame);
  }
  evidence.visiblePixels=await Promise.all(pages.map(p=>evaluate(p.sessionId,`(async()=>{
    const scene=window.muzzleScene,engine=scene.getEngine();const source=await(await fetch('/src/render/scene-runtime.ts')).text();
    const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {Vector3,Matrix}=await import(url);
    const meshes=scene.meshes.filter(m=>m.metadata?.sourceSceneModel),camera=scene.activeCamera;
    const cameraBefore={position:camera.globalPosition.asArray(),target:camera.target.asArray(),alpha:camera.alpha,beta:camera.beta,radius:camera.radius};
    const bounds=meshes.map(mesh=>{const b=mesh.getBoundingInfo().boundingBox;const points=b.vectorsWorld.map(v=>Vector3.Project(v,Matrix.Identity(),scene.getTransformMatrix(),camera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight())));
      return {node:mesh.metadata.sourceSceneModelNode,min:points.reduce((v,p)=>[Math.min(v[0],p.x),Math.min(v[1],p.y)],[Infinity,Infinity]),max:points.reduce((v,p)=>[Math.max(v[0],p.x),Math.max(v[1],p.y)],[-Infinity,-Infinity])};});
    const target=new Set(meshes);let before;let pixelsBefore;
    const result=await new Promise(resolve=>{
      scene.onAfterRenderObservable.addOnce(()=>{
        const gl=engine._gl,w=engine.getRenderWidth(),h=engine.getRenderHeight();
        pixelsBefore=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixelsBefore);
        before=scene.onBeforeRenderObservable.add(()=>{for(const mesh of target)mesh.setEnabled(false);});
        const firstFrame=window.muzzle.frames;
        queueMicrotask(()=>scene.onAfterRenderObservable.addOnce(()=>{
          const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
          let changed=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){
            if(!bounds.some(b=>x>=b.min[0]&&x<=b.max[0]&&h-y>=b.min[1]&&h-y<=b.max[1]))continue;
            const i=(y*w+x)*4;if(pixels[i]!==pixelsBefore[i]||pixels[i+1]!==pixelsBefore[i+1]||pixels[i+2]!==pixelsBefore[i+2])changed++;
          }
          scene.onBeforeRenderObservable.remove(before);for(const mesh of target)mesh.setEnabled(true);
          resolve({changed,firstFrame,secondFrame:window.muzzle.frames,width:w,height:h,bounds,cameraBefore,method:'Consecutive natural frames; only target CVD meshes hidden in second frame; projected target bounds RGB differences. Other natural motion remains.'});
        }));
      });
    });return result;
  })()`)));
  assert(evidence.visiblePixels.every(row=>row.changed>0),'Original CVD must contribute visible pixels in the ordinary combat camera');
  for(const [i,page]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId);await writeFile(`recovery/output/browser-scene-animation-0007-${i+1}.png`,Buffer.from(shot.data,'base64'));}
  for(const page of pages)await nativeClick(page.sessionId,'#leave');
  for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  const cleanup=()=>Promise.all(pages.map(p=>evaluate(p.sessionId,`({animations:window.animationPreview.animations.length,meshes:window.muzzleScene.meshes.filter(m=>m.metadata?.sourceSceneModel).length,textures:window.muzzleScene.textures.filter(t=>t.url?.includes('obj05025.png')).length,disposed:window.animationMeshes.every(m=>m.isDisposed())})`)));
  evidence.cleanup=await cleanup();for(const row of evidence.cleanup)assert.deepEqual(row,{animations:0,meshes:0,textures:0,disposed:true});
  await nativeClick(host,'#create-room');await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const reRoom=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await nativeClick(host,'[data-add-cpu]');await nativeClick(guest,'#refresh-rooms');
  await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(reRoom)})`);
  await nativeSelect(guest,'#room',reRoom);await nativeClick(guest,'#join');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).mapLoaded&&JSON.parse(document.querySelector('#battle-status').dataset.world).renderedPlayers===3&&!document.querySelector('[data-ready]').disabled`);
  for(const page of pages)await evaluate(page.sessionId,`window.muzzle.draws={};window.muzzle.samples=[];`);
  for(const session of [guest,host])await nativeClick(session,'[data-ready]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'&&Object.values(window.muzzle.draws).length===3&&Object.values(window.muzzle.draws).every(n=>n>3)`);
  evidence.reentry=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({draws:window.muzzle.draws,meshes:window.muzzleScene.meshes.filter(m=>m.metadata?.sourceSceneModel).map(m=>({metadata:m.metadata,name:m.name})),animations:window.animationPreview.animations.length})`)));
  for(const row of evidence.reentry){assert.equal(row.animations,1);assert.equal(row.meshes.length,3);assert(row.meshes.every(m=>m.metadata.sourcePlacementId==='32'));}
  for(const page of pages)await nativeClick(page.sessionId,'#leave');
  for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.reentryCleanup=await cleanup();for(const row of evidence.reentryCleanup)assert.deepEqual(row,{animations:0,meshes:0,textures:0,disposed:true});
  evidence.status='PASS';console.log('PASS: current React dual-page0007 original General32 three actual animated draws/source texture/natural clocks and leave/reentry cleanup');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.muzzle`).catch(e=>({error:String(e)}))));throw error;}
finally{
  await writeFile('recovery/output/browser-scene-animation-0007.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
