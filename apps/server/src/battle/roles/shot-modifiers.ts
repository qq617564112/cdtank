import type {RoleSkillRecord} from '../../../../shared/contracts/role-skills';
import {selectRoleSkills, type RoleItemSkills, type RoleSkillSources} from './skills';

export interface ShotModifiers {
  /** FuncType22: target lookup ignores static scene and crush obstruction. */
  readonly penetratesObstacles: boolean;
  /** FuncType23 X value treated as a total-range percentage of the ordinary1000. */
  readonly rangePercent: number;
}

interface ShotModifierSkill extends RoleSkillRecord {
  functions: readonly {type: number; t: number; x: number}[];
}

/** Resolve one value per selected function; repeated slots do not stack. */
export function resolveSelectedShotModifiers<T extends ShotModifierSkill>(
  sources: RoleSkillSources,
  skills: ReadonlyMap<number, T>,
  items?: ReadonlyMap<number, RoleItemSkills>,
): ShotModifiers {
  let penetratesObstacles = false;
  let rangePercent: number | undefined;
  for (const skill of selectRoleSkills(sources, skills, items)) {
    const modifier = skill.functions[0];
    if (modifier?.type === 22) penetratesObstacles = true;
    else if (modifier?.type === 23 && rangePercent === undefined) rangePercent = modifier.x | 0;
  }
  return {penetratesObstacles, rangePercent: rangePercent ?? 100};
}
