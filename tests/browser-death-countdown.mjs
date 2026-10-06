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
const output='recovery/output/browser-death-countdown-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-death-countdown-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3362,vite:5392,cdp:9592},mapId:7,modeId:4,scope:'M2-05 original local death Countdown glyphs: formal four players, two normal CPU and two React autopilot inputs, natural death/revive and Leave. Pre-room original tank1/pet1 records, no live state/event/position/victory/time injection. Source/native/module reused.'};
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
  const env={...process.env,PORT:'3362',ACCOUNT_DB_PATH:database};delete env.MATCH_MIN_PLAYERS;delete env.MATCH_TIME_LIMIT_SECONDS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5392,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3362',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9592',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9592/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9592');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5392',browserContextId});
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
  await evaluate(host,`(async()=>{
    const {RoomConnection}=await import('/src/network/rooms.ts');window.countdownCpu=[];
    const cpu=RoomConnection.prototype.cpu;RoomConnection.prototype.cpu=async function(request){
      const row={request,sentAt:performance.now()};window.countdownCpu.push(row);
      try{const value=await cpu.call(this,request);row.returnedAt=performance.now();row.success=true;return value;}
      catch(error){row.returnedAt=performance.now();row.error=String(error);throw error;}
    };
  })()`);
  evidence.cpuClicks=[];
  for(let count=0;count<2;count++){
    await waitUntil(host,"!document.querySelector('[data-room-create-dialog][open]')&&!document.querySelector('[data-source-notice][open]')&&document.querySelector('[data-formal-waiting-page] [data-add-cpu]')&&!document.querySelector('[data-formal-waiting-page] [data-add-cpu]').disabled",12000);
    const point=await evaluate(host,`(async()=>{const e=document.querySelector('[data-formal-waiting-page] [data-add-cpu]');e.scrollIntoView({block:'nearest'});await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,top=document.elementFromPoint(x,y);return {x,y,matched:top===e||e.contains(top),top:top?.outerHTML.slice(0,350),disabled:e.disabled}})()`);
    evidence.cpuClicks.push(point);assert(point.matched&&!point.disabled,'ordinary CPU pointer matches enabled control');
    await command('Page.bringToFront',{},host);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:point.x,y:point.y},host);
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:point.x,y:point.y},host);
    await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===${count+3}`,12000);
  }
  evidence.cpuRequests=await evaluate(host,'window.countdownCpu');
  for(const page of pages){
    await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).renderedPlayers===4`);
    await evaluate(page.sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text(),url=source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1];
      const {EngineStore}=await import(url),engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world'));
      engine.setHardwareScalingLevel(4);engine.resize();
      const {Battle}=await import('/src/match/battle.ts');
      const render=Battle.prototype.render;
      Battle.prototype.render=function(...args){window.countdownBattle=this;return render.apply(this,args);};
      window.countdownRows=[];
      const sample=()=>{
        const raw=document.querySelector('#battle-status')?.dataset.world,w=raw?JSON.parse(raw):undefined;
        const me=w?.players.find(p=>p.id===w.playerId),e=document.querySelector('[data-source-control="txtCountdown"]');
        const rect=e?.getBoundingClientRect(),visible=!!e&&getComputedStyle(e).display!=='none';
        const row={at:performance.now(),tick:w?.tick,round:w?.match.round,phase:w?.phase,localId:w?.playerId,alive:me?.alive,hp:me?.hp,deaths:me?.deaths,visible,value:e?.dataset.value,font:e?.dataset.sourceFont,rect:rect?[rect.x,rect.y,rect.width,rect.height]:undefined,
          glyphs:e?[...e.querySelectorAll('img')].map(i=>({src:i.getAttribute('src'),complete:i.complete,natural:[i.naturalWidth,i.naturalHeight],style:i.getAttribute('style')})):[]};
        const key=JSON.stringify([row.round,row.phase,row.alive,row.visible,row.value,row.glyphs.map(i=>[i.src,i.complete])]);
        if(key!==window.countdownKey){window.countdownKey=key;window.countdownRows.push(row);}
      };
      window.countdownObserver=setInterval(sample,40);sample();
    })()`);
  }
  for(const session of [guest,host]){
    await waitUntil(session,"window.countdownBattle?.mapLoaded&&window.countdownBattle.players.resourcesReady&&!window.countdownBattle.players.loadingError&&document.querySelector('[data-waiting-ready]')&&!document.querySelector('[data-waiting-ready]').disabled");
    await nativeClick(session,'[data-waiting-ready]');
    await waitUntil(session,"(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.match.readyPlayerIds.includes(w.playerId)})()");
  }
  for(const page of pages){
    await waitUntil(page.sessionId,"JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'");
    await nativeClick(page.sessionId,'[data-autopilot]');
  }
  const world=session=>evaluate(session,"JSON.parse(document.querySelector('#battle-status').dataset.world)");
  evidence.initial=await Promise.all(pages.map(p=>world(p.sessionId)));
  evidence.fixture='Original tank1/pet1 owned records before room; two formal CPU + two human autopilot players.';
  const captured=new Set(),observeDeadline=Date.now()+70000;
  console.log('Formal mode4/map7 CPU/autopilot PLAYING: first natural local death Countdown');
  while(Date.now()<observeDeadline){
    for(const [index,page]of pages.entries()){
      const visible=await evaluate(page.sessionId,`(()=>{const r=window.countdownRows.at(-1);return r?.visible&&r.value&&r.glyphs.every(i=>i.complete&&i.natural[0]>0)})()`);
      if(visible&&!captured.has(index)){
        const image=await command('Page.captureScreenshot',{format:'png'},page.sessionId);
        await writeFile(output+'-natural-'+(index+1)+'.png',Buffer.from(image.data,'base64'));
        evidence['capture'+index]=await evaluate(page.sessionId,`({world:JSON.parse(document.querySelector('#battle-status').dataset.world),row:window.countdownRows.at(-1),control:document.querySelector('[data-source-control="txtCountdown"]').outerHTML})`);
        captured.add(index);
      }
    }
    const done=await Promise.all(pages.map(p=>evaluate(p.sessionId,`window.countdownRows.some((r,i,a)=>r.alive===true&&!r.visible&&a.slice(0,i).some(old=>old.alive===false&&old.visible))`)));
    if(done.every(Boolean))break;
    if((await world(host)).phase==='FINISHED')break;
    await new Promise(r=>setTimeout(r,100));
  }
  evidence.rows=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.countdownRows')));
  evidence.finalWorld=await Promise.all(pages.map(p=>world(p.sessionId)));
  const failures=[];
  for(const [index,rows]of evidence.rows.entries()){
    if(!rows.some(r=>r.alive===false&&r.visible&&r.font==='Countdown'&&r.value==='5'&&r.glyphs.length&&r.glyphs.every(i=>i.complete&&i.natural[0]>0)))failures.push('side'+index+' natural local death/original glyph5 missing');
    if(!rows.some((r,i)=>r.alive===true&&!r.visible&&rows.slice(0,i).some(old=>old.alive===false&&old.visible)))failures.push('side'+index+' authoritative natural revive cancels countdown missing');
    if(!captured.has(index))failures.push('side'+index+' natural full screenshot missing');
  }
  for(const page of pages)await nativeClick(page.sessionId,'[data-leave-room]');
  for(const page of pages)await waitUntil(page.sessionId,"!document.querySelector('#battle-status').dataset.world");
  await new Promise(r=>setTimeout(r,1500));
  evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`(()=>{const e=document.querySelector('[data-source-control="txtCountdown"]');return {world:document.querySelector('#battle-status').dataset.world||null,visible:!!e&&getComputedStyle(e).display!=='none',value:e?.dataset.value??null,rows:window.countdownRows.slice(-3)}})()`)));
  if(evidence.cleanup.some(r=>r.world||r.visible||r.value))failures.push('ordinary Leave Countdown cancel missing');
  for(const page of pages)await evaluate(page.sessionId,'clearInterval(window.countdownObserver)');
  evidence.failures=failures;evidence.status=failures.length?'INCOMPLETE':'PASS';
  console.log(evidence.status+': '+output+'.json');
}catch(error){
  evidence.status='FAIL';evidence.error=String(error);
  evidence.failure=await Promise.all(pages.map(p=>evaluate(p.sessionId,"({world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null'),rows:window.countdownRows??[],cpu:window.countdownCpu??[],resources:window.countdownBattle?{ready:window.countdownBattle.players.resourcesReady,error:String(window.countdownBattle.players.loadingError??''),mapLoaded:window.countdownBattle.mapLoaded}:null,notice:document.querySelector('[data-source-notice][open]')?.textContent})").catch(()=>null)));
  for(const [index,page]of pages.entries()){
    const screenshot=await command('Page.captureScreenshot',{format:'png'},page.sessionId).catch(()=>null);
    if(screenshot)await writeFile(output+'-failure-'+(index+1)+'.png',Buffer.from(screenshot.data,'base64'));
    if(await evaluate(page.sessionId,"!!document.querySelector('[data-source-notice][open] button')").catch(()=>false))await nativeClick(page.sessionId,'[data-source-notice][open] button').catch(()=>{});
    if(await evaluate(page.sessionId,"!!document.querySelector('[data-leave-room]')").catch(()=>false))await nativeClick(page.sessionId,'[data-leave-room]').catch(()=>{});
  }
  throw error;
}finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();
  if(ws){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  await writeFile('recovery/output/death-countdown-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
