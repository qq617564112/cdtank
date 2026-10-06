import {connectBreachAuxiliary} from './helpers/breach-auxiliary.mjs';
import {installMap02EnvironmentObserver} from './observers/map02-environment-prepared-browser.mjs';
import {installMap04FullSessionObserver} from './observers/map04-full-session-browser.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
const WebSocket=createRequire(import.meta.url)('ws');
const mapId=4;
let modeId=1;
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-map04-full-session-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-map04-full-session-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store,aux;
let serverLog = '';
const connectionEvents = [];
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3674,vite:5674,cdp:9874},mapId:4,modes:[1,3],ammo:2001,scope:'Whole Map04 modes1/3, two rendered and two passive authenticated accounts; explicit pre-room tank1/pet1 fixture. Ordinary Autopilot, natural rounds/Rematch and reentry/Leave at1920 and3840. No active state/camera/event/time injection.'};
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
  const env={...process.env,PORT:'3674',ACCOUNT_DB_PATH:database};delete env.MATCH_MIN_PLAYERS;delete env.MATCH_TIME_LIMIT_SECONDS;
  server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});
  const deadline=Date.now()+15000;while(!serverLog.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(serverLog.includes('Server started'),serverLog);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5674,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3674',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9874',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9874/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9874');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  if (['Network.webSocketClosed', 'Network.webSocketFrameError'].includes(message.method)) connectionEvents.push({method: message.method, sessionId: message.sessionId, params: message.params, at: Date.now()});
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});

  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5674',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
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
  for(const page of pages){
    await evaluate(page.sessionId,'('+installMap02EnvironmentObserver.toString()+')(4)');
    await evaluate(page.sessionId,'('+installMap04FullSessionObserver.toString()+')()');
  }
  const failures=[];
  evidence.samples=[];
  evidence.consistency={commonTicks:0,matchedTicks:0,mismatches:[]};
  const world=session=>evaluate(session,"JSON.parse(document.querySelector('#battle-status').dataset.world)");
  async function stage(value){for(const page of pages)await evaluate(page.sessionId,'window.map04Session.stage='+JSON.stringify(value));}
  async function createJoin(){
    await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="${modeId}"]')`);await nativeClick(host,'[data-map-selector-mode="'+modeId+'"]');await nativeClick(host,'[data-map-selector-map="4"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);await nativeClick(host,'[data-room-create-confirm]');
    await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
    const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
    await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
    const point=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...point},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...point},guest);
    await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
    aux=await connectBreachAuxiliary('ws://127.0.0.1:3674',roomId,2);
    evidence.auxiliaryPlayers??=[];evidence.auxiliaryPlayers.push(aux.members.map(m=>({playerId:m.playerId,accountId:m.accountId})));
    return roomId;
  }
  async function ready(){
    await aux.ready((await world(host)).match.round);
    for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4&&document.querySelector('[data-waiting-ready]')?.matches(':enabled')})()`,90000);
    for(const session of [guest,host])await nativeClick(session,'[data-waiting-ready]');
    for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`,90000);
  }
  async function autopilot(){
    for(const page of pages){
      const current = await world(page.sessionId);
      if (current.phase === 'FINISHED' || current.players.find(player => player.id === current.playerId)?.isAutopilot) continue;
      await waitUntil(page.sessionId, `document.querySelector('[data-battle-play-summary]')`);
      await nativeClick(page.sessionId,'[data-battle-play-summary]');
      if(await evaluate(page.sessionId,`document.querySelector('[data-autopilot]')?.getAttribute('aria-pressed')!=='true'`))await nativeClick(page.sessionId,'[data-autopilot]');
      await waitUntil(page.sessionId,`document.querySelector('[data-autopilot]')?.getAttribute('aria-pressed')==='true'`);
      await nativeClick(page.sessionId,'[data-battle-play-summary]');
    }
  }
  async function resize(width,height){
    for(const page of pages)await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},page.sessionId);
    for(const page of pages)await waitUntil(page.sessionId,`window.map04Battle.scene.getEngine().getRenderWidth()===${width}&&window.map04Battle.scene.getEngine().getRenderHeight()===${height}`);
    evidence.dimensions??=[];evidence.dimensions.push({width,height,actual:await Promise.all(pages.map(page=>evaluate(page.sessionId,'({width:window.map04Battle.scene.getEngine().getRenderWidth(),height:window.map04Battle.scene.getEngine().getRenderHeight(),hardwareScaling:window.map04Battle.scene.getEngine().getHardwareScalingLevel()})')))});
  }
  const seenTicks=new Set();
  async function sample(label){
    const recent=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.map04Session.recentSnapshots')));
    const peer=new Map(recent[1].map(snapshot=>[snapshot.tick,snapshot]));
    for(const snapshot of recent[0]){
      const other=peer.get(snapshot.tick);if(!other)continue;
      const key=label+':'+snapshot.match?.round+':'+snapshot.tick;if(seenTicks.has(key))continue;seenTicks.add(key);
      evidence.consistency.commonTicks++;
      if(JSON.stringify(snapshot.players)===JSON.stringify(other.players)&&JSON.stringify(snapshot.match)===JSON.stringify(other.match))evidence.consistency.matchedTicks++;
      else evidence.consistency.mismatches.push({key,host:snapshot,guest:other});
    }
    evidence.samples.push({label,at:Date.now(),worlds:await Promise.all(pages.map(page=>world(page.sessionId)))});
  }
  async function capture(label){
    for(const [index,page]of pages.entries()){
      const value=await command('Page.captureScreenshot',{format:'png'},page.sessionId);
      await writeFile(output+'-'+label+'-'+(index+1)+'.png',Buffer.from(value.data,'base64'));
    }
  }
  async function naturalRound(round,label){
    await stage(label);await autopilot();
    const started=Date.now();let captured=false;let lastSample=0;
    while(Date.now()-started<420000){
      const current=await world(host);
      if(Date.now()-lastSample>10000){await sample(label);lastSample=Date.now();console.log(label+' tick='+current.tick+' phase='+current.phase+' wall='+Math.round((Date.now()-started)/1000)+'s');}
      if(!captured&&Date.now()-started>15000){await capture(label+'-playing');captured=true;}
      if(current.phase==='FINISHED')break;
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    const final=await Promise.all(pages.map(page=>world(page.sessionId)));
    if(final.some(value=>value.phase!=='FINISHED'||value.match.round!==round))failures.push(label+' natural round did not finish');
    if(!final[0].match.result||!final[1].match.result||JSON.stringify(final[0].match.result)!==JSON.stringify(final[1].match.result))failures.push(label+' results differ');
    await capture(label+'-result');
    evidence.rounds.push({round,label,wallMs:Date.now()-started,final});
    return final.every(value=>value.phase==='FINISHED');
  }
  async function leave(label){
    await aux.leave((await world(host)).match.round);
    for(const session of [guest,host]){
      await waitUntil(session,`document.querySelector('[data-leave-room], [data-summary-leave]')?.matches(':enabled')`);
      const selector=await evaluate(session,`document.querySelector('[data-summary-leave]')?'[data-summary-leave]':'[data-leave-room]'`);
      await nativeClick(session,selector);await waitUntil(session,`!document.querySelector('#battle-status').dataset.world`);
    }
    const cleanup=await Promise.all(pages.map(page=>evaluate(page.sessionId,'({players:window.map04Battle.players.size,breakables:window.map04Battle.battlefield.breakables.size,plantRoots:window.map04Battle.battlefield.plantRoots.size,plantSnapshots:window.map04Battle.battlefield.plantSnapshots.size,plantRound:window.map04Battle.battlefield.plantRound??null,effects:window.map04Battle.effects.instances.length,sceneVoices:window.map04Battle.effects.skillSound.voices.size,treeVoices:window.map04Battle.effects.sound.voices.size,battleVoices:window.map04Battle.sound.voices.size,running:window.map04Battle.running,inputIntervalActive:!!window.map04Battle.input.interval,world:document.querySelector("#battle-status").dataset.world||null})')));
    for(const row of cleanup)if(Object.entries(row).some(([key,value])=>['plantRound','world'].includes(key)?value!==null:!!value))failures.push(label+' cleanup incomplete');
    evidence.cleanups.push({label,cleanup,environment:await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.map02Environment')))});
  }
  evidence.rounds=[];evidence.cleanups=[];
  evidence.modes=[];
  for(modeId of [1,3]){
    const roomId=await createJoin();await ready();await resize(1920,1080);
    const initial=await Promise.all(pages.map(page=>world(page.sessionId)));
    evidence.modes.push({modeId,roomId,initial});
    for(const state of initial){
      if(state.mapId!==4||state.mode!==modeId||state.players.length!==4||state.match.scenePlants?.length!==106)failures.push('Map04 full Plant/player state missing');
      if(modeId===1&&state.match.sceneObjects.filter(value=>value.id.startsWith('ENV:')).length!==38)failures.push('Map04 full Breach state missing');
    }
    const completed=await naturalRound(1,'mode'+modeId+'-round1-1920');
    if(completed){
      await aux.rematch(1);
      for(const session of [host,guest]){await waitUntil(session,`document.querySelector('[data-rematch]')?.matches(':enabled')`);await nativeClick(session,'[data-rematch]');}
      for(const page of pages)await waitUntil(page.sessionId,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='PLAYING'&&w.match.round===2})()`);
      await resize(3840,2160);await naturalRound(2,'mode'+modeId+'-round2-3840');
    }
    await leave('mode'+modeId+'-two-rounds');await aux.disconnect();aux=undefined;
    await resize(1920,1080);
  }
  evidence.reentryRoomId=await createJoin();await ready();await stage('reentry');
  await new Promise(resolve=>setTimeout(resolve,5000));await sample('reentry');
  evidence.reentry=await Promise.all(pages.map(page=>world(page.sessionId)));
  await leave('reentry');
  evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.map04Session')));
  evidence.environment=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.map02Environment')));
  if(evidence.consistency.mismatches.length)failures.push('Common-tick authoritative players/match differ');
  if(evidence.rounds.length!==4)failures.push('Both legal modes natural rounds coverage missing');
  evidence.failures=failures;evidence.status=failures.length?'INCOMPLETE':'PASS';
  console.log(evidence.status+': '+output+'.json');
}catch(error){
  evidence.status='FAIL';evidence.error=String(error);
  if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.map04Session').catch(e=>({error:String(e)}))));
  if(ws){
    evidence.environment=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.map02Environment').catch(e=>({error:String(e)}))));
    evidence.canvasAtFailure=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({viewport:[innerWidth,innerHeight],client:[document.querySelector('#world').clientWidth,document.querySelector('#world').clientHeight],backbuffer:[window.map04Battle.scene.getEngine().getRenderWidth(),window.map04Battle.scene.getEngine().getRenderHeight()]})`).catch(e=>({error:String(e)}))));
  }
  throw error;
}finally{
  evidence.connectionEvents=connectionEvents;
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();
  if(ws){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
  await aux?.disconnect();await vite?.close();await stop(server);await stop(chrome);
  await writeFile(output+'-server.log',serverLog);
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  await writeFile('recovery/output/map04-full-session-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
