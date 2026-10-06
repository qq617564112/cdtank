import type {BattleRoleSources} from '../battle-role-sources';
import {combatSkills} from './catalog';
import {calculateQualifiedBackCriticalBonus} from './roles/qualified-back-critical-bonus';

interface BackCriticalParticipant {
  alive: boolean;
  attributesReady?: boolean;
  ownedRoles?: Pick<BattleRoleSources, 'snapshot' | 'tables'>;
}

/** Web policy applies the referenced skill's HP loss after ordinary shot defense. */
export function resolveShotBackCriticalBonus(attacker: BackCriticalParticipant, critical: boolean,
    facet: 'FRONT' | 'SIDE' | 'BACK'): number {
  if (!critical || facet !== 'BACK' || !attacker.alive || !attacker.attributesReady
      || attacker.ownedRoles?.tables().pet?.id !== 2) return 0;
  const fields = attacker.ownedRoles.snapshot().base?.fields;
  if (fields?.get(0x48) !== 10221 || fields.get(0x60) !== 1) return 0;
  const skill = combatSkills.get(10221);
  const action = skill?.functions.find(fn => fn.type === 9 && fn.t === 0);
  const called = action ? combatSkills.get(action.y) : undefined;
  const qualifiedBonus = skill?.triggerType === 0 && skill.target === 1
    && called?.skillId === 30004 && called.triggerType === 1 && called.target === 1
    && called.functions.some(fn => fn.type === 2 && fn.t === 0) && called.attributes.HP < 0
    ? -called.attributes.HP : undefined;
  return calculateQualifiedBackCriticalBonus(critical, facet, qualifiedBonus);
}
