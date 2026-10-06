import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {quickMatchRoom} from '../apps/server/src/rooms/quick-match';
import {MAPS} from '../apps/server/src/config';
import type {RoomState} from '../apps/server/src/rooms/state';

let clock = 100000;
const world = new World(() => clock, {timeLimitSeconds: 1});
const mapBefore = JSON.stringify(MAPS);
const owner = world.createAndJoin('owner', 1, 7, '三人房', 'Owner', 1, '', 3, 3);
const guest = world.joinRoom(owner.roomId, 'guest', 'Guest', 1);
world.ready(owner.playerId, 1);
world.ready(guest.playerId, 1);
assert.equal(world.snapshot(owner.roomId)!.phase, 'WAITING');
const cpu = world.manageCpu(owner.playerId, 1, 'ADD');
assert.equal(world.snapshot(owner.roomId)!.players.length, 3);
assert.throws(() => world.manageCpu(owner.playerId, 1, 'ADD'), /房间已满/);
assert.throws(() => world.joinRoom(owner.roomId, 'fourth', 'Fourth', 1), /房间已满/);
assert.deepEqual(world.createAndJoin('owner', 1, 7, '三人房', 'Owner', 1, '', 3, 3), owner);
assert.throws(() => world.createAndJoin('owner', 1, 7, '三人房', 'Owner', 1, '', 2, 3), /离开/);
const summary = world.listRooms().find(room => room.id === owner.roomId)!;
assert.equal(summary.minPlayers, 3); assert.equal(summary.maxPlayers, 3);
assert.equal(world.snapshot(owner.roomId)!.match!.minPlayers, 3);
assert.equal(world.snapshot(owner.roomId)!.match!.maxPlayers, 3);
// The team capacity is ceil(3 / 2), including the CPU.
const snapshot = world.snapshot(owner.roomId)!;
const majority = snapshot.players.find(player => snapshot.players.filter(value => value.team === player.team).length === 2)!;
const minority = snapshot.players.find(player => player.team !== majority.team)!;
assert.throws(() => world.changeTeam(minority.id, 1, majority.team), /该队已满/);
world.ready(owner.playerId, 1); world.ready(guest.playerId, 1);
assert.equal(world.snapshot(owner.roomId)!.phase, 'PLAYING');
for (const round of [1, 2]) {
  assert.equal(world.snapshot(owner.roomId)!.match!.round, round);
  for (let tick = 0; tick < 21; tick++) {clock += 50; world.step(50);}
  const finished = world.snapshot(owner.roomId)!;
  assert.equal(finished.phase, 'FINISHED'); assert.equal(finished.match!.result!.reason, 'TIME_LIMIT');
  assert.equal(finished.match!.minPlayers, 3); assert.equal(finished.match!.maxPlayers, 3);
  assert(finished.players.some(player => player.id === cpu && player.isCpu));
  if (round === 1) {
    world.rematch(owner.playerId, round); world.rematch(guest.playerId, round);
    assert.equal(world.snapshot(owner.roomId)!.phase, 'PLAYING');
  }
}
assert.equal(JSON.stringify(MAPS), mapBefore, 'Room settings never mutate the map directory');
// Normalized defaults retry the same creation, regardless of omitted/explicit spelling.
const defaults = new World();
const defaultOwner = defaults.createAndJoin('default', 1, 7, 'Defaults', 'Owner', 1);
assert.deepEqual(defaults.createAndJoin('default', 1, 7, 'Defaults', 'Owner', 1, '', 2, 6), defaultOwner);
assert.equal(defaults.snapshot(defaultOwner.roomId)!.match!.minPlayers, 2);
assert.equal(defaults.snapshot(defaultOwner.roomId)!.match!.maxPlayers, 6);
const before = defaults.listRooms();
for (const [min, max] of [[1, 3], [4, 3], [3, 7], [2.5, 3], [2, 3.5], [NaN, 3], [2, Infinity]]) {
  assert.throws(() => defaults.createAndJoin('bad', 1, 7, 'Bad', 'Bad', 1, '', min, max), /房间人数/);
  assert.deepEqual(defaults.listRooms(), before, 'Invalid limits leave no room behind');
}
const override = new World(Date.now, {minPlayers: 2});
const overridden = override.createAndJoin('override', 1, 7, 'Override', 'Owner', 1, '', 3, 3);
const second = override.joinRoom(overridden.roomId, 'second', 'Second', 1);
override.ready(overridden.playerId, 1); override.ready(second.playerId, 1);
assert.equal(override.snapshot(overridden.roomId)!.phase, 'PLAYING');
assert.equal(override.snapshot(overridden.roomId)!.match!.minPlayers, 2);
// Quick match skips a configured-full WAITING room even below map capacity.
const quickWorld = new World();
const quickOwner = quickWorld.createAndJoin('quick-owner', 1, 7, 'Full waiting', 'Owner', 1, '', 3, 3);
quickWorld.joinRoom(quickOwner.roomId, 'quick-guest', 'Guest', 1);
quickWorld.manageCpu(quickOwner.playerId, 1, 'ADD');
assert.equal(quickWorld.snapshot(quickOwner.roomId)!.phase, 'WAITING');
const registry = (quickWorld as unknown as {rooms: Map<string, RoomState>}).rooms;
const fullRoom = registry.get(quickOwner.roomId)!;
const fallbackRoom = [...registry.values()].find(room => room.roomId !== quickOwner.roomId)!;
const chosen = quickMatchRoom(new Map([[quickOwner.roomId, fullRoom]]), () => fallbackRoom,
  room => ({playerId: 'chosen', roomId: room.roomId, mode: room.mode, mapId: room.map.mapId}));
assert.equal(chosen.roomId, fallbackRoom.roomId);
writeFileSync('recovery/output/room-player-limits.json', JSON.stringify({status: 'PASS', minPlayers: 3,
  maxPlayers: 3, readyTwoWaiting: true, humanCpuFullRejected: true, teamCapacity: 2,
  naturalTimeLimitRounds: 2, normalizedDefaultsRetry: true, invalidSettingsRejected: 7,
  mapDirectoryUnchanged: true, optionsOverridePreserved: true, quickMatchSkipsFull: true}, null, 2));
console.log('PASS: configured 3/3 readiness, human/CPU/team/quick-match capacity, two ordinary timed rounds, defaults, validation and idempotence');
