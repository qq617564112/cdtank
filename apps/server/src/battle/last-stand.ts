import {readPetSkills, type LearnedPetSkill, type PetSkillHandler,
  type PetSkillSource} from './pet-skill-rules';
import {resolveQualifiedLastStandDuration} from './roles/qualified-last-stand-duration';

export interface LastStandState {
  expiresAt: number;
  attackerId: string;
  attackerName: string;
  friendly: boolean;
}

const lethalHandlers: Partial<Record<PetSkillHandler,
  (source: LearnedPetSkill) => number | undefined>> = {
  lastStand: ({skill}) => {
    const action = skill.functions.find(fn => fn.type === 11);
    return resolveQualifiedLastStandDuration(skill.triggerType === 6 && skill.target === 1 &&
      action !== undefined, action?.t ?? 0);
  },
};

/** Selected and copied skills route through the same lethal-event JSON rule. */
export function qualifiedLastStand(player: PetSkillSource & {
  alive: boolean;
  attributesReady?: boolean;
}): {source: LearnedPetSkill; duration: number} | undefined {
  if (!player.alive || !player.attributesReady) return;
  for (const source of readPetSkills(player)) {
    if (source.rule.event !== 'lethal') continue;
    const duration = lethalHandlers[source.rule.handler]?.(source);
    if (duration !== undefined) return {source, duration};
  }
}

/** Qualified surviving duration in milliseconds for the selected lethal source. */
export function qualifiedLastStandDuration(player: PetSkillSource & {
  alive: boolean;
  attributesReady?: boolean;
}): number | undefined {
  return qualifiedLastStand(player)?.duration;
}
