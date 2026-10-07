import {combatItems, combatSkills} from '../catalog';
import {readGroupTrapRule} from './group-trap-rule';

export interface TrapRestraintRule {
  itemTableId: number;
  placementSkillId: number;
  effectSkillId: number;
  groundModelId: number;
  groundDurationMs: number;
  triggerRadius: number;
  restraintDurationMs: number;
}

/** Source fields are confirmed; Func12 time/radius/model interpretation is rebuilt. */
export function readTrapRestraintRule(itemId = 3003): TrapRestraintRule | undefined {
  if (itemId === 3007) {
    const group = readGroupTrapRule(itemId);
    return group ? {itemTableId: group.itemTableId, placementSkillId: group.placementSkillId,
      effectSkillId: group.move.effectSkillId, groundModelId: group.groundModelId,
      groundDurationMs: group.groundDurationMs, triggerRadius: group.move.triggerRadius,
      restraintDurationMs: group.move.restraintDurationMs} : undefined;
  }
  const item = combatItems.get(itemId);
  const placement = item ? combatSkills.get(item.skillIds[0]) : undefined;
  const create = placement?.functions[0];
  const effect = create ? combatSkills.get(create.y) : undefined;
  const restraint = effect?.functions[0];
  if (!item || item.itemType !== 4 || !placement || placement.skillId !== 3003
      || !create || create.type !== 12 || create.z !== item.itemTableId
      || !effect || effect.skillId !== 4001 || !restraint || restraint.type !== 3) return undefined;
  return {itemTableId: item.itemTableId, placementSkillId: placement.skillId, effectSkillId: 4001,
    groundModelId: create.z, groundDurationMs: create.t * 1000,
    triggerRadius: create.x, restraintDurationMs: restraint.t * 1000};
}

export interface TrapRestraintState {
  itemTableId: number;
  skillId: number;
  expiresAt: number;
  removedMovePermission: 1;
}

export interface TrapRestraintParticipant {
  alive: boolean;
  combat: {readonly status: number};
  trapRestraint?: TrapRestraintState;
}

export interface TrapMovePermissionProvider {
  readMovePermissionCount(): number | undefined;
  writeMovePermissionCount(count: number): void;
}

export interface TrapRestraintChange {
  kind: 'applied' | 'expired' | 'cleared' | 'reset';
  state: TrapRestraintState;
  movePermissionChanged: boolean;
  movePermissionCount?: number;
}

/** Rebuilt single-contact authority removes one original uint8 straight-move permission. */
export function applyTrapRestraint(target: TrapRestraintParticipant, now: number,
    permission: TrapMovePermissionProvider, itemId = 3003): TrapRestraintChange | undefined {
  if (!target.alive || target.combat.status !== 2 || target.trapRestraint) return undefined;
  const rule = readTrapRestraintRule(itemId);
  const count = permission.readMovePermissionCount();
  if (!rule || count === undefined || count <= 0) return undefined;
  const next = (count - 1) & 255;
  const state: TrapRestraintState = {itemTableId: rule.itemTableId, skillId: rule.effectSkillId,
    expiresAt: now + rule.restraintDurationMs, removedMovePermission: 1};
  permission.writeMovePermissionCount(next);
  target.trapRestraint = state;
  return {kind: 'applied', state, movePermissionChanged: true, movePermissionCount: next};
}

/** Round/death reset discards this contribution; the role lifecycle initializes flags. */
export function resetTrapRestraint(target: TrapRestraintParticipant): TrapRestraintChange | undefined {
  const state = target.trapRestraint;
  if (!state) return undefined;
  delete target.trapRestraint;
  return {kind: 'reset', state, movePermissionChanged: false};
}

/** Server-time expiry restores this trap's one contribution, preserving other count changes. */
export function expireTrapRestraint(target: TrapRestraintParticipant, now: number,
    permission: TrapMovePermissionProvider): TrapRestraintChange | undefined {
  const state = target.trapRestraint;
  if (!state) return undefined;
  if (!target.alive || target.combat.status !== 2) return resetTrapRestraint(target);
  if (now < state.expiresAt) return undefined;
  return restoreTrapMovePermission(target, permission, 'expired');
}

/** Rebuilt abnormal-state cure restores only this trap's contribution, before its deadline. */
export function clearTrapRestraint(target: TrapRestraintParticipant,
    permission: TrapMovePermissionProvider): TrapRestraintChange | undefined {
  if (!target.trapRestraint) return undefined;
  if (!target.alive || target.combat.status !== 2) return resetTrapRestraint(target);
  return restoreTrapMovePermission(target, permission, 'cleared');
}

function restoreTrapMovePermission(target: TrapRestraintParticipant,
    permission: TrapMovePermissionProvider, kind: 'expired' | 'cleared'): TrapRestraintChange {
  const state = target.trapRestraint!;
  const count = permission.readMovePermissionCount();
  if (count === undefined) return resetTrapRestraint(target)!;
  const next = (count + state.removedMovePermission) & 255;
  permission.writeMovePermissionCount(next);
  delete target.trapRestraint;
  return {kind, state, movePermissionChanged: true, movePermissionCount: next};
}
