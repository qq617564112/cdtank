import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {World} from '../apps/server/src/world';
import {battleMovementPose, predictBattleMovement} from '../apps/server/src/battle/movement';
import {predictControlledBattleMovement} from '../apps/server/src/battle/dynamic-movement';
import {intersectsOriginalObb} from '../apps/server/src/battle/roles/obb-intersection';
import {createRoleObbFromPose} from '../apps/server/src/battle/roles/movement-obb-prediction';
const source: {rows: {tankId: number; part: number; base: Record<string, number>;
  equipment: Record<string, number>}[]} = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8'));
const fields = (value: Record<string, number>) => new Map(Object.entries(value).map(([key, v]) => [Number(key), v]));
let now = 100000;
const world = new World(() => now, {timeLimitSeconds: 120});
const host = world.createAndJoin('dynamic-owner', 5, 20, 'Dynamic', 'Owner', 1);
const peers = [host.playerId];
for (let index = 1; index < 4; index++) peers.push(world.joinRoom(host.roomId, `dynamic-${index}`, 'Peer', 1).playerId);
for (const id of peers) {
  const row = source.rows.find(row => row.tankId === 1 && row.part === 0)!;
  world.bindRoleSources(id, {base: {name: 'Explicit native pet', fields: fields(row.base)},
    equipment: {name: 'Explicit native tank', fields: fields(row.equipment)}});
}
for (const id of peers) world.ready(id, 1);
const room = world['rooms'].get(host.roomId)!;
const owner = room.players.get(host.playerId)!, other = room.players.get(peers[3])!;
// Actual rebuilt room uses three source spawns for four humans. Source-native
// separation must resolve that repeated initial point before ordinary stepping.
assert.equal(Math.abs(owner.x - other.x), 60);
assert(!intersectsOriginalObb(createRoleObbFromPose(battleMovementPose(owner)),
  createRoleObbFromPose(battleMovementPose(other))));
let blocked = 0, comparisonTicks = 0, acceptedMoves = 0;
for (let tick = 0; tick < 300; tick++) {
  const bearing = Math.atan2(other.x - owner.x, other.z - owner.z);
  const error = Math.atan2(Math.sin(bearing - owner.yaw), Math.cos(bearing - owner.yaw));
  const input = {sequence: tick + 1, move: Math.abs(error) < .15 ? 1 : 0,
    turn: Math.abs(error) < owner.attributes.record.turn * .05 * .5 ? 0 : Math.sign(error),
    aim: 0, fire: false, useItem: 0, clientTime: now};
  const expected = predictControlledBattleMovement(owner, input, room.battlefield, room.players.values(), .05)!;
  const withoutDynamic = predictBattleMovement(owner, input, room.battlefield, .05)!;
  const before = {x: owner.x, z: owner.z, yaw: owner.yaw};
  const wouldTranslate = Math.hypot(withoutDynamic.pose.position.x - before.x, withoutDynamic.pose.position.z - before.z) > .05;
  const wouldTurn = Math.abs(Math.atan2(Math.sin(withoutDynamic.yaw - before.yaw), Math.cos(withoutDynamic.yaw - before.yaw))) > .00001;
  const denied = expected.command === 0 && (input.move !== 0 || input.turn !== 0);
  world.updateInput(owner.id, input);
  now += 50; world.step(50);
  assert.equal(owner.x, expected.pose.position.x);
  assert.equal(owner.z, expected.pose.position.z);
  assert.equal(owner.yaw, expected.yaw);
  assert.equal(owner.movementCommand, expected.command);
  assert.equal(other.movementCommand, 0, 'Uncommanded peer prediction must remain stop, not borrow new owner input');
  comparisonTicks++;
  acceptedMoves += Math.hypot(owner.x - before.x, owner.z - before.z) > .05 ? 1 : 0;
  if (denied && (wouldTranslate || wouldTurn)) {
    assert.equal(owner.x, before.x); assert.equal(owner.z, before.z); assert.equal(owner.yaw, before.yaw);
    assert.equal(owner.movementCommand, 0, 'Original dynamic refusal clears saved command');
    blocked++;
    break;
  }
}
assert(blocked > 0, 'Ordinary approach or hull turn must meet actual dynamic OBB refusal before NAV-only commit');
// Move away only through the same original controller and ordinary input.
const reverse = {sequence: 400, move: -1, turn: 0, aim: 1, fire: true, useItem: 0, clientTime: now};
const before = {x: owner.x, z: owner.z, aim: owner.aim};
const predicted = predictControlledBattleMovement(owner, reverse, room.battlefield, room.players.values(), .05)!;
world.updateInput(owner.id, reverse); now += 50;
const step = world.step(50);
assert.equal(owner.x, predicted.pose.position.x); assert.equal(owner.z, predicted.pose.position.z);
assert(Math.hypot(owner.x - before.x, owner.z - before.z) > .05);
assert(owner.aim > before.aim);
assert(step.events.some(event => event.type === 'fire' && event.playerId === owner.id));
writeFileSync('recovery/output/world-dynamic-movement.json', JSON.stringify({status: 'PASS',
  source: 'Explicit complete native owned sources; actual map20 four-human source spawns and ordinary World inputs',
  separatedRepeatedSpawn: true, comparisonTicks, blocked, acceptedMoves,
  dynamicRefusalClearsCommand: true, ordinaryReverseAndIndependentAimFire: true,
  scope: 'Complete normal-source peer dynamic gate and original separation. Incomplete/VIP peers, full static notification downstream, final dimensions, vertical handling and original admission order remain open.'}, null, 2) + '\n');
for (const id of peers) world.leave(id);
console.log('PASS: actual World repeated source spawn separation, ordinary dynamic refusal/command stop, reverse clearance and independent aim/fire');
