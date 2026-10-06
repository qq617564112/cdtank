import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
if (!endpoint) throw new Error('Usage: node tests/browser-effect-bolt.mjs <Chromium CDP WebSocket URL>');
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
  await command('Page.navigate', {url: process.env.CDTANK_RENDER_BOLT_URL ?? 'http://127.0.0.1:5205/'}, session);
  await waitUntil(session, 'window.effectBoltRenderCheck');
  const result = await evaluate(session, 'window.effectBoltRenderCheck');
  assert.equal(result.passed, true);
  assert.equal(result.node, 131);
  assert.equal(result.selector, 7);
  assert.equal(result.asset, 'Data/effect/effect/Bolt.png');
  assert.equal(result.results.length, 6);
  assert.equal(result.retainedMeshes, 0);
  assert.equal(result.textureRetained, true);
  assert.ok(result.runtimeVertices > 0);
  for (const frame of result.results) {
    assert.ok(frame.maxError <= 2);
    assert.ok(frame.visiblePixels > 0);
    assert.equal(frame.indices, (frame.vertices - 2) * 3);
  }
  await writeFile('recovery/output/browser-effect-bolt.json', JSON.stringify(result, null, 2) + '\n');
  console.log('PASS: Chromium original lightning texture / GBF7 / six native camera-matrix ribbon frames / clear-disposal');
} finally {
  if (target) await command('Target.closeTarget', {targetId: target});
  ws.close();
}
