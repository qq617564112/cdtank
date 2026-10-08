import {rankedPetSkillId} from '../../../../shared/content/catalog';
/** Original421cbe: owned capacity minus installed parts plus six ranked skill contributions. */
export function roleEquipmentSlotCount(owned: {parts: readonly number[]; capacity: number},
    gear: {skillIds: readonly number[]; ranks: readonly number[]} | undefined,
    lookupSkill: (skillId: number) => {partSlots: number} | undefined): number {
  let count = owned.capacity >>> 0;
  for (let index = 0; index < 3; index++) {
    if (owned.parts[index] >>> 0) count--;
  }
  if (gear) {
    for (let index = 0; index < 6; index++) {
      const key = rankedPetSkillId(gear.skillIds[index] >>> 0, gear.ranks[index] >>> 0) ?? 0;
      count += lookupSkill(key)?.partSlots ?? 0;
    }
  }
  return count >>> 0;
}
