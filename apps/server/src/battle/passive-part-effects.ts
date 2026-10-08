import {gameContent} from '../../../shared/content/catalog';
import {combatSkills, combatItemSkills} from './catalog';
import {selectRoleItemSkills} from './roles/skills';

/** Confirmed parts and the appearance slot feed the original passive effect selector. */
export function queuedPartSkillIds(parts: ArrayLike<number> | undefined,
    currentSkills: ArrayLike<number> | undefined, appearanceItemId = 0): number[] {
  if (!parts || !currentSkills) return [];
  return selectRoleItemSkills([...Array.from(parts).slice(0, 5), appearanceItemId], Array.from(currentSkills),
    combatSkills, combatItemSkills).filter(skill => gameContent().skills.get(skill.skillId)?.runtime.queuedEffect)
    .map(skill => skill.skillId);
}
