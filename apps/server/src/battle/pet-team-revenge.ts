import {readPetSkills} from './pet-skill-rules';
import type {BattleRoleSources} from '../battle-role-sources';
import type {RoleCombatState} from './roles/combat-state';
import type {CombatSkillDefinition} from '../../../shared/combat/catalog';

export interface PetTeamRevengeState {
  skillId: number;
  expiresAt: number;
}

interface RevengeSource {
  attributesReady: boolean;
  ownedRoles: BattleRoleSources;
}

interface RevengeRecipient {
  alive: boolean;
  hp: number;
  attributesReady: boolean;
  combat: RoleCombatState;
  petTeamRevenge?: PetTeamRevengeState;
}

/** Selected owned Pet2 slot3 resolves all five learned source ranks. */
export function readQualifiedPetTeamRevengeSkill(source: RevengeSource):
    CombatSkillDefinition | undefined {
  if (!source.attributesReady) return;
  const skill = readPetSkills(source).find(source => source.rule.event === 'death'
    && source.rule.handler === 'attributes' && source.rule.target === 'teammates')?.skill;
  if (!skill || skill.functions[0]?.type !== 1) return;
  return skill;
}

/** The caller selects the teammate and resolves overlap before installation. */
export function installPetTeamRevenge(target: RevengeRecipient,
    skill: CombatSkillDefinition, now: number, recompute: () => void): boolean {
  if (!target.alive || target.hp <= 0 || !target.attributesReady ||
      target.combat.status !== 2 || target.petTeamRevenge) return false;
  const slots = target.combat.record?.arrays.get(4);
  if (!slots?.includes(0) || slots.includes(skill.skillId)) return false;
  target.combat.addSkill(skill.skillId);
  target.petTeamRevenge = {skillId: skill.skillId,
    expiresAt: now + skill.functions[0].t * 1000};
  recompute();
  return true;
}

/** Only the slot installed by this transient state is withdrawn. */
export function clearPetTeamRevenge(target: Pick<RevengeRecipient,
    'combat' | 'petTeamRevenge'>, recompute: () => void): void {
  const state = target.petTeamRevenge;
  if (!state) return;
  const slot = target.combat.record?.arrays.get(4)?.indexOf(state.skillId) ?? -1;
  if (slot !== -1) target.combat.removeSkillAt(slot);
  delete target.petTeamRevenge;
  recompute();
}

export function advancePetTeamRevenge(target: Pick<RevengeRecipient,
    'combat' | 'petTeamRevenge' | 'alive'>, now: number, recompute: () => void): void {
  if (target.petTeamRevenge && (!target.alive || now >= target.petTeamRevenge.expiresAt)) {
    clearPetTeamRevenge(target, recompute);
  }
}
