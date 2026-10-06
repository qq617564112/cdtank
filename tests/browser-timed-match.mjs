import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
const mode = Number(process.argv[3]);
assert([1, 4, 5].includes(mode), 'Mode must be 1, 4 or 5');
const count = mode === 5 ? 4 : 2;
const timeLimit = mode === 5 ? 180 : 300;
if (!endpoint) throw new Error('Usage: node tests/browser-timed-match.mjs <Chromium CDP WebSocket URL> <mode: 1|4|5>');
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
  for (let index = 0; index < count; index++) {
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
    if (index === 0) {
      await evaluate(sessionId, `document.querySelector('#room-mode').value='${mode}';document.querySelector('#room-mode').dispatchEvent(new Event('change'))`);
      await waitUntil(sessionId, `Array.from(document.querySelector('#room-map').options).some(o=>Number(o.value)===${mode === 5 ? 20 : 7})`);
      await evaluate(sessionId, `document.querySelector('#room-map').value='${mode === 5 ? 20 : 7}';document.querySelector('#room-name').value='NaturalTimed${mode}';document.querySelector('#tank').value='1';document.querySelector('#player-name').value='Timed${mode}-${index}';document.querySelector('#create-room').click()`);
    } else {
      await evaluate(sessionId, `document.querySelector('#refresh-rooms').click()`);
      await waitUntil(sessionId, `!document.querySelector('#refresh-rooms').disabled && Array.from(document.querySelector('#room').options).some(o=>o.value===${JSON.stringify(pages[0].roomId)})`);
      await evaluate(sessionId, `document.querySelector('#room').value=${JSON.stringify(pages[0].roomId)};document.querySelector('#tank').value='1';document.querySelector('#player-name').value='Timed${mode}-${index}';document.querySelector('#join').click()`);
    }
    await waitUntil(sessionId, `document.querySelector('#battle-status').dataset.world && !document.querySelector('#leave').hidden`);
    if (index === 0) {const s=await state(sessionId);assert.equal(s.phase,'WAITING');pages[0].roomId=s.roomId;}
  }
  for (const page of pages) await evaluate(page.sessionId, `document.querySelector('[data-match-panel]:not([hidden]) [data-ready]').click()`);
  const [a, b] = pages.map(page => page.sessionId);
  for (const session of [a, b]) {
    await waitUntil(session, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.phase==='PLAYING' && s.mapLoaded && s.renderedPlayers===${count}})()`);
  }
  const initial = await Promise.all(pages.map(page => state(page.sessionId)));
  assert.equal(initial[0].mode, mode);
  const startedAt = Date.now();
  assert(initial[0].remaining >= timeLimit - 5);
  if(mode === 5)assert.equal(initial[0].match.objectives.length,117);
  let action;
  if(mode === 5){
  action = await evaluate(a, `(async()=>{
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
  assert(action.objective.sourcePlacementId);
  for(const page of pages)await waitUntil(page.sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).match.objectives.find(o=>o.id===${JSON.stringify(action.objective.id)}).hp===0`);
  } else {
    const victimId=initial[1].playerId;
    action=await evaluate(a, `(async()=>{
      const state=()=>JSON.parse(document.querySelector('#battle-status').dataset.world);
      const key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code}));
      document.querySelector('canvas').focus();
      const deadline=Date.now()+45000;
      try{
        while(Date.now()<deadline){
          const s=state(),p=s.players.find(p=>p.id===s.playerId),t=s.players.find(p=>p.id===${JSON.stringify(victimId)});
          const bearing=Math.atan2(t.x-p.x,t.z-p.z),delta=Math.atan2(Math.sin(bearing-p.yaw-p.aim),Math.cos(bearing-p.yaw-p.aim));
          if(Math.abs(delta)<0.025)break;
          const code=delta>0?'ArrowRight':'ArrowLeft';key('keydown',code);await new Promise(r=>setTimeout(r,50));key('keyup',code);await new Promise(r=>setTimeout(r,250));
        }
        key('keydown','Space');
        while(Date.now()<deadline){
          const s=state(),p=s.players.find(p=>p.id===s.playerId),t=s.players.find(p=>p.id===${JSON.stringify(victimId)});
          if(t.deaths>=1)return {attacker:p,victim:t};
          key('keydown','Space');
          await new Promise(r=>setTimeout(r,50));
        }
        throw new Error('Natural keyboard kill timeout');
      }finally{for(const code of ['Space','ArrowLeft','ArrowRight'])key('keyup',code);}
    })()`);
    assert.equal(action.attacker.kills,1);
    assert.equal(action.victim.deaths,1);
    for(const page of pages)await waitUntil(page.sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).players.find(p=>p.id===${JSON.stringify(victimId)}).alive`);
  }
  // Real source time limit, no clock, damage, position or result injection.
  let previousRemaining=Infinity,lastLog=Date.now();
  while(true){
    const s=await state(a);
    if(s.phase==='FINISHED')break;
    assert.equal(s.phase,'PLAYING');
    assert(s.remaining<=previousRemaining);
    previousRemaining=s.remaining;
    if(Date.now()-lastLog>30000){console.log(`mode ${mode}: source timer ${s.remaining}s, members ${s.players.length}`);lastLog=Date.now();}
    if(Date.now()-startedAt>(timeLimit+20)*1000)throw new Error('Source deadline did not finish match');
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  const elapsedSeconds=(Date.now()-startedAt)/1000;
  assert(elapsedSeconds>=timeLimit-6);
  for(const page of pages)await waitUntil(page.sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'`);
  const finished=await Promise.all(pages.map(page=>state(page.sessionId)));
  const result=finished[0].match.result;
  assert.equal(result.reason,'TIME_LIMIT');
  assert.equal(result.players.length,count);
  assert.equal(result.players.find(p=>p.id===initial[0].playerId).outcome,'WIN');
  if(mode===1){assert.equal(result.winnerTeam,initial[0].players.find(p=>p.id===initial[0].playerId).team);assert.deepEqual(finished[0].match.teamLives,[30,29]);}
  else assert.equal(result.winnerPlayerId,initial[0].playerId);
  for(const s of finished){assert.deepEqual(s.match.result,result);assert.equal(s.remaining,0);assert.equal(s.bullets,0);}
  for(const page of pages)await waitUntil(page.sessionId, `document.querySelectorAll('[data-result-player]').length===${count}`);
  const screenshot=await command('Page.captureScreenshot',{format:'png'},a);
  await writeFile(`recovery/output/browser-timed-mode${mode}.png`,Buffer.from(screenshot.data,'base64'));
  await evaluate(a, `window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}));window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}))`);
  await new Promise(resolve=>setTimeout(resolve,1000));
  assert.deepEqual((await state(a)).match.result,result);
  await evaluate(a, `window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space'}));window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));document.querySelector('[data-rematch]').click()`);
  for(const page of pages)await waitUntil(page.sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).match.rematchPlayerIds.length===1`);
  assert.equal((await state(b)).phase,'FINISHED');
  for(const page of pages.slice(1))await evaluate(page.sessionId, `document.querySelector('[data-rematch]').click()`);
  for(const page of pages)await waitUntil(page.sessionId, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.phase==='PLAYING'&&s.match.round===2&&s.players.every(p=>p.alive&&p.hp===p.maxHp&&p.kills===0&&p.deaths===0&&p.score===0&&p.objectivesDestroyed===0)&&s.match.objectives.every(o=>o.hp===o.maxHp&&o.destroyedAt===undefined)})()`);
  const replay=await Promise.all(pages.map(page=>state(page.sessionId)));
  for(const s of replay){assert.equal(s.match.result,undefined);assert.deepEqual(s.players.map(p=>p.id),initial[0].players.map(p=>p.id));}
  for(const page of pages)await evaluate(page.sessionId, `document.querySelector('#leave').click()`);
  for(const page of pages)await waitUntil(page.sessionId, `!document.querySelector('#battle-status').dataset.world`);
  await writeFile(`recovery/output/browser-timed-mode${mode}.json`,JSON.stringify({status:'PASS',scope:'Natural keyboard kill/object destruction, actual source time limit with original player minimum, identical settlement and winner across real browser clients, frozen result, unanimous rematch/reset, exit. No injected clocks/damage/positions/snapshots; no elimination/all-object-clear proof.',mode,timeLimit,elapsedSeconds,viewport:{width:960,height:540,hardwareScaling:3},initial,action,finished,replay},null,2));
  console.log(`PASS: mode ${mode}, ${count} browsers, natural action and source ${timeLimit}s deadline/settlement/rematch/exit`);
} finally {
  for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});
  ws.close();
}
