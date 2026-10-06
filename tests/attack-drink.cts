import assert from 'node:assert/strict';
import {applyAttackDrink, advanceAttackDrink, clearAttackDrink, prototypeAttack}
  from '../apps/server/src/battle/items/attack-drink';
import type {AttackDrinkParticipant} from '../apps/server/src/battle/items/attack-drink';
import {RoleCombatState} from '../apps/server/src/battle/roles/combat-state';
import {combatItems, combatSkills} from '../apps/server/src/battle/catalog';
import type {MsgRoomEvent} from '../apps/shared/protocols';

function fixture() {
  const skills = new Int32Array(16);
  const player: AttackDrinkParticipant = {id: 'p7', name: 'Owner', alive: true,
    x: 10, y: 2, z: 30, combat: new RoleCombatState({status: 2,
      flags: new Uint8Array(16), arrays: new Map([[4, skills]])}),
    inventory: [{instanceId: 77, itemTableId: 4, ownedQuantity: 4, battleQuantity: 3,
      state: 0, field8: 7, float24Bits: 0x7fc01234, float28Bits: 0x80000000,
      float2cBits: 0xffffffff}]};
  const events: MsgRoomEvent[] = [];
  let recomputes = 0;
  let commits = 0;
  const recompute = () => {recomputes++;};
  const consume = (id: string, instance: number, owned: number, table: number) => {
    assert.deepEqual([id, instance, owned, table], ['p7', 77, 4, 4]);
    assert.equal(player.attackBoost, undefined);
    assert(!skills.includes(4), 'Persistence happens before slot mutation');
    assert.equal(player.inventory[0].battleQuantity, 3);
    assert.equal(recomputes, 0);
    commits++;
    return true;
  };
  const use = (commit = consume, now = 1000, kind = 'useItem', instanceId = 77) =>
    applyAttackDrink('room', player, {kind, instanceId}, now, recompute, commit, events);
  return {player, skills, events, recompute, use, counts: () => ({recomputes, commits})};
}

const source = combatSkills.get(4)!;
assert.equal(combatItems.get(4)!.battleUseMax, 5);
assert.equal(source.functions[0].type, 1);
assert.equal(source.functions[0].t, 10);
assert.equal(source.attributes.Atk, 100);
assert.equal(source.attributes.AtkBonus, 20);
assert.deepEqual(source.effects[0], {effectId: 106, sound: 'SE38', tag: 0, method: 3});

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
  assert.equal(f.player.attackBoost, undefined);
  assert.equal(f.events.length, 0);
}
for (const [kind, instanceId] of [['placeTrap', 77], ['useItem', 78]] as const) {
  const f = fixture();
  f.use(undefined, 1000, kind, instanceId);
  assert.equal(f.counts().commits, 0);
}

for (const slots of [undefined, new Int32Array(15), new Int32Array(16).fill(9),
  Int32Array.from([4, ...new Array(15).fill(0)])]) {
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
  assert.equal(f.player.attackBoost, undefined);
  assert(!f.skills.includes(4));
  assert.equal(f.counts().recomputes, 0);
  assert.equal(f.events[0].type, 'itemRejected');
}

const f = fixture();
for (let index = 0; index < 15; index++) f.skills[index] = 100 + index;
const originalSkills = [...f.skills];
f.use();
assert.deepEqual(f.player.attackBoost,
  {skillId: 4, expiresAt: 11000, attackPercent: 100, attackBonus: 20});
assert.deepEqual([...f.skills], [...originalSkills.slice(0, 15), 4]);
assert.deepEqual(f.counts(), {recomputes: 1, commits: 1});
assert.equal(f.player.inventory[0].ownedQuantity, 3);
assert.equal(f.player.inventory[0].battleQuantity, 2);
assert.deepEqual(f.events[0].playSkillEffect,
  {skillId: 4, effectIndex: 0, duration: 0, roleId: 7, xBits: 0, zBits: 0});
assert.equal(f.events[0].type, 'itemUsed');
assert.equal(f.events[0].targetId, f.player.id);
assert.equal(f.events[0].value, 0);
assert(f.events[0].message.includes(combatItems.get(4)!.name));
const tank = Object.freeze({attack: 100});
assert.equal(prototypeAttack(tank.attack), 100);
assert.equal(prototypeAttack(tank.attack, f.player.attackBoost), 220);
assert.equal(35 + .08 * prototypeAttack(tank.attack, f.player.attackBoost), 52.6);
assert.equal(tank.attack, 100);

f.use();
assert.equal(f.events.at(-1)!.type, 'itemRejected');
assert.deepEqual(f.counts(), {recomputes: 1, commits: 1});
assert.equal(f.player.inventory[0].ownedQuantity, 3);
advanceAttackDrink('room', f.player, 10999, f.recompute, f.events);
assert(f.player.attackBoost);
advanceAttackDrink('room', f.player, 11000, f.recompute, f.events);
assert.equal(f.player.attackBoost, undefined);
assert.deepEqual([...f.skills], originalSkills, 'Expiry preserves all 15 unrelated occupied slots');
assert.equal(prototypeAttack(tank.attack, f.player.attackBoost), 100);
assert.deepEqual(f.events.at(-1)!.stopSkillEffect, {skillId: 4, roleId: 7});
assert.equal(f.counts().recomputes, 2);
const countAfterExpiry = f.events.length;
advanceAttackDrink('room', f.player, 12000, f.recompute, f.events);
clearAttackDrink(f.player, f.recompute);
assert.equal(f.events.length, countAfterExpiry);
assert.equal(f.counts().recomputes, 2);

const dead = fixture();
dead.use();
dead.player.alive = false;
advanceAttackDrink('room', dead.player, 1001, dead.recompute, dead.events);
assert.equal(dead.player.attackBoost, undefined);
assert(!dead.skills.includes(4));
assert.equal(dead.counts().recomputes, 2);

const absentState = fixture();
absentState.skills[0] = 4;
clearAttackDrink(absentState.player, absentState.recompute);
assert.equal(absentState.skills[0], 4, 'Unowned skill4 is outside temporary buff cleanup');
assert.equal(absentState.counts().recomputes, 0);

const shifted = fixture();
shifted.use();
shifted.player.combat.addSkill(50);
shifted.player.combat.addSkill(51);
clearAttackDrink(shifted.player, shifted.recompute);
assert.deepEqual([...shifted.skills], [50, 51, ...new Array(14).fill(0)]);
console.log('PASS: attack drink source values, qualification, persistence ordering, nonstacking, skill capacity, prototype attack, expiry and death cleanup');
