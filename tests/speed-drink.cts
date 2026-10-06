import assert from 'node:assert/strict';
import {applySpeedDrink, advanceSpeedDrink, clearSpeedDrink}
  from '../apps/server/src/battle/items/speed-drink';
import type {SpeedDrinkParticipant} from '../apps/server/src/battle/items/speed-drink';
import {RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {combatItems, combatSkills} from '../apps/server/src/battle/catalog';
import type {MsgRoomEvent} from '../apps/shared/protocols';

function fixture() {
  const skills = new Int32Array(16);
  const player: SpeedDrinkParticipant = {id: 'p7', name: 'Owner', alive: true,
    attributesReady: true,
    x: 10, y: 2, z: 30, combat: new RoleCombatState({status: 2,
      flags: new Uint8Array(16), arrays: new Map([[4, skills]])}),
    inventory: [{instanceId: 77, itemTableId: 6, ownedQuantity: 4, battleQuantity: 3,
      state: 0, field8: 7, float24Bits: 0x7fc01234, float28Bits: 0x80000000,
      float2cBits: 0xffffffff}]};
  const events: MsgRoomEvent[] = [];
  let recomputes = 0;
  let commits = 0;
  const recompute = () => {recomputes++;};
  const consume = (id: string, instance: number, owned: number, table: number) => {
    assert.deepEqual([id, instance, owned, table], ['p7', 77, 4, 6]);
    assert.equal(player.speedBoost, undefined);
    assert(!skills.includes(6), 'Persistence happens before slot mutation');
    assert.equal(player.inventory[0].battleQuantity, 3);
    assert.equal(player.inventory[0].ownedQuantity, 4);
    assert.equal(recomputes, 0);
    commits++;
    return true;
  };
  const use = (commit = consume, now = 1000, kind = 'useItem', instanceId = 77) =>
    applySpeedDrink('room', player, {kind, instanceId}, now, recompute, commit, events);
  return {player, skills, events, recompute, use, counts: () => ({recomputes, commits})};
}

const source = combatSkills.get(6)!;
assert.equal(combatItems.get(6)!.battleUseMax, 5);
assert.equal(source.functions[0].type, 1);
assert.equal(source.functions[0].t, 10);
assert.equal(source.attributes.ItemMove, 6);
assert.equal(source.target, 1);
assert.equal(source.triggerType, 1);
assert.deepEqual(combatItems.get(6)!.skillIds, [6, 0, 0]);
assert.deepEqual(source.effects[0], {effectId: 110, sound: 'SE42', tag: 0, method: 3});

const missingSource = fixture();
missingSource.player.attributesReady = false;
const missingSourceItem = {...missingSource.player.inventory[0]};
missingSource.use();
assert.deepEqual(missingSource.counts(), {recomputes: 0, commits: 0});
assert.deepEqual(missingSource.player.inventory[0], missingSourceItem);
assert(!missingSource.skills.includes(6));
assert.equal(missingSource.player.speedBoost, undefined);
assert.equal(missingSource.events[0].type, 'itemRejected');

const recoveredSource = fixture();
recoveredSource.player.attributesReady = false;
recoveredSource.player.recoveredMovement = {speed: 9, turn: 2};
recoveredSource.use();
assert.deepEqual(recoveredSource.counts(), {recomputes: 1, commits: 1});

const qualificationCases: Array<(f: ReturnType<typeof fixture>) => void> = [
  f => {f.player.alive = false;},
  f => {f.player.combat.record!.status = 1;},
  f => {f.player.inventory[0].itemTableId = 3;},
  f => {f.player.inventory[0].ownedQuantity = 0;},
  f => {f.player.inventory[0].battleQuantity = 0;},
  f => {f.player.inventory = [];},
];
for (const configure of qualificationCases) {
  const f = fixture();
  configure(f);
  const inventoryBefore = f.player.inventory.map(item => ({...item}));
  f.player.combat.dirty = false;
  f.use();
  assert.deepEqual(f.counts(), {recomputes: 0, commits: 0});
  assert.equal(f.player.speedBoost, undefined);
  assert.equal(f.events.length, 0);
  assert.deepEqual(f.player.inventory, inventoryBefore);
  assert.deepEqual([...f.skills], new Array(16).fill(0));
  assert.equal(f.player.combat.dirty, false);
}
for (const [kind, instanceId] of [['placeTrap', 77], ['useItem', 78]] as const) {
  const f = fixture();
  f.use(undefined, 1000, kind, instanceId);
  assert.equal(f.counts().commits, 0);
}

for (const slots of [undefined, new Int32Array(15), new Int32Array(16).fill(9),
  Int32Array.from([6, ...new Array(15).fill(0)])]) {
  const f = fixture();
  if (slots) f.player.combat.record!.arrays.set(4, slots);
  else f.player.combat.record!.arrays.delete(4);
  f.use();
  assert.deepEqual(f.counts(), {recomputes: 0, commits: 0});
  assert.equal(f.player.inventory[0].ownedQuantity, 4);
  assert.equal(f.events[0].type, 'itemRejected');
}

for (const commit of [() => false, () => {throw new Error('Storage unavailable');}]) {
  const f = fixture();
  const itemBefore = {...f.player.inventory[0]};
  f.use(commit);
  assert.deepEqual(f.player.inventory[0], itemBefore);
  assert.equal(f.player.speedBoost, undefined);
  assert(!f.skills.includes(6));
  assert.equal(f.counts().recomputes, 0);
  assert.equal(f.events[0].type, 'itemRejected');
}

const f = fixture();
for (let index = 0; index < 15; index++) f.skills[index] = 100 + index;
const originalSkills = [...f.skills];
f.use();
assert.deepEqual(f.player.speedBoost,
  {skillId: 6, expiresAt: 11000, moveBonus: 6});
assert.deepEqual([...f.skills], [...originalSkills.slice(0, 15), 6]);
assert.deepEqual(f.counts(), {recomputes: 1, commits: 1});
assert.equal(f.player.inventory[0].ownedQuantity, 3);
assert.equal(f.player.inventory[0].battleQuantity, 2);
assert.deepEqual(f.events[0].playSkillEffect,
  {skillId: 6, effectIndex: 0, duration: 0, roleId: 7, xBits: 0, zBits: 0});
assert.equal(f.events[0].type, 'itemUsed');
assert.equal(f.events[0].targetId, f.player.id);
assert.equal(f.events[0].value, 0);
assert(f.events[0].message.includes(combatItems.get(6)!.name));

f.use();
assert.equal(f.events.at(-1)!.type, 'itemRejected');
assert.deepEqual(f.counts(), {recomputes: 1, commits: 1});
assert.equal(f.player.inventory[0].ownedQuantity, 3);
advanceSpeedDrink('room', f.player, 10999, f.recompute, f.events);
assert(f.player.speedBoost);
advanceSpeedDrink('room', f.player, 11000, f.recompute, f.events);
assert.equal(f.player.speedBoost, undefined);
assert.deepEqual([...f.skills], originalSkills, 'Expiry preserves all 15 unrelated occupied slots');
assert.deepEqual(f.events.at(-1)!.stopSkillEffect, {skillId: 6, roleId: 7});
assert.equal(f.counts().recomputes, 2);
const countAfterExpiry = f.events.length;
advanceSpeedDrink('room', f.player, 12000, f.recompute, f.events);
clearSpeedDrink(f.player, f.recompute);
assert.equal(f.events.length, countAfterExpiry);
assert.equal(f.counts().recomputes, 2);

const dead = fixture();
dead.use();
dead.player.alive = false;
advanceSpeedDrink('room', dead.player, 1001, dead.recompute, dead.events);
assert.equal(dead.player.speedBoost, undefined);
assert(!dead.skills.includes(6));
assert.equal(dead.counts().recomputes, 2);
assert.deepEqual(dead.events.at(-1)!.stopSkillEffect, {skillId: 6, roleId: 7});

const stateOnly = fixture();
stateOnly.player.speedBoost = {skillId: 6, expiresAt: 11000, moveBonus: 6};
stateOnly.use();
assert.deepEqual(stateOnly.counts(), {recomputes: 0, commits: 0});
assert.equal(stateOnly.player.inventory[0].ownedQuantity, 4);
assert.equal(stateOnly.events[0].type, 'itemRejected');

const capped = fixture();
capped.player.inventory[0].ownedQuantity = 8;
capped.player.inventory[0].battleQuantity = combatItems.get(6)!.battleUseMax;
let capCommits = 0;
const capConsume = () => {capCommits++; return true;};
for (let use = 0; use < 5; use++) {
  capped.use(capConsume, use * 10000);
  advanceSpeedDrink('room', capped.player, (use + 1) * 10000,
    capped.recompute, capped.events);
}
assert.equal(capped.player.inventory[0].ownedQuantity, 3);
assert.equal(capped.player.inventory[0].battleQuantity, 0);
assert.equal(capCommits, 5);
const eventsAtCap = capped.events.length;
capped.use(capConsume, 50000);
assert.equal(capCommits, 5);
assert.equal(capped.events.length, eventsAtCap);
assert.equal(capped.player.speedBoost, undefined);

const absentState = fixture();
absentState.skills[0] = 6;
clearSpeedDrink(absentState.player, absentState.recompute);
assert.equal(absentState.skills[0], 6, 'Unowned skill6 is outside temporary buff cleanup');
assert.equal(absentState.counts().recomputes, 0);

const shifted = fixture();
shifted.use();
shifted.player.combat.addSkill(50);
shifted.player.combat.addSkill(51);
clearSpeedDrink(shifted.player, shifted.recompute);
assert.deepEqual([...shifted.skills], [50, 51, ...new Array(14).fill(0)]);
console.log('PASS: speed drink source values, qualification, persistence ordering, nonstacking, skill capacity, expiry and death cleanup');
