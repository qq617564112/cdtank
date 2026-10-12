import type {KitbagInventory} from '../../../apps/server/src/battle/items/inventory';

/** Original440fd7 UMsgDeleteInKitbag, independent of request dispatch. */
export function applyKitbagDeletion(inventory: KitbagInventory, instanceId: number,
  notifyQuantity?: (instanceId: number, battleQuantity: number) => void): void {
  const id = instanceId >>> 0;
  const record = inventory.primary.find(record => (record.instanceId >>> 0) === id)
    ?? inventory.secondary.find(record => (record.instanceId >>> 0) === id);
  if (!record) return;
  record.battleQuantity = (record.battleQuantity - 1) >>> 0;
  record.ownedQuantity = (record.ownedQuantity - 1) >>> 0;
  notifyQuantity?.(id, record.battleQuantity);
}
