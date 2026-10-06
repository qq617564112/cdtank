import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {readOwnedRolePairMessage} from '../recovery/evidence/roles/role-owned-sources.ts';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv.slice(2).find(value => !value.startsWith('--'));
const largeFeed = process.argv.includes('--large-feed');
const itemTableId = largeFeed ? 2 : 1;
const catalog = JSON.parse(await readFile('recovery/output/web-assets/combat-catalog.json', 'utf8'));
const itemDefinition = catalog.items.find(item => item.itemTableId === itemTableId);
const skillDefinition = catalog.skills.find(skill => skill.skillId === itemDefinition.skillIds[0]);
assert.equal(skillDefinition.skillId, itemTableId);
assert.equal(skillDefinition.attributes.HP, largeFeed ? 400 : 200);
const autopilot = process.argv.includes('--autopilot');
const reentryOnly = process.argv.includes('--reentry-only');
const reentry = process.argv.includes('--reentry') || reentryOnly;
const continuationPath = process.env.CDTANK_REACT_CONTINUATION_EVIDENCE;
const continuation = reentryOnly ? JSON.parse(await readFile(continuationPath, 'utf8')) : undefined;
if(reentryOnly){assert(continuation.firstRound&&continuation.secondRound);assert.equal(continuation.afterSecondInventory.records.find(row=>row.instanceId===77).ownedQuantity,1);assert.equal(continuation.restartInventory.slot,'77');}
const effectOnly = process.argv.includes('--effect-only');
const hd = process.argv.includes('--hd');
const ownedTextures = process.argv.includes('--owned-textures');
const originalMovement = process.argv.includes('--original-movement');
const viewport = hd ? {width:1920,height:1080} : {width:1280,height:720};
const scaling = hd ? 1 : 3;
const startingQuantity = reentryOnly ? continuation.afterSecondInventory.records.find(row=>row.instanceId===77).ownedQuantity : autopilot ? 1 : 3;
const evidencePath = `recovery/output/browser-${largeFeed ? 'large-feed' : autopilot ? 'account-autopilot' : 'healing-item'}${hd ? '-hd' : ''}${ownedTextures ? '-owned-textures' : ''}${originalMovement ? '-original-movement' : ''}${effectOnly ? '-effect-only' : ''}${reentryOnly ? '-reentry-only' : ''}.json`;
if (!endpoint) throw new Error('Usage: node --import tsx tests/browser-healing-item.mjs <Chromium CDP WebSocket URL>');
const directory = await mkdtemp(join(tmpdir(), 'cdtank-healing-browser-'));
const database = join(directory, 'accounts.sqlite');
let server;
async function start() {
  let log='';
  const environment={...process.env,PORT:'3138',ACCOUNT_DB_PATH:database};
  delete environment.MATCH_TIME_LIMIT_SECONDS;delete environment.MATCH_MIN_PLAYERS;
  server=spawn(process.execPath,['--import','tsx','apps/server/src/index.ts'],
    {env:environment,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',data=>{log+=String(data);});server.stderr.on('data',data=>{log+=String(data);});
  const deadline=Date.now()+15000;
  while(!log.includes('Server started')&&Date.now()<deadline&&server.exitCode===null)await new Promise(r=>setTimeout(r,20));
  assert(log.includes('Server started'),log);
}
async function stop() {
  if(server?.exitCode===null){const ended=new Promise(resolve=>server.once('exit',resolve));server.kill();await ended;}
}
await start();
const vite=await createServer({configFile:false,root:'apps/web',publicDir:'../../recovery/output/web-assets',
  server:{port:5193,host:'127.0.0.1',hmr:false,proxy:{'/game':{target:'ws://127.0.0.1:3138',ws:true,rewrite:()=> '/'}}}});
await vite.listen();
const ws = new WebSocket(endpoint);
await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
let sequence = 0;
const pending = new Map();
ws.on('message', raw => {
  const message = JSON.parse(String(raw));
  const callback = pending.get(message.id);
  if (callback) {
    pending.delete(message.id);
    message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);
  }
});
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
async function frameRemoteHost(host, guest, battleName, label) {
  await nativeClick(guest, '#world');
  const read = () => evaluate(guest, `(async()=>{
    const b=window.${battleName},world=JSON.parse(document.querySelector('#battle-status').dataset.world);
    const local=world.players.find(p=>p.id===world.playerId),host=world.players.find(p=>!p.isCpu&&p.id!==world.playerId);
    const view=host&&b.players.get(host.id);
    const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {Frustum}=await import(url);window.healingCamera.getViewMatrix();window.healingCamera.getProjectionMatrix();const planes=Frustum.GetPlanes(window.healingCamera.getTransformationMatrix());
    const distances=view?planes.map(p=>p.dotCoordinate(view.root.position)):[];
    return {host:host?{id:host.id,alive:host.alive,hp:host.hp,maxHp:host.maxHp,x:host.x,z:host.z}:null,
      local:local?{id:local.id,alive:local.alive,yaw:local.yaw,aim:local.aim,x:local.x,z:local.z}:null,
      camera:{position:window.healingCamera.globalPosition.asArray(),target:window.healingCamera.target.asArray()},
      distances,visible:distances.length===6&&distances.every(d=>d>50),phase:world.phase,
      keys:[...b.input.keys],focus:document.activeElement?.id,tick:world.tick,cameraMatches:b.camera===window.healingCamera};
  })()`);
  const before=await read(),deadline=Date.now()+60000;let after=before,pulses=0;const inputSamples=[];
  while(Date.now()<deadline){
    after=await read();
    if(after.visible&&after.host?.alive&&after.host.hp<after.host.maxHp){
      await evaluate(guest,`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
      const stable=await read();
      if(stable.visible&&stable.host?.alive&&stable.host.hp<stable.host.maxHp&&stable.tick!==after.tick&&stable.keys.length===0){after=stable;break;}
      await new Promise(resolve=>setTimeout(resolve,60));
      continue;
    }
    if(after.phase!=='PLAYING')throw new Error('Remote visibility positioning ended outside PLAYING');
    if(!after.visible){
      await command('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39},guest);
      await new Promise(resolve=>setTimeout(resolve,100));
      if(inputSamples.length<12)inputSamples.push(await evaluate(guest,`({keys:[...window.${battleName}.input.keys],sequence:window.${battleName}.input.sequence,context:window.${battleName}.input.readContext(),focus:document.activeElement?.id,visibility:document.visibilityState})`));
      await command('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39},guest);
      pulses++;
    }else await new Promise(resolve=>setTimeout(resolve,100));
  }
  evidence.remoteVisibility??=[];evidence.remoteVisibility.push({label,before,after,pulses,inputSamples});
  assert(after.visible&&after.host?.alive&&after.host.hp<after.host.maxHp,'Ordinary guest aim must frame the live injured host');
}
async function createHealingRoom(session) {
  await nativeClick(session, '[data-home-close]');
  if (!await evaluate(session, `document.querySelector('#create-room-controls').open`)) await nativeClick(session, '#create-room-controls > summary');
  await nativeSelect(session, '#room-mode', 4);
  await waitUntil(session, `Array.from(document.querySelector('#room-map').options).some(o=>o.value==='7')`);
  await nativeSelect(session, '#room-map', 7);
  await nativeClick(session, '#create-room');
}
function assertHealingEvent(event) {
  assert.equal(event.type, 'itemUsed');
  assert.equal(event.skillId, skillDefinition.skillId);
  assert.equal(event.targetId, event.playerId);
  assert(event.message.includes(itemDefinition.name));
  assert(event.value > 0 && event.value <= skillDefinition.attributes.HP);
  assert.deepEqual(event.playSkillEffect, {skillId:skillDefinition.skillId, effectIndex:0, duration:0,
    roleId:Number(event.playerId.slice(1)), xBits:0, zBits:0});
}
const pages=[],contexts=[];
const state=session=>evaluate(session,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
const evidence={autopilot,originalMovement,itemDefinition,skillDefinition,scope:`Two normal webpages, explicit inventory migration, ordinary home configuration/room/CPU/Ready/${autopilot ? 'account-owned AI autopilot inputs' : 'Digit5'}, natural CPU injury and healing in two naturally completed rounds, gated two-player rematch, retained inventory, original Effect11/GA15 runtime and exit/restart cleanup.${reentry ? ' Normal webpage new-room entry after restart, retained stock/shortcut, default manual control and ordinary combat inputs.' : ''} ${hd ? '1920x1080 actual canvas pixels, frame intervals and renderer recorded; representative map only, no all-content performance proof.' : 'Reduced canvas resolution; no HD performance proof.'} ${originalMovement ? ' Explicit original full owned-source fixtures for both human accounts; both webpages observe independent bodyYaw each round. Default CPUs remain prototype sources; horizontal geometry only, rebuilt grounding/final dimensions/dynamic OBB not proven.' : ''} Self targeting, full-health rejection, consumption and round outcomes use rebuilt rules; CPU strategy is rebuilt. No original server success rules proof.`};
try {
  for(let index=0;index<2;index++) {
    const {browserContextId}=await command('Target.createBrowserContext');contexts.push(browserContextId);
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5193',browserContextId});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#start-cpu') && !document.querySelector('#start-cpu').disabled`);
    await evaluate(sessionId,`(async()=>{
      const source=await(await fetch('/src/render/scene-runtime.ts')).text();
      const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore,Frustum}=await import(url);EngineStore.LastCreatedEngine.setHardwareScalingLevel(${scaling});EngineStore.LastCreatedEngine.resize();
      window.healingFrameTimes=[];
      const scene=EngineStore.LastCreatedScene;
      window.healingCamera=scene.activeCamera;
      scene.onAfterRenderObservable.add(()=>{
        const world=document.querySelector('#battle-status')?.dataset.world;
        if(world&&JSON.parse(world).phase==='PLAYING'&&window.healingFrameTimes.length<75000)
          window.healingFrameTimes.push(scene.getEngine().getDeltaTime());
      });
      window.healingObserved={effects:[],sounds:[],events:[],canvas:{width:EngineStore.LastCreatedEngine.getRenderWidth(),height:EngineStore.LastCreatedEngine.getRenderHeight()}};
      const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');
      const {EFFECT_PRIMARY_TAGS}=await import('/src/assets/tanks/effect-tag-matrices.ts');
      const attached=EffectRuntime.prototype.spawnAttachedEffect;
      EffectRuntime.prototype.spawnAttachedEffect=function(view,id,tag,once,local){
        const handle=attached.call(this,view,id,tag,once,local);
        if(id===11){window.healingRuntime=this;const instance=this.instances.find(row=>row.handle===handle);
          window.healingObserved.effects.push({handle,id,tag,once,local:view===local,
            drawCount:instance?.draws.length??0,parent:!!view.primaryTag(EFFECT_PRIMARY_TAGS[tag]),
            actualTag:EFFECT_PRIMARY_TAGS[tag],parentReferenceMatches:instance?.tree.parentMatrix===view.primaryTag(EFFECT_PRIMARY_TAGS[tag]),
              viewId:view.id,localId:local?.id,position:view.root.position.asArray(),camera:window.healingCamera.globalPosition.asArray(),cameraMatches:this.camera===window.healingCamera,running:this.running,library:!!this.library,
              planes:Frustum.GetPlanes(window.healingCamera.getTransformationMatrix()).map(plane=>plane.dotCoordinate(view.root.position))});}
        return handle;
      };
      const sound=EffectRuntime.prototype.playSkillSound;
      EffectRuntime.prototype.playSkillSound=function(view,reference,selector){
        const handle=sound.call(this,view,reference,selector);
        if(reference==='GA15'){window.healingRuntime=this;const voice=this.skillSound.voices.get(handle);
          const row={handle,reference,selector,src:voice?.audio.src,loop:voice?.audio.loop,
            context:this.skillSound.context?.state,position:voice?.position,played:false,ended:false};
          voice?.audio.addEventListener('playing',()=>{row.played=true;});
          voice?.audio.addEventListener('ended',()=>{row.ended=true;});
          window.healingObserved.sounds.push(row);}
        return handle;
      };
      const {Battle}=await import('/src/match/battle.ts');
      const reconcile=Battle.prototype.reconcile;
      Battle.prototype.reconcile=function(...args){window.healingBattle=this;return reconcile.apply(this,args);};
      const {BattleSkillEffects}=await import('/src/match/skills/battle-skill-effects.ts');
      const event=BattleSkillEffects.prototype.event;
      BattleSkillEffects.prototype.event=function(value){if(value.type==='itemUsed')window.healingObserved.events.push(value);return event.call(this,value);};
    })()`);
  }
  const host=pages[0].sessionId,guest=pages[1].sessionId;
  const token=await evaluate(host,`localStorage.getItem('cdtank-account-token')`);
  const store=new AccountStore(database),owner=store.open(token);
  store.replaceInventory(owner.accountId,[{instanceId:77,itemTableId,ownedQuantity:startingQuantity,battleQuantity:0,state:0,
    field8:0,float24Bits:0,float28Bits:0,float2cBits:0}]);
  if(ownedTextures || originalMovement){
    const fixture=JSON.parse(await readFile('recovery/output/role-owned-pair-native.json','utf8')).rows[0];
    const pair=readOwnedRolePairMessage(new Uint8Array(fixture.raw),fixture.alignment,()=> '明确导入战车');
    for(const [index,page] of pages.entries()){
      const account=store.open(await evaluate(page.sessionId,`localStorage.getItem('cdtank-account-token')`));
      const native=originalMovement?JSON.parse(await readFile('recovery/output/world-role-attributes-native.json','utf8')).rows.find(row=>row.tankId===1&&row.part===0):undefined;
      const fields=value=>new Map(Object.entries(value).map(([key,value])=>[Number(key),value]));
      const equipment={name:'明确导入迷彩战车',fields:native?fields(native.equipment):new Map(pair.equipment.fields)};
      const base=native?{name:'明确导入原宠物',fields:fields(native.base)}:undefined;
      equipment.fields.set(0x1c,72);equipment.fields.set(0x24,1);
      equipment.fields.set(0x28,index===0?10011:10021);equipment.fields.set(0x2c,index===0?10012:10022);
      equipment.fields.set(0x30,index===0?10013:10023);
      store.replaceRoleRecords(account.accountId,{base:base?[base]:[],equipment:[equipment]});
      const bytes=new Uint8Array(0x170);new DataView(bytes.buffer).setUint32(0xa8,72,true);
      if(base)new DataView(bytes.buffer).setUint32(0xa4,base.fields.get(0),true);
      store.replaceRoleProfile(account.accountId,{bytes,strings:['','']});
    }
  }
  await evaluate(host,`document.querySelector('#open-home').click()`);
  await waitUntil(host,`document.querySelector('[data-source-control="rdoItem"]')`);
  await evaluate(host,`document.querySelector('[data-source-control="rdoItem"]').click()`);
  await waitUntil(host,`document.querySelector('[data-inventory-instance="77"]')`);
  await evaluate(host,`document.querySelector('[data-inventory-instance="77"]').click();document.querySelector('[data-kitbag-slot="4"]').click()`);
  await waitUntil(host,`document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='77'`);
  if(!reentryOnly){
  await createHealingRoom(host);
  await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
  const roomId=(await state(host)).roomId;
  for(let index=0;index<3;index++){
    await waitUntil(host,`document.querySelector('[data-add-cpu]') && !document.querySelector('[data-add-cpu]').disabled`);
    await evaluate(host,`document.querySelector('[data-add-cpu]').click()`);
    await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===${index+2}`);
  }
  await evaluate(guest,`document.querySelector('#refresh-rooms').click()`);
  await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)}) && !document.querySelector('#join').disabled`);
  await nativeSelect(guest, '#room', roomId);
  await nativeClick(guest, '#join');
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.players.length===5&&s.renderedPlayers===5})()`);
  if(ownedTextures){
    for(const page of pages)await waitUntil(page.sessionId,`window.healingBattle`);
    evidence.ownedTextures=await Promise.all(pages.map(page=>evaluate(page.sessionId,`(()=>{
      const world=JSON.parse(document.querySelector('#battle-status').dataset.world),battle=window.healingBattle;
      return world.players.filter(player=>player.tankTextures).map(player=>{
        const view=battle.players.get(player.id);
        if(JSON.stringify(view.tankTextures)!==JSON.stringify(player.tankTextures))throw new Error('Snapshot skin mismatch');
        return {id:player.id,ids:player.tankTextures,components:view.current.components.map(component=>({part:component.part,
          textures:component.assets.meshes.filter(mesh=>mesh.getTotalVertices()>0).map(mesh=>mesh.material.getActiveTextures()[0]?.url)}))};
      });
    })()`)));
    assert.deepEqual(evidence.ownedTextures[0],evidence.ownedTextures[1]);
    assert.equal(evidence.ownedTextures[0].length,2);
    assert.deepEqual(evidence.ownedTextures[0].map(row=>row.ids),[{U:10011,M:10012,XY:10013},{U:10021,M:10022,XY:10023}]);
  }
  if(autopilot){
    const point=await evaluate(guest,`(()=>{const r=document.querySelector('#world').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    for(let wheel=0;wheel<160;wheel++){
      if(await evaluate(guest,`window.healingCamera.radius>=4000`))break;
      await command('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaX:0,deltaY:1500},guest);
      await new Promise(resolve=>setTimeout(resolve,150));
    }
    await waitUntil(guest,`(()=>{const camera=window.healingCamera;
      return camera.radius>=4000 && Math.abs(camera.inertialRadiusOffset)<1})()`);
  }
  if(autopilot){
    await evaluate(host,`document.querySelector('[data-autopilot]').click()`);
    await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.find(p=>p.id===JSON.parse(document.querySelector('#battle-status').dataset.world).playerId).isAutopilot`);
  }
  for(const session of [guest,host]) {
    await command('Page.bringToFront',{},session);
    const point=await evaluate(session,`(()=>{const r=document.querySelector('[data-ready]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await command('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1},session);
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1},session);
  }
  const started=Date.now();let injured;
  while(Date.now()-started<180000){
    const s=await state(host),p=s.players.find(row=>row.id===s.playerId);
    if(s.phase==='PLAYING'&&p.alive&&p.hp<p.maxHp){injured=s;break;}
    if(autopilot&&await evaluate(host,`window.healingObserved.events.length>0`)){injured=s;break;}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  assert(injured,'Natural CPU combat must injure the host');evidence.injured=injured;
  if(!autopilot){
  await frameRemoteHost(host,guest,'healingBattle','first');
  await nativeClick(host, '#world');
  evidence.beforeFirstCast=await evaluate(host,`(async()=>({inventory:await window.healingBattle.inventory(),focus:document.activeElement?.outerHTML,keys:[...window.healingBattle.input.keys],info:document.querySelector('[data-source-control="edtBattleInfo"]')?.textContent}))()`);
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'5',code:'Digit5',windowsVirtualKeyCode:53},host);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'5',code:'Digit5',windowsVirtualKeyCode:53},host);
  }
  for(const page of pages)await waitUntil(page.sessionId,`window.healingObserved.events.length===1`);
  for(const page of pages)await waitUntil(page.sessionId,`window.healingObserved.sounds.some(row=>row.played)`);
  evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,`window.healingObserved`)));
  assert.deepEqual(evidence.observed[0].events,evidence.observed[1].events);
  assertHealingEvent(evidence.observed[0].events[0]);
  for(const result of evidence.observed){
    assert(result.effects.some(row=>row.id===11&&row.handle>0&&row.drawCount>0),'Original attached Effect11 must create actual draw nodes');
    assert(result.effects.some(row=>row.actualTag==='tag_efcenter'&&row.parent&&row.parentReferenceMatches),'Effect11 must use the live original Tag0 matrix in both webpages');
    assert(result.sounds.some(row=>row.reference==='GA15'&&row.handle>0&&row.context==='running'&&row.loop===false&&row.played),'Original one-shot GA15 must start in both audio contexts');
  }
  assert.equal(store.inventory(owner.accountId).records[0].ownedQuantity,startingQuantity-1);store.close();
  for(const [index,page] of pages.entries()){
    const shot=await command('Page.captureScreenshot',{format:'png'},page.sessionId);
    await writeFile(`recovery/output/${largeFeed?'browser-large-feed':autopilot?'autopilot':'healing'}-battle-${index+1}${hd ? '-hd' : ''}${ownedTextures ? '-owned-textures' : ''}${originalMovement ? '-original-movement' : ''}.png`,Buffer.from(shot.data,'base64'));
  }
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const r=window.healingRuntime;const handles=window.healingObserved.effects.map(e=>e.handle);return r&&!r.instances.some(i=>handles.includes(i.handle))&&r.skillSound.voices.size===0})()`);
  evidence.naturalExpiry=await Promise.all(pages.map(page=>evaluate(page.sessionId,`({healingActive:window.healingRuntime.instances.some(i=>window.healingObserved.effects.some(e=>e.handle===i.handle)),voices:window.healingRuntime.skillSound.voices.size,soundEnded:window.healingObserved.sounds.every(row=>row.ended)})`)));
  assert(evidence.naturalExpiry.every(row=>row.soundEnded));
  if(effectOnly){
    for(const page of pages)await evaluate(page.sessionId,`document.querySelector('#leave').click()`);
    for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
    evidence.cleanup=await Promise.all(pages.map(page=>evaluate(page.sessionId,`({instances:window.healingRuntime.instances.length,voices:window.healingRuntime.skillSound.voices.size})`)));
    for(const cleanup of evidence.cleanup)assert.deepEqual(cleanup,{instances:0,voices:0});
    evidence.scope='Focused ordinary-input first-item cast in two real webpages: actual Effect11 five draws, live original tag_efcenter identity, GA15 playback/natural expiry/exit cleanup. No two-round or persistence claim from this focused run.';
  }else{
  async function naturalRound(round) {
    const start=Date.now();let lastLog=0,matched=0,nativeAngles=false;
    while(Date.now()-start<330000){
      const pair=await Promise.all(pages.map(page=>state(page.sessionId)));
      nativeAngles ||= pair.every(world=>world.players.some(player=>player.bodyYaw!==undefined));
      if(pair[0].tick===pair[1].tick){
        assert.deepEqual(pair[0].players,pair[1].players);matched++;
      }
      if(pair.every(value=>value.phase==='FINISHED')){
        assert.deepEqual(pair[0].match.result,pair[1].match.result);
        assert(pair[0].match.result.players.some(player=>player.kills>0));
        console.log(JSON.stringify({round,naturalEnd:true,elapsedMs:Date.now()-start,matched}));
        if(originalMovement)assert(nativeAngles,'Both webpages must receive restored original movement body angles');
        return {pair,elapsedMs:Date.now()-start,matched,nativeAngles};
      }
      if(Date.now()-lastLog>10000){lastLog=Date.now();console.log(JSON.stringify({round,remaining:pair[0].remaining,kills:pair[0].players.map(player=>player.kills)}));}
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    throw new Error('Natural round did not settle');
  }
  evidence.firstRound=await naturalRound(1);
  for(const page of pages)await waitUntil(page.sessionId,`document.querySelectorAll('[data-result-player]').length===5`);
  await new Promise(resolve=>setTimeout(resolve,1000));
  const frozen=await Promise.all(pages.map(page=>state(page.sessionId)));
  assert.deepEqual(frozen.map(value=>value.match.result),evidence.firstRound.pair.map(value=>value.match.result));
  await evaluate(host,`document.querySelector('[data-rematch]').click()`);
  await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).match.rematchPlayerIds.length===4`);
  assert.equal((await state(host)).phase,'FINISHED');
  await evaluate(guest,`document.querySelector('[data-rematch]').click()`);
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.phase==='PLAYING'&&s.match.round===2})()`);
  evidence.rematch=await Promise.all(pages.map(page=>state(page.sessionId)));
  assert(evidence.rematch.every(value=>value.players.every(player=>player.alive&&player.hp===player.maxHp&&player.kills===0&&player.deaths===0)));
  evidence.secondInventory=await evaluate(host,`window.healingBattle.inventory()`);
  assert.equal(evidence.secondInventory.records.find(row=>row.instanceId===77).ownedQuantity,startingQuantity-1);
  assert.equal(evidence.secondInventory.records.find(row=>row.instanceId===77).battleQuantity,startingQuantity-1);
  if(!autopilot){
  const secondStarted=Date.now();let secondInjured;
  while(Date.now()-secondStarted<180000){
    const s=await state(host),p=s.players.find(row=>row.id===s.playerId);
    if(s.phase==='PLAYING'&&p.alive&&p.hp<p.maxHp){secondInjured=s;break;}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  assert(secondInjured);evidence.secondInjured=secondInjured;
  await frameRemoteHost(host,guest,'healingBattle','second');
  await nativeClick(host, '#world');
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'5',code:'Digit5',windowsVirtualKeyCode:53},host);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'5',code:'Digit5',windowsVirtualKeyCode:53},host);
  for(const page of pages)await waitUntil(page.sessionId,`window.healingObserved.events.length===2`);
  evidence.secondUse=await Promise.all(pages.map(page=>evaluate(page.sessionId,`window.healingObserved.events[1]`)));
  assert.deepEqual(evidence.secondUse[0],evidence.secondUse[1]);
  assertHealingEvent(evidence.secondUse[0]);
  for(const page of pages)await waitUntil(page.sessionId,`window.healingObserved.sounds.filter(row=>row.played).length===2`);
  evidence.secondObserved=await Promise.all(pages.map(page=>evaluate(page.sessionId,`window.healingObserved`)));
  for(const row of evidence.secondObserved){
    assert.equal(row.effects.length,2);
    assert(row.effects.every(effect=>effect.id===11&&effect.drawCount===5&&effect.actualTag==='tag_efcenter'&&effect.parentReferenceMatches));
    assert.equal(row.sounds.filter(sound=>sound.reference==='GA15'&&sound.context==='running'&&sound.loop===false&&sound.played).length,2);
  }
  evidence.afterSecondInventory=await evaluate(host,`window.healingBattle.inventory()`);
  assert.equal(evidence.afterSecondInventory.records.find(row=>row.instanceId===77).ownedQuantity,1);
  assert.equal(evidence.afterSecondInventory.records.find(row=>row.instanceId===77).battleQuantity,1);
  }
  evidence.secondRound=await naturalRound(2);
  if(autopilot){
    for(const page of pages)assert.equal(await evaluate(page.sessionId,`window.healingObserved.events.length`),1);
    evidence.afterSecondInventory=await evaluate(host,`window.healingBattle.inventory()`);
    assert.equal(evidence.afterSecondInventory.records[0].ownedQuantity,0);
    assert((await state(host)).players.find(p=>p.id===(evidence.rematch[0].playerId)).isAutopilot);
  }
  for(const page of pages){
    await evaluate(page.sessionId,`document.querySelector('#leave').click()`);
  }
  for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  evidence.rendering=await Promise.all(pages.map(page=>evaluate(page.sessionId,`(async()=>{
    const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);const engine=EngineStore.LastCreatedEngine;
    const frames=window.healingFrameTimes.filter(value=>value>0).sort((a,b)=>a-b);
    const percentile=p=>frames[Math.min(frames.length-1,Math.floor(frames.length*p))];
    return {viewport:[innerWidth,innerHeight],canvas:[engine.getRenderWidth(),engine.getRenderHeight()],
      cameraStage:"after-exit",camera:{radius:EngineStore.LastCreatedScene.activeCamera.radius,alpha:EngineStore.LastCreatedScene.activeCamera.alpha,beta:EngineStore.LastCreatedScene.activeCamera.beta},
      scaling:engine.getHardwareScalingLevel(),renderer:engine.getGlInfo(),frameCount:frames.length,
      frameMs:{p50:percentile(0.5),p95:percentile(0.95),p99:percentile(0.99),max:frames.at(-1)}};
  })()`)));
  if(hd)for(const row of evidence.rendering){assert.deepEqual(row.viewport,[1920,1080]);assert.deepEqual(row.canvas,[1920,1080]);assert.equal(row.scaling,1);assert(row.frameCount>0);}
  evidence.cleanup=await Promise.all(pages.map(page=>evaluate(page.sessionId,`({instances:window.healingRuntime.instances.length,voices:window.healingRuntime.skillSound.voices.size})`)));
  for(const cleanup of evidence.cleanup)assert.deepEqual(cleanup,{instances:0,voices:0});
  }
  } else {
    evidence.continuationInput={path:continuationPath,ownedQuantity:startingQuantity,instanceId:77,slot:4,sourceRestartInventory:continuation.restartInventory};
    evidence.scope='Explicit account fixture restored from prior verified two-round quantities, real account save/server restart, token and stock/shortcut recovery, ordinary room/Ready/natural injury/ArrowRight/Digit5, dual original Effect11/GA15, exit and final zero-stock restart. This subset does not run natural rounds.';
    store.close();
  }
  await stop();await start();
  await evaluate(host,`window.healingReloadPending=true`);
  await command('Page.reload',{},host);
  await waitUntil(host,`!window.healingReloadPending && document.querySelector('#start-cpu') && !document.querySelector('#start-cpu').disabled && document.querySelector('#tank')?.options.length===21 && localStorage.getItem('cdtank-account-token')`);
  assert.equal(await evaluate(host,`localStorage.getItem('cdtank-account-token')`),token);
  await evaluate(host,`document.querySelector('#open-home').click()`);
  await waitUntil(host,`document.querySelector('[data-source-control="rdoItem"]')`);
  await evaluate(host,`document.querySelector('[data-source-control="rdoItem"]').click()`);
  await waitUntil(host,`document.querySelector('[data-inventory-instance="77"]')?.textContent.includes('×${autopilot?0:1}')`);
  assert.equal(await evaluate(host,`document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId`),'77');
  evidence.restartInventory=await evaluate(host,`({text:document.querySelector('[data-inventory-instance="77"]').textContent,slot:document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId})`);
  if(reentry){
    await createHealingRoom(host);
    await waitUntil(host,`document.querySelector('#battle-status').dataset.world`);
    const newRoomId=(await state(host)).roomId;
    for(let index=0;index<3;index++){
      await waitUntil(host,`document.querySelector('[data-add-cpu]') && !document.querySelector('[data-add-cpu]').disabled`);
      await evaluate(host,`document.querySelector('[data-add-cpu]').click()`);
      await waitUntil(host,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===${index+2}`);
    }
    await evaluate(guest,`window.healingReloadPending=true`);
    await command('Page.reload',{},guest);
    await waitUntil(guest,`!window.healingReloadPending && document.querySelector('#start-cpu') && !document.querySelector('#start-cpu').disabled`);
    await evaluate(guest,`document.querySelector('#refresh-rooms').click()`);
    await waitUntil(guest,`Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(newRoomId)}) && !document.querySelector('#join').disabled`);
    await nativeSelect(guest, '#room', newRoomId);
  await nativeClick(guest, '#join');
    for(const page of pages){
      await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world||'null');return s?.mapLoaded&&s.players.length===5&&s.renderedPlayers===5})()`);
      await evaluate(page.sessionId,`(async()=>{
        const source=await(await fetch('/src/render/scene-runtime.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
        const {EngineStore,Frustum}=await import(url);EngineStore.LastCreatedEngine.setHardwareScalingLevel(${scaling});EngineStore.LastCreatedEngine.resize();
        window.healingCamera=EngineStore.LastCreatedScene.activeCamera;
        window.reentryEvents=[];window.reentryObserved={effects:[],sounds:[]};
        const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');
        const {EFFECT_PRIMARY_TAGS}=await import('/src/assets/tanks/effect-tag-matrices.ts');
        const attached=EffectRuntime.prototype.spawnAttachedEffect;
        EffectRuntime.prototype.spawnAttachedEffect=function(view,id,tag,once,local){
          const handle=attached.call(this,view,id,tag,once,local);
          if(id===11){window.reentryRuntime=this;const instance=this.instances.find(row=>row.handle===handle);
            window.reentryObserved.effects.push({handle,id,drawCount:instance?.draws.length??0,
              actualTag:EFFECT_PRIMARY_TAGS[tag],parentReferenceMatches:instance?.tree.parentMatrix===view.primaryTag(EFFECT_PRIMARY_TAGS[tag]),
              viewId:view.id,localId:local?.id,position:view.root.position.asArray(),camera:window.healingCamera.globalPosition.asArray(),cameraMatches:this.camera===window.healingCamera,running:this.running,library:!!this.library,
              planes:Frustum.GetPlanes(window.healingCamera.getTransformationMatrix()).map(plane=>plane.dotCoordinate(view.root.position))});}
          return handle;
        };
        const sound=EffectRuntime.prototype.playSkillSound;
        EffectRuntime.prototype.playSkillSound=function(view,reference,selector){
          const handle=sound.call(this,view,reference,selector);
          if(reference==='GA15'){window.reentryRuntime=this;const voice=this.skillSound.voices.get(handle);
            const row={handle,reference,src:voice?.audio.src,loop:voice?.audio.loop,context:this.skillSound.context?.state,played:false,ended:false};
            voice?.audio.addEventListener('playing',()=>{row.played=true;});
            voice?.audio.addEventListener('ended',()=>{row.ended=true;});window.reentryObserved.sounds.push(row);}
          return handle;
        };
        const {Battle}=await import('/src/match/battle.ts');const reconcile=Battle.prototype.reconcile;
        Battle.prototype.reconcile=function(...args){window.reentryBattle=this;return reconcile.apply(this,args);};
        const {BattleSkillEffects}=await import('/src/match/skills/battle-skill-effects.ts');const original=BattleSkillEffects.prototype.event;
        BattleSkillEffects.prototype.event=function(value){window.reentryEvents.push(value);return original.call(this,value);};
      })()`);
    }
    const before=await state(host);
    assert(!before.players.find(player=>player.id===before.playerId).isAutopilot,'Re-entering starts with manual control');
    if(autopilot){await evaluate(host,`document.querySelector('[data-autopilot]').click()`);}
    for(const session of [guest,host]){
      await command('Page.bringToFront',{},session);
      const point=await evaluate(session,`(()=>{const r=document.querySelector('[data-ready]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await command('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1},session);
      await command('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1},session);
    }
    for(const page of pages)await waitUntil(page.sessionId,`window.reentryBattle && JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='PLAYING'`);
    evidence.reentryInventory=await evaluate(host,`window.reentryBattle.inventory()`);
    const expected=autopilot?0:1;
    assert.equal(evidence.reentryInventory.records[0].ownedQuantity,expected);
    assert.equal(evidence.reentryInventory.records[0].battleQuantity,expected);
    assert.equal(evidence.reentryInventory.hotkeys[3],77);
    await waitUntil(host,`window.reentryEvents.some(event=>event.type==='hit')`);
    evidence.reentry=await Promise.all(pages.map(page=>state(page.sessionId)));
    if(autopilot){
      assert(evidence.reentry[0].players.find(p=>p.id===evidence.reentry[0].playerId).isAutopilot);
      for(const page of pages)assert(!await evaluate(page.sessionId,`window.reentryEvents.some(event=>event.type==='itemUsed')`));
    }
    if(!autopilot){
      await waitUntil(host,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);const p=s.players.find(p=>p.id===s.playerId);return s.phase==='PLAYING'&&p.alive&&p.hp<p.maxHp})()`);
      evidence.reentryInjured=await state(host);
      await frameRemoteHost(host,guest,'reentryBattle','reentry');
      await nativeClick(host, '#world');
      await command('Input.dispatchKeyEvent',{type:'keyDown',key:'5',code:'Digit5',windowsVirtualKeyCode:53},host);
      await command('Input.dispatchKeyEvent',{type:'keyUp',key:'5',code:'Digit5',windowsVirtualKeyCode:53},host);
      for(const page of pages)await waitUntil(page.sessionId,`window.reentryEvents.some(event=>event.type==='itemUsed')`);
      evidence.reentryUse=await Promise.all(pages.map(page=>evaluate(page.sessionId,`window.reentryEvents.find(event=>event.type==='itemUsed')`)));
      assert.deepEqual(evidence.reentryUse[0],evidence.reentryUse[1]);
      assertHealingEvent(evidence.reentryUse[0]);
      assert.equal(evidence.reentryUse[0].targetId,evidence.reentryUse[0].playerId);
      evidence.reentryAfterUse=await evaluate(host,`window.reentryBattle.inventory()`);
      assert.equal(evidence.reentryAfterUse.records[0].ownedQuantity,0);
      assert.equal(evidence.reentryAfterUse.records[0].battleQuantity,0);
      assert.equal(evidence.reentryAfterUse.hotkeys[3],77);
      for(const page of pages)await waitUntil(page.sessionId,`window.reentryObserved.sounds.some(row=>row.played)`);
      evidence.reentryObserved=await Promise.all(pages.map(page=>evaluate(page.sessionId,`window.reentryObserved`)));
      for(const row of evidence.reentryObserved){
        assert(row.effects.some(effect=>effect.id===11&&effect.drawCount===5&&effect.actualTag==='tag_efcenter'&&effect.parentReferenceMatches));
        assert(row.sounds.some(sound=>sound.reference==='GA15'&&sound.context==='running'&&sound.loop===false&&sound.played));
      }
    }
    for(const page of pages)await evaluate(page.sessionId,`document.querySelector('#leave').click()`);
    for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
    if(!autopilot){
      evidence.reentryCleanup=await Promise.all(pages.map(page=>evaluate(page.sessionId,`({instances:window.reentryRuntime.instances.length,voices:window.reentryRuntime.skillSound.voices.size})`)));
      for(const cleanup of evidence.reentryCleanup)assert.deepEqual(cleanup,{instances:0,voices:0});
      await stop();await start();
      await evaluate(host,`window.healingReloadPending=true`);await command('Page.reload',{},host);
      await waitUntil(host,`!window.healingReloadPending && document.querySelector('#open-home') && !document.querySelector('#start-cpu').disabled`);
      assert.equal(await evaluate(host,`localStorage.getItem('cdtank-account-token')`),token);
      await evaluate(host,`document.querySelector('#open-home').click()`);
      await waitUntil(host,`document.querySelector('[data-source-control="rdoItem"]')`);
      await evaluate(host,`document.querySelector('[data-source-control="rdoItem"]').click()`);
      await waitUntil(host,`document.querySelector('[data-inventory-instance="77"]')?.textContent.includes('×0')`);
      assert.equal(await evaluate(host,`document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId`),'77');
      evidence.reentryConsumeRestart={ownedQuantity:0,instanceId:77,slot:4};
    }
    console.log('PASS: normal dual-webpage re-entry after restart, retained stock/shortcut and clean new control state');
  }
  evidence.status='PASS';
  await writeFile(evidencePath,JSON.stringify(evidence,null,2)+'\n');
  console.log(reentryOnly ? 'PASS: restored verified quantity fixture, real restart and ordinary dual-page final healing/reentry/zero-stock persistence' : effectOnly ? 'PASS: focused ordinary two-webpage cast, original Tag0 live matrix, Effect11/GA15 and natural expiry/exit cleanup' : `${autopilot?'AUTOPILOT ':''}PASS: normal dual-webpage healing in two natural rounds, gated rematch, retained quantities, original Effect11/GA15 and exit/restart cleanup`);
}catch(error){
  evidence.status='FAIL';evidence.error=String(error);
  evidence.inputDiagnostics=await Promise.all(pages.map(page=>evaluate(page.sessionId,`(async()=>({inventory:await window.healingBattle?.inventory(),focus:document.activeElement?.outerHTML,keys:[...(window.healingBattle?.input.keys??[])],info:document.querySelector('[data-source-control="edtBattleInfo"]')?.textContent,status:document.querySelector('#battle-status')?.value}))()`).catch(()=>null))); 
  evidence.states=await Promise.all(pages.map(page=>state(page.sessionId).catch(()=>null)));
  evidence.observed=await Promise.all(pages.map(page=>evaluate(page.sessionId,`window.healingObserved`).catch(()=>null)));
  await writeFile(evidencePath,JSON.stringify(evidence,null,2)+'\n');throw error;
}finally{
  for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});
  for(const context of contexts)await command('Target.disposeBrowserContext',{browserContextId:context}).catch(()=>{});
  ws.close();await vite.close();await stop();await rm(directory,{recursive:true,force:true});
}
