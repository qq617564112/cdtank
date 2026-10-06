import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {MAPS} from '../apps/server/src/config';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const rows: object[] = [];
for (const enabled of [false, true]) {
  let clock = 100000;
  const world = new World(() => clock);
  const owner = world.createAndJoin('owner', 1, 7, 'Friendly fire', 'Owner', 1, '', 3, 4, enabled);
  const friend = world.joinRoom(owner.roomId, 'friend', 'Friend', 1);
  world.changeTeam(friend.playerId, 1, 0);
  const enemy = world.joinRoom(owner.roomId, 'enemy', 'Enemy', 1);
  for (const joined of [owner, friend, enemy]) world.ready(joined.playerId, 1);
  const initial = world.snapshot(owner.roomId)!;
  assert.equal(initial.phase, 'PLAYING');
  assert.equal(initial.match!.friendlyFire, enabled);
  assert.equal(world.listRooms().find(room => room.id === owner.roomId)!.friendlyFire, enabled);
  const events: MsgRoomEvent[] = [];
  let sequence = 0;
  world.updateInput(owner.playerId, {sequence: ++sequence, move: 1, turn: 0, useItem: 0,
    aim: 0, fire: false, clientTime: clock});
  clock += 50; events.push(...world.step(50).events);
  const moved = world.snapshot(owner.roomId)!.players.find(player => player.id === owner.playerId)!;
  const start = initial.players.find(player => player.id === owner.playerId)!;
  assert(Math.hypot(moved.x - start.x, moved.z - start.z) > 0);
  for (let tick = 0; tick < 2000; tick++) {
    const snapshot = world.snapshot(owner.roomId)!;
    const attacker = snapshot.players.find(player => player.id === owner.playerId)!;
    const target = snapshot.players.find(player => player.id === friend.playerId)!;
    const angle = Math.atan2(target.x - attacker.x, target.z - attacker.z);
    const error = Math.atan2(Math.sin(angle - attacker.yaw - attacker.aim), Math.cos(angle - attacker.yaw - attacker.aim));
    // Aim is an ordinary angular velocity input, never a direct turret/pose write.
    world.updateInput(owner.playerId, {sequence: ++sequence, move: 0, turn: 0, useItem: 0,
      aim: Math.max(-1, Math.min(1, error / (.9 * .05))), fire: target.alive && !events.some(event => event.type === 'destroy') && Math.abs(error) < .02,
      clientTime: clock});
    clock += 50;
    events.push(...world.step(50).events);
    if (!enabled && events.some(event => event.type === 'friendlyFire')) break;
    if (enabled && events.some(event => event.type === 'respawn' && event.playerId === friend.playerId)) break;
  }
  const final = world.snapshot(owner.roomId)!;
  const attacker = final.players.find(player => player.id === owner.playerId)!;
  const target = final.players.find(player => player.id === friend.playerId)!;
  const friendly = events.filter(event => event.type === 'friendlyFire' && event.targetId === friend.playerId);
  assert(friendly.length > 0, 'Actual fire must collide with the selected teammate');
  assert(events.some(event => event.type === 'fire' && event.playerId === owner.playerId));
  assert.equal(attacker.kills, 0);
  assert.deepEqual(final.teamScores, [0, 0]);
  const map = MAPS.find(map => map.mode === 1 && map.mapId === 7)!;
  assert.equal(attacker.score, friendly.length * map.brokenScore);
  if (!enabled) {
    assert.equal(target.hp, target.maxHp); assert.equal(target.deaths, 0);
    assert(!events.some(event => event.type === 'hit')); assert.equal(friendly[0].value, 0);
  } else {
    assert(events.some(event => event.type === 'hit' && event.targetId === friend.playerId && event.value > 0));
    assert(events.some(event => event.type === 'destroy' && event.targetId === friend.playerId));
    assert(events.some(event => event.type === 'respawn' && event.playerId === friend.playerId));
    assert.equal(target.deaths, 1); assert.equal(target.alive, true); assert.equal(target.hp, target.maxHp);
    assert.equal(final.match!.teamLives[0], initial.match!.teamLives[0] - 1);
  }
  rows.push({enabled, friendlyHits: friendly.length, attacker, target, teamScores: final.teamScores,
    teamLivesBefore: initial.match!.teamLives, teamLivesAfter: final.match!.teamLives,
    events: events.filter(event => ['fire', 'hit', 'friendlyFire', 'destroy', 'respawn'].includes(event.type))});
}
const defaults = new World();
const owner = defaults.createAndJoin('owner', 1, 7, 'Default', 'Owner', 1);
assert.equal(defaults.snapshot(owner.roomId)!.match!.friendlyFire, false);
assert.deepEqual(defaults.createAndJoin('owner', 1, 7, 'Default', 'Owner', 1, '', undefined, undefined, false), owner);
assert.throws(() => defaults.createAndJoin('owner', 1, 7, 'Default', 'Owner', 1, '', undefined, undefined, true), /离开/);
const before = defaults.listRooms();
for (const mode of [4, 5]) assert.throws(() => defaults.createAndJoin('invalid', mode, MAPS.find(map => map.mode === mode)!.mapId, 'Bad', 'Bad', 1, '', undefined, undefined, true), /友军伤害/);
assert.throws(() => defaults.createAndJoin('invalid', 1, 7, 'Bad', 'Bad', 1, '', undefined, undefined, 1 as unknown as boolean), /布尔/);
assert.deepEqual(defaults.listRooms(), before);
writeFileSync('recovery/output/friendly-fire-world.json', JSON.stringify({status: 'PASS', rows,
  scope: 'Ordinary join/changeTeam/ready and snapshot-derived PlayerInput aim/fire; three human participants with an opponent. No injected position, HP, projectile or outcome.'}, null, 2));
console.log('PASS: actual teammate projectile collisions OFF/ON, natural friendly death/respawn, no positive score/kill/team score, config validation/default/idempotence');
