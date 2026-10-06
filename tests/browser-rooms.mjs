import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
const origin = process.argv[3] ?? 'http://127.0.0.1:5173';
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
    const {targetId} = await command('Target.createTarget', {url: origin, newWindow: true});
    const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
    pages.push({targetId, sessionId});
    await command('Emulation.setDeviceMetricsOverride', {width: 960, height: 540, deviceScaleFactor: 1, mobile: false}, sessionId);
    await waitUntil(sessionId, `document.querySelector('#tank')?.options.length===21 && document.querySelector('#room-map')?.options.length===7`);
    await evaluate(sessionId, `(async()=>{
      const source=await(await fetch('/src/main.ts')).text();
      const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);
      EngineStore.LastCreatedEngine.setHardwareScalingLevel(3);
      EngineStore.LastCreatedEngine.resize();
    })()`);
    const catalog = await evaluate(sessionId, `(()=>{const mode=document.querySelector('#room-mode'),maps=[];for(let i=1;i<=5;i++){mode.value=String(i);mode.dispatchEvent(new Event('change'));maps.push({mode:i,ids:[...document.querySelector('#room-map').options].map(o=>Number(o.value))});}return maps;})()`);
    assert.deepEqual(catalog.map(entry => entry.ids.length), [7, 5, 7, 4, 3]);
    await evaluate(sessionId, `document.querySelector('#player-name').value='Room${index}';document.querySelector('#tank').value='1'`);
    if (index === 0) {
      await evaluate(sessionId, `document.querySelector('#create-room-controls').open=true;document.querySelector('#room-mode').value='1';document.querySelector('#room-mode').dispatchEvent(new Event('change'));document.querySelector('#room-map').value='4';document.querySelector('#room-map').dispatchEvent(new Event('change'));document.querySelector('#room-name').value='早安地图联机';document.querySelector('#create-password').value='BrowserSecret42';document.querySelector('#create-room').click()`);
      await waitUntil(sessionId, `document.querySelector('#battle-status').dataset.world && !document.querySelector('#leave').hidden`);
      const initial = await state(sessionId);
      pages[0].roomId = initial.roomId;
      assert.equal(initial.mapId, 4);
      assert.equal(initial.phase, 'WAITING');
      assert.equal(await evaluate(sessionId, `document.querySelector('#create-password').value`),'');
      assert.equal(initial.players.length, 1);
    } else {
      await evaluate(sessionId, `document.querySelector('#refresh-rooms').click()`);
      await waitUntil(sessionId, `Array.from(document.querySelector('#room').options).some(option=>option.value===${JSON.stringify(pages[0].roomId)})`);
      const locked = await evaluate(sessionId, `Array.from(document.querySelector('#room').options).find(option=>option.value===${JSON.stringify(pages[0].roomId)}).textContent`);
      assert(locked.includes('密码房'));
      await evaluate(sessionId, `document.querySelector('#room').value=${JSON.stringify(pages[0].roomId)};document.querySelector('#join-password').value='wrong';document.querySelector('#join').click()`);
      await waitUntil(sessionId, `document.querySelector('#battle-status').value.includes('房间密码错误') && !document.querySelector('#join').disabled`);
      assert.equal(await evaluate(sessionId, `!!document.querySelector('#battle-status').dataset.world`),false);
      assert.equal(await evaluate(sessionId, `document.querySelector('#leave').hidden`),true);
      await evaluate(sessionId, `document.querySelector('#join-password').value='BrowserSecret42';document.querySelector('#join').click()`);
      await waitUntil(sessionId, `document.querySelector('#battle-status').dataset.world && !document.querySelector('#leave').hidden`);
    }
  }
  for(const page of pages.slice(1)) assert.equal(await evaluate(page.sessionId, `document.querySelector('#join-password').value`),'');
  const firstSession = pages[0].sessionId;
  await waitUntil(firstSession, `document.querySelector('.battle-chat:not([hidden])')`);
  await evaluate(firstSession, `(()=>{const input=document.querySelector('[data-chat-input]');input.focus();input.value='集合中文 <b>测试</b>';input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));input.form.requestSubmit();})()`);
  assert.equal(await evaluate(firstSession, `document.querySelector('[data-chat-input]').value`), '集合中文 <b>测试</b>');
  assert.equal(await evaluate(firstSession, `document.querySelector('[data-chat-log]').children.length`), 0);
  await evaluate(firstSession, `(()=>{const input=document.querySelector('[data-chat-input]');input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));input.form.requestSubmit();})()`);
  for (const page of pages) await waitUntil(page.sessionId, `document.querySelector('[data-chat-log]').textContent.includes('Room0: 集合中文 <b>测试</b>')`);
  assert.equal(await evaluate(firstSession, `document.querySelector('[data-chat-log] b')`), null, 'Chat must display literal text');
  await waitUntil(firstSession, `document.querySelector('[data-chat-input]').value===''`);
  await evaluate(firstSession, `document.querySelector('[data-match-panel]:not([hidden]) [data-ready]').click()`);
  await waitUntil(firstSession, `JSON.parse(document.querySelector('#battle-status').dataset.world).match.readyPlayerIds.length===1`);
  await evaluate(pages[1].sessionId, `document.querySelector('[data-match-panel]:not([hidden]) [data-change-team="0"]').click()`);
  for (const page of pages) await waitUntil(page.sessionId, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.match.readyPlayerIds.length===0 && s.players.filter(p=>p.team===0).length===3 && document.querySelectorAll('[data-waiting-player][data-team="0"]').length===3})()`);
  await evaluate(pages[1].sessionId, `document.querySelector('[data-match-panel]:not([hidden]) [data-change-team="1"]').click()`);
  for (const page of pages) await waitUntil(page.sessionId, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.players.filter(p=>p.team===0).length===2 && document.querySelectorAll('[data-waiting-player][data-team="0"]').length===2})()`);

  await evaluate(firstSession, `document.querySelector('[data-match-panel]:not([hidden]) [data-ready]').click()`);
  await waitUntil(firstSession, `JSON.parse(document.querySelector('#battle-status').dataset.world).match.readyPlayerIds.length===1`);
  await evaluate(firstSession, `document.querySelector('[data-match-panel]:not([hidden]) [data-ready]').click()`);
  await waitUntil(firstSession, `JSON.parse(document.querySelector('#battle-status').dataset.world).match.readyPlayerIds.length===0`);
  for (const page of pages.slice(0,3)) await evaluate(page.sessionId, `document.querySelector('[data-match-panel]:not([hidden]) [data-ready]').click()`);
  await waitUntil(firstSession, `JSON.parse(document.querySelector('#battle-status').dataset.world).match.readyPlayerIds.length===3`);
  assert.equal((await state(firstSession)).phase,'WAITING');
  await evaluate(pages[3].sessionId, `document.querySelector('[data-match-panel]:not([hidden]) [data-ready]').click()`);
  const [a,b] = pages.map(page => page.sessionId);
  for (const session of pages.map(page=>page.sessionId)) await waitUntil(session, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.mapLoaded && s.phase==='PLAYING' && s.mapId===4 && s.renderedPlayers===4})()`);
  const initial = await Promise.all(pages.map(page=>state(page.sessionId)));
  assert(initial.every(value=>value.match.minPlayers===4 && value.players.length===4));
  assert.equal(initial[0].players.filter(player=>player.team===0).length,2);
  assert.equal(initial[0].roomId, initial[1].roomId);
  assert.equal(initial[0].mode, 1);
  const sceneEvidence = [];
  for (const session of pages.map(page=>page.sessionId)) {
    const evidence = await evaluate(session, `(async()=>{
      const source=await(await fetch('/src/main.ts')).text();
      const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);
      const scene=EngineStore.LastCreatedScene;
      const sourceMap=(await(await fetch('/scene-placements.json')).json()).find(entry=>entry.id==='0004');
      const expected=[...sourceMap.records,...sourceMap.castles].filter(record=>record.asset).map(record=>record.id);
      return {expected:expected.length,rendered:expected.filter(id=>scene.getTransformNodeByName('placement-'+id)?.isEnabled()).length,terrain:sourceMap.terrain};
    })()`);
    assert.equal(evidence.terrain, 'Data/map/0004/0004.glb');
    assert.equal(evidence.expected, evidence.rendered);
    assert(evidence.expected > 0);
    sceneEvidence.push(evidence);
  }
  const local = initial[0].players.find(player => player.id === initial[0].playerId);
  await evaluate(a, `document.querySelector('canvas').focus();window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));document.querySelector('[data-chat-input]').focus()`);
  await evaluate(a, `new Promise(resolve=>setTimeout(resolve,200))`);
  const stopped = (await state(b)).players.find(player=>player.id===local.id);
  await evaluate(a, `(()=>{const input=document.querySelector('[data-chat-input]');input.value='wasd qe 空格中文';for(const code of ['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','Space'])input.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));return new Promise(resolve=>setTimeout(resolve,600));})()`);
  const afterTyping = (await state(b)).players.find(player=>player.id===local.id);
  assert.equal(afterTyping.x, stopped.x);
  assert.equal(afterTyping.z, stopped.z);
  assert.equal(afterTyping.yaw, stopped.yaw);
  assert.equal(afterTyping.aim, stopped.aim);
  await evaluate(a, `document.querySelector('[data-chat-input]').form.requestSubmit()`);
  for (const page of pages) await waitUntil(page.sessionId, `document.querySelector('[data-chat-log]').textContent.includes('Room0: wasd qe 空格中文')`);
  await evaluate(a, `document.querySelector('[data-chat-input]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  assert.equal(await evaluate(a, `document.activeElement.tagName`), 'CANVAS');
  await evaluate(a, `document.querySelector('canvas').focus();window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));new Promise(resolve=>setTimeout(resolve,800)).then(()=>window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'})))`);
  await waitUntil(b, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world),p=s.players.find(p=>p.id===${JSON.stringify(local.id)});return Math.hypot(p.x-(${local.x}),p.z-(${local.z}))>1})()`);
  const movement = await state(b);
  const screenshot = await command('Page.captureScreenshot', {format:'png'}, b);
  await writeFile('recovery/output/browser-rooms-0004.png', Buffer.from(screenshot.data,'base64'));
  await evaluate(a, `document.querySelector('#leave').click()`);
  await waitUntil(b, `JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===3`);
  assert.equal((await state(b)).phase,'PLAYING','One departure must not end a viable four-person team match');
  await evaluate(pages[2].sessionId, `document.querySelector('#leave').click()`);
  await waitUntil(b, `JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'`);
  await evaluate(b, `const input=document.querySelector('[data-chat-input]');input.value='再来一局';input.form.requestSubmit()`);
  await waitUntil(pages[3].sessionId, `document.querySelector('[data-chat-log]').textContent.includes('Room1: 再来一局')`);
  await evaluate(pages[3].sessionId, `document.querySelector('#leave').click()`);
  await evaluate(b, `document.querySelector('#leave').click();document.querySelector('#refresh-rooms').click()`);
  await waitUntil(b, `document.querySelector('#room').options.length>0 && !Array.from(document.querySelector('#room').options).some(option=>option.value===${JSON.stringify(pages[0].roomId)})`);
  for(const session of pages.map(page=>page.sessionId)) await waitUntil(session, `!document.querySelector('#battle-status').dataset.world && !document.querySelector('[data-match-panel]:not([hidden])')`);
  await writeFile('recovery/output/browser-rooms.json', JSON.stringify({status:'PASS',scope:'Room chat in waiting/play/finished, Chinese composition submit guard, literal HTML display, focus releases game keys and typing preserves position/angles, Escape returns to canvas; actual four-browser password creation/wrong rejection/correct entry, original 26-row map selectors, create selected map 0004, other connection joins, ready, rendered source placements, keyboard movement, forfeit, empty room cleanup',viewport:{width:960,height:540,hardwareScaling:3},initial,sceneEvidence,movement,chatKeyboard:{stopped,afterTyping}},null,2));
  console.log('PASS: room chat/composition/literal text/input key isolation/Escape/finished chat, password room/wrong rejection/correct entry, 26 source map choices, actual custom map 0004 creation/join, original scene rendering, team changes/roster/readiness invalidation, explicit/cancel ready, four-player teams, remote keyboard movement and room cleanup');
} finally {
  for (const page of pages) await command('Target.closeTarget', {targetId:page.targetId}).catch(()=>{});
  ws.close();
}
