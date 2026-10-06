import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {AccountStore} from '../apps/server/src/account-store';
import {applyDefenseDrink, advanceDefenseDrink, clearDefenseDrink, defenseAdjustedDamage}
  from '../apps/server/src/battle/items/defense-drink';
import type {DefenseDrinkParticipant} from '../apps/server/src/battle/items/defense-drink';
import {RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {combatItems, combatSkills} from '../apps/server/src/battle/catalog';
import type {MsgRoomEvent} from '../apps/shared/protocols';

function fixture() {
  const skills = new Int32Array(16);
  const player: DefenseDrinkParticipant = {id: 'p7', name: 'Owner', alive: true,
    x: 10, y: 2, z: 30, tank: {defense: 100}, combat: new RoleCombatState({status: 2,
      flags: new Uint8Array(16), arrays: new Map([[4, skills]])}),
    inventory: [{instanceId: 77, itemTableId: 5, ownedQuantity: 4, battleQuantity: 3,
      state: 0, field8: 7, float24Bits: 0x7fc01234, float28Bits: 0x80000000,
      float2cBits: 0xffffffff}]};
  const events: MsgRoomEvent[] = [];
  let recomputes = 0;
  let commits = 0;
  const recompute = () => {recomputes++;};
  const consume = (id: string, instance: number, owned: number, table: number) => {
    assert.deepEqual([id, instance, owned, table], ['p7', 77, 4, 5]);
    assert.equal(player.defenseBoost, undefined);
    assert(!skills.includes(5), 'Persistence happens before slot mutation');
    assert.equal(player.inventory[0].battleQuantity, 3);
    assert.equal(recomputes, 0);
    commits++;
    return true;
  };
  const use = (commit = consume, now = 1000, kind = 'useItem', instanceId = 77) =>
    applyDefenseDrink('room', player, {kind, instanceId}, now, recompute, commit, events);
  return {player, skills, events, recompute, use, counts: () => ({recomputes, commits})};
}

const source = combatSkills.get(5)!;
assert.equal(combatItems.get(5)!.battleUseMax, 5);
assert.equal(source.functions[0].type, 1);
assert.equal(source.functions[0].t, 10);
assert.equal(source.attributes.Def, 30);
assert.equal(source.attributes.DefBonus, 20);
assert.deepEqual(source.effects[0], {effectId: 108, sound: 'SE40', tag: 0, method: 3});

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
  f.use();
  assert.deepEqual(f.counts(), {recomputes: 0, commits: 0});
  assert.equal(f.player.defenseBoost, undefined);
  assert.equal(f.events.length, 0);
}
for (const [kind, instanceId] of [['placeTrap', 77], ['useItem', 78]] as const) {
  const f = fixture();
  f.use(undefined, 1000, kind, instanceId);
  assert.equal(f.counts().commits, 0);
}

for (const slots of [undefined, new Int32Array(15), new Int32Array(16).fill(9),
  Int32Array.from([5, ...new Array(15).fill(0)])]) {
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
  assert.equal(f.player.defenseBoost, undefined);
  assert(!f.skills.includes(5));
  assert.equal(f.counts().recomputes, 0);
  assert.equal(f.events[0].type, 'itemRejected');
}

// Independent armor qualifies the existing rebuilt mitigation without full HP attributes.
{
  const independent = fixture();
  independent.player.attributesReady = false;
  independent.player.armorReady = true;
  independent.player.recoveredArmor = {defensePercent: .25, defenseBonus: 4};
  applyDefenseDrink('room', independent.player, {kind: 'useItem', instanceId: 77}, 1000,
    () => {independent.player.recoveredArmor = {defensePercent: .55, defenseBonus: 24};},
    undefined, independent.events);
  assert.equal(independent.player.defenseBoost?.source, 'original-attributes');
  assert.equal(independent.player.defenseBoost?.baseDefense, 4.25);
  assert.equal(independent.player.defenseBoost?.boostedDefense, 24.55);
}

const f = fixture();
for (let index = 0; index < 15; index++) f.skills[index] = 100 + index;
const originalSkills = [...f.skills];
f.use();
assert.deepEqual(f.player.defenseBoost,
  {skillId: 5, expiresAt: 11000, defensePercent: 30, defenseBonus: 20, baseDefense: 100, boostedDefense: 150, source: 'rebuilt-tank'});
