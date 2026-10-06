import assert from 'node:assert/strict';
import {finiteAmmoHotkey} from '../apps/server/src/battle/cpu/items';

const highId = 0xf1234567;
const actor = {alive: true, combat: {status: 2, currentAmmoTableId: 2001,
  record: {arrays: new Map([[0, new Int32Array([highId, 78, 79, 0, 0, 0, 0])]])}},
  inventory: [{instanceId: highId, itemTableId: 2011, ownedQuantity: 2, battleQuantity: 2},
    {instanceId: 78, itemTableId: 2007, ownedQuantity: 2, battleQuantity: 2},
    {instanceId: 79, itemTableId: 2004, ownedQuantity: 2, battleQuantity: 2}]};
assert.equal(finiteAmmoHotkey(actor, true), 2);
assert.equal(finiteAmmoHotkey(actor, false), 0);
assert.equal(finiteAmmoHotkey({...actor, alive: false}, true), 0);
assert.equal(finiteAmmoHotkey({...actor, combat: {...actor.combat, status: 3}}, true), 0);
assert.equal(finiteAmmoHotkey({...actor, combat: {...actor.combat, currentAmmoTableId: 2011}}, true), 0);
actor.inventory[0].battleQuantity = 0;
assert.equal(finiteAmmoHotkey(actor, true), 3);
actor.inventory[0].battleQuantity = 2; actor.inventory[0].ownedQuantity = 0;
assert.equal(finiteAmmoHotkey(actor, true), 3);
actor.inventory[1].ownedQuantity = 0;
assert.equal(finiteAmmoHotkey(actor, true), 0, 'Undelivered finite ammo cannot be selected');
assert.equal(finiteAmmoHotkey({...actor, inventory: []}, true), 0);
assert.equal(finiteAmmoHotkey({...actor, combat: {status: 2, currentAmmoTableId: 2001}}, true), 0);
console.log('PASS: ready opportunity, role/default gating, unsigned configured ownership and finite slot exhaustion');
