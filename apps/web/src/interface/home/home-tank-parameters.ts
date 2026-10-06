import type {CombatCatalog, CombatSkillAttribute} from '../../../../shared/combat/catalog';
import type {OwnedRoleRecordData} from '../../../../shared/protocols/PtlOwnedRoles';

/** TankType, TankMove, TankTurn, TankDelay, TankBullet, SideDef, BackDef from tank.dat. */
export const HOME_TANK_PARAMETER_BASES: Readonly<Record<number, readonly number[]>> = {
  1: [1, 10, 8, 0, 0, 70, 50],
  2: [1, 5, 6, -3, 2, 70, 50],
  3: [1, 10, 9, -2, 1, 70, 50],
  4: [1, 12, 10, -2, 0, 70, 50],
  51: [2, 5, 6, -1, 1, 60, 30],
  52: [2, 5, 8, -4, 0, 60, 30],
  53: [2, 8, 7, -3, 0, 60, 30],
  54: [2, 7, 7, -3, 2, 60, 30],
  101: [3, 4, 6, 1, 2, 40, 20],
  102: [3, 2, 7, 4, 3, 40, 20],
  103: [3, 3, 7, 3, 3, 40, 20],
  104: [3, 3, 6, 6, 3, 40, 20],
  105: [3, 3, 7, 3, 3, 40, 20],
  151: [4, 7, 5, -1, 3, 30, 10],
  152: [4, 4, 3, -1, 2, 30, 10],
  153: [4, 3, 3, 3, 2, 30, 10],
  154: [4, 3, 3, 6, 3, 30, 10],
  155: [4, 8, 3, 0, 1, 30, 10],
  156: [4, 4, 4, 3, 3, 30, 10],
  157: [4, 3, 3, 2, 3, 30, 10],
  158: [4, 5, 2, 3, 2, 30, 10],
};

/** Original PetTable +7c..+88, in TankType order. */
const petMasteries: Readonly<Record<number, readonly number[]>> = {
  1: [3, 3, 3, 3], 2: [2, 3, 4, 2], 3: [3, 4, 2, 2],
  4: [4, 3, 2, 3], 5: [2, 2, 3, 4],
  101: [3, 3, 3, 3], 102: [3, 4, 2, 2], 103: [2, 2, 3, 4],
  104: [4, 3, 2, 3], 105: [2, 2, 4, 3],
};

export interface HomeTankParameters {
  txtPanzerSide: number;
  txtPanzerBack: number;
  txtMoveSpeed: number;
  txtRotationSpeed: number;
  txtShootInterval: string;
  capacity: number;
}

/** Original Home 4e8f88 -> 429e41 display projection, separate from battle recomputation. */
export function homeTankParameters(record: OwnedRoleRecordData | undefined,
    pet: OwnedRoleRecordData | undefined, catalog: CombatCatalog | undefined,
    equippedItemIds: readonly number[] | undefined, alreadyUsed: boolean): HomeTankParameters | undefined {
  if (!record || !pet || !catalog || equippedItemIds === undefined) return undefined;
  const fields = new Map(record.fields), petFields = new Map(pet.fields);
  const tank = HOME_TANK_PARAMETER_BASES[fields.get(0x24)!];
  const masteries = petMasteries[petFields.get(8)!];
  if (!tank || !masteries || !fields.has(0x34)) return undefined;
  const bonuses = new Map<CombatSkillAttribute, number>();
  const addSkill = (skillId: number) => {
    const skill = catalog.skills.find(value => value.skillId === skillId);
    // Original429714 includes only passive skills, with one integer addition per definition.
    if (!skill || skill.triggerType !== 0) return;
    for (const attribute of Object.keys(skill.attributes) as CombatSkillAttribute[]) {
      bonuses.set(attribute, ((bonuses.get(attribute) ?? 0) + skill.attributes[attribute]) | 0);
    }
  };
  const addItem = (itemId: number) => {
    catalog.items.find(item => item.itemTableId === itemId)?.skillIds.forEach(addSkill);
  };
  // Original429eb6 clears current pet/equipment skill bonuses for an unused candidate tank.
  if (alreadyUsed) {
    for (let slot = 0; slot < 6; slot++) {
      const baseId = petFields.get(0x44 + slot * 4), rank = petFields.get(0x5c + slot * 4);
      if (baseId !== undefined && rank !== undefined) addSkill((baseId + rank - 1) | 0);
    }
    equippedItemIds.forEach(addItem);
  }
  for (const offset of [0x58, 0x5c, 0x60]) {
    const itemId = fields.get(offset);
    if (itemId !== undefined) addItem(itemId);
  }
  const bonus = (attribute: CombatSkillAttribute) => bonuses.get(attribute) ?? 0;
  const masteryAttribute = (['STankMastery', 'MTankMastery', 'LTankMastery', 'StugMastery'] as const)[tank[0]! - 1]!;
  const mastery = (masteries[tank[0]! - 1]! + bonus(masteryAttribute)
    - (alreadyUsed && fields.get(0x34) === 0 ? 1 : 0)) | 0;
  const limit = (value: number, id: number) => {
    const scale = catalog.dataScales.find(row => row.id === id);
    return scale ? Math.max(scale.minimum, Math.min(scale.maximum, value)) : undefined;
  };
  const side = limit((tank[5]! + bonus('SideDef')) | 0, 12);
  const back = limit((tank[6]! + bonus('BackDef')) | 0, 13);
  if (side === undefined || back === undefined) return undefined;
  return {
    txtPanzerSide: side,
    txtPanzerBack: back,
    txtMoveSpeed: Math.imul((tank[1]! + bonus('ItemMove') + mastery + 2) | 0, 10),
    txtRotationSpeed: (Math.imul((tank[2]! + bonus('ItemTurn') + mastery) | 0, 4) - 1) | 0,
    txtShootInterval: (((tank[3]! + bonus('Delay')) | 0) * Math.fround(.1)).toFixed(1),
    capacity: (tank[4]! + bonus('MaxBullet')) | 0,
  };
}
