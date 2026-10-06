import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {getBattlefield} from '../apps/server/src/battlefield';

const expected = [1, 2, 3, 4, 5].flatMap(mode => {
  const table = JSON.parse(readFileSync(`recovery/output/verified/tables/m00${mode}.json`, 'utf8')) as {
    rows: {values: Record<string, string>}[];
  };
  return table.rows.map(({values}) => ({mode, mapId: Number(values.MapID), name: values.MapName,
    timeLimit: Number(values.Time), sourceMinPlayers: Number(values.PlayerMin), maxPlayers: Number(values.PlayerMax)}));
});
const world = new World();
assert.equal(expected.length, 26);
assert.deepEqual(world.listMaps(), expected, 'Directory must expose exact original mode/map rows');
const baseline = world.listRooms().length;
for (const map of expected) {
  const a = world.createAndJoin('creator', map.mode, map.mapId, '源地图', 'A', 1);
  assert.equal(a.mapId, map.mapId, 'Never fall back to another map');
  assert.equal(a.mode, map.mode);
  const room = world.listRooms().find(room => room.id === a.roomId)!;
  assert.equal(room.maxPlayers, map.maxPlayers);
  assert.equal(room.phase, 'WAITING');
  assert.equal(room.playerCount, 1, 'Creation joins its connection atomically');
  const repeated = world.createAndJoin('creator', map.mode, map.mapId, '源地图', 'A', 1);
  assert.deepEqual(repeated, a, 'Retry must reuse room and player');
  assert.throws(() => world.createAndJoin('creator', 1, 2, '另一房间', 'A', 1), /离开/);
  const participants = [a];
  for (let index = 1; index < map.sourceMinPlayers; index++) {
    participants.push(world.joinRoom(a.roomId, `guest${index}`, `B${index}`, 1));
  }
  for (const player of participants) world.ready(player.playerId, 1);
  const snapshot = world.snapshot(a.roomId)!;
  assert.equal(snapshot.phase, 'PLAYING');
  assert.equal(snapshot.remaining, map.timeLimit);
  if (map.mode === 5) {
    const scenes = JSON.parse(readFileSync('recovery/output/web-assets/scene-placements.json', 'utf8')) as
      Array<{id: string; records: Array<{id: string; model: string; className: string; matrix: number[]}>}>;
    const records = scenes.find(scene => Number(scene.id) === map.mapId)!.records
      .filter(record => record.className === 'SYcScnObjBreach');
    assert.equal(records.length, ({20: 117, 21: 73, 22: 46} as Record<number, number>)[map.mapId]);
    assert.deepEqual(snapshot.match!.objectives.map(objective => ({id: objective.sourcePlacementId,
      model: objective.sourceModel, position: [objective.x, objective.y, objective.z]})),
    records.map(record => ({id: record.id, model: record.model, position: record.matrix.slice(12, 15)})));
  }
  const field = getBattlefield(map.mapId);
  for (const player of snapshot.players) {
    assert(field.spawns.some(spawn => Math.hypot(player.x - spawn.x, player.z - spawn.z) < 0.02),
      `Map ${map.mapId} needs usable recovered spawn points`);
  }
  for (const player of participants) world.leave(player.playerId);
  assert.equal(world.snapshot(a.roomId), undefined, 'Empty custom room is reclaimed');
}
assert.equal(world.listRooms().length, baseline, 'Only default rooms remain after all custom players leave');
{
  const a = world.createAndJoin('gate-a', 1, 4, '准备门槛', 'A', 1);
  const b = world.joinRoom(a.roomId, 'gate-b', 'B', 1);
  world.ready(a.playerId, 1);
  world.ready(b.playerId, 1);
  assert.equal(world.snapshot(a.roomId)!.phase, 'WAITING', 'Two ready players cannot bypass source PlayerMin 4');
  world.ready(a.playerId, 1, false);
  assert.deepEqual(world.snapshot(a.roomId)!.match!.readyPlayerIds, [b.playerId]);
  const c = world.joinRoom(a.roomId, 'gate-c', 'C', 1);
  const d = world.joinRoom(a.roomId, 'gate-d', 'D', 1);
  world.ready(c.playerId, 1);
  world.ready(d.playerId, 1);
  assert.equal(world.snapshot(a.roomId)!.phase, 'WAITING', 'Canceled readiness must block the start');
  world.ready(a.playerId, 1);
  assert.equal(world.snapshot(a.roomId)!.phase, 'PLAYING');
  assert.throws(() => world.ready(a.playerId, 1, false), /开局后/);
  world.leave(a.playerId);
  assert.equal(world.snapshot(a.roomId)!.phase, 'PLAYING', 'Existing viable teams may continue below start minimum');
  world.leave(c.playerId);
  assert.equal(world.snapshot(a.roomId)!.phase, 'FINISHED');
  world.rematch(b.playerId, 1);
  world.rematch(d.playerId, 1);
  assert.equal(world.snapshot(a.roomId)!.phase, 'FINISHED', 'Rematch must require the source minimum too');
  world.leave(b.playerId);
  world.leave(d.playerId);
}
for (const [mode, mapId] of [[0, 2], [6, 2], [1, 7.5], [1, 999], [5, 2]]) {
  assert.throws(() => world.createAndJoin('bad', mode, mapId, '无效', 'A', 1), /没有这张地图/);
}
assert.throws(() => world.createAndJoin('bad', 1, 2, '无效', 'A', 999), /战车不存在/);
assert.equal(world.listRooms().length, baseline, 'Invalid requests must not leave empty rooms');
const sanitized = world.createAndJoin('valid', 1, 4, '<房名>&\u0001', '<玩家>', 1);
assert(world.roomName(sanitized.roomId).startsWith('房名 ·'));
assert.equal(world.roomPlayers(sanitized.roomId)[0].name, '玩家');
{
  const protectedWorld = new World();
  const password = '中文 Secret 42!';
  const a = protectedWorld.createAndJoin('owner', 1, 4, '密码房', 'Owner', 1, password);
  assert.equal(protectedWorld.listRooms().find(room => room.id === a.roomId)!.hasPassword, true);
  assert.deepEqual(protectedWorld.createAndJoin('owner', 1, 4, '密码房', 'Owner', 1, password), a);
  assert.throws(() => protectedWorld.createAndJoin('owner', 1, 4, '密码房', 'Owner', 1, 'other'), /离开/);
  const publicRoom = protectedWorld.listRooms().find(room => !room.hasPassword)!;
  const guest = protectedWorld.joinRoom(publicRoom.id, 'guest', 'Guest', 1);
  assert.throws(() => protectedWorld.joinRoom(a.roomId, 'guest', 'Guest', 1), /密码错误/);
  assert.throws(() => protectedWorld.joinRoom(a.roomId, 'guest', 'Guest', 1, 'wrong'), /密码错误/);
  assert(protectedWorld.snapshot(publicRoom.id)!.players.some(player => player.id === guest.playerId),
    'Wrong password must preserve prior room membership');
  assert.equal(protectedWorld.snapshot(a.roomId)!.players.length, 1);
  const b = protectedWorld.joinRoom(a.roomId, 'guest', 'Guest', 1, password);
  assert.equal(protectedWorld.joinRoom(a.roomId, 'guest', 'Guest', 1).playerId, b.playerId,
    'Authenticated connection retry reuses identity');
  assert(!JSON.stringify([protectedWorld.listRooms(), protectedWorld.snapshot(a.roomId), protectedWorld.roomPlayers(a.roomId)]).includes(password));
  assert.throws(() => protectedWorld.createAndJoin('bad', 1, 4, 'bad', 'Bad', 1, 'x'.repeat(21)), /最多20/);
  protectedWorld.leave(a.playerId);
  protectedWorld.leave(b.playerId);
  assert.equal(protectedWorld.snapshot(a.roomId), undefined);
}
{
  const room = new World(Date.now, {minPlayers: 2});
  const summary = room.listRooms().find(value => value.mode === 1)!;
  const a = room.joinRoom(summary.id, 'team-a', 'A', 1);
  const b = room.joinRoom(summary.id, 'team-b', 'B', 1);
  room.ready(a.playerId, 1);
  assert.equal(room.changeTeam(b.playerId, 1, 0), 0);
  assert.equal(room.snapshot(summary.id)!.match!.readyPlayerIds.length, 0, 'Team composition invalidates everyone’s consent');
  room.ready(a.playerId, 1);
  room.ready(b.playerId, 1);
  assert.equal(room.snapshot(summary.id)!.phase, 'WAITING', 'One-sided team rooms must never start');
  assert.equal(room.changeTeam(b.playerId, 1, 0), 0);
  assert.equal(room.snapshot(summary.id)!.match!.readyPlayerIds.length, 2, 'Same-team retry is idempotent');
  assert.throws(() => room.changeTeam(b.playerId, 2, 1), /当前等待/);
  assert.throws(() => room.changeTeam(b.playerId, 1, 2), /不存在/);
  room.changeTeam(b.playerId, 1, 1);
  assert.equal(room.snapshot(summary.id)!.match!.readyPlayerIds.length, 0);
  room.ready(a.playerId, 1);
  room.ready(b.playerId, 1);
  assert.equal(room.snapshot(summary.id)!.phase, 'PLAYING');
  assert.throws(() => room.changeTeam(b.playerId, 1, 0), /当前等待/);
  const melee = room.listRooms().find(value => value.mode === 4)!;
  const solo = room.joinRoom(melee.id, 'solo', 'Solo', 1);
  assert.throws(() => room.changeTeam(solo.playerId, 1, 1), /个人战/);
  const waiting = room.listRooms().find(value => value.mode === 1 && value.phase === 'WAITING')!;
  const players = Array.from({length: 6}, (_, index) => room.joinRoom(waiting.id, `capacity${index}`, `C${index}`, 1));
  room.changeTeam(players[1].playerId, 1, 0);
  room.changeTeam(players[3].playerId, 1, 0);
  assert.throws(() => room.changeTeam(players[5].playerId, 1, 0), /已满/);
}
{
  const capacityWorld = new World();
  const target = capacityWorld.listRooms().find(room => room.mode === 1)!;
  const participants = Array.from({length: target.maxPlayers}, (_, index) =>
    capacityWorld.joinRoom(target.id, `full-${index}`, `P${index}`, 1));
  const prior = capacityWorld.listRooms().find(room => room.mode === 2)!;
  const outsider = capacityWorld.joinRoom(prior.id, 'outsider', 'Outsider', 1);
  assert.throws(() => capacityWorld.joinRoom(target.id, 'outsider', 'Outsider', 1), /房间已满/);
  assert(capacityWorld.snapshot(prior.id)!.players.some(player => player.id === outsider.playerId),
    'Capacity rejection preserves previous room membership');
  assert.equal(capacityWorld.snapshot(target.id)!.players.length, target.maxPlayers);
  assert.deepEqual(capacityWorld.joinRoom(target.id, 'full-0', 'Changed name', 1), participants[0],
    'Existing connection retry succeeds even at full capacity');
}
{
  const rollbackWorld = new World();
  const before = rollbackWorld.listRooms();
  const join = rollbackWorld.joinRoom.bind(rollbackWorld);
  rollbackWorld.joinRoom = () => {throw new Error('insertion failed');};
  assert.throws(() => rollbackWorld.createAndJoin('rollback', 1, 4, 'Rollback', 'A', 1), /insertion failed/);
  assert.deepEqual(rollbackWorld.listRooms(), before, 'Failed join removes the newly allocated room');
  rollbackWorld.joinRoom = join;
  const joined = rollbackWorld.createAndJoin('rollback', 1, 4, 'Rollback', 'A', 1);
  assert.equal(rollbackWorld.snapshot(joined.roomId)!.players.length, 1);
}
{
  const migrationWorld = new World(Date.now, {minPlayers: 2});
  const owner = migrationWorld.createAndJoin('moving-owner', 1, 4, 'Old room', 'Owner', 1);
  const opponent = migrationWorld.joinRoom(owner.roomId, 'staying-opponent', 'Opponent', 1);
  migrationWorld.ready(owner.playerId, 1);
  migrationWorld.ready(opponent.playerId, 1);
  const destination = migrationWorld.listRooms().find(room => room.mode === 2)!;
  const moved = migrationWorld.joinRoom(destination.id, 'moving-owner', 'Owner', 1);
  assert.notEqual(moved.playerId, owner.playerId, 'Moving rooms allocates a new participant identity');
  const old = migrationWorld.snapshot(owner.roomId)!;
  assert.equal(old.phase, 'FINISHED');
  assert.equal(old.match!.result!.reason, 'FORFEIT');
  assert.deepEqual(new Set(old.match!.result!.players.map(player => player.id)),
    new Set([owner.playerId, opponent.playerId]), 'Migration settles the old roster before insertion');
  assert.deepEqual(old.players.map(player => player.id), [opponent.playerId]);
  const newcomer = migrationWorld.snapshot(destination.id)!.players.find(player => player.id === moved.playerId)!;
  const spawn = getBattlefield(destination.mapId).spawn(0);
  assert(Math.hypot(newcomer.x - spawn.x, newcomer.y - spawn.y, newcomer.z - spawn.z) < 0.01,
    'Wire-rounded spawn remains within the existing hundredth-unit projection precision');
  assert.equal(newcomer.team, 0);
}
{
  const cpuWorld = new World();
  const owner = cpuWorld.createAndJoin('cpu-manager', 1, 4, 'CPU管理', 'Owner', 1);
  const first = cpuWorld.manageCpu(owner.playerId, 1, 'ADD');
  cpuWorld.ready(owner.playerId, 1);
  assert(cpuWorld.snapshot(owner.roomId)!.match!.readyPlayerIds.includes(owner.playerId));
  const second = cpuWorld.manageCpu(owner.playerId, 1, 'ADD');
  assert.deepEqual(new Set(cpuWorld.snapshot(owner.roomId)!.match!.readyPlayerIds), new Set([first, second]),
    'Adding CPU invalidates human consent and prepares all CPUs');
  cpuWorld.ready(owner.playerId, 1);
  assert.equal(cpuWorld.manageCpu(owner.playerId, 1, 'REMOVE', 1, first), first);
  assert.deepEqual(cpuWorld.snapshot(owner.roomId)!.match!.readyPlayerIds, [second],
    'Removing CPU invalidates human consent and preserves remaining CPU readiness');
  const before = cpuWorld.snapshot(owner.roomId)!;
  assert.throws(() => cpuWorld.manageCpu(owner.playerId, 1, 'REMOVE', 1, owner.playerId), /CPU不存在/);
  assert.throws(() => cpuWorld.manageCpu(owner.playerId, 2, 'ADD'), /当前等待/);
  assert.throws(() => cpuWorld.manageCpu(second, 1, 'ADD'), /只有房主/);
  assert.deepEqual(cpuWorld.snapshot(owner.roomId)!.players, before.players,
    'Rejected CPU commands do not change the roster');
}
{
  let clock = 100000;
  const departureWorld = new World(() => clock, {minPlayers: 2, timeLimitSeconds: 1});
  const a = departureWorld.createAndJoin('depart-a', 4, 7, '离房验证', 'A', 1);
  const b = departureWorld.joinRoom(a.roomId, 'depart-b', 'B', 1);
  const c = departureWorld.joinRoom(a.roomId, 'depart-c', 'C', 1);
  departureWorld.ready(a.playerId, 1);
  departureWorld.ready(b.playerId, 1);
  assert.equal(departureWorld.snapshot(a.roomId)!.phase, 'WAITING');
  departureWorld.leave(c.playerId);
  assert.equal(departureWorld.snapshot(a.roomId)!.phase, 'PLAYING',
    'Unready departure permits the remaining consenting roster to start');
  assert(departureWorld.listRooms().some(room => room.mode === 4 && room.phase === 'WAITING'));
  clock += 1000;
  departureWorld.step(1000);
  const newcomer = departureWorld.joinRoom(a.roomId, 'depart-c', 'C', 1);
  departureWorld.rematch(a.playerId, 1);
  departureWorld.rematch(b.playerId, 1);
  assert.equal(departureWorld.snapshot(a.roomId)!.phase, 'FINISHED');
  departureWorld.leave(newcomer.playerId);
  assert.equal(departureWorld.snapshot(a.roomId)!.match!.round, 2,
    'Non-voter departure permits remaining unanimous participants to rematch');
  assert.equal(departureWorld.snapshot(a.roomId)!.phase, 'PLAYING');
  assert.deepEqual(new Set(departureWorld.snapshot(a.roomId)!.match!.readyPlayerIds),
    new Set([a.playerId, b.playerId]));
  departureWorld.leave(a.playerId);
  departureWorld.leave(b.playerId);
  assert.equal(departureWorld.snapshot(a.roomId), undefined);
  const remaining = departureWorld.listRooms();
  assert.deepEqual(departureWorld.leave(b.playerId), []);
  assert.deepEqual(departureWorld.listRooms(), remaining, 'Duplicate exit does not replenish extra rooms');
  assert([1, 2, 3, 4, 5].every(mode => remaining.some(room => room.mode === mode)));
}
console.log('PASS: 26 maps, admission/migration/CPU authority, departure-triggered start/rematch, roster cleanup and default-room preservation');
