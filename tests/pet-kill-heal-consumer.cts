import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {healPetAfterKill} from '../apps/server/src/battle/pet-kill-heal';
import {createRoleCombatState, type RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {damagePlayer, advanceLastStandDeath} from '../apps/server/src/battle/life';
import type {BattleRoleSources} from '../apps/server/src/battle-role-sources';
import type {MsgRoomEvent} from '../apps/shared/protocols';

type Participant = Parameters<typeof healPetAfterKill>[1] & Parameters<typeof damagePlayer>[1] & {combat: RoleCombatState};
function player(id: string, hp = 500, petId = 2, rank = 1): Participant {
  const combat = createRoleCombatState(); combat.setStatus(2);
  const fields = new Map([[0x44, 10211], [0x5c, rank], [0x50, 10441], [0x68, 1]]);
  const ownedRoles = {snapshot: () => ({base: {fields}}), tables: () => ({pet: {id: petId}})} as unknown as BattleRoleSources;
  return {id, name: id, team: 0, x: 0, y: 0, z: 0, hp, alive: true, combat, ownedRoles,
    attributesReady: true, attributes: {record: {hp, maxHp: 700}},
    score: 0, kills: 0, deaths: 0, respawnAt: 0, vip: false};
}
const evidence: object[] = [];
function verify(name: string, attacker: Participant, target: Participant, expected: number, mode = 4): void {
  const previous = attacker.hp, ammo = attacker.combat.bulletCount;
  const owned = Array.from(attacker.ownedRoles.snapshot().base!.fields);
  const events: MsgRoomEvent[] = [];
  assert.equal(healPetAfterKill('heal', attacker, target, mode, events), expected);
  assert.equal(attacker.hp, previous + expected);
  assert.equal(attacker.combat.bulletCount, ammo);
  assert.deepEqual(Array.from(attacker.ownedRoles.snapshot().base!.fields), owned);
  assert.equal(events.length, expected > 0 ? 1 : 0);
  if (expected > 0) {
    assert.equal(attacker.attributes.record.hp, attacker.hp);
    assert.equal(attacker.combat.record!.numericFields!.get(0x54), attacker.hp);
    assert.deepEqual(events[0], {roomId: 'heal', type: 'playerHealed', message: `${attacker.name}恢复${expected}生命`,
      playerId: attacker.id, targetId: attacker.id, value: expected, x: 0, y: 0, z: 0, skillId: 10211});
  }
  evidence.push({name, previous, hp: attacker.hp, expected, events});
}
const dead = () => ({...player('P2'), alive: false});
verify('qualified final hostile kill', player('P1'), dead(), 40);
verify('clamped actual delta', player('P1', 690), dead(), 10);
verify('full life', player('P1', 700), dead(), 0);
verify('unlearned', player('P1', 500, 2, 0), dead(), 0);
verify('wrong selected pet', player('P1', 500, 103), dead(), 0);
verify('living HP0 pending victim', player('P1'), {...player('P2'), hp: 0}, 0);
verify('dead killer', {...player('P1'), alive: false}, dead(), 0);
verify('unready source', {...player('P1'), attributesReady: false}, dead(), 0);
const inactive = player('P1'); inactive.combat.setStatus(3);
verify('inactive killer', inactive, dead(), 0);
verify('friendly final kill', player('P1'), dead(), 0, 1);
verify('self final kill', player('P1'), {...dead(), id: 'P1'}, 0);
verify('last stand positive life rejected', {...player('P1', 0), lastStand: {
  expiresAt: 4000, attackerId: 'P2', attackerName: 'P2', friendly: false}}, dead(), 0);
const room = {roomId: 'heal', mode: 4, targetScore: 10, teamScores: [0, 0], teamLives: [2, 2],
  map: {brokenScore: -10, hitScore: 2, destroyScore: 10, respawnTime: 3}};
const attacker = player('P1'), target = player('P2', 100, 4);
const events: MsgRoomEvent[] = [];
damagePlayer(room, attacker, target, 200, () => 1000, events);
assert(target.alive && target.hp === 0);
assert.equal(healPetAfterKill(room.roomId, attacker, target, room.mode, events), 0);
assert.equal(advanceLastStandDeath(room, target, attacker, 3999, events), undefined);
assert(advanceLastStandDeath(room, target, attacker, 4000, events));
assert.equal(healPetAfterKill(room.roomId, attacker, target, room.mode, events), 40);
assert.equal(advanceLastStandDeath(room, target, attacker, 5000, events), undefined);
assert.equal(events.filter(e => e.type === 'destroy').length, 1);
assert.equal(events.filter(e => e.type === 'playerHealed').length, 1);
writeFileSync('recovery/output/pet-kill-heal-consumer.json', JSON.stringify({
  status: 'PASS_SELECTED_LEARNED_10211_FINAL_HOSTILE_KILL_ACTUAL_LIFE_BOUNDARIES',
  scope: 'Explicit consumer life fixtures, not ordinary realtime evidence', evidence,
  pendingWaitsForFinalDeath: true, delayedDeathAndHealOnce: true, ownedAndAmmoPreserved: true,
}, null, 2) + '\n');
console.log('PASS: selected learnt 10211 final kill healing, clamp and life gates');
