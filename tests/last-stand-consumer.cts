import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {damagePlayer, advanceLastStandDeath, respawnPlayer} from '../apps/server/src/battle/life';
import {qualifiedLastStandDuration} from '../apps/server/src/battle/last-stand';
import {setBattleHealth} from '../apps/server/src/battle/health';
import {applyHealingItem} from '../apps/server/src/battle/healing';
import {resolveMedicalAmmo} from '../apps/server/src/battle/items/medical-ammo';
import {advanceEquipmentSupply} from '../apps/server/src/battle/items/equipment-supply';
import {applyShotLifeDrain} from '../apps/server/src/battle/shot-life-drain';
import {createRoleCombatState, type RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {BattleRoleSources} from '../apps/server/src/battle-role-sources';
import type {InventoryWireRecord} from '../apps/shared/protocols/PtlInventory';
import type {MsgRoomEvent} from '../apps/shared/protocols';
import type {Battlefield} from '../apps/server/src/battlefield';

type Participant = Parameters<typeof damagePlayer>[1] & {combat: RoleCombatState;
  inventory: InventoryWireRecord[]; attributesReady: boolean; ownedRoles: BattleRoleSources;
  skillFields: Map<number, number>};
function player(id: string, hp = 100): Participant {
  const combat = createRoleCombatState();
  combat.setStatus(2);
  combat.roleFloatFields.set(0x94, 1);
  const fields = new Map([[0x50, 10441], [0x68, 1]]);
  const ownedRoles = {snapshot: () => ({base: {fields}}), tables: () => ({pet: {id: 4}}),
    equipment: () => ({parts: [7, 0, 0, 0, 0]})} as unknown as BattleRoleSources;
  return {id, name: id, team: 0, x: 0, y: 0, z: 0, hp, alive: true, kills: 0,
    deaths: 0, respawnAt: 0, score: 0, vip: false, combat, ownedRoles, attributesReady: true, skillFields: fields,
    inventory: [{instanceId: 7, itemTableId: 1, ownedQuantity: 1, battleQuantity: 1,
      state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}],
    attributes: {record: {hp, maxHp: 700}, values: {roleIntegers: new Map()}}};
}
const room = {roomId: 'last-stand', mode: 4, targetScore: 10, teamScores: [0, 0], teamLives: [2, 2],
  map: {brokenScore: -10, hitScore: 2, destroyScore: 10, respawnTime: 3}};
const events: MsgRoomEvent[] = [];
const attacker = player('P1', 400), target = player('P2');
attacker.attributesReady = false;
damagePlayer(room, attacker, target, 200, () => 1000, events, 1, 2001);
assert.equal(target.hp, 0); assert.equal(target.alive, true); assert.equal(target.combat.status, 2);
assert.equal(target.lastStand!.expiresAt, 4000); assert.equal(target.deaths, 0);
assert.equal(attacker.kills, 0); assert.equal(attacker.score, 2); assert.equal(target.respawnAt, 0);
assert(!events.some(e => e.type === 'destroy'));
const locked = structuredClone(target.lastStand);
damagePlayer(room, attacker, target, 200, () => 2000, events, 1, 2001);
assert.deepEqual(target.lastStand, locked); assert.equal(attacker.kills, 0);
let consumed = 0;
applyHealingItem(room.roomId, target, {kind: 'useItem', instanceId: 7}, () => 700,
  () => {consumed++; return true;}, events);
assert.equal(consumed, 0); assert.equal(target.inventory[0].ownedQuantity, 1);
assert(events.some(e => e.type === 'itemRejected')); assert.equal(target.hp, 0);
const healCount = events.filter(e => e.type === 'playerHealed').length;
assert(resolveMedicalAmmo(room.roomId, attacker, target, 2009, events));
applyShotLifeDrain(room.roomId, target, 50, events);
target.combat.setArray(2, [17061, 0, 0, 0, 0]);
target.inventory.push({...target.inventory[0], itemTableId: 17061, state: 2});
advanceEquipmentSupply(room.roomId, 'PLAYING', target, 3000, 700, events);
setBattleHealth(target, 700);
assert.equal(target.hp, 0); assert.equal(events.filter(e => e.type === 'playerHealed').length, healCount);
assert.equal(advanceLastStandDeath(room, target, attacker, 3999, events), undefined);
assert.equal(target.alive, true);
assert(advanceLastStandDeath(room, target, attacker, 4000, events));
assert.equal(target.alive, false); assert.equal(target.deaths, 1); assert.equal(target.combat.status, 3);
assert.equal(target.lastStand, undefined); assert.equal(target.respawnAt, 7000);
assert.equal(attacker.kills, 1); assert.equal(attacker.score, 14);
assert.equal(advanceLastStandDeath(room, target, attacker, 5000, events), undefined);
assert.equal(events.filter(e => e.type === 'destroy').length, 1);
const input = {sequence: 0, move: 0, turn: 0, aim: 0, fire: false, useItem: 0, clientTime: 0};
const respawning = Object.assign(target, {yaw: 0, aim: 0, input, lastStand: locked});
const field = {spawns: [{x: 1, y: 2, z: 3, yaw: 0}], spawn: () => ({x: 1, y: 2, z: 3, yaw: 0})} as unknown as Battlefield;
respawnPlayer(field, respawning, 700, input);
assert.equal(target.hp, 700); assert.equal(target.alive, true); assert.equal(target.lastStand, undefined);

for (const reason of ['unlearned', 'wrongPet', 'withdrawn', 'dead'] as const) {
  const p = player('excluded');
  if (reason === 'unlearned') p.skillFields.set(0x68, 0);
  if (reason === 'wrongPet') p.ownedRoles = {tables: () => ({pet: {id: 2}})} as unknown as BattleRoleSources;
  if (reason === 'withdrawn') p.attributesReady = false;
  if (reason === 'dead') p.alive = false;
  assert.equal(qualifiedLastStandDuration(p), undefined, reason);
}
const ordinary = player('ordinary'); ordinary.attributesReady = false;
damagePlayer(room, attacker, ordinary, 200, () => 1000, [], 1, 2001);
assert.equal(ordinary.alive, false); assert.equal(ordinary.respawnAt, 4000);
const departed = player('departed');
damagePlayer(room, attacker, departed, 200, () => 1000, [], 1, 2001);
const kills = attacker.kills;
advanceLastStandDeath(room, departed, undefined, 4000, events);
assert.equal(attacker.kills, kills); assert.equal(departed.deaths, 1);
const winner = player('winner', 400), finalist = player('finalist');
winner.attributesReady = false; winner.kills = 9;
assert.equal(damagePlayer(room, winner, finalist, 200, () => 1000, [], 1, 2001), undefined);
assert.equal(winner.kills, 9);
assert.deepEqual(advanceLastStandDeath(room, finalist, winner, 4000, [])!.outcome,
  {winnerTeam: -1, winnerPlayerId: 'winner'});
const friendlyRoom = {...room, mode: 1, friendlyFire: true, teamLives: [1, 1]};
const teammate = player('teammate');
damagePlayer(friendlyRoom, attacker, teammate, 200, () => 1000, [], 1, 2001);
assert.deepEqual(friendlyRoom.teamLives, [1, 1]);
assert.deepEqual(advanceLastStandDeath(friendlyRoom, teammate, attacker, 4000, [])!.outcome,
  {winnerTeam: 1, winnerPlayerId: ''});
assert.deepEqual(friendlyRoom.teamLives, [0, 1]);
writeFileSync('recovery/output/last-stand-consumer.json', JSON.stringify({
  status: 'PASS_QUALIFIED_LAST_STAND_FIXED_DEADLINE_HEAL_REJECTION_SINGLE_DEATH_RESPAWN_CONSUMER_SCOPE',
  fixture: 'Module-only deterministic clock and damage; no live network injection',
  deadline: 4000, finalDeath: 4000, respawnAt: 7000, foodConsumed: consumed,
  repeatedHitDeadlineUnchanged: true, healingSourcesRejected: true, singleDestroy: true,
  sourceExclusions: ['unlearned', 'wrongPet', 'withdrawn', 'dead'], departedKillerUnrewarded: true,
  soloVictoryAtFinalDeathOnly: true, friendlyTeamLivesAtFinalDeathOnly: true,
}, null, 2) + '\n');
console.log('PASS last stand source, fixed deadline, rejected healing, single death and respawn');
