import {connectBreachAuxiliary} from './helpers/breach-auxiliary.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {DatabaseSync, backup} from 'node:sqlite';
import {AccountStore} from '../apps/server/src/account-store.ts';
const WebSocket=createRequire(import.meta.url)('ws');
const mapId=7;
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const output='recovery/output/browser-tank-benefit-text-'+runId;
const directory=await mkdtemp(join(tmpdir(),'cdtank-tank-benefit-text-'));
const database=join(directory,'accounts.sqlite');
let server,chrome,vite,ws,store,aux,guestAccountId;
const pages=[],contexts=[];
const evidence={status:'RUNNING',ports:{server:3575,vite:5605,cdp:9805},mapId,ammo:2001,
  scope:'New selector0 Benefit text from the same-actor snapshot HP observer only. Ordinary map7/mode4, Arrow/Space injury then native guest Digit5 feed. Original pre-room tank/pet and already-owned feed fixture explicit; no active HP/event/position/clock injection. Original Damage/effects/audio accepted scope reused.'};
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
  const env={...process.env,PORT:'3575',ACCOUNT_DB_PATH:database,MATCH_TIME_LIMIT_SECONDS:'60'};delete env.MATCH_MIN_PLAYERS;
  let log='';server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],{env,stdio:['ignore','pipe','pipe']});
  for(const stream of [server.stdout,server.stderr])stream.on('data',d=>{log+=String(d);});
  const deadline=Date.now()+15000;while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5605,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3575',ws:true,rewrite:()=> '/'}}}});await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',[
    '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required','--remote-debugging-port=9805',
    `--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;for(let i=0;i<100;i++){try{endpoint=(await(await fetch('http://127.0.0.1:9805/json/version')).json()).webSocketDebuggerUrl;break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert(endpoint,'Chromium9805');ws=new WebSocket(endpoint);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
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
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5605',browserContextId});
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
    if(index===1){guestAccountId=account.accountId;store.replaceInventory(account.accountId,[{
      instanceId:77,itemTableId:1,ownedQuantity:1,battleQuantity:0,state:0,
      field8:0,float24Bits:0,float28Bits:0,float2cBits:0,
    }]);evidence.feedFixture={accountId:account.accountId,instanceId:77,itemTableId:1,ownedQuantity:1,scope:'Explicit already-obtained pre-room inventory migration fixture; no purchase claim'};}

    const bytes=new Uint8Array(0x170),view=new DataView(bytes.buffer);view.setUint32(0xa8,72,true);view.setUint32(0xa4,base.fields.get(0),true);store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
  }
  store.close();store=undefined;
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  for(const page of pages){await nativeClick(page.sessionId,'[data-room-card-home]');await waitUntil(page.sessionId,`document.querySelector('#home-inventory[open] [data-source-control="btnClose"]')`);if(page.sessionId===guest){
    await nativeClick(guest,'[data-source-control="rdoItem"]');
    await waitUntil(guest,`document.querySelector('[data-inventory-instance="77"]')`);
    evidence.homeFeedRow=await evaluate(guest,`(()=>{const row=document.querySelector('[data-inventory-instance="77"]');return {text:row.textContent,quantity:row.querySelector('[data-home-item-row-quantity]')?.textContent}})()`);
    await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
    assert.equal(evidence.homeFeedRow.quantity?.trim(),'1','Same inventory row independent quantity');
    await nativeClick(guest,'[data-inventory-instance="77"]');await nativeClick(guest,'[data-kitbag-slot="4"]');
    await waitUntil(guest,`document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='77'`);
  }
  await nativeClick(page.sessionId,'[data-home-close]');await waitUntil(page.sessionId,`!document.querySelector('#home-inventory[open]')`);}
  await nativeClick(host,'[data-room-card-create]');await waitUntil(host,`document.querySelector('[data-map-selector-mode="4"]')`);await nativeClick(host,'[data-map-selector-mode="4"]');await nativeClick(host,`[data-map-selector-map="${mapId}"]`);await nativeClick(host,'[data-map-selector-confirm]');await waitUntil(host,`document.querySelector('[data-room-create-confirm]')`);await nativeClick(host,'[data-room-create-confirm]');
  await waitUntil(host,`document.querySelector('#battle-status')?.dataset.world`);
  const roomId=await evaluate(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).roomId`);
  await waitUntil(guest,`document.querySelector('[data-room-card-id="${roomId}"]')&&!document.querySelector('[data-room-card-id="${roomId}"]').disabled`);
  const joinPoint=await evaluate(guest,`(()=>{const r=document.querySelector('[data-room-card-id="${roomId}"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await command('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:2,...joinPoint},guest);await command('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:2,...joinPoint},guest);
  await waitUntil(guest,`document.querySelector('#battle-status')?.dataset.world`);
  aux=await connectBreachAuxiliary('ws://127.0.0.1:3575',roomId,2);
  evidence.auxiliaryPlayers=aux.members.map(m=>({playerId:m.playerId,accountId:m.accountId}));
  await aux.ready(1);
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.renderedPlayers===4})()`);

  for(const page of pages)await evaluate(page.sessionId,`(async()=>{
    const source=await(await fetch('/src/render/scene-runtime.ts')).text();
    const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);
    const engine=EngineStore.Instances.find(e=>e.getRenderingCanvas()===document.querySelector('#world')),scene=engine.scenes[0];
    engine.setHardwareScalingLevel(2);engine.resize();window.actorTextScene=scene;
    window.actorText={events:[],hpSnapshots:[],benefitCalls:[],shows:[],records:[],releases:[],expirations:[],draws:[],captures:{},frame:0};
    const {Battle}=await import('/src/match/battle.ts');
    const reconcile=Battle.prototype.reconcile;Battle.prototype.reconcile=function(...args){window.actorTextBattle=this;
      if(!this.actorTextObserver){this.actorTextObserver=true;this.client.listenMsg('RoomEvent',event=>{if(event.roomId===this.roomFeed.roomId&&(event.type==='hit'||event.type==='playerHealed'))window.actorText.events.push({...event});});}
      return reconcile.apply(this,args);};
    const {BattlePlayers}=await import('/src/render/battle-players.ts');
    const playerReconcile=BattlePlayers.prototype.reconcile;
    BattlePlayers.prototype.reconcile=function(players,localPlayerId){
      const previousContext=window.actorTextSnapshot;
      const snapshot=players.map(player=>({targetId:player.id,currentHP:player.hp,cachedHP:this.previousHp.get(player.id)??null,isLocal:player.id===localPlayerId}));
      window.actorText.hpSnapshots.push({frame:window.actorText.frame,players:snapshot});
      window.actorTextSnapshot=snapshot;
      try{return playerReconcile.call(this,players,localPlayerId);}finally{window.actorTextSnapshot=previousContext;}
    };
    const benefit=BattlePlayers.prototype.benefit;
    BattlePlayers.prototype.benefit=function(id,increase,isLocal){
      const hp=window.actorTextSnapshot?.find(player=>player.targetId===id);
      const context={targetId:id,increase,isLocal,hp,frame:window.actorText.frame};window.actorText.benefitCalls.push(context);
      const previous=window.actorTextTarget;window.actorTextTarget=context;
      try{return benefit.call(this,id,increase,isLocal);}finally{window.actorTextTarget=previous;}
    };
    const {TankBenefitText}=await import('/src/assets/tanks/tank-benefit-text.ts');
    const show=TankBenefitText.prototype.show;
    TankBenefitText.prototype.show=function(x,y,increase,isLocal){
      const row={x,y,increase,isLocal,targetId:window.actorTextTarget?.targetId,hp:window.actorTextTarget?.hp,frame:window.actorText.frame};window.actorText.shows.push(row);
      window.actorTextCurrent=row;try{return show.call(this,x,y,increase,isLocal);}finally{window.actorTextCurrent=undefined;}
    };
    const advance=TankBenefitText.prototype.advance;
    TankBenefitText.prototype.advance=function(delta,viewZ){const previous=this.records.map(record=>({...record}));const result=advance.call(this,delta,viewZ);
      for(const record of previous)if(!this.records.some(next=>next.handle===record.handle))window.actorText.expirations.push({handle:record.handle,elapsedBefore:record.elapsed,delta,viewZ,frame:window.actorText.frame});return result;};
    const {TankBenefitTextRenderer}=await import('/src/render/tank-benefit-text-renderer.ts');
    const create=TankBenefitTextRenderer.prototype.create;
    TankBenefitTextRenderer.prototype.create=function(text){const handle=create.call(this,text);this.observedActorText??=new Map();
      if(window.actorTextCurrent)this.observedActorText.set(handle,{text,showX:window.actorTextCurrent.x,showY:window.actorTextCurrent.y,...window.actorTextCurrent});return handle;};
    const draw=TankBenefitTextRenderer.prototype.draw;
    TankBenefitTextRenderer.prototype.draw=function(record,viewport){draw.call(this,record,viewport);const identity=this.observedActorText?.get(record.handle);if(!identity)return;
      const sample={...identity,...record,viewport:{...viewport},frame:window.actorText.frame};window.actorText.records.push(sample);
      for(const {mesh,material,resource}of this.draws.get(record.handle)??[]){mesh.actorTextSample={...sample,codepoint:resource.glyph.codepoint,asset:resource.glyph.asset};
        if(mesh.actorTextObserved)continue;mesh.actorTextObserved=true;
        mesh.onBeforeRenderObservable.add(()=>window.actorText.draws.push({...mesh.actorTextSample,positions:mesh.getVerticesData('position'),indices:mesh.getIndices(),texture:material.getActiveTextures()[0]?.url}));
      }
    };
    const release=TankBenefitTextRenderer.prototype.release;
    TankBenefitTextRenderer.prototype.release=function(handle){const identity=this.observedActorText?.get(handle);if(identity)window.actorText.releases.push({handle,...identity,frame:window.actorText.frame});return release.call(this,handle);};
    scene.onAfterRenderObservable.add(()=>{const row=window.actorText.draws.filter(d=>d.frame===window.actorText.frame).at(-1);
      if(row){const stage=row.elapsed<.5?'early':row.elapsed<.75?'fade':'late';if(!window.actorText.captures[stage])window.actorText.captures[stage]={frame:window.actorText.frame,text:row.text,isLocal:row.isLocal,elapsed:row.elapsed,alpha:row.alpha,canvas:engine.getRenderingCanvas().toDataURL('image/png')};}
      window.actorText.frame++;
    });
  })()`);
  for(const session of [guest,host]){await waitUntil(session,`document.querySelector('[data-waiting-ready]')?.matches(':enabled')`);await nativeClick(session,'[data-waiting-ready]');}
  for(const page of pages)await waitUntil(page.sessionId,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
  evidence.fixture='Original tank1/pet1 pre-room records; four authenticated Ready players. Host ordinary native Arrow aim and Space until first guest HP reduction then guest native Digit5 on equipped pre-room feed1, other accounts normal idle; configured60s limit, no active clock or state adjustment.';
  const world=session=>evaluate(session,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  evidence.initial=await Promise.all(pages.map(page=>world(page.sessionId)));
  evidence.inputs=[];
  let held=new Set();
  async function setKeys(keys){for(const code of new Set([...held,...keys])){if(held.has(code)===keys.has(code))continue;await command('Input.dispatchKeyEvent',{type:keys.has(code)?'keyDown':'keyUp',code,key:code==='Space'?' ':code,windowsVirtualKeyCode:{Space:32,ArrowLeft:37,ArrowRight:39}[code]},host);}held=keys;}
  await nativeClick(host,'#world');
  const targetId=evidence.initial[1].playerId;
  const inputDeadline=Date.now()+25000;
  const initialTargetHP=evidence.initial[1].players.find(player=>player.id===targetId).hp;
  while(Date.now()<inputDeadline){
    const current=await world(host),me=current.players.find(player=>player.id===current.playerId),target=current.players.find(player=>player.id===targetId);
    if(current.phase!=='PLAYING'||!me||!target)break;
    const bearing=Math.atan2(target.x-me.x,target.z-me.z),error=Math.atan2(Math.sin(bearing-me.yaw-me.aim),Math.cos(bearing-me.yaw-me.aim)),distance=Math.hypot(target.x-me.x,target.z-me.z);
    const keys=new Set();
    if(me.alive&&target.alive){if(Math.abs(error)>.035)keys.add(error>0?'ArrowLeft':'ArrowRight');if(Math.abs(error)<.06&&distance<950)keys.add('Space');}
    evidence.inputs.push({tick:current.tick,actor:me.id,target:target.id,x:me.x,z:me.z,yaw:me.yaw,aim:me.aim,targetHP:target.hp,targetAlive:target.alive,distance,error,keys:[...keys]});
    await setKeys(keys);
    if(target.hp<initialTargetHP){evidence.firstHitWorld=current;break;}
    await new Promise(resolve=>setTimeout(resolve,120));
  }
  await setKeys(new Set());
  evidence.beforeHealing=await Promise.all(pages.map(page=>world(page.sessionId)));
  // Save the ordinary injury and selected-item checkpoint before any healing assertions.
  store=new AccountStore(database);evidence.feedBefore=store.inventory(guestAccountId).records;store.close();store=undefined;
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  assert(evidence.firstHitWorld,'Ordinary injury must precede treatment');
  const injured=evidence.beforeHealing[1].players.find(player=>player.id===targetId);
  assert(injured.alive&&injured.hp>0&&injured.hp<injured.maxHp,'Living naturally injured guest');
  evidence.beforeHealingShows=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.actorText.shows.length')));
  assert.deepEqual(evidence.beforeHealingShows,[0,0],'No Benefit text from first/equal/decreasing HP snapshots');
  await nativeClick(guest,'#world');
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'5',code:'Digit5',windowsVirtualKeyCode:53},guest);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'5',code:'Digit5',windowsVirtualKeyCode:53},guest);
  evidence.healingInput={actorId:targetId,code:'Digit5',inventoryInstance:77,itemTableId:1};
  await waitUntil(guest,`window.actorText.benefitCalls.some(call=>call.targetId===${JSON.stringify(targetId)}&&call.hp?.cachedHP>0&&call.hp.currentHP>call.hp.cachedHP&&call.increase===call.hp.currentHP-call.hp.cachedHP)`);
  await new Promise(resolve=>setTimeout(resolve,1800));
  evidence.afterInputs=await Promise.all(pages.map(page=>world(page.sessionId)));
  store=new AccountStore(database);evidence.feedAfter=store.inventory(guestAccountId).records;store.close();store=undefined;
  evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.actorText')));
  const failures=[];
  if(!evidence.firstHitWorld)failures.push('Ordinary input did not reduce target HP');
  for(const [index,row]of evidence.observed.entries()){
    for(const [stage,capture]of Object.entries(row.captures)){
      const path=output+'-'+stage+'-'+(index+1)+'.png';
      await writeFile(path,Buffer.from(capture.canvas.split(',')[1],'base64'));delete capture.canvas;capture.path=path;
    }
    if(row.shows.length!==1||!row.shows.every(show=>show.increase>0&&show.isLocal===(index===1)))failures.push('side'+index+' one qualified Benefit text/local identity missing');
    if(!row.draws.some(draw=>draw.text==='+'+draw.increase&&draw.codepoint>=48&&draw.codepoint<=57&&draw.asset.startsWith('ui/regions/9/')))failures.push('side'+index+' original Benefit digit draw missing');
    if(row.draws.some(draw=>draw.codepoint===43))failures.push('side'+index+' fabricated plus glyph');
    if(!row.releases.length||!row.expirations.some(expiry=>expiry.elapsedBefore+Math.fround(expiry.delta)>=1))failures.push('side'+index+' natural one-second text expiry missing');
    if(row.records.some(record=>record.targetId!==targetId||record.isLocal!==(index===1)))failures.push('side'+index+' draw local ownership mismatch');
    if(row.records.some(record=>Math.abs(record.y-(record.showY-(record.isLocal?100:0)-record.elapsed*40))>.01||record.x!==record.showX))failures.push('side'+index+' original captured upward Y/fixed X/local offset mismatch');
    if(!Object.keys(row.captures).length)failures.push('side'+index+' callback canvas missing');
    for(const call of row.benefitCalls){const hp=call.hp;
      if(!hp||hp.targetId!==targetId||hp.cachedHP===null||hp.cachedHP===0||hp.currentHP<=hp.cachedHP||call.increase!==hp.currentHP-hp.cachedHP||hp.isLocal!==call.isLocal)failures.push('side'+index+' same snapshot current/cached HP ownership mismatch');
    }
    if(row.benefitCalls.length!==1||row.shows.some(show=>!row.benefitCalls.some(call=>call.targetId===show.targetId&&call.increase===show.increase)))failures.push('side'+index+' HP observer enqueue linkage missing');
  }
  if(JSON.stringify(evidence.observed[0].shows.map(row=>row.increase))!==JSON.stringify(evidence.observed[1].shows.map(row=>row.increase)))failures.push('Dual Benefit increase differs');
  if(evidence.feedBefore.find(row=>row.instanceId===77)?.ownedQuantity!==1||evidence.feedAfter.find(row=>row.instanceId===77)?.ownedQuantity!==0)failures.push('Ordinary equipped feed consumption 1 to 0 missing');
  for(const page of pages){
    const selector=await evaluate(page.sessionId,`document.querySelector('[data-leave-room]')?'[data-leave-room]':document.querySelector('[data-summary-leave]')?'[data-summary-leave]':null`);
    assert(selector,'Formal battle or summary Leave exists');await nativeClick(page.sessionId,selector);
    await waitUntil(page.sessionId,`!document.querySelector('#battle-status')?.dataset.world`);
  }
  await aux.leave(1);
  evidence.cleanup=await Promise.all(pages.map(page=>evaluate(page.sessionId,`({world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null'),textMeshes:window.actorTextScene.meshes.filter(mesh=>mesh.name==='castle-damage-text-glyph').length,textMaterials:window.actorTextScene.materials.filter(material=>material.name==='castle-damage-text').length,textTextures:window.actorTextScene.textures.filter(texture=>(texture.url?.includes('/ui/regions/8/')||texture.url?.includes('/ui/regions/9/'))).length})`)));
  for(const [index,row]of evidence.cleanup.entries())if(row.world!==null||row.textMeshes!==0||row.textMaterials!==0||row.textTextures!==0)failures.push('side'+index+' normal Leave text cleanup incomplete');
  evidence.failures=failures;evidence.status=failures.length?'INCOMPLETE':'PASS_FINITE_ACTOR_BENEFIT_TEXT_NORMAL_LEAVE';console.log(evidence.status+': '+output+'.json');
}catch(error){
  evidence.status='FAIL';evidence.error=String(error);
  if(ws){
    evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,'window.actorText').catch(error=>({error:String(error)}))));
    evidence.failureLeave=[];
    for(const page of pages){
      try{
        const selector=await evaluate(page.sessionId,`document.querySelector('[data-leave-room]')?'[data-leave-room]':document.querySelector('[data-summary-leave]')?'[data-summary-leave]':null`);
        if(selector){await nativeClick(page.sessionId,selector);await waitUntil(page.sessionId,`!document.querySelector('#battle-status')?.dataset.world`,15000);}
        evidence.failureLeave.push(await evaluate(page.sessionId,`({selector:${JSON.stringify(selector)},world:JSON.parse(document.querySelector('#battle-status')?.dataset.world||'null')})`));
      }catch(leaveError){evidence.failureLeave.push({error:String(leaveError)});}
    }
  }
  throw error;
}
finally{
  store?.close();store=undefined;
  try{const db=new DatabaseSync(database,{readOnly:true});try{await backup(db,output+'-checkpoint.sqlite');evidence.savedCheckpoint=output+'-checkpoint.sqlite';}finally{db.close();}}catch(error){evidence.checkpointSaveError=String(error);}
  await writeFile(output+'.json',JSON.stringify(evidence,null,2)+'\n');
  store?.close();if(ws){for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
  await aux?.disconnect();await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  await writeFile('recovery/output/tank-benefit-text-process-cleanup.json',JSON.stringify({status:'PASS',ports:evidence.ports,tempDirectory:directory,removed:true,serverExit:server?.exitCode,serverSignal:server?.signalCode,chromeExit:chrome?.exitCode,chromeSignal:chrome?.signalCode},null,2)+'\n');
}
