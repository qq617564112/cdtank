import type {OwnedRoleBaseRecord} from '../../../../shared/contracts/owned-base';
import type {OwnedRoleEquipmentRecord} from '../../../../shared/contracts/owned-equipment';
import type {RoleSkillSources} from './skills';

/** Original4335b5–4337d7 reads the bound gear separately from both owned sources. */
export function readRoleSkillSources(input: {
  currentSkillIds: readonly number[] | undefined;
  runtimeSkillIds?: readonly number[];
  boundGear: OwnedRoleBaseRecord | undefined;
  equipment: OwnedRoleEquipmentRecord;
  roleFields: ReadonlyMap<number, number>;
}): RoleSkillSources {
  return {
    currentSkillIds: input.currentSkillIds,
    runtimeSkillIds: input.runtimeSkillIds,
    equipmentSkills: input.boundGear ? Array.from({length: 6}, (_, slot) => ({
      baseId: input.boundGear!.fields.get(0x44 + slot * 4)! | 0,
      rank: input.boundGear!.fields.get(0x5c + slot * 4)! | 0,
    })) : undefined,
    extraSkill: {baseId: input.roleFields.get(0x88)! | 0, rank: input.roleFields.get(0x8c)! | 0},
    itemIds: [0x58, 0x5c, 0x60].map(offset => input.equipment.fields.get(offset)! | 0)
      .concat([0xbc, 0xc0, 0xc4, 0xc8, 0xcc, 0x70, 0x6c]
        .map(offset => input.roleFields.get(offset)! | 0)),
  };
}
