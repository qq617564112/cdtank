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
const output='recovery/output/browser-ground-trap3003-visual-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-ground-trap3003-'));
const database=join(directory,'accounts.sqlite');
const checkpoint='recovery/output/tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z';
await copyFile(checkpoint+'-checkpoint.sqlite',database);
const identities=JSON.parse(await readFile(checkpoint+'-identity.private.json','utf8')).accounts;

let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3453,vite:5483,cdp:9683},mapId:7,item:3003,
  scope:'Native SQLite checkpoint of actual BUYtank3/pet2/3003x2 and normal slot1, remaining stock1 after numeric run. Strict account token binding. Normal mode4/map7 Ready, native Digit2 placement and S movement. Original03003 GLB loading/draw/canvas, authoritative snapshot removal and normal Leave. Ground identity/yaw0/scale1/radius/deadline are reconstructed authority. No player pose, event or time injection; no trap-trigger skill coverage.',visibleAccepted:false};
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
  await waitUntil(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});return e&&!e.disabled})()`);
  const point = await evaluate(session, `(async()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const rect=e.getBoundingClientRect(),x=rect.x+rect.width/2,y=rect.y+rect.height/2,hit=document.elementFromPoint(x,y);if(!(hit===e||e.contains(hit)))throw new Error('Click point blocked: '+${JSON.stringify(selector)});return{x,y}})()`);
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
  const env={...process.env,PORT:'3453',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'120'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5483,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3453',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9683',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9683/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9683');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5483',browserContextId});
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
  const inventory=store.inventory(identities[0].accountId);
  const item=inventory.records.find(r=>r.itemTableId===3003);
  assert(item&&item.ownedQuantity===1,'Real checkpoint remaining one purchased trap');
  const instanceId=item.instanceId;store.close();store=undefined;
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  evidence.fixture={source:checkpoint+'-checkpoint.sqlite',accountBinding:'strict existing accountId/token',roles:'Actual BUYtank3/pet2',inventory:'Actual purchased3003 remaining1, native SQLite backup',newProfileOrInventoryImport:false};
  await nativeClick(host,'[data-room-card-home]');
  await waitUntil(host,`document.querySelector('[data-kitbag-slot="1"]')?.dataset.instanceId==='${instanceId}'`);
  evidence.inventoryBefore=await evaluate(host,`({item:document.querySelector('[data-inventory-instance="${instanceId}"]')?.textContent??null,slot:document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId})`);
  await nativeClick(host,'[data-home-close]');
  await waitUntil(host,`!document.querySelector('#home-inventory[open]')`);
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')`);await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,'[data-map-selector-map="7"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
  const joinPoint=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...joinPoint},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...joinPoint},guest);
  await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).renderedPlayers===2`);

  for(const page of pages) await evaluate(page.sessionId, `(async()=>{
    const source=await(await fetch('/src/render/scene-runtime.ts')).text();
    const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);
    const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world'));
    const scene=engine.scenes[0];engine.setHardwareScalingLevel(2);engine.resize();
    window.trapScene=scene;
    window.trapObserve={frames:0,snapshots:[],models:[],captures:[],errors:[]};
    const {Battle}=await import('/src/match/battle.ts');
    const render=Battle.prototype.render;
    Battle.prototype.render=function(...args){window.trapBattle=this;return render.apply(this,args);};
    let tick=-1;
    scene.onAfterRenderObservable.add(()=>{
      const data=window.trapObserve;data.frames++;
      const raw=document.querySelector('#battle-status')?.dataset.world;
      if(raw){const state=JSON.parse(raw);if(state.tick!==tick){tick=state.tick;
        if(state.phase==='PLAYING')data.snapshots.push({tick,time:state.time,playerId:state.playerId,players:state.players.map(p=>({id:p.id,x:p.x,y:p.y,z:p.z,alive:p.alive})),groundTraps:state.match?.groundTraps??[]});}}
      for(const mesh of scene.meshes){
        if(!mesh.metadata?.groundTrapId||!mesh.onBeforeRenderObservable||mesh.trapObserved)continue;
        mesh.trapObserved=true;
        const row={id:mesh.metadata.groundTrapId,name:mesh.name,vertices:mesh.getTotalVertices(),indices:mesh.getTotalIndices(),textures:mesh.material?.getActiveTextures().map(t=>t.url)??[],draws:0};
        data.models.push(row);mesh.onBeforeRenderObservable.add(()=>{row.draws++;row.frame=data.frames+1;});
      }
    });
  })()`);
  for(const session of [guest,host]){
    await waitUntil(session, `window.trapBattle?.players.resourcesReady&&!window.trapBattle.players.loadingError&&document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled`);
    await nativeClick(session,'[data-waiting-ready]');
  }
  for(const page of pages) await waitUntil(page.sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.before=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  await nativeClick(host,'#world');
  for(const type of ['keyDown','keyUp']) await command('Input.dispatchKeyEvent',{type,key:'2',code:'Digit2',windowsVirtualKeyCode:50},host);
  for(const page of pages) await waitUntil(page.sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).match?.groundTraps?.length===1`,10000);
  evidence.placed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  assert.deepEqual(evidence.placed[0].match.groundTraps,evidence.placed[1].match.groundTraps);
  console.log('Normal BUY2/slot1/Digit2 placement confirmed; loading original03003');
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83},host);
  await new Promise(resolve=>setTimeout(resolve,1400));
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83},host);
  for(const page of pages) await waitUntil(page.sessionId, `window.trapObserve.models.some(m=>m.vertices>0&&m.draws>0)`,15000);
  for(let frame=0;frame<3;frame++){
    for(const [index,page]of pages.entries()){
      const capture=await evaluate(page.sessionId,`({frame:window.trapObserve.frames,models:window.trapObserve.models,state:JSON.parse(document.querySelector('#battle-status').dataset.world),canvas:document.querySelector('#world').toDataURL('image/png')})`);
      const filename=output+'-natural-'+(index+1)+'-'+frame+'.png';
      await writeFile(filename,Buffer.from(capture.canvas.split(',')[1],'base64'));delete capture.canvas;
      evidence.captures??=[];evidence.captures.push({page:index+1,file:filename,...capture});
    }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  // The server removes the trap. No local effect clock or expiry override.
  for(const page of pages) await waitUntil(page.sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).match?.groundTraps?.length===0`,35000);
  for(const page of pages) await waitUntil(page.sessionId, `window.trapScene.meshes.filter(m=>m.metadata?.groundTrapId).length===0`,5000);
  evidence.afterRemoval=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.trapObserve')));
  for(const page of pages) await nativeClick(page.sessionId,'[data-leave-room]');
  for(const page of pages) await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({entries:window.trapBattle.groundTraps.entries.size,meshes:window.trapScene.meshes.filter(m=>m.metadata?.groundTrapId).length,world:document.querySelector('#battle-status').dataset.world??null})`)));
  for(const row of evidence.cleanup){assert.equal(row.entries,0);assert.equal(row.meshes,0);assert(!row.world);}
  await nativeClick(host,'[data-room-card-home]');
  await waitUntil(host,`document.querySelector('#home-inventory[open]')?.getAttribute('aria-busy')!=='true'`);
  evidence.inventoryAfter=await evaluate(host,`({item:document.querySelector('[data-inventory-instance="${instanceId}"]')?.textContent??null,slot:document.querySelector('[data-kitbag-slot="1"]').dataset.instanceId})`);
  if(evidence.inventoryAfter.item)assert(evidence.inventoryAfter.item.includes('×0'));
  await nativeClick(host,'[data-home-close]');
  evidence.status='PASS_GROUND_MODEL_DRAW_PENDING_PIXEL_REVIEW';console.log(evidence.status+': '+output+'.json');
}catch(error){
  evidence.status='INCOMPLETE';evidence.error=String(error);
  if(ws)for(const[i,page]of pages.entries()){
    evidence.failureScope??=[];
    evidence.failureScope.push(await evaluate(page.sessionId,`({observer:window.trapObserve,state:document.querySelector('#battle-status')?.dataset.world})`).catch(e=>({error:String(e)})));
    const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId).catch(()=>null);
    if(shot)await writeFile(output+'-failed-'+(i+1)+'.png',Buffer.from(shot.data,'base64'));
    if(await evaluate(page.sessionId,`!!document.querySelector('[data-leave-room]')`).catch(()=>false)){
      await nativeClick(page.sessionId,'[data-leave-room]').catch(()=>{});
      await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`,5000).catch(()=>{});
    }
  }
  throw error;
}finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  await writeFile('recovery/output/ground-trap3003-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
