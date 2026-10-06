import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {placeGroundTrap, advanceGroundTraps, clearGroundTraps} from '../apps/server/src/battle/items/ground-traps';
import {advanceOldBombs, readOldBombRule} from '../apps/server/src/battle/items/old-bomb';
import {damagePlayerDirectly, advanceLastStandDeath} from '../apps/server/src/battle/life';
import {applyTrapSweep} from '../apps/server/src/battle/items/trap-sweep-use';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {PlayerState} from '../apps/server/src/battle/player-state';
import type {RoomState} from '../apps/server/src/rooms/state';
import type {MsgRoomEvent} from '../apps/shared/protocols';

function player(id: string, x = 0, z = 0, hp = 700): PlayerState {
  const combat = createRoleCombatState(); combat.setStatus(2);
  return {id, name: id, team: 0, x, y: 0, z, hp, alive: true, score: 0, deaths: 0, kills: 0,
    respawnAt: 0, combat, attributesReady: false, attributes: {record: {hp, maxHp: 700}},
    inventory: [{instanceId: 1, itemTableId: 3001, ownedQuantity: 2, battleQuantity: 2,
      state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}]} as PlayerState;
}
function room(players: PlayerState[]): RoomState {
  return {roomId: 'bomb', mode: 4, phase: 'PLAYING', players: new Map(players.map(p => [p.id, p])),
    groundTraps: [], targetScore: 20, teamScores: [0, 0], teamLives: [2, 2],
    map: {brokenScore: -10, hitScore: 2, destroyScore: 10, respawnTime: 3}} as unknown as RoomState;
}
const rule = readOldBombRule();
assert.deepEqual(rule, {itemTableId: 3001, placementSkillId: 3001, explosionSkillId: 3009,
  damageSkillId: 3012, groundDurationMs: 5000, range: 200, damage: 300});
const owner = player('P1', 12, -8), edge = player('P2', 112, 92), outside = player('P3', 112.01, 92);
const protectedPlayer = player('P4', 12, -8); protectedPlayer.invincibility = {skillId: 8, expiresAt: 7000};
const battle = room([owner, edge, outside, protectedPlayer]);
const events: MsgRoomEvent[] = [];
let consumed = 0;
placeGroundTrap(battle, owner, {kind: 'placeTrap', instanceId: 1}, 1000, () => 'B1',
  (_id, _instance, owned, item) => {assert.equal(owned, 2); assert.equal(item, 3001); consumed++; return true;}, events);
assert.equal(consumed, 1); assert.equal(owner.inventory[0].ownedQuantity, 1);
assert.equal(owner.inventory[0].battleQuantity, 1);
assert.equal(battle.groundTraps[0].expiresAt, 6000);
const placed = events.find(e => e.type === 'trapPlaced')!;
assert.equal(placed.playSkillEffect!.roleId, 0);
const bits = new DataView(new ArrayBuffer(4)); bits.setUint32(0, placed.playSkillEffect!.xBits, true);
assert.equal(bits.getFloat32(0, true), 12);
advanceGroundTraps(battle, 5999, events);
const hit = (a: PlayerState, b: PlayerState, amount: number, skill: number) => {
  damagePlayerDirectly(battle, a, b, amount, 6000, skill, events);
};
advanceOldBombs(battle, 5999, events, hit);
assert.equal(edge.hp, 700); assert.equal(battle.groundTraps.length, 1);
// A dead owner retains the delayed object and its score attribution.
owner.alive = false; owner.combat.setStatus(3);
edge.defenseBoost = {skillId: 5, expiresAt: 9000, defensePercent: .9, defenseBonus: 1000,
  baseDefense: 1, boostedDefense: 1000, source: 'original-attributes'};
edge.armorReady = true; edge.recoveredArmor = {defensePercent: .9, defenseBonus: 1000,
  attackBase: 1, attackBonus: 0, attackPercent: 1, sideDefensePercent: .5, backDefensePercent: .5,
  selectedSkillIds: []};
advanceOldBombs(battle, 6000, events, hit);
assert.equal(edge.hp, 400); assert.equal(outside.hp, 700); assert.equal(owner.hp, 700);
assert.equal(protectedPlayer.hp, 700); assert.equal(owner.score, 2);
assert.equal(battle.groundTraps.length, 0);
assert.equal(events.filter(e => e.type === 'trapTriggered').length, 1);
assert.equal(events.filter(e => e.type === 'hit').length, 1);
assert.equal(events.find(e => e.type === 'hit')!.skillId, 3012);
assert(!events.find(e => e.type === 'hit')!.shotPlayerResult);
advanceOldBombs(battle, 8000, events, hit);
assert.equal(events.filter(e => e.type === 'trapTriggered').length, 1);

