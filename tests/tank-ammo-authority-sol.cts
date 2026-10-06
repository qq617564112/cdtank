import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {createBattlePlayer} from '../apps/server/src/battle/create-player';
import {recomputeBattleAttributes} from '../apps/server/src/battle/attributes';
import {combatLimits} from '../apps/server/src/battle/catalog';
import {applyRoleFireReloadNotification} from '../apps/server/src/battle/roles/reload';
import {advanceDefaultAmmoMagazine, consumeDefaultAmmoMagazine} from '../apps/server/src/battle/roles/ammo-magazine';
import {confirmAcceptedAmmoSelection, resetConfirmedAmmo} from '../apps/server/src/battle/items/ammo-confirmation';
const fixture = JSON.parse(readFileSync('recovery/output/world-role-attributes-native.json', 'utf8')).rows[0];
const clamp = (value: number, id: number): number => {
  const limit = combatLimits.get(id)!;
  return Math.max(limit.lower, Math.min(limit.upper, value));
};
const input = {sequence: 0, move: 0, turn: 0, aim: 0, fire: false, useItem: 0, clientTime: 0};
const rows: unknown[] = [];
for (const tank of TANKS) {
  const player = createBattlePlayer(`tank${tank.id}`, '', 'test', tank, 1, {x: 0, y: 0, z: 0, yaw: 0}, input);
  const base = new Map<number, number>(Object.keys(fixture.base).map(key => [+key, 0]));
  base.set(0, 73); base.set(8, 1); base.set(0x2c, 600);
  const equipment = new Map<number, number>(Object.keys(fixture.equipment).map(key => [+key, 0]));
  equipment.set(0x1c, 74); equipment.set(0x24, tank.id); equipment.set(0x58, 2001);
  player.ownedRoles.replace({base: {name: '', fields: base}, equipment: {name: '', fields: equipment}});
  recomputeBattleAttributes(player);
  assert(player.attributesReady);
  if (tank.id === 1) {assert.equal(tank.recomputeBase.field90, 0); assert.equal(tank.recomputeBase.reloadDuration, 0);}
  const skills = () => [...player.combat.record!.arrays.get(4)!].filter(Boolean);
  assert.deepEqual(skills(), [2001, 4020]);
  const normal = Math.fround(clamp(tank.recomputeBase.reloadDuration + 17, 16) * Math.fround(.1));
  const last = Math.fround(clamp(tank.recomputeBase.reloadDuration + 17, 16) * Math.fround(.1) * 100 * Math.fround(.03));
  const capacity = clamp(tank.recomputeBase.field90 + 6, 17);
  assert.equal(player.combat.maxBulletCount, capacity);
  assert.equal(player.combat.bulletCount, capacity);
  assert.equal(player.combat.roleFloatFields.get(0x50), normal);
  assert.equal(player.combat.roleFloatFields.get(0x54), last);
  const pet = PET_BASES.find(pet => pet.id === 1)!;
  const mastery = Math.max(1, [pet.field7c, pet.field80, pet.field84, pet.field88][tank.recomputeBase.tankType - 1] - 1);
  assert.equal(player.attributes.record.move, 50 + 10 * (mastery + clamp(tank.recomputeBase.field84, 14) - 3));
  assert(Math.abs(player.attributes.record.turn - (11 + 4 * (mastery + clamp(tank.recomputeBase.field88, 15) - 3)) * Math.PI / 180) < .000001);
  const durations: number[] = [];
  let current = 0;
  for (let remaining = capacity; remaining > 0; remaining--) {
    assert.equal(player.combat.bulletCount, remaining);
    applyRoleFireReloadNotification({local: true, bulletCount: remaining, normalSeconds: normal,
      lastBulletSeconds: last, currentSeconds: () => current}, player.combat,
    {duration: duration => durations.push(duration), forwarded: () => {}});
    assert(consumeDefaultAmmoMagazine(player.combat));
    current = player.combat.nextAvailableSeconds;
  }
  assert.equal(durations.at(-1), last);
  assert(durations.slice(0, -1).every(duration => duration === normal));
  assert.equal(player.combat.bulletCount, 0);
  assert(!consumeDefaultAmmoMagazine(player.combat));
  advanceDefaultAmmoMagazine(player.combat, current - .001, player.magazineReady === true);
  assert.equal(player.combat.bulletCount, 0);
  player.combat.dirty = true;
  advanceDefaultAmmoMagazine(player.combat, current, false);
  assert.equal(player.combat.bulletCount, 0);
  advanceDefaultAmmoMagazine(player.combat, current, player.magazineReady === true);
  assert.equal(player.combat.dirty, true);
  assert.equal(player.combat.bulletCount, capacity);
  assert(consumeDefaultAmmoMagazine(player.combat));
  player.combat.setArray(0, [77]);
  const special = {instanceId: 77, itemTableId: 2007, ownedQuantity: 3, battleQuantity: 3};
  assert(confirmAcceptedAmmoSelection(player.combat, [special], 2));
  recomputeBattleAttributes(player);
  assert.deepEqual(skills(), [2007, 4005]);
  const beforeSpecial = player.combat.bulletCount;
  assert(consumeDefaultAmmoMagazine(player.combat));
  assert.equal(player.combat.bulletCount, beforeSpecial);
  assert.equal(beforeSpecial, 3);
  advanceDefaultAmmoMagazine(player.combat, current + 100, player.magazineReady === true);
  assert.equal(player.combat.bulletCount, beforeSpecial);
  assert(confirmAcceptedAmmoSelection(player.combat, [], 1));
  recomputeBattleAttributes(player);
  assert.deepEqual(skills(), [2001, 4020]);
  assert.equal(player.combat.bulletCount, capacity - 1);
  recomputeBattleAttributes(player);
  assert.deepEqual(skills(), [2001, 4020]);
  resetConfirmedAmmo(player.combat);
  recomputeBattleAttributes(player);
  assert.equal(player.combat.bulletCount, capacity);
  rows.push({tankId: tank.id, capacity, normal, last, move: player.attributes.record.move, turn: player.attributes.record.turn});
}
assert.equal(rows.length, 21);
// A full live skill array rejects ammo installation without evicting equipment skills.
const full = createBattlePlayer('full', '', 'full', TANKS[0], 1, {x: 0, y: 0, z: 0, yaw: 0}, input);
const occupied = Array.from({length: 16}, (_, index) => 10000 + index);
full.combat.setArray(4, occupied);
assert(!confirmAcceptedAmmoSelection(full.combat, [], 1));
assert.deepEqual([...full.combat.record!.arrays.get(4)!], occupied);

const overlap = createBattlePlayer('overlap', '', 'overlap', TANKS[0], 1, {x: 0, y: 0, z: 0, yaw: 0}, input);
overlap.combat.setArray(4, [2001, 12345]);
assert(confirmAcceptedAmmoSelection(overlap.combat, [], 1));
overlap.combat.setArray(0, [77]);
assert(confirmAcceptedAmmoSelection(overlap.combat, [{instanceId: 77, itemTableId: 2007, ownedQuantity: 3, battleQuantity: 3}], 2));
assert.deepEqual([...overlap.combat.record!.arrays.get(4)!].filter(Boolean), [2001, 12345, 2007, 4005]);

writeFileSync('recovery/output/tank-ammo-authority-sol.json', JSON.stringify({status: 'PASS', rows,
  scope: 'Original numeric consumers, rebuilt ammo installation and ordinary magazine authority; no original server producer claim.'}, null, 2));
console.log('PASS: 21 tanks select real ammo skills, recompute original movement/reload/capacity, exhaust/refill and switch without duplicating ammo contributions');

