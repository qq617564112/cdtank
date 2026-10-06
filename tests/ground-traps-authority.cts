import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createWaitingRoom} from '../apps/server/src/rooms/create';
import {createBattlePlayer} from '../apps/server/src/battle/create-player';
import {getTankConfig} from '../apps/server/src/config';
import {placeGroundTrap, advanceGroundTraps, clearGroundTraps} from '../apps/server/src/battle/items/ground-traps';
import {RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const room = createWaitingRoom(1, 7, () => 'R1');
room.phase = 'PLAYING';
const command = {sequence: 0, move: 0, turn: 0, aim: 0, fire: false, useItem: 0, clientTime: 0};
const owner = createBattlePlayer('P1', 'C1', 'owner', getTankConfig(1), 0, {x: 0, y: 0, z: 0, yaw: 0}, command);
const enemy = createBattlePlayer('P2', 'C2', 'enemy', getTankConfig(1), 1, {x: 100, y: 0, z: 0, yaw: 0}, command);
const ally = createBattlePlayer('P3', 'C3', 'ally', getTankConfig(1), 0, {x: 0, y: 0, z: 0, yaw: 0}, command);
for (const player of [owner, enemy, ally]) {player.combat.setStatus(2); room.players.set(player.id, player);}
owner.inventory = [{instanceId: 1, itemTableId: 3003, ownedQuantity: 2, battleQuantity: 2,
  state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}];
const events: MsgRoomEvent[] = [];
const request = {kind: 'placeTrap', instanceId: 1};
placeGroundTrap(room, owner, request, 1000, () => 'T1', () => false, events);
assert.equal(owner.inventory[0].ownedQuantity, 2); assert.equal(room.groundTraps.length, 0);
placeGroundTrap(room, owner, request, 1000, () => 'T1', () => {throw Error('sqlite');}, events);
assert.equal(owner.inventory[0].battleQuantity, 2); assert.equal(room.groundTraps.length, 0);
let cas = 0;
placeGroundTrap(room, owner, request, 1000, () => 'T1', (_id, instance, expected, table) => {
  assert.deepEqual([instance, expected, table], [1, 2, 3003]); cas++; return true;
}, events);
assert.equal(cas, 1); assert.equal(owner.inventory[0].ownedQuantity, 1); assert.equal(owner.inventory[0].battleQuantity, 1);
assert.deepEqual(room.groundTraps[0], {id: 'T1', ownerId: 'P1', team: 0, itemTableId: 3003,
  modelId: 3003, x: 0, y: 0, z: 0, expiresAt: 31000});
advanceGroundTraps(room, 1100, events);
assert.equal(room.groundTraps.length, 1); assert(!ally.trapRestraint);
enemy.x = 20;
const notified: number[] = [];
enemy.combat = new RoleCombatState(enemy.combat.record, index => notified.push(index));
advanceGroundTraps(room, 1200, events);
assert.equal(room.groundTraps.length, 0); assert.equal(enemy.combat.record!.flags[9], 0);
assert.equal(enemy.combat.record!.flags[10], 1); assert.equal(enemy.combat.record!.flags[11], 1);
assert.equal(enemy.trapRestraint!.expiresAt, 6200); assert.deepEqual(notified, [33]);
advanceGroundTraps(room, 6199, events); assert.equal(enemy.combat.record!.flags[9], 0);
advanceGroundTraps(room, 6200, events); assert.equal(enemy.combat.record!.flags[9], 1); assert(!enemy.trapRestraint);
assert.deepEqual(notified, [33, 33]); assert.equal(events.filter(event => event.type === 'trapTriggered').length, 1);
assert.equal(events.filter(event => event.type === 'trapRestraintEnded').length, 1);
placeGroundTrap(room, owner, request, 7000, () => 'T2', () => true, events);
advanceGroundTraps(room, 37000, events); assert.equal(room.groundTraps.length, 0);
assert.equal(events.filter(event => event.type === 'trapTriggered').length, 1);
clearGroundTraps(room); assert.equal(room.groundTraps.length, 0); assert.equal(owner.inventory[0].ownedQuantity, 0);
const result = {status: 'PASS_GROUND_TRAP_AUTHORITY_MODULE_ONLY', scope: 'Durable rejection/throw before mutation, exact CAS one quantity, friendly/owner exclusion, single contact, flag9 notification33 and flag10/11 preservation, exact server expiry and untriggered object expiry; no network claim.'};
writeFileSync('recovery/output/ground-traps-authority-rules.json', JSON.stringify(result, null, 2));
console.log(result.status);