for (const failure of ['cas', 'save', 'empty', 'dead', 'waiting'] as const) {
  const p = player('rejected'); const r = room([p]); const rows: MsgRoomEvent[] = [];
  if (failure === 'empty') p.inventory[0].ownedQuantity = 0;
  if (failure === 'dead') p.alive = false;
  if (failure === 'waiting') r.phase = 'WAITING';
  const quantity = p.inventory[0].ownedQuantity;
  placeGroundTrap(r, p, {kind: 'placeTrap', instanceId: 1}, 0, () => 'never', () => {
    if (failure === 'save') throw new Error('database failure');
    return false;
  }, rows);
  assert.equal(r.groundTraps.length, 0); assert.equal(p.inventory[0].ownedQuantity, quantity);
  assert(!rows.some(e => e.type === 'trapPlaced'));
}

const friendlyOwner = player('friend1'), friend = player('friend2', 1, 1);
const friendlyRoom = room([friendlyOwner, friend]); friendlyRoom.mode = 1; friendlyRoom.friendlyFire = true;
damagePlayerDirectly(friendlyRoom, friendlyOwner, friend, 300, 1000, 3012, []);
assert.equal(friend.hp, 700); assert.equal(friendlyOwner.score, 0);
const lethal = player('lethal', 1, 1, 100);
const deathRoom = room([friendlyOwner, lethal]);
damagePlayerDirectly(deathRoom, friendlyOwner, lethal, 300, 1000, 3012, events);
assert.equal(lethal.hp, 0); assert.equal(lethal.alive, false); assert.equal(lethal.deaths, 1);
assert.equal(lethal.respawnAt, 4000); assert.equal(friendlyOwner.kills, 1);
damagePlayerDirectly(deathRoom, friendlyOwner, lethal, 300, 2000, 3012, events);
assert.equal(lethal.deaths, 1); assert.equal(friendlyOwner.kills, 1);
const last = player('last', 1, 1, 100);
last.attributesReady = true;
last.ownedRoles = {snapshot: () => ({base: {fields: new Map([[0x50, 10441], [0x68, 1]])}}),
  tables: () => ({pet: {id: 4}})} as unknown as PlayerState['ownedRoles'];
damagePlayerDirectly(deathRoom, friendlyOwner, last, 300, 1000, 3012, events);
assert.equal(last.hp, 0); assert.equal(last.alive, true); assert.equal(last.lastStand!.expiresAt, 4000);
damagePlayerDirectly(deathRoom, friendlyOwner, last, 300, 2000, 3012, events);
assert.equal(last.lastStand!.expiresAt, 4000);
advanceLastStandDeath(deathRoom, last, friendlyOwner, 4000, events);
assert.equal(last.alive, false); assert.equal(last.deaths, 1);

const sweeper = player('sweep'); const sweepRoom = room([sweeper]);
placeGroundTrap(sweepRoom, sweeper, {kind: 'placeTrap', instanceId: 1}, 0, () => 'swept', () => true, []);
sweeper.inventory.push({...sweeper.inventory[0], instanceId: 2, itemTableId: 12});
applyTrapSweep(sweepRoom, sweeper, {kind: 'useItem', instanceId: 2}, 1000, () => true, events);
assert.equal(sweepRoom.groundTraps.length, 0);
placeGroundTrap(sweepRoom, sweeper, {kind: 'placeTrap', instanceId: 1}, 1000, () => 'cleared', () => true, []);
clearGroundTraps(sweepRoom); assert.equal(sweepRoom.groundTraps.length, 0);

const finisher = player('finish'), victim = player('victim', 0, 0, 100), survivor = player('survivor');
const finishRoom = room([finisher, victim, survivor]);
placeGroundTrap(finishRoom, finisher, {kind: 'placeTrap', instanceId: 1}, 0, () => 'finish', () => true, []);
advanceOldBombs(finishRoom, 5000, [], (a, b, amount, skill) => {
  damagePlayerDirectly(finishRoom, a, b, amount, 5000, skill, []);
  finishRoom.phase = 'FINISHED'; clearGroundTraps(finishRoom);
});
assert.equal(survivor.hp, 700); assert.equal(finishRoom.groundTraps.length, 0);
writeFileSync('recovery/output/old-bomb-consumer.json', JSON.stringify({
  status: 'PASS_OLD_BOMB_DURABLE_PLACEMENT_FIXED_DELAY_SQUARE_DIRECT_HP_LIFE_AND_CLEANUP_SCOPE',
  rule, fixtureScope: 'Module participants and mocked persistence; not ordinary network or GPU proof',
  beforeDeadlineNoHit: true, closedCornerHit: true, outsideExcluded: true, deadOwnerRetained: true,
  selfFriendlyImmuneExcluded: true, defenseBypassed: true, oneExplosion: true,
  failedConsumptionUnchanged: true, lastStandFixed: true, singleDeath: true,
  sweepClears: true, finishStopsRemainingTargets: true,
}, null, 2) + '\n');
console.log('PASS old bomb placement, timer, direct HP, last stand and cleanup');
