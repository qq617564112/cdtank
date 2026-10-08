import {defaultAmmoId} from '../../../../shared/content/catalog';
import type {TrapFireRestraintState} from '../items/trap-fire-restraint';
import type {TrapTurnRestraintState} from '../items/trap-turn-restraint';
import type {BattleItemRecord} from '../../../../shared/combat/item-hotkeys';
import type {AmmoBurnState} from '../items/ammo-burn';
import type {AmmoRadarJamState} from '../items/ammo-radar-jam';
import type {AmmoSlowState} from '../items/ammo-slow';
import {calculateFoodHealing} from '../roles/food-healing';
import {combatItems, combatSkills} from '../catalog';
import type {TrapRestraintState} from '../items/trap-restraint';
import type {OpticalCamouflageState} from '../items/optical-camouflage';
import type {RoleDisguiseState} from '../items/role-disguise';
import {isTreasureItem} from '../../../../shared/combat/treasure-items';

interface ItemActor {
  alive: boolean;
  hp?: number;
  maxHp?: number;
  movementReady?: boolean;
  attributesReady?: boolean;
  burn?: AmmoBurnState;
  radarJam?: AmmoRadarJamState;
  ammoSlow?: AmmoSlowState;
  trapRestraint?: TrapRestraintState;
  trapTurnRestraint?: TrapTurnRestraintState;
  trapFireRestraint?: TrapFireRestraintState;
  opticalCamouflage?: OpticalCamouflageState;
  roleDisguise?: RoleDisguiseState;
  inventory?: readonly BattleItemRecord[];
  combat?: {status?: number; currentAmmoTableId?: number;
    roleFloatFields?: ReadonlyMap<number, number>; record?: {arrays: Map<number, Int32Array>}};
}

export interface TeamLifeContext {
  mode: number;
  team: number;
  initialLives: number;
  lives: readonly number[];
}

/** Rebuilt policy: replace a lost team life, never spend on an intact roster. */
export function teamLifeHotkey(actor: ItemActor, context: TeamLifeContext | undefined): number {
  if (!actor.alive || actor.combat?.status !== 2 || !context || context.mode !== 1
      || (context.team !== 0 && context.team !== 1)
      || !Number.isSafeInteger(context.initialLives) || context.initialLives <= 0
      || context.lives.length !== 2
      || !context.lives.every(value => Number.isSafeInteger(value) && value > 0)
      || context.lives[context.team] >= context.initialLives) return 0;
  return usableItems(actor).find(row => row.item.instanceId !== 0 && combatItems.get(row.item.itemTableId)?.runtime.use === 'teamLife')?.slot ?? 0;
}

function usableItems(actor: ItemActor): {slot: number; item: BattleItemRecord}[] {
  const hotkeys = actor.combat?.record?.arrays.get(0);
  const result: {slot: number; item: BattleItemRecord}[] = [];
  for (let slot = 5; slot <= 8; slot++) {
    const instance = (hotkeys?.[slot - 2] ?? 0) >>> 0;
    const item = actor.inventory?.find(record => record.instanceId === instance);
    if (item && item.ownedQuantity > 0 && item.battleQuantity > 0) result.push({slot, item});
  }
  return result;
}

/** Rebuilt policy: cure delivered negative states through the configured ordinary item input. */
export function petInjectionHotkey(actor: ItemActor): number {
  if (!actor.alive || actor.combat?.status !== 2
      || (!actor.burn && !actor.radarJam && !actor.ammoSlow && !actor.trapRestraint
        && !actor.trapTurnRestraint && !actor.trapFireRestraint)) return 0;
  return usableItems(actor).find(row => combatItems.get(row.item.itemTableId)?.runtime.use === 'cure')?.slot ?? 0;
}

/** Preserve the existing rebuilt healing decision; return an ordinary input slot only. */
export function healingHotkey(actor: ItemActor): number {
  if (!actor.alive || actor.hp === undefined || actor.maxHp === undefined) return 0;
  for (const {slot, item} of usableItems(actor)) {
    const definition = combatItems.get(item.itemTableId);
    if (definition?.runtime.use !== 'heal') continue;
    const base = combatSkills.get(definition.runtime.skillRoles.primary)?.attributes.HP ?? 0;
    const healing = calculateFoodHealing(base,
      actor.attributesReady ? actor.combat?.roleFloatFields?.get(0x8c) : undefined);
    if (healing > 0 && actor.hp < actor.maxHp
        && (actor.maxHp - actor.hp >= healing || actor.hp / actor.maxHp < combatItems.get(item.itemTableId)!.runtime.values.cpuUrgentHpRatio)) return slot;
  }
  return 0;
}

