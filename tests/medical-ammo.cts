import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {resolveMedicalAmmo} from '../apps/server/src/battle/items/medical-ammo';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {combatItems, combatSkills} from '../apps/server/src/battle/catalog';
import type {MsgRoomEvent} from '../apps/shared/protocols';

const item = combatItems.get(2009)!;
const skill = combatSkills.get(4007)!;
assert(item.skillIds.includes(skill.skillId));
assert.equal(skill.triggerType, 8);
assert.equal(skill.target, 5);
assert.equal(skill.functions[0].type, 2);
assert.equal(skill.attributes.HP, 300);
const owner = {id: 'P1', name: 'Medical'};
const cases: unknown[] = [];
for (const initialHp of [50, 650, 700]) {
  const combat = createRoleCombatState(); combat.setStatus(2);
  const record = {hp: initialHp, maxHp: 700};
  combat.setHealth(record, initialHp);
  const target = {id: 'P2', name: 'Victim', alive: true, x: 10, y: 2, z: 30,
    hp: initialHp, attributes: {record}, combat};
  const events: MsgRoomEvent[] = [];
  assert(resolveMedicalAmmo('R1', owner, target, 2009, events));
  assert.equal(target.hp, Math.min(700, initialHp + 300));
  assert.equal(record.hp, target.hp);
  assert.equal(combat.record!.numericFields!.get(0x54), target.hp);
  assert.equal(combat.record!.numericFields!.get(0x58), 700);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'playerHealed');
  assert.equal(events[0].value, target.hp - initialHp);
  assert.equal(events[0].skillId, 4007);
  assert.deepEqual(events[0].shotPlayerResult, {itemId: 2009});
  assert.equal(events[0].hurtSelector, undefined);
  cases.push({initialHp, hp: target.hp, restored: events[0].value});
  const acceptedHp = target.hp;
  target.alive = false;
  const deadEvents: MsgRoomEvent[] = [];
  assert(resolveMedicalAmmo('R1', owner, target, 2009, deadEvents));
  assert.equal(deadEvents.length, 0);
  assert.equal(target.hp, acceptedHp);
  target.alive = true; combat.setStatus(3);
  const rejected: MsgRoomEvent[] = [];
  assert(resolveMedicalAmmo('R1', owner, target, 2009, rejected));
  assert.equal(rejected.length, 0);
  assert.equal(target.hp, acceptedHp);
  assert(!resolveMedicalAmmo('R1', owner, target, 2002, rejected));
  assert.equal(target.hp, record.hp);
}
writeFileSync('recovery/output/medical-ammo.json', JSON.stringify({status: 'PASS_MODULE_SCOPE',
  source: 'Original2009/4007 Trigger8 Target5 Func2 HP300; victim permission is rebuilt', cases,
  invalidVictimSuppressed: true, unrelatedAmmoUnchanged: true,
  healthConsumersEqual: true, fullHealthAcceptedShotRestoresZero: true,
  ordinaryActualVerified: false}, null, 2) + '\n');
console.log('PASS: medical ammo source300, maximum clamp, shared health consumers, invalid victims and result event');
