import {strict as assert} from 'node:assert';
import {World} from '../apps/server/src/world';
import {getMapConfig} from '../apps/server/src/config';
import {getSceneBreakables} from '../apps/server/src/scene-objects';
import {getBattlefield} from '../apps/server/src/battlefield';
import type {MsgPlayerInput, MsgRoomEvent, ObjectiveSnapshot, PlayerSnapshot} from '../apps/shared/protocols';

// Explicit rule fixtures place actors on recovered map slots. They test server
// outcomes, not natural browser navigation or original mode fidelity.
interface FixturePlayer extends PlayerSnapshot {
  inputSequence: number;
  input: MsgPlayerInput;
}
interface FixtureRoom {
  players: Map<string, FixturePlayer>;
  teamLives: number[];
  objectives: ObjectiveSnapshot[];
}
let time = 1000000;
const input = (sequence: number, fire = false): MsgPlayerInput => ({
  sequence, move: 0, turn: 0, aim: 0, fire, useItem: 0, clientTime: 0,
});

function setup(mode: number, timeLimitSeconds = 300) {
  const world = new World(() => time, {timeLimitSeconds, minPlayers: 2});
  const summary = world.listRooms().find(room => room.mode === mode)!;
  const a = world.joinRoom(summary.id, 'a', 'A', 1);
  const b = world.joinRoom(summary.id, 'b', 'B', 1);
  const snapshot = () => world.snapshot(summary.id)!;
  const tick = (milliseconds = 50) => {time += milliseconds; return world.step(milliseconds);};
  assert.equal(snapshot().phase, 'WAITING');
  world.ready(a.playerId, 1);
  assert.equal(snapshot().phase, 'WAITING', 'One ready participant cannot start a match');
  world.ready(b.playerId, 1);
  assert.equal(snapshot().phase, 'PLAYING');
  assert.throws(() => world.joinRoom(summary.id, 'late', 'Late', 1), /正在对战/);
  assert(world.listRooms().some(room => room.mode === mode && room.phase === 'WAITING'));
  const room = (world as unknown as {rooms: Map<string, FixtureRoom>}).rooms.get(summary.id)!;
  return {world, summary, a, b, snapshot, tick, room};
}

function fireAtEnemy(fixture: ReturnType<typeof setup>): void {
  const {world, a, b, room, snapshot, tick} = fixture;
  const attacker = room.players.get(a.playerId)!;
  const target = room.players.get(b.playerId)!;
  const bearing = Math.atan2(target.x - attacker.x, target.z - attacker.z);
  attacker.yaw = bearing;
  attacker.aim = 0;
  world.updateInput(a.playerId, input(1, true));
  for (let index = 0; index < 300 && snapshot().phase === 'PLAYING' && target.alive; index++) tick();
  assert.equal(target.alive, false, 'Real swept bullets should destroy the source-slot opponent');
}

