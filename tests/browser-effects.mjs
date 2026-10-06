import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
if (!endpoint) throw new Error('Usage: node tests/browser-effects.mjs <Chromium CDP WebSocket URL>');
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
let target;
try {
  target = (await command('Target.createTarget', {url: 'about:blank'})).targetId;
  const session = (await command('Target.attachToTarget', {targetId: target, flatten: true})).sessionId;
  await command('Page.enable', {}, session);
  await command('Page.navigate', {url: process.env.CDTANK_RENDER_EFFECT_URL ?? 'http://127.0.0.1:5206/'}, session);
  await waitUntil(session, 'window.effectRenderCheck');
  const result = await evaluate(session, 'window.effectRenderCheck');
  assert.equal(result.passed, true);
  assert.equal(result.results.length, 4);
  assert.equal(result.retainedMeshes, 0);
  assert.equal(result.textureRetained, true);
  assert.equal(result.explosion.node, 2431);
  assert.equal(result.explosion.frames.length, 16);
  assert.equal(result.explosion.invertY, false);
  assert.equal(result.explosion.halfIntervalRetained, true);
  assert.equal(result.explosion.clamped, 15);
  assert.equal(result.explosion.packedColor, 0xffffff00);
  assert.equal(result.explosion.assetHash, '8b81fbf6838e9824fb4fff45eeaaf20051adce7d675cf4b3202c159e072c8fa3');
  for (const [index, frame] of result.explosion.frames.entries()) {
    assert.equal(frame.frame, index);
    assert.ok(frame.maxError <= 2);
    assert.ok(frame.visiblePixels > 0);
    assert.ok(frame.litPixels > 0);
  }
  assert.equal(new Set(result.explosion.frames.map(frame => frame.pixelHash)).size, 16);
  await writeFile('recovery/output/browser-effects.json', JSON.stringify(result, null, 2) + '\n');
  console.log('PASS: Chromium GBF6–9 blend/depth, all 16 original explosion frame pixels/clock/hash and renderer disposal');
} finally {
  if (target) await command('Target.closeTarget', {targetId: target});
  ws.close();
}
