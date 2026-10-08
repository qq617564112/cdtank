import type {PlayerState} from './player-state';
import type {RankedRoleSkill} from './roles/skills';
import {selectCopiedRoleSkill} from './roles/copied-role-skill-selection';
import type {RoleCombatState} from './roles/combat-state';
import {findPetSkill, readPetSkills} from './pet-skill-rules';

type CopyParticipant = Pick<PlayerState,
  'id' | 'team' | 'alive' | 'attributesReady' | 'ownedRoles' | 'boundGear' | 'combat'>;

/** Only learned selected sources are candidates; copied skills and recursive copying are excluded. */
export function passiveCopyCandidates(player: Pick<CopyParticipant, 'ownedRoles' | 'boundGear'>): RankedRoleSkill[] {
  return readPetSkills(player, false).filter(source => source.rule.handler !== 'copy')
    .map(({baseId, rank}) => ({baseId, rank}));
}

/** Rebuilt Func17 policy uses the existing transient extra-skill consumer. */
export function copyPassiveSkillAfterKill(attacker: CopyParticipant, target: CopyParticipant,
  mode: number, roll: () => number = Math.random): boolean {
  if (target.alive || !attacker.alive || attacker.combat.status !== 2 ||
      !attacker.attributesReady || attacker.id === target.id ||
      (mode <= 3 && attacker.team === target.team)) return false;
  const skill = findPetSkill(attacker, 'copy')?.skill;
  if (skill?.triggerType !== 4 || skill.target !== 1 ||
      !skill.functions.some(fn => fn.type === 17)) return false;
  const extra = attacker.combat.record?.numericFields;
  if (!extra) return false;
  const candidates = passiveCopyCandidates(target);
  if (!candidates.length) return false;
  const selected = selectCopiedRoleSkill(candidates, roll())!;
  extra.set(0x88, selected.baseId);
  extra.set(0x8c, selected.rank);
  attacker.combat.dirty = true;
  return true;
}

/** The copied source lasts for the current life and never reaches owned records. */
export function clearCopiedRoleSkill(combat: RoleCombatState): boolean {
  const fields = combat.record?.numericFields;
  if (!fields || (!fields.get(0x88) && !fields.get(0x8c))) return false;
  fields.set(0x88, 0);
  fields.set(0x8c, 0);
  combat.dirty = true;
  return true;
}
