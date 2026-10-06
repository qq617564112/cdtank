import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createBattlePlayer} from '../apps/server/src/battle/create-player';
import {recomputeBattleAttributes} from '../apps/server/src/battle/attributes';
import {recomputeQualifiedRoleArmor} from '../apps/server/src/battle/roles/recompute-armor';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';

const capturePath = 'recovery/output/tank-purchased-movement-network-2026-10-04T16-14-09-828Z.json';
const capture = JSON.parse(readFileSync(capturePath, 'utf8')) as {
  purchases: {tank: {purchased: {name: string; fields: [number, number][]}};
    pet: {purchased: {name: string; fields: [number, number][]}}};
};
const tank = TANKS.find(tank => tank.id === 3)!, pet = PET_BASES.find(pet => pet.id === 2)!;
const fields = new Map(capture.purchases.tank.purchased.fields);
const expected = recomputeQualifiedRoleArmor({tank: tank.recomputeBase, tankType: tank.recomputeBase.tankType,
  pet, ownedField34: fields.get(0x34), ownedAtk: fields.get(0x3c), ownedAtkBonus: fields.get(0x40),
  ownedDef: fields.get(0x4c), ownedDefBonus: fields.get(0x50), sources: {
    currentSkillIds: combatItemSkills.get(2001)!.skillIds, extraSkill: {baseId: 0, rank: 0},
    itemIds: [0x58, 0x5c, 0x60].map(offset => fields.get(offset)!)},
  skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0})!;
assert(expected);
const cases = ['complete', 'hp', 'critical', 'lucky', 'allUnrelated', 'field34',
  'attack', 'attackBonus', 'defense', 'defenseBonus', 'pet', 'tankMismatch', 'itemSource', 'withdrawn'] as const;
const rows = [];
for (const vip of [false, true]) {
  for (const absent of cases) {
    const player = createBattlePlayer('local-rule-only', '', 'local-rule-only', tank, 0,
      {x: 0, y: 0, z: 0, yaw: 0}, {sequence: 0, move: 0, turn: 0, aim: 0,
        fire: false, useItem: 0, clientTime: 0});
    const base = {name: capture.purchases.pet.purchased.name, fields: new Map(capture.purchases.pet.purchased.fields)};
    const equipment = {name: capture.purchases.tank.purchased.name, fields: new Map(capture.purchases.tank.purchased.fields)};
    // These sparse copies never enter an Account or active multiplayer room.
    if (absent === 'hp' || absent === 'allUnrelated') base.fields.delete(0x2c);
    if (absent === 'critical' || absent === 'allUnrelated') base.fields.delete(0x34);
    if (absent === 'lucky' || absent === 'allUnrelated') base.fields.delete(0x3c);
    const offsets = {field34: 0x34, attack: 0x3c, attackBonus: 0x40, defense: 0x4c, defenseBonus: 0x50, itemSource: 0x58};
    if (absent in offsets) equipment.fields.delete(offsets[absent as keyof typeof offsets]);
    if (absent === 'tankMismatch') equipment.fields.set(0x24, 4);
    player.vip = vip;
    player.ownedRoles.replace({base: absent === 'pet' ? undefined : base, equipment});
    const hpBefore = player.hp;
    recomputeBattleAttributes(player);
    const ready = ['complete', 'hp', 'critical', 'lucky', 'allUnrelated', 'withdrawn'].includes(absent);
    assert.equal(player.armorReady, ready, `${vip}/${absent}`);
    if (ready) assert.deepEqual(player.recoveredArmor, expected);
    else assert.equal(player.recoveredArmor, undefined);
    assert.equal(player.hp, hpBefore, 'Attribute qualification must not heal');
    if (absent === 'withdrawn') {
      player.ownedRoles.replace({base, equipment: undefined});
      recomputeBattleAttributes(player);
      assert.equal(player.armorReady, false); assert.equal(player.recoveredArmor, undefined);
      assert.equal(player.hp, hpBefore);
    }
    rows.push({vip, absent, armorReady: player.armorReady, recoveredArmor: player.recoveredArmor,
      lifeReady: player.lifeReady, attributesReady: player.attributesReady,
      magazineReady: player.magazineReady, hpUnchanged: player.hp === hpBefore});
  }
}
writeFileSync('recovery/output/tank-armor-sparse-qualification.json', JSON.stringify({status: 'PASS',
  sourcePurchases: capturePath, expected, rows,
  scope: 'Local normal/VIP sparse-source integration assertions only; no imported sparse account or multiplayer proof.'}, null, 2));
console.log(`PASS: ${rows.length} local armor eligibility, missing-source and withdrawal cases without HP writes`);
