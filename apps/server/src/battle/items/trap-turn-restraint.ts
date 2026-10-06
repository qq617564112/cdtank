import {combatItems, combatSkills} from '../catalog';

export interface TrapTurnRestraintRule {
  itemTableId: 3004;
  placementSkillId: number;
  effectSkillId: 4002;
  groundModelId: number;
  groundDurationMs: number;
  triggerRadius: number;
  restraintDurationMs: number;
}

/** Source fields are confirmed; Func12 time/radius/model interpretation is rebuilt. */
export function readTrapTurnRestraintRule(): TrapTurnRestraintRule | undefined {
  const item = combatItems.get(3004);
  const placement = item ? combatSkills.get(item.skillIds[0]) : undefined;
  const create = placement?.functions[0];
  const effect = create ? combatSkills.get(create.y) : undefined;
  const restraint = effect?.functions[0];
  if (!item || item.itemType !== 4 || !placement || placement.skillId !== 3004
      || !create || create.type !== 12 || create.z !== item.itemTableId
      || !effect || effect.skillId !== 4002 || !restraint || restraint.type !== 4) return undefined;
  return {itemTableId: 3004, placementSkillId: placement.skillId, effectSkillId: 4002,
    groundModelId: create.z, groundDurationMs: create.t * 1000,
    triggerRadius: create.x, restraintDurationMs: restraint.t * 1000};
}

export interface TrapTurnRestraintState {
  itemTableId: 3004;
  skillId: 4002;
  expiresAt: number;
  removedTurnPermission: 1;
}

export interface TrapTurnRestraintParticipant {
  alive: boolean;
  combat: {readonly status: number};
  trapTurnRestraint?: TrapTurnRestraintState;
}

export interface TrapTurnPermissionProvider {
  readTurnPermissionCount(): number | undefined;
  writeTurnPermissionCount(count: number): void;
}

export interface TrapTurnRestraintChange {
  kind: 'applied' | 'expired' | 'cleared' | 'reset';
  state: TrapTurnRestraintState;
  turnPermissionChanged: boolean;
  turnPermissionCount?: number;
}

/** Rebuilt single-contact authority removes one original uint8 turn permission. */
export function applyTrapTurnRestraint(target: TrapTurnRestraintParticipant, now: number,
    permission: TrapTurnPermissionProvider): TrapTurnRestraintChange | undefined {
  if (!target.alive || target.combat.status !== 2 || target.trapTurnRestraint) return undefined;
  const rule = readTrapTurnRestraintRule();
  const count = permission.readTurnPermissionCount();
  if (!rule || count === undefined || count <= 0) return undefined;
  const next = (count - 1) & 255;
  const state: TrapTurnRestraintState = {itemTableId: 3004, skillId: 4002,
    expiresAt: now + rule.restraintDurationMs, removedTurnPermission: 1};
  permission.writeTurnPermissionCount(next);
  target.trapTurnRestraint = state;
  return {kind: 'applied', state, turnPermissionChanged: true, turnPermissionCount: next};
}

/** Round/death reset discards this contribution; the role lifecycle initializes flags. */
export function resetTrapTurnRestraint(target: TrapTurnRestraintParticipant): TrapTurnRestraintChange | undefined {
  const state = target.trapTurnRestraint;
  if (!state) return undefined;
  delete target.trapTurnRestraint;
  return {kind: 'reset', state, turnPermissionChanged: false};
}

/** Server-time expiry restores this trap's one contribution, preserving other count changes. */
export function expireTrapTurnRestraint(target: TrapTurnRestraintParticipant, now: number,
    permission: TrapTurnPermissionProvider): TrapTurnRestraintChange | undefined {
  const state = target.trapTurnRestraint;
  if (!state) return undefined;
  if (!target.alive || target.combat.status !== 2) return resetTrapTurnRestraint(target);
  if (now < state.expiresAt) return undefined;
  return restoreTrapTurnPermission(target, permission, 'expired');
}

/** Rebuilt abnormal-state cure restores only this trap's contribution, before its deadline. */
export function clearTrapTurnRestraint(target: TrapTurnRestraintParticipant,
    permission: TrapTurnPermissionProvider): TrapTurnRestraintChange | undefined {
  if (!target.trapTurnRestraint) return undefined;
  if (!target.alive || target.combat.status !== 2) return resetTrapTurnRestraint(target);
  return restoreTrapTurnPermission(target, permission, 'cleared');
}

function restoreTrapTurnPermission(target: TrapTurnRestraintParticipant,
    permission: TrapTurnPermissionProvider, kind: 'expired' | 'cleared'): TrapTurnRestraintChange {
  const state = target.trapTurnRestraint!;
  const count = permission.readTurnPermissionCount();
  if (count === undefined) return resetTrapTurnRestraint(target)!;
  const next = (count + state.removedTurnPermission) & 255;
  permission.writeTurnPermissionCount(next);
  delete target.trapTurnRestraint;
  return {kind, state, turnPermissionChanged: true, turnPermissionCount: next};
}
