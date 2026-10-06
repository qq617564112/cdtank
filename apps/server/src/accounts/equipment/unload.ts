import {classifyItemId} from '../../../../shared/combat/item-hotkeys';
import type {RoleEquipmentItem} from './request';

export interface RoleEquipmentUnloadContext {
  parts: readonly number[];
  equipped: readonly number[];
  markInstanceId: number;
  skinInstanceId: number;
  lookupPart(instanceId: number): RoleEquipmentItem | undefined;
  lookupMark(instanceId: number): RoleEquipmentItem | undefined;
  lookupSkin(instanceId: number): RoleEquipmentItem | undefined;
}

/** Original4284ae: state2 and category-specific current-instance gates before3abc. */
export function requestRoleEquipmentUnload(context: RoleEquipmentUnloadContext,
    record: (RoleEquipmentItem & {state: number}) | undefined,
    send: (instanceId: number) => void): boolean {
  if (!record || record.state !== 2) return false;
  const category = classifyItemId(record.itemTableId);
  const same = (current: RoleEquipmentItem | undefined): boolean => current !== undefined &&
    (current.instanceId >>> 0) === (record.instanceId >>> 0);
  if (category === 5) {
    if (!same(context.lookupSkin(context.skinInstanceId >>> 0))) return false;
  } else if (category === 7) {
    if (!same(context.lookupMark(context.markInstanceId >>> 0))) return false;
  } else if (category >= 8 && category <= 12) {
    // The unload entry uses five minus fixed parts, independently of dynamic421cbe.
    const count = 5 - context.parts.slice(0, 3).filter(value => (value >>> 0) !== 0).length;
    let found = false;
    for (let slot = 0; slot < count; slot++) {
      if (same(context.lookupPart(context.equipped[slot] >>> 0))) {found = true; break;}
    }
    if (!found) return false;
  }
  // Original constructor/caller do not initialize packet+10; send only the proven instance.
  send(record.instanceId >>> 0);
  return true;
}
