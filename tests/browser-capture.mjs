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
      pages[0].roomId = await evaluate(sessionId, `Array.from(document.querySelector('#room').options).find(o=>o.textContent.includes('占领模式') && o.textContent.includes('田野路') && o.textContent.includes('(0/'))?.value`);
      assert(pages[0].roomId, 'Need an empty capture room');
    }
    await evaluate(sessionId, `document.querySelector('#room').value=${JSON.stringify(pages[0].roomId)};document.querySelector('#tank').value='1';document.querySelector('#player-name').value='Match${index}';document.querySelector('#join').click()`);
    await waitUntil(sessionId, `document.querySelector('#battle-status').dataset.world && !document.querySelector('#leave').hidden`);
    if (index === 0) assert.equal((await state(sessionId)).phase, 'WAITING');
  }
  for (const page of pages) await evaluate(page.sessionId, `document.querySelector('[data-match-panel]:not([hidden]) [data-ready]').click()`);
  const [a, b] = pages.map(page => page.sessionId);
  for (const session of [a, b]) {
    await waitUntil(session, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.phase==='PLAYING' && s.mapLoaded && s.renderedPlayers===4})()`);
  }
  const initial = await Promise.all(pages.map(page => state(page.sessionId)));
  const player = initial[0].players.find(value => value.id === initial[0].playerId);
  const objective = initial[0].match.objectives[0];
  assert.equal(initial[0].mode, 2);
  assert.equal(objective.kind, 'CAPTURE');
  assert.equal(initial[0].teamScores[player.team], 0);
  assert(Math.hypot(player.x - objective.x, player.z - objective.z) > objective.radius);
  const steering = await evaluate(a, `(async()=>{
    const world=()=>JSON.parse(document.querySelector('#battle-status').dataset.world);
    const key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code}));
    document.querySelector('canvas').focus();
    const end=Date.now()+45000;
    try {
      while(Date.now()<end){
        const s=world(),p=s.players.find(p=>p.id===s.playerId),o=s.match.objectives[0];
        const bearing=Math.atan2(o.x-p.x,o.z-p.z);
        const delta=Math.atan2(Math.sin(bearing-p.yaw),Math.cos(bearing-p.yaw));
        if(Math.abs(delta)<0.08) break;
        const code=delta>0?'KeyD':'KeyA';
        key('keydown',code);
        await new Promise(r=>setTimeout(r,50));
        key('keyup',code);
        await new Promise(r=>setTimeout(r,250));
      }
      while(Date.now()<end){
        const s=world(),p=s.players.find(p=>p.id===s.playerId),o=s.match.objectives[0];
        const distance=Math.hypot(o.x-p.x,o.z-p.z);
        if(distance<o.radius-10)return {player:p,objective:o,distance};
        key('keydown','KeyW');
        await new Promise(r=>setTimeout(r,100));
        key('keyup','KeyW');
        await new Promise(r=>setTimeout(r,250));
      }
      throw new Error('Keyboard capture entry timeout');
    } finally {for(const code of ['KeyA','KeyD','KeyW'])key('keyup',code);}
  })()`);
  assert(steering.distance < objective.radius);
  for(const page of pages) await waitUntil(page.sessionId, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.teamScores[${player.team}]>0 && s.match.objectives[0].ownerTeam===${player.team}})()`);
  const capturing = await Promise.all(pages.map(page => state(page.sessionId)));
  const screenshot = await command('Page.captureScreenshot', {format:'png'}, a);
  await writeFile('recovery/output/browser-capture-playing.png', Buffer.from(screenshot.data,'base64'));
  for(const page of pages) await waitUntil(page.sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'`);
  const finished = await Promise.all(pages.map(page => state(page.sessionId)));
  const result = finished[0].match.result;
  assert.equal(result.reason, 'OBJECTIVE');
  assert.equal(result.winnerTeam, player.team);
  assert.equal(result.players.length, 4);
  for(const value of finished){
    assert.deepEqual(value.match.result,result);
    assert(value.teamScores[player.team]>=value.match.targetScore);
    assert.equal(value.teamScores[1-player.team],0);
    assert(value.players.every(p=>p.kills===0 && p.deaths===0));
  }
  for(const page of pages) await waitUntil(page.sessionId, `document.querySelectorAll('[data-result-player]').length===4`);
  const resultShot = await command('Page.captureScreenshot', {format:'png'}, b);
  await writeFile('recovery/output/browser-capture-result.png', Buffer.from(resultShot.data,'base64'));
  await evaluate(a, `document.querySelector('[data-match-panel]:not([hidden]) [data-rematch]').click()`);
  await waitUntil(b, `JSON.parse(document.querySelector('#battle-status').dataset.world).match.rematchPlayerIds.length===1`);
  assert.equal((await state(b)).phase,'FINISHED');
  for(const page of pages.slice(1)) await evaluate(page.sessionId, `document.querySelector('[data-match-panel]:not([hidden]) [data-rematch]').click()`);
  for(const page of pages) await waitUntil(page.sessionId, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.phase==='PLAYING' && s.match.round===2 && s.teamScores.every(score=>score===0) && s.match.objectives[0].ownerTeam===-1})()`);
  const replay = await Promise.all(pages.map(page => state(page.sessionId)));
  assert(replay.every(value=>value.match.result===undefined && value.players.length===4));
  for(const page of pages) await evaluate(page.sessionId, `document.querySelector('#leave').click()`);
  for(const page of pages) await waitUntil(page.sessionId, `!document.querySelector('#battle-status').dataset.world && !document.querySelector('[data-match-panel]:not([hidden])')`);
  await writeFile('recovery/output/browser-capture.json',JSON.stringify({status:'PASS',scope:'Four independent actual browsers: source map/tanks, explicit ready, real keyboard steering/entry into capture zone, authoritative 30-second win, four-view settlement, consensus rematch reset and exit; no state/damage/position injection',viewport:{width:960,height:540,hardwareScaling:3},initial,steering,capturing,finished,replay},null,2));
  console.log('PASS: four-browser keyboard capture entry → authoritative timed objective win → identical settlement → consensus rematch/reset → exit');
} finally {
  for(const page of pages) await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});
  ws.close();
}
