import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
const mode = Number(process.argv[3] ?? 4);
assert([1, 4].includes(mode), 'Mode must be 1 or 4');
const killTarget = mode === 1 ? 30 : 10;
const evidenceName = mode === 1 ? 'browser-team-objective' : 'browser-melee-objective';
const count = 2;
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
      await evaluate(sessionId, `document.querySelector('#room-map').value='${mode === 5 ? 20 : 7}';document.querySelector('#room-name').value='NaturalTimed${mode}';document.querySelector('#tank').value='${mode === 1 ? 105 : 1}';document.querySelector('#player-name').value='Timed${mode}-${index}';document.querySelector('#create-room').click()`);
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
  const victimId=initial[1].playerId;
  const steering=await evaluate(a, `(async()=>{
    const state=()=>JSON.parse(document.querySelector('#battle-status').dataset.world);
    const key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code}));
    const goal={x:-144,z:240},deadline=Date.now()+45000;
    document.querySelector('canvas').focus();
    try{
      while(Date.now()<deadline){
        const s=state(),p=s.players.find(p=>p.id===s.playerId),distance=Math.hypot(goal.x-p.x,goal.z-p.z);
        if(distance<10)return {player:p,goal,distance};
        const bearing=Math.atan2(goal.x-p.x,goal.z-p.z),delta=Math.atan2(Math.sin(bearing-p.yaw),Math.cos(bearing-p.yaw));
        if(Math.abs(delta)>0.09){
          const code=delta>0?'KeyD':'KeyA';key('keydown',code);
          await new Promise(r=>setTimeout(r,Math.min(700,Math.max(50,Math.abs(delta)/${mode===1 ? 0.84 : 0.96}*650))));key('keyup',code);
        }else{
          key('keydown','KeyW');await new Promise(r=>setTimeout(r,Math.min(700,Math.max(50,(distance-8)/${mode===1 ? 18 : 60}*1000))));key('keyup','KeyW');
        }
        await new Promise(r=>setTimeout(r,200));
      }
      throw new Error('Natural station movement timeout: '+JSON.stringify(state()));
    }finally{for(const code of ['KeyA','KeyD','KeyW'])key('keyup',code);}
  })()`);
  assert(steering.distance<10);
  const kills=[];
  for(let index=1;index<=killTarget;index++){
    const action=await evaluate(a, `(async()=>{
      const state=()=>JSON.parse(document.querySelector('#battle-status').dataset.world);
      const key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code}));
      const victimId=${JSON.stringify(victimId)},expected=${index},deadline=Date.now()+40000;
      document.querySelector('canvas').focus();
      try{
        while(Date.now()<deadline){
          const s=state(),p=s.players.find(p=>p.id===s.playerId),t=s.players.find(p=>p.id===victimId);
          if(s.phase==='FINISHED'&&p.kills<expected)throw new Error('Natural objective missed before settlement: '+JSON.stringify(s));
          if(p.kills>=expected)return {attacker:p,victim:t,phase:s.phase,remaining:s.remaining};
          if(!t.alive){await new Promise(r=>setTimeout(r,100));continue;}
          const bearing=Math.atan2(t.x-p.x,t.z-p.z),delta=Math.atan2(Math.sin(bearing-p.yaw-p.aim),Math.cos(bearing-p.yaw-p.aim));
          if(Math.abs(delta)>0.025){
            if(${mode}===4)key('keyup','Space');else key('keydown','Space');const code=delta>0?'ArrowRight':'ArrowLeft';key('keydown',code);
            await new Promise(r=>setTimeout(r,Math.min(250,Math.max(50,Math.abs(delta)/0.9*750))));key('keyup',code);
            await new Promise(r=>setTimeout(r,150));
          }else{
            key('keydown','Space');await new Promise(r=>setTimeout(r,100));
          }
        }
        throw new Error('Natural kill '+expected+' timeout: '+JSON.stringify(state()));
      }finally{for(const code of ['Space','ArrowLeft','ArrowRight'])key('keyup',code);}
    })()`);
    assert.equal(action.attacker.kills,index);assert.equal(action.victim.deaths,index);
    if(index<killTarget){
      assert.equal(action.phase,'PLAYING');
      for(const page of pages)await waitUntil(page.sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).renderedActions.some(p=>p.id===${JSON.stringify(victimId)}&&p.action==='09')`);
      for(const page of pages)await waitUntil(page.sessionId, `(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world),p=s.players.find(p=>p.id===${JSON.stringify(victimId)});return p.alive&&p.hp===p.maxHp&&p.deaths===${index}})()`);
    }
    if(mode===1)assert.equal((await state(a)).match.teamLives[action.victim.team],killTarget-index);
    kills.push(action);console.log(`natural mode ${mode} ${index}/${killTarget}, source timer ${action.remaining}s`);
  }
  for(const page of pages)await waitUntil(page.sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'`);
  const elapsedSeconds=(Date.now()-startedAt)/1000;
  assert(elapsedSeconds<timeLimit);
  for(const page of pages)await waitUntil(page.sessionId, `JSON.parse(document.querySelector('#battle-status').dataset.world).phase==='FINISHED'`);
  const finished=await Promise.all(pages.map(page=>state(page.sessionId)));
  const result=finished[0].match.result;
  assert.equal(result.reason,'OBJECTIVE');
  assert.equal(result.players.find(p=>p.id===initial[0].playerId).kills,killTarget);
  assert.equal(result.players.find(p=>p.id===victimId).deaths,killTarget);
  assert.equal(result.players.length,count);
  assert.equal(result.players.find(p=>p.id===initial[0].playerId).outcome,'WIN');
  if(mode===4)assert.equal(result.winnerPlayerId,initial[0].playerId);
  else assert.equal(result.winnerTeam,initial[0].players.find(p=>p.id===initial[0].playerId).team);
  for(const s of finished){assert.deepEqual(s.match.result,result);assert.equal(s.remaining,0);assert.equal(s.bullets,0);}
  for(const page of pages)await waitUntil(page.sessionId, `document.querySelectorAll('[data-result-player]').length===${count}`);
  const screenshot=await command('Page.captureScreenshot',{format:'png'},a);
  await writeFile(`recovery/output/${evidenceName}.png`,Buffer.from(screenshot.data,'base64'));
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
  await writeFile(`recovery/output/${evidenceName}.json`,JSON.stringify({status:'PASS',scope:`Two independent real browsers on original0007, original minimum/time limit, natural keyboard station movement, ${killTarget} natural kills and ${killTarget-1} fullHP respawns, objective terminal winner, identical settlement/frozen result, unanimous rematch/reset and exit. No injected clocks/damage/positions/snapshots.`,mode,timeLimit,elapsedSeconds,viewport:{width:960,height:540,hardwareScaling:3},initial,steering,kills,finished,replay},null,2));
  console.log(`PASS: two-browser natural mode ${mode}, ${killTarget}-kill objective, respawns, settlement, rematch and exit`);
} catch(error) {
  const snapshots=await Promise.all(pages.map(page=>state(page.sessionId).catch(()=>undefined)));
  await writeFile(`recovery/output/${evidenceName}-failure.json`,JSON.stringify({status:'FAIL',mode,killTarget,error:String(error),snapshots},null,2));
  throw error;
} finally {
  for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId}).catch(()=>{});
  ws.close();
}
