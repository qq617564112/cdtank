import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {applyPetInjection} from '../apps/server/src/battle/items/pet-injection';
import {startAmmoSlow, type AmmoSlowParticipant} from '../apps/server/src/battle/items/ammo-slow';
import {startAmmoBurn} from '../apps/server/src/battle/items/ammo-burn';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {recomputeQualifiedRoleMovement} from '../apps/server/src/battle/roles/recompute-movement';
import {ROLE_INITIAL_MOVEMENT_SCALES} from '../apps/server/src/battle/roles/record-defaults';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import type {PetInjectionParticipant} from '../apps/server/src/battle/items/pet-injection';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const tank = TANKS.find(row => row.id === 3)!;
const pet = PET_BASES.find(row => row.id === 2)!;
const request = {kind: 'useItem', instanceId: 77};
function fixture(boost: boolean) {
  const combat = createRoleCombatState(); combat.setStatus(2);
  for (const skillId of combatItemSkills.get(2001)!.skillIds) if (skillId) combat.addSkill(skillId);
  if (boost) combat.addSkill(6);
  const player: PetInjectionParticipant & AmmoSlowParticipant & {
    hp: number; speedBoost?: {skillId: number; expiresAt: number};
  } = {id: 'P2', name: 'Target', alive: true, x: 0, y: 0, z: 0, combat,
    attributesReady: false, hp: 620,
    inventory: [{instanceId: 77, itemTableId: 3, ownedQuantity: 2, battleQuantity: 2,
      state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}]};
  if (boost) player.speedBoost = {skillId: 6, expiresAt: 30000};
  const recompute = () => {
    const movement = recomputeQualifiedRoleMovement({tank: tank.recomputeBase, pet,
      ownedField34: 0, tankType: tank.recomputeBase.tankType,
      sources: {currentSkillIds: [...combat.record!.arrays.get(4)!], extraSkill: {baseId: 0, rank: 0}},
      skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0,
      movementScales: ROLE_INITIAL_MOVEMENT_SCALES});
    assert(movement); player.recoveredMovement = movement;
  };
  recompute();
  return {player, recompute};
}
const rows = [];
for (const boost of [false, true]) {
  for (const scenario of ['slow', 'burnAndSlow', 'CASfalse', 'throw'] as const) {
    const {player, recompute} = fixture(boost);
    const baseline = {...player.recoveredMovement!};
    assert(startAmmoSlow('room', player, 1000, recompute, []));
    if (scenario === 'burnAndSlow') startAmmoBurn(player, 'P1', 1000);
    const slow = player.ammoSlow, burn = player.burn, speedBoost = player.speedBoost;
    const beforeMovement = {...player.recoveredMovement!};
    const beforeSlots = [...player.combat.record!.arrays.get(4)!];
    const beforeInventory = structuredClone(player.inventory);
    const events: MsgRoomEvent[] = [];
    let commits = 0, recomputes = 0;
    applyPetInjection('room', player, request, () => {
      commits++;
      assert.equal(player.ammoSlow, slow, 'Persistence precedes state removal');
      assert.deepEqual([...player.combat.record!.arrays.get(4)!], beforeSlots);
      assert.deepEqual(player.inventory, beforeInventory);
      if (scenario === 'throw') throw new Error('Storage boundary fixture');
      return scenario !== 'CASfalse';
    }, events, () => {recomputes++; recompute();});
    assert.equal(commits, 1);
    assert.equal(player.hp, 620);
    assert.equal(player.speedBoost, speedBoost);
    if (scenario === 'CASfalse' || scenario === 'throw') {
      assert.equal(player.ammoSlow, slow); assert.equal(player.burn, burn);
      assert.deepEqual(player.inventory, beforeInventory);
      assert.deepEqual([...player.combat.record!.arrays.get(4)!], beforeSlots);
      assert.deepEqual(player.recoveredMovement, beforeMovement);
      assert.equal(recomputes, 0); assert.equal(events[0].type, 'itemRejected');
    } else {
      assert.equal(player.ammoSlow, undefined); assert.equal(player.burn, undefined);
      assert(!player.combat.record!.arrays.get(4)!.includes(4006));
      assert.deepEqual(player.recoveredMovement, baseline);
      if (boost) assert(player.combat.record!.arrays.get(4)!.includes(6));
      assert.equal(recomputes, 1); assert.equal(player.inventory[0].ownedQuantity, 1);
      assert.equal(player.inventory[0].battleQuantity, 1);
      assert.equal(events[0].type, 'itemUsed'); assert.equal(events[0].skillId, 3);
      applyPetInjection('room', player, request, () => assert.fail('No abnormal cannot consume'),
        events, () => assert.fail('No abnormal cannot recompute'));
      assert.equal(events.at(-1)!.type, 'itemRejected'); assert.equal(player.inventory[0].ownedQuantity, 1);
    }
    rows.push({boost, scenario, baseline, beforeMovement, afterMovement: player.recoveredMovement,
      recomputes, remaining: player.inventory[0].ownedQuantity, events});
  }
}
writeFileSync('recovery/output/pet-injection-slow-rules.json', JSON.stringify({status: 'PASS',
  scope: 'New delivered slow cure, CAS-first failure atomicity, skill4006 removal and original movement recalculation; combined burn and positive skill6 preservation; no HP write or whole original Func10 claim.', rows}, null, 2) + '\n');
console.log('PASS: eight slow/combined-burn/positive-buff/CAS-failure contracts');
