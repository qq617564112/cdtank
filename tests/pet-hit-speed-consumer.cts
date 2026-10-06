import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {applyPetHitSpeed, advancePetHitSpeed, clearPetHitSpeed} from '../apps/server/src/battle/pet-hit-speed';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {BattleRoleSources} from '../apps/server/src/battle-role-sources';

type Participant = Parameters<typeof applyPetHitSpeed>[0];
function player(rank = 1, petId = 2): Participant {
  const combat = createRoleCombatState(); combat.setStatus(2); combat.setArray(4, [2001, 4020, ...Array(14).fill(0)]);
  const fields = new Map([[0x4c, 10231], [0x64, rank]]);
  return {id: 'P2', team: 0, hp: 500, alive: true, attributesReady: true, combat,
    ownedRoles: {snapshot: () => ({base: {fields}}), tables: () => ({pet: {id: petId}})} as unknown as BattleRoleSources};
}
const owner = {id: 'P1', team: 0}, evidence: object[] = [];
function reject(name: string, p: Participant, previous = 600, mode = 4, attacker = owner): void {
  const before = p.combat.record!.arrays.get(4)!.slice();let calls = 0;
  assert.equal(applyPetHitSpeed(p, attacker, mode, previous, 1000, () => calls++), false);
  assert.equal(calls, 0);assert.equal(p.petHitSpeed, undefined);
  assert.deepEqual(p.combat.record!.arrays.get(4), before);evidence.push({name, rejected: true});
}
reject('unlearned', player(0));reject('wrong selected pet', player(1, 103));
reject('no actual injury', player(), 500);reject('life increased', player(), 499);
reject('friendly injury', player(), 600, 1);reject('self injury', player(), 600, 4, {id: 'P2', team: 0});
reject('dead', {...player(), alive: false});reject('HP0 pending', {...player(), hp: 0});
reject('unready source', {...player(), attributesReady: false});
const inactive = player();inactive.combat.setStatus(3);reject('inactive', inactive);
const full = player();full.combat.setArray(4, Array(16).fill(2001));reject('no free current skill slot', full);
const foreign = player();foreign.combat.addSkill(10231);reject('existing current skill remains independently owned', foreign);
const p = player();let recomputations = 0;const recompute = () => recomputations++;
const before = p.combat.record!.arrays.get(4)!.slice();
assert(applyPetHitSpeed(p, owner, 4, 600, 1000, recompute));assert.equal(p.petHitSpeed!.expiresAt, 6000);
assert.equal(recomputations, 1);assert.equal(p.combat.record!.arrays.get(4)!.filter(id => id === 10231).length, 1);
assert(applyPetHitSpeed(p, owner, 4, 600, 5000, recompute));assert.equal(p.petHitSpeed!.expiresAt, 10000);
assert.equal(recomputations, 1);assert.equal(p.combat.record!.arrays.get(4)!.filter(id => id === 10231).length, 1);
advancePetHitSpeed(p, 9999, recompute);assert(p.petHitSpeed);
advancePetHitSpeed(p, 10000, recompute);assert.equal(p.petHitSpeed, undefined);assert.deepEqual(p.combat.record!.arrays.get(4), before);
assert.equal(recomputations, 2);clearPetHitSpeed(p, recompute);assert.equal(recomputations, 2);
assert(applyPetHitSpeed(p, owner, 4, 600, 20000, recompute));p.alive = false;
advancePetHitSpeed(p, 20001, recompute);assert.equal(p.petHitSpeed, undefined);assert.deepEqual(p.combat.record!.arrays.get(4), before);
writeFileSync('recovery/output/pet-hit-speed-consumer.json', JSON.stringify({
  status: 'PASS_SELECTED_10231_REAL_INJURY_SINGLE_CURRENT_SKILL_REFRESH_EXPIRY_LIFE_GATES',
  scope: 'Explicit source/current-slot fixtures, not ordinary realtime movement proof', evidence,
  repeatRefreshWithoutStack: true, exactExpiryBoundary: true, ownSkillOnlyCleared: true,
}, null, 2) + '\n');
console.log('PASS: 10231 injury gates, single current skill, refresh and expiry');
