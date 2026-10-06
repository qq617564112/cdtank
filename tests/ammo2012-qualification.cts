import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {combatCatalog} from '../apps/server/src/battle/catalog';
import {consumableShopItems} from '../apps/server/src/accounts/shop-catalog';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {confirmAcceptedAmmoSelection} from '../apps/server/src/battle/items/ammo-confirmation';
import {consumeConfirmedAmmo} from '../apps/server/src/battle/items/ammo-consumption';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const product = consumableShopItems(combatCatalog).find(item => item.itemTableId === 2012)!;
assert.equal(product.moneyPrice, 50);
assert.equal(product.tokenPrice, 50);
assert.equal(product.iconId, 2012);
for (const commit of [false, true]) {
  const combat = createRoleCombatState();
  combat.setStatus(2);
  combat.setArray(0, [77, 0, 0, 0, 0, 0, 0]);
  const item = {instanceId: 77, itemTableId: 2012, ownedQuantity: 1, battleQuantity: 1,
    state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0};
  assert(confirmAcceptedAmmoSelection(combat, [item], 2));
  assert.equal(combat.currentAmmoTableId, 2012);
  assert(combat.record!.arrays.get(4)!.includes(4010));
  const input = {sequence: 1, move: 0, turn: 0, aim: 0, fire: true, useItem: 0, clientTime: 0};
  const player = {id: 'P1', x: 0, y: 0, z: 0, combat, inventory: [item], input};
  const events: MsgRoomEvent[] = [];
  assert.equal(consumeConfirmedAmmo('qualification', player, (_id, instance, owned, table) => {
    assert.deepEqual([instance, owned, table], [77, 1, 2012]);
    assert.equal(item.ownedQuantity, 1);
    return commit;
  }, events), commit);
  assert.equal(item.ownedQuantity, commit ? 0 : 1);
  assert.equal(item.battleQuantity, commit ? 0 : 1);
  assert.equal(events[0].type, commit ? 'ammoConsumed' : 'itemRejected');
}
writeFileSync('recovery/output/ammo2012-qualification.json', JSON.stringify({
  status: 'PASS_MODULE_ONLY', product,
  scope: 'Source-price Shop qualification, original skill installation and finite CAS-first ammo consumption; flight/damage remain existing rebuilt rules.'
}, null, 2) + '\n');
console.log('PASS_MODULE_ONLY: ammo2012 qualification');
