import type {RoleRecomputeTankBase, RoleRecomputePetBase} from '../../../../shared/contracts/role-base';
import type {CombatSkillDefinition} from '../../../../shared/combat/catalog';
import type {OwnedRoleBaseRecord} from '../../../../shared/contracts/owned-base';
import type {OwnedRoleEquipmentRecord} from '../../../../shared/contracts/owned-equipment';
import {initializeRoleRecomputeBase, type RoleRecomputeValues} from './recompute-base';
import {selectRoleSkills, type RoleSkillSources, type RoleItemSkills} from './skills';
import {accumulateRoleRecomputeSkill} from './recompute-skill';
import {limitRoleRecomputeValues, convertRoleRecomputeValues} from './recompute-limits';
import {applyRoleRecomputeMastery} from './recompute-mastery';
import type {RoleDataScaleLimit} from './data-scale';
import {recomputeQualifiedRoleMovement} from './recompute-movement';

/** Inputs available before the original VIP max-HP conversion tail. */
export interface RoleRecomputePrefixInput {
  base: OwnedRoleBaseRecord;
  equipment: OwnedRoleEquipmentRecord;
  tank: RoleRecomputeTankBase;
  pet: RoleRecomputePetBase;
  sources: RoleSkillSources;
  skills: ReadonlyMap<number, CombatSkillDefinition>;
  items: ReadonlyMap<number, RoleItemSkills>;
  limits: ReadonlyMap<number, RoleDataScaleLimit>;
  roleValue9: number;
  tankType: number;
  movementScales: {move: number; turn: number};
}

function recomputePrefix(input: RoleRecomputePrefixInput,
    setMovement: (selector: 10 | 11, value: number, state: RoleRecomputeValues) => void) {
  const state = initializeRoleRecomputeBase(input.base, input.equipment, input.tank, input.pet);
  if (!input.sources.currentSkillIds) return {state, completed: false, selectedSkillIds: []};
  const selected = selectRoleSkills(input.sources, input.skills, input.items);
  for (const skill of selected) accumulateRoleRecomputeSkill(state, skill, input.roleValue9);
  limitRoleRecomputeValues(state, input.limits);
  applyRoleRecomputeMastery(state, input.equipment, input.tankType, input.movementScales,
    (selector, value) => setMovement(selector, value, state));
  return {state, completed: true, selectedSkillIds: selected.map(skill => skill.skillId)};
}

/** Read only the proven movement prefix; never publish HP, attributes or dirty notifications. */
export function recomputeRoleMovement(input: RoleRecomputePrefixInput): {speed: number; turn: number} | undefined {
  return recomputeQualifiedRoleMovement({...input, ownedField34: input.equipment.fields.get(0x34)});
}

/** Original433466 calculation with explicit resolved sources and observer boundaries. */
export function recomputeRoleAttributes(input: RoleRecomputePrefixInput & {vip: number; vipMultiplier: number}, observer: {
  setMovement(selector: 10 | 11, value: number, state: RoleRecomputeValues): void;
  notify(index: 13 | 5, state: RoleRecomputeValues): void;
  clearDirty(): void;
}): {state: RoleRecomputeValues; completed: boolean; selectedSkillIds: number[]} {
  const result = recomputePrefix(input, (selector, value, state) => observer.setMovement(selector, value, state));
  const {state} = result;
  // Original missing array getter4 exits before conversions/notifications.
  if (!result.completed) return result;
  convertRoleRecomputeValues(state, input.vip, input.vipMultiplier);
  observer.notify(13, state);
  observer.notify(5, state);
  observer.clearDirty();
  return result;
}
