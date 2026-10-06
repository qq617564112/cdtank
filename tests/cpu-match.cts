import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';

let now = 100000;
const evidence = [];
for (const mode of (process.argv[2] ? [Number(process.argv[2])] : [1, 2, 3, 4, 5])) {
  const world = new World(() => now);
  const maps = world.listMaps();
  const mapId = mode === 1 || mode === 4 ? 7 : mode === 5 ? 20 : 2;
  const joined = world.createAndJoin(`human-${mode}`, mode, mapId, 'CPU validation', 'Observer', 1);
  const snapshot = () => world.snapshot(joined.roomId)!;
  const cpuIds: string[] = [];
  const count = Math.max(4, maps.find(m => m.mode === mode && m.mapId === mapId)!.sourceMinPlayers);
  for (let index = 1; index < count; index++) cpuIds.push(world.manageCpu(joined.playerId, 1, 'ADD', index % 2 ? 1 : 105));
  assert.equal(snapshot().phase, 'WAITING');
  assert.equal(snapshot().match!.readyPlayerIds.length, count - 1);
  assert(snapshot().players.filter(p => cpuIds.includes(p.id)).every(p => p.isCpu));
  assert.throws(() => world.manageCpu(cpuIds[0], 1, 'ADD', 1));
  const other = world.joinRoom(joined.roomId, `guest-${mode}`, 'Guest', 1);
  assert.throws(() => world.manageCpu(other.playerId, 1, 'ADD', 1));
  world.leave(other.playerId);
  world.ready(joined.playerId, 1);
  assert.equal(snapshot().phase, 'PLAYING');
  assert.throws(() => world.manageCpu(joined.playerId, 1, 'REMOVE', 1, cpuIds[0]));
  const rounds = [];
  for (const round of [1, 2]) {
    assert.equal(snapshot().match!.round, round);
    const initial = snapshot();
    let fire = 0, hit = 0, deaths = 0, respawns = 0;
    const positions = new Map(initial.players.map(p => [p.id, [p.x, p.z]]));
    let moved = false;
    for (let tick = 0; tick < 6200 && snapshot().phase === 'PLAYING'; tick++) {
      now += 50;
      const step = world.step(50);
      if (mode === 5 && tick % 1000 === 0) console.log(JSON.stringify({round, tick, players:snapshot().players.map(p=>[p.x,p.z,p.kills,p.objectivesDestroyed]),fire,hit}));
      fire += step.events.filter(e => e.type === 'fire' && cpuIds.includes(e.playerId)).length;
      hit += step.events.filter(e => (e.type === 'hit' || e.type === 'objectiveHit') && cpuIds.includes(e.playerId)).length;
      deaths += step.events.filter(e => e.type === 'destroy').length;
      respawns += step.events.filter(e => e.type === 'respawn').length;
      if (tick % 20 === 0) moved ||= snapshot().players.some(p => p.isCpu
        && Math.hypot(p.x - positions.get(p.id)![0], p.z - positions.get(p.id)![1]) > 20);
    }
    const finished = snapshot();
    assert(finished.players.filter(player => player.isCpu).every(player => player.selectedAmmoSlot === 1),
      'CPUs must select default ammo through the same authoritative shortcut input');
    assert.equal(finished.phase, 'FINISHED');
    assert(moved, `CPU should navigate in mode ${mode}`);
    assert(fire > 0, `CPU should fire in mode ${mode}`);
    assert(hit > 0, `CPU should hit in mode ${mode}`);
    if (mode === 1 || mode === 4) assert(respawns > 0);
    const frozen = structuredClone(finished.match!.result);
    now += 1000; world.step(1000);
    assert.deepEqual(snapshot().match!.result, frozen);
    rounds.push({round, fire, hit, deaths, respawns, initial, finished});
    console.log(JSON.stringify({mode, round, fire, hit, deaths, respawns, reason: frozen!.reason}));
    if (round === 1) {
      world.rematch(joined.playerId, round);
      assert.equal(snapshot().phase, 'PLAYING');
      assert.equal(snapshot().match!.round, 2);
      assert.deepEqual(snapshot().players.filter(player => player.isCpu).map(player => player.id), cpuIds);
      assert(snapshot().players.every(player => player.alive && player.hp === player.maxHp
        && player.kills === 0 && player.deaths === 0 && player.objectivesDestroyed === 0));
    }
  }
  world.leave(joined.playerId);
  assert.equal(world.snapshot(joined.roomId), undefined, 'No orphan CPU rooms after last human leaves');
  evidence.push({mode, ...rounds[0], rounds});
  writeFileSync(`recovery/output/cpu-match-mode${mode}.json`, JSON.stringify(evidence.at(-1), null, 2));
}
writeFileSync('recovery/output/cpu-match.json', JSON.stringify({scope: 'World CPU normal 50ms inputs/physics, original counts/time. Simulated clock, no damage/position injections; not browser or original AI fidelity.', evidence}, null, 2));
console.log(`PASS: CPU navigation/combat modes ${evidence.map(row=>row.mode).join(',')}, two complete rounds, ordinary rules, readiness, frozen settlement, rematch and room cleanup`);
