import {rankedPetSkillId} from '../../../../shared/content/catalog';
import type {RoleSkillRecord} from '../../../../shared/contracts/role-skills';
import {selectRoleMarkerSkills} from './marker-skills';

export interface RankedRoleSkill {
  baseId: number;
  rank: number;
}

export interface RoleSkillSources {
  /** Array getter4's 16 slots; absence skips the subsequent source traversal. */
  currentSkillIds?: readonly number[];
  /** Battle lifecycle effects, independent of the original sixteen item/action slots. */
  runtimeSkillIds?: readonly number[];
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

const RADAR_PASSIVE_SKILL_IDS = new Set([13111, 13112]);

/** Original 0x432b29, used for equipment and the extra role skill. */
export function isPassiveRoleSkill(skill: RoleSkillRecord | undefined): boolean {
  if (!skill || skill.triggerType !== 0) return false;
  if (skill.functions.slice(0, 3).some(fn => fn.type === 1 && fn.t === 0xffff)) return true;
  // The radar items use the source Func21 passive form instead of Func1/T-1.
  const target = (skill as RoleSkillRecord & {target?: number}).target;
  return RADAR_PASSIVE_SKILL_IDS.has(skill.skillId)
    && target === 1
    && skill.functions.slice(0, 3).some(fn => fn.type === 21);
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
  const runtime = [...new Set(sources.runtimeSkillIds ?? [])].filter(id => !slots.includes(id));
  for (const id of runtime) {
    const skill = catalog.get(id);
    if (skill) selected.push(skill);
  }
  const appendPassive = (ranked: RankedRoleSkill): void => {
    if (ranked.rank <= 0) return;
    const skill = catalog.get(rankedPetSkillId(ranked.baseId, ranked.rank) ?? 0);
    if (skill && !slots.includes(skill.skillId) && !runtime.includes(skill.skillId) &&
        isPassiveRoleSkill(skill)) selected.push(skill);
  };
  const equipment = sources.equipmentSkills?.slice(0, 6) ?? [];
  for (const ranked of equipment) {
    if (ranked.baseId !== sources.extraSkill.baseId || ranked.rank >= sources.extraSkill.rank) appendPassive(ranked);
  }
  if (!equipment.some(ranked => ranked.baseId === sources.extraSkill.baseId &&
      ranked.rank >= sources.extraSkill.rank)) appendPassive(sources.extraSkill);
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