assert.deepEqual([...f.skills], [...originalSkills.slice(0, 15), 5]);
assert.deepEqual(f.counts(), {recomputes: 1, commits: 1});
assert.equal(f.player.inventory[0].ownedQuantity, 3);
assert.equal(f.player.inventory[0].battleQuantity, 2);
assert.deepEqual(f.events[0].playSkillEffect,
  {skillId: 5, effectIndex: 0, duration: 0, roleId: 7, xBits: 0, zBits: 0});
assert.equal(f.events[0].type, 'itemUsed');
assert.equal(f.events[0].targetId, f.player.id);
assert.equal(f.events[0].value, 0);
assert(f.events[0].message.includes(combatItems.get(5)!.name));
assert.equal(defenseAdjustedDamage(43, undefined, 1000), 43);
assert.equal(defenseAdjustedDamage(50, f.player.defenseBoost, 1000), 40);
assert.equal(f.player.tank.defense, 100);

f.use();
assert.equal(f.events.at(-1)!.type, 'itemRejected');
assert.deepEqual(f.counts(), {recomputes: 1, commits: 1});
assert.equal(f.player.inventory[0].ownedQuantity, 3);
advanceDefenseDrink('room', f.player, 10999, f.recompute, f.events);
assert(f.player.defenseBoost);
advanceDefenseDrink('room', f.player, 11000, f.recompute, f.events);
assert.equal(f.player.defenseBoost, undefined);
assert.deepEqual([...f.skills], originalSkills, 'Expiry preserves all 15 unrelated occupied slots');
assert.equal(defenseAdjustedDamage(43, f.player.defenseBoost, 11000), 43);
assert.deepEqual(f.events.at(-1)!.stopSkillEffect, {skillId: 5, roleId: 7});
assert.equal(f.counts().recomputes, 2);
const countAfterExpiry = f.events.length;
advanceDefenseDrink('room', f.player, 12000, f.recompute, f.events);
clearDefenseDrink(f.player, f.recompute);
assert.equal(f.events.length, countAfterExpiry);
assert.equal(f.counts().recomputes, 2);

const dead = fixture();
dead.use();
dead.player.alive = false;
advanceDefenseDrink('room', dead.player, 1001, dead.recompute, dead.events);
assert.equal(dead.player.defenseBoost, undefined);
assert(!dead.skills.includes(5));
assert.equal(dead.counts().recomputes, 2);

const absentState = fixture();
absentState.skills[0] = 5;
clearDefenseDrink(absentState.player, absentState.recompute);
assert.equal(absentState.skills[0], 5, 'Unowned skill5 is outside temporary buff cleanup');
assert.equal(absentState.counts().recomputes, 0);

const shifted = fixture();
shifted.use();
for (const skillId of [4, 6, 7, 8, 11]) shifted.player.combat.addSkill(skillId);
clearDefenseDrink(shifted.player, shifted.recompute);
assert.deepEqual([...shifted.skills], [4, 6, 7, 8, 11, ...new Array(11).fill(0)]);

assert.equal(source.target, 1);
assert.equal(source.triggerType, 1);
assert.equal(source.effects[1].effectId, 10);
assert.equal(source.effects[1].sound, 'SE02');
assert.equal(f.events.filter(event => event.playSkillEffect).length, 1);

const original = fixture();
original.player.attributesReady = true;
original.player.attributes = {values: {
  roleFloats: new Map([[0x7c, .4]]), roleIntegers: new Map([[0x88, 12]])}};
const originalValues = original.player.attributes.values!;
applyDefenseDrink('room', original.player, {kind: 'useItem', instanceId: 77}, 2000, () => {
  assert(original.skills.includes(5));
  originalValues.roleFloats.set(0x7c, .7);
  originalValues.roleIntegers.set(0x88, 32);
}, undefined, original.events);
assert.deepEqual(original.player.defenseBoost, {skillId: 5, expiresAt: 12000,
  defensePercent: 30, defenseBonus: 20, baseDefense: 12.4, boostedDefense: 32.7,
  source: 'original-attributes'});
assert.equal(defenseAdjustedDamage(43, original.player.defenseBoost, 2000),
  43 * (100 + 12.4) / (100 + 32.7));
assert.equal(defenseAdjustedDamage(43, original.player.defenseBoost, 12000), 43);

