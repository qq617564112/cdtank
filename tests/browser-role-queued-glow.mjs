import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {connectBreachAuxiliary} from './helpers/breach-auxiliary.mjs';
const WebSocket=createRequire(import.meta.url)('ws');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-role-queued-glow-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-role-queued-glow-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store,aux;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3383,vite:5413,cdp:9613},mapId:7,itemId:17031,
  scope:'Normal authenticated Shop BUY17031→Home PART EQUIP→map7/mode1 ordinary Ready; original silent queued31 actual render and normal Leave. Source-owned-role/funds fixture before room, no active injection.'};
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
  const env={...process.env,PORT:'3383',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'120'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5413,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3383',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9613',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9613/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9613');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5413',browserContextId});
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

    assert.equal(store.inventory(account.accountId).records.length,0);
    const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa8,72,true);view.setUint32(0xa4,base.fields.get(0),true);view.setUint32(0x70,index===0?2000:0,true);view.setUint32(0x74,0,true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
  }
  store.close();store=undefined;
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  for(const page of pages){await nativeClick(page.sessionId,'[data-room-card-home]');await waitUntil(page.sessionId,`document.querySelector('#home-inventory[open] [data-source-control="btnClose"]')`);await nativeClick(page.sessionId,'[data-home-close]');await waitUntil(page.sessionId,`!document.querySelector('#home-inventory[open]')`);}
  evidence.fixture={initialInventory:'empty',experimentalProfileMoney:[2000,0],experimentalProfileTokens:[0,0],source:'world-role-attributes-native.json tank1/part0; owned native tank1/pet1 imported before room'};
  await nativeClick(host,'[data-room-card-shop]');await waitUntil(host,`document.querySelector('#account-shop')?.open&&document.querySelector('#account-shop').getAttribute('aria-busy')==='false'`);
  await nativeClick(host,'[data-shop-root-category="Part"]');
  await waitUntil(host,`document.querySelector('[data-part-product-id="17031"]')?.matches(':enabled')`);
  await nativeClick(host,'[data-part-product-id="17031"]');await nativeSelect(host,'[data-part-currency]','MONEY');
  await nativeClick(host,'[data-part-buy]');await waitUntil(host,`document.querySelector('[data-part-status]').textContent.includes('已购买黄金之光')&&document.querySelector('[data-part-owned-instance]')`);
  const instanceId=Number(await evaluate(host,`document.querySelector('[data-part-owned-instance]').dataset.partOwnedInstance`));assert(instanceId>0);
  evidence.purchase=await evaluate(host,`({status:document.querySelector('[data-part-status]').textContent,owned:document.querySelector('[data-part-owned-instance]').textContent})`);
  await nativeClick(host,'[data-part-equipment]');await waitUntil(host,`document.querySelector('#home-equipment[open] [data-equipment-item="${instanceId}"]')?.matches(':enabled')`);
  await nativeClick(host,`[data-equipment-item="${instanceId}"]`);await nativeClick(host,'[data-equipment-slot="0"]');
  await waitUntil(host,`document.querySelector('[data-equipment-slot="0"]').dataset.instanceId==='${instanceId}'&&!document.querySelector('#home-equipment').matches('[aria-busy="true"]')`);
  evidence.equipment=await evaluate(host,`({slot:0,instanceId:document.querySelector('[data-equipment-slot="0"]').dataset.instanceId,owned:document.querySelector('[data-equipment-item="${instanceId}"]').textContent})`);
  await nativeClick(host,'[data-equipment-close]');await waitUntil(host,`!document.querySelector('#home-equipment[open]')`);
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="1"]')`);await nativeClick(host,'[data-map-selector-mode="1"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
  const joinPoint=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...joinPoint},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...joinPoint},guest);
  await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
  aux=await connectBreachAuxiliary('ws://127.0.0.1:3383',roomId,2);evidence.auxiliaryPlayers=aux.members.map(m=>({playerId:m.playerId,accountId:m.accountId}));await aux.ready(1);
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);
  for(const page of pages){await evaluate(page.sessionId,`(async()=>{
    const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world')),scene=engine.scenes[0];
    engine.setHardwareScalingLevel(4);engine.resize();window.glowScene=scene;
    window.glow={notifications:[],effects:[],frame:0,captures:[]};
    const {BattleSkillEffects}=await import('/src/match/skills/battle-skill-effects.ts');const play=BattleSkillEffects.prototype.play;
    BattleSkillEffects.prototype.play=function(message){if(message.skillId===13501)window.glow.notifications.push({...message,frame:window.glow.frame});return play.call(this,message);};
    const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');const add=EffectRuntime.prototype.addInstance;
    EffectRuntime.prototype.addInstance=function(view,tree){window.glowRuntime=this;const handle=add.call(this,view,tree);if(tree.root.definition.index===2500){const instance=this.instances.find(i=>i.handle===handle);const row={handle,root:2500,owner:view?.root.name,nodes:instance.draws.map(d=>d.node.definition.index),rendered:[]};window.glow.effects.push(row);instance.glowRow=row;}return handle;};
    const draw=EffectRuntime.prototype.draw;EffectRuntime.prototype.draw=function(instance,d){draw.call(this,instance,d);const row=instance.glowRow;if(!row)return;const mesh=d.sprite?.mesh??d.particle?.sprite.mesh??d.overlay?.mesh;if(mesh?.onBeforeRenderObservable&&!mesh.glowObserved){mesh.glowObserved=true;mesh.onBeforeRenderObservable.add(()=>{if(!row.rendered.includes(d.node.definition.index))row.rendered.push(d.node.definition.index);row.lastFrame=window.glow.frame+1;});}};
    const {Battle}=await import('/src/match/battle.ts');const reconcile=Battle.prototype.reconcile;Battle.prototype.reconcile=function(...args){window.glowBattle=this;window.glowRuntime=this.effects;return reconcile.apply(this,args);};
    scene.onAfterRenderObservable.add(()=>{window.glow.frame++;if(window.glow.captures.length>=3)return;const row=window.glow.effects.find(e=>e.rendered.length&&e.lastFrame===window.glow.frame);if(row)window.glow.captures.push({handle:row.handle,frame:window.glow.frame,rendered:[...row.rendered],canvas:engine.getRenderingCanvas().toDataURL('image/png')});});
  })()`);}
  for(const s of [guest,host]){await waitUntil(s,`document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);await nativeClick(s,'[data-waiting-ready]');}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  console.log('Four ordinary accounts PLAYING; purchased17031 queued31 observer active');
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  const glowDeadline=Date.now()+12000;
  while(Date.now()<glowDeadline){const ready=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.glow.effects.some(e=>e.rendered.includes(2601)&&e.rendered.includes(2882))&&window.glow.captures.length>0`)));if(ready.every(Boolean))break;await new Promise(r=>setTimeout(r,250));}
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.glow`)));
  for(const [i,p]of pages.entries()){for(const[j,frame]of evidence.observed[i].captures.entries()){await writeFile(output+'-canvas-'+(i+1)+'-'+j+'.png',Buffer.from(frame.canvas.split(',')[1],'base64'));delete frame.canvas;}}
  await aux.leave(1);
  for(const page of pages)await nativeClick(page.sessionId,'[data-leave-room]');
  for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);

  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({instances:window.glowRuntime?.instances.length??null,meshes:window.glowScene.meshes.filter(m=>m.metadata?.originalEffect).length,skillVoices:window.glowRuntime?.skillSound.voices.size??null,treeVoices:window.glowRuntime?.sound.voices.size??null,battleVoices:window.glowBattle?.sound.voices.size??null,world:document.querySelector('#battle-status').dataset.world??null})`)));
  evidence.status=evidence.observed.every(v=>v.effects.some(e=>e.rendered.includes(2601)&&e.rendered.includes(2882))&&v.captures.length)?'PASS_RENDER_PENDING_PIXEL_REVIEW':'INCOMPLETE';
  console.log(evidence.status+': '+output+'.json');
}catch(error){if(ws)for(const[i,page]of pages.entries()){const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId).catch(()=>null);if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));}evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.glow`).catch(e=>({error:String(e)}))));throw error;}
finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}
  await aux?.disconnect();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});await writeFile('recovery/output/role-queued-glow-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
