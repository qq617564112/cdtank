import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {TSBuffer} from 'tsbuffer';
import {serviceProto} from '../apps/shared/protocols/serviceProto';
import {damagePlayer} from '../apps/server/src/battle/life';
import {resolveMedicalAmmo} from '../apps/server/src/battle/items/medical-ammo';
import {createRoleCombatState, type RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {MsgRoomEvent} from '../apps/shared/protocols';

type Participant = Parameters<typeof damagePlayer>[1] & {combat: RoleCombatState};
const room = {roomId: 'critical', mode: 4, targetScore: 10, teamScores: [0, 0], teamLives: [2, 2],
  map: {brokenScore: -10, hitScore: 2, destroyScore: 10, respawnTime: 3}};
function participant(id: string, hp = 600): Participant {
  const combat = createRoleCombatState();
  combat.roleFloatFields.set(0x68, Math.fround(.2));
  combat.roleFloatFields.set(0x94, Math.fround(.1));
  return {id, name: id, team: 0, x: 0, y: 0, z: 0, hp, alive: true,
    score: 0, kills: 0, deaths: 0, respawnAt: 0, vip: false, attributesReady: true,
    combat, attributes: {record: {hp, maxHp: 650}, values: {roleIntegers: new Map()}}};
}
let rolls = 0, roll = .1;
const originalRandom = Math.random;
const evidence: object[] = [];
const codec = new TSBuffer(serviceProto.types);
Math.random = () => {rolls++; return roll;};
try {
  for (const critical of [false, true]) {
    roll = critical ? .1 : .3;
    const attacker = participant('P1', 400), target = participant('P2');
    target.armorReady = true;
    target.recoveredArmor = {defensePercent: .17, defenseBonus: 44, sideDefensePercent: .7};
    const events: MsgRoomEvent[] = [], beforeRolls = rolls;
    damagePlayer(room, attacker, target, 151, () => 1000, events, 2, 2001,
      {bodyYaw: 0, bearing: {x: 1, z: 0}});
    const hit = events.find(event => event.type === 'hit')!;
    const damage = 151 * (critical ? 2 : 1) * 100 / (100 + 61 * .7);
    assert.equal(rolls - beforeRolls, 1);
    assert.equal(hit.value, damage);
    assert.equal(hit.hurtSelector, 2);
    assert.equal(hit.shotPlayerResult?.critical, critical);
    assert.equal(target.hp, (600 - damage) | 0);
    assert.equal(attacker.hp, 400 + Math.round((600 - target.hp) * Math.fround(.1)));
    const encoded = codec.encode(hit, 'MsgRoomEvent/MsgRoomEvent');
    assert(encoded.isSucc, encoded.errMsg);
    const decoded = codec.decode(encoded.buf!, 'MsgRoomEvent/MsgRoomEvent');
    assert(decoded.isSucc, decoded.errMsg);
    assert.deepEqual((decoded.value as MsgRoomEvent).shotPlayerResult, {itemId: 2001, critical});
    evidence.push({critical, damage, hp: target.hp, healed: attacker.hp - 400});
  }
  for (const exclusion of ['withdrawn', 'missing', 'zero', 'dead', 'friendly', 'immune', 'counter', 'periodic', 'self', 'medical']) {
    const attacker = participant('P1'), target = participant('P2'), events: MsgRoomEvent[] = [];
    if (exclusion === 'withdrawn') attacker.attributesReady = false;
    if (exclusion === 'missing') attacker.combat.roleFloatFields.delete(0x68);
    if (exclusion === 'zero') attacker.combat.roleFloatFields.set(0x68, 0);
    if (exclusion === 'dead') attacker.alive = false;
    if (exclusion === 'immune') target.invincibility = {expiresAt: 2000};
    if (exclusion === 'counter') target.attributes.values!.roleIntegers.set(0x58, 1);
    const beforeRolls = rolls;
    if (exclusion === 'medical') assert(resolveMedicalAmmo(room.roomId, attacker, target, 2009, events));
    else damagePlayer(exclusion === 'friendly' ? {...room, mode: 1, friendlyFire: true} : room,
      attacker, exclusion === 'self' ? attacker : target, 151, () => 1000, events, 2,
      exclusion === 'periodic' ? undefined : 2001);
    assert.equal(rolls, beforeRolls, exclusion + ' must not roll');
    assert(!events.some(event => event.shotPlayerResult?.critical));
  }
  roll = .1;
  const attacker = participant('P1', 649), target = participant('P2', 7), events: MsgRoomEvent[] = [];
  damagePlayer(room, attacker, target, 151, () => 1000, events, 1, 2001);
  assert.equal(target.hp, 0); assert.equal(attacker.hp, 650);
  assert.equal(events.find(event => event.type === 'playerHealed')?.value, 1);
  // Qualification is read at damage time, including after a projectile was fired.
  attacker.combat.roleFloatFields.set(0x68, 0);
  const beforeRolls = rolls;
  damagePlayer(room, attacker, participant('P3'), 151, () => 1000, [], 1, 2002);
  assert.equal(rolls, beforeRolls);
} finally {Math.random = originalRandom;}
writeFileSync('recovery/output/shot-critical-consumer.json', JSON.stringify({
  status: 'PASS_CURRENT_QUALIFIED_CRITICAL_SINGLE_ROLL_PRE_DEFENSE_SAME_HIT_WIRE_INTEGER_HP_DRAIN_EXCLUSIONS_SCOPE',
  evidence, exclusions: true, currentHitQualification: true, actualNetworkRandomControlled: false,
}, null, 2) + '\n');
console.log('PASS: current critical qualification, single roll, pre-defense multiplier, wire flag and HP drain');