for (const configure of [
  (p: DefenseDrinkParticipant) => {p.attributesReady = false;},
  (p: DefenseDrinkParticipant) => {p.attributes!.values!.roleIntegers.delete(0x88);},
  (p: DefenseDrinkParticipant) => {p.attributes!.values!.roleFloats.set(0x7c, NaN);},
]) {
  const incomplete = fixture();
  incomplete.player.attributesReady = true;
  incomplete.player.attributes = {values: {roleFloats: new Map([[0x7c, 0]]),
    roleIntegers: new Map([[0x88, 0]])}};
  configure(incomplete.player);
  incomplete.use();
  assert.equal(incomplete.player.defenseBoost!.source, 'rebuilt-tank');
  assert.equal(incomplete.player.defenseBoost!.boostedDefense, 150);
}
const afterMissing = fixture();
afterMissing.player.attributesReady = true;
afterMissing.player.attributes = {values: {roleFloats: new Map([[0x7c, 2]]),
  roleIntegers: new Map([[0x88, 10]])}};
applyDefenseDrink('room', afterMissing.player, {kind: 'useItem', instanceId: 77}, 1000,
  () => {delete afterMissing.player.attributes!.values;}, undefined, afterMissing.events);
assert.equal(afterMissing.player.defenseBoost!.source, 'rebuilt-tank');
assert.equal(afterMissing.player.defenseBoost!.baseDefense, 100);

const clamped = fixture();
clamped.player.attributesReady = true;
clamped.player.attributes = {values: {roleFloats: new Map([[0x7c, -2]]),
  roleIntegers: new Map([[0x88, -10]])}};
clamped.use();
assert.equal(clamped.player.defenseBoost!.baseDefense, 0);
assert.equal(clamped.player.defenseBoost!.boostedDefense, 0);
assert.equal(defenseAdjustedDamage(50, clamped.player.defenseBoost, 1000), 50);
assert.equal(defenseAdjustedDamage(50, {skillId: 5,
  expiresAt: 12000, defensePercent: 30, defenseBonus: 20, baseDefense: 100,
  boostedDefense: 20, source: 'rebuilt-tank'}, 1000), 50);

const fractional = fixture();
fractional.player.tank.defense = 12.3;
fractional.use();
assert.equal(fractional.player.defenseBoost!.boostedDefense, Math.fround(12.3 * 1.3 + 20));
assert.equal(defenseAdjustedDamage(NaN, fractional.player.defenseBoost, 1000), NaN);
assert.equal(defenseAdjustedDamage(43, {...fractional.player.defenseBoost!, boostedDefense: NaN}, 1000), 43);

const directory = mkdtempSync(join(tmpdir(), 'cdtank-defense-drink-'));
const path = join(directory, 'accounts.sqlite');
const store = new AccountStore(path);
const database = new DatabaseSync(path);
try {
  const owner = store.open();
  const other = store.open();
  const saved = fixture();
  const record = {...saved.player.inventory[0]};
  store.replaceInventory(owner.accountId, [record]);
  store.replaceInventory(other.accountId, [record]);
  const consume = (_id: string, instance: number, owned: number, table: number) =>
    store.consumeItem(owner.accountId, instance, owned, table);
  saved.player.inventory[0].ownedQuantity = 3;
  saved.use(consume);
  assert.equal(saved.events.at(-1)!.type, 'itemRejected');
  assert.equal(saved.player.defenseBoost, undefined);
  assert(!saved.skills.includes(5));
  assert.deepEqual(store.inventory(owner.accountId).records, [record]);
  saved.player.inventory[0].ownedQuantity = 4;
  database.exec(`CREATE TRIGGER reject_defense BEFORE UPDATE ON inventory
    BEGIN SELECT RAISE(ABORT, 'save failed'); END`);
  saved.use(consume);
  assert.equal(saved.events.at(-1)!.type, 'itemRejected');
  assert.deepEqual(saved.player.inventory, [record]);
  assert.equal(saved.player.defenseBoost, undefined);
  assert(!saved.skills.includes(5));
  assert.equal(saved.counts().recomputes, 0);
  assert.deepEqual(store.inventory(owner.accountId).records, [record]);
  database.exec('DROP TRIGGER reject_defense');
  saved.use(consume);
  assert.equal(saved.player.inventory[0].ownedQuantity, 3);
  assert.equal(saved.player.inventory[0].battleQuantity, 2);
  assert.deepEqual(store.inventory(owner.accountId).records, [{...record, ownedQuantity: 3}]);
  assert.deepEqual(store.inventory(other.accountId).records, [record]);
} finally {
  database.close();
  store.close();
  rmSync(directory, {recursive: true, force: true});
}
console.log('PASS: defense drink source, slot0 effect, qualification, real CAS/rollback, original totals, fallback, mitigation, expiry and owned-skill cleanup');
