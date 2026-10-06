import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url), WebSocket = require('ws');
const {WsClient} = require('tsrpc'), {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3183', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-team-life-'));
const database = join(directory, 'accounts.sqlite'), output = 'recovery/output/browser-team-life';
const evidence = {status:'RUNNING',scope:'M4-10-I501 ordinary dual 1080p pages, AccountStore-owned item501 quantity3, home slot4, mode1/map7 CreateRoom/Join/Ready/Digit5; source Effect12/Tag0/SE13 actual rendering/audio, +1 own team life, repeat suppression, restart persistence and ordinary non-mode1 rejection.',isolation:{server:3183,vite:5220,chrome:9290}};
const pages = [], contexts = [], network = [], pending = new Map();
let sequence = 0, server, chrome, vite, ws, store, serverLog = '';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const world = `JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')`;
async function stop(child) {
  if (child?.exitCode === null) {
    const ended = new Promise(resolve => child.once('exit', resolve));
    child.kill(); await ended;
  }
}
async function startServer() {
  let startedLog = '';
  const env = {...process.env, PORT: '3183', ACCOUNT_DB_PATH: database};
  delete env.MATCH_TIME_LIMIT_SECONDS; delete env.MATCH_MIN_PLAYERS;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {env, stdio: ['ignore', 'pipe', 'pipe']});
  const append = data => {startedLog += String(data); serverLog += String(data);};
  server.stdout.on('data', append); server.stderr.on('data', append);
  const deadline = Date.now() + 15000;
  while (!startedLog.includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
  assert(startedLog.includes('Server started'), startedLog);
}
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, {resolve, reject});
    ws.send(JSON.stringify({id, method, params, sessionId}));
  });
}
async function evaluate(session, expression) {
  const result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}, session);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitUntil(session, expression, timeout = 60000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {if (await evaluate(session, expression)) return;} catch (error) {
      if (!String(error).includes('Execution context was destroyed')) throw error;
    }
    await pause(50);
  }
  throw new Error('Browser condition timeout: ' + expression);
}
async function click(session, selector) {
  await command('Page.bringToFront', {}, session);
  const point = await evaluate(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  for (const type of ['mousePressed', 'mouseReleased']) await command('Input.dispatchMouseEvent', {type, button: 'left', clickCount: 1, ...point}, session);
}
async function digit5(session, repeat = false) {
  await click(session, '#world');
  await command('Input.dispatchKeyEvent', {type:'keyDown',key:'5',code:'Digit5',windowsVirtualKeyCode:53}, session);
  if(repeat) for(let i=0;i<5;i++) await command('Input.dispatchKeyEvent', {type:'keyDown',key:'5',code:'Digit5',windowsVirtualKeyCode:53,autoRepeat:true}, session);
  await command('Input.dispatchKeyEvent', {type:'keyUp',key:'5',code:'Digit5',windowsVirtualKeyCode:53}, session);
}
async function press(session, key, code) {
  for(const type of ['keyDown','keyUp']) await command('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:({Home:36,ArrowDown:40,Enter:13})[key]},session);
}
async function select(session, selector, value) {
  const index=await evaluate(session,`[...document.querySelector(${JSON.stringify(selector)}).options].findIndex(o=>o.value===${JSON.stringify(String(value))})`);
  assert(index>=0);
  await click(session,selector);await press(session,'Home','Home');
  for(let i=0;i<index;i++)await press(session,'ArrowDown','ArrowDown');
  await press(session,'Enter','Enter');
  assert.equal(await evaluate(session,`document.querySelector(${JSON.stringify(selector)}).value`),String(value));
}
async function screenshot(session, name) {
  const shot = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`${output}-${name}.png`, Buffer.from(shot.data, 'base64'));
}
async function installMonitor(session) {
  await evaluate(session, `(async()=>{
    const source=await(await fetch('/src/main.ts')).text(),url=source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1];
    const {EngineStore}=await import(url),engine=EngineStore.LastCreatedEngine;
    window.teamLifeObserved={effects:[],sounds:[],events:[],combat:[],notifications:[],frames:0,actualDraws:0,drawSubmissions:0,canvas:[engine.getRenderWidth(),engine.getRenderHeight()],scaling:engine.getHardwareScalingLevel(),viewport:[innerWidth,innerHeight],renderer:engine.getGlInfo()};
    window.teamLifeCamera=EngineStore.LastCreatedScene.activeCamera;EngineStore.LastCreatedScene.onAfterRenderObservable.add(()=>window.teamLifeObserved.frames++);
    const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');
    const {EFFECT_PRIMARY_TAGS}=await import('/src/assets/tanks/effect-tag-matrices.ts');
    const attached=EffectRuntime.prototype.spawnAttachedEffect;
    EffectRuntime.prototype.spawnAttachedEffect=function(view,id,tag,once,local){
      const handle=attached.call(this,view,id,tag,once,local);
      if(id===12){window.teamLifeRuntime=this;const instance=this.instances.find(i=>i.handle===handle);
        window.teamLifeObserved.effects.push({handle,id,tag,once,drawCount:instance?.draws.length??0,rootId:instance?.tree.root.definition.index,treeNodes:instance?.tree.nodes.length,nodeIds:instance?.draws.map(n=>n.node.definition.index),actualTag:EFFECT_PRIMARY_TAGS[tag],parentReferenceMatches:!!instance&&instance.tree.parentMatrix===view.primaryTag(EFFECT_PRIMARY_TAGS[tag])});}
      return handle;
    };
    const sound=EffectRuntime.prototype.playSkillSound;
    EffectRuntime.prototype.playSkillSound=function(view,reference,selector){
      const handle=sound.call(this,view,reference,selector);
      if(reference==='SE13'){window.teamLifeRuntime=this;const voice=this.skillSound.voices.get(handle),row={handle,reference,selector,src:voice?.audio.src,loop:voice?.audio.loop,context:this.skillSound.context?.state,played:false,ended:false};
        voice?.audio.addEventListener('playing',()=>row.played=true);voice?.audio.addEventListener('ended',()=>row.ended=true);window.teamLifeObserved.sounds.push(row);}
      return handle;
    };
    const draw=EffectRuntime.prototype.draw;
    EffectRuntime.prototype.draw=function(instance,node){
      const result=draw.call(this,instance,node);
      if(window.teamLifeObserved.effects.some(e=>e.handle===instance.handle)){
        const meshes=[node.sprite?.mesh,node.particle?.sprite.mesh,node.overlay?.mesh,...(node.model?.meshes??[])].filter(Boolean);
        if(meshes.some(m=>m.isEnabled()&&m.getTotalVertices()>0))window.teamLifeObserved.drawSubmissions++;
        for(const mesh of meshes)if(!mesh.teamLifeMonitor){mesh.teamLifeMonitor=true;mesh.onAfterRenderObservable.add(()=>window.teamLifeObserved.actualDraws++);}
      }
      return result;
    };
    const {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
    Battle.prototype.reconcile=function(...args){window.teamLifeBattle=this;return reconcile.apply(this,args);};
    const {SkillEffectNotifications}=await import('/src/match/skills/skill-effect-notifications.ts'),play=SkillEffectNotifications.prototype.play;
    SkillEffectNotifications.prototype.play=function(value){const result=play.call(this,value);if(value.skillId===501)window.teamLifeObserved.notifications.push({message:value,retained:this.records.length});return result;};
    const {BattleSkillEffects}=await import('/src/match/skills/battle-skill-effects.ts'),event=BattleSkillEffects.prototype.event;
    BattleSkillEffects.prototype.event=function(value){if(value.type==='itemUsed')window.teamLifeObserved.events.push(value);if(value.type==='hit'||value.type==='itemRejected'||value.type==='skillStopped')window.teamLifeObserved.combat.push({event:value,at:Date.now()});return event.call(this,value);};
  })()`);
}
try {
  const catalog=JSON.parse(await readFile('recovery/output/web-assets/combat-catalog.json','utf8'));
  evidence.skillDefinition=catalog.skills.find(row=>row.skillId===501);
  assert.deepEqual(evidence.skillDefinition.functions[0],{type:18,t:0,x:1,y:1,z:0});
  assert.deepEqual(evidence.skillDefinition.effects[0],{effectId:12,sound:'SE13',tag:0,method:3});
  evidence.limitations=['Effect12 includes a source Type4 ww051 audio resource absent from owned files; its existing silent contract is preserved. Recovered independent SE13.wav playing/ended is verified in both pages.'];
  evidence.source={catalog:'recovery/output/web-assets/combat-catalog.json',parameters:'Skill501 Target1/TriggerType1/FuncType18 x1 y1; Effect12/SE13/Tag0',reconstruction:'Self-use eligibility in mode1, transactional owned stock consumption and authoritative own-team life increment are rebuilt rules.'};
  await startServer();
  vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',server:{port:5220,strictPort:true,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3183',ws:true,rewrite:()=> '/'}}}});
  await vite.listen();
  chrome=spawn(process.env.CDTANK_CHROME??'/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome',['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=9290',`--user-data-dir=${join(directory,'chrome')}`,'about:blank'],{stdio:'ignore'});
  let endpoint;
  for(let attempt=0;attempt<100;attempt++){try{endpoint=(await(await fetch('http://127.0.0.1:9290/json/version')).json()).webSocketDebuggerUrl;break;}catch{await pause(50);}}
  assert(endpoint,'Dedicated Chromium started');ws=new WebSocket(endpoint);
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  ws.on('close',()=>{for(const request of pending.values())request.reject(new Error('Browser CDP closed'));pending.clear();});
  ws.on('message',raw=>{
    const message=JSON.parse(String(raw)),callback=pending.get(message.id);
    if(callback){pending.delete(message.id);message.error?callback.reject(new Error(JSON.stringify(message.error))):callback.resolve(message.result);}
    if(!['Network.webSocketFrameReceived','Network.webSocketFrameSent'].includes(message.method)||message.params.response.opcode!==2)return;
    const bytes=new Uint8Array(Buffer.from(message.params.response.payloadData,'base64'));
    if(bytes.length===1&&bytes[0]===0)return;
    const received=message.method.endsWith('Received');let result;
    if(received){const parsed=TransportDataUtil.parseServerOutout(decoder.tsbuffer,decoder.serviceMap,bytes);if(!parsed.isSucc){evidence.decodeError=parsed.errMsg;return;}result=parsed.result;}
    else{
      const envelope=TransportDataUtil.tsbuffer.decode(bytes,'ServerInputData');if(!envelope.isSucc){evidence.decodeError=envelope.errMsg;return;}
      const service=decoder.serviceMap.id2Service[envelope.value.serviceId];
      const payload=decoder.tsbuffer.decode(envelope.value.buffer,service.type==='api'?service.reqSchemaId:service.msgSchemaId);if(!payload.isSucc){evidence.decodeError=payload.errMsg;return;}
      network.push({index:network.length,page:message.sessionId,direction:'sent',name:service.name,kind:service.type,payload:payload.value});return;
    }
    const common={index:network.length,page:message.sessionId,direction:'received',receivedAt:Date.now()};
    if(result.type==='api')network.push({...common,kind:'api',name:result.service.name,success:result.ret.isSucc,response:result.ret.isSucc?result.ret.res:result.ret.err});
    else if(result.service.name==='RoomSnapshot')network.push({...common,kind:'snapshot',...result.msg});
    else if(result.service.name==='RoomEvent')network.push({...common,kind:'event',...result.msg});
  });
  for(let index=0;index<2;index++){
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'about:blank',browserContextId,newWindow:true});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Network.enable',{},sessionId);
    await command('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false},sessionId);
    await command('Page.navigate',{url:'http://127.0.0.1:5220'},sessionId);
    await waitUntil(sessionId,`document.querySelector('#tank')?.options.length===21&&localStorage.getItem('cdtank-account-token')&&!document.querySelector('#create-room')?.disabled`);
    await installMonitor(sessionId);
  }
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  const token=await evaluate(host,`localStorage.getItem('cdtank-account-token')`);
  store=new AccountStore(database);const owner=store.open(token);
  store.replaceInventory(owner.accountId,[{instanceId:77,itemTableId:501,ownedQuantity:3,battleQuantity:0,state:0,field8:0,float24Bits:0,float28Bits:0,float2cBits:0}]);
  const inventory=()=>store.inventory(owner.accountId).records.find(r=>r.instanceId===77);
  evidence.seed={method:'AccountStore-owned inventory before room creation',accountId:owner.accountId,record:inventory()};
  await click(host,'#open-home');await waitUntil(host,`document.querySelector('[data-source-control="rdoItem"]')`);
  await click(host,'[data-source-control="rdoItem"]');await waitUntil(host,`document.querySelector('[data-inventory-instance="77"]')`);
  await click(host,'[data-inventory-instance="77"]');await click(host,'[data-kitbag-slot="4"]');
  await waitUntil(host,`document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='77'`);
  evidence.configured=await evaluate(host,`({text:document.querySelector('[data-inventory-instance="77"]').textContent,slot:document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId})`);
  await screenshot(host,'home-before');await click(host,'[data-home-close]');
  async function round(mode){
    if(!await evaluate(host,`document.querySelector('#create-room-controls').open`))await click(host,'#create-room-controls summary');
    await select(host,'#room-mode',mode);
    await waitUntil(host,`[...document.querySelector('#room-map').options].some(o=>o.value==='7')`);
    await select(host,'#room-map',7);await click(host,'#create-room');
    await waitUntil(host,`(${world})?.mapLoaded&&(${world}).phase==='WAITING'`);
    const initial=await evaluate(host,world);
    await click(guest,'#refresh-rooms');await waitUntil(guest,`[...document.querySelector('#room').options].some(o=>o.value===${JSON.stringify(initial.roomId)})&&!document.querySelector('#join').disabled`);
    await select(guest,'#room',initial.roomId);await click(guest,'#join');
    for(const {sessionId}of pages)await waitUntil(sessionId,`(${world})?.mapLoaded&&(${world}).renderedPlayers===2&&(${world}).renderedActions.length>=2`);
    for(const session of [guest,host]){
      await click(session,'[data-ready]');
      await waitUntil(session,`(${world}).match.readyPlayerIds.includes((${world}).playerId)||(${world}).phase==='PLAYING'`);
    }
    for(const {sessionId}of pages)await waitUntil(sessionId,`(${world}).phase==='PLAYING'`);
    return await evaluate(host,world);
  }
  evidence.beforeCast=await round(1);const playerId=evidence.beforeCast.playerId;
  const team=evidence.beforeCast.players.find(p=>p.id===playerId).team;
  assert.notEqual(evidence.beforeCast.players.find(p=>p.id!==playerId).team,team);
  evidence.battleBefore=await evaluate(host,`window.teamLifeBattle.inventory()`);
  assert.equal(evidence.battleBefore.records.find(r=>r.instanceId===77).ownedQuantity,3);
  assert.equal(evidence.battleBefore.records.find(r=>r.instanceId===77).battleQuantity,2);
  await click(guest,'#world');
  const visibilityDeadline=Date.now()+90000;
  while(Date.now()<visibilityDeadline){
    const observation=await evaluate(guest,`(()=>{const s=${world},view=window.teamLifeBattle.players.get(${JSON.stringify(playerId)}),camera=window.teamLifeCamera;if(!view)return {visible:false};const p=camera.globalPosition,d=camera.getForwardRay().direction,x=view.root.position.x-p.x,y=view.root.position.y-p.y,z=view.root.position.z-p.z;return {visible:!window.teamLifeBattle.effects.clipped(view.root.position)&&(x*d.x+y*d.y+z*d.z)/Math.hypot(x,y,z)>.90,frames:window.teamLifeObserved.frames}})()`);
    if(observation.visible)break;
    await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65},guest);
    await pause(350);await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65},guest);
    await waitUntil(guest,`window.teamLifeObserved.frames>${observation.frames}`);
  }
  assert(Date.now()<visibilityDeadline,'Ordinary guest tank rotation brings host effect into view');
  const frameBefore=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.teamLifeObserved.frames')));
  await Promise.all(pages.map((p,index)=>waitUntil(p.sessionId,`window.teamLifeObserved.frames>${frameBefore[index]+2}`)));
  const beforeUse=network.length;await digit5(host,true);
  await Promise.all(pages.map(({sessionId})=>waitUntil(sessionId,`window.teamLifeObserved.events.filter(e=>e.skillId===501).length===1&&window.teamLifeObserved.actualDraws>0&&window.teamLifeObserved.sounds.some(s=>s.played)`)));
  evidence.observed=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.teamLifeObserved')));
  const eventRows=network.slice(beforeUse).filter(e=>e.kind==='event'&&e.type==='itemUsed'&&e.skillId===501);
  assert.equal(eventRows.length,2);assert.deepEqual({...eventRows[0],page:'',index:0,receivedAt:0},{...eventRows[1],page:'',index:0,receivedAt:0});
  const event=eventRows[0];assert.equal(event.value,1);assert.equal(event.targetId,playerId);
  assert.deepEqual(event.playSkillEffect,{skillId:501,effectIndex:0,duration:0,roleId:Number(playerId.slice(1)),xBits:0,zBits:0});evidence.events=eventRows;
  const expectedLives=evidence.beforeCast.match.teamLives.map((l,i)=>l+(i===team?1:0));
  const updated=network.slice(beforeUse).filter(e=>e.kind==='snapshot'&&JSON.stringify(e.match.teamLives)===JSON.stringify(expectedLives));
  const sameTick=updated.find(a=>updated.some(b=>a.page!==b.page&&a.tick===b.tick));assert(sameTick,'Both wire streams carry the authoritative increment at same tick');
  const counterpart=updated.find(b=>b.page!==sameTick.page&&b.tick===sameTick.tick);
  assert.deepEqual(sameTick.match.teamLives,counterpart.match.teamLives);assert.deepEqual(sameTick.players,counterpart.players);
  evidence.sameTick=[sameTick,counterpart];evidence.afterCast=inventory();assert.equal(inventory().ownedQuantity,2);
  evidence.battleAfter=await evaluate(host,`window.teamLifeBattle.inventory()`);
  assert.equal(evidence.battleAfter.records.find(r=>r.instanceId===77).ownedQuantity,2);assert.equal(evidence.battleAfter.records.find(r=>r.instanceId===77).battleQuantity,1);
  const inputRows=network.slice(beforeUse).filter(e=>e.direction==='sent'&&e.name==='PlayerInput'&&e.payload.useItem===5);
  assert.equal(inputRows.length,1,'Repeated Digit5 keydowns send only one shortcut request');
  evidence.repeat={autoRepeatKeydowns:5,itemUsedPerPage:evidence.observed.map(r=>r.events.length),inventory:inventory(),useInputRows:inputRows};
  for(const row of evidence.observed){
    assert.deepEqual(row.viewport,[1920,1080]);assert.deepEqual(row.canvas,[1920,1080]);assert.equal(row.scaling,1);assert(row.actualDraws>0);assert(row.drawSubmissions>0);
    assert(row.effects.some(e=>e.id===12&&e.handle>0&&e.drawCount===8&&e.treeNodes===11&&e.actualTag==='tag_efcenter'&&e.parentReferenceMatches));
    assert(row.sounds.some(s=>s.reference==='SE13'&&s.handle>0&&s.context==='running'&&!s.loop&&s.played));
    assert.deepEqual(row.notifications,[{message:event.playSkillEffect,retained:0}]);
  }
  for(const [index,page]of pages.entries())await screenshot(page.sessionId,`active-${index+1}`);
  await Promise.all(pages.map(({sessionId})=>waitUntil(sessionId,`window.teamLifeObserved.sounds.some(s=>s.ended)&&window.teamLifeRuntime.skillSound.voices.size===0&&!window.teamLifeRuntime.instances.some(i=>window.teamLifeObserved.effects.some(e=>e.handle===i.handle))`,20000)));
  evidence.naturalCleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({sounds:window.teamLifeObserved.sounds,instances:window.teamLifeRuntime.instances.filter(i=>window.teamLifeObserved.effects.some(e=>e.handle===i.handle)).length,voices:window.teamLifeRuntime.skillSound.voices.size})`)));
  async function leave(){for(const {sessionId}of pages){await click(sessionId,'#leave');await waitUntil(sessionId,`!document.querySelector('#battle-status').dataset.world`);}}
  await leave();evidence.cleanup=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({instances:window.teamLifeRuntime.instances.length,voices:window.teamLifeRuntime.skillSound.voices.size})`)));
  for(const row of evidence.cleanup)assert.deepEqual(row,{instances:0,voices:0});
  store.close();store=undefined;await stop(server);await startServer();
  for(const {sessionId}of pages){await command('Page.reload',{},sessionId);await waitUntil(sessionId,`!window.teamLifeObserved&&document.querySelector('#tank')?.options.length===21&&!document.querySelector('#create-room')?.disabled`);await installMonitor(sessionId);}
  assert.equal(await evaluate(host,`localStorage.getItem('cdtank-account-token')`),token);store=new AccountStore(database);
  await click(host,'#open-home');await waitUntil(host,`document.querySelector('[data-source-control="rdoItem"]')`);await click(host,'[data-source-control="rdoItem"]');
  await waitUntil(host,`document.querySelector('[data-inventory-instance="77"]')?.textContent.includes('×2')&&document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='77'`);
  evidence.restart=await evaluate(host,`({text:document.querySelector('[data-inventory-instance="77"]').textContent,slot:document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId})`);
  assert.equal(inventory().ownedQuantity,2);await screenshot(host,'restart-home');await click(host,'[data-home-close]');
  evidence.rejectedBefore=await round(4);const rejectFrom=network.length;await digit5(host);
  await waitUntil(host,`document.querySelector('[data-source-control="edtBattleInfo"]')?.textContent.includes('1UP仅可在团队模式使用')`);
  await Promise.all(pages.map(({sessionId})=>waitUntil(sessionId,`window.teamLifeObserved.combat.some(r=>r.event.type==='itemRejected')`)));
  evidence.rejectedStatus=await evaluate(host,`document.querySelector('[data-source-control="edtBattleInfo"]').textContent`);
  evidence.rejectedEvents=network.slice(rejectFrom).filter(e=>e.kind==='event'&&e.type==='itemRejected');assert.equal(evidence.rejectedEvents.length,2);
  assert(!network.slice(rejectFrom).some(e=>e.kind==='event'&&e.type==='itemUsed'));
  evidence.rejectedAfter=await evaluate(host,`window.teamLifeBattle.inventory()`);
  assert.equal(inventory().ownedQuantity,2);assert.equal(evidence.rejectedAfter.records.find(r=>r.instanceId===77).ownedQuantity,2);assert.equal(evidence.rejectedAfter.records.find(r=>r.instanceId===77).battleQuantity,2);
  for(const p of pages){const observed=await evaluate(p.sessionId,'window.teamLifeObserved');assert.equal(observed.effects.length,0);assert.equal(observed.sounds.length,0);}
  await screenshot(host,'mode-rejected');await leave();assert.equal(evidence.decodeError,undefined);
  for(const {sessionId}of pages)assert(network.some(e=>e.page===sessionId&&e.kind==='api'&&e.name==='Ready'&&e.success));
  evidence.status='PASS';await rm(`${output}-failure.png`,{force:true});
  console.log('PASS: item501 dual1080p mode1 own-team +1, owned3→2/battle2→1, repeat suppression, Effect12/SE13 actual draw/play/end, cleanup, service restart qty2/slot4 and ordinary mode4 rejection');
}catch(error){
  evidence.status='FAIL';evidence.error=error.stack??String(error);
  if(pages[0]){evidence.failurePages=await Promise.all(pages.map(p=>evaluate(p.sessionId,`({world:${world},observed:window.teamLifeObserved,status:document.querySelector('#battle-status')?.value})`).catch(()=>null)));evidence.failure=await evaluate(pages[0].sessionId,`({world:${world},observed:window.teamLifeObserved,status:document.querySelector('#battle-status')?.value})`).catch(()=>null);await screenshot(pages[0].sessionId,'failure').catch(()=>{});}throw error;
}finally{
  evidence.network=network;store?.close();
  if(ws?.readyState===WebSocket.OPEN){for(const browserContextId of contexts)await command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});ws.close();}
  await vite?.close();await stop(server);await stop(chrome);await rm(directory,{recursive:true,force:true});
  evidence.noInjectedGameplayState=true;
  evidence.processCleanup={serverExited:server?.exitCode!==null||server?.signalCode!==null,chromeExited:chrome?.exitCode!==null||chrome?.signalCode!==null,viteClosed:true,temporaryDirectoryRemoved:true};
  await writeFile(`${output}.json`,JSON.stringify(evidence,null,2)+'\n');await writeFile(`${output}.log`,serverLog);
}
