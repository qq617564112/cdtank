import {connectBreachAuxiliary} from './helpers/breach-auxiliary.mjs';
import {installMap02EnvironmentObserver} from './observers/map02-environment-prepared-browser.mjs';
import {installMap02FullSessionObserver} from './observers/map02-full-session-browser.mjs';
import {installMap02RenderTimingObserver} from './observers/map02-render-timing-prepared-browser.mjs';
import {installScenePlant02ContactObserver} from './observers/scene-plant02-contact-browser.mjs';
import {installMap02PlantRoundResetObserver} from './observers/map02-plant-round-reset-prepared-browser.mjs';
import {hideMap02PlantForRoundReset} from './helpers/map02-plant-round-reset-prepared.mjs';
import {summarizeMap02PlantRoundReset} from './helpers/map02-plant-round-reset-evidence.mjs';
import {createRoomBattlefield} from '../apps/server/src/battlefield.ts';
import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation.ts';
import {findBotPath} from '../apps/server/src/battle/cpu/navigation.ts';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
const WebSocket=createRequire(import.meta.url)('ws');
const mapId=2;
const lifecycleTailOnly=process.argv.includes('--normal-lifecycle-tail');
const plantRoundResetOnly=process.argv.includes('--plant-round-reset');
const modeId=Number(process.env.MAP02_SESSION_MODE??1);
assert([1,2,3].includes(modeId),'Original Map02 legal mode');
assert(!plantRoundResetOnly || (modeId === 2 && !lifecycleTailOnly), 'Plant reset uses a natural mode2 round');
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-map02-full-session-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-map02-full-session-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store,aux;
let serverLog = '';
const connectionEvents = [];
const pages=[],contexts=[];
const evidence={status:'RUNNING',lifecycleTailOnly,plantRoundResetOnly,ports:{server:3595,vite:5625,cdp:9825},mapId:2,modeId,ammo:2001,scope:'Fixed Map02 legal mode'+modeId+', two formal React accounts plus two ordinary authenticated passive accounts; explicit original role pre-room fixture. Two natural rounds with original300s limit/ordinary Autopilot/Rematch, normal dualLeave/newCreateJoinReady reentry/Leave. Login-before-Create environmental observers, actual1920 and3840 frame dimensions/timings; source305 only natural observed content. No purchases, active position/HP/clock/score/result/event injection or old Plant route.'};
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
  const env={...process.env,PORT:'3595',ACCOUNT_DB_PATH:database};delete env.MATCH_MIN_PLAYERS;delete env.MATCH_TIME_LIMIT_SECONDS;
  server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{serverLog+=String(d);});
  const deadline=Date.now()+15000;while(!serverLog.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(serverLog.includes('Server started'),serverLog);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5625,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3595',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9825',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9825/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9825');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5625',browserContextId});
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
    await evaluate(page.sessionId,'('+installMap02EnvironmentObserver.toString()+')()');
    await evaluate(page.sessionId,'('+installMap02FullSessionObserver.toString()+')()');
    await evaluate(page.sessionId,'('+installMap02RenderTimingObserver.toString()+')()');
    if(plantRoundResetOnly){
      await evaluate(page.sessionId,'('+installScenePlant02ContactObserver.toString()+')()');
      await evaluate(page.sessionId,'('+installMap02PlantRoundResetObserver.toString()+')()');
    }
  }
  const failures=[];
  evidence.samples=[];
  evidence.consistency={commonTicks:0,matchedTicks:0,mismatches:[]};
  const world=session=>evaluate(session,"JSON.parse(document.querySelector('#battle-status').dataset.world)");
  async function stage(value){for(const page of pages)await evaluate(page.sessionId,'window.map02Session.stage='+JSON.stringify(value));}
  async function createJoin(){
    await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="${modeId}"]')`);await nativeClick(host,'[data-map-selector-mode="'+modeId+'"]');await nativeClick(host,'[data-map-selector-map="2"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);await nativeClick(host,'[data-room-create-confirm]');
    await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
    const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
    await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
    const point=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...point},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...point},guest);
    await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
    aux=await connectBreachAuxiliary('ws://127.0.0.1:3595',roomId,2);
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
    for(const page of pages)await waitUntil(page.sessionId,`window.map02Battle.scene.getEngine().getRenderWidth()===${width}&&window.map02Battle.scene.getEngine().getRenderHeight()===${height}`);
    evidence.dimensions??=[];evidence.dimensions.push({width,height,actual:await Promise.all(pages.map(page=>evaluate(page.sessionId,'({width:window.map02Battle.scene.getEngine().getRenderWidth(),height:window.map02Battle.scene.getEngine().getRenderHeight(),hardwareScaling:window.map02Battle.scene.getEngine().getHardwareScalingLevel()})')))});
  }
  const seenTicks=new Set();
  async function sample(label){
    const recent=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.map02Session.recentSnapshots')));
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
    if(plantRoundResetOnly)return;
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
    const cleanup=await Promise.all(pages.map(page=>evaluate(page.sessionId,'({players:window.map02Battle.players.size,breakables:window.map02Battle.battlefield.breakables.size,plantRoots:window.map02Battle.battlefield.plantRoots.size,plantSnapshots:window.map02Battle.battlefield.plantSnapshots.size,plantRound:window.map02Battle.battlefield.plantRound??null,effects:window.map02Battle.effects.instances.length,sceneVoices:window.map02Battle.effects.skillSound.voices.size,treeVoices:window.map02Battle.effects.sound.voices.size,battleVoices:window.map02Battle.sound.voices.size,running:window.map02Battle.running,inputIntervalActive:!!window.map02Battle.input.interval,world:document.querySelector("#battle-status").dataset.world||null})')));
    for(const row of cleanup)if(Object.entries(row).some(([key,value])=>['plantRound','world'].includes(key)?value!==null:!!value))failures.push(label+' cleanup incomplete');
    evidence.cleanups.push({label,cleanup,environment:await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.map02Environment')))});
  }
  evidence.rounds=[];evidence.cleanups=[];
  const firstSize = modeId === 3 && !lifecycleTailOnly ? [3840, 2160] : [1920, 1080];
  const secondSize = modeId === 3 ? [1920, 1080] : [3840, 2160];
  evidence.roomId=await createJoin();await ready();await resize(...firstSize);
  evidence.initial=await Promise.all(pages.map(page=>world(page.sessionId)));
  for(const initial of evidence.initial)if(initial.mapId!==2||initial.mode!==modeId||initial.players.length!==4||initial.match.scenePlants.length!==29||(modeId===1&&initial.match.sceneObjects.filter(object=>object.id.startsWith('ENV:')).length!==60))failures.push('Map02 full original owner identities missing');
  if(plantRoundResetOnly){
    evidence.scope='Map02 mode2 source327 ordinary NAV contact hidden, one natural OBJECTIVE round, normal Rematch restored root and actual draw, dual normal Leave; no screenshots or new source.';
    const placements=JSON.parse(await readFile('recovery/output/web-assets/scene-placements.json','utf8')).find(value=>value.id==='0002');
    const target=placements.records.find(value=>value.id==='327'&&value.className==='SYcScnObjPlant');
    assert(target,'Source327 placement');
    const goal={x:target.matrix[12],y:target.position[1],z:target.matrix[14]};
    const field=createRoomBattlefield(2),navigation=createOriginalBotNavigation(field);
    let held=new Set();
    async function setKeys(keys){
      for(const code of new Set([...held,...keys])){
        if(held.has(code)===keys.has(code))continue;
        await command('Input.dispatchKeyEvent',{type:keys.has(code)?'keyDown':'keyUp',code,key:code.slice(3).toLowerCase(),windowsVirtualKeyCode:({KeyW:87,KeyA:65,KeyD:68})[code]},host);
      }
      held=keys;
    }
    await nativeClick(host,'#world');
    evidence.plantContactInput=await hideMap02PlantForRoundReset({readWorld:()=>world(host),setKeys,
      focus:()=>command('Page.bringToFront',{},host),findPath:(start,end)=>findBotPath(field,start,end,navigation),goal,modeId});
    if(!evidence.plantContactInput.reached)failures.push('Source327 ordinary contact not reached');
    evidence.plantHidden=await Promise.all(pages.map(page=>world(page.sessionId)));
    const completed=evidence.plantContactInput.reached&&await naturalRound(1,'plant-reset-round1-1920');
    if(completed&&evidence.plantContactInput.reached){
      await aux.rematch(1);
      for(const session of [host,guest]){await waitUntil(session,`document.querySelector('[data-rematch]')?.matches(':enabled')`);await nativeClick(session,'[data-rematch]');}
      for(const page of pages)await waitUntil(page.sessionId,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='PLAYING'&&w.match.round===2})()`);
      await new Promise(resolve=>setTimeout(resolve,5000));await sample('plant-restored-round2');
      evidence.plantRestored=await Promise.all(pages.map(page=>world(page.sessionId)));
    }
    evidence.plantRoundReset=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.plantRoundReset')));
    evidence.plantContact=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.plantContact')));
    evidence.plantResetSummary=evidence.plantRoundReset.map(summarizeMap02PlantRoundReset);
    if(evidence.plantResetSummary.some(value=>!value.hiddenToVisibleRootObserved))failures.push('Dual source327 hidden to new-round visible root missing');
    if(!evidence.plantResetSummary[0].actualRestoredDrawObserved)failures.push('Host source327 new-round actual draw missing');
  }else if(lifecycleTailOnly){
    evidence.scope='Map02 mode3 ordinary1920 entry/input/normalLeave/newroom reentry/Leave tail; prior two natural rounds and actual4K evidence remain separate. No active state injection or new screenshots.';
    await stage('normal-entry-1920');await autopilot();
    await new Promise(resolve=>setTimeout(resolve,5000));await sample('normal-entry');
  }else{
  const completed=await naturalRound(1,'round1-'+firstSize[0]);
  if(completed){
    await aux.rematch(1);
    for(const session of [host,guest]){await waitUntil(session,`document.querySelector('[data-rematch]')?.matches(':enabled')`);await nativeClick(session,'[data-rematch]');}
    for(const page of pages)await waitUntil(page.sessionId,`(()=>{const w=JSON.parse(document.querySelector('#battle-status').dataset.world);return w.phase==='PLAYING'&&w.match.round===2})()`);
    evidence.round2Initial=await Promise.all(pages.map(page=>world(page.sessionId)));
    await resize(...secondSize);await naturalRound(2,'round2-'+secondSize[0]);
  }
  }
  await leave(plantRoundResetOnly?'plant-reset':lifecycleTailOnly?'normal-entry':'two-rounds');
  await aux.disconnect();aux=undefined;
  if(!plantRoundResetOnly){
  await resize(1920,1080);await stage('reentry');evidence.reentryRoomId=await createJoin();await ready();
  await new Promise(resolve=>setTimeout(resolve,5000));await sample('reentry');if(!lifecycleTailOnly)await capture('reentry-playing');
  evidence.reentry=await Promise.all(pages.map(page=>world(page.sessionId)));
  await leave('reentry');
  }
  evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.map02Session')));
  evidence.environment=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.map02Environment')));
  evidence.renderTiming=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.map02RenderTiming')));
  if(evidence.consistency.mismatches.length)failures.push('Common-tick authoritative players/match differ');
  if(!lifecycleTailOnly&&!plantRoundResetOnly&&evidence.rounds.length!==2)failures.push('Two natural rounds coverage missing');
  if(lifecycleTailOnly&&!evidence.consistency.commonTicks)failures.push('Normal entry/reentry common ticks missing');
  evidence.failures=failures;evidence.status=failures.length?'INCOMPLETE':'PASS';
  console.log(evidence.status+': '+output+'.json');
}catch(error){
  evidence.status='FAIL';evidence.error=String(error);
  if(ws)evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.map02Session').catch(e=>({error:String(e)}))));
  if(ws){
    if(plantRoundResetOnly){
      evidence.plantRoundReset=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.plantRoundReset').catch(e=>({error:String(e)}))));
      evidence.plantContact=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.plantContact').catch(e=>({error:String(e)}))));
    }
    evidence.environment=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.map02Environment').catch(e=>({error:String(e)}))));
    evidence.renderTiming=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.map02RenderTiming').catch(e=>({error:String(e)}))));
    evidence.canvasAtFailure=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({viewport:[innerWidth,innerHeight],client:[document.querySelector('#world').clientWidth,document.querySelector('#world').clientHeight],backbuffer:[window.map02Battle.scene.getEngine().getRenderWidth(),window.map02Battle.scene.getEngine().getRenderHeight()]})`).catch(e=>({error:String(e)}))));
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
  await writeFile('recovery/output/map02-full-session-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
