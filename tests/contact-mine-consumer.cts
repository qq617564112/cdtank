import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {advanceContactMines, readContactMineRule} from '../apps/server/src/battle/items/contact-mine';
import {placeGroundTrap, advanceGroundTraps} from '../apps/server/src/battle/items/ground-traps';
import {damagePlayerDirectly} from '../apps/server/src/battle/life';
import {selectSweepTraps} from '../apps/server/src/battle/items/trap-sweep';
import {createRoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import type {PlayerState} from '../apps/server/src/battle/player-state';
import type {RoomState} from '../apps/server/src/rooms/state';
import type {MsgRoomEvent} from '../apps/shared/protocols';

function player(id: string, x = 0, z = 0, hp = 700): PlayerState {
  const combat = createRoleCombatState(); combat.setStatus(2);
  return {id, name: id, team: 0, x, y: 0, z, hp, alive: true, score: 0, deaths: 0, kills: 0,
    respawnAt: 0, combat, attributesReady: false, attributes: {record: {hp, maxHp: 700}},
    inventory: [{instanceId: 1, itemTableId: 3002, ownedQuantity: 2, battleQuantity: 2,
      state: 0, field8: 0, float24Bits: 0, float28Bits: 0, float2cBits: 0}]} as PlayerState;
}
function room(players: PlayerState[]): RoomState {
  return {roomId: 'mine', mode: 4, phase: 'PLAYING', players: new Map(players.map(p => [p.id, p])),
    groundTraps: [], targetScore: 20, teamScores: [0, 0], teamLives: [2, 2],
    map: {brokenScore: -10, hitScore: 2, destroyScore: 10, respawnTime: 3}} as unknown as RoomState;
}
function place(r: RoomState, owner: PlayerState, events: MsgRoomEvent[], now = 1000) {
  placeGroundTrap(r, owner, {kind: 'placeTrap', instanceId: 1}, now, () => 'M1',
    (_id, _instance, owned, item) => {assert(owned > 0); assert.equal(item, 3002); return true;}, events);
}
assert.deepEqual(readContactMineRule(), {itemTableId: 3002, placementSkillId: 3002,
  effectSkillId: 4023, groundDurationMs: 30000, triggerRadius: 30, damage: 300});
const owner = player('P1'), outside = player('P2', 30.01), immune = player('P3', 20), edge = player('P4', 18, 24), second = player('P5', 1);
immune.invincibility = {skillId: 8, expiresAt: 9000};
const r = room([owner, outside, immune, edge, second]), events: MsgRoomEvent[] = [];
place(r, owner, events); assert.equal(owner.inventory[0].ownedQuantity, 1);
assert.equal(events.find(e => e.type === 'trapPlaced')!.playSkillEffect!.roleId, 1);
assert.equal(r.groundTraps[0].expiresAt, 31000);
advanceGroundTraps(r, 1001, events); assert.equal(r.groundTraps.length, 1);
assert.equal(selectSweepTraps(r.groundTraps, {x: 399, z: 0}, 1001, 400).length, 1);
owner.alive = false; owner.combat.setStatus(3);
const hit = (a: PlayerState, b: PlayerState, amount: number, skill: number) => damagePlayerDirectly(r, a, b, amount, 1001, skill, events);
advanceContactMines(r, 1001, events, hit);
assert.equal(edge.hp, 400); assert.equal(outside.hp, 700); assert.equal(immune.hp, 700); assert.equal(second.hp, 700); assert.equal(owner.hp, 700);
assert.equal(r.groundTraps.length, 0); assert.equal(events.filter(e => e.type === 'hit').length, 1);
const triggered = events.find(e => e.type === 'trapTriggered')!;
assert.equal(triggered.skillId, 4023); assert.equal(triggered.playSkillEffect!.roleId, 4);
assert.equal(events.find(e => e.type === 'hit')!.value, 300); assert(!events.find(e => e.type === 'hit')!.shotPlayerResult);
advanceContactMines(r, 1002, events, hit); assert.equal(events.filter(e => e.type === 'hit').length, 1);
for (const gate of ['self', 'friendly', 'immune', 'pending', 'expired'] as const) {
  const a = player('P1'), b = player('P2', 1), rr = room([a, b]), rows: MsgRoomEvent[] = [];
  if (gate === 'self') rr.players.delete(b.id);
  if (gate === 'friendly') rr.mode = 1;
  if (gate === 'immune') b.invincibility = {skillId: 8, expiresAt: 32000};
  if (gate === 'pending') b.hp = 0;
  place(rr, a, rows);
  advanceContactMines(rr, gate === 'expired' ? 31000 : 1001, rows, () => assert.fail('Ineligible contact'));
  assert.equal(rr.groundTraps.length, gate === 'expired' ? 0 : 1);
}
const killer = player('P1'), target = player('P2', 1, 0, 100), lethalRoom = room([killer, target]), lethalEvents: MsgRoomEvent[] = [];
place(lethalRoom, killer, lethalEvents);
advanceContactMines(lethalRoom, 1001, lethalEvents, (a, b, amount, skill) => damagePlayerDirectly(lethalRoom, a, b, amount, 1001, skill, lethalEvents));
assert.equal(target.hp, 0); assert.equal(target.alive, false); assert.equal(target.deaths, 1); assert.equal(killer.kills, 1); assert.equal(target.respawnAt, 4001);
advanceContactMines(lethalRoom, 1002, lethalEvents, () => assert.fail('Consumed mine'));
for (const gate of ['cas', 'empty', 'waiting'] as const) {
  const a = player('P1'), rr = room([a]), rows: MsgRoomEvent[] = [];
  if (gate === 'empty') a.inventory[0].ownedQuantity = 0;
  if (gate === 'waiting') rr.phase = 'WAITING';
  const before = a.inventory[0].ownedQuantity;
  placeGroundTrap(rr, a, {kind: 'placeTrap', instanceId: 1}, 1000, () => 'never', () => false, rows);
  assert.equal(a.inventory[0].ownedQuantity, before); assert.equal(rr.groundTraps.length, 0);
}
writeFileSync('recovery/output/contact-mine-consumer.json', JSON.stringify({status: 'PASS_CONTACT_MINE_ENGINEERING_SOURCE_PLACEMENT_SINGLE_CONTACT_DIRECT_HP_LIFE_GATES_SCOPE',
  scope: 'Direct consumer fixtures, not ordinary realtime network or browser', sourceDamageSkill: 4023, damage: 300,
  boundaryContactOnce: true, expiryBeforeContact: true, immuneSelfFriendlyPendingExcluded: true,
  deadOwnerRetainsObject: true, lethalSingleSettlement: true, sweepIncludesMine: true,
  placementCasAndStockGates: true, roleEffects: {placement: 1, contact: 4}}, null, 2) + '\n');
console.log('PASS contact mine consumer placement, single contact, direct life, eligibility and expiry');
