import type {RoleSkillRecord} from '../contracts/role-skills';

/** Numeric columns19–46 of the source skill table; units/formulas require runtime evidence. */
export type CombatSkillAttribute = 'MaxHP' | 'HP' | 'HPRegainRate' | 'HPDrain' | 'Critical'
  | 'Lucky' | 'AtkBase' | 'Atk' | 'AtkBonus' | 'Def' | 'DefBonus' | 'SideDef' | 'BackDef'
  | 'ItemMove' | 'ItemTurn' | 'Delay' | 'MaxBullet' | 'LoadTime' | 'MaxCounter' | 'StunRate'
  | 'PartSlot' | 'RadarA' | 'RadarB' | 'RadarC' | 'STankMastery' | 'MTankMastery'
  | 'LTankMastery' | 'StugMastery';

export interface CombatSkillDefinition extends RoleSkillRecord {
  name: string;
  info: string;
  target: number;
  range: number;
  attributes: Record<CombatSkillAttribute, number>;
  effects: {effectId: number; sound: string; tag: number; method: number}[];
  functions: {type: number; t: number; x: number; y: number; z: number}[];
}

export interface CombatItemDefinition {
  itemTableId: number;
  name: string;
  info: string;
  iconId?: number;
  /** Exact original ItemMoney and ItemCoin columns; not acquisition authority. */
  moneyPrice?: number;
  tokenPrice?: number;
  /** Original GGet/+f4 display selector, not purchase eligibility. */
  getMethod?: number;
  /** Original Durable/+f8 display field, not purchase quantity. */
  durable?: number;
  /** Original ItemTable+fc maintenance gate. */
  breakMode?: number;
  itemType: number;
  battleUseMax: number;
  skillIds: number[];
  /** Original ItemTable+74/+80/+8c and sound array+98. */
  effects?: {effectId: number; sound: string; tag: number; method: number}[];
}

/** Original table metadata; it does not grant ownership or dispatch skills. */
export interface CombatCatalog {
  skills: CombatSkillDefinition[];
  petSkillPrices?: {skillId: number; groupId: number; level: number; cost: number}[];
  items: CombatItemDefinition[];
  dataScales: CombatDataScaleDefinition[];
  /** Original PetTable metadata; ownership comes from the snapshot petId. */
  petTypes?: {petId: number; petType: number; petSize?: number; petMoney?: number; baseIds?: number[]; rankCaps?: number[]}[];
  /** Original TankTable metadata, independent of sale availability. */
  tankTypes?: {tankId: number; tankType: number; partSlotCount?: number; tankMoney?: number; tankCoin?: number}[];
}

export interface CombatDataScaleDefinition {
  id: number;
  name: string;
  minimum: number;
  maximum: number;
}
