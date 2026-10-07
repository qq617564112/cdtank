import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {OwnedRoleRecordData} from '../../../../shared/protocols/PtlOwnedRoles';

/** Original PetTable directory mastery values; no owned growth authority. */
export const PET_SHOP_MASTERY: Readonly<Record<number, readonly number[]>> = {
  "1": [
    3,
    3,
    3,
    3
  ],
  "2": [
    2,
    3,
    4,
    2
  ],
  "3": [
    3,
    4,
    2,
    2
  ],
  "4": [
    4,
    3,
    2,
    3
  ],
  "5": [
    2,
    2,
    3,
    4
  ],
  "101": [
    3,
    3,
    3,
    3
  ],
  "102": [
    3,
    4,
    2,
    2
  ],
  "103": [
    2,
    2,
    3,
    4
  ],
  "104": [
    4,
    3,
    2,
    3
  ],
  "105": [
    2,
    2,
    4,
    3
  ]
};

/** Original PetTable +7c..+88 order. */
const MASTERY_ATTRIBUTES = ['STankMastery', 'MTankMastery', 'LTankMastery', 'StugMastery'] as const;

export interface PetOwnedMastery {
  mastery: readonly number[];
  /** Original f32(mastery * 0.2); the visual clip is applied by the view. */
  progress: readonly number[];
}

/**
 * Owned Pet mastery per the recovered 429e41 adoption rule: selected PetTable
 * base plus passive mastery from the selected pet's own six skills when it is the
 * current pet, plus passive mastery from the current tank's three real item IDs.
 * Unresolved records leave all four groups unknown rather than filling zero or the
 * buy-directory value.
 */
export function petOwnedMastery({selectedBase, currentTank, isCurrent, catalog}:
    {selectedBase?: OwnedRoleRecordData; currentTank?: OwnedRoleRecordData; isCurrent: boolean; catalog?: CombatCatalog}):
    PetOwnedMastery | undefined {
  if (!selectedBase || !currentTank || !catalog) return undefined;
  const fields = new Map(selectedBase.fields), definitionId = fields.get(8);
  const base = definitionId === undefined ? undefined : PET_SHOP_MASTERY[definitionId];
  if (!base || base.length < MASTERY_ATTRIBUTES.length) return undefined;
  const mastery = [...base];
  let unresolved = false;
  const addSkill = (skillId: number) => {
    const skill = catalog.skills.find(value => value.skillId === skillId);
    if (!skill) {unresolved = true; return;}
    if (skill.triggerType !== 0) return;
    MASTERY_ATTRIBUTES.forEach((attribute, index) => {
      mastery[index] += skill.attributes[attribute] ?? 0;
    });
  };
  if (isCurrent) {
    for (let slot = 0; slot < 6; slot++) {
      const baseId = fields.get(0x44 + slot * 4), rank = fields.get(0x5c + slot * 4);
      if (baseId === undefined || rank === undefined) return undefined;
      if (baseId === 0 || rank === 0) continue;
      addSkill(baseId + (rank - 1));
    }
  }
  const tankFields = new Map(currentTank.fields);
  for (const offset of [0x58, 0x5c, 0x60]) {
    const itemId = tankFields.get(offset);
    if (itemId === undefined) return undefined;
    if (itemId === 0) continue;
    const item = catalog.items.find(value => value.itemTableId === itemId);
    if (!item) return undefined;
    item.skillIds.forEach(addSkill);
  }
  if (unresolved) return undefined;
  return {mastery, progress: mastery.map(value => Math.fround(value * Math.fround(.2)))};
}
