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
try {
  for(let index=0;index<2;index++) {
    const {targetId}=await command('Target.createTarget',{url:'http://127.0.0.1:5173',newWindow:true});
    const {sessionId}=await command('Target.attachToTarget',{targetId,flatten:true});
    pages.push({targetId,sessionId});
    await command('Emulation.setDeviceMetricsOverride',{width:960,height:540,deviceScaleFactor:1,mobile:false},sessionId);
    await waitUntil(sessionId,`document.querySelector('#tank')?.options.length===21`);
    await evaluate(sessionId,`(async()=>{
      const source=await(await fetch('/src/main.ts')).text();
      const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
      const {EngineStore}=await import(url);
      EngineStore.LastCreatedEngine.setHardwareScalingLevel(3);
      EngineStore.LastCreatedEngine.resize();
    })()`);
    await evaluate(sessionId,`document.querySelector('#refresh-rooms').click()`);
    await waitUntil(sessionId,`document.querySelector('#room').options.length>0`);
    if(index===0){
      pages[0].roomId=await evaluate(sessionId,`Array.from(document.querySelector('#room').options).find(o=>o.textContent.includes('团队模式') && o.textContent.includes('田野路') && o.textContent.includes('(0/'))?.value`);
      assert(pages[0].roomId,'Need an empty source-map team room');
    }
    await evaluate(sessionId,`document.querySelector('#room').value=${JSON.stringify(pages[0].roomId)};document.querySelector('#tank').value='1';document.querySelector('#player-name').value='Combat${index}';document.querySelector('#join').click()`);
    await waitUntil(sessionId,`document.querySelector('#battle-status').dataset.world && !document.querySelector('#leave').hidden`);
    await evaluate(sessionId, `document.querySelector('[data-match-panel]:not([hidden]) [data-ready]').click()`);
    console.log('Browser joined',index);
  }
  const [a,b]=pages.map(p=>p.sessionId);
  const music=[];
  for(const session of [a,b]){
    await command('Input.dispatchMouseEvent',{type:'mousePressed',x:600,y:300,button:'left',clickCount:1},session);
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:600,y:300,button:'left',clickCount:1},session);
    await waitUntil(session,`(()=>{const audio=document.querySelector('[data-source-audio="battle-music"]');return audio.dataset.state==='playing' && !audio.paused && audio.currentTime>0;})()`);
    const record=await evaluate(session,`(()=>{const audio=document.querySelector('[data-source-audio="battle-music"]');return{musicId:audio.dataset.musicId,src:audio.currentSrc,time:audio.currentTime,loop:audio.loop,volume:audio.volume};})()`);
    assert.equal(record.musicId,'193');assert(record.src.endsWith('/GAM02.mp3'));
    assert.equal(record.loop,true);assert.equal(record.volume,.5);music.push(record);
    await waitUntil(session,`document.querySelector('[data-source-audio="battle-sound"]').dataset.state==='running'`);
  }
  const state=session=>evaluate(session,`JSON.parse(document.querySelector('#battle-status').dataset.world)`);
  for(const session of [a,b])await waitUntil(session,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world);return s.mapLoaded && s.renderedPlayers===2 && s.renderedActions.every(p=>p.action==='01')})()`);
  const initial=await state(a);
  const attacker=initial.players.find(p=>p.id===initial.playerId);
  const victim=initial.players.find(p=>p.id!==initial.playerId);
  assert.notEqual(attacker.team,victim.team);
  assert.equal(initial.mapId,2);
  const aiming=await evaluate(a,`(async()=>{
    const state=()=>JSON.parse(document.querySelector('#battle-status').dataset.world);
    const key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code}));
    document.querySelector('canvas').focus();
    const end=Date.now()+45000;
    try{
      while(Date.now()<end){
        const s=state(),p=s.players.find(p=>p.id===s.playerId),t=s.players.find(p=>p.id!==s.playerId);
        const bearing=Math.atan2(t.x-p.x,t.z-p.z);
        const delta=Math.atan2(Math.sin(bearing-p.yaw-p.aim),Math.cos(bearing-p.yaw-p.aim));
        if(Math.abs(delta)<0.035)return {bearing,delta,yaw:p.yaw,aim:p.aim,distance:Math.hypot(t.x-p.x,t.z-p.z)};
        const code=delta>0?'ArrowRight':'ArrowLeft';
        key('keydown',code);
        await new Promise(r=>setTimeout(r,Math.min(250,Math.max(50,Math.abs(delta)/0.9*1000))));
        key('keyup',code);
        await new Promise(r=>setTimeout(r,1000));
      }
      throw new Error('Aim convergence timeout');
    }finally{key('keyup','ArrowLeft');key('keyup','ArrowRight');}
  })()`);
  console.log('Aimed at source-spawn enemy',aiming);
  for(const session of [a,b])await evaluate(session,`(async()=>{
    const source=await(await fetch('/src/main.ts')).text();
    const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);
    const scene=EngineStore.LastCreatedScene;
    window.__combatEvidence={};
    scene.onBeforeRenderObservable.add(()=>{
      const raw=document.querySelector('#battle-status').dataset.world;
      if(!raw)return;
      const world=JSON.parse(raw),player=world.players.find(p=>p.id===${JSON.stringify(victim.id)});
      const root=scene.getTransformNodeByName('player-'+${JSON.stringify(victim.id)});
      const victimPanel=[...document.querySelectorAll('#original-battle-hud [data-player-id]')].find(p=>p.dataset.playerId===${JSON.stringify(victim.id)});
      const victimIcon=victimPanel?.querySelector('[data-tank-id]');
      const attackerPanel=[...document.querySelectorAll('#original-battle-hud [data-player-id]')].find(p=>p.dataset.playerId===${JSON.stringify(attacker.id)});
      const attackerIcon=attackerPanel?.querySelector('[data-tank-id]');
      if(attackerIcon?.dataset.expression==='attack' && !window.__combatEvidence.attack){
        window.__combatEvidence.attack={playerId:attackerIcon.closest('[data-player-id]').dataset.playerId,portrait:attackerIcon.style.backgroundImage,time:performance.now()};
      }
      if(attackerIcon && ['yeah1','yeah2'].includes(attackerIcon.dataset.expression)){
        window.__combatEvidence.victory??={};
        window.__combatEvidence.victory[attackerIcon.dataset.expression]??={portrait:attackerIcon.style.backgroundImage,playerId:${JSON.stringify(attacker.id)}};
      }
      if(victimIcon?.dataset.expression==='wound')window.__combatEvidence.wound??={portrait:victimIcon.style.backgroundImage,hp:player?.hp};
      if(player && !player.alive && victimIcon?.dataset.expression==='dead')window.__combatEvidence.deadPortrait??={portrait:victimIcon.style.backgroundImage,playerId:player.id};
      if(player && !player.alive && root?.metadata?.action==='09'){
        const hud=document.querySelector('#original-battle-hud');
        window.__combatEvidence.dead??={world,visible:root.isEnabled(),action:root.metadata.action,
          hudVisible:!hud.hidden,hudHp:hud.querySelector('[data-source-control="prgLife"]').getAttribute('aria-valuenow'),
          roster:[...hud.querySelectorAll('[data-player-id]')].map(panel=>({id:panel.dataset.playerId,
            hp:panel.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'),
            portrait:panel.querySelector('[data-source-control^="picPlayerIcon"][data-tank-id]').style.backgroundImage,
            tankId:panel.querySelector('[data-source-control^="picPlayerIcon"][data-tank-id]').dataset.tankId}))};
      }
    });
  })()`);
  await evaluate(a,`window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'}))`);
  await waitUntil(b,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.some(p=>p.id===${JSON.stringify(victim.id)} && p.hp<p.maxHp)`);
  const hit=await state(b);
  await waitUntil(b,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.some(p=>p.id===${JSON.stringify(victim.id)} && !p.alive)`);
  await evaluate(a,`window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space'}))`);
  await waitUntil(b,`window.__combatEvidence?.dead`);
  const screenshot=await command('Page.captureScreenshot',{format:'png'},b);
  await writeFile('recovery/output/browser-combat-death.png',Buffer.from(screenshot.data,'base64'));
  const dead=[];
  for(const session of [a,b]){
    await waitUntil(session,`window.__combatEvidence?.dead`);
    const evidence=await evaluate(session,`window.__combatEvidence.dead`);
    assert.equal(evidence.visible,true);assert.equal(evidence.action,'09');
    assert.equal(evidence.hudVisible,true);
    assert.equal(evidence.roster.length,2);
    assert.equal(evidence.roster.find(player=>player.id===victim.id).hp,'0');
    assert.equal(evidence.roster.find(player=>player.id===attacker.id).hp,'300');
    assert(evidence.roster.every(player=>player.tankId==='1' && player.portrait.includes('/ui/regions/')));
    assert.notEqual(evidence.roster[0].portrait,evidence.roster[1].portrait);
    const target=evidence.world.players.find(p=>p.id===victim.id);
    const owner=evidence.world.players.find(p=>p.id===attacker.id);
    assert.equal(target.alive,false);assert.equal(target.hp,0);assert.equal(target.deaths,1);
    assert.equal(owner.kills,1);assert(owner.score>0);
    dead.push(evidence);
  }
  assert.equal(dead[1].hudHp,'0');
  const sounds=[];
  for(const session of [a,b]){
    const result=await evaluate(session,`(()=>{const audio=document.querySelector('[data-source-audio="battle-sound"]');return{state:audio.dataset.state,events:JSON.parse(audio.dataset.events),volume:Number(audio.dataset.volume)};})()`);
    assert.equal(result.state,'running');assert.equal(result.volume,.5);
    sounds.push(result);
  }
  const kills=sounds[0].events.filter(event=>event.type==='destroy');
  assert.equal(kills.length,1);assert.equal(kills[0].soundId,55);
  assert.equal(kills[0].playerId,attacker.id);assert.equal(kills[0].targetId,victim.id);
  assert.equal(sounds[1].events.filter(event=>event.type==='destroy').length,0,'Enemy kill must not play in team mode');
  for(const client of sounds){
    const fire=client.events.filter(event=>event.type==='fire');assert(fire.length>0);
    assert(fire.every(event=>event.soundId===48 && event.skillId===2001 && event.playerId===attacker.id));
  }
  const expressions=[];
  for(const session of [a,b]){
    await waitUntil(session,`window.__combatEvidence?.deadPortrait`);
    await waitUntil(session,`window.__combatEvidence?.victory?.yeah1 && window.__combatEvidence?.victory?.yeah2`);
    const evidence=await evaluate(session,`({attack:window.__combatEvidence.attack,wound:window.__combatEvidence.wound,death:window.__combatEvidence.deadPortrait,victory:window.__combatEvidence.victory})`);
    assert.equal(evidence.attack?.playerId,attacker.id);assert(evidence.attack.portrait.includes('/ui/regions/'));
    assert(evidence.wound?.portrait.includes('/ui/regions/'));
    assert.equal(evidence.death.playerId,victim.id);
    assert.notEqual(evidence.wound.portrait,evidence.death.portrait);
    assert.equal(evidence.victory.yeah1.playerId,attacker.id);
    assert.equal(evidence.victory.yeah2.playerId,attacker.id);
    expressions.push(evidence);
  }
  assert.notEqual(expressions[0].death.portrait,expressions[1].death.portrait);
  assert.notEqual(expressions[0].victory.yeah1.portrait,expressions[0].victory.yeah2.portrait);
  assert.equal(expressions[1].victory.yeah1.portrait,expressions[1].victory.yeah2.portrait);
  const revived=[];
  for(const session of [a,b]){
    await waitUntil(session,`(()=>{const s=JSON.parse(document.querySelector('#battle-status').dataset.world),p=s.players.find(p=>p.id===${JSON.stringify(victim.id)});return p.alive && p.hp===p.maxHp && s.renderedActions.some(p=>p.id===${JSON.stringify(victim.id)} && p.action==='01')})()`);
    const s=await state(session);revived.push(s);
    assert.equal(s.players.find(p=>p.id===victim.id).deaths,1);
    assert.equal(s.players.find(p=>p.id===attacker.id).kills,1);
  }
  const field=JSON.parse(await readFile('recovery/output/web-assets/battlefields.json','utf8')).find(f=>f.id==='0002');
  const spawns=field.respawnGroups.flat().map(p=>p.position);
  const target=revived[1].players.find(p=>p.id===victim.id);
  // Match a recovered respawn slot in the original map export.
  assert(spawns.some(p=>Math.hypot(p[0]-target.x,p[2]-target.z)<0.03));
  const respawnShot=await command('Page.captureScreenshot',{format:'png'},b);
  await writeFile('recovery/output/browser-combat-respawn.png',Buffer.from(respawnShot.data,'base64'));
  await evaluate(a,`document.querySelector('#leave').click()`);
  const stoppedMusic=await evaluate(a,`(()=>{const audio=document.querySelector('[data-source-audio="battle-music"]');return{paused:audio.paused,src:audio.getAttribute('src'),state:audio.dataset.state};})()`);
  assert.deepEqual(stoppedMusic,{paused:true,src:null,state:'stopped'});
  const stoppedSound=await evaluate(a,`(()=>{const audio=document.querySelector('[data-source-audio="battle-sound"]');return{state:audio.dataset.state,voices:audio.dataset.voices,events:JSON.parse(audio.dataset.events)};})()`);
  assert.deepEqual(stoppedSound,{state:'stopped',voices:'0',events:[]});
  await waitUntil(b,`JSON.parse(document.querySelector('#battle-status').dataset.world).players.length===1`);
  const after=await state(b);
  assert.equal(after.players[0].id,victim.id);
  const rosterAfter=await evaluate(b,`[...document.querySelector('#original-battle-hud').querySelectorAll('[data-player-id]')].map(panel=>panel.dataset.playerId)`);
  assert.deepEqual(rosterAfter,[victim.id]);
  await writeFile('recovery/output/browser-combat.json',JSON.stringify({initial,aiming,hit,dead,expressions,revived,after,rosterAfter,music,stoppedMusic,sounds,stoppedSound},null,2));
  console.log('PASS: two real browser clients using keyboard input, original-map hit/destruction, both visible death actions, score ownership, full-health respawn and leave');
} finally {
  for(const page of pages)await command('Target.closeTarget',{targetId:page.targetId});
  ws.close();
}
