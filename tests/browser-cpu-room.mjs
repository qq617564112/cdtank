import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
const pageUrl = process.argv[3] ?? 'http://127.0.0.1:5173';
const mode = 4;
assert([1, 4].includes(mode), 'Mode must be 1 or 4');
const killTarget = mode === 1 ? 30 : 10;
const evidenceName = mode === 1 ? 'browser-team-objective' : 'browser-melee-objective';
const count = 1;
const timeLimit = 300;
if (!endpoint) throw new Error('Usage: node tests/browser-melee-objective.mjs <Chromium CDP WebSocket URL> [mode: 1|4]');
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
  const {targetId} = await command('Target.createTarget', {url:pageUrl,newWindow:true});
  const {sessionId} = await command('Target.attachToTarget',{targetId,flatten:true});
  pages.push({targetId,sessionId});
  await command('Emulation.setDeviceMetricsOverride',{width:960,height:540,deviceScaleFactor:1,mobile:false},sessionId);
  await waitUntil(sessionId, `document.querySelector('#tank')?.options.length===21`);
  await evaluate(sessionId, `(async()=>{
    const source=await(await fetch('/src/main.ts')).text();
    const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);EngineStore.LastCreatedEngine.setHardwareScalingLevel(3);
    EngineStore.LastCreatedEngine.resize();
  })()`);
  await evaluate(sessionId, `document.querySelector('#room-mode').value='4';document.querySelector('#room-mode').dispatchEvent(new Event('change'))`);
  await waitUntil(sessionId, `Array.from(document.querySelector('#room-map').options).some(o=>Number(o.value)===7)`);
  await evaluate(sessionId, `document.querySelector('#room-map').value='7';document.querySelector('#player-name').value='CPU Observer';document.querySelector('#create-room').click()`);
  await waitUntil(sessionId, `document.querySelector('#battle-status').dataset.world`);
  for(let i=0;i<3;i++){
    await evaluate(sessionId, `document.querySelector('[data-add-cpu]').click()`);
    await waitUntil(sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===${i+2}`);
  }
  await waitUntil(sessionId, `document.querySelectorAll('[data-remove-cpu]').length===3`);
  await evaluate(sessionId, `document.querySelector('[data-remove-cpu]').click()`);
  await waitUntil(sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===3 && document.querySelectorAll('[data-remove-cpu]').length===2 && !document.querySelector('[data-add-cpu]').disabled`);
  await evaluate(sessionId, `document.querySelector('[data-add-cpu]').click()`);
  await waitUntil(sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===4`);
  const final=await state(sessionId);
  assert.equal(final.phase,'WAITING');assert.equal(final.match.readyPlayerIds.length,3);
  assert.equal(final.match.cpuManagerId,final.playerId);
  assert.equal(final.players.filter(p=>p.isCpu).length,3);
  await evaluate(sessionId, `document.querySelector('#leave').click()`);
  await waitUntil(sessionId, `!document.querySelector('#battle-status').dataset.world`);
  await writeFile('recovery/output/browser-cpu-room.json',JSON.stringify({status:'PASS',final},null,2));
  console.log('PASS: actual owner CPU add/remove/replace UI, ready count and exit');
}finally{for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});ws.close();}
