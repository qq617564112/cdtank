import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
const native: {rows: {tankId: number; part: number; base: Record<string, number>; equipment: Record<string, number>; values: {roleFloats: Record<string, number>}}[]} = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json','utf8'));
const rows=[];
for (const original of [false,true]) {
  let now=100000;
  const world=new World(()=>now);
  const joined=world.createAndJoin('reload',4,7,'Reload','Player',1);
  const source=native.rows.find(row=>row.tankId===1&&row.part===0)!;
  if(original){
    const fields=(row: Record<string,number>)=>new Map(Object.entries(row).map(([key,value])=>[Number(key),value]));
    world.bindRoleSources(joined.playerId,{base:{name:'Explicit native fixture',fields:fields(source.base)},equipment:{name:'Explicit native fixture',fields:fields(source.equipment)}});
  }
  world.ready(joined.playerId,1);
  const local=()=>world.snapshot(joined.roomId)!.players.find(player=>player.id===joined.playerId)!;
  assert.equal(local().reload!.remaining,0);
  world.updateInput(joined.playerId,{sequence:1,move:0,turn:0,aim:0,fire:true,useItem:0,clientTime:now});
  now+=50;
  const fired=world.step(50).events.filter(event=>event.type==='fire');assert.equal(fired.length,1);
  const reload=local().reload!;
  assert.equal(reload.source,original?'original-normal':'rebuilt');
  if(original)assert.equal(reload.duration,source.values.roleFloats['80']);
  assert(reload.remaining>0&&reload.remaining<=reload.duration+.00001);
  now+=50;assert(!world.step(50).events.some(event=>event.type==='fire'));
  assert(local().reload!.remaining<reload.remaining);
  world.updateInput(joined.playerId,{sequence:2,move:0,turn:0,aim:0,fire:false,useItem:0,clientTime:now});
  now+=Math.ceil(reload.duration*1000)+100;world.step(50);
  assert.equal(local().reload!.remaining,0);
  rows.push({original,reload});world.leave(joined.playerId);
}
// Natural CPU combat exercises death, respawn and rematch without health or outcome writes.
let clock = 200000;
const battle = new World(() => clock);
const joined = battle.createAndJoin('reload-life', 4, 7, 'Reload lifecycle', 'Observer', 1);
for (let index = 0; index < 3; index++) battle.manageCpu(joined.playerId, 1, 'ADD', 1);
battle.configureAutopilot(joined.playerId, 1, true);
battle.ready(joined.playerId, 1);
let deaths = 0, respawns = 0, fired = 0;
const dead = new Set<string>();
for (let tick = 0; tick < 6500; tick++) {
  clock += 50;
  const step = battle.step(50);
  fired += step.events.filter(event => event.type === 'fire').length;
  const snapshot = battle.snapshot(joined.roomId)!;
  for (const player of snapshot.players) {
    if (!player.alive) {
      assert.equal(player.reload!.remaining, 0, 'Dead roles cannot publish an active reload');
      if (!dead.has(player.id)) deaths++;
      dead.add(player.id);
    } else if (dead.delete(player.id)) {
      // A CPU may immediately fire after revival; an old shot must never survive.
      assert(player.reload!.startedAt === 0 || player.reload!.startedAt === clock);
      respawns++;
    }
  }
  if (snapshot.phase === 'FINISHED') break;
}
assert.equal(battle.snapshot(joined.roomId)!.phase, 'FINISHED');
assert(deaths > 0 && respawns > 0 && fired > 0);
battle.rematch(joined.playerId, 1);
const rematch = battle.snapshot(joined.roomId)!;
assert.equal(rematch.phase, 'PLAYING');
assert(rematch.players.every(player => player.reload!.remaining === 0 && player.reload!.startedAt === 0));
battle.leave(joined.playerId);
writeFileSync('recovery/output/world-reload-feedback.json',JSON.stringify({status:'PASS',rows,lifecycle:{deaths,respawns,fired},scope:'Actual ordinary World fire/deadline refusal, complete native source duration versus prototype fallback, snapshot remaining, natural CPU death/respawn and rematch reset. No original ammo consumption provenance.'},null,2)+'\n');
console.log('PASS: ordinary fire and deadline refusal publish actual native/fallback reload duration and completion');
