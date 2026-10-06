import type {RoleSkillRecord} from '../../../../shared/contracts/role-skills';
import {selectRoleMarkerSkills} from './marker-skills';

export interface RankedRoleSkill {
  baseId: number;
  rank: number;
}

export interface RoleSkillSources {
  /** Array getter4's 16 slots; absence skips the subsequent source traversal. */
  currentSkillIds?: readonly number[];
  /** Original six fields +0x44..+0x58 and their ranks at +0x18. */
  equipmentSkills?: readonly RankedRoleSkill[];
  extraSkill: RankedRoleSkill;
  /** Original profile3, role record5 and record +0x70/+0x6c item slots, in order. */
  itemIds?: readonly number[];
  /** Home MARKER instances resolved to their exact item-table IDs and owned inventory records. */
  markerItemIds?: readonly number[];
}

export interface RoleItemSkills {
  itemId: number;
  skillIds: readonly number[];
}

/** Original 0x432b29, used for equipment and the extra role skill. */
export function isPassiveRoleSkill(skill: RoleSkillRecord | undefined): boolean {
  return skill !== undefined && skill.triggerType === 0
    && skill.functions.slice(0, 3).some(fn => fn.type === 1 && fn.t === 0xffff);
}

/** Original 0x4335b5..0x4337d7 selection order, including current-slot duplicates. */
export function selectRoleSkills<T extends RoleSkillRecord>(sources: RoleSkillSources,
    catalog: ReadonlyMap<number, T>, items?: ReadonlyMap<number, RoleItemSkills>): T[] {
  if (!sources.currentSkillIds) return [];
  const slots = sources.currentSkillIds.slice(0, 16);
  const selected: T[] = [];
  for (const id of slots) {
    const skill = catalog.get(id);
    if (skill) selected.push(skill);
  }
  const appendPassive = (ranked: RankedRoleSkill): void => {
    const skill = catalog.get((ranked.baseId + ranked.rank - 1) | 0);
    if (skill && !slots.includes(skill.skillId) && isPassiveRoleSkill(skill)) selected.push(skill);
  };
  for (const ranked of sources.equipmentSkills?.slice(0, 6) ?? []) appendPassive(ranked);
  appendPassive(sources.extraSkill);
  selected.push(...selectRoleItemSkills(sources.itemIds ?? [], slots, catalog, items));
  selected.push(...selectRoleMarkerSkills(sources.markerItemIds ?? [], slots, catalog, items));
  return selected;
}

/** Original432fe8: item expansion excludes current slots and preserves repetitions. */
export function selectRoleItemSkills<T extends RoleSkillRecord>(itemIds: readonly number[],
    currentSkillIds: readonly number[], catalog: ReadonlyMap<number, T>,
    items?: ReadonlyMap<number, RoleItemSkills>): T[] {
  const selected: T[] = [];
  for (const id of itemIds.slice(0, 10)) {
    const item = items?.get(id);
    for (const skillId of item?.skillIds.slice(0, 3) ?? []) {
      const skill = catalog.get(skillId);
      if (skill && !currentSkillIds.slice(0, 16).includes(skill.skillId)
          && isPassiveRoleSkill(skill)) selected.push(skill);
    }
  }
  return selected;
}
