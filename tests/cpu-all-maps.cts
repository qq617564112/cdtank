import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {World} from '../apps/server/src/world';
import {MAPS} from '../apps/server/src/config';
import {getBattlefield} from '../apps/server/src/battlefield';
import {getSceneBreakables} from '../apps/server/src/scene-objects';
import type {MsgRoomSnapshot} from '../apps/shared/protocols';

// Clock advances at the production 50ms step; execution is accelerated, not realtime.
const output = process.env.CDTANK_MAP_ACCEPTANCE_OUTPUT ?? 'recovery/output/cpu-all-maps';
mkdirSync(output, {recursive: true});
const evidence: object[] = [];
const failures: string[] = [];
const selected = process.argv[2];
const maps = MAPS.filter(map => !selected || `${map.mode}-${map.mapId}` === selected);
assert(maps.length > 0, 'Requested mode-map must exist');
if (!selected) assert.equal(maps.length, 26);
for (const map of maps) {
  const key = `${map.mode}-${String(map.mapId).padStart(4, '0')}`;
  const errors: string[] = [];
  const check = (label: string, verify: () => void) => {
    try {verify();} catch (error) {errors.push(`${label}: ${String(error)}`);}
  };
  let now = 100000;
  const world = new World(() => now);
  const rounds: object[] = [];
  let joined: ReturnType<World['createAndJoin']> | undefined;
  const cpuIds: string[] = [];
  const count = Math.max(4, map.sourceMinPlayers);
  const tankIds = Array.from({length: count}, (_, index) => index % 2 ? 1 : 105);
  const fixture = {mode: map.mode, mapId: map.mapId, name: map.name, count, tankIds,
    sourceConfig: {...map}, stepMs: 50, initialClock: now,
    geometry: undefined as {sourceId: string; triangles: number; collisionBoxes: number;
      spawns: number; navigationLayers: number} | undefined};
  try {
    const field = getBattlefield(map.mapId);
    fixture.geometry = {sourceId: field.source.id, triangles: field.source.terrainTriangles.length,
      collisionBoxes: field.boxes.length, spawns: field.spawns.length,
      navigationLayers: field.source.navigationLayers.length};
    check('geometry', () => assert.equal(Number(field.source.id), map.mapId));
    joined = world.createAndJoin(`host-${key}`, map.mode, map.mapId, 'All maps acceptance', 'Host AI', tankIds[0]);
    const host = joined.playerId;
    const roomId = joined.roomId;
    const snapshot = (): MsgRoomSnapshot => world.snapshot(roomId)!;
    for (let index = 1; index < count; index++) cpuIds.push(world.manageCpu(host, 1, 'ADD', tankIds[index]));
    check('waiting/source minimum', () => {
      assert.equal(snapshot().phase, 'WAITING');
      assert.equal(snapshot().match!.minPlayers, map.sourceMinPlayers);
      assert.equal(snapshot().players.length, count);
      assert(count <= map.maxPlayers);
      assert.deepEqual(snapshot().match!.readyPlayerIds, cpuIds);
    });
    world.configureAutopilot(host, 1, true);
    check('host retains ready vote', () => assert(!snapshot().match!.readyPlayerIds.includes(host)));
    world.ready(host, 1);
    for (const round of [1, 2]) {
      const initial = snapshot();
      check(`round ${round} start`, () => {
        assert.equal(initial.phase, 'PLAYING');
        assert.equal(initial.match!.round, round);
        assert.equal(initial.remaining, map.timeLimit);
        assert(initial.players.every(player => player.alive && player.hp === player.maxHp
          && player.kills === 0 && player.deaths === 0 && player.objectivesDestroyed === 0));
        assert(initial.players.find(player => player.id === host)!.isAutopilot);
        assert.deepEqual(initial.players.filter(player => player.isCpu).map(player => player.id), cpuIds);
      });
      check(`round ${round} source spawns/objectives`, () => {
        initial.players.forEach((player, index) => {
          const spawn = field.spawn(index);
          assert.deepEqual([player.x, player.y, player.z, player.yaw],
            [Math.round(spawn.x * 100) / 100, Math.round(spawn.y * 100) / 100,
              Math.round(spawn.z * 100) / 100, Math.round(spawn.yaw * 10000) / 10000]);
        });
        if (map.mode === 5) {
          assert.deepEqual(initial.match!.objectives.map(objective => objective.sourcePlacementId),
            getSceneBreakables(map.mapId).map(source => source.id));
          assert(initial.match!.objectives.every(objective => objective.hp === (map.bunkerHp || 200)));
        }
        if (map.mode === 3) {
          assert.equal(initial.players.filter(player => player.isVIP).length, 2);
          assert(initial.players.filter(player => player.isVIP).every(player => player.hp === map.vipHp));
        }
      });
      const activity = new Map(initial.players.map(player => [player.id,
        {id: player.id, team: player.team, isVIP: player.isVIP, isCpu: !!player.isCpu,
          maxDisplacement: 0, fire: 0, hit: 0, objectiveHit: 0, destroy: 0, respawn: 0}]));
      const events: Record<string, number> = {};
      let maxCaptureScore = 0, contestedTicks = 0, ticks = 0;
      const timings: number[] = [];
      const startTime = now;
      const checkpoints: object[] = [];
      while (snapshot().phase === 'PLAYING' && ticks <= map.timeLimit * 20) {
        now += 50;
        const before = performance.now();
        const step = world.step(50);
        timings.push(performance.now() - before);
        ticks++;
        for (const event of step.events.filter(event => event.roomId === roomId)) {
          events[event.type] = (events[event.type] ?? 0) + 1;
          const actor = activity.get(event.playerId);
          if (actor && (event.type === 'fire' || event.type === 'hit' || event.type === 'objectiveHit'
              || event.type === 'destroy' || event.type === 'respawn')) actor[event.type]++;
        }
        const current = snapshot();
        current.players.forEach((player, index) => {
          const actor = activity.get(player.id)!;
          actor.maxDisplacement = Math.max(actor.maxDisplacement,
            Math.hypot(player.x - initial.players[index].x, player.z - initial.players[index].z));
        });
        maxCaptureScore = Math.max(maxCaptureScore, ...current.teamScores);
        if (current.match!.objectives.some(objective => objective.contested)) contestedTicks++;
        if (ticks % 1000 === 0) checkpoints.push({ticks, snapshot: current});
      }
      const finished = snapshot();
      const actors = [...activity.values()];
      const sums = (name: 'fire' | 'hit' | 'objectiveHit') => actors.reduce((sum, actor) => sum + actor[name], 0);
      check(`round ${round} natural finish`, () => {
        assert.equal(finished.phase, 'FINISHED');
        assert(['OBJECTIVE', 'TIME_LIMIT'].includes(finished.match!.result!.reason));
        assert(now - startTime <= map.timeLimit * 1000);
        assert.equal(finished.match!.result!.players.length, count);
        assert.equal(finished.bullets.length, 0);
        assert.equal(events.finish, 1);
        assert.equal(finished.match!.result!.round, round);
        assert.equal(finished.remaining, 0);
        if (finished.match!.result!.reason === 'TIME_LIMIT') assert.equal(now - startTime, map.timeLimit * 1000);
        for (const result of finished.match!.result!.players) {
          const player = finished.players.find(player => player.id === result.id)!;
          assert.equal(result.combatScore, player.score);
          assert.equal(result.kills, player.kills);
          assert.equal(result.deaths, player.deaths);
          assert.equal(result.objectivesDestroyed, player.objectivesDestroyed);
          const bonus = result.outcome === 'DRAW' ? map.drawScore
            : result.outcome === 'WIN' ? map.winScore : map.loseScore;
          assert.equal(result.outcomeBonus, bonus);
          assert.equal(result.totalScore, result.combatScore + bonus);
        }
      });
      check(`round ${round} meaningful gameplay`, () => {
        assert(actors.some(actor => actor.isCpu && actor.maxDisplacement > 20), 'CPU movement');
        assert(sums('fire') > 0, 'Ordinary fire');
        assert(sums('hit') + sums('objectiveHit') > 0, 'Ordinary hit');
        assert(actors.filter(actor => actor.isCpu).some(actor => actor.fire > 0), 'CPU fire');
        assert(actors.filter(actor => actor.isCpu).some(actor => actor.hit + actor.objectiveHit > 0), 'CPU hit');
        if (map.mode === 2) assert(maxCaptureScore > 0, 'Capture objective progress');
        if (map.mode === 5) {
          assert(finished.match!.objectives.length > 0);
          assert(finished.match!.objectives.some(objective => objective.hp === 0), 'Source objectives destroyed');
          if (finished.match!.result!.reason === 'OBJECTIVE') {
            assert(finished.match!.objectives.every(objective => objective.hp === 0), 'All source objectives destroyed');
          }
        } else assert(finished.players.some(player => player.deaths > 0), 'Combat damage must produce a death');
      });
      const frozen = structuredClone(finished);
      now += 1000;
      const afterFinish = world.step(1000);
      check(`round ${round} frozen settlement`, () => {
        assert.deepEqual(snapshot().match!.result, frozen.match!.result);
        assert.deepEqual(snapshot().players, frozen.players);
        assert.deepEqual(snapshot().match!.objectives, frozen.match!.objectives);
        assert.equal(afterFinish.events.filter(event => event.roomId === roomId).length, 0);
      });
      timings.sort((a, b) => a - b);
      const row = {round, ticks, objectivesDestroyed: finished.match!.objectives.filter(objective => objective.hp === 0
        && objective.kind === 'DESTROY').length, remainingObjectives: finished.match!.objectives.filter(objective => objective.hp > 0),
        simulatedSeconds: (finished.serverTime - startTime) / 1000,
        events, actors, maxCaptureScore, contestedTicks,
        stepMilliseconds: {p50: timings[Math.floor(timings.length * .5)],
          p95: timings[Math.floor(timings.length * .95)], max: timings.at(-1)},
        initial, finished, checkpoints};
      rounds.push(row);
      console.log(JSON.stringify({key, round, ticks, events, maxCaptureScore,
        reason: finished.match!.result?.reason, failures: errors.length}));
      if (round === 1) world.rematch(host, 1);
    }
  } catch (error) {errors.push(`execution: ${String(error)}`);}
  if (joined) {
    world.leave(joined.playerId);
    check('exit clears CPU room', () => assert.equal(world.snapshot(joined!.roomId), undefined));
  }
  const row = {key, fixture, rounds, passed: errors.length === 0, errors};
  evidence.push(row);
  writeFileSync(`${output}/${key}.json`, JSON.stringify(row, null, 2));
  failures.push(...errors.map(error => `${key}: ${error}`));
}
writeFileSync(`${output}/summary.json`, JSON.stringify({scope: 'Fresh World per source mode-map, ordinary CPU/host autopilot input and readiness, unchanged source participant limits/time, two natural rounds, frozen results, rematch and exit. Simulated 50ms clock; no position, HP, damage, result or time-limit injection.',
  passed: failures.length === 0, failures, evidence}, null, 2));
if (failures.length) {
  console.error(`FAIL: ${failures.length} checks across ${maps.length} mode-map fixtures\n${failures.join('\n')}`);
  process.exitCode = 1;
} else console.log(`PASS: ${maps.length} mode-map fixtures, ${maps.length * 2} natural rounds`);
