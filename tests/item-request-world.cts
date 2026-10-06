import type {RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import type {CombatCatalog} from '../apps/shared/combat/catalog';
import type {InventoryWireRecord} from '../apps/shared/protocols/PtlInventory';
import {World} from '../apps/server/src/world';

const catalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8')) as CombatCatalog;
let now = 100000;
const world = new World(() => now, {timeLimitSeconds: 10});
const owner = world.createAndJoin('item-owner', 4, 7, 'Requests', 'Owner', 1);
const record = (instanceId: number, itemTableId: number, ownedQuantity: number): InventoryWireRecord => ({
  instanceId, itemTableId, ownedQuantity, battleQuantity: 88, state: 0,
  field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0,
});
const records = [record(77, 2001, 2), record(78, 3001, 1000), record(79, 1, 30),
  record(80, 2002, 0), record(81, 1, 17)];
world.bindInventory(owner.playerId, {records, hotkeys: [77, 78, 80, 79, 0, 0, 0]});
let sequence = 0;
const key = (useItem: number, currentSequence = ++sequence) => world.updateInput(owner.playerId,
  {sequence: currentSequence, move: 0, turn: 0, aim: 0, fire: false, useItem, clientTime: now});
assert.deepEqual(key(3), [], 'Waiting rooms do not dispatch battle requests');
for (let index = 0; index < 3; index++) world.manageCpu(owner.playerId, 1, 'ADD', 1);
world.ready(owner.playerId, 1);
const initial = world.inventory(owner.playerId);
for (let index = 0; index < 4; index++) {
  const item = initial.records[index];
  assert.equal(item.battleQuantity, Math.min(item.ownedQuantity,
    catalog.items.find(definition => definition.itemTableId === item.itemTableId)!.battleUseMax));
}
assert.equal(initial.records[4].battleQuantity, 88, 'Original initializer leaves unassigned records unchanged');
const authority = (world as unknown as {rooms: Map<string, {players: Map<string, {combat: RoleCombatState}>}>})
  .rooms.get(owner.roomId)!.players.get(owner.playerId)!.combat;
assert.equal(authority.selectedAmmoSlot, 1, 'Original constructor selects default slot1');
assert.equal(authority.currentAmmoTableId, 2001);
key(2);
assert.equal(authority.record!.numericFields!.get(0x3c), 2, 'Normal keyboard input updates the actual role record');
assert.equal(authority.selectedAmmoSlot, 2);
assert.equal(authority.currentAmmoTableId, 2001, 'The accepted slot confirms its owned inventory table ID');
assert.equal(world.snapshot(owner.roomId)!.players.find(player => player.id === owner.playerId)!.selectedAmmoSlot, 2);
const first = key(3);
assert.deepEqual(first.map(event => event.itemUseRequest), [{kind: 'placeTrap', instanceId: 78}]);
assert.deepEqual(key(3), [], 'Trap permission rejects an immediate second request');
assert.deepEqual(key(4), [], 'Zero battle count is rejected before dispatch');
const fullHealthRequest = key(5);
assert.deepEqual(fullHealthRequest.filter(event => event.type === 'itemRequest').map(event => event.itemUseRequest),
  [{kind: 'useItem', instanceId: 79}]);
assert.deepEqual(fullHealthRequest.map(event => event.type), ['itemRequest', 'itemRejected'],
  'The ordinary request reaches the healing authority, which refuses full life without consumption');
assert.deepEqual(key(5, sequence), [], 'Stale input does not duplicate a request');
const elapsed: number[] = [];
for (let tick = 0; tick < 62; tick++) {now += 50; world.step(50); elapsed.push(now);}
assert.deepEqual(key(3).map(event => event.itemUseRequest), [{kind: 'placeTrap', instanceId: 78}]);
assert.deepEqual(world.inventory(owner.playerId), initial, 'Requests neither cast skills nor consume quantities');
assert.deepEqual(records.map(item => item.battleQuantity), Array(5).fill(88), 'World inventory owns a copy');
now += 10000;
world.step(10000);
assert.equal(world.snapshot(owner.roomId)!.phase, 'FINISHED');
world.rematch(owner.playerId, 1);
assert.equal(world.snapshot(owner.roomId)!.phase, 'PLAYING');
assert.equal(world.snapshot(owner.roomId)!.match!.round, 2);
assert.deepEqual(world.inventory(owner.playerId), initial,
  'Rematch restores assigned caps while preserving unassigned records and owned stock');
assert.deepEqual(key(3, sequence), [], 'Previous-round input is still stale after inventory reset');
writeFileSync('recovery/output/item-request-world.json', JSON.stringify({status: 'PASS',
  scope: 'Stored seven slots, first-start/rematch assigned-count caps and untouched unassigned stock, stale old-round rejection and ordinary World keyboard dispatch. Requests are permitted, not confirmed casts/consumption.',
  initial, rematchInventory: world.inventory(owner.playerId),
  firstRequest: first[0].itemUseRequest, cooldownElapsedMs: elapsed.at(-1)! - 100000}, null, 2));
console.log('PASS: first/rematch assigned caps and untouched unassigned stock, normal ammo/trap/item input, stale old-round/empty rejection, three-second permission recovery and no consumption');
