import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
if (!endpoint) throw new Error('Usage: node tests/browser-scenes.mjs <Chromium CDP WebSocket URL> [asset viewer origin]');
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
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      return await evaluate(session, `(async()=>{const deadline=Date.now()+20000;while(Date.now()<deadline){if(${expression})return true;await new Promise(r=>setTimeout(r,50));}throw new Error('Browser condition timeout');})()`);
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed')) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error('Page navigation timeout');
}

const {targetId} = await command('Target.createTarget', {url: process.argv[3] ?? process.env.CDTANK_WEB_URL ?? 'http://127.0.0.1:5211'});
const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
try {
  await command('Emulation.setDeviceMetricsOverride', {width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false}, sessionId);
  await waitUntil(sessionId, `document.querySelector('#model')?.options.length===964 && !document.querySelector('#model').disabled`);
  const results = [];
  for (const id of ['0002', '0001', '0010']) {
    await evaluate(sessionId, `document.querySelector('#scene').value='${id}';document.querySelector('#load-scene').click()`);
    await waitUntil(sessionId, `!document.querySelector('#load-scene').disabled && document.querySelector('#status').value.startsWith('地图 ${id}')`);
    const result = await evaluate(sessionId, `(async()=>{
      const source = await (await fetch('/main.ts')).text();
      const moduleUrl = source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore, Vector3} = await import(moduleUrl);
      const scene = EngineStore.LastCreatedScene;
      const entries = await (await fetch('/scene-placements.json')).json();
      const entry = entries.find(e=>e.id==='${id}');
      let vertices=0, maxError=0, rotated=0;
      for (const placement of [...entry.records,...entry.castles].filter(p=>p.asset)) {
        const root = scene.getTransformNodeByName('placement-'+placement.id);
        if (!root) throw new Error('Missing placement '+placement.id);
        if (placement.rotation.some(v=>Math.abs(v)>0.01)) rotated++;
        for (const mesh of root.getChildMeshes()) {
          const positions = mesh.getVerticesData('position');
          if (!positions) continue;
          const world = mesh.computeWorldMatrix(true);
          for (let i=0;i<positions.length;i+=3) {
            const local=positions.slice(i,i+3);
            const actual=Vector3.TransformCoordinates(Vector3.FromArray(local),world);
            const m=placement.matrix;
            const expected=placement.position.map((p,j)=>p+local.reduce((sum,v,k)=>sum+v*m[k*4+j],0));
            expected[0]=-expected[0];
            maxError=Math.max(maxError,...[actual.x,actual.y,actual.z].map((v,j)=>Math.abs(v-expected[j])));
            vertices++;
          }
        }
      }
      return {id:'${id}', resolved:entry.resolved, vertices, rotated, maxError, cameraBeta:scene.activeCamera.beta, cameraTargetY:scene.activeCamera.target.y};
    })()`);
    assert(result.vertices>0);
    assert(result.cameraBeta>0 && result.cameraBeta<Math.PI/2, 'Map camera must be above ground');
    assert.equal(result.cameraTargetY, 0);
    assert(result.maxError<0.01, JSON.stringify(result));
    results.push(result);
    if (id === '0002') {
      await command('Page.bringToFront', {}, sessionId);
      await evaluate(sessionId, `(async()=>{const source=await (await fetch('/main.ts')).text();const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];const {EngineStore}=await import(url);await EngineStore.LastCreatedScene.whenReadyAsync();await new Promise(resolve=>{let frames=0;function next(){if(++frames===5)resolve();else requestAnimationFrame(next);}requestAnimationFrame(next);});})()`);
      const screenshot=await command('Page.captureScreenshot',{format:'png'},sessionId);
      await writeFile('recovery/output/scene-0002.png',Buffer.from(screenshot.data,'base64'));
    }
  }
  assert(results.some(r=>r.rotated>0));
  await writeFile('recovery/output/scene-browser-verification.json',JSON.stringify(results,null,2));
  console.log('PASS: original placements, rotations and actual browser world vertices',results);
} finally {
  await command('Target.closeTarget',{targetId});
  ws.close();
}
