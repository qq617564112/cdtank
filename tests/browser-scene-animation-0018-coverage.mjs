import {connectBreachAuxiliary} from './helpers/breach-auxiliary.mjs';
import {installSceneAnimation0018CoverageObserver} from './observers/scene-animation-0018-coverage.mjs';
import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation';
import {getBattlefield} from '../apps/server/src/battlefield';
import {findBotPath} from '../apps/server/src/battle/cpu/navigation';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
const WebSocket=createRequire(import.meta.url)('ws');
const southern=process.env.GENERAL18_SOUTHERN==='1';
const targetIds=(process.env.GENERAL18_TARGETS??'68').split(',');
const rematchLeaveOnly=false;
const roundOnly=process.argv.includes('--round-only');
const visualOnly=true;
const near66=false;
const lifecycleOnly=process.argv.includes('--lifecycle-only');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-scene-animation-0018-coverage-'+(roundOnly?'round-':'')+runId;
const traceOutput=resolve(output+'-server.jsonl');
const trace=async()=>{try{return (await readFile(traceOutput,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}catch(error){if(error.code==='ENOENT')return [];throw error;}};
const directory=await mkdtemp(join(tmpdir(),'cdtank-scene-animation-0018-coverage-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,aux;
let chromeLog='';
const pages=[],contexts=[];
const evidence={status:'RUNNING',targetIds,ports:{server:3311,vite:5341,cdp:9541},mapId:18,tankId:1,scope:'Ordinary mode4/map18 two webpages plus authenticated auxiliary players, default minimum4. General source placement coverage through ordinary keyboard routes and real camera/source meshes. Web start0/rate1; original GPU/General startup remain separate.',lifecycleReference:'browser-scene-animation-0018-2026-10-04T03-10-02-088Z.json'};
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
      return await evaluate(session, `(async()=>{const deadline=Date.now()+60000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#room-map-info')?.value+' tanks='+document.querySelector('#tank')?.options.length+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
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
  const env={...process.env,PORT:'3311',ACCOUNT_DB_PATH:database,CDTANK_BREACH_TRACE:traceOutput};delete env.MATCH_TIME_LIMIT_SECONDS;delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','--import','./tests/observers/breach-runtime.ts','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,cacheDir:join(directory,'vite-cache'),root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5341,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3311',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9541',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  chrome.stderr.on('data',data=>{chromeLog+=String(data);});
  let endpoint;for(let i=0;i<300;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9541/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9541 '+chromeLog);evidence.chromeStartup={connected:true};ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5341',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu')&&!document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId,'('+installSceneAnimation0018CoverageObserver.toString()+')('+JSON.stringify(targetIds)+')');
  }
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  await nativeClick(host,'#open-home');await waitUntil(host,`document.querySelector('[data-home-close]')`);await nativeClick(host,'[data-home-close]');
  if(!await evaluate(host,`document.querySelector('#create-room-controls').open`))await nativeClick(host,'#create-room-controls > summary');
  await nativeSelect(host,'#tank',1);await nativeSelect(host,'#room-mode',4);await waitUntil(host,`Array.from(document.querySelector('#room-map').options).some(o=>o.value==='18')`);await nativeSelect(host,'#room-map',18);await nativeClick(host,'#create-room');
  await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  if(southern){
    aux=await connectBreachAuxiliary('ws://127.0.0.1:3311',roomId,6);
    await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).mapLoaded&&JSON.parse(document.querySelector('#battle-status').dataset.world).renderedPlayers===7&&!document.querySelector('[data-ready]').disabled`);
    evidence.membership={originalRoom:roomId,originalHost:await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world)`),auxiliaryPlayers:aux.members.map(m=>({playerId:m.playerId,accountId:m.accountId}))};
    if(!await evaluate(host,`!!document.querySelector('[data-waiting-close]')`))await nativeClick(host,'[data-open-waiting-room]');await waitUntil(host,`!!document.querySelector('[data-waiting-close]')`);await nativeClick(host,'[data-waiting-close]');await waitUntil(host,`!document.querySelector('#battle-status').dataset.world`);
    if(await evaluate(host,`!!document.querySelector('[data-home-close]')`))await nativeClick(host,'[data-home-close]');
    await waitUntil(host,`document.querySelector('#refresh-rooms').getBoundingClientRect().height>0&&!document.querySelector('#refresh-rooms').disabled`);
    await nativeClick(host,'#refresh-rooms');await waitUntil(host,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})`);await nativeSelect(host,'#room',roomId);
    evidence.membership.beforeJoin=await evaluate(host,`({status:document.querySelector('#battle-status').value,joinDisabled:document.querySelector('#join').disabled,joinRect:document.querySelector('#join').getBoundingClientRect().toJSON(),dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>({id:d.id,html:d.outerHTML.slice(0,300)})),rooms:[...document.querySelector('#room').options].map(o=>({value:o.value,disabled:o.disabled,text:o.text})),selected:document.querySelector('#room').value})`);await writeFile(output+'-membership-checkpoint.json',JSON.stringify(evidence,null,2)+'\n');
    await waitUntil(host,`!document.querySelector('#join').disabled&&document.querySelector('#join').getBoundingClientRect().height>0`);
    await nativeClick(host,'#join');await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);

    evidence.membership.rejoinedHost=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  }
  await nativeClick(guest,'#open-home');await waitUntil(guest,`document.querySelector('[data-home-close]')`);await nativeClick(guest,'[data-home-close]');await nativeSelect(guest,'#tank',1);
  await nativeClick(guest,'#refresh-rooms');await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})`);await nativeSelect(guest,'#room',roomId);await nativeClick(guest,'#join');
  if(!southern)aux=await connectBreachAuxiliary('ws://127.0.0.1:3311',roomId,2);await aux.ready(1);
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).renderedPlayers===${southern?8:4}&&JSON.parse(document.querySelector('#battle-status').dataset.world).mapLoaded&&!document.querySelector('[data-ready]').disabled`);
  for(const session of [guest,host])await nativeClick(session,'[data-ready]');
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.initial=await Promise.all(pages.map(p=>evaluate(p.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`)));
  assert(evidence.initial.every(w=>w.mode===4&&w.mapId===18&&w.players.length===(southern?8:4)));
  if(southern){assert(evidence.initial.every(w=>{const p=w.players.find(p=>p.id===w.playerId);return p.z>800&&p.z<900;}),'Ordinary membership selects actual southern original spawns');}
  evidence.routeInputs=[];evidence.stages=[];
  const press=async(session,code,duration)=>{await command('Page.bringToFront',{},session);const codes={KeyW:87,KeyA:65,KeyD:68};await command('Input.dispatchKeyEvent',{type:'keyDown',key:code.slice(3).toLowerCase(),code,windowsVirtualKeyCode:codes[code]},session);await new Promise(r=>setTimeout(r,duration));await command('Input.dispatchKeyEvent',{type:'keyUp',key:code.slice(3).toLowerCase(),code,windowsVirtualKeyCode:codes[code]},session);};
  for(const page of pages)await nativeClick(page.sessionId,'#world');
  const positions={'66':{x:272.762939453125,z:1267.0318603515625},'67':{x:-319.60919189453125,z:1269.3758544921875},'68':{x:-321.70135498046875,z:-1199.89501953125}};
  const field=getBattlefield(18),baseNavigation=createOriginalBotNavigation(field);
  const navigation={...baseNavigation,cacheKey:baseNavigation.cacheKey+':box26',canTraverse:(a,b)=>baseNavigation.canTraverse(a,b)&&Math.hypot(field.move(a,b,26).x-b.x,field.move(a,b,26).z-b.z)<.01};
  for(const id of targetIds){
    const stage={id,complete:false};evidence.stages.push(stage);const gate=Date.now()+60000;
    console.log('Ordinary dual-web route toward General'+id);
    while(Date.now()<gate){
      const observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({captures:window.breach.captures.map(c=>({id:c.id,frame:c.frame})),draws:window.breach.draws.map(d=>({id:d.id,node:d.node,positions:d.positions}))})`)));
      if(observed.every(o=>o.captures.some(c=>c.id===id)&&[2,3,4,5].every(node=>new Set(o.draws.filter(d=>d.id===id&&d.node===node).map(d=>JSON.stringify(d.positions))).size>=3))){stage.complete=true;break;}
      for(const [index,page]of pages.entries()){
        if(observed[index].captures.some(c=>c.id===id))continue;
        const w=await evaluate(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world)`),p=w.players.find(p=>p.id===w.playerId),target=positions[id],goal=id==='68'?{x:index===0?250:50,y:p.y,z:index===0?-600:-500}:id==='66'?{x:index===0?-350:50,y:p.y,z:index===0?800:500}:{x:index===0?-150:250,y:p.y,z:index===0?500:700};
        const route=findBotPath(field,{x:p.x,y:p.y,z:p.z},goal,navigation),waypoint=route.find(q=>Math.hypot(q.x-p.x,q.z-p.z)>25),drive=waypoint??target;
        const bearing=Math.atan2(drive.x-p.x,drive.z-p.z),turn=Math.atan2(Math.sin(bearing-p.yaw),Math.cos(bearing-p.yaw));
        const code=Math.abs(turn)>.08?(turn>0?'KeyA':'KeyD'):waypoint?'KeyW':undefined;
        if(code)await press(page.sessionId,code,code==='KeyW'?350:90);
        evidence.routeInputs.push({id,page:index+1,tick:w.tick,player:p,goal,route,bearing,turn,keys:code?[code]:[]});
      }
      await new Promise(r=>setTimeout(r,100));
    }
    evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.breach')));
    await writeFile(output+'-'+id+'-checkpoint.json',JSON.stringify({...evidence,status:stage.complete?'PLACEMENT_CAPTURED':'FAIL'},null,2)+'\n');
    for(const [index,o]of evidence.observed.entries()){const c=o.captures.find(c=>c.id===id);if(c)await writeFile(output+'-'+id+'-'+(index+1)+'.png',Buffer.from(c.canvas.split(',')[1],'base64'));}
    assert(stage.complete,'Both webpages General'+id+' fullfive source draws/three dynamic poses/actual camera capture');
    console.log('PASS ordinary General'+id+' source capture on both webpages');
  }
  await aux.leave(1);for(const page of pages)await nativeClick(page.sessionId,'#leave');for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.status='PASS';console.log('PASS requested General coverage source captures; original canvas visual review separate');
}catch(error){evidence.status='FAIL';evidence.error=String(error);if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.breach').catch(e=>({error:String(e)}))));throw error;}
finally{await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');console.log(output+'.json');if(ws){for(const p of pages)await command('Target.closeTarget',{targetId:p.targetId}).catch(()=>{});ws.close();}await aux?.disconnect();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
