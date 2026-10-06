import {combatSkills, combatItemSkills} from './catalog';
import {selectRoleItemSkills} from './roles/skills';

/** Confirmed table-ID part slots feed the original passive selector. */
export function queuedPartSkillIds(parts: ArrayLike<number> | undefined,
    currentSkills: ArrayLike<number> | undefined): number[] {
  if (!parts || !currentSkills) return [];
  return selectRoleItemSkills(Array.from(parts).slice(0, 5), Array.from(currentSkills),
    combatSkills, combatItemSkills).filter(skill => skill.skillId === 13501 || skill.skillId === 13502 ||
      skill.skillId === 13503 || skill.skillId === 13504 || skill.skillId === 13505 || skill.skillId === 13506)
    .map(skill => skill.skillId);
}
