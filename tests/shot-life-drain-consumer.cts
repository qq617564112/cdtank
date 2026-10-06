import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {damagePlayer} from '../apps/server/src/battle/life';
import {createRoleCombatState, type RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {resolveMedicalAmmo} from '../apps/server/src/battle/items/medical-ammo';
import type {MsgRoomEvent} from '../apps/shared/protocols';

type Participant = Parameters<typeof damagePlayer>[1] & {combat: RoleCombatState};
const room = {roomId: 'drain', mode: 4, targetScore: 10,
  teamScores: [0, 0], teamLives: [2, 2],
  map: {brokenScore: -10, hitScore: 2, destroyScore: 10, respawnTime: 3}};
function participant(id: string, hp = 400): Participant {
  const combat = createRoleCombatState();
  combat.roleFloatFields.set(0x94, Math.fround(10 * Math.fround(.01)));
  return {id, name: id, team: 0, x: 0, y: 0, z: 0, hp, alive: true,
    score: 0, kills: 0, deaths: 0, respawnAt: 0, vip: false, attributesReady: true,
    combat, attributes: {record: {hp, maxHp: 600}}};
}
const evidence: object[] = [];
function shot(name: string, attacker: Participant, target: Participant, heal: number,
  options: {ammoItemId?: number; friendly?: boolean} = {ammoItemId: 2001}): void {
  const initialAttacker = attacker.hp, initialTarget = target.hp, events: MsgRoomEvent[] = [];
  damagePlayer(options.friendly ? {...room, mode: 1, friendlyFire: true} : room,
    attacker, target, 151, () => 1000, events, 0, options.ammoItemId);
  assert.equal(attacker.hp, initialAttacker + heal);
  assert.equal(attacker.attributes.record.hp, attacker.hp);
  if (heal > 0) assert.equal(attacker.combat.record?.numericFields?.get(0x54), attacker.hp);
  const healed = events.filter(event => event.type === 'playerHealed');
  assert.equal(healed.length, heal > 0 ? 1 : 0);
  if (heal > 0) {
    assert.equal(healed[0].value, heal);
    assert.equal(healed[0].playerId, attacker.id);
    assert.equal(healed[0].targetId, attacker.id);
    assert.equal(healed[0].playSkillEffect, undefined);
    assert.equal(healed[0].shotPlayerResult, undefined);
  }
  evidence.push({name, actualHpRemoved: initialTarget - target.hp, healed: heal, events});
}
shot('integer HP loss after armor, not float hit value', participant('P1'),
  {...participant('P2', 600), armorReady: true,
    recoveredArmor: {defensePercent: .13599999248981476, defenseBonus: 44}}, 10);
shot('overkill uses actual remaining HP', participant('P1'), participant('P2', 11), 1);
shot('current maximum clamps actual healing', participant('P1', 599), participant('P2', 600), 1);
shot('full health creates no healing notice', participant('P1', 600), participant('P2', 600), 0);
shot('withdrawn qualification ignores stale ratio', {...participant('P1'), attributesReady: false},
  participant('P2', 600), 0);
const missing = participant('P1'); missing.combat.roleFloatFields.delete(0x94);
shot('missing ratio', missing, participant('P2', 600), 0);
const zero = participant('P1'); zero.combat.roleFloatFields.set(0x94, 0);
shot('zero ratio', zero, participant('P2', 600), 0);
shot('dead attacker does not heal', {...participant('P1'), alive: false}, participant('P2', 600), 0);
shot('periodic damage does not absorb', participant('P1'), participant('P2', 600), 0, {});
shot('friendly damage does not absorb', participant('P1'), participant('P2', 600), 0,
  {ammoItemId: 2001, friendly: true});
shot('immune shot causes no absorption', participant('P1'),
  {...participant('P2', 600), invincibility: {expiresAt: 2000}}, 0);
const self = participant('P1');
const selfEvents: MsgRoomEvent[] = [];
damagePlayer(room, self, self, 151, () => 1000, selfEvents, 0, 2001);
assert.equal(self.hp, 249); assert(!selfEvents.some(event => event.type === 'playerHealed'));
const healer = participant('P1'), patient = participant('P2');
patient.combat.setStatus(2);
const medicalEvents: MsgRoomEvent[] = [];
if (!resolveMedicalAmmo(room.roomId, healer, patient, 2009, medicalEvents)) {
  damagePlayer(room, healer, patient, 151, () => 1000, medicalEvents, 0, 2009);
}
assert.equal(healer.hp, 400); assert.equal(patient.hp, 600);
assert.equal(medicalEvents.length, 1); assert.equal(medicalEvents[0].targetId, patient.id);
writeFileSync('recovery/output/shot-life-drain-consumer.json', JSON.stringify({
  status: 'PASS_QUALIFIED_HOSTILE_SHOT_ACTUAL_HP_LOSS_LIFE_DRAIN_BOUNDARIES', evidence,
  selfAndMedicalDoNotAbsorb: true,
}, null, 2) + '\n');
console.log('PASS: qualified hostile shot life drain, integer loss, overkill, maxHP and exclusions');
