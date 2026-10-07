import type {BattleRoleSources} from '../battle-role-sources';
import {combatSkills} from './catalog';
import {resolveQualifiedLastStandDuration} from './roles/qualified-last-stand-duration';
import type {CombatSkillDefinition} from '../../../shared/combat/catalog';

export interface LastStandState {
  expiresAt: number;
  attackerId: string;
  attackerName: string;
  friendly: boolean;
}

/** The selected owned slot supplies eligibility; the delayed death is Web policy. */
export function qualifiedLastStand(player: {
  alive: boolean;
  attributesReady?: boolean;
  ownedRoles?: Pick<BattleRoleSources, 'snapshot' | 'tables'>;
}): {skill: CombatSkillDefinition; duration: number} | undefined {
  if (!player.alive || !player.attributesReady || player.ownedRoles?.tables().pet?.id !== 4) return;
  const fields = player.ownedRoles.snapshot().base?.fields;
  const skill = combatSkills.get(10441);
  const action = skill?.functions.find(fn => fn.type === 11);
  const duration = resolveQualifiedLastStandDuration(fields?.get(0x50) === 10441
    && fields.get(0x68) === 1 && skill?.triggerType === 6 && skill.target === 1
    && action !== undefined, action?.t ?? 0);
  return skill && duration !== undefined ? {skill, duration} : undefined;
}

/** Qualified surviving duration in milliseconds for the fixed owned last-stand source. */
export function qualifiedLastStandDuration(player: {
  alive: boolean;
  attributesReady?: boolean;
  ownedRoles?: Pick<BattleRoleSources, 'snapshot' | 'tables'>;
}): number | undefined {
  return qualifiedLastStand(player)?.duration;
}
