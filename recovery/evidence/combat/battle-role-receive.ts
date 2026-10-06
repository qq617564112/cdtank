import {bindRoleSourceTables, type RoleTableBinding} from './role-table-binding';
import type {RolePetBaseDefinition} from '../../../apps/shared/contracts/role-base';
import type {RoleTankBaseDefinition} from '../../../apps/shared/contracts/role-base';

export interface BattleRoleRecord {
  objectId: number;
  field8: number;
  field68: number;
  field78: number;
  status: number;
}

export interface BattleRoleBinding<R extends BattleRoleRecord> extends RoleTableBinding {
  record: R | undefined;
  objectId: number;
}

export interface BattleRoleManager<B> {
  localObjectId: number;
  localRole: B | undefined;
}

/** Original4264c4 with4231fc: prepare, create/bind, tables, local selection, lifecycle. */
export function receiveBattleRole<R extends BattleRoleRecord, B extends BattleRoleBinding<R>>(
    manager: BattleRoleManager<B>, record: R, context: number, callbacks: {
      find(objectId: number): B | undefined;
      create(): B;
      attach(role: B): void;
      lookupPet(tableId: number): RolePetBaseDefinition | undefined;
      lookupTank(tableId: number): RoleTankBaseDefinition | undefined;
      initialize(role: B): void;
      selectLocal(role: B): void;
      dispatchStatus(role: B, status: number): void;
    }): B {
  // Original player-record virtual+44 is52273e, storing globalGame+c0 atrecord+8.
  record.field8 = context >>> 0;
  let role = callbacks.find(record.objectId >>> 0);
  const created = role === undefined;
  role ??= callbacks.create();
  // Original431d5c stores the record and caches its object ID; no owned-source copy.
  role.record = record;
  role.objectId = record.objectId >>> 0;
  if (created) callbacks.attach(role);
  bindRoleSourceTables(role, record, callbacks.lookupPet, callbacks.lookupTank);
  const local = (record.objectId >>> 0) === (manager.localObjectId >>> 0);
  if (local) manager.localRole = role;
  // Network role override422ba6 requires the role record only.
  callbacks.initialize(role);
  if (local) callbacks.selectLocal(role);
  callbacks.dispatchStatus(role, role.record.status | 0);
  return role;
}
