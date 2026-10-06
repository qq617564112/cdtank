import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {TANKS, PET_BASES} from '../apps/server/src/config';
import {combatSkills, combatItemSkills, combatLimits} from '../apps/server/src/battle/catalog';
import {recomputeQualifiedRoleArmor} from '../apps/server/src/battle/roles/recompute-armor';

// Read the accepted ordinary checkpoint; no service or database writes.
const source = 'recovery/output/permanent-barrel-attack-network-2026-10-05T21-38-35-170Z';
const identities = JSON.parse(readFileSync(source + '-identity.private.json', 'utf8')).accounts as
  {accountId: string; token: string}[];
const actual = JSON.parse(readFileSync(source + '.json', 'utf8'));
const db = new DatabaseSync(source + '-checkpoint.sqlite', {readOnly: true});
const participants = [];
try {
  for (const [ordinal, identity] of identities.entries()) {
    const storedProfile = db.prepare('SELECT payload, strings FROM role_profiles WHERE account_id=?').get(identity.accountId)!;
    const bytes = Uint8Array.from(storedProfile.payload as Uint8Array);
    const profile = {bytes: [...bytes], strings: JSON.parse(String(storedProfile.strings))};
    const view = new DataView(bytes.buffer);
    const tankInstance = view.getUint32(0xa8, true), petInstance = view.getUint32(0xa4, true);
    const records = (kind: string) => db.prepare('SELECT record FROM role_records WHERE account_id=? AND kind=? ORDER BY instance_id')
      .all(identity.accountId, kind).map(row => JSON.parse(String(row.record)) as {name: string; fields: [number, number][]});
    const owned = {base: records('base'), equipment: records('equipment')};
    const inventory = db.prepare('SELECT record FROM inventory WHERE account_id=? ORDER BY instance_id')
      .all(identity.accountId).map(row => JSON.parse(String(row.record)) as {instanceId: number; itemTableId: number; ownedQuantity: number});
    const tankRecord = owned.equipment.find(row => new Map(row.fields).get(0x1c) === tankInstance)!;
    const petRecord = owned.base.find(row => new Map(row.fields).get(0) === petInstance)!;
    assert(tankRecord && petRecord);
    const tankFields = new Map(tankRecord.fields), petFields = new Map(petRecord.fields);
    const tank = TANKS.find(row => row.id === tankFields.get(0x24))!;
    const pet = PET_BASES.find(row => row.id === petFields.get(8))!;
    const slots = Array.from({length: 5}, (_, slot) => view.getUint32(0x148 + slot * 4, true));
    const actualPlayer = actual.phases[1].beforeShot.players.find((row: {tankId: number; petId: number}) =>
      row.tankId === tank.id && row.petId === pet.id);
    assert(actualPlayer?.roleSkillSources);
    const currentSkillIds = [...actualPlayer.roleSkillSources.currentSkillIds] as number[];
    assert.equal(currentSkillIds.length, 16);
    for (const skillId of combatItemSkills.get(2001)!.skillIds.filter(id => id > 0)) {
      assert(currentSkillIds.includes(skillId));
    }
    const equipmentSkills = Array.from({length: 6}, (_, slot) => ({baseId: petFields.get(0x44 + slot * 4)!,
      rank: petFields.get(0x5c + slot * 4)!}));
    const calculate = (instances: number[]) => {
      const itemIds = [0x58, 0x5c, 0x60].map(offset => tankFields.get(offset)!)
        .concat(instances.map(id => id ? inventory.find(row => row.instanceId === id)!.itemTableId : 0), [0, 0]);
      const fields = recomputeQualifiedRoleArmor({ownedField34: tankFields.get(0x34),
        ownedAtk: tankFields.get(0x3c), ownedAtkBonus: tankFields.get(0x40),
        ownedDef: tankFields.get(0x4c), ownedDefBonus: tankFields.get(0x50),
        tank: tank.recomputeBase, tankType: tank.recomputeBase.tankType, pet,
        sources: {currentSkillIds, equipmentSkills, extraSkill: {baseId: 0, rank: 0}, itemIds},
        skills: combatSkills, items: combatItemSkills, limits: combatLimits, roleValue9: 0});
      assert(fields); return {itemIds, fields};
    };
    assert.equal(view.getUint32(0x118, true), 0);
    assert.equal(view.getUint32(0x13c, true), 0);
    const mounted = calculate(slots);
    const baselineSlots = [...slots];
    if (ordinal === 0) {
      assert.equal(slots[2], 7);
      assert.equal(inventory.find(row => row.instanceId === 7)!.itemTableId, 14003);
      assert.equal(slots[0], 8);
      baselineSlots[2] = 0;
    }
    const baseline = calculate(baselineSlots);
    if (ordinal === 0) {
      assert.deepEqual(mounted.fields, actual.phases[1].qualified);
      assert(mounted.fields.selectedSkillIds.includes(13033));
      assert(!baseline.fields.selectedSkillIds.includes(13033));
      assert.equal(mounted.fields.defenseBonus, baseline.fields.defenseBonus);
      assert.deepEqual({...mounted.fields, defensePercent: 0, selectedSkillIds: []},
        {...baseline.fields, defensePercent: 0, selectedSkillIds: []});
    }
    participants.push({ordinal, owned, inventory, profile, tank, pet, slots, baselineSlots,
      currentSkillIds, equipmentSkills, mounted, baseline,
      rawShotAttack: Math.round(Math.max(0, mounted.fields.attackBase * mounted.fields.attackPercent + mounted.fields.attackBonus))});
  }
} finally {db.close();}
writeFileSync('recovery/output/permanent-armor-source-inputs.json', JSON.stringify({
  status: 'PREPARED_ACCEPTED_CHECKPOINT_ORIGINAL_ARMOR_FIELDS_NO_DAMAGE_POLICY',
  sourceCheckpoint: source + '-checkpoint.sqlite', participants,
  fundsOrOwnedWrites: false, runtimeStarted: false,
  scope: 'Exact full records and original field dependency preparation; no normal armor mitigation formula or player acceptance claim'
}, null, 2) + '\n');
console.log(JSON.stringify(participants.map(row => ({ordinal: row.ordinal,
  baselineDefense: [row.baseline.fields.defensePercent, row.baseline.fields.defenseBonus],
  mountedDefense: [row.mounted.fields.defensePercent, row.mounted.fields.defenseBonus], rawShotAttack: row.rawShotAttack}))));
