import {combatSkills} from './catalog';
import {calculateQualifiedBackCriticalBonus} from './roles/qualified-back-critical-bonus';
import {readPetSkills, type LearnedPetSkill, type PetSkillHandler,
  type PetSkillSource} from './pet-skill-rules';

interface BackCriticalParticipant extends PetSkillSource {
  alive: boolean;
  attributesReady?: boolean;
}

const shotHandlers: Partial<Record<PetSkillHandler, (source: LearnedPetSkill) => number>> = {
  backCritical: ({skill}) => {
    const action = skill.functions.find(fn => fn.type === 9 && fn.t === 0);
    const called = action ? combatSkills.get(action.y) : undefined;
    return skill.triggerType === 0 && skill.target === 1
      && called && called.triggerType === 1 && called.target === 1
      && called.functions.some(fn => fn.type === 2 && fn.t === 0) && called.attributes.HP < 0
      ? -called.attributes.HP : 0;
  },
};

/** Web policy applies the JSON-routed referenced HP loss after ordinary shot defense. */
export function resolveShotBackCriticalBonus(attacker: BackCriticalParticipant, critical: boolean,
    facet: 'FRONT' | 'SIDE' | 'BACK'): number {
  if (!critical || facet !== 'BACK' || !attacker.alive || !attacker.attributesReady) return 0;
  let bonus = 0;
  for (const source of readPetSkills(attacker)) {
    if (source.rule.event === 'shot') bonus += shotHandlers[source.rule.handler]?.(source) ?? 0;
  }
  return calculateQualifiedBackCriticalBonus(critical, facet, bonus);
}
