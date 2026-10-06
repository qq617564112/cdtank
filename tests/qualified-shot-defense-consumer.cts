import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {damagePlayer} from '../apps/server/src/battle/life';
import {createRoleCombatState, type RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {DefenseBoostState} from '../apps/server/src/battle/items/defense-drink';
import type {MsgRoomEvent} from '../apps/shared/protocols';

type Participant = Parameters<typeof damagePlayer>[1] & {combat: RoleCombatState};
const room = {roomId: 'armor', mode: 4, targetScore: 10,
  teamScores: [0, 0], teamLives: [2, 2],
  map: {brokenScore: -10, hitScore: 2, destroyScore: 10, respawnTime: 3}};
function participant(id: string): Participant {
  return {id, name: id, team: 0, x: 0, y: 0, z: 0, hp: 600, alive: true,
    score: 0, kills: 0, deaths: 0, respawnAt: 0, vip: false,
    combat: createRoleCombatState(), attributes: {record: {hp: 600, maxHp: 600}}};
}
const boost: DefenseBoostState = {skillId: 5, expiresAt: 2000,
  defensePercent: 30, defenseBonus: 20, baseDefense: 44.286,
  boostedDefense: 64.586, source: 'original-attributes'};
const cases: object[] = [];
function hit(name: string, target: Participant, expected: number, ammoItemId?: number): void {
  const attacker = participant('P2'), events: MsgRoomEvent[] = [];
  damagePlayer(room, attacker, target, 151, () => 1000, events, 0, ammoItemId);
  const observed = events.find(event => event.type === 'hit');
  assert(observed);
  assert(Math.abs(observed.value - expected) < 1e-10);
  assert.equal(target.hp, (600 - expected) | 0);
  assert.equal(target.attributes.record.hp, target.hp);
  assert.equal(target.combat.record?.numericFields?.get(0x54), target.hp);
  assert.equal(attacker.score, 2);
  cases.push({name, damage: observed.value, hp: target.hp});
}
const base = {defensePercent: .13599999248981476, defenseBonus: 44};
const mounted = {defensePercent: .28599998354911804, defenseBonus: 44};
hit('ordinary unmounted', {...participant('P1'), armorReady: true, recoveredArmor: base},
  15100 / (100 + base.defensePercent * 100 + 44), 2001);
hit('ordinary mounted', {...participant('P1'), armorReady: true, recoveredArmor: mounted},
  15100 / (100 + mounted.defensePercent * 100 + 44), 2001);
const current = {defensePercent: .585999983549118, defenseBonus: 64};
hit('current drink counted once', {...participant('P1'), armorReady: true,
  recoveredArmor: current, defenseBoost: boost},
  15100 / (100 + current.defensePercent * 100 + 64), 2001);
const legacy = 151 * (100 + boost.baseDefense) / (100 + boost.boostedDefense);
hit('periodic damage keeps legacy drink', {...participant('P1'), armorReady: true,
  recoveredArmor: current, defenseBoost: boost}, legacy);
hit('periodic without drink', {...participant('P1'), armorReady: true,
  recoveredArmor: mounted}, 151);
hit('withdrawn qualification ignores stale armor', {...participant('P1'), armorReady: false,
  recoveredArmor: mounted, defenseBoost: boost}, legacy, 2001);
hit('missing armor uses legacy drink', {...participant('P1'), armorReady: true,
  defenseBoost: boost}, legacy, 2001);
hit('unqualified unchanged', participant('P1'), 151, 2001);
for (const immune of [false, true]) {
  const target = {...participant('P1'), armorReady: true, recoveredArmor: mounted,
    invincibility: immune ? {expiresAt: 2000} : undefined};
  const events: MsgRoomEvent[] = [];
  damagePlayer({...room, mode: 1, friendlyFire: false}, participant('P2'), target,
    151, () => 1000, events, 0, 2001);
  assert.equal(target.hp, 600);
  assert.equal(events[0].type, 'friendlyFire');
  if (immune) {
    damagePlayer(room, participant('P2'), target, 151, () => 1000, events, 0, 2001);
    assert.equal(events.at(-1)?.type, 'immuneHit');
    assert.equal(target.hp, 600);
  }
}
writeFileSync('recovery/output/qualified-shot-defense-consumer.json',
  JSON.stringify({status: 'PASS_SHOT_ARMOR_CURRENT_SINGLE_CONSUMPTION_PERIODIC_BOUNDARY', cases}, null, 2) + '\n');
console.log('PASS: shot armor, current drink once, periodic boundary and existing life gates');