/** Rebuilt policy: spend the Func20 treasures (item20001/20002) through the same ordinary
 * input when missing life, matching their ItemSkill2 skill30005 HP effect. */
export function treasureHotkey(actor: ItemActor): number {
  if (!actor.alive || actor.combat?.status !== 2
      || actor.hp === undefined || actor.maxHp === undefined
      || !(actor.hp > 0) || !(actor.maxHp > 0) || actor.hp >= actor.maxHp) return 0;
  for (const {slot, item} of usableItems(actor)) {
    if (!isTreasureItem(item.itemTableId)) continue;
    const healing = calculateFoodHealing(combatSkills.get(combatItems.get(item.itemTableId)!.runtime.skillRoles.secondary)?.attributes.HP ?? 0,
      actor.attributesReady ? actor.combat?.roleFloatFields?.get(0x8c) : undefined);
    if (healing > 0 && (actor.maxHp - actor.hp >= healing || actor.hp / actor.maxHp < combatItems.get(item.itemTableId)!.runtime.values.cpuUrgentHpRatio)) return slot;
  }
  return 0;
}

/** Rebuilt attack-drink strategy: spend only on an accepted firing opportunity. */
export function attackDrinkHotkey(actor: ItemActor, firing: boolean): number {
  const skills = actor.combat?.record?.arrays.get(4);
  if (!actor.alive || !firing || !skills || skills.length !== 16
      || hasUseSkill(skills, 'attack') || !skills.includes(0)) return 0;
  return usableItems(actor).find(row => combatItems.get(row.item.itemTableId)?.runtime.use === 'attack')?.slot ?? 0;
}

/** Rebuilt speed-drink strategy: use only with a proven original movement request. */
export function speedDrinkHotkey(actor: ItemActor, moving: boolean): number {
  const skills = actor.combat?.record?.arrays.get(4);
  if (!actor.alive || !moving || actor.movementReady !== true || !skills || skills.length !== 16
      || hasUseSkill(skills, 'speed') || !skills.includes(0)) return 0;
  return usableItems(actor).find(row => combatItems.get(row.item.itemTableId)?.runtime.use === 'speed')?.slot ?? 0;
}

/** Rebuilt defensive policy: save the finite invincibility item for a nearby threat. */
export function invincibilityHotkey(actor: ItemActor, threatened: boolean): number {
  const skills = actor.combat?.record?.arrays.get(4);
  if (!actor.alive || !threatened || actor.hp === undefined || actor.maxHp === undefined
      || !(actor.hp > 0) || !(actor.maxHp > 0) || actor.hp > actor.maxHp * useHpRatio(actor, 'invincibility')
      || !skills || skills.length !== 16 || hasUseSkill(skills, 'invincibility') || !skills.includes(0)) return 0;
  return usableItems(actor).find(row => combatItems.get(row.item.itemTableId)?.runtime.use === 'invincibility')?.slot ?? 0;
}

/** Rebuilt defensive policy: conceal the same finite threat window as invincibility. */
export function opticalCamouflageHotkey(actor: ItemActor, threatened: boolean): number {
  const skills = actor.combat?.record?.arrays.get(4);
  if (!actor.alive || actor.combat?.status !== 2 || actor.opticalCamouflage || actor.roleDisguise || !threatened
      || actor.hp === undefined || actor.maxHp === undefined
      || !(actor.hp > 0) || !(actor.maxHp > 0) || actor.hp > actor.maxHp * useHpRatio(actor, 'camouflage')
      || !skills || skills.length !== 16 || hasUseSkill(skills, 'camouflage') || !skills.includes(0)) return 0;
  return usableItems(actor).find(row => combatItems.get(row.item.itemTableId)?.runtime.use === 'camouflage')?.slot ?? 0;
}

