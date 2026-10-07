import {combatItems, combatSkills} from '../catalog';
import {readGroupTrapRule} from './group-trap-rule';

export interface TrapFireRestraintRule {
  itemTableId: number;
  placementSkillId: number;
  effectSkillId: number;
  groundModelId: number;
  groundDurationMs: number;
  triggerRadius: number;
  restraintDurationMs: number;
}

/** Source fields are confirmed; Func12 time/radius/model interpretation is rebuilt. */
export function readTrapFireRestraintRule(itemId = 3005): TrapFireRestraintRule | undefined {
  if (itemId === 3007) {
    const group = readGroupTrapRule(itemId);
    return group ? {itemTableId: group.itemTableId, placementSkillId: group.placementSkillId,
      effectSkillId: group.fire.effectSkillId, groundModelId: group.groundModelId,
      groundDurationMs: group.groundDurationMs, triggerRadius: group.fire.triggerRadius,
      restraintDurationMs: group.fire.restraintDurationMs} : undefined;
  }
  const item = combatItems.get(itemId);
  const placement = item ? combatSkills.get(item.skillIds[0]) : undefined;
  const create = placement?.functions[0];
  const effect = create ? combatSkills.get(create.y) : undefined;
  const restraint = effect?.functions[0];
  if (!item || item.itemType !== 4 || !placement || placement.skillId !== 3005
      || !create || create.type !== 12 || create.z !== item.itemTableId
      || !effect || effect.skillId !== 4003 || !restraint || restraint.type !== 5) return undefined;
  return {itemTableId: item.itemTableId, placementSkillId: placement.skillId, effectSkillId: 4003,
    groundModelId: create.z, groundDurationMs: create.t * 1000,
    triggerRadius: create.x, restraintDurationMs: restraint.t * 1000};
}

export interface TrapFireRestraintState {
  itemTableId: number;
  skillId: number;
  expiresAt: number;
  removedFirePermission: 1;
}

export interface TrapFireRestraintParticipant {
  alive: boolean;
  combat: {readonly status: number};
  trapFireRestraint?: TrapFireRestraintState;
}

export interface TrapFirePermissionProvider {
  readFirePermissionCount(): number | undefined;
  writeFirePermissionCount(count: number): void;
}

export interface TrapFireRestraintChange {
  kind: 'applied' | 'expired' | 'cleared' | 'reset';
  state: TrapFireRestraintState;
  firePermissionChanged: boolean;
  firePermissionCount?: number;
}

/** Rebuilt single-contact authority removes one original uint8 fire permission. */
export function applyTrapFireRestraint(target: TrapFireRestraintParticipant, now: number,
    permission: TrapFirePermissionProvider, itemId = 3005): TrapFireRestraintChange | undefined {
  if (!target.alive || target.combat.status !== 2 || target.trapFireRestraint) return undefined;
  const rule = readTrapFireRestraintRule(itemId);
  const count = permission.readFirePermissionCount();
  if (!rule || count === undefined || count <= 0) return undefined;
  const next = (count - 1) & 255;
  const state: TrapFireRestraintState = {itemTableId: rule.itemTableId, skillId: rule.effectSkillId,
    expiresAt: now + rule.restraintDurationMs, removedFirePermission: 1};
  permission.writeFirePermissionCount(next);
  target.trapFireRestraint = state;
  return {kind: 'applied', state, firePermissionChanged: true, firePermissionCount: next};
}

/** Round/death reset discards this contribution; the role lifecycle initializes flags. */
export function resetTrapFireRestraint(target: TrapFireRestraintParticipant): TrapFireRestraintChange | undefined {
  const state = target.trapFireRestraint;
  if (!state) return undefined;
  delete target.trapFireRestraint;
  return {kind: 'reset', state, firePermissionChanged: false};
}

/** Server-time expiry restores this trap's one contribution, preserving other count changes. */
export function expireTrapFireRestraint(target: TrapFireRestraintParticipant, now: number,
    permission: TrapFirePermissionProvider): TrapFireRestraintChange | undefined {
  const state = target.trapFireRestraint;
  if (!state) return undefined;
  if (!target.alive || target.combat.status !== 2) return resetTrapFireRestraint(target);
  if (now < state.expiresAt) return undefined;
  return restoreTrapFirePermission(target, permission, 'expired');
}

/** Rebuilt abnormal-state cure restores only this trap's contribution, before its deadline. */
export function clearTrapFireRestraint(target: TrapFireRestraintParticipant,
    permission: TrapFirePermissionProvider): TrapFireRestraintChange | undefined {
  if (!target.trapFireRestraint) return undefined;
  if (!target.alive || target.combat.status !== 2) return resetTrapFireRestraint(target);
  return restoreTrapFirePermission(target, permission, 'cleared');
}

function restoreTrapFirePermission(target: TrapFireRestraintParticipant,
    permission: TrapFirePermissionProvider, kind: 'expired' | 'cleared'): TrapFireRestraintChange {
  const state = target.trapFireRestraint!;
  const count = permission.readFirePermissionCount();
  if (count === undefined) return resetTrapFireRestraint(target)!;
  const next = (count + state.removedFirePermission) & 255;
  permission.writeFirePermissionCount(next);
  delete target.trapFireRestraint;
  return {kind, state, firePermissionChanged: true, firePermissionCount: next};
}
