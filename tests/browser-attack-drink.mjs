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
const decoder = new WsClient(serviceProto, {server: 'ws://127.0.0.1:3143', logger: undefined});
const directory = await mkdtemp(join(tmpdir(), 'cdtank-attack-drink-'));
const database = join(directory, 'accounts.sqlite'), output = 'recovery/output/browser-attack-drink';
const evidence = {status: 'RUNNING', scope: 'Two ordinary 1920x1080 webpages, hardware scaling 1, operator-owned item4 stock import, normal home slot4/room/join/Ready/Digit5, real notifications/Effect106/SE38, authoritative nonstacking ten-second attack buff, leave cleanup and real-server restart persistence. Attack buff success, nonstacking and damage rules are reconstructed; recovered catalog proves +100%/+20/ten-second item description and original effect/sound references. No position, HP, damage or outcome injection.', isolation: {server: 3143, vite: 5196, chrome: 9263}, limitation: 'Effect106 embedded type4 node2915 references ww051, missing from owned loose files and archives. SE38 is present; this run verifies its playback and available geometry, not completion of the missing embedded sound.'};
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
  const env = {...process.env, PORT: '3143', ACCOUNT_DB_PATH: database};
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
    window.attackObserved={effects:[],sounds:[],events:[],frames:0,canvas:[engine.getRenderWidth(),engine.getRenderHeight()],scaling:engine.getHardwareScalingLevel(),viewport:[innerWidth,innerHeight],renderer:engine.getGlInfo()};
    EngineStore.LastCreatedScene.onAfterRenderObservable.add(()=>window.attackObserved.frames++);
    const {EffectRuntime}=await import('/src/render/effects/runtime/effect-runtime.ts');
    const {EFFECT_PRIMARY_TAGS}=await import('/src/assets/tanks/effect-tag-matrices.ts');
    const attached=EffectRuntime.prototype.spawnAttachedEffect;
    EffectRuntime.prototype.spawnAttachedEffect=function(view,id,tag,once,local){
      const handle=attached.call(this,view,id,tag,once,local);
      if(id===106){window.attackRuntime=this;const instance=this.instances.find(i=>i.handle===handle);
        window.attackObserved.effects.push({handle,id,tag,once,drawCount:instance?.draws.length??0,actualTag:EFFECT_PRIMARY_TAGS[tag],parentReferenceMatches:!!instance&&instance.tree.parentMatrix===view.primaryTag(EFFECT_PRIMARY_TAGS[tag])});}
      return handle;
    };
    const sound=EffectRuntime.prototype.playSkillSound;
    EffectRuntime.prototype.playSkillSound=function(view,reference,selector){
      const handle=sound.call(this,view,reference,selector);
      if(reference==='SE38'){window.attackRuntime=this;const voice=this.skillSound.voices.get(handle),row={handle,reference,selector,src:voice?.audio.src,loop:voice?.audio.loop,context:this.skillSound.context?.state,played:false,ended:false};
        voice?.audio.addEventListener('playing',()=>row.played=true);voice?.audio.addEventListener('ended',()=>row.ended=true);window.attackObserved.sounds.push(row);}
      return handle;
    };
    const {Battle}=await import('/src/match/battle.ts'),reconcile=Battle.prototype.reconcile;
    Battle.prototype.reconcile=function(...args){window.attackBattle=this;return reconcile.apply(this,args);};
    const {BattleSkillEffects}=await import('/src/match/skills/battle-skill-effects.ts'),event=BattleSkillEffects.prototype.event;
    BattleSkillEffects.prototype.event=function(value){if(value.type==='itemUsed')window.attackObserved.events.push(value);return event.call(this,value);};
  })()`);
}
try {
  const catalog = JSON.parse(await readFile('recovery/output/web-assets/combat-catalog.json', 'utf8'));
  evidence.skillDefinition = catalog.skills.find(row => row.skillId === 4);
  assert.equal(evidence.skillDefinition.attributes.Atk, 100); assert.equal(evidence.skillDefinition.attributes.AtkBonus, 20);
  assert.deepEqual(evidence.skillDefinition.effects[0], {effectId: 106, sound: 'SE38', tag: 0, method: 3});
  await startServer();
  vite = await createServer({configFile: false, root: 'apps/web', publicDir: '../../recovery/output/web-assets', server: {port: 5196, strictPort: true, host: '127.0.0.1', hmr: false, proxy: {'/game': {target: 'ws://127.0.0.1:3143', ws: true, rewrite: () => '/'}}}});
  await vite.listen();
  chrome = spawn(process.env.CDTANK_CHROME ?? '/home/node/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--remote-debugging-port=9263', `--user-data-dir=${join(directory, 'chrome')}`, 'about:blank'], {stdio: 'ignore'});
  let endpoint;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {endpoint = (await (await fetch('http://127.0.0.1:9263/json/version')).json()).webSocketDebuggerUrl; break;} catch {await pause(50);}
  }
  assert(endpoint, 'Dedicated Chromium failed to start');
  ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {ws.once('open', resolve); ws.once('error', reject);});
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
    else if (result.service.name === 'BattleEvent') network.push({page, kind: 'event', ...result.msg});
  });
  for (let index = 0; index < 2; index++) {
    const {browserContextId} = await command('Target.createBrowserContext'); contexts.push(browserContextId);
    const {targetId} = await command('Target.createTarget', {url: 'about:blank', browserContextId});
    const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true}); pages.push({targetId, sessionId});
    await command('Network.enable', {}, sessionId);
    await command('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false}, sessionId);
    await command('Page.navigate', {url: 'http://127.0.0.1:5196'}, sessionId);
    await waitUntil(sessionId, `document.querySelector('#tank')?.options.length===21&&localStorage.getItem('cdtank-account-token')&&!document.querySelector('#start-cpu')?.disabled`);
    await installMonitor(sessionId);
  }
  const host = pages[0].sessionId, guest = pages[1].sessionId;
  const token = await evaluate(host, `localStorage.getItem('cdtank-account-token')`);
  store = new AccountStore(database); const owner = store.open(token);
  store.replaceInventory(owner.accountId, [{instanceId: 77, itemTableId: 4, ownedQuantity: 3, battleQuantity: 0, state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}]);
  await click(host, '#open-home'); await waitUntil(host, `document.querySelector('[data-source-control="rdoItem"]')`);
  await click(host, '[data-source-control="rdoItem"]'); await waitUntil(host, `document.querySelector('[data-inventory-instance="77"]')`);
  await click(host, '[data-inventory-instance="77"]'); await click(host, '[data-kitbag-slot="4"]');
  await waitUntil(host, `document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='77'`);
  evidence.configured = await evaluate(host, `({text:document.querySelector('[data-inventory-instance="77"]').textContent,slot:document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId})`);
  await screenshot(host, 'home-before'); await click(host, '[data-home-close]');
  await click(host, '#create-room-controls summary');
  await evaluate(host, `for(const [selector,value]of [['#room-name','攻击饮料验收'],['#room-mode','4'],['#room-map','7']]){const e=document.querySelector(selector);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}`);
  await click(host, '#create-room'); await waitUntil(host, `(${world})?.mapLoaded`);
  const waiting = await evaluate(host, world), roomId = waiting.roomId; evidence.playerId = waiting.playerId;
  await click(guest, '#refresh-rooms'); await waitUntil(guest, `Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(roomId)})&&!document.querySelector('#join').disabled`);
  await evaluate(guest, `document.querySelector('#room').value=${JSON.stringify(roomId)}`); await click(guest, '#join');
  for (const {sessionId} of pages) await waitUntil(sessionId, `(${world})?.mapLoaded&&(${world}).renderedPlayers===2`);
  for (const session of [guest, host]) await click(session, '[data-ready]');
  for (const {sessionId} of pages) await waitUntil(sessionId, `(${world})?.phase==='PLAYING'`);
  await digit5(host);
  for (const {sessionId} of pages) await waitUntil(sessionId, `window.attackObserved.events.length===1&&window.attackObserved.sounds.some(s=>s.played)&&(${world}).players.find(p=>p.id===${JSON.stringify(waiting.playerId)})?.attackBoost`);
  await waitUntil(host, `document.querySelector('[data-attack-boost-status]')&&!document.querySelector('[data-attack-boost-status]').hidden&&document.querySelector('[data-attack-boost-status]').textContent.includes('100%')&&document.querySelector('[data-attack-boost-status]').textContent.includes('20')`);
  evidence.visibleBoost = await evaluate(host, `document.querySelector('[data-attack-boost-status]').textContent`);
  evidence.active = await Promise.all(pages.map(p => evaluate(p.sessionId, world)));
  evidence.observed = await Promise.all(pages.map(p => evaluate(p.sessionId, 'window.attackObserved')));
  assert.deepEqual(evidence.observed[0].events, evidence.observed[1].events);
  const event = evidence.observed[0].events[0];
  assert.equal(event.type, 'itemUsed'); assert.equal(event.skillId, 4); assert.equal(event.targetId, waiting.playerId);
  assert.deepEqual(event.playSkillEffect, {skillId: 4, effectIndex: 0, duration: 0, roleId: Number(waiting.playerId.slice(1)), xBits: 0, zBits: 0});
  const boosts = evidence.active.map(s => s.players.find(p => p.id === waiting.playerId).attackBoost);
  assert.deepEqual(boosts[0], boosts[1]); assert.deepEqual({...boosts[0], expiresAt: 0}, {skillId: 4, expiresAt: 0, attackPercent: 100, attackBonus: 20});
  assert(boosts[0].expiresAt > Date.now() && boosts[0].expiresAt <= Date.now() + 10000);
  for (const row of evidence.observed) {
    assert.deepEqual(row.viewport, [1920, 1080]); assert.deepEqual(row.canvas, [1920, 1080]); assert.equal(row.scaling, 1); assert(row.frames > 0);
    assert(row.effects.some(e => e.id === 106 && e.handle > 0 && e.drawCount > 0 && e.actualTag === 'tag_efcenter' && e.parentReferenceMatches), 'Original Effect106 drawn on live source tag');
    assert(row.sounds.some(s => s.reference === 'SE38' && s.handle > 0 && s.context === 'running' && !s.loop && s.played), 'SE38 actual playback in both pages');
  }
  const inventory = () => store.inventory(owner.accountId).records.find(r => r.instanceId === 77);
  assert.equal(inventory().ownedQuantity, 2); evidence.afterCast = inventory();
  await digit5(host); await pause(300);
  evidence.rejectedRepeat = await evaluate(host, `({events:window.attackObserved.events.length,boost:(${world}).players.find(p=>p.id===${JSON.stringify(waiting.playerId)}).attackBoost,inventory:window.attackBattle.inventory()})`);
  assert.equal(evidence.rejectedRepeat.events, 1); assert.deepEqual(evidence.rejectedRepeat.boost, boosts[0]); assert.equal(inventory().ownedQuantity, 2);
  for (const [index, page] of pages.entries()) await screenshot(page.sessionId, `active-${index + 1}`);
  for (const {sessionId} of pages) await waitUntil(sessionId, `!Object.hasOwn((${world}).players.find(p=>p.id===${JSON.stringify(waiting.playerId)}),'attackBoost')`, 15000);
  await waitUntil(host, `document.querySelector('[data-attack-boost-status]').hidden`);
  evidence.expired = await Promise.all(pages.map(p => evaluate(p.sessionId, world)));
  evidence.expiredAt = Date.now(); assert(evidence.expiredAt >= boosts[0].expiresAt);
  const activeNetwork = network.filter(row => row.kind === 'snapshot' && row.players.some(p => p.id === waiting.playerId && p.attackBoost));
  const sameTick = activeNetwork.find(a => activeNetwork.some(b => b.page !== a.page && b.tick === a.tick));
  assert(sameTick, 'Both actual WebSocket streams must share an active tick');
  const counterpart = activeNetwork.find(b => b.page !== sameTick.page && b.tick === sameTick.tick);
  assert.deepEqual(sameTick.players, counterpart.players); evidence.sameTick = [sameTick, counterpart];
  for (const {sessionId} of pages) {await click(sessionId, '#leave'); await waitUntil(sessionId, `!document.querySelector('#battle-status').dataset.world`);}
  assert.equal(await evaluate(host, `document.querySelector('[data-attack-boost-status]').hidden`), true);
  evidence.cleanup = await Promise.all(pages.map(p => evaluate(p.sessionId, `({instances:window.attackRuntime.instances.length,voices:window.attackRuntime.skillSound.voices.size})`)));
  for (const row of evidence.cleanup) assert.deepEqual(row, {instances: 0, voices: 0});
  store.close(); store = undefined; await stop(server); await startServer();
  await command('Page.reload', {}, host);
  await waitUntil(host, `document.querySelector('#tank')?.options.length===21&&!document.querySelector('#start-cpu')?.disabled`);
  assert.equal(await evaluate(host, `localStorage.getItem('cdtank-account-token')`), token);
  await click(host, '#open-home'); await waitUntil(host, `document.querySelector('[data-source-control="rdoItem"]')`); await click(host, '[data-source-control="rdoItem"]');
  await waitUntil(host, `document.querySelector('[data-inventory-instance="77"]')?.textContent.includes('×2')&&document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId==='77'`);
  evidence.restart = await evaluate(host, `({text:document.querySelector('[data-inventory-instance="77"]').textContent,slot:document.querySelector('[data-kitbag-slot="4"]').dataset.instanceId})`);
  await screenshot(host, 'restart-home'); assert.equal(evidence.decodeError, undefined);
  for (const {sessionId} of pages) assert(network.some(e => e.page === sessionId && e.kind === 'api' && e.name === 'Ready' && e.success));
  evidence.status = 'PASS'; await rm(`${output}-failure.png`, {force: true});
  console.log('PASS: two real 1080p pages, normal owned attack drink, Effect106/SE38/tag draws, authoritative +100%/+20 nonstacking 10s buff, 3→2 stock, leave cleanup and restart slot4 persistence');
} catch (error) {
  evidence.status = 'FAIL'; evidence.error = String(error);
  if (pages[0]) {evidence.failure = await evaluate(pages[0].sessionId, `({world:${world},observed:window.attackObserved,status:document.querySelector('#battle-status')?.value})`).catch(() => null); await screenshot(pages[0].sessionId, 'failure').catch(() => {});}
  throw error;
} finally {
  evidence.network = network.filter(e => e.kind !== 'snapshot' || e.players.some(p => p.attackBoost));
  store?.close();
  if (ws?.readyState === WebSocket.OPEN) {for (const browserContextId of contexts) await command('Target.disposeBrowserContext', {browserContextId}).catch(() => {}); ws.close();}
  await vite?.close(); await stop(server); await stop(chrome); await rm(directory, {recursive: true, force: true});
  evidence.processCleanup = {serverExited: server?.exitCode !== null || server?.signalCode !== null, chromeExited: chrome?.exitCode !== null || chrome?.signalCode !== null};
  await writeFile(`${output}.json`, JSON.stringify(evidence, null, 2) + '\n'); await writeFile(`${output}.log`, serverLog);
}
