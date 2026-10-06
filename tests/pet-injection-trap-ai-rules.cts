import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {petInjectionHotkey} from '../apps/server/src/battle/cpu/items';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {TrapRestraintState} from '../apps/server/src/battle/items/trap-restraint';

const state: TrapRestraintState = {itemTableId: 3003, skillId: 4001,
  expiresAt: 6000, removedMovePermission: 1};
function fixture(slot: number) {
  const combat = createRoleCombatState(); combat.setStatus(2);
  combat.record!.arrays.get(0)![slot - 2] = 7;
  return {alive: true, hp: 700, maxHp: 700, trapRestraint: {...state}, combat,
    inventory: [{instanceId: 7, itemTableId: 3, ownedQuantity: 2, battleQuantity: 2}]};
}
const rows = [];
for (const slot of [5, 8]) {
  const actor = fixture(slot), before = JSON.stringify(actor);
  assert.equal(petInjectionHotkey(actor), slot);
  assert.equal(JSON.stringify(actor), before, 'Decision must not consume or clear');
  rows.push({slot, result: slot});
}
for (const scenario of ['dead', 'inactive', 'noTrap', 'ownedEmpty', 'battleEmpty', 'wrongItem', 'unconfigured'] as const) {
  const actor: ReturnType<typeof fixture> & {trapRestraint?: TrapRestraintState} = fixture(5);
  if (scenario === 'dead') actor.alive = false;
  if (scenario === 'inactive') actor.combat.setStatus(3);
  if (scenario === 'noTrap') delete (actor as {trapRestraint?: TrapRestraintState}).trapRestraint;
  if (scenario === 'ownedEmpty') actor.inventory[0].ownedQuantity = 0;
  if (scenario === 'battleEmpty') actor.inventory[0].battleQuantity = 0;
  if (scenario === 'wrongItem') actor.inventory[0].itemTableId = 1;
  if (scenario === 'unconfigured') actor.combat.record!.arrays.get(0)!.fill(0);
  assert.equal(petInjectionHotkey(actor), 0);
  rows.push({scenario, result: 0});
}
writeFileSync('recovery/output/pet-injection-trap-ai-rules.json', JSON.stringify({
  status: 'PASS_MODULE_ONLY', scope: 'New trap-only ordinary injection hotkey qualification; no AI origin algorithm or network claim', rows,
}, null, 2) + '\n');
console.log('PASS: trap-only legal slots, alive/status/finite inventory/real binding eligibility, no decision state mutation');
