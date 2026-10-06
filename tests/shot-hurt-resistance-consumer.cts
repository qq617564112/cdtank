import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {damagePlayer} from '../apps/server/src/battle/life';
import {createRoleCombatState, type RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {MsgRoomEvent} from '../apps/shared/protocols';

type Participant = Parameters<typeof damagePlayer>[1] & {combat: RoleCombatState};
const room = {roomId: 'resistance', mode: 4, targetScore: 10, teamScores: [0, 0], teamLives: [2, 2],
  map: {brokenScore: -10, hitScore: 2, destroyScore: 10, respawnTime: 3}};
function participant(id: string, rate: number | undefined, ready = true): Participant {
  const combat = createRoleCombatState();
  if (rate !== undefined) combat.roleFloatFields.set(0x90, rate);
  return {id, name: id, team: 0, x: 0, y: 0, z: 0, hp: 600, alive: true,
    score: 0, kills: 0, deaths: 0, respawnAt: 0, vip: false, attributesReady: ready,
    combat, attributes: {record: {hp: 600, maxHp: 650}, values: {roleIntegers: new Map()}}};
}
const rows: object[] = [];
for (const selector of [1, 2, 3, 4]) {
  for (const [name, rate, ready, ammo, expected] of [
    ['unlearned', 0, true, 2001, selector],
    ['learned', 1, true, 2001, undefined],
    ['missing', undefined, true, 2001, selector],
    ['withdrawn', 1, false, 2001, selector],
    ['periodic', 1, true, undefined, selector],
  ] as const) {
    const attacker = participant('P1', 0), target = participant('P2', rate, ready), events: MsgRoomEvent[] = [];
    damagePlayer(room, attacker, target, 151, () => 1000, events, selector, ammo);
    const hit = events.find(event => event.type === 'hit')!;
    assert.equal(hit.hurtSelector, expected, name);
    assert.equal(hit.value, 151); assert.equal(target.hp, 449); assert.equal(attacker.score, 2);
    if (ammo !== undefined) assert.deepEqual(hit.shotPlayerResult, {itemId: 2001, critical: false});
    rows.push({name, selector, result: hit.hurtSelector, damage: hit.value, hp: target.hp});
  }
}
const attacker = participant('P1', 0), resistant = participant('P2', 1);
attacker.hp = 400; attacker.attributes.record.hp = 400;
attacker.combat.roleFloatFields.set(0x68, .2); attacker.combat.roleFloatFields.set(0x94, .1);
resistant.armorReady = true; resistant.recoveredArmor = {defensePercent: .17, defenseBonus: 44};
const originalRandom = Math.random, events: MsgRoomEvent[] = [];
try {
  Math.random = () => .1;
  damagePlayer(room, attacker, resistant, 151, () => 1000, events, 3, 2001);
} finally {Math.random = originalRandom;}
const hit = events.find(event => event.type === 'hit')!;
assert.equal(hit.hurtSelector, undefined); assert.equal(hit.shotPlayerResult?.critical, true);
assert.equal(hit.value, 30200 / 161); assert.equal(resistant.hp, (600 - 30200 / 161) | 0);
assert.equal(attacker.hp, 400 + Math.round((600 - resistant.hp) * .1));
// A subsequent source withdrawal restores the normal selector; no transient immunity persists.
resistant.attributesReady = false;
attacker.combat.roleFloatFields.delete(0x68);
const subsequent: MsgRoomEvent[] = [];
damagePlayer(room, attacker, resistant, 151, () => 1000, subsequent, 2, 2001);
assert.equal(subsequent.find(event => event.type === 'hit')?.hurtSelector, 2);
const immune = participant('P2', 1); immune.invincibility = {expiresAt: 2000};
const blocked: MsgRoomEvent[] = [];
damagePlayer(room, attacker, immune, 151, () => 1000, blocked, 2, 2001);
assert.equal(blocked[0].type, 'immuneHit'); assert.equal(immune.hp, 600);
writeFileSync('recovery/output/shot-hurt-resistance-consumer.json', JSON.stringify({
  status: 'PASS_CURRENT_TARGET_FULL_ANTI_HURT_SELECTOR_GATE_DAMAGE_CRITICAL_DRAIN_AND_SOURCE_WITHDRAWAL_SCOPE',
  rows, criticalHit: hit, criticalLifeDrainPreserved: true, immuneUnchanged: true,
}, null, 2) + '\n');
console.log('PASS: current full anti-hurt gate, damage, critical, drain and source withdrawal');
