import {connectBreachAuxiliary} from './helpers/breach-auxiliary.mjs';
import {installSceneCastle02Observer} from './observers/scene-castle02-305-browser.mjs';
import {createRoomBattlefield} from '../apps/server/src/battlefield.ts';
import {createOriginalBotNavigation} from '../apps/server/src/battle/cpu/original-navigation.ts';
import {findBotPath} from '../apps/server/src/battle/cpu/navigation.ts';
import {createSceneObjects, syncSceneObjectCollision} from '../apps/server/src/battle/environment.ts';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
var WebSocket=createRequire(import.meta.url)('ws');
var mapId=2;
var modeId=Number(process.env.MAP02_SESSION_MODE??1);
assert([1,2,3].includes(modeId),'Original Map02 legal mode');
var runId=new Date().toISOString().replace(/[:.]/g,'-');
var output='recovery/output/browser-castle02-305-'+runId;
var directory=await mkdtemp(join(tmpdir(),'cdtank-castle02-305-'));
var database=join(directory,'accounts.sqlite');
var server,chrome,vite,ws,store,aux;
var pages=[],contexts=[];
var evidence={status:'RUNNING',ports:{server:3597,vite:5627,cdp:9827},mapId:2,modeId:1,ammo:2001,sourcePlacementId:'305',scope:'Original Map02/mode1 four authenticated accounts; explicit pre-room native tank1/pet1 fixture. Ordinary navigation, aim and Space into source305 HP2000, c2/n2/c3 actual state and normal Leave. No active position/HP/event/clock/score/camera injection; no prior304 source or runtime replay.'};
async function stop(child){if(child?.exitCode===null&&child.signalCode===null){var done=new Promise(r=>child.once('exit',r));child.kill();await done;}}
var sequence = 0;
var pending = new Map();
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    var id = ++sequence;
    pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, sessionId}));
  });
}
async function evaluate(session, expression) {
  var result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}, session);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitUntil(session, expression, timeout = 45000) {
  var deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      return await evaluate(session, `(async()=>{var deadline=Date.now()+${timeout};while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#room-map-info')?.value+' tanks='+document.querySelector('#tank')?.options.length+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
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
  var point = await evaluate(session, `(()=>{var e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});var r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await command('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',clickCount:1,...point}, session);
  await command('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',clickCount:1,...point}, session);
}
async function nativeSelect(session, selector, value) {
  var index = await evaluate(session, `Array.from(document.querySelector(${JSON.stringify(selector)}).options).filter(o=>!o.disabled).findIndex(o=>o.value===${JSON.stringify(String(value))})`);
  assert(index >= 0, `${selector} option ${value}`);
  await nativeClick(session, selector);
  var press = async (key, code, windowsVirtualKeyCode) => {
    await command('Input.dispatchKeyEvent', {type:'keyDown',key,code,windowsVirtualKeyCode}, session);
    await command('Input.dispatchKeyEvent', {type:'keyUp',key,code,windowsVirtualKeyCode}, session);
  };
  await press('Home', 'Home', 36);
  for(var step=0;step<index;step++)await press('ArrowDown', 'ArrowDown', 40);
  await press('Enter', 'Enter', 13);
  await waitUntil(session, `document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(String(value))}`);
  assert.equal(await evaluate(session, `document.querySelector(${JSON.stringify(selector)}).value`), String(value));
}
try {
  var env={...process.env,PORT:'3597',ACCOUNT_DB_PATH:database};delete env.MATCH_MIN_PLAYERS;delete env.MATCH_TIME_LIMIT_SECONDS;
  var log='';server=spawn(process.execPath,['scripts/start-server.mjs'],{env,stdio:['ignore','pipe','pipe']});
  for(var stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  var deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',cacheDir:join(directory,'vite-cache'),publicDir:'../../recovery/output/web-assets',server:{port:5627,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3597',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9827',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  var endpoint;for(var i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9827/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9827');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
ws.on('message', raw => {
  var message = JSON.parse(String(raw));
  var callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});

  for(var index=0;index<2;index++){
    var {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    var {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5627',browserContextId});
    var {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('[data-room-card-create]')&&localStorage.getItem('cdtank-account-token')`);

  }
  store=new AccountStore(database);var native=JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(r=>r.tankId===1&&r.part===0);
  for(var [index,page]of pages.entries()){
    var account=store.open(await evaluate(page.sessionId,`localStorage.getItem('cdtank-account-token')`));
    var fields=v=>new Map(Object.entries(v).map(([k,v])=>[Number(k),v]));
    var equipment={name:'明确导入原战车',fields:fields(native.equipment)},base={name:'明确导入原宠物',fields:fields(native.base)};
    equipment.fields.set(0x1c,72);equipment.fields.set(0x24,1);equipment.fields.set(0x28,index?10021:10011);equipment.fields.set(0x2c,index?10022:10012);equipment.fields.set(0x30,index?10023:10013);
    store.replaceRoleRecords(account.accountId,{base:[base],equipment:[equipment]});

    var bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa8,72,true);view.setUint32(0xa4,base.fields.get(0),true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
  }
  store.close();store=undefined;
  var host=pages[0].sessionId,guest=pages[1].sessionId;
  for(var page of pages){await nativeClick(page.sessionId,'[data-room-card-home]');await waitUntil(page.sessionId,`document.querySelector('#home-inventory[open] [data-source-control="btnClose"]')`);await nativeClick(page.sessionId,'[data-home-close]');await waitUntil(page.sessionId,`!document.querySelector('#home-inventory[open]')`);}
  for(var page of pages){
    await evaluate(page.sessionId,'('+installSceneCastle02Observer.toString()+')()');
  }

  var failures=[];
  var world=session=>evaluate(session,"JSON.parse(document.querySelector('#battle-status').dataset.world)");
  async function createJoin(){
    await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="${modeId}"]')`);await nativeClick(host,'[data-map-selector-mode="'+modeId+'"]');await nativeClick(host,'[data-map-selector-map="2"]');await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')?.matches(':enabled')`);await nativeClick(host,'[data-room-create-confirm]');
    await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
    var roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
    await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
    var point=await evaluate(guest,`(()=>{var r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...point},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...point},guest);
    await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
    aux=await connectBreachAuxiliary('ws://127.0.0.1:3597',roomId,2);
    evidence.auxiliaryPlayers??=[];evidence.auxiliaryPlayers.push(aux.members.map(m=>({playerId:m.playerId,accountId:m.accountId})));
    return roomId;
  }
  async function ready(){
    await aux.ready((await world(host)).match.round);
    for(var page of pages)await waitUntil(page.sessionId,`(()=>{var s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4&&document.querySelector('[data-waiting-ready]')?.matches(':enabled')})()`,90000);
    for(var session of [guest,host])await nativeClick(session,'[data-waiting-ready]');
    for(var page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`,90000);
  }

  evidence.roomId=await createJoin();await ready();
  evidence.initial=await Promise.all(pages.map(page=>world(page.sessionId)));
  var target=evidence.initial[0].match.sceneObjects.find(value=>value.id==='CASTLE:305');
  assert(target&&target.maxHp===2000&&target.hp===2000,'Original source305 authority');
  evidence.target=target;
  evidence.entry=JSON.parse(await readFile('recovery/output/scene-castle02-305-entry-prepared.json','utf8'));
  assert(evidence.entry.selected,'Prepared normal route and shot line');
  var goal=evidence.entry.selected.goal;
  var field=createRoomBattlefield(2);
  syncSceneObjectCollision({map:{mapId:2},battlefield:field,sceneObjects:createSceneObjects({mode:1,map:{mapId:2}})},0);
  var navigation=createOriginalBotNavigation(field);
  var held=new Set();
  async function setKeys(keys){
    for(var code of new Set([...held,...keys])){
      if(held.has(code)===keys.has(code))continue;
      await command('Input.dispatchKeyEvent',{type:keys.has(code)?'keyDown':'keyUp',code,key:code==='Space'?' ':code.startsWith('Key')?code.slice(3).toLowerCase():code,windowsVirtualKeyCode:({Space:32,KeyW:87,KeyS:83,KeyA:65,KeyD:68,ArrowLeft:37,ArrowRight:39})[code]},host);
    }
    held=keys;
  }
  await nativeClick(host,'#world');
  evidence.inputs=[];
  var deadline=Date.now()+250000,arrived=false,c2Waiting=false,c2Released=false,n2Waiting=false,n2Released=false;
  while(Date.now()<deadline){
    var w=await world(host),me=w.players.find(value=>value.id===w.playerId),object=w.match.sceneObjects.find(value=>value.id==='CASTLE:305');
    if(w.phase!=='PLAYING'||object.hp===0)break;
    var keys=new Set();
    if(me.alive){
      if(!arrived&&Math.hypot(me.x-goal.x,me.z-goal.z)<35)arrived=true;
      if(!arrived){
        var path=findBotPath(field,{x:me.x,y:me.y,z:me.z},goal,navigation);
        var point=path.find(value=>Math.hypot(value.x-me.x,value.z-me.z)>25)??goal;
        var bearing=Math.atan2(point.x-me.x,point.z-me.z),turn=Math.atan2(Math.sin(bearing-me.yaw),Math.cos(bearing-me.yaw));
        if(Math.abs(turn)>.07)keys.add(turn>0?'KeyA':'KeyD');if(Math.abs(turn)<.15)keys.add('KeyW');
      }else{
        var angle=Math.atan2(object.x-me.x,object.z-me.z),error=Math.atan2(Math.sin(angle-me.yaw-me.aim),Math.cos(angle-me.yaw-me.aim));
        if(Math.abs(error)>.05)keys.add(error>0?'ArrowLeft':'ArrowRight');
        var actions=await evaluate(host,'[...new Set(window.castle305.draws.map(row=>row.action))]');
        if(object.hp<Math.trunc(object.maxHp/3)&&!c2Released){
          c2Waiting=true;
          if(actions.includes('c2')){c2Released=true;n2Waiting=true;}
        }else if(n2Waiting&&!n2Released){
          if(actions.includes('n2'))n2Released=true;
          else if(Math.abs(error)<.05)keys.add('Space');
        }else if(Math.abs(error)<.05)keys.add('Space');
      }
    }
    evidence.inputs.push({tick:w.tick,x:me.x,z:me.z,alive:me.alive,hp:object.hp,arrived,c2Waiting,c2Released,n2Waiting,n2Released,keys:[...keys]});
    await setKeys(keys);await new Promise(resolve=>setTimeout(resolve,120));
  }
  await setKeys(new Set());await new Promise(resolve=>setTimeout(resolve,3500));
  evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.castle305')));
  evidence.finalWorld=await Promise.all(pages.map(page=>world(page.sessionId)));
  var transactions=evidence.observed.map(side=>side.events.filter(event=>['sceneObjectHit','sceneObjectDestroyed'].includes(event.type)));
  if(JSON.stringify(transactions[0])!==JSON.stringify(transactions[1]))failures.push('Dual source305 transactions differ');
  if(!transactions[0].some(event=>event.type==='sceneObjectDestroyed'))failures.push('Ordinary source305 destruction missing');
  for(var action of ['c2','n2','c3'])if(!evidence.observed[0].draws.some(row=>row.action===action))failures.push('Host source305 '+action+' actual draw missing');
  for(var [index,side]of evidence.observed.entries()){
    for(var [action,capture]of Object.entries(side.captures)){
      await writeFile(output+'-'+action+'-'+(index+1)+'.png',Buffer.from(capture.canvas.split(',')[1],'base64'));
      delete capture.canvas;
    }
  }
  await aux.leave((await world(host)).match.round);
  for(var session of [guest,host]){
    await waitUntil(session,`document.querySelector('[data-leave-room], [data-summary-leave]')?.matches(':enabled')`);
    var selector=await evaluate(session,`document.querySelector('[data-summary-leave]')?'[data-summary-leave]':'[data-leave-room]'`);
    await nativeClick(session,selector);await waitUntil(session,`!document.querySelector('#battle-status').dataset.world`);
  }
  evidence.cleanup=await Promise.all(pages.map(page=>evaluate(page.sessionId,'({players:window.castle305Battle.players.size,castles:window.castle305Battle.battlefield.castles.size,effects:window.castle305Battle.effects.instances.length,sceneVoices:window.castle305Battle.effects.skillSound.voices.size,battleVoices:window.castle305Battle.sound.voices.size,world:document.querySelector("#battle-status").dataset.world||null,input:!!window.castle305Battle.input.interval})')));
  evidence.soundsAfterLeave=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.castle305.sounds')));
  if(evidence.cleanup.some(row=>Object.values(row).some(value=>!!value)))failures.push('Normal Leave resources remain');
  evidence.failures=failures;evidence.status=failures.length?'INCOMPLETE':'PASS';
  console.log(evidence.status+': '+output+'.json');
}catch(error){
  evidence.status='FAIL';evidence.error=String(error);
  if(ws)evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.castle305').catch(error=>({error:String(error)}))));
  throw error;
}finally{
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();
  if(ws){for(var page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
  await aux?.disconnect();await vite?.close();await stop(server);await stop(chrome);
  await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  await writeFile('recovery/output/castle02-305-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,chromeExit:chrome?.exitCode},null,2)+'\n');
}
