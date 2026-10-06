import assert from 'node:assert/strict';
import {World} from '../apps/server/src/world';
import type {RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {MsgPlayerInput, PlayerSnapshot} from '../apps/shared/protocols';

interface Actor extends PlayerSnapshot {
  combat: RoleCombatState;
  respawnAt: number;
  inputSequence: number;
}
interface Room {startedAt: number; players: Map<string, Actor>;}
const input = (sequence: number, fire: boolean): MsgPlayerInput => ({
  sequence, move: 0, turn: 0, aim: 0, fire, useItem: 0, clientTime: 0,
});

function fixture(epoch: number) {
  let now = epoch;
  const world = new World(() => now, {minPlayers: 2, timeLimitSeconds: 60});
  const summary = world.listRooms().find(room => room.mode === 1)!;
  const a = world.joinRoom(summary.id, 'A', 'A', 1);
  const b = world.joinRoom(summary.id, 'B', 'B', 1);
  const room = (world as unknown as {rooms: Map<string, Room>}).rooms.get(summary.id)!;
  assert.equal(room.players.get(a.playerId)!.combat.getFlag(11), 0);
  world.ready(a.playerId, 1); world.ready(b.playerId, 1);
  assert([...room.players.values()].every(player => player.combat.record!.status === 2
    && player.combat.getFlag(11) === 1 && player.combat.nextAvailableSeconds === 0));
  return {world, room, a, b, snapshot: () => world.snapshot(summary.id)!,
    at: (seconds: number) => {now = epoch + seconds * 1000; return world.step(50);},
    step: () => {now += 50; return world.step(50);}};
}

{
  const f = fixture(1000000);
  const state = f.room.players.get(f.a.playerId)!.combat;
  state.trapPermission = 0;
  state.setFlag(8, true);
  for (let tick = 0; tick < 9; tick++) f.step();
  assert.equal(state.getFlag(8), 1);
  assert.equal(state.trapPermission, 0);
  for (let tick = 9; tick < 59; tick++) f.step();
  assert.equal(state.getFlag(8), 0, 'The authoritative seconds scheduler must expire the original flag8 timer');
  assert.equal(state.trapPermission, 0, 'Trap permission must remain unavailable before3 seconds');
  for (let tick = 59; tick < 62; tick++) f.step();
  assert.equal(state.trapPermission, 1, 'The authoritative scheduler must restore trap permission after the f32 countdown crosses zero');
  assert.equal(state.trapCountdown, 3);
}

// Explicit state fixtures check authoritative permit/deadline behavior. Natural
// CPU matches separately cover ordinary inputs without modifying role fields.
{
  const f = fixture(1000000);
  const actor = f.room.players.get(f.a.playerId)!;
  actor.combat.setFlag(11, false);
  f.world.updateInput(actor.id, input(1, true));
  assert(actor.alive);
  assert(!f.at(.25).events.some(event => event.type === 'fire' && event.playerId === actor.id),
    'A live player with the original fire permit cleared cannot fire');
  actor.combat.setFlag(11, true);
  assert(f.at(.3).events.some(event => event.type === 'fire' && event.playerId === actor.id));
  const deadline = actor.combat.nextAvailableSeconds;
  assert.equal(deadline, Math.fround(.3 + Math.fround(.8)));
  assert(!f.at(deadline - .001).events.some(event => event.type === 'fire' && event.playerId === actor.id));
  assert(f.at(deadline).events.some(event => event.type === 'fire' && event.playerId === actor.id),
    'The original inclusive f32 deadline allows firing at equality');
  actor.combat.setStatus(2);
  assert.equal(actor.combat.nextAvailableSeconds, 0);
  assert.equal(actor.combat.getFlag(11), 1);
}

for (const epoch of [1000000, Date.UTC(2026, 9, 1)]) {
  const f = fixture(epoch);
  const actor = f.room.players.get(f.a.playerId)!;
  f.world.updateInput(actor.id, input(1, true));
  const firing: number[] = [];
  for (let tick = 1; tick <= 40; tick++) {
    if (f.at(tick / 20).events.some(event => event.type === 'fire' && event.playerId === actor.id)) firing.push(tick);
  }
  assert.deepEqual(firing, [1, 17, 33], 'Deadline must use round-relative seconds, independent of Unix epoch precision');
}

{
  const f = fixture(1000000);
  const attacker = f.room.players.get(f.a.playerId)!;
  const target = f.room.players.get(f.b.playerId)!;
  attacker.yaw = Math.atan2(target.x - attacker.x, target.z - attacker.z);
  f.world.updateInput(attacker.id, input(1, true));
  let destroyed = false;
  for (let tick = 0; tick < 400 && target.alive; tick++) {
    destroyed ||= f.step().events.some(event => event.type === 'destroy' && event.targetId === target.id);
  }
  assert(destroyed, 'Ordinary swept projectiles must cause the lifecycle transition');
  assert.equal(target.combat.record!.status, 3);
  assert.equal(target.combat.getFlag(11), 0);
  f.world.updateInput(attacker.id, input(2, false));
  f.world.updateInput(target.id, input(1, true));
  assert(!f.step().events.some(event => event.type === 'fire' && event.playerId === target.id));
  const respawn = f.at((target.respawnAt - f.room.startedAt) / 1000);
  assert(respawn.events.some(event => event.type === 'respawn' && event.playerId === target.id));
  assert.equal(target.combat.record!.status, 2);
  assert.equal(target.combat.getFlag(11), 1);
  assert.equal(target.combat.nextAvailableSeconds, 0);
  f.world.updateInput(target.id, input(2, true));
  assert(f.step().events.some(event => event.type === 'fire' && event.playerId === target.id));
  f.at(60.1);
  assert.equal(f.snapshot().phase, 'FINISHED');
  attacker.combat.setFlag(11, false);
  f.world.rematch(attacker.id, 1); f.world.rematch(target.id, 1);
  assert([...f.room.players.values()].every(player => player.combat.record!.status === 2
    && player.combat.getFlag(11) === 1 && player.combat.nextAvailableSeconds === 0));
}
console.log('PASS: World uses original flag11/f32 relative deadline, ordinary projectile death/respawn and rematch reset; reload duration remains prototype800ms');
