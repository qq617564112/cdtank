import type {OwnedRoleEquipmentRecord} from '../../../apps/shared/contracts/owned-equipment';

/** Original4e63a0–4e63d1 →4265e5: selection compares records before emitting3ab4. */
export function requestRoleTankSelection(selected: OwnedRoleEquipmentRecord,
    current: OwnedRoleEquipmentRecord | undefined,
    send: (instanceId: number) => void): boolean {
  if (selected === current) return false;
  send(selected.fields.get(0x1c)! >>> 0);
  return true;
}
