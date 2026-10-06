import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {damagePlayer} from '../apps/server/src/battle/life';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {MsgRoomEvent} from '../apps/shared/protocols';

// Explicit rule fixture; this does not claim recovered original team-damage authority.
function participant(id: string, hp = 100, vip = false) {
  return {id, name: id, team: 0, x: 100, y: 0, z: 100, hp, alive: true,
    score: 0, kills: 0, deaths: 0, respawnAt: 0, vip,
    combat: createRoleCombatState(), attributes: {record: {hp, maxHp: hp}}};
}
function room(mode: number, friendlyFire: boolean) {
  return {roomId: 'fixture', mode, friendlyFire, targetScore: 10,
    teamScores: [0, 0], teamLives: [2, 2],
    map: {brokenScore: -10, hitScore: 2, destroyScore: 10, respawnTime: 3}};
}
let now = 1000;
const evidence: object[] = [];
for (const enabled of [false, true]) {
  const attacker = participant('attacker');
  const target = {...participant('target'), invincibility: {expiresAt: 2000}};
  const state = room(1, enabled), events: MsgRoomEvent[] = [];
  damagePlayer(state, attacker, target, 40, () => now, events);
  assert.equal(target.hp, 100); assert.equal(target.deaths, 0);
  assert.equal(attacker.score, enabled ? 0 : -10);
  assert.deepEqual(events.map(event => event.type), [enabled ? 'immuneHit' : 'friendlyFire']);
  assert.equal(attacker.kills, 0); assert.deepEqual(state.teamScores, [0, 0]);
  evidence.push({enabled, immunity: true, attackerScore: attacker.score, events});
}
const attacker = participant('attacker');
const target = {...participant('target'), defenseBoost: {skillId: 5 as const, expiresAt: 3000,
  defensePercent: 30, defenseBonus: 20, baseDefense: 0, boostedDefense: 100,
  source: 'rebuilt-tank' as const}};
const state = room(1, true), events: MsgRoomEvent[] = [];
damagePlayer(state, attacker, target, 40, () => now, events);
assert.equal(target.hp, 80); assert.equal(attacker.score, -10);
assert.deepEqual(events.map(event => [event.type, event.value]), [['friendlyFire', 20], ['hit', 20]]);
now = 3000;
damagePlayer(state, attacker, target, 80, () => now, events);
assert.equal(target.hp, 0); assert.equal(target.alive, false); assert.equal(target.combat.status, 3);
assert.equal(target.deaths, 1); assert.equal(target.respawnAt, 6000);
assert.equal(attacker.score, -20); assert.equal(attacker.kills, 0);
assert.deepEqual(state.teamScores, [0, 0]); assert.deepEqual(state.teamLives, [1, 2]);
assert.equal(target.combat.record!.numericFields!.get(0x54), 0);
evidence.push({defense: true, attacker, target, state, events});
for (const mode of [1, 2, 3]) {
  const killer = participant('killer'), casualty = participant('casualty', 10, true);
  const rules = room(mode, true); rules.teamLives = [1, 2];
  const outcome = damagePlayer(rules, killer, casualty, 10, () => now, []);
  assert.deepEqual(outcome, mode === 2 ? undefined : {winnerTeam: 1, winnerPlayerId: ''});
  assert.deepEqual(rules.teamScores, [0, 0]); assert.equal(killer.kills, 0); assert.equal(killer.score, -10);
  assert.equal(rules.teamLives[0], mode === 1 ? 0 : 1);
  evidence.push({mode, outcome, rules, score: killer.score, kills: killer.kills});
}
// Opponent hits retain the existing positive scores, kill count and mode team score.
const enemyKiller = participant('enemy'), victim = {...participant('victim', 10), team: 1};
const enemyRoom = room(1, true);
damagePlayer(enemyRoom, enemyKiller, victim, 10, () => now, []);
assert.equal(enemyKiller.score, 12); assert.equal(enemyKiller.kills, 1);
assert.deepEqual(enemyRoom.teamScores, [1, 0]); assert.deepEqual(enemyRoom.teamLives, [2, 1]);
writeFileSync('recovery/output/friendly-fire-rules.json', JSON.stringify({status: 'PASS', evidence,
  opponentBehaviorPreserved: true, scope: 'Explicit reconstructed damage rule fixtures, not native oracle evidence.'}, null, 2));
console.log('PASS: OFF legacy penalty, ON defense/immunity, life/status/deadline, teammate scores/counters, depleted team and VIP opposing victory, opponent behavior');
