import {classifyItemId} from '../../../../shared/combat/item-hotkeys';

export interface RoleEquipmentItem {
  instanceId: number;
  itemTableId: number;
}

export interface RoleEquipmentRequest {
  instanceId: number;
  slot: number;
}

export interface RoleEquipmentContext {
  partSlotCount: number;
  /** Original owned tank+58: three definition IDs, independent of equipped instances. */
  parts: readonly number[];
  /** Original role array selector2. */
  equipped: readonly number[];
  lookupItem: (instanceId: number) => RoleEquipmentItem | undefined;
}

/** Original42762e: emit3abb or report a local conflict; never mutate equipment. */
export function requestRoleEquipment(context: RoleEquipmentContext,
    record: RoleEquipmentItem | undefined, slot: number,
    send: (request: RoleEquipmentRequest) => void,
    notifyConflict?: (category: number) => void,
    notifySlotLimit?: () => void): boolean {
  if (!record) return false;
  const category = classifyItemId(record.itemTableId);
  if (category >= 8 && category <= 12) {
    const count = context.partSlotCount | 0;
    if ((slot | 0) >= count) {
      notifySlotLimit?.();
      return false;
    }
    for (let index = 0; index < 3; index++) {
      const partId = context.parts[index] >>> 0;
      if (partId && classifyItemId(partId) === category && notifyConflict) {
        notifyConflict(category);
        return false;
      }
    }
    // The original skips the remaining conflict scan when this instance is equipped.
    let alreadyEquipped = false;
    for (let index = 0; index < count; index++) {
      if ((context.equipped[index] >>> 0) === (record.instanceId >>> 0)) {
        alreadyEquipped = true;
        break;
      }
    }
    if (!alreadyEquipped) {
      for (let index = 0; index < count; index++) {
        const instanceId = context.equipped[index] >>> 0;
        const existing = instanceId ? context.lookupItem(instanceId) : undefined;
        if (existing && classifyItemId(existing.itemTableId) === category && category !== 12 &&
            index !== (slot | 0) && notifyConflict) {
          notifyConflict(category);
          return false;
        }
      }
    }
  }
  // Packet+14 is not initialized by this entry or its constructor; reply handling uses it as an error code.
  send({instanceId: record.instanceId >>> 0, slot: slot >>> 0});
  return true;
}
