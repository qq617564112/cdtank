import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
if (!endpoint) throw new Error('Usage: node tests/browser-combat.mjs <Chromium CDP WebSocket URL>');
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
      return await evaluate(session, `(async()=>{const deadline=Date.now()+45000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout: '+document.querySelector('#battle-status')?.value+' '+document.querySelector('#battle-status')?.dataset.world);})()`);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed')) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Page navigation timeout');
}
const pages = [];
const state = session => evaluate(session, `JSON.parse(document.querySelector('#battle-status').dataset.world)`);
try {
  for (let index = 0; index < 4; index++) {
    const {targetId} = await command('Target.createTarget', {url: 'http://127.0.0.1:5173', newWindow: true});
    const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
    pages.push({targetId, sessionId});
    await command('Emulation.setDeviceMetricsOverride', {width: 960, height: 540, deviceScaleFactor: 1, mobile: false}, sessionId);
    await waitUntil(sessionId, `document.querySelector('#tank')?.options.length===21`);
    await evaluate(sessionId, `(async()=>{
      const source=await(await fetch('/src/main.ts')).text();
      const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);
      EngineStore.LastCreatedEngine.setHardwareScalingLevel(3);
      EngineStore.LastCreatedEngine.resize();
    })()`);
    await evaluate(sessionId, `document.querySelector('#refresh-rooms').click()`);
    await waitUntil(sessionId, `document.querySelector('#room').options.length>0`);
    if (index === 0) {
      pages[0].roomId = await evaluate(sessionId, `Array.from(document.querySelector('#room').options).find(o=>o.textContent.includes('擒王模式') && o.textContent.includes('田野路') && o.textContent.includes('(0/'))?.value`);
      assert(pages[0].roomId, 'Need an empty king room');
    }
    await evaluate(sessionId, `document.querySelector('#room').value=${JSON.stringify(pages[0].roomId)};document.querySelector('#tank').value='1';document.querySelector('#player-name').value='Match${index}';document.querySelector('#join').click()`);
    await waitUntil(sessionId, `document.querySelector('#battle-status').dataset.world && !document.querySelector('#leave').hidden`);
    if (index === 0) assert.equal((await state(sessionId)).phase, 'WAITING');
  }
  for (const page of pages) await evaluate(page.sessionId, `document.querySelector('[data-match-panel]:not([hidden]) [data-ready]').click()`);
  const [a, b] = pages.map(page => page.sessionId);
  for (const session of [a, b]) {
    await waitUntil(session, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.phase==='PLAYING' && s.mapLoaded && s.renderedPlayers===4 && s.players.filter(p=>p.isVIP).length===2})()`);
  }
  const initial = await state(a);
  const attacker = initial.players.find(player => player.id === initial.playerId);
  const victim = initial.players.find(player => player.id !== initial.playerId);
  assert.equal(attacker.hp, 200);
  assert.equal(victim.hp, 200);
  assert.equal(initial.match.round, 1);
  await evaluate(a, `(async()=>{
    const state=()=>JSON.parse(document.querySelector('#battle-status').dataset.world);
    const key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code}));
    document.querySelector('canvas').focus();
    const end=Date.now()+45000;
    try{
      while(Date.now()<end){
        const s=state(),p=s.players.find(p=>p.id===s.playerId),t=s.players.find(p=>p.id!==s.playerId);
        const bearing=Math.atan2(t.x-p.x,t.z-p.z);
        const delta=Math.atan2(Math.sin(bearing-p.yaw-p.aim),Math.cos(bearing-p.yaw-p.aim));
        if(Math.abs(delta)<0.035)return true;
        const code=delta>0?'ArrowRight':'ArrowLeft';
        key('keydown',code);
        await new Promise(r=>setTimeout(r,Math.min(250,Math.max(50,Math.abs(delta)/0.9*1000))));
        key('keyup',code);
        await new Promise(r=>setTimeout(r,500));
      }
      throw new Error('Aim convergence timeout');
    }finally{key('keyup','ArrowLeft');key('keyup','ArrowRight');}
  })()`);
  await evaluate(a, `window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}))`);
  for (const session of [a, b]) {
    await waitUntil(session, `JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'`);
  }
  await evaluate(a, `window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space'}))`);
  const finished = await Promise.all([state(a), state(b)]);
  assert.deepEqual(finished[0].match.result, finished[1].match.result);
  const result = finished[0].match.result;
  assert.equal(result.reason, 'OBJECTIVE');
  assert.equal(result.winnerTeam, attacker.team);
  assert.equal(result.players.find(player => player.id === attacker.id).outcome, 'WIN');
  assert.equal(result.players.find(player => player.id === victim.id).outcome, 'LOSE');
  assert.equal(finished[0].players.find(player => player.id === victim.id).alive, false);
  for (const session of [a, b]) {
    await waitUntil(session, `document.querySelector('[data-match-panel]:not([hidden])').dataset.phase==='FINISHED' && document.querySelectorAll('[data-result-player]').length===4`);
    const panel = await evaluate(session, `(()=>{const panel=document.querySelector('[data-match-panel]:not([hidden])');return {title:panel.querySelector('h2').textContent,rows:[...panel.querySelectorAll('tbody tr')].map(r=>r.textContent),button:panel.querySelector('[data-rematch]').textContent}})()`);
    assert.equal(panel.rows.length, 4);
    assert.equal(panel.button, '再来一局');
  }
  const screenshot = await command('Page.captureScreenshot', {format: 'png'}, b);
  await writeFile('recovery/output/browser-match-result.png', Buffer.from(screenshot.data, 'base64'));
  // Client key events after settlement must not alter the authoritative result.
  await evaluate(a, `window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}));window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}))`);
  await evaluate(a, `new Promise(resolve=>setTimeout(resolve,1000))`);
  assert.deepEqual((await state(a)).match.result, result);
  assert.equal((await state(a)).bullets, 0);
  await evaluate(a, `document.querySelector('[data-match-panel]:not([hidden]) [data-rematch]').click()`);
  for (const session of [a, b]) await waitUntil(session, `JSON.parse(document.querySelector('#battle-status').dataset.world).match.rematchPlayerIds.length===1`);
  assert.equal((await state(b)).phase, 'FINISHED');
  await waitUntil(a, `document.querySelector('[data-match-panel]:not([hidden]) [data-rematch]').disabled`);
  for (const page of pages.slice(1)) await evaluate(page.sessionId, `document.querySelector('[data-match-panel]:not([hidden]) [data-rematch]').click()`);
  for (const session of [a, b]) {
    await waitUntil(session, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.phase==='PLAYING' && s.match.round===2 && s.players.every(p=>p.alive && p.hp===p.maxHp && p.kills===0 && p.deaths===0 && p.score===0)})()`);
    await waitUntil(session, `document.querySelector('[data-match-panel]:not([hidden])').dataset.phase==='PLAYING' && document.querySelector('[data-match-panel]:not([hidden]) [data-rematch]').hidden`);
  }
  const replay = await Promise.all([state(a), state(b)]);
  assert.deepEqual(replay[0].players.map(player => player.id), initial.players.map(player => player.id));
  assert.equal(replay[0].match.result, undefined);
  assert.equal(replay[0].bullets, 0);
  // Independent actual keyboard movement works in the second round.
  await evaluate(a, `window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));new Promise(resolve=>setTimeout(resolve,500)).then(()=>window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'})))`);
  await waitUntil(b, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);const p=s.players.find(p=>p.id===${JSON.stringify(attacker.id)});return Math.hypot(p.x-(${attacker.x}),p.z-(${attacker.z}))>5})()`);
  const movement = await state(b);
  await evaluate(a, `document.querySelector('#leave').click()`);
  await waitUntil(b, `JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'`);
  const forfeit = await state(b);
  assert.equal(forfeit.match.result.reason, 'FORFEIT');
  assert.equal(forfeit.match.result.players.find(player => player.id === victim.id).outcome, 'WIN');
  await evaluate(b, `document.querySelector('#leave').click()`);
  for (const page of pages.slice(2)) await evaluate(page.sessionId, `document.querySelector('#leave').click()`);
  for (const session of [a, b]) {
    await waitUntil(session, `!document.querySelector('#battle-status').dataset.world && !document.querySelector('[data-match-panel]:not([hidden])')`);
  }
  await writeFile('recovery/output/browser-match.json', JSON.stringify({
    status: 'PASS', scope: 'Four independent actual browsers, source map/tanks, ready, keyboard king kill, authoritative outcome/settlement, unanimous rematch, second-round movement, forfeit, exit',
    viewport: {width: 960, height: 540, hardwareScaling: 3}, initial, finished, replay, movement, forfeit,
  }, null, 2));
  console.log('PASS: actual four-browser ready → king hit/death → settlement → unanimous rematch → second-round movement → forfeit → exit');
} finally {
  for (const page of pages) await command('Target.closeTarget', {targetId: page.targetId}).catch(()=>{});
  ws.close();
}
