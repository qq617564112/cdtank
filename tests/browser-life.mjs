import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const endpoint = process.argv[2];
const origin = process.argv[3] ?? 'http://127.0.0.1:5173';
if (!endpoint) throw new Error('Usage: node tests/browser-battle.mjs <Chromium CDP WebSocket URL>');
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
  const {targetId} = await command('Target.createTarget', {url: origin, newWindow: true});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  pages.push({targetId});
  await waitUntil(sessionId, `document.querySelector('#tank')?.options.length===21`);
  const result = await evaluate(sessionId, `(async()=>{
    const source=await (await fetch('/src/main.ts')).text();
    const url=source.match(/from \"([^\"]*@babylonjs_core.js[^\"]*)\"/)[1];
    const {EngineStore}=await import(url);
    const {TankView}=await import('/src/assets/tanks/tank-view.ts');
    const {Battle}=await import('/src/match/battle.ts');
    const {ScenePreview}=await import('/src/assets/scenes/scene-preview.ts');
    const scene=EngineStore.LastCreatedScene;
    const hud=document.createElement('output');
    const battle=new Battle(scene,scene.activeCamera,hud);
    await battle.originalHud.load();
    await battle.listRooms();
    battle.active=true; battle.roomFeed.enter('life-fixture'); battle.playerId='life-fixture';
    const player={id:'life-fixture',tankId:1,x:0,y:0,z:0,yaw:0,aim:0,alive:true,hp:100,maxHp:100,score:0};
    const snapshot={roomId:'life-fixture',mode:4,serverTime:0,tick:1,phase:'PLAYING',remaining:100,players:[player],bullets:[],teamScores:[0,0],winnerTeam:-1};
    const receive=value=>battle.client._msgHandlers.forEachHandler('RoomSnapshot',{error:(_label,error)=>{throw error;}},value,'RoomSnapshot');
    receive(snapshot);
    const loadDeadline=Date.now()+45000;
    while(!battle.players.resourcesReady && Date.now()<loadDeadline)await new Promise(r=>setTimeout(r,20));
    const view=battle.players.get(player.id);
    if(!view)throw new Error('Player resource readiness timeout');
    const trace=[];
    const oldSnapshot=battle.roomFeed.snapshot;
    const oldClear=battle.effects.clear.bind(battle.effects);
    const oldReset=battle.players.resetRound.bind(battle.players);
    const oldReconcile=battle.reconcile.bind(battle);
    battle.effects.clear=()=>{if(battle.roomFeed.snapshot!==oldSnapshot)throw new Error('Effect clear after commit');trace.push('effects');return oldClear();};
    battle.players.resetRound=(players)=>{if(battle.roomFeed.snapshot!==oldSnapshot)throw new Error('Player reset after commit');trace.push('players');return oldReset(players);};
    let nextSnapshot={...snapshot,tick:2,match:{round:2,readyPlayerIds:[],rematchPlayerIds:[],minPlayers:1,targetScore:10,teamLives:[],objectives:[]}};
    battle.reconcile=(next)=>{if(battle.roomFeed.snapshot!==nextSnapshot)throw new Error('Reconcile before commit');trace.push('reconcile');return oldReconcile(next);};
    battle.input.keys.add('KeyW');
    receive(nextSnapshot);
    if(trace.join(',')!=='effects,players,reconcile' || battle.input.keys.size)throw new Error('Round cleanup ordering');
    battle.effects.clear=oldClear;battle.players.resetRound=oldReset;battle.reconcile=oldReconcile;
    Object.assign(snapshot,nextSnapshot);
    let clears=0;
    const oldSkills=battle.skillEffects;
    battle.skillEffects={clear:()=>{clears++;},event:()=>{}};
    const finished={...nextSnapshot,phase:'FINISHED',tick:3};
    receive(finished);receive({...finished,tick:4});
    if(clears!==1)throw new Error('Finish transition cleared skills repeatedly');
    const eventTrace=[];
    const hudEvent=battle.originalHud.event.bind(battle.originalHud);
    const soundEvent=battle.sound.event.bind(battle.sound);
    const playerFire=battle.players.fire.bind(battle.players);
    battle.originalHud.event=()=>{eventTrace.push('hud');};
    battle.skillEffects.event=()=>{eventTrace.push('skills');};
    battle.sound.event=()=>{eventTrace.push('sound');};
    battle.players.fire=()=>{eventTrace.push('fire');};
    const fire={roomId:'life-fixture',type:'fire',message:'',playerId:player.id,targetId:'',value:0,x:0,y:0,z:0};
    const dispatchEvent=value=>battle.client._msgHandlers.forEachHandler('RoomEvent',{error:(_label,error)=>{throw error;}},value,'RoomEvent');
    dispatchEvent({...fire,roomId:'wrong-room'});
    if(eventTrace.length)throw new Error('Wrong room event reached presentation');
    dispatchEvent(fire);
    if(eventTrace.join(',')!=='hud,skills,sound,fire')throw new Error('Event presentation ordering');
    battle.originalHud.event=hudEvent;battle.sound.event=soundEvent;battle.players.fire=playerFire;battle.skillEffects=oldSkills;
    receive(nextSnapshot);
    const waitAction=async(action)=>{const end=Date.now()+45000;while(Date.now()<end){battle.render();if(view.activeAction===action)return;await new Promise(r=>setTimeout(r,20));}throw new Error('Action timeout '+action);};
    player.alive=false; player.hp=0;
    receive(snapshot);
    await waitAction('09');
    if(!view.root.isEnabled())throw new Error('Death root hidden');
    player.alive=true; player.hp=100;
    player.x=500; player.z=700; player.yaw=1.2;
    receive(snapshot);
    battle.render();
    if(view.root.position.x!==-500 || view.root.position.z!==700 || Math.abs(view.root.rotation.y+1.2)>0.000001){
      throw new Error('Revival interpolated across the map');
    }
    await waitAction('01');
    const originalFire=view.fire.bind(view);
    let pending;
    view.fire=()=>{pending=originalFire();return pending;};
    battle.players.fire(player.id);
    battle.leave();
    await pending.catch(()=>{});
    if(battle.players.loadingError)throw new Error('Stale action error polluted player state');
    if(hud.value!=='')throw new Error('Stale action error polluted HUD '+hud.value);
    await battle.listRooms();
    battle.active=true; battle.roomFeed.enter('load-fixture');
    const loadingSnapshot={...snapshot,roomId:'load-fixture',players:[{...player,id:'pending-player'}]};
    const originalLoad=TankView.load;
    let complete;
    const loading=new Promise(resolve=>{complete=resolve;});
    TankView.load=async(...args)=>{try{return await originalLoad.apply(TankView,args);}finally{complete();}};
    receive(loadingSnapshot);
    battle.leave();
    await loading;
    await new Promise(r=>setTimeout(r,0));
    TankView.load=originalLoad;
    if(battle.players.size || battle.players.resourcesReady || battle.players.loadingError || hud.value!=='')throw new Error('Stale player load polluted next session');
    if(scene.transformNodes.some(n=>n.name==='player-pending-player'))throw new Error('Stale player root leaked');
    const preview=new ScenePreview(scene,scene.activeCamera);
    const cancelled=preview.load('0002');
    preview.clear();
    if(await cancelled!=='')throw new Error('Cancelled catalog load completed');
    const mapLoading=preview.load('0002');
    const deadline=Date.now()+45000;
    while(!preview.assets.length && Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
    if(!preview.assets.length)throw new Error('Terrain load timeout');
    preview.clear();
    if(await mapLoading!=='')throw new Error('Cancelled map load completed');
    if(preview.assets.length || preview.disposals.length || scene.transformNodes.some(n=>n.name.startsWith('placement-'))){
      throw new Error('Cancelled map leaked assets or placements');
    }
    return {snapshotDeath:'09',snapshotRevival:'01',deathVisible:true,pendingActionExit:true,pendingPlayerExit:true,pendingMapExit:true,source:'explicit snapshot fixtures; no simulated combat claim'};
  })()`);
  assert.equal(result.snapshotDeath,'09');
  assert.equal(result.snapshotRevival,'01');
  await writeFile('recovery/output/browser-life.json',JSON.stringify(result,null,2));
  console.log('PASS: Battle snapshot death/revival, visible source death model, pending action/player/map exit cleanup and HUD isolation');
} finally {
  for (const page of pages) await command('Target.closeTarget', {targetId: page.targetId});
  ws.close();
}
