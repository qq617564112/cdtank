import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';

/** Confirm only: the successful item module applies its own quantity decrement. */
export function confirmBattleItemConsumption(player: {
  id: string; cpu?: unknown; inventory: readonly InventoryWireRecord[];
} | undefined, instanceId: number, expectedOwned: number, itemTableId: number,
  persist?: (playerId: string, instanceId: number, expectedOwned: number, itemTableId: number) => boolean): boolean {
  if (!player) return false;
  if (player.cpu) {
    const item = player.inventory.find(record => record.instanceId === instanceId);
    return !!item && item.itemTableId === itemTableId && expectedOwned > 0
      && item.ownedQuantity === expectedOwned && item.battleQuantity > 0;
  }
  return persist?.(player.id, instanceId, expectedOwned, itemTableId) ?? true;
}
