import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'vite';
import {AccountStore} from '../apps/server/src/account-store.ts';
import {serviceProto} from '../apps/shared/protocols/serviceProto.ts';

var require = createRequire(import.meta.url), WebSocket = require('ws');
var {WsClient} = require('tsrpc'), {TransportDataUtil} = require('tsrpc-base-client');
var decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3145', logger: undefined});
var directory = await mkdtemp(join(tmpdir(), 'cdtank-invincibility-'));
var database = join(directory, 'accounts.sqlite'), output = 'recovery/output/browser-invincibility';
var evidence = {status: 'RUNNING', scope: 'Two ordinary 1920x1080 pages at scaling 1, owned item8 stock, normal home slot4/create/join/Ready/Digit5, retained Effect100 with live tag and actual draws, no skill sound, authoritative nonstacking ten-second invincibility deadline, natural notification expiry, leave cleanup, real-server restart stock/slot persistence.', isolation: {server: 3145, vite: 5197, chrome: 9264}, limitation: 'Neutral human opponents establish notification/rendering/persistence behavior; authoritative natural combat immunity is verified separately by the CPU world test.'};
var pages = [], contexts = [], network = [], pending = new Map();
var sequence = 0, server, chrome, vite, ws, store, serverLog = '';
var pause = ms => new Promise(resolve => setTimeout(resolve, ms));
var world = `JSON.parse(document.querySelector('#battle-status')?.dataset.world??'null')`;
async function stop(child) {
  if (child?.exitCode === null) {
    var ended = new Promise(resolve => child.once('exit', resolve));
    child.kill(); await ended;
  }
}
async function startServer() {
  var startedLog = '';
  var env = {...process.env, PORT: '3145', ACCOUNT_DB_PATH: database};
  delete env.MATCH_TIME_LIMIT_SECONDS; delete env.MATCH_MIN_PLAYERS;
  server = spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/index.ts'], {env, stdio: ['ignore', 'pipe', 'pipe']});
  var append = data => {startedLog += String(data); serverLog += String(data);};
  server.stdout.on('data', append); server.stderr.on('data', append);
  var deadline = Date.now() + 15000;
  while (!startedLog.includes('Server started') && Date.now() < deadline && server.exitCode === null) await pause(20);
  assert(startedLog.includes('Server started'), startedLog);
}
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    var id = ++sequence; pending.set(id, {resolve, reject});
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
    try {if (await evaluate(session, expression)) return;} catch (error) {
      if (!String(error).includes('Execution context was destroyed')) throw error;
    }
    await pause(50);
  }
  throw new Error('Browser condition timeout: ' + expression);
}
async function click(session, selector) {
  var point = await evaluate(session, `(()=>{var e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});var r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  for (var type of ['mousePressed', 'mouseReleased']) await command('Input.dispatchMouseEvent', {type, button: 'left', clickCount: 1, ...point}, session);
}
async function digit5(session) {
  await evaluate(session, `document.activeElement?.blur();document.querySelector('#world').focus();`);
  for (var type of ['keyDown', 'keyUp']) await command('Input.dispatchKeyEvent', {type, key: '5', code: 'Digit5', windowsVirtualKeyCode: 53}, session);
}
async function screenshot(session, name) {
  var shot = await command('Page.captureScreenshot', {format: 'png'}, session);
  await writeFile(`${output}-${name}.png`, Buffer.from(shot.data, 'base64'));
}
async function installMonitor(session) {
  await evaluate(session, `(async()=>{
    var source=await(await fetch('/src/main.ts')).text(),url=source.match(/from "([^"]*@babylonjs_core.js[^"]*)"/)[1];
    var {EngineStore}=await import(url),engine=EngineStore.LastCreatedEngine;
    engine.setHardwareScalingLevel(1);engine.resize();
    window.invincibleObserved={effects:[],sounds:[],events:[],frames:0,actualDraws:0,drawSubmissions:0,canvas:[engine.getRenderWidth(),engine.getRenderHeight()],scaling:engine.getHardwareScalingLevel(),viewport:[innerWidth,innerHeight],renderer:engine.getGlInfo()};
    EngineStore.LastCreatedScene.onAfterRenderObservable.add(()=>window.invincibleObserved.frames++);
    var {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');
    var {EFFECT_PRIMARY_TAGS}=await import('/src/assets/tanks/effect-tag-matrices.ts');
    var attached=EffectRuntime.prototype.spawnAttachedEffect;
    EffectRuntime.prototype.spawnAttachedEffect=function(view,id,tag,once,local){
      var handle=attached.call(this,view,id,tag,once,local);
      if(id===100){window.invincibleRuntime=this;var instance=this.instances.find(i=>i.handle===handle);
        window.invincibleObserved.effects.push({handle,id,tag,once,drawCount:instance?.draws.length??0,actualTag:EFFECT_PRIMARY_TAGS[tag],parentReferenceMatches:!!instance&&instance.tree.parentMatrix===view.primaryTag(EFFECT_PRIMARY_TAGS[tag])});}
      return handle;
    };
    var sound=EffectRuntime.prototype.playSkillSound;
    EffectRuntime.prototype.playSkillSound=function(view,reference,selector){
      var handle=sound.call(this,view,reference,selector);
      window.invincibleObserved.sounds.push({handle,reference,selector});return handle;
    };
    var draw=EffectRuntime.prototype.draw;
    EffectRuntime.prototype.draw=function(instance,node){
      var result=draw.call(this,instance,node);
      if(window.invincibleObserved.effects.some(e=>e.handle===instance.handle)){
        var meshes=[node.sprite?.mesh,node.particle?.sprite.mesh,node.overlay?.mesh,...(node.model?.meshes??[])].filter(Boolean);
        if(meshes.some(m=>m.isEnabled()&&m.getTotalVertices()>0))window.invincibleObserved.drawSubmissions++;
        for(var mesh of meshes)if(!mesh.invincibilityMonitor){mesh.invincibilityMonitor=true;mesh.onAfterRenderObservable.add(()=>window.invincibleObserved.actualDraws++);}
      }
      return result;
    };
    var {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
    Battle.prototype.reconcile=function(...args){window.invincibleBattle=this;return reconcile.apply(this,args);};
    var {BattleSkillEffects}=await import('/src/match/skills/battle-skill-effects.ts'),event=BattleSkillEffects.prototype.event;
    BattleSkillEffects.prototype.event=function(value){window.invincibleNotifications=this.notifications;if(value.type==='itemUsed')window.invincibleObserved.events.push(value);return event.call(this,value);};
  })()`);
}
try {
  var catalog = JSON.parse(await readFile('recovery/output/web-assets/combat-catalog.json', 'utf8'));
  evidence.source = {catalog: 'recovery/output/web-assets/combat-catalog.json', recovered: 'Skill8 type6 t10, Effect100/index0/tag0/sound0; retained skill8 notification scheduler.', reconstruction: 'Authoritative damage immunity, nonstacking consumption and server millisecond expiry are rebuilt gameplay rules.'};
  evidence.skillDefinition = catalog.skills.find(row => row.skillId === 8);
  assert.deepEqual(evidence.skillDefinition.functions[0], {type: 6, t: 10, x: 0, y: 0, z: 0});
  assert.deepEqual(evidence.skillDefinition.effects[0], {effectId: 100, sound: '0', tag: 0, method: 3});
  await startServer();
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets', server: {port: 5197, strictPort: true, host: '127.0.0.1', hmr: false, proxy: {'/game': {target: 'ws://127.0.0.1:3145', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=9264', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank'], {stdio: 'ignore'});
  var endpoint;
  for (var attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9264/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
  }
  assert(endpoint, 'Dedicated Chromium failed to start');
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
  ws.on('message', raw => {
    var message = JSON.parse(String(raw)), callback = pending.get(message.id);
    if (callback) {pending.delete(message.id); message.error ? callback.reject(new Error(JSON.stringify(message.error))) : callback.resolve(message.result);}
    if (message.method !== 'Network.webSocketFrameReceived' || message.params.response.opcode !== 2) return;
    var bytes = new Uint8Array(Buffer.from(message.params.response.payloadData, 'base64'));
    if (bytes.length === 1 && bytes[0] === 0) return;
    var parsed = TransportDataUtil.parseServerOutout(decoder.tsbuffer, decoder.serviceMap, bytes);
    if (!parsed.isSucc) {evidence.decodeError = parsed.errMsg; return;}
    var result = parsed.result, page = message.sessionId;
    if (result.type === 'api') network.push({page, kind: 'api', name: result.service.name, success: result.ret.isSucc});
    else if (result.service.name === 'RoomSnapshot') network.push({page, kind: 'snapshot', ...result.msg});
    else if (result.service.name === 'BattleEvent') network.push({page, kind: 'event', ...result.msg});
  });
  for (var index = 0; index < 2; index++) {
    var {browserContextId} = await command('Target.createBrowserContext'); contexts.push(browserContextId);
    var {targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId});
    var {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true}); pages.push({targetId, sessionId});
    await command('Network.enable', {}, sessionId);
    await command('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false}, sessionId);
    await command('Page.navigate', {url: 'http://127.0.0.1:5197'}, sessionId);
    await waitUntil(sessionId, `document.querySelector('#tank')?.options.length===21&&localStorage.getItem('cdtank-account-token')&&!document.querySelector('#start-cpu')?.disabled`);
    await installMonitor(sessionId);
  }
  var host = pages[0].sessionId, guest = pages[1].sessionId;
  var token = await evaluate(host, `localStorage.getItem('cdtank-account-token')`);
  store = new AccountStore(database); var owner = store.open(token);
  store.replaceInventory(owner.accountId, [{instanceId: 77, itemTableId: 8, ownedQuantity: 3, battleQuantity: 0, state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}]);
  await click(host, '#open-home'); await waitUntil(host, `document.querySelector('[data-source-control="rdoItem"]')`);
  await click(host, '[data-source-control="rdoItem"]'); await waitUntil(host, `document.querySelector('[data-inventory-instance="77"]')`);
  await click(host, '[data-inventory-instance="77"]'); await click(host, '[data-kitbag-slot="4"]');
  await waitUntil(host, `document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='77'`);
  evidence.configured = await evaluate(host, `({text:document.querySelector('[data-inventory-instance="77"]').textContent,slot:document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId})`);
  await screenshot(host, 'home-before'); await click(host, '[data-home-close]');
  await click(host, '#create-room-controls summary');
  await evaluate(host, `for(var [selector,value]of [['#room-name','无敌道具验收'],['#room-mode','4'],['#room-map','7']]){var e=document.querySelector(selector);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}`);
  await click(host, '#create-room'); await waitUntil(host, `(${world})?.mapLoaded`);
  var waiting = await evaluate(host, world), roomId = waiting.roomId; evidence.playerId = waiting.playerId;
  await click(guest, '#refresh-rooms'); await waitUntil(guest, `Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})&&!document.querySelector('#join').disabled`);
  await evaluate(guest, `document.querySelector('#room').value=${JSON.stringify(roomId)}`); await click(guest, '#join');
  for (var {sessionId} of pages) await waitUntil(sessionId, `(${world})?.mapLoaded&&(${world}).renderedPlayers===2`);
  for (var session of [guest, host]) await click(session, '[data-ready]');
  for (var {sessionId} of pages) await waitUntil(sessionId, `(${world})?.phase==='PLAYING'`);
  await digit5(host);
  for (var {sessionId} of pages) await waitUntil(sessionId, `window.invincibleObserved.events.length===1&&(${world}).players.find(p=>p.id===${JSON.stringify(waiting.playerId)})?.invincibility`);
  await waitUntil(host, `document.querySelector('[data-invincibility-status]')&&!document.querySelector('[data-invincibility-status]').hidden&&document.querySelector('[data-invincibility-status]').textContent.includes('无敌')`);
  evidence.visibleInvincibility = await evaluate(host, `document.querySelector('[data-invincibility-status]').textContent`);
  await waitUntil(host, `window.invincibleObserved.actualDraws>0`, 8000);
  for(var {sessionId} of pages)await waitUntil(sessionId, `window.invincibleObserved.drawSubmissions>0`, 8000);
  evidence.active = await Promise.all(pages.map(p => evaluate(p.sessionId, world)));
  evidence.observed = await Promise.all(pages.map(p => evaluate(p.sessionId, 'window.invincibleObserved')));
  assert.deepEqual(evidence.observed[0].events, evidence.observed[1].events);
  var event = evidence.observed[0].events[0];
  assert.equal(event.type, 'itemUsed'); assert.equal(event.skillId, 8); assert.equal(event.targetId, waiting.playerId);
  assert.deepEqual(event.playSkillEffect, {skillId: 8, effectIndex: 0, duration: 10, roleId: Number(waiting.playerId.slice(1)), xBits: 0, zBits: 0});
  var buffs = evidence.active.map(s => s.players.find(p => p.id === waiting.playerId).invincibility);
  assert.deepEqual(buffs[0], buffs[1]); assert.deepEqual({...buffs[0], expiresAt: 0}, {skillId: 8, expiresAt: 0});
  assert(buffs[0].expiresAt > Date.now() && buffs[0].expiresAt <= Date.now() + 10000);
  for (var row of evidence.observed) {
    assert.deepEqual(row.viewport, [1920, 1080]); assert.deepEqual(row.canvas, [1920, 1080]); assert.equal(row.scaling, 1); assert(row.frames > 0); assert(row.drawSubmissions > 0, 'Effect100 generated actual mesh draw submissions');
    assert(row.effects.some(e => e.id === 100 && e.handle > 0 && e.drawCount > 0 && e.actualTag === 'tag_efcenter' && e.parentReferenceMatches), 'Original retained Effect100 bound to live source tag');
    assert.deepEqual(row.sounds, [{handle: 0, reference: '0', selector: -1}]);
  }
  var inventory = () => store.inventory(owner.accountId).records.find(r => r.instanceId === 77);
  assert.equal(inventory().ownedQuantity, 2); evidence.afterCast = inventory();
  await digit5(host); await pause(300);
  evidence.rejectedRepeat = await evaluate(host, `({events:window.invincibleObserved.events.length,invincibility:(${world}).players.find(p=>p.id===${JSON.stringify(waiting.playerId)}).invincibility,inventory:window.invincibleBattle.inventory()})`);
  assert.equal(evidence.rejectedRepeat.events, 1); assert.deepEqual(evidence.rejectedRepeat.invincibility, buffs[0]); assert.equal(inventory().ownedQuantity, 2);
  evidence.retained = await Promise.all(pages.map(p => evaluate(p.sessionId, `window.invincibleNotifications.records`)));
  for (var records of evidence.retained) {assert.equal(records.length, 1);assert.equal(records[0].skillId, 8);assert.equal(records[0].effectIndex, 0);assert(records[0].duration > 0);assert(records[0].effect > 0);assert.equal(records[0].sound, 0);}
  var samples = [];
  while(Date.now() < buffs[0].expiresAt - 1000){
    var sample = {at: Date.now(), pages: await Promise.all(pages.map(p => evaluate(p.sessionId, `({records:window.invincibleNotifications.records,instances:window.invincibleRuntime.instances.filter(i=>window.invincibleObserved.effects.some(e=>e.handle===i.handle)).map(i=>i.handle),actualDraws:window.invincibleObserved.actualDraws,drawSubmissions:window.invincibleObserved.drawSubmissions,voices:window.invincibleRuntime.skillSound.voices.size})`)))};
    for(var row of sample.pages){assert.equal(row.records.length,1);assert.equal(row.instances.length,1);assert.equal(row.voices,0);}
    samples.push(sample);await pause(500);
  }
  assert(samples.length>=2, 'Observed retained effect before its natural deadline');
  for(var index=0;index<2;index++)assert(samples.at(-1).pages[index].drawSubmissions>samples[0].pages[index].drawSubmissions, 'Effect100 mesh draw submissions continue before expiry');
  assert(samples.at(-1).pages[0].actualDraws>samples[0].pages[0].actualDraws, 'Host Effect100 actual scene draws continue before expiry');
  evidence.activeSamples=samples;
  for (var [index, page] of pages.entries()) await screenshot(page.sessionId, `active-${index + 1}`);
  for (var {sessionId} of pages) await waitUntil(sessionId, `!Object.hasOwn((${world}).players.find(p=>p.id===${JSON.stringify(waiting.playerId)}),'invincibility')`, 15000);
  await waitUntil(host, `document.querySelector('[data-invincibility-status]').hidden`);
  evidence.expired = await Promise.all(pages.map(p => evaluate(p.sessionId, world)));
  evidence.expiredAt = Date.now(); assert(evidence.expiredAt >= buffs[0].expiresAt);
  for (var {sessionId} of pages) await waitUntil(sessionId, `window.invincibleNotifications.records.length===0&&!window.invincibleRuntime.instances.some(i=>window.invincibleObserved.effects.some(e=>e.handle===i.handle))`, 15000);
  evidence.effectExpiredAt=Date.now();
  evidence.expiryTiming={serverDeadline:buffs[0].expiresAt,snapshotObservedAt:evidence.expiredAt,effectObservedAt:evidence.effectExpiredAt,observationDelayMs:evidence.effectExpiredAt-buffs[0].expiresAt,explanation:'Authoritative invincibility expires on the server millisecond deadline. Server StopSkillEffect8 clears the retained effect at the authoritative deadline; its natural source 30-step duration scheduler also runs independently. Observation occurs after two active PNG captures, whose processing can cross the deadline; this delay measures observation time rather than lifetime.'};
  evidence.naturalExpiry=await Promise.all(pages.map(p=>evaluate(p.sessionId, `({records:window.invincibleNotifications.records,instances:window.invincibleRuntime.instances.filter(i=>window.invincibleObserved.effects.some(e=>e.handle===i.handle)).length,voices:window.invincibleRuntime.skillSound.voices.size})`)));
  for(var row of evidence.naturalExpiry)assert.deepEqual(row,{records:[],instances:0,voices:0});
  var activeNetwork = network.filter(row => row.kind === 'snapshot' && row.players.some(p => p.id === waiting.playerId && p.invincibility));
  var sameTick = activeNetwork.find(a => activeNetwork.some(b => b.page !== a.page && b.tick === a.tick));
  assert(sameTick, 'Both actual WebSocket streams must share an active tick');
  var counterpart = activeNetwork.find(b => b.page !== sameTick.page && b.tick === sameTick.tick);
  assert.deepEqual(sameTick.players, counterpart.players); evidence.sameTick = [sameTick, counterpart];
  for (var {sessionId} of pages) {await click(sessionId, '#leave'); await waitUntil(sessionId, `!document.querySelector('#battle-status').dataset.world`);}
  assert.equal(await evaluate(host, `document.querySelector('[data-invincibility-status]').hidden`), true);
  evidence.cleanup = await Promise.all(pages.map(p => evaluate(p.sessionId, `({instances:window.invincibleRuntime.instances.length,voices:window.invincibleRuntime.skillSound.voices.size,records:window.invincibleNotifications.records.length})`)));
  for (var row of evidence.cleanup) assert.deepEqual(row, {instances: 0, voices: 0, records: 0});
  store.close(); store = undefined; await stop(server); await startServer();
  await command('Page.reload', {}, host);
  await waitUntil(host, `!window.invincibleObserved&&document.querySelector('#home-inventory')&&document.querySelector('#tank')?.options.length===21&&!document.querySelector('#start-cpu')?.disabled`);
  assert.equal(await evaluate(host, `localStorage.getItem('cdtank-account-token')`), token);
  await click(host, '#open-home'); await waitUntil(host, `document.querySelector('[data-source-control="rdoItem"]')`); await click(host, '[data-source-control="rdoItem"]');
  await waitUntil(host, `document.querySelector('[data-inventory-instance="77"]')?.textContent.includes('×2')&&document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='77'`);
  evidence.restart = await evaluate(host, `({text:document.querySelector('[data-inventory-instance="77"]').textContent,slot:document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId})`);
  await screenshot(host, 'restart-home'); assert.equal(evidence.decodeError, undefined);
  for (var {sessionId} of pages) assert(network.some(e => e.page === sessionId && e.kind === 'api' && e.name === 'Ready' && e.success));
  evidence.status = 'PASS'; await rm(`${output}-failure.png`, {force: true});
  console.log('PASS: two real 1080p pages, normal owned item8, retained Effect100/tag actual draws, no skill sound, nonstacking 10s invincibility, 3→2 stock, natural expiry, leave cleanup and restart slot4 persistence');
} catch (error) {
  evidence.status = 'FAIL'; evidence.error = String(error);
  if (pages[0]) {evidence.failure = await evaluate(pages[0].sessionId, `({world:${world},observed:window.invincibleObserved,status:document.querySelector('#battle-status')?.value})`).catch(() => null); await screenshot(pages[0].sessionId, 'failure').catch(() => {});}
  throw error;
} finally {
  evidence.network = network.filter(e => e.kind !== 'snapshot' || e.players.some(p => p.invincibility));
  store?.close();
  if (ws?.readyState === WebSocket.OPEN) {for (var browserContextId of contexts) await command('Target.disposeBrowserContext', {browserContextId}).catch(() => {}); ws.close();}
  await vite?.close(); await stop(server); await stop(chrome); await rm(directory, {recursive: true, force: true});
  evidence.processCleanup = {serverExited: server?.exitCode !== null || server?.signalCode !== null, chromeExited: chrome?.exitCode !== null || chrome?.signalCode !== null};
  await writeFile(`${output}.json`, JSON.stringify(evidence, null, 2) + '\n'); await writeFile(`${output}.log`, serverLog);
}
