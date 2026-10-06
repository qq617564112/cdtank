import type {OwnedRoleBaseRecord} from '../../../../shared/contracts/owned-base';
import type {OwnedRoleEquipmentRecord} from '../../../../shared/contracts/owned-equipment';

/** Original41e9f1: owned base instance → record+8 → PetTable. */
export function resolveOwnedRolePet<T>(records: ReadonlyMap<number, OwnedRoleBaseRecord | undefined>,
    instanceId: number, lookupPet: ((tableId: number) => T | undefined) | undefined): T | undefined {
  const record = records.get(instanceId >>> 0);
  if (!record || !lookupPet) return undefined;
  return lookupPet(record.fields.get(8)! >>> 0);
}

/** Original421f88: owned equipment instance → record+24 → TankTable. */
export function resolveOwnedRoleTank<T>(records: ReadonlyMap<number, OwnedRoleEquipmentRecord | undefined>,
    instanceId: number, lookupTank: ((tableId: number) => T | undefined) | undefined): T | undefined {
  const record = records.get(instanceId >>> 0);
  if (!record || !lookupTank) return undefined;
  return lookupTank(record.fields.get(0x24)! >>> 0);
}
