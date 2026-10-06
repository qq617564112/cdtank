import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {combatCatalog} from '../apps/server/src/battle/catalog';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {confirmAcceptedAmmoSelection} from '../apps/server/src/battle/items/ammo-confirmation';
import {consumeConfirmedAmmo} from '../apps/server/src/battle/items/ammo-consumption';
import {classifyItemId} from '../apps/shared/combat/item-hotkeys';
import type {InventoryWireRecord} from '../apps/shared/protocols/PtlInventory';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const rows: {itemId: number; calls: number; consumed: number[]}[] = [];
for (const item of combatCatalog.items.filter(item => classifyItemId(item.itemTableId) === 3)) {
  const combat = createRoleCombatState();
  combat.record!.arrays.get(0)![0] = 77;
  const inventory: InventoryWireRecord[] = [{instanceId: 77, itemTableId: item.itemTableId,
    ownedQuantity: 2, battleQuantity: 2, state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}];
  assert(confirmAcceptedAmmoSelection(combat, inventory, 2));
  const player = {id: 'fixture', x: 0, y: 0, z: 0, combat, inventory,
    input: {sequence: 1, move: 0, turn: 0, aim: 0, fire: true, useItem: 0, clientTime: 0}};
  const events: MsgRoomEvent[] = [];
  for (const failure of [() => false, () => {throw new Error('Explicit persistence failure');}]) {
    const before = structuredClone(inventory);
    assert(!consumeConfirmedAmmo('fixture', player, failure, events));
    assert.deepEqual(inventory, before);
    assert.equal(player.input.fire, false);
    assert.equal(combat.currentAmmoTableId, item.itemTableId);
    player.input.fire = true;
  }
  let calls = 0;
  for (const remaining of [1, 0]) {
    assert(consumeConfirmedAmmo('fixture', player, (_player, instance, expected, table) => {
      calls++; assert.equal(instance, 77); assert.equal(expected, remaining + 1);
      assert.equal(table, item.itemTableId); assert.equal(inventory[0].ownedQuantity, expected);
      return true;
    }, events));
    assert.equal(inventory[0].ownedQuantity, remaining);
    assert.equal(inventory[0].battleQuantity, remaining);
    assert.equal(combat.currentAmmoTableId, item.itemTableId);
  }
  assert(!consumeConfirmedAmmo('fixture', player, () => {throw new Error('Empty stock cannot write');}, events));
  assert.equal(combat.selectedAmmoSlot, 1); assert.equal(combat.currentAmmoTableId, 2001);
  assert.equal(player.input.fire, false);
  assert(consumeConfirmedAmmo('fixture', player, () => {throw new Error('Default cannot write');}, events));
  rows.push({itemId: item.itemTableId, calls, consumed: events.filter(event => event.type === 'ammoConsumed').map(event => event.value)});
}
assert(rows.some(row => row.itemId === 2002)); assert(rows.some(row => row.itemId === 2003));
writeFileSync('recovery/output/ammo-stock-consumption.json', JSON.stringify({status: 'PASS_MODULE_SCOPE', rows,
  scope: 'All catalog class3 confirmed stock uses CAS before counters; false/throw preserve stock, exhaustion resets and stops held input, default2001 writes nothing. Explicit module records; no ordinary acquisition claim.'}, null, 2));
console.log(`PASS ${rows.length} catalog ammunition definitions`);
