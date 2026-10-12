import {classifyItemId} from '../../../apps/shared/combat/item-hotkeys';
import type {RoleEquipmentItem} from '../../../apps/server/src/accounts/equipment/request';

/** Original4236ac OnEquipItemError: no equipment/profile mutation. */
export function reportRoleEquipmentError(message: {instanceId: number; field14: number},
    lookupItem: (instanceId: number) => RoleEquipmentItem | undefined,
    notifyConflict?: (category: number) => void, notifySlotLimit?: () => void): void {
  const record = lookupItem(message.instanceId >>> 0);
  if (message.field14 === 0 && notifyConflict) {
    notifyConflict(classifyItemId(record!.itemTableId));
  } else if (message.field14 === 2) {
    notifySlotLimit?.();
  }
}
