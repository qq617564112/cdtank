import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {damagePlayer, respawnPlayer} from '../apps/server/src/battle/life';
import {consumeShotCancellation} from '../apps/server/src/battle/shot-cancellation';
import {createRoleCombatState, type RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {createBattlePlayer} from '../apps/server/src/battle/create-player';
import {initializeBattleParticipants} from '../apps/server/src/battle/start';
import {createRoomBattlefield} from '../apps/server/src/battlefield';
import {TANKS} from '../apps/server/src/config';
import {resolveMedicalAmmo} from '../apps/server/src/battle/items/medical-ammo';
import type {MsgPlayerInput, MsgRoomEvent} from '../apps/shared/protocols';

type Participant = Parameters<typeof damagePlayer>[1] & {combat: RoleCombatState};
const room = {roomId: 'counter', mode: 4, targetScore: 10,
  teamScores: [0, 0], teamLives: [2, 2],
  map: {brokenScore: -10, hitScore: 2, destroyScore: 10, respawnTime: 3}};
function participant(id: string, maximum = 0): Participant {
  const combat = createRoleCombatState();
  combat.roleFloatFields.set(0x94, Math.fround(.1));
  return {id, name: id, team: 0, x: 0, y: 0, z: 0, hp: 400, alive: true,
    score: 0, kills: 0, deaths: 0, respawnAt: 0, vip: false,
    attributesReady: true, cancellationsSpent: 0, combat,
    attributes: {record: {hp: 400, maxHp: 600}, values: {roleIntegers: new Map([[0x58, maximum]])}}};
}
const attacker = participant('P1'), target = participant('P2', 1);
const first: MsgRoomEvent[] = [];
damagePlayer(room, attacker, target, 151, () => 1000, first, 1, 2001);
assert.equal(target.hp, 400); assert.equal(target.attributes.record.hp, 400);
assert.equal(target.cancellationsSpent, 1); assert.equal(attacker.score, 0);
assert.equal(attacker.hp, 400); assert.equal(first.length, 1);
assert.equal(first[0].type, 'hit'); assert.equal(first[0].value, 0);
assert.equal(first[0].hurtSelector, undefined); assert.equal(first[0].skillId, undefined);
const second: MsgRoomEvent[] = [];
damagePlayer(room, attacker, target, 151, () => 1000, second, 1, 2001);
assert.equal(target.hp, 249); assert.equal(target.cancellationsSpent, 1);
assert.equal(attacker.score, 2); assert.equal(attacker.hp, 415);
assert.equal(second.find(event => event.type === 'playerHealed')!.value, 15);
// Qualification withdrawal and ordinary source rebinding cannot refill a life.
target.attributesReady = false;
assert.equal(consumeShotCancellation(target), false);
target.attributesReady = true;
target.attributes.values!.roleIntegers.set(0x58, 0);
assert.equal(consumeShotCancellation(target), false);
target.attributes.values!.roleIntegers.set(0x58, 1);
assert.equal(consumeShotCancellation(target), false);
assert.equal(target.cancellationsSpent, 1);
target.attributes.values!.roleIntegers.set(0x58, 2);
assert.equal(consumeShotCancellation(target), true);
assert.equal(target.cancellationsSpent, 2);
for (const kind of ['periodic', 'friendly', 'immune', 'self', 'unqualified'] as const) {
  const source = participant('P1'), victim = participant('P2', 1);
  const events: MsgRoomEvent[] = [];
  if (kind === 'immune') victim.invincibility = {expiresAt: 2000};
  if (kind === 'unqualified') victim.attributesReady = false;
  damagePlayer(kind === 'friendly' ? {...room, mode: 1, friendlyFire: true} : room,
    source, kind === 'self' ? source : victim, 151, () => 1000, events, 1,
    kind === 'periodic' ? undefined : 2001);
  assert.equal(victim.cancellationsSpent, 0, kind);
  if (kind === 'immune') assert.equal(victim.hp, 400);
  else if (kind !== 'self') assert.equal(victim.hp, 249);
}
const patient = participant('P2', 1), medicalEvents: MsgRoomEvent[] = [];
patient.combat.setStatus(2);
assert(resolveMedicalAmmo(room.roomId, participant('P1'), patient, 2009, medicalEvents));
assert.equal(patient.cancellationsSpent, 0); assert.equal(patient.hp, 600);
// Invoke actual lifecycle entrypoints; no alternate reset implementation.
const input: MsgPlayerInput = {sequence: 0, move: 0, turn: 0, aim: 0, fire: false, useItem: 0, clientTime: 0};
const field = createRoomBattlefield(7);
const player = createBattlePlayer('life', 'client', 'Life', TANKS[0], 0, field.spawn(0), input);
assert.equal(player.cancellationsSpent, 0);
player.cancellationsSpent = 2;
respawnPlayer(field, player, 300, input);
assert.equal(player.cancellationsSpent, 0);
player.cancellationsSpent = 2;
initializeBattleParticipants(field, [player], input, () => {}, () => 300, () => 1000);
assert.equal(player.cancellationsSpent, 0);
writeFileSync('recovery/output/shot-cancellation-consumer.json', JSON.stringify({
  status: 'PASS_QUALIFIED_PER_LIFE_SHOT_CANCELLATION_DAMAGE_DRAIN_SCORE_RESET_BOUNDARIES',
  first, second, sourceChangesPreserveSpent: true,
  exclusions: ['periodic', 'friendly', 'immune', 'self', 'unqualified', 'medical'],
  actualCreateRespawnRoundReset: true,
}, null, 2) + '\n');
console.log('PASS: shot cancellation, subsequent damage, drain, score, source changes and lifecycle resets');
