import {applyRoleEffectiveMastery} from './recompute-effective-mastery';
import type {RoleRecomputeTankBase, RoleRecomputePetBase} from '../../../../shared/contracts/role-base';
import type {CombatSkillDefinition} from '../../../../shared/combat/catalog';
import type {RoleDataScaleLimit} from './data-scale';
import {selectRoleSkills, type RoleSkillSources, type RoleItemSkills} from './skills';
import {roleSkillMultiplier} from './reload';

/** Original4334e8 movement locals, independent of owned life/armor fields. */
export function initializeRoleMovementValues(tank: RoleRecomputeTankBase,
    pet: RoleRecomputePetBase): number[] {
  return [tank.field84, tank.field88, pet.field7c, pet.field80, pet.field84, pet.field88]
    .map(value => value | 0);
}

/** Original432951 int32 movement and four mastery accumulation. */
export function accumulateRoleMovementSkill(values: number[], skill: CombatSkillDefinition,
    multiplier: number): void {
  const attributes = skill.attributes;
  for (const [index, value] of [attributes.ItemMove, attributes.ItemTurn,
    attributes.STankMastery, attributes.MTankMastery, attributes.LTankMastery,
    attributes.StugMastery].entries()) {
    values[index] = (values[index]! + Math.imul(value, multiplier)) | 0;
  }
}

/** Original4337d7 applies only limits14/15 to the movement locals. */
export function limitRoleMovementValues(values: number[],
    limits: ReadonlyMap<number, RoleDataScaleLimit>): void {
  for (const [index, id] of [[0, 14], [1, 15]]) {
    const {upper, lower} = limits.get(id)!;
    let value = values[index]!;
    if (value > upper) value = upper;
    if (value < lower) value = lower;
    values[index] = value;
  }
}

/** Original433ad6–433c55 uses explicit owned+34 before type and float32 conversion. */
export function applyRoleMovementMastery(values: number[], ownedField34: number,
    tankType: number, scales: {move: number; turn: number}): {
      mastery: number; speed: number; turn: number;
    } | undefined {
  const mastery = applyRoleEffectiveMastery(values, ownedField34, tankType);
  if (mastery === undefined) return undefined;
  const moveUnits = (mastery + values[0]! - 3) | 0;
  const turnUnits = (mastery + values[1]! - 3) | 0;
  return {mastery,
    speed: Math.fround(moveUnits * Math.fround(scales.move) + 50),
    turn: Math.fround(turnUnits * Math.fround(scales.turn) + Math.fround(.1919862))};
}

export interface RoleMovementRecomputeInput {
  tank: RoleRecomputeTankBase;
  pet: RoleRecomputePetBase;
  /** Undefined means absent source, never the confirmed zero condition. */
  ownedField34: number | undefined;
  tankType: number;
  sources: RoleSkillSources;
  skills: ReadonlyMap<number, CombatSkillDefinition>;
  items: ReadonlyMap<number, RoleItemSkills>;
  limits: ReadonlyMap<number, RoleDataScaleLimit>;
  roleValue9: number;
  movementScales: {move: number; turn: number};
}

/** Selected sources retain the original skill eligibility and repetition rules. */
export function recomputeQualifiedRoleMovement(input: RoleMovementRecomputeInput): {
  speed: number; turn: number;
} | undefined {
  if (!input.sources.currentSkillIds || input.ownedField34 === undefined) return undefined;
  const values = initializeRoleMovementValues(input.tank, input.pet);
  for (const skill of selectRoleSkills(input.sources, input.skills, input.items)) {
    accumulateRoleMovementSkill(values, skill,
      roleSkillMultiplier(skill.triggerType, input.roleValue9, skill.functions[0]!.z));
  }
  limitRoleMovementValues(values, input.limits);
  const result = applyRoleMovementMastery(values, input.ownedField34,
    input.tankType, input.movementScales);
  return result ? {speed: result.speed, turn: result.turn} : undefined;
}
