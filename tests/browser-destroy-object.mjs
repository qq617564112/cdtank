import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
if (!endpoint) throw new Error('Usage: node tests/browser-destroy-object.mjs <Chromium CDP WebSocket URL>');
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
      pages[0].roomId = await evaluate(sessionId, `Array.from(document.querySelector('#room').options).find(o=>o.textContent.includes('破坏模式') && o.textContent.includes('阴森魔王路') && o.textContent.includes('(0/'))?.value`);
      assert(pages[0].roomId, 'Need an empty destruction room');
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
  assert.equal(initial[0].mode, 5);
  assert.equal(initial[0].match.objectives.length, 117);
  const destroyed = await evaluate(a, `(async()=>{
    const world=()=>JSON.parse(document.querySelector('#battle-status').dataset.world);
    const key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code}));
    document.querySelector('canvas').focus();
    const start=world(),p=start.players.find(p=>p.id===start.playerId);
    const candidates=start.match.objectives.filter(o=>Math.hypot(o.x-p.x,o.z-p.z)<650)
      .sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
    const trials=[];
    try {
      for(const target of candidates.slice(0,6)){
        const end=Date.now()+12000;
        while(Date.now()<end){
          const s=world(),p=s.players.find(p=>p.id===s.playerId);
          const bearing=Math.atan2(target.x-p.x,target.z-p.z);
          const delta=Math.atan2(Math.sin(bearing-p.yaw-p.aim),Math.cos(bearing-p.yaw-p.aim));
          if(Math.abs(delta)<0.025)break;
          const code=delta>0?'ArrowRight':'ArrowLeft';key('keydown',code);
          await new Promise(r=>setTimeout(r,50));key('keyup',code);
          await new Promise(r=>setTimeout(r,250));
        }
        key('keydown','Space');
        const deadline=Date.now()+6500;
        while(Date.now()<deadline){
          const o=world().match.objectives.find(o=>o.id===target.id);
          if(o.hp===0)return {objective:o,trials};
          await new Promise(r=>setTimeout(r,100));
        }
        key('keyup','Space');
        trials.push(world().match.objectives.find(o=>o.id===target.id));
      }
      throw new Error('No natural source-object hit: '+JSON.stringify({p,candidates,trials}));
    } finally {for(const code of ['Space','ArrowLeft','ArrowRight'])key('keyup',code);}
  })()`);
  assert(destroyed.objective.sourcePlacementId);
  for(const page of pages)await waitUntil(page.sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).match.objectives.find(o=>o.id===${JSON.stringify(destroyed.objective.id)}).hp===0`);
  // Inspect actual Babylon clones, no visibility or damage injection.
  const sourceNode = async session => evaluate(session, `(async()=>{
    const source=await(await fetch('/src/main.ts')).text();
    const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);
    const scene=EngineStore.LastCreatedScene;
    const root=scene.getTransformNodeByName('placement-'+${JSON.stringify(destroyed.objective.sourcePlacementId)});
    return {enabled:root.isEnabled(),state:root.metadata?.sourceBreach,
      meshes:root.getChildMeshes().map(m=>({visibility:m.visibility,isInstance:m.getClassName()==='InstancedMesh'})),
      synthetic:scene.getMeshByName('objective-'+${JSON.stringify(destroyed.objective.id)})!==null};
  })()`);
  await evaluate(a, `new Promise(resolve=>setTimeout(resolve,2300))`);
  const visuals=[];
  for(const page of pages){
    const visual=await sourceNode(page.sessionId);
    assert.equal(visual.enabled,false);
    assert.equal(visual.state.hidden,true);
    assert(visual.meshes.every(m=>m.visibility===0 && !m.isInstance));
    assert.equal(visual.synthetic,false);
    visuals.push(visual);
  }
  const damaged=await Promise.all(pages.map(page=>state(page.sessionId)));
  assert(damaged.every(s=>s.players.find(p=>p.id===initial[0].playerId).objectivesDestroyed>=1));
  const shot=await command('Page.captureScreenshot',{format:'png'},a);
  await writeFile('recovery/output/browser-destroy-object.png',Buffer.from(shot.data,'base64'));
  // Natural hit/fade only, not an all-117-object completion claim. End via exits,
  // then unanimous rematch proves scene and authoritative state restoration.
  for(const page of pages.slice(2))await evaluate(page.sessionId,`document.querySelector('#leave').click()`);
  await evaluate(pages[1].sessionId,`document.querySelector('#leave').click()`);
  await waitUntil(a,`JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'`);
  const forfeit=await state(a);
  assert.equal(forfeit.match.result.reason,'FORFEIT');
  for(const page of pages.slice(1)){
    await evaluate(page.sessionId,`document.querySelector('#refresh-rooms').click()`);
    await waitUntil(page.sessionId,`!document.querySelector('#refresh-rooms').disabled && !document.querySelector('#join').disabled && Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(pages[0].roomId)} && o.textContent.includes('等待再战'))`);
    await evaluate(page.sessionId,`document.querySelector('#room').value=${JSON.stringify(pages[0].roomId)};document.querySelector('#join').click()`);
    await waitUntil(page.sessionId,`document.querySelector('#battle-status').dataset.world && document.querySelector('[data-match-panel]').dataset.phase==='FINISHED'`);
  }
  for(const page of pages)await evaluate(page.sessionId,`document.querySelector('[data-rematch]').click()`);
  for(const page of pages)await waitUntil(page.sessionId,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.phase==='PLAYING' && s.match.round===2 && s.match.objectives.every(o=>o.hp===o.maxHp && o.destroyedAt===undefined)})()`);
  const replay=await Promise.all(pages.map(page=>state(page.sessionId)));
  const restored=[];
  for(const page of pages){
    const visual=await sourceNode(page.sessionId);
    assert.equal(visual.enabled,true);
    assert.deepEqual(visual.state,{fading:false,hidden:false,alpha:1});
    assert(visual.meshes.every(m=>m.visibility===1));
    restored.push(visual);
  }
  for(const page of pages)await evaluate(page.sessionId,`document.querySelector('#leave').click()`);
  for(const page of pages)await waitUntil(page.sessionId,`!document.querySelector('#battle-status').dataset.world`);
  await writeFile('recovery/output/browser-destroy-object.json',JSON.stringify({status:'PASS',scope:'Four natural browser views: source map117 Breach objects, keyboard aim/fire actual OBB damage, source instance disappears, no synthetic sphere, synchronized objective count, forfeit, rejoin, four-person consensus rematch and source model/fullHP restoration, exit. No damage/position/state injection; no complete objective-clear match proof.',viewport:{width:960,height:540,hardwareScaling:3},initial,destroyed,damaged,visuals,forfeit,replay,restored},null,2));
  console.log('PASS: four-browser source object keyboard hit/destruction, synchronized original instance hide, forfeit, rematch/source model restoration and exit');
} finally {
  for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});
  ws.close();
}
