import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {damagePlayer} from '../apps/server/src/battle/life';
import {createRoleCombatState, type RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {BattleRoleSources} from '../apps/server/src/battle-role-sources';
import type {MsgRoomEvent} from '../apps/shared/protocols';

type Participant = Parameters<typeof damagePlayer>[1] & {combat: RoleCombatState};
const room = {roomId: 'back-critical', mode: 4, targetScore: 10, teamScores: [0, 0], teamLives: [2, 2],
  map: {brokenScore: -10, hitScore: 2, destroyScore: 10, respawnTime: 3}};
function player(id: string, hp: number): Participant {
  const combat = createRoleCombatState();
  combat.roleFloatFields.set(0x68, Math.fround(.2));
  combat.roleFloatFields.set(0x94, Math.fround(.1));
  return {id, name: id, team: 0, x: 0, y: 0, z: 0, hp, alive: true, score: 0,
    kills: 0, deaths: 0, respawnAt: 0, vip: false, attributesReady: true,
    combat, attributes: {record: {hp, maxHp: 1000}, values: {roleIntegers: new Map()}}};
}
const rows: object[] = [];
let roll = .1, rolls = 0;
const originalRandom = Math.random;
Math.random = () => {rolls++; return roll;};
try {
  for (const kind of ['back', 'front', 'side', 'ordinary', 'unlearned', 'wrongPet', 'withdrawn',
    'dead', 'friendly', 'self', 'periodic', 'immune', 'counter', 'kill'] as const) {
    const attacker = player('P1', 400), target = player('P2', kind === 'kill' ? 500 : 1000);
    const fields = new Map([[8, kind === 'wrongPet' ? 105 : 2], [0x48, 10221],
      [0x60, kind === 'unlearned' ? 0 : 1]]);
    attacker.ownedRoles = {snapshot: () => ({base: {name: '', fields}, equipment: undefined}),
      tables: () => ({pet: {id: fields.get(8)}, tank: undefined})} as unknown as BattleRoleSources;
    if (kind === 'withdrawn') attacker.attributesReady = false;
    if (kind === 'dead') attacker.alive = false;
    if (kind === 'immune') target.invincibility = {expiresAt: 2000};
    if (kind === 'counter') target.attributes.values!.roleIntegers.set(0x58, 1);
    target.armorReady = true;
    target.recoveredArmor = {defensePercent: .17, defenseBonus: 44,
      sideDefensePercent: .7, backDefensePercent: .5};
    roll = kind === 'ordinary' ? .3 : .1;
    const bearing = kind === 'front' ? {x: 0, z: 1} : kind === 'side' ? {x: 1, z: 0} : {x: 0, z: -1};
    const actualTarget = kind === 'self' ? attacker : target;
    const beforeHp = actualTarget.hp, beforeRolls = rolls;
    const events: MsgRoomEvent[] = [];
    damagePlayer(kind === 'friendly' ? {...room, mode: 1, friendlyFire: true} : room,
      attacker, actualTarget, 151, () => 1000, events, 1, kind === 'periodic' ? undefined : 2001,
      {bodyYaw: 0, bearing});
    const hit = events.find(event => event.type === 'hit');
    if (kind === 'immune' || kind === 'counter') {
      assert.equal(target.hp, beforeHp); assert.equal(rolls, beforeRolls); assert(!events.some(e => e.type === 'destroy'));
      continue;
    }
    assert(hit);
    const critical = kind !== 'ordinary' && !['withdrawn', 'dead', 'friendly', 'self', 'periodic'].includes(kind);
    const factor = kind === 'front' ? 1 : kind === 'side' ? .7 : .5;
    const defended = kind === 'self' || kind === 'periodic' ? 151
      : 151 * (critical ? 2 : 1) * 100 / (100 + 61 * factor);
    const bonus = kind === 'back' || kind === 'kill' ? 400 : 0;
    assert.equal(hit.value, defended + bonus, kind);
    assert.equal(actualTarget.hp, Math.max(0, (beforeHp - hit.value) | 0));
    if (!['self', 'friendly', 'periodic', 'dead', 'withdrawn'].includes(kind)) {
      assert.equal(attacker.hp, 400 + Math.round((beforeHp - target.hp) * Math.fround(.1)));
    }
    if (kind === 'kill') {
      assert.equal(target.hp, 0); assert.equal(target.alive, false);
      assert.equal(target.deaths, 1); assert.equal(attacker.kills, 1);
      assert.equal(target.respawnAt, 4000); assert.equal(attacker.score, 12);
      assert.equal(events.filter(e => e.type === 'destroy').length, 1);
    }
    assert(!events.some(e => e.playSkillEffect));
    rows.push({kind, critical, defended, bonus, hit: hit.value, hp: actualTarget.hp});
  }
  writeFileSync('recovery/output/shot-back-critical-consumer.json', JSON.stringify({
    status: 'PASS_QUALIFIED_BACK_CRITICAL_REFERENCED400_DAMAGE_HEALTH_DRAIN_KILL_EXCLUSION_SCOPE',
    fixture: 'Module-only controlled authority roll; no live network state injection', rows,
  }, null, 2) + '\n');
  console.log('PASS learned back Critical extra400, health, drain, kill and exclusions');
} finally {Math.random = originalRandom;}