for (const mode of [1, 3]) {
  const fixture = setup(mode);
  const tankLimit = getMapConfig(mode, fixture.summary.mapId).tankLimit;
  const openingLives = tankLimit > 0 ? tankLimit : 30;
  assert.deepEqual(fixture.room.teamLives, mode === 1 ? [openingLives, openingLives] : []);
  if (mode === 1) fixture.room.teamLives[1] = 1;
  if (mode === 3) assert(fixture.snapshot().players.every(player => player.isVIP && player.maxHp === 200));
  fireAtEnemy(fixture);
  const finished = fixture.snapshot();
  assert.equal(finished.phase, 'FINISHED');
  assert.equal(finished.match!.result!.reason, 'OBJECTIVE');
  assert.equal(finished.winnerTeam, 0);
  assert.equal(finished.bullets.length, 0);
  assert([...fixture.room.players.values()].every(player => player.input.fire === false
    && player.input.move === 0 && player.input.turn === 0 && player.input.useItem === 0),
    'Decisive hit synchronously freezes every participant input');
  assert.equal(finished.match!.result!.players.find(player => player.id === fixture.a.playerId)!.outcome, 'WIN');
  const frozen = JSON.stringify(finished.match!.result);
  const hp = finished.players.map(player => player.hp);
  fixture.world.updateInput(fixture.a.playerId, input(2, true));
  fixture.tick(10000);
  assert.deepEqual(fixture.snapshot().players.map(player => player.hp), hp);
  assert.equal(JSON.stringify(fixture.snapshot().match!.result), frozen);
  assert.equal(fixture.snapshot().match!.result!.endedAt, finished.match!.result!.endedAt,
    'Repeated ticks preserve the committed ending timestamp');
  fixture.world.rematch(fixture.a.playerId, 1);
  assert.equal(fixture.snapshot().phase, 'FINISHED');
  fixture.world.rematch(fixture.a.playerId, 1);
  assert.equal(fixture.snapshot().match!.rematchPlayerIds.length, 1, 'Votes are idempotent');
  fixture.world.rematch(fixture.b.playerId, 1);
  assert.equal(fixture.snapshot().phase, 'PLAYING');
  assert.equal(fixture.snapshot().match!.round, 2);
  assert.equal(fixture.snapshot().match!.result, undefined);
  assert.deepEqual(fixture.room.teamLives, mode === 1 ? [openingLives, openingLives] : [],
    'Rematch restores map-derived team lives independently of previous-round losses');
  assert(fixture.snapshot().players.every(player => player.alive && player.hp === player.maxHp
    && player.score === 0 && player.kills === 0 && player.deaths === 0));
  assert.throws(() => fixture.world.rematch(fixture.a.playerId, 1));
  fixture.world.updateInput(fixture.a.playerId, input(1, true));
  fixture.tick();
  assert.equal(fixture.snapshot().bullets.length, 0, 'Old input cannot fire in the new round');
}

{
  const fixture = setup(2);
  const zone = fixture.room.objectives[0];
  const a = fixture.room.players.get(fixture.a.playerId)!;
  const b = fixture.room.players.get(fixture.b.playerId)!;
  const distanceA = Math.hypot(a.x - zone.x, a.z - zone.z);
  const distanceB = Math.hypot(b.x - zone.x, b.z - zone.z);
  assert(Math.abs(distanceA - distanceB) < 0.00001, 'Source map 0002 capture point must be equidistant from both initial representatives');
  assert(distanceA > zone.radius && distanceB > zone.radius, 'Neither representative may spawn in the capture circle');
  Object.assign(a, {x: zone.x, y: zone.y, z: zone.z});
  Object.assign(b, {x: zone.x, y: zone.y, z: zone.z});
  fixture.tick(1000);
  assert.equal(fixture.snapshot().match!.objectives[0].contested, true);
  assert.deepEqual(fixture.snapshot().teamScores, [0, 0]);
  b.x += 200;
  for (let index = 0; index < 30; index++) fixture.tick(1000);
  assert.equal(fixture.snapshot().phase, 'FINISHED');
  assert.equal(fixture.snapshot().winnerTeam, 0);
  assert.equal(fixture.snapshot().match!.result!.reason, 'OBJECTIVE');
}

{
  const fixture = setup(4, 1);
  const a = fixture.room.players.get(fixture.a.playerId)!;
  const b = fixture.room.players.get(fixture.b.playerId)!;
  a.score = 100;
  b.kills = 1;
  fixture.tick(1000);
  const result = fixture.snapshot().match!.result!;
  assert.equal(result.winnerTeam, -1);
  assert.equal(result.winnerPlayerId, b.id, 'FFA outcome must identify a player, not team 0');
  assert.equal(result.players[0].id, b.id);
  assert.equal(result.players[0].totalScore, result.players[0].combatScore + result.players[0].outcomeBonus);
  assert.equal(result.players.find(player => player.id === a.id)!.outcome, 'LOSE');
}

