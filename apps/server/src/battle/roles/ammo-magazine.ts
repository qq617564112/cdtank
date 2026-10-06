import type {RoleCombatState} from './combat-state';
import {combatItemSkills, combatSkills} from '../catalog';

interface AmmoAuthority {
  itemId: number;
  insertedSkills: number[];
  defaultCount: number | undefined;
  refillAt: number | undefined;
}

const ammunition = new WeakMap<RoleCombatState, AmmoAuthority>();

function ammoState(role: RoleCombatState): AmmoAuthority {
  let state = ammunition.get(role);
  if (!state) {
    state = {itemId: 0, insertedSkills: [], defaultCount: undefined, refillAt: undefined};
    ammunition.set(role, state);
  }
  return state;
}

export function isDefaultAmmo(role: RoleCombatState): boolean {
  return role.selectedAmmoSlot === 1 && role.currentAmmoTableId === 2001;
}

/** Rebuilt installation producer; numeric consumers retain original selection/math. */
export function ensureSelectedAmmoSkills(role: RoleCombatState): boolean {
  const current = role.record?.arrays.get(4);
  if (!current) return false;
  const state = ammoState(role);
  const itemId = role.currentAmmoTableId;
  if (state.itemId === itemId) return true;
  const slots = [...current];
  for (const skill of state.insertedSkills) {
    const index = slots.indexOf(skill);
    if (index >= 0) {slots.splice(index, 1); slots.push(0);}
  }
  const insertedSkills: number[] = [];
  const requested = combatItemSkills.get(itemId)?.skillIds.slice(0, 3).filter(skill => combatSkills.has(skill) && !slots.includes(skill)) ?? [];
  if (slots.filter(skill => skill === 0).length < requested.length) return false;
  if (state.itemId === 2001 && state.defaultCount !== undefined) state.defaultCount = role.bulletCount;
  for (const skill of combatItemSkills.get(itemId)?.skillIds.slice(0, 3) ?? []) {
    if (!combatSkills.has(skill)) continue;
    if (slots.includes(skill)) continue;
    const index = slots.indexOf(0);
    slots[index] = skill;
    insertedSkills.push(skill);
  }
  state.insertedSkills = insertedSkills;
  state.itemId = itemId;
  role.setArray(4, slots);
  if (isDefaultAmmo(role) && state.defaultCount !== undefined) role.setBulletCount(state.defaultCount);
  return true;
}

/** First preparation/round fill uses the computed capacity, never an item-ID constant. */
export function initializeDefaultAmmoMagazine(role: RoleCombatState): void {
  if (!isDefaultAmmo(role) || role.maxBulletCount === 0) return;
  const state = ammoState(role);
  if (state.defaultCount === undefined) {
    state.defaultCount = role.maxBulletCount;
    role.setBulletCount(state.defaultCount);
  } else if (state.defaultCount > role.maxBulletCount) {
    state.defaultCount = role.maxBulletCount;
    role.setBulletCount(state.defaultCount);
  }
}

/** Successful fire commits after reload selection has read the pre-shot count. */
export function consumeDefaultAmmoMagazine(role: RoleCombatState): boolean {
  if (!isDefaultAmmo(role)) return true;
  if (role.bulletCount <= 0) return false;
  const state = ammoState(role);
  state.defaultCount = role.bulletCount - 1;
  role.setBulletCount(state.defaultCount);
  if (state.defaultCount === 0) state.refillAt = role.nextAvailableSeconds;
  return true;
}

/** The last-round deadline refills ordinary ammo when its attributes are selected. */
export function advanceDefaultAmmoMagazine(role: RoleCombatState, currentSeconds: number, magazineReady: boolean): void {
  const state = ammoState(role);
  if (state.refillAt === undefined || Math.fround(currentSeconds) < Math.fround(state.refillAt)) return;
  // Capacity belongs to ordinary ammo; defer until its attributes are selected again.
  if (!isDefaultAmmo(role) || !magazineReady || role.maxBulletCount === 0) return;
  state.defaultCount = role.maxBulletCount;
  state.refillAt = undefined;
  role.setBulletCount(state.defaultCount);
}

/** Rebuilt life/round policy resets only the ordinary magazine's producer state. */
export function resetAmmoMagazine(role: RoleCombatState): void {
  const state = ammoState(role);
  state.defaultCount = undefined;
  state.refillAt = undefined;
  role.setBulletCount(0);
}
