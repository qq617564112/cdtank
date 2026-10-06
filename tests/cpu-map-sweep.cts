import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {World} from '../apps/server/src/world';
const shard = Number(process.argv[2] ?? 0);
const shards = Number(process.argv[3] ?? 1);
const maps = new World().listMaps().filter((_, index) => index % shards === shard)
  .filter(map => !process.argv[4] || map.mode === Number(process.argv[4]))
  .filter(map => !process.argv[5] || map.mapId === Number(process.argv[5]));
const rows = [];
for (const map of maps) {
  console.log(JSON.stringify({status: 'START', mode: map.mode, mapId: map.mapId}));
  let now = 100000;
  const world = new World(() => now);
  const joined = world.createAndJoin(`sweep-${map.mode}-${map.mapId}`, map.mode, map.mapId, 'CPU map validation', 'Observer', 1);
  const count = Math.max(4, map.sourceMinPlayers);
  for (let index = 1; index < count; index++) world.manageCpu(joined.playerId, 1, 'ADD', index % 2 ? 1 : 105);
  world.ready(joined.playerId, 1);
  const snapshot = () => world.snapshot(joined.roomId)!;
  assert.equal(snapshot().phase, 'PLAYING');
  const initial = snapshot();
  let fire = 0, hit = 0, maxStepMs = 0, simulationMs = 0;
  const displacement = new Map(initial.players.filter(p => p.isCpu).map(p => [p.id, 0]));
  let previous = initial;
  for (let tick = 0; tick <= map.timeLimit * 20 && snapshot().phase === 'PLAYING'; tick++) {
    now += 50;
    const start = performance.now();
    const result = world.step(50);
    const cost = performance.now() - start;
    maxStepMs = Math.max(maxStepMs, cost); simulationMs += cost;
    fire += result.events.filter(e => e.type === 'fire').length;
    hit += result.events.filter(e => e.type === 'hit' || e.type === 'objectiveHit').length;
    if (tick % 20 === 0) {
      const current = snapshot();
      for (const player of current.players.filter(p => p.isCpu)) {
        const before = previous.players.find(p => p.id === player.id)!;
        if (player.deaths === before.deaths) displacement.set(player.id,
          displacement.get(player.id)! + Math.hypot(player.x - before.x, player.z - before.z));
      }
      previous = current;
    }
  }
  const finished = snapshot();
  assert.equal(finished.phase, 'FINISHED');
  const result = structuredClone(finished.match!.result);
  now += 1000; world.step(1000); assert.deepEqual(snapshot().match!.result, result);
  world.rematch(joined.playerId, 1); assert.equal(snapshot().match!.round, 2);
  assert(snapshot().players.every(p => p.alive && p.kills === 0 && p.hp === p.maxHp));
  world.leave(joined.playerId); assert.equal(world.snapshot(joined.roomId), undefined);
  const row = {mode:map.mode,mapId:map.mapId,count,timeLimit:map.timeLimit,fire,hit,
    travelled:Object.fromEntries(displacement),maxStepMs,simulationMs,
    active:fire>0&&hit>0&&[...displacement.values()].some(v=>v>20),initial,finished};
  writeFileSync(`recovery/output/cpu-map-${map.mode}-${map.mapId}.json`, JSON.stringify(row,null,2));
  rows.push(row);
  console.log(JSON.stringify({mode:map.mode,mapId:map.mapId,fire,hit,active:row.active,reason:result!.reason,simulationMs:Math.round(simulationMs),maxStepMs:Math.round(maxStepMs)}));
}
const selection = process.argv[4] ? `-mode${process.argv[4]}${process.argv[5] ? `-map${process.argv[5]}` : ''}` : '';
writeFileSync(`recovery/output/cpu-map-shard${shard}${selection}.json`,JSON.stringify({scope:'CPU ordinary inputs, original map/count/time, simulated clock; lifecycle checks are assertions, activity and step cost are measurements, not automatic fidelity/performance acceptance.',rows},null,2));
