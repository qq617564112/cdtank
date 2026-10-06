import {combatSkills} from './catalog';
import type {RoleCombatState} from './roles/combat-state';
import type {BattleRoleSources} from '../battle-role-sources';

export interface PetHitSpeedState {
  skillId: 10231;
  expiresAt: number;
}

interface HitParticipant {
  id: string;
  team: number;
  alive: boolean;
  hp: number;
  attributesReady: boolean;
  combat: RoleCombatState;
  ownedRoles: BattleRoleSources;
  petHitSpeed?: PetHitSpeedState;
}

/** Accepted hostile HP loss installs the selected learned original movement skill. */
export function applyPetHitSpeed(player: HitParticipant,
  attacker: Pick<HitParticipant, 'id' | 'team'>, mode: number, hpBefore: number,
  now: number, recompute: () => void): boolean {
  if (!player.alive || player.hp <= 0 || player.hp >= hpBefore ||
      player.combat.status !== 2 || !player.attributesReady || player.id === attacker.id ||
      (mode <= 3 && player.team === attacker.team) || player.ownedRoles.tables().pet?.id !== 2) return false;
  const fields = player.ownedRoles.snapshot().base?.fields;
  const skill = combatSkills.get(10231);
  if (fields?.get(0x4c) !== 10231 || fields.get(0x64) !== 1 ||
      skill?.triggerType !== 5 || skill.target !== 1 || skill.functions[0]?.type !== 1) return false;
  const expiresAt = now + skill.functions[0].t * 1000;
  if (player.petHitSpeed) {
    player.petHitSpeed.expiresAt = expiresAt;
    return true;
  }
  const slots = player.combat.record?.arrays.get(4);
  if (!slots?.includes(0) || slots.includes(10231)) return false;
  player.combat.addSkill(10231);
  player.petHitSpeed = {skillId: 10231, expiresAt};
  recompute();
  return true;
}

/** Remove only the skill installed by this life state. */
export function clearPetHitSpeed(player: Pick<HitParticipant, 'combat' | 'petHitSpeed'>,
  recompute: () => void): void {
  if (!player.petHitSpeed) return;
  const slot = player.combat.record?.arrays.get(4)?.indexOf(10231) ?? -1;
  if (slot !== -1) player.combat.removeSkillAt(slot);
  delete player.petHitSpeed;
  recompute();
}

export function advancePetHitSpeed(player: Pick<HitParticipant, 'combat' | 'petHitSpeed' | 'alive'>,
  now: number, recompute: () => void): void {
  if (player.petHitSpeed && (!player.alive || now >= player.petHitSpeed.expiresAt)) {
    clearPetHitSpeed(player, recompute);
  }
}
