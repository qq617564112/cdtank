import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {applyPetInjection} from '../apps/server/src/battle/items/pet-injection';
import {startAmmoBurn, advanceAmmoBurn} from '../apps/server/src/battle/items/ammo-burn';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {combatSkills} from '../apps/server/src/battle/catalog';
import type {PetInjectionParticipant} from '../apps/server/src/battle/items/pet-injection';
import type {MsgRoomEvent} from '../apps/shared/protocols';

function fixture() {
  const combat = createRoleCombatState();
  combat.setStatus(2);
  const player: PetInjectionParticipant & {hp: number; attackBoost: object; invincibility: object} = {
    id: 'P12', name: 'Player', alive: true, x: 10, y: 20, z: 30, combat, hp: 190,
    inventory: [{instanceId: 77, itemTableId: 3, ownedQuantity: 2, battleQuantity: 2,
      state: 0, field8: 7, float24Bits: 0x7fc01234, float28Bits: 0x80000000, float2cBits: 0xffffffff}],
    attackBoost: {skillId: 4, expiresAt: 10000}, invincibility: {skillId: 8, expiresAt: 10000},
  };
  return player;
}
const request = {kind: 'useItem', instanceId: 77};
const evidence: Record<string, unknown>[] = [];
for (const failure of ['noBurn', 'CASfalse', 'throw'] as const) {
  const player = fixture();
  if (failure !== 'noBurn') startAmmoBurn(player, 'P1', 0);
  const before = structuredClone(player.inventory);
  const burn = player.burn;
  const events: MsgRoomEvent[] = [];
  let calls = 0;
  applyPetInjection('room', player, request, () => {
    calls++;
    if (failure === 'throw') throw new Error('Storage boundary fixture');
    return false;
  }, events, () => assert.fail('Burn-only rejection cannot recompute movement'));
  assert.deepEqual(player.inventory, before);
  assert.equal(player.burn, burn);
  assert.equal(calls, failure === 'noBurn' ? 0 : 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'itemRejected');
  evidence.push({failure, calls, events});
}
const player = fixture();
startAmmoBurn(player, 'P1', 0);
const slots = [...player.combat.record!.arrays.get(4)!];
const fields = [...player.combat.record!.numericFields!];
const attackBoost = player.attackBoost, invincibility = player.invincibility;
const events: MsgRoomEvent[] = [];
let commits = 0;
applyPetInjection('room', player, request, (id, instance, owned, table) => {
  assert.equal(player.burn!.ownerId, 'P1');
  assert.equal(player.inventory[0].ownedQuantity, 2);
  assert.deepEqual([id, instance, owned, table], ['P12', 77, 2, 3]);
  commits++;
  return true;
}, events, () => assert.fail('Burn-only cure cannot recompute movement'));
assert.equal(player.burn, undefined);
assert.equal(player.inventory[0].ownedQuantity, 1);
assert.equal(player.inventory[0].battleQuantity, 1);
assert.equal(player.inventory[0].field8, 7);
assert.equal(player.inventory[0].float24Bits, 0x7fc01234);
assert.equal(player.hp, 190);
assert.equal(player.attackBoost, attackBoost);
assert.equal(player.invincibility, invincibility);
assert.deepEqual([...player.combat.record!.arrays.get(4)!], slots);
assert.deepEqual([...player.combat.record!.numericFields!], fields);
assert.equal(events[0].type, 'itemUsed');
assert.deepEqual(events[0].playSkillEffect, {skillId: 3, effectIndex: 0, duration: 0, roleId: 12, xBits: 0, zBits: 0});
advanceAmmoBurn(player, 9000, () => true, () => assert.fail('Cured burn cannot deal later damage'));
applyPetInjection('room', player, request, () => {commits++; return true;}, events,
  () => assert.fail('Repeated burn-only cure cannot recompute movement'));
assert.equal(commits, 1, 'Repeat cure without burn cannot consume');
assert.equal(player.inventory[0].ownedQuantity, 1);
assert.equal(events[1].type, 'itemRejected');
for (const invalid of ['dead', 'status', 'empty', 'wrongKind', 'wrongItem'] as const) {
  const value = fixture();
  startAmmoBurn(value, 'P1', 0);
  if (invalid === 'dead') value.alive = false;
  if (invalid === 'status') value.combat.setStatus(3);
  if (invalid === 'empty') value.inventory[0].battleQuantity = 0;
  if (invalid === 'wrongItem') value.inventory[0].itemTableId = 1;
  const burn = value.burn;
  const ignored: MsgRoomEvent[] = [];
  applyPetInjection('room', value, {...request, kind: invalid === 'wrongKind' ? 'placeTrap' : 'useItem'},
    () => assert.fail('Invalid request cannot persist'), ignored,
    () => assert.fail('Invalid request cannot recompute movement'));
  assert.equal(value.burn, burn);
  assert.deepEqual(ignored, []);
}
const skill = combatSkills.get(3)!;
assert.equal(skill.functions[0].type, 10);
assert.equal(skill.effects![0].effectId, 18);
assert.equal(skill.effects![0].sound, 'SE17');
writeFileSync('recovery/output/pet-injection.json', JSON.stringify({status: 'PASS',
  scope: 'Rebuilt burn-only self cure, CAS-first/no-burn failure atomicity, no positive buff/HP/long-term skill mutation, source skill3 effect0 and repeated cure rejection.',
  evidence, commits, events, remaining: player.inventory[0]}, null, 2) + '\n');
console.log('PASS: item3 burn cure/CAS atomicity/source notification, no-burn repeat rejection and positive state preservation');
