import {gameContent} from '../content/catalog';
import type {BattleItemRecord} from './item-hotkeys';

export interface InventoryItemRecord extends BattleItemRecord {
  state: number;
}

/** Original role getter44/45 and arrays1/2 consumed by43ed18. */
export interface InventoryRoleBindings {
  field44: number;
  field45: number;
  array1: ArrayLike<number>;
  array2: ArrayLike<number>;
}

/** Original4396e0 inventory classification, distinct from shortcut439762. */
export function classifyInventoryCategory(itemTableId: number): number {
  return gameContent().items.get(itemTableId >>> 0)?.inventoryCategory ?? 0;
}

/** Original43ed18 UMsgQueryItemsResult; groups match vector offsets10..80. */
export function applyInventoryQuery(groups: InventoryItemRecord[][],
  records: readonly InventoryItemRecord[], role: InventoryRoleBindings | undefined,
  warnZeroQuantity?: () => void): void {
  if (!role) return;
  for (const group of groups) group.length = 0;
  let hasZeroQuantity = false;
  for (const record of records) {
    hasZeroQuantity ||= (record.ownedQuantity >>> 0) === 0;
    record.state = 0;
    const category = classifyInventoryCategory(record.itemTableId);
    if (category) groups[[0, 1, 2, 3, 5, 6, 7][category - 1]].push(record);
  }
  if (hasZeroQuantity) warnZeroQuantity?.();
  const markEquipped = (group: number, instanceId: number) => {
    const id = instanceId >>> 0;
    if (!id) return;
    const record = groups[group].find(record => (record.instanceId >>> 0) === id);
    if (record) record.state = 2;
  };
  markEquipped(2, role.field44);
  markEquipped(5, role.field45);
  for (let slot = 0; slot < 3; slot++) markEquipped(3, role.array1[slot]);
  for (let slot = 0; slot < 5; slot++) markEquipped(5, role.array2[slot]);
}