{
  const fixture = setup(5);
  const attacker = fixture.room.players.get(fixture.a.playerId)!;
  const other = fixture.room.players.get(fixture.b.playerId)!;
  const field = getBattlefield(fixture.summary.mapId);
  other.x += 1000;
  const original = getSceneBreakables(fixture.summary.mapId);
  assert.equal(fixture.room.objectives.length, original.length);
  assert.equal(original.length, 117);
  for (const source of original) {
    const objective = fixture.room.objectives.find(value => value.sourcePlacementId === source.id)!;
    assert.equal(objective.sourceModel, source.model);
    assert.deepEqual([objective.x, objective.y, objective.z], source.matrix.slice(12, 15));
  }
  // Fixture starts on a clear firing segment to one real source OBB. It does
  // not establish natural navigation or universal reachability of all objects.
  const target = fixture.room.objectives.find(value => {
    const start = {x: value.x - value.radius - 80, y: value.y, z: value.z};
    return !field.firstSurfaceHit(start, value, 1);
  });
  assert(target, 'Need an original object with a clear firing segment');
  Object.assign(attacker, {x: target.x - target.radius - 80, y: target.y - 20,
    z: target.z, yaw: Math.PI / 2, aim: 0});
  fixture.world.updateInput(attacker.id, input(1, true));
  let appliedDamage = 0;
  for (let tick = 0; tick < 200 && target.hp > 0; tick++) {
    const previousHp: number = target.hp;
    const previousScore = attacker.score;
    const events = fixture.tick().events;
    const hits = events.filter(event => event.type === 'objectiveHit' && event.playerId === attacker.id);
    const destroyed = events.filter(event => event.type === 'objectiveDestroyed' && event.playerId === attacker.id);
    const map = getMapConfig(5, fixture.summary.mapId);
    assert.equal(attacker.score, previousScore + hits.length * map.hitScore + destroyed.length * map.destroyScore,
      'Objective hit and destruction award exactly the source map scores');
    const hit: MsgRoomEvent | undefined = hits.find(event => event.targetId === target.id);
    if (hit) {
      assert.equal(hit.value, previousHp - target.hp);
      assert(hit.value > 0 && hit.value <= previousHp, 'Final damage clips to remaining objective HP');
      assert.deepEqual([hit.x, hit.y, hit.z], [target.x, target.y, target.z]);
      appliedDamage += hit.value;
    }
    const finish: MsgRoomEvent | undefined = destroyed.find(event => event.targetId === target.id);
    if (finish) {
      assert.equal(finish.value, 1);
      assert.deepEqual([finish.x, finish.y, finish.z], [target.x, target.y, target.z]);
      assert.equal(target.destroyedAt, time);
    }
  }
  assert.equal(appliedDamage, target.maxHp);
  assert.equal(target.hp, 0, 'Actual swept projectile must destroy a real source OBB');
  assert(target.destroyedAt);
  fixture.world.updateInput(attacker.id, input(2, false));
  assert.equal(fixture.snapshot().phase, 'PLAYING', 'Other original objects still remain');
  // Explicit end-condition fixture; remaining objects are not natural kills.
  for (const objective of fixture.room.objectives) objective.hp = 0;
  fixture.tick();
  const result = fixture.snapshot().match!.result!;
  assert.equal(result.reason, 'OBJECTIVE');
  assert.equal(result.winnerPlayerId, attacker.id);
  assert.equal(result.players[0].objectivesDestroyed, 1);
  assert.equal(result.players[0].kills, 0);
  fixture.world.rematch(attacker.id, 1);
  fixture.world.rematch(other.id, 1);
  assert(fixture.snapshot().match!.objectives.every(value => value.hp === value.maxHp
    && value.destroyedAt === undefined));
}