/** Rebuilt disguise policy: conceal only when low, threatened and not about to fire. */
export function roleDisguiseHotkey(actor: ItemActor, threatened: boolean, firing: boolean): number {
  const skills = actor.combat?.record?.arrays.get(4);
  if (!actor.alive || actor.combat?.status !== 2 || actor.roleDisguise || actor.opticalCamouflage
      || firing || !threatened || actor.hp === undefined || actor.maxHp === undefined
      || !(actor.hp > 0) || !(actor.maxHp > 0) || actor.hp > actor.maxHp * useHpRatio(actor, 'disguise')
      || !skills || skills.length !== 16 || hasUseSkill(skills, 'camouflage') || hasUseSkill(skills, 'disguise')
      || !skills.includes(0)) return 0;
  return usableItems(actor).find(row => combatItems.get(row.item.itemTableId)?.runtime.use === 'disguise')?.slot ?? 0;
}

/** Rebuilt strategy: finite armor is reserved for a nearby enemy after injury. */
export function defenseDrinkHotkey(actor: ItemActor, threatened: boolean): number {
  const skills = actor.combat?.record?.arrays.get(4);
  if (!actor.alive || !threatened || actor.hp === undefined || actor.maxHp === undefined
      || actor.hp <= 0 || actor.maxHp <= 0 || actor.hp > actor.maxHp * useHpRatio(actor, 'defense')
      || !skills || skills.length !== 16 || hasUseSkill(skills, 'defense') || !skills.includes(0)) return 0;
  return usableItems(actor).find(row => combatItems.get(row.item.itemTableId)?.runtime.use === 'defense')?.slot ?? 0;
}

/** Rebuilt turn-drink policy: spend only on an effective original turning input. */
export function turnDrinkHotkey(actor: ItemActor, turning: boolean): number {
  const skills = actor.combat?.record?.arrays.get(4);
  if (!actor.alive || !turning || actor.movementReady !== true || !skills || skills.length !== 16
      || hasUseSkill(skills, 'turn') || !skills.includes(0)) return 0;
  return usableItems(actor).find(row => combatItems.get(row.item.itemTableId)?.runtime.use === 'turn')?.slot ?? 0;
}

/** Rebuilt policy: select delivered finite ammo only for a ready firing opportunity. */
export function finiteAmmoHotkey(actor: ItemActor, firing: boolean,
  targetIsPlayer = true): number {
  if (!actor.alive || !firing || actor.combat?.status !== 2
      || actor.combat.currentAmmoTableId !== defaultAmmoId()) return 0;
  const hotkeys = actor.combat.record?.arrays.get(0);
  for (let slot = 2; slot <= 4; slot++) {
    const instance = (hotkeys?.[slot - 2] ?? 0) >>> 0;
    if (!instance) continue;
    const item = actor.inventory?.find(record => (record.instanceId >>> 0) === instance);
    if (!item || item.ownedQuantity <= 0 || item.battleQuantity <= 0) continue;
    if (combatItems.get(item.itemTableId)?.itemType !== 3) continue;
    if (!combatItems.get(item.itemTableId)?.runtime.finiteCpuAmmo) continue;
    if (!targetIsPlayer && combatItems.get(item.itemTableId)?.runtime.requiresPlayerTarget) continue;
    return slot;
  }
  return 0;
}

/** Rebuilt airstrike policy: spend delivered item13 only on a nearby enemy the CPU is not already firing at. */
export function airstrikeHotkey(actor: ItemActor, threatened: boolean, firing: boolean): number {
  if (!actor.alive || actor.combat?.status !== 2 || firing || !threatened) return 0;
  return usableItems(actor).find(row => combatItems.get(row.item.itemTableId)?.runtime.use === 'airstrike')?.slot ?? 0;
}

function hasUseSkill(skills: Int32Array, handler: string): boolean {
  return [...combatItems.values()].some(item => item.runtime.use === handler
    && skills.includes(item.runtime.skillRoles.primary));
}

function useHpRatio(actor: ItemActor, handler: string): number {
  const item = usableItems(actor).find(row => combatItems.get(row.item.itemTableId)?.runtime.use === handler);
  return item ? combatItems.get(item.item.itemTableId)!.runtime.values.cpuMaxHpRatio : 0;
}
