import {combatSkills} from './catalog';
import type {PlayerState} from './player-state';
import {isPassiveRoleSkill, type RankedRoleSkill} from './roles/skills';
import {selectCopiedRoleSkill} from './roles/copied-role-skill-selection';
import type {RoleCombatState} from './roles/combat-state';

type CopyParticipant = Pick<PlayerState,
  'id' | 'team' | 'alive' | 'attributesReady' | 'ownedRoles' | 'combat'>;

/** Selected owned ranks supply the finite passive-copy candidate set. */
export function passiveCopyCandidates(player: Pick<CopyParticipant, 'ownedRoles'>): RankedRoleSkill[] {
  const fields = player.ownedRoles.snapshot().base?.fields;
  if (!fields) return [];
  const candidates: RankedRoleSkill[] = [];
  for (let slot = 0; slot < 6; slot++) {
    const baseId = fields.get(0x44 + slot * 4);
    const rank = fields.get(0x5c + slot * 4);
    if (baseId === undefined || rank === undefined || rank <= 0) continue;
    if (isPassiveRoleSkill(combatSkills.get(baseId + rank - 1))) candidates.push({baseId, rank});
  }
  return candidates;
}

/** Rebuilt Func17 policy uses the existing transient extra-skill consumer. */
export function copyPassiveSkillAfterKill(attacker: CopyParticipant, target: CopyParticipant,
  mode: number, roll: () => number = Math.random): boolean {
  if (target.alive || !attacker.alive || attacker.combat.status !== 2 ||
      !attacker.attributesReady || attacker.id === target.id ||
      (mode <= 3 && attacker.team === target.team) || attacker.ownedRoles.tables().pet?.id !== 102) return false;
  const fields = attacker.ownedRoles.snapshot().base?.fields;
  const skill = combatSkills.get(10711);
  if (fields?.get(0x44) !== 10711 || fields.get(0x5c) !== 1 ||
      skill?.triggerType !== 4 || skill.target !== 1 ||
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
