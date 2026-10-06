import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {TANKS} from '../apps/server/src/config.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

const require = createRequire(import.meta.url), WebSocket = require('ws');
const {WsClient} = require('tsrpc'), {TransportDataUtil} = require('tsrpc-base-client');
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3166', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-defense-drink-'));
const database = join(directory, 'accounts.sqlite'), output = 'recovery/output/browser-defense-drink';
const evidence = {status: 'RUNNING', scope: 'Two ordinary 1920x1080 pages at hardware scaling 1, empty inventory and normal MONEY purchase3, normal home slot4/create/join/Ready/Digit5, original first-slot Effect108/SE40 with live source tag and actual mesh draws, nonstacking ten-second defenseBoost with natural CPU damage reduction, 3→2→1 consumption and two natural CPU rounds, natural expiry/HUD clear, leave cleanup and real-server restart slot persistence. No live combat state injection.', isolation: {server: 3166, vite: 5208, chrome: 9280}, limitations: ['Skill5 first-slot notification is nonretained; the visual follows its own original lifecycle independently of the ten-second buff.', 'Catalog second slot Effect10/SE02 is preserved. Its original second-slot trigger remains unknown; this browser run establishes only the first-slot notification and playback.', 'Effect108 embeds the known ww051 resource, absent from owned loose files and archives. SE40 playback and available geometry are verified; missing embedded audio is not.']};
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
  const env = {...process.env, PORT: '3166', ACCOUNT_DB_PATH: database};
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
async function waitUntil(session, expression, timeout = 45000) {
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
  const point = await evaluate(session, `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  for (const type of ['mousePressed', 'mouseReleased']) await command('Input.dispatchMouseEvent', {type, button: 'left', clickCount: 1, ...point}, session);
}
async function digit5(session) {
  await evaluate(session, `document.activeElement?.blur();document.querySelector('#world').focus();`);
  for (const type of ['keyDown', 'keyUp']) await command('Input.dispatchKeyEvent', {type, key: '5', code: 'Digit5', windowsVirtualKeyCode: 53}, session);
}
async function screenshot(session, name) {
  const shot = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`${output}-${name}.png`, Buffer.from(shot.data, 'base64'));
}
async function installMonitor(session) {
  await evaluate(session, `(async()=>{
    const source=await(await fetch('/src/main.ts')).text(),url=source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1];
    const {EngineStore}=await import(url),engine=EngineStore.LastCreatedEngine;
    engine.setHardwareScalingLevel(1);engine.resize();
    window.defenseObserved={effects:[],sounds:[],events:[],combat:[],notifications:[],frames:0,actualDraws:0,drawSubmissions:0,canvas:[engine.getRenderWidth(),engine.getRenderHeight()],scaling:engine.getHardwareScalingLevel(),viewport:[innerWidth,innerHeight],renderer:engine.getGlInfo()};
    window.defenseCamera=EngineStore.LastCreatedScene.activeCamera;EngineStore.LastCreatedScene.onAfterRenderObservable.add(()=>window.defenseObserved.frames++);
    const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');
    const {EFFECT_PRIMARY_TAGS}=await import('/src/assets/tanks/effect-tag-matrices.ts');
    const attached=EffectRuntime.prototype.spawnAttachedEffect;
    EffectRuntime.prototype.spawnAttachedEffect=function(view,id,tag,once,local){
      const handle=attached.call(this,view,id,tag,once,local);
      if(id===108){window.defenseRuntime=this;const instance=this.instances.find(i=>i.handle===handle);
        window.defenseObserved.effects.push({handle,id,tag,once,drawCount:instance?.draws.length??0,rootId:instance?.tree.root.definition.index,treeNodes:instance?.tree.nodes.length,nodeIds:instance?.draws.map(n=>n.node.definition.index),actualTag:EFFECT_PRIMARY_TAGS[tag],parentReferenceMatches:!!instance&&instance.tree.parentMatrix===view.primaryTag(EFFECT_PRIMARY_TAGS[tag])});}
      return handle;
    };
    const sound=EffectRuntime.prototype.playSkillSound;
    EffectRuntime.prototype.playSkillSound=function(view,reference,selector){
      const handle=sound.call(this,view,reference,selector);
      if(reference==='SE40'){window.defenseRuntime=this;const voice=this.skillSound.voices.get(handle),row={handle,reference,selector,src:voice?.audio.src,loop:voice?.audio.loop,context:this.skillSound.context?.state,played:false,ended:false};
        voice?.audio.addEventListener('playing',()=>row.played=true);voice?.audio.addEventListener('ended',()=>row.ended=true);window.defenseObserved.sounds.push(row);}
      return handle;
    };
    const draw=EffectRuntime.prototype.draw;
    EffectRuntime.prototype.draw=function(instance,node){
      const result=draw.call(this,instance,node);
      if(window.defenseObserved.effects.some(e=>e.handle===instance.handle)){
        const meshes=[node.sprite?.mesh,node.particle?.sprite.mesh,node.overlay?.mesh,...(node.model?.meshes??[])].filter(Boolean);
        if(meshes.some(m=>m.isEnabled()&&m.getTotalVertices()>0))window.defenseObserved.drawSubmissions++;
        for(const mesh of meshes)if(!mesh.defenseMonitor){mesh.defenseMonitor=true;mesh.onAfterRenderObservable.add(()=>window.defenseObserved.actualDraws++);}
      }
      return result;
    };
    const {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
    Battle.prototype.reconcile=function(...args){window.defenseBattle=this;return reconcile.apply(this,args);};
    const {SkillEffectNotifications}=await import('/src/match/skills/skill-effect-notifications.ts'),play=SkillEffectNotifications.prototype.play;
    SkillEffectNotifications.prototype.play=function(value){const result=play.call(this,value);if(value.skillId===5)window.defenseObserved.notifications.push({message:value,retained:this.records.length});return result;};
    const {BattleSkillEffects}=await import('/src/match/skills/battle-skill-effects.ts'),event=BattleSkillEffects.prototype.event;
    BattleSkillEffects.prototype.event=function(value){if(value.type==='itemUsed')window.defenseObserved.events.push(value);if(value.type==='hit'||value.type==='itemRejected'||value.type==='skillStopped')window.defenseObserved.combat.push({event:value,at:Date.now(),boost:JSON.parse(document.querySelector('#battle-status').dataset.world||'null')?.players.find(p=>p.id===value.targetId)?.defenseBoost});return event.call(this,value);};
  })()`);
}
try {
  const catalog = JSON.parse(await readFile('recovery/output/web-assets/combat-catalog.json', 'utf8'));
  evidence.skillDefinition = catalog.skills.find(row => row.skillId === 5);
  assert.equal(evidence.skillDefinition.attributes.Def, 30); assert.equal(evidence.skillDefinition.attributes.DefBonus, 20); assert.deepEqual(evidence.skillDefinition.functions[0], {type: 1, t: 10, x: 0, y: 0, z: 0});
  assert.deepEqual(evidence.skillDefinition.effects[0], {effectId: 108, sound: 'SE40', tag: 0, method: 3});
  await startServer();
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets', server: {port: 5208, strictPort: true, host: '127.0.0.1', hmr: false, proxy: {'/game': {target: 'ws://127.0.0.1:3166', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=9280', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank'], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9280/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
  }
  assert(endpoint, 'Dedicated Chromium failed to start');
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
  ws.on('close',()=>{for(const request of pending.values())request.reject(new Error('Browser CDP closed'));pending.clear();});
  ws.on('message', raw => {
    const message = JSON.parse(String(raw)), callback = pending.get(message.id);
    if (callback) {pending.delete(message.id); message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);}
    if (message.method !== 'Network.webSocketFrameReceived' || message.params.response.opcode !== 2) return;
    const bytes = new Uint8Array(Buffer.from(message.params.response.payloadData, 'base64'));
    if (bytes.length === 1 && bytes[0] === 0) return;
    const parsed = TransportDataUtil.parseServerOutout(decoder.tsbuffer, decoder.serviceMap, bytes);
    if (!parsed.isSucc) {evidence.decodeError = parsed.errMsg; return;}
    const result = parsed.result, page = message.sessionId;
    if (result.type === 'api') network.push({page, kind: 'api', name: result.service.name, success: result.ret.isSucc});
    else if (result.service.name === 'RoomSnapshot') network.push({page, kind: 'snapshot', ...result.msg});
    else if (result.service.name === 'RoomEvent') network.push({page, kind: 'event', receivedAt:Date.now(), ...result.msg});
  });
  for (let index = 0; index < 2; index++) {
    const {browserContextId} = await command('Target.createBrowserContext'); contexts.push(browserContextId);
    const {targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId});
    const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true}); pages.push({targetId, sessionId});
    await command('Network.enable', {}, sessionId);
    await command('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false}, sessionId);
    await command('Page.navigate', {url: 'http://127.0.0.1:5208'}, sessionId);
    await waitUntil(sessionId, `document.querySelector('#tank')?.options.length===21&&localStorage.getItem('cdtank-account-token')&&!document.querySelector('#start-cpu')?.disabled`);
    await installMonitor(sessionId);
  }
  const host = pages[0].sessionId, guest = pages[1].sessionId;
  const token = await evaluate(host, `localStorage.getItem('cdtank-account-token')`);
  store = new AccountStore(database); const owner = store.open(token);
  assert.deepEqual(store.inventory(owner.accountId).records, []);
  const native = JSON.parse(await readFile('recovery/output/world-role-attributes-native.json', 'utf8')).rows.find(row => row.tankId === 1 && row.part === 0);
  assert(native, 'Explicit original tank1/part0 owned-source fixture');
  const fields = value => new Map(Object.entries(value).map(([key, value]) => [Number(key), value]));
  evidence.ownedSource = {fixture: 'recovery/output/world-role-attributes-native.json', tankId: 1, part: 0, equipmentId: 72, textures: [10011,10012,10013], profile: {petField: '0xa4',equipmentField:'0xa8'}, accounts: []};
  for (const page of pages) {
    const account = store.open(await evaluate(page.sessionId, `localStorage.getItem('cdtank-account-token')`));
    const base = {name: '明确导入原宠物', fields: fields(native.base)};
    const equipment = {name: '明确导入原战车', fields: fields(native.equipment)};
    equipment.fields.set(0x1c, 72); equipment.fields.set(0x24, 1);
    equipment.fields.set(0x28, 10011);
    equipment.fields.set(0x2c, 10012);
    equipment.fields.set(0x30, 10013);
    store.replaceRoleRecords(account.accountId, {base: [base], equipment: [equipment]});
    const bytes = new Uint8Array(0x170), view = new DataView(bytes.buffer);
    view.setUint32(0xa4, base.fields.get(0), true); view.setUint32(0xa8, 72, true); view.setUint32(0x70, page.sessionId===host?100:0, true); view.setUint32(0x74, page.sessionId===host?40:0, true); assert.deepEqual(store.inventory(account.accountId).records, []);
    store.replaceRoleProfile(account.accountId, {bytes, strings: ['', '']});
    evidence.ownedSource.accounts.push(account.accountId);
  }
  const balances = () => {const p=store.roleProfile(owner.accountId);const v=new DataView(p.bytes.buffer,p.bytes.byteOffset,p.bytes.byteLength);return {money:v.getUint32(0x70,true),tokens:v.getUint32(0x74,true)};};
  await click(host, '#open-shop');
  await waitUntil(host, `document.querySelector('[data-shop-item]')?.options.length===7&&!document.querySelector('[data-shop-buy]').disabled`);
  assert.deepEqual(await evaluate(host, `Array.from(document.querySelector('[data-shop-item]').options).map(o=>Number(o.value))`), [1,2,4,5,6,7,8]);
  await evaluate(host, `document.querySelector('[data-shop-item]').value='5';document.querySelector('[data-shop-item]').dispatchEvent(new Event('change'));document.querySelector('[data-shop-quantity]').value='3'`);
  const product=await evaluate(host, `document.querySelector('[data-shop-product]').textContent`);
  assert(product.includes('每份20金币 / 20软星币'));evidence.shopProduct=product;
  await screenshot(host, 'shop');await click(host, '[data-shop-buy]');
  await waitUntil(host, `document.querySelector('[data-shop-status]').value.includes('×3')&&document.querySelector('#account-shop').dataset.purchasedInstance`);
  const instanceId=Number(await evaluate(host, `document.querySelector('#account-shop').dataset.purchasedInstance`));
  assert.equal(store.inventory(owner.accountId).records.find(r=>r.instanceId===instanceId).ownedQuantity,3);assert.deepEqual(balances(),{money:40,tokens:40});
  evidence.purchase={instanceId,quantity:3,balances:balances()};await click(host, '[data-shop-close]');
  await click(host, '#open-home'); await waitUntil(host, `document.querySelector('[data-source-control="rdoItem"]')`);
  await click(host, '[data-source-control="rdoItem"]'); await waitUntil(host, `document.querySelector('[data-inventory-instance="${instanceId}"]')`);
  await click(host, `[data-inventory-instance="${instanceId}"]`); await click(host, '[data-kitbag-slot="4"]');
  await waitUntil(host, `document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId===${JSON.stringify(String(instanceId))}`);
  evidence.configured = await evaluate(host, `({text:document.querySelector('[data-inventory-instance="${instanceId}"]').textContent,slot:document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId})`);
  await screenshot(host, 'home-before'); await click(host, '[data-home-close]');
  await click(host, '#create-room-controls summary');
  await evaluate(host, `for(const [selector,value]of [['#room-name','防御饮料验收'],['#room-mode','4'],['#room-map','7']]){const e=document.querySelector(selector);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}`);
  await click(host, '#create-room'); await waitUntil(host, `(${world})?.mapLoaded`);
  const waiting = await evaluate(host, world), roomId = waiting.roomId; evidence.playerId = waiting.playerId;
  for(let i=0;i<3;i++){await waitUntil(host, `document.querySelector('[data-add-cpu]')&&!document.querySelector('[data-add-cpu]').disabled`);await click(host,'[data-add-cpu]');await waitUntil(host, `(${world}).players.length===${i+2}`);} 
  await click(guest, '#refresh-rooms'); await waitUntil(guest, `Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})&&!document.querySelector('#join').disabled`);
  await evaluate(guest, `document.querySelector('#room').value=${JSON.stringify(roomId)}`); await click(guest, '#join');
  for (const {sessionId} of pages) await waitUntil(sessionId, `(${world})?.mapLoaded&&(${world}).renderedPlayers===5`);
  for (const session of [guest, host]) await click(session, '[data-ready]');
  for (const {sessionId} of pages) await waitUntil(sessionId, `(${world})?.phase==='PLAYING'`);
  async function visibleNaturalInjury(injury = true) {
    await evaluate(guest, `document.activeElement?.blur()`);
    const startFrames=await evaluate(guest, 'window.defenseObserved.frames');
    await waitUntil(guest, `window.defenseObserved.frames>=${startFrames+3}`);
    const deadline=Date.now()+180000;
    while(Date.now()<deadline){
      const observation=await evaluate(guest, `(()=>{const s=${world},owner=s.players.find(p=>p.id===${JSON.stringify(waiting.playerId)}),observer=s.players.find(p=>p.id===s.playerId),view=window.defenseBattle.players.get(owner.id),camera=window.defenseCamera;if(!view)return {visible:false};const p=camera.globalPosition,d=camera.getForwardRay().direction,x=view.root.position.x-p.x,y=view.root.position.y-p.y,z=view.root.position.z-p.z;return {visible:observer.alive&&owner.alive&&!window.defenseBattle.effects.clipped(view.root.position)&&(x*d.x+y*d.y+z*d.z)/Math.hypot(x,y,z)>.90,injured:owner.hp<owner.maxHp,frames:window.defenseObserved.frames,phase:s.phase}})()`);
      if(observation.visible&&(!injury||observation.injured))return await evaluate(host,world);
      assert.equal(observation.phase,'PLAYING','Visibility must occur during natural combat');
      await command('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65},guest);
      try {await pause(500);}finally {await command('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65},guest);}
      await waitUntil(guest, `window.defenseObserved.frames>=${observation.frames+1}`);
    }
    throw new Error('Natural role visibility/injury did not occur');
  }
  evidence.beforeCast=await visibleNaturalInjury(false);
  evidence.castRequestedAt = Date.now();
  await digit5(host);
  await waitUntil(host, `document.querySelector('[data-defense-boost-status]')&&!document.querySelector('[data-defense-boost-status]').hidden&&document.querySelector('[data-defense-boost-status]').textContent.includes('防御提升')&&document.querySelector('[data-defense-boost-status]').textContent.includes('剩余')`);
  evidence.visibleBoost = await evaluate(host, `document.querySelector('[data-defense-boost-status]').textContent`);
  await Promise.all(pages.map(({sessionId})=>waitUntil(sessionId, `window.defenseObserved.events.length===1`)));
  const activeNetwork = network.filter(row => row.kind === 'snapshot' && row.players.some(p => p.id === waiting.playerId && p.defenseBoost));
  const sameTick = activeNetwork.find(a => activeNetwork.some(b => b.page !== a.page && b.tick === a.tick));
  assert(sameTick, 'Both actual WebSocket streams must share an active tick');
  const counterpart = activeNetwork.find(b => b.page !== sameTick.page && b.tick === sameTick.tick);
  assert.deepEqual(sameTick.players, counterpart.players); evidence.sameTick = [sameTick, counterpart];
  evidence.active = [sameTick, counterpart];
  evidence.observed = await Promise.all(pages.map(p => evaluate(p.sessionId, 'window.defenseObserved')));
  assert.deepEqual(evidence.observed[0].events, evidence.observed[1].events);
  const event = evidence.observed[0].events[0];
  assert.equal(event.type, 'itemUsed'); assert.equal(event.skillId, 5); assert.equal(event.targetId, waiting.playerId);
  assert.deepEqual(event.playSkillEffect, {skillId: 5, effectIndex: 0, duration: 0, roleId: Number(waiting.playerId.slice(1)), xBits: 0, zBits: 0});
  const boosts = evidence.active.map(s => s.players.find(p => p.id === waiting.playerId).defenseBoost);
  assert.deepEqual(boosts[0], boosts[1]); assert.deepEqual({...boosts[0], expiresAt: 0}, {skillId: 5, expiresAt: 0, defensePercent: 30, defenseBonus: 20, baseDefense: boosts[0].baseDefense, boostedDefense: boosts[0].boostedDefense, source: 'original-attributes'});
  assert(boosts[0].expiresAt > Date.now() && boosts[0].expiresAt <= Date.now() + 10000);
  const inventory = () => store.inventory(owner.accountId).records.find(r => r.instanceId === instanceId);
  assert.equal(inventory().ownedQuantity, 2); evidence.afterCast = inventory();
  await digit5(host); await pause(300);
  evidence.rejectedRepeat = await evaluate(host, `(async()=>({events:window.defenseObserved.events.length,boost:(${world}).players.find(p=>p.id===${JSON.stringify(waiting.playerId)}).defenseBoost,inventory:await window.defenseBattle.inventory()}))()`);
  assert.equal(evidence.rejectedRepeat.events, 1); assert.deepEqual(evidence.rejectedRepeat.boost, boosts[0]); assert.equal(inventory().ownedQuantity, 2);assert(network.some(e=>e.kind==='event'&&e.type==='itemRejected'&&e.playerId===waiting.playerId));
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87},host);
  await Promise.all(pages.map(({sessionId})=>waitUntil(sessionId, `window.defenseObserved.actualDraws>0&&window.defenseObserved.sounds.some(s=>s.played)`)));
  evidence.observed = await Promise.all(pages.map(p => evaluate(p.sessionId, 'window.defenseObserved')));
  for (const row of evidence.observed) {
    assert.deepEqual(row.viewport, [1920, 1080]); assert.deepEqual(row.canvas, [1920, 1080]); assert.equal(row.scaling, 1); assert(row.frames > 0); assert(row.actualDraws > 0, 'Effect108 actual mesh draws'); assert(row.drawSubmissions > 0, 'Effect108 actual mesh submissions');
    assert(row.effects.some(e => e.id === 108 && e.handle > 0 && e.drawCount === 7 && e.actualTag === 'tag_efcenter' && e.parentReferenceMatches), 'Original Effect108 drawn on live source tag');
    assert.deepEqual(row.effects[0].nodeIds,[2918,2919,2920,2922,2923,2924,3106]);assert.equal(row.effects[0].rootId,2917);assert.equal(row.effects[0].treeNodes,11);
    assert.deepEqual(row.notifications, [{message:event.playSkillEffect,retained:0}]);
    assert(row.sounds.some(s => s.reference === 'SE40' && s.handle > 0 && s.context === 'running' && !s.loop && s.played), 'SE40 actual playback in both pages');
  }
  console.log('First original effect/audio observed in both pages; HUD and repeat captured during active boost');
  for (const [index, page] of pages.entries()) await screenshot(page.sessionId, `active-${index + 1}`);
  for (const {sessionId} of pages) await waitUntil(sessionId, `!Object.hasOwn((${world}).players.find(p=>p.id===${JSON.stringify(waiting.playerId)}),'defenseBoost')`, 15000);
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87},host);
  await waitUntil(host, `document.querySelector('[data-defense-boost-status]').hidden`);
  evidence.expired = await Promise.all(pages.map(p => evaluate(p.sessionId, world)));
  evidence.expiredAt = Date.now(); assert(evidence.expiredAt >= boosts[0].expiresAt);
  evidence.expiryTiming = {castRequestedAt: evidence.castRequestedAt, serverDeadline: boosts[0].expiresAt, observedExpiredAt: evidence.expiredAt};
  for (const {sessionId} of pages) await waitUntil(sessionId, `window.defenseObserved.sounds.some(s=>s.reference==='SE40'&&s.ended)`, 10000);
  evidence.endedSounds = await Promise.all(pages.map(p => evaluate(p.sessionId, 'window.defenseObserved.sounds')));
  for(const {sessionId}of pages)await waitUntil(sessionId, `!window.defenseRuntime.instances.some(i=>window.defenseObserved.effects.some(e=>e.handle===i.handle))&&window.defenseRuntime.skillSound.voices.size===0`,15000);
  evidence.visualAfterExpiry = await Promise.all(pages.map(p => evaluate(p.sessionId, `({instances:window.defenseRuntime.instances.length,voices:window.defenseRuntime.skillSound.voices.size,actualDraws:window.defenseObserved.actualDraws})`)));
  const ratio=(100+boosts[0].baseDefense)/(100+boosts[0].boostedDefense);assert(ratio<1);
  const cpuIds=evidence.active[0].players.filter(p=>p.isCpu).map(p=>p.id);
  const expiryRows=network.filter(row=>row.kind==='snapshot'&&row.serverTime>=boosts[0].expiresAt&&row.players.some(p=>p.id===waiting.playerId&&!p.defenseBoost));
  assert(expiryRows.length>0);const earliestClear=network.find(row=>row.kind==='snapshot'&&row.serverTime>=sameTick.serverTime&&row.players.some(p=>p.id===waiting.playerId&&!p.defenseBoost));
  assert(earliestClear.serverTime>=boosts[0].expiresAt,'First use must last until its natural server deadline');evidence.deadlineClear=earliestClear;
  async function naturalRound(round){const start=Date.now();while(Date.now()-start<330000){const pair=await Promise.all(pages.map(p=>evaluate(p.sessionId,world)));if(pair.every(s=>s.phase==='FINISHED')){assert.deepEqual(pair[0].match.result,pair[1].match.result);assert(pair[0].match.result.players.some(p=>p.kills>0));return {elapsedMs:Date.now()-start,pair};}await pause(1000);}throw new Error('Natural round '+round+' did not finish');}
  evidence.firstRound=await naturalRound(1);const restoredHit=network.find(hit=>hit.kind==='event'&&hit.type==='hit'&&hit.targetId===waiting.playerId&&cpuIds.includes(hit.playerId)&&hit.receivedAt>boosts[0].expiresAt&&Math.abs(hit.value-(35+TANKS.find(t=>t.id===evidence.active[0].players.find(p=>p.id===hit.playerId).tankId).attack*.08))<1e-5);assert(restoredHit,'Natural post-expiry CPU hit must restore raw damage');evidence.restoredHit=restoredHit;console.log('First natural round complete');
  await click(host,'[data-rematch]');await waitUntil(host, `(${world}).match.rematchPlayerIds.length===4`);await click(guest,'[data-rematch]');
  for(const {sessionId}of pages)await waitUntil(sessionId, `(${world}).phase==='PLAYING'&&(${world}).match.round===2`);
  evidence.reset=await Promise.all(pages.map(p=>evaluate(p.sessionId,world)));assert(evidence.reset.every(s=>s.players.every(p=>!p.defenseBoost&&p.alive&&p.hp===p.maxHp&&p.kills===0&&p.deaths===0)));
  evidence.secondBeforeCast=await visibleNaturalInjury(false);evidence.secondCastRequestedAt=Date.now();await digit5(host);
  await Promise.all(pages.map(({sessionId})=>waitUntil(sessionId, `window.defenseObserved.events.length===2&&window.defenseObserved.sounds.filter(s=>s.played).length===2`)));
  console.log('Second original effect/audio observed');
  evidence.secondUse=await Promise.all(pages.map(p=>evaluate(p.sessionId, `window.defenseObserved.events[1]`)));assert.deepEqual(evidence.secondUse[0],evidence.secondUse[1]);assert.deepEqual(evidence.secondUse[0].playSkillEffect,event.playSkillEffect);assert.equal(inventory().ownedQuantity,1);
  evidence.secondObserved=await Promise.all(pages.map(p=>evaluate(p.sessionId,'window.defenseObserved')));
  for(const r of evidence.secondObserved){assert.equal(r.effects.length,2);assert(r.effects.every(e=>e.id===108&&e.drawCount===7&&e.parentReferenceMatches));assert.equal(r.sounds.filter(s=>s.played).length,2);}
  const secondActive=network.filter(row=>row.kind==='snapshot'&&row.match?.round===2&&row.players.some(p=>p.id===waiting.playerId&&p.defenseBoost));
  const secondTick=secondActive.find(a=>secondActive.some(b=>b.page!==a.page&&a.tick===b.tick));assert(secondTick,'Both streams must carry round2 boost');
  const secondPair=secondActive.find(b=>b.page!==secondTick.page&&b.tick===secondTick.tick);assert.deepEqual(secondTick.players,secondPair.players);evidence.secondActive=[secondTick,secondPair];
  const secondBoost=secondTick.players.find(p=>p.id===waiting.playerId).defenseBoost;
  const hitDeadline=Date.now()+15000;let reduced;
  while(!reduced&&Date.now()<hitDeadline){reduced=network.find(hit=>{if(hit.kind!=='event'||hit.type!=='hit'||hit.targetId!==waiting.playerId||!cpuIds.includes(hit.playerId)||hit.receivedAt<evidence.secondCastRequestedAt)return false;const tankId=secondTick.players.find(p=>p.id===hit.playerId).tankId;const raw=35+TANKS.find(t=>t.id===tankId).attack*.08;return Math.abs(hit.value-raw*(100+secondBoost.baseDefense)/(100+secondBoost.boostedDefense))<1e-5;});if(!reduced)await pause(50);}
  assert(reduced,'Natural CPU projectile must apply incremental defense mitigation');const attacker=secondTick.players.find(p=>p.id===reduced.playerId);evidence.mitigation={event:reduced,attackerTankId:attacker.tankId,raw:35+TANKS.find(t=>t.id===attacker.tankId).attack*.08,ratio:(100+secondBoost.baseDefense)/(100+secondBoost.boostedDefense)};
  evidence.secondRound=await naturalRound(2);console.log('Second natural round complete');
  for (const {sessionId} of pages) {await click(sessionId, '#leave'); await waitUntil(sessionId, `!document.querySelector('#battle-status').dataset.world`);}
  assert.equal(await evaluate(host, `document.querySelector('[data-defense-boost-status]').hidden`), true);
  evidence.cleanup = await Promise.all(pages.map(p => evaluate(p.sessionId, `({instances:window.defenseRuntime.instances.length,voices:window.defenseRuntime.skillSound.voices.size})`)));
  for (const row of evidence.cleanup) assert.deepEqual(row, {instances: 0, voices: 0});
  store.close(); store = undefined; await stop(server); await startServer();
  await command('Page.reload', {}, host);
  await waitUntil(host, `!window.defenseObserved&&document.querySelector('#home-inventory')&&document.querySelector('#tank')?.options.length===21&&!document.querySelector('#start-cpu')?.disabled`);
  assert.equal(await evaluate(host, `localStorage.getItem('cdtank-account-token')`), token);store=new AccountStore(database);
  await click(host, '#open-home'); await waitUntil(host, `document.querySelector('[data-source-control="rdoItem"]')`); await click(host, '[data-source-control="rdoItem"]');
  await waitUntil(host, `document.querySelector('[data-inventory-instance="${instanceId}"]')?.textContent.includes('×1')&&document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId===${JSON.stringify(String(instanceId))}`);
  evidence.restart = await evaluate(host, `({text:document.querySelector('[data-inventory-instance="${instanceId}"]').textContent,slot:document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId})`);
  assert.deepEqual(balances(),{money:40,tokens:40});assert.equal(inventory().ownedQuantity,1);evidence.restartBalances=balances();
  await screenshot(host, 'restart-home'); assert.equal(evidence.decodeError, undefined);
  for (const {sessionId} of pages) assert(network.some(e => e.page === sessionId && e.kind === 'api' && e.name === 'Ready' && e.success));
  evidence.status = 'PASS'; await rm(`${output}-failure.png`, {force: true});
  console.log('PASS: two real 1080p pages, purchased defense drink, natural reduced CPU hits, Effect108/SE40/Tag0, ten-second nonstacking defense, two natural rounds, 3→2→1 stock, restart balances/slot4 and cleanup');
} catch (error) {
  evidence.status = 'FAIL'; evidence.error = String(error);
  if (pages[0]) {evidence.failure = await evaluate(pages[0].sessionId, `({world:${world},observed:window.defenseObserved,status:document.querySelector('#battle-status')?.value})`).catch(() => null); await screenshot(pages[0].sessionId, 'failure').catch(() => {});}
  throw error;
} finally {
  evidence.network = network.filter(e => e.kind !== 'snapshot' || e.players.some(p => p.defenseBoost));
  store?.close();
  if (ws?.readyState === WebSocket.OPEN) {for (const browserContextId of contexts) await command('Target.disposeBrowserContext', {browserContextId}).catch(() => {}); ws.close();}
  await vite?.close(); await stop(server); await stop(chrome); await rm(directory, {recursive: true, force: true});
  evidence.processCleanup = {serverExited: server?.exitCode !== null || server?.signalCode !== null, chromeExited: chrome?.exitCode !== null || chrome?.signalCode !== null};
  await writeFile(`${output}.json`, JSON.stringify(evidence, null, 2) + '\n'); await writeFile(`${output}.log`, serverLog);
}
