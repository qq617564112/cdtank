import {gameContent, rankedPetSkillId} from '../../../../shared/content/catalog';
import type {CombatCatalog} from '../../../../shared/combat/catalog';
import type {OwnedRoleRecordData} from '../../../../shared/protocols/PtlOwnedRoles';

export function petShopMastery(petId: number): readonly number[] {
  return gameContent().pets.get(petId)?.attributes.mastery ?? [];
}

/** Original PetTable +7c..+88 order; markup uses the same slot order. */
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
  const base = definitionId === undefined ? undefined : gameContent().pets.get(definitionId)?.attributes.mastery;
  if (!base || base.length < MASTERY_ATTRIBUTES.length) return undefined;
  const mastery = base.slice(0, MASTERY_ATTRIBUTES.length);
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
      const skillId = rankedPetSkillId(baseId, rank);
      if (skillId === undefined) return undefined;
      addSkill(skillId);
    }
  }
  const tankFields = new Map(currentTank.fields);
  for (const offset of [0x58, 0x5c, 0x60]) {
    const itemId = tankFields.get(offset);
    if (itemId === undefined) return undefined;
    if (itemId === 0) continue;
    const item = catalog.items.find(value => value.itemTableId === itemId);
    if (!item) return undefined;
    for (const skillId of item.skillIds) if (skillId !== 0) addSkill(skillId);
  }
  if (unresolved) return undefined;
  return {mastery, progress: mastery.map(value => Math.fround(value * Math.fround(.2)))};
}
