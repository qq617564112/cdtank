import type {RoleRecomputeTankBase, RoleRecomputePetBase} from '../../../../shared/contracts/role-base';
import type {CombatSkillDefinition} from '../../../../shared/combat/catalog';
import type {RoleDataScaleLimit} from './data-scale';
import {selectRoleSkills, type RoleSkillSources, type RoleItemSkills} from './skills';
import {roleSkillMultiplier} from './reload';
import {initializeRoleMovementValues, accumulateRoleMovementSkill} from './recompute-movement';
import {applyRoleEffectiveMastery} from './recompute-effective-mastery';

export interface RoleArmorValues {
  roleIntegers: Map<number, number>;
  roleFloats: Map<number, number>;
}

/** Original4334e8 armor fields, without owned HP/Critical/Lucky. */
export function initializeRoleArmorValues(ownedAtkBonus: number, ownedDefBonus: number,
    tank: RoleRecomputeTankBase): RoleArmorValues {
  return {roleIntegers: new Map([[0x70, 0], [0x78, ownedAtkBonus | 0], [0x88, ownedDefBonus | 0]]),
    roleFloats: new Map([[0x74, 0], [0x7c, 0], [0x84, Math.fround(tank.fieldA8 | 0)],
      [0x80, Math.fround(tank.fieldA4 | 0)]])};
}

type ArmorAttribute = 'Atk' | 'AtkBase' | 'AtkBonus' | 'BackDef' | 'Def' | 'DefBonus' | 'SideDef';
const armorOffsets: Record<ArmorAttribute, number> = {
  Atk: 0x74, AtkBase: 0x70, AtkBonus: 0x78, BackDef: 0x84,
  Def: 0x7c, DefBonus: 0x88, SideDef: 0x80,
};

/** Original432951 preserves each armor field's multiplication and storage type. */
export function accumulateRoleArmorAttribute(state: RoleArmorValues, skill: CombatSkillDefinition,
    multiplier: number, attribute: ArmorAttribute): void {
  const offset = armorOffsets[attribute], value = skill.attributes[attribute];
  if (attribute === 'AtkBase' || attribute === 'AtkBonus' || attribute === 'DefBonus') {
    state.roleIntegers.set(offset, (state.roleIntegers.get(offset)! + Math.imul(value, multiplier)) | 0);
  } else {
    const increment = attribute === 'Atk' || attribute === 'BackDef'
      ? (value | 0) * multiplier : Math.imul(value, multiplier);
    state.roleFloats.set(offset, Math.fround(state.roleFloats.get(offset)! + increment));
  }
}

/** Original4337d7 armor limits precede mastery bonuses. */
export function limitRoleArmorValue(target: Map<number, number>, offset: number,
    limit: RoleDataScaleLimit): void {
  let value = target.get(offset)!;
  if (value > limit.upper) value = limit.upper;
  if (value < limit.lower) value = limit.lower;
  target.set(offset, value);
}

/** Original421c4b/421c7a use an int32 affine factor and uint32 owned fields. */
export function applyRoleArmorMastery(state: RoleArmorValues, mastery: number,
    ownedAtk: number, ownedDef: number): void {
  const factor = ((Math.imul(mastery, 5) + 10) << 2) * Math.fround(.01);
  state.roleFloats.set(0x74, Math.fround(state.roleFloats.get(0x74)! + factor * (ownedAtk >>> 0)));
  state.roleFloats.set(0x7c, Math.fround(state.roleFloats.get(0x7c)! + factor * (ownedDef >>> 0)));
}

/** Original433c55 stores these four final percentages as float32. */
export function convertRoleArmorValues(state: RoleArmorValues): void {
  for (const offset of [0x74, 0x7c, 0x84, 0x80]) {
    state.roleFloats.set(offset, Math.fround(state.roleFloats.get(offset)! * Math.fround(.01)));
  }
}

export interface RoleArmorRecomputeInput {
  ownedField34: number | undefined;
  ownedAtk: number | undefined;
  ownedAtkBonus: number | undefined;
  ownedDef: number | undefined;
  ownedDefBonus: number | undefined;
  tank: RoleRecomputeTankBase;
  tankType: number;
  pet: RoleRecomputePetBase;
  sources: RoleSkillSources;
  skills: ReadonlyMap<number, CombatSkillDefinition>;
  items: ReadonlyMap<number, RoleItemSkills>;
  limits: ReadonlyMap<number, RoleDataScaleLimit>;
  roleValue9: number;
}

/** Qualified attribute composition only; no projectile damage or HP writes. */
export function recomputeQualifiedRoleArmor(input: RoleArmorRecomputeInput): {
  attackBase: number; attackBonus: number; attackPercent: number;
  defenseBonus: number; defensePercent: number; sideDefensePercent: number; backDefensePercent: number;
  selectedSkillIds: number[];
} | undefined {
  const {ownedField34, ownedAtk, ownedAtkBonus, ownedDef, ownedDefBonus} = input;
  if (ownedField34 === undefined || ownedAtk === undefined || ownedAtkBonus === undefined ||
      ownedDef === undefined || ownedDefBonus === undefined || !input.sources.currentSkillIds ||
      ![7, 8, 9, 10, 11, 13, 12].every(id => input.limits.has(id))) return undefined;
  const state = initializeRoleArmorValues(ownedAtkBonus, ownedDefBonus, input.tank);
  const values = initializeRoleMovementValues(input.tank, input.pet);
  const selected = selectRoleSkills(input.sources, input.skills, input.items);
  for (const skill of selected) {
    const multiplier = roleSkillMultiplier(skill.triggerType, input.roleValue9, skill.functions[0]!.z);
    for (const attribute of ['Atk', 'AtkBase', 'AtkBonus', 'BackDef', 'Def', 'DefBonus', 'SideDef'] as const) {
      accumulateRoleArmorAttribute(state, skill, multiplier, attribute);
    }
    accumulateRoleMovementSkill(values, skill, multiplier);
  }
  for (const [target, offset, id] of [[state.roleIntegers, 0x70, 7], [state.roleFloats, 0x74, 8],
    [state.roleIntegers, 0x78, 9], [state.roleFloats, 0x7c, 10], [state.roleIntegers, 0x88, 11],
    [state.roleFloats, 0x84, 13], [state.roleFloats, 0x80, 12]] as const) {
    limitRoleArmorValue(target, offset, input.limits.get(id)!);
  }
  const mastery = applyRoleEffectiveMastery(values, ownedField34, input.tankType);
  if (mastery === undefined) return undefined;
  applyRoleArmorMastery(state, mastery, ownedAtk, ownedDef);
  convertRoleArmorValues(state);
  return {attackBase: state.roleIntegers.get(0x70)!, attackBonus: state.roleIntegers.get(0x78)!,
    attackPercent: state.roleFloats.get(0x74)!, defenseBonus: state.roleIntegers.get(0x88)!,
    defensePercent: state.roleFloats.get(0x7c)!, sideDefensePercent: state.roleFloats.get(0x80)!,
    backDefensePercent: state.roleFloats.get(0x84)!, selectedSkillIds: selected.map(skill => skill.skillId)};
}