for (const mode of [1, 2, 3, 4, 5]) {
  const fixture = setup(mode, 1);
  fixture.world.updateInput(fixture.a.playerId, input(1, true));
  const result = fixture.tick(1000);
  assert.equal(result.events.filter(event => event.type === 'finish').length, 1);
  assert.equal(result.events.filter(event => event.type === 'fire').length, 0, 'Deadline is final');
  assert.equal(fixture.snapshot().match!.result!.reason, 'TIME_LIMIT');
  assert.equal(fixture.snapshot().match!.result!.players.every(player => player.outcome === 'DRAW'), true);
  assert([...fixture.room.players.values()].every(player => !player.input.fire
    && player.input.move === 0 && player.input.useItem === 0), 'Deadline freezes pending input');
  fixture.tick();
  assert.equal(fixture.tick().events.filter(event => event.type === 'finish').length, 0);
}

{
  const fixture = setup(1);
  fixture.world.leave(fixture.b.playerId);
  const result = fixture.snapshot().match!.result!;
  assert.equal(result.reason, 'FORFEIT');
  assert.equal(result.players.length, 2);
  assert.equal(result.winnerTeam, 0);
  fixture.world.rematch(fixture.a.playerId, 1);
  assert.equal(fixture.snapshot().phase, 'FINISHED', 'Solo vote cannot restart');
  const c = fixture.world.joinRoom(fixture.summary.id, 'c', 'C', 1);
  fixture.world.rematch(c.playerId, 1);
  assert.equal(fixture.snapshot().phase, 'PLAYING');
  assert.deepEqual(fixture.snapshot().players.map(player => player.team), [0, 1]);
  fixture.world.updateInput(fixture.a.playerId, input(NaN, true));
  fixture.world.updateInput(fixture.a.playerId, input(5, true));
  fixture.world.updateInput(fixture.a.playerId, input(4, false));
  assert.equal(fixture.room.players.get(fixture.a.playerId)!.inputSequence, 5);
}

{
  const world = new World(() => time, {minPlayers: 2});
  const roomId = world.listRooms().find(room => room.mode === 3)!.id;
  const players = ['vip-a', 'vip-b', 'member-a', 'member-b'].map(name =>
    world.joinRoom(roomId, name, name, 1));
  players.forEach(player => world.ready(player.playerId, 1));
  const initial = world.snapshot(roomId)!;
  assert.deepEqual(initial.players.map(player => player.isVIP), [true, true, false, false]);
  assert.equal(world.leave(players[3].playerId).filter(event => event.type === 'finish').length, 0);
  assert.equal(world.snapshot(roomId)!.phase, 'PLAYING', 'Non-VIP departure with teammates continues');
  const events = world.leave(players[0].playerId);
  assert.deepEqual(events.map(event => event.type), ['leave', 'finish']);
  const result = world.snapshot(roomId)!.match!.result!;
  assert.equal(result.reason, 'FORFEIT');
  assert.equal(result.winnerTeam, 1, 'VIP departure forfeits even with a remaining teammate');
  assert.deepEqual(new Set(result.players.map(player => player.id)),
    new Set(players.slice(0, 3).map(player => player.playerId)),
    'Settle the current roster including departing VIP before removal');
  const frozen = JSON.stringify(result);
  assert.deepEqual(world.leave(players[0].playerId), [], 'Duplicate departure cannot settle again');
  assert.equal(JSON.stringify(world.snapshot(roomId)!.match!.result), frozen);
}

for (const mode of [4, 5]) {
  const fixture = setup(mode);
  const events = fixture.world.leave(fixture.a.playerId);
  const result = fixture.snapshot().match!.result!;
  assert.deepEqual(events.map(event => event.type), ['leave', 'finish']);
  assert.equal(result.reason, 'FORFEIT');
  assert.equal(result.winnerTeam, -1);
  assert.equal(result.winnerPlayerId, fixture.b.playerId, 'Solo survivor wins as an individual');
  assert.equal(result.players.length, 2, 'Departure retains both participants in frozen result');
}
console.log('PASS: five rebuilt mode outcomes, ready gating, deadline freeze, immutable settlement, FFA identity, real target impacts, forfeit and consensus rematch');
