import type {CombatItemDefinition} from '../../../../shared/combat/catalog';
import type {InventoryWireRecord} from '../../../../shared/protocols/PtlInventory';
import {classifyItemId} from '../../../../shared/combat/item-hotkeys';

/** Rebuilt ownership boundary feeding the original OdlPlayer table-ID slots at+bc. */
export function resolveBattlePartTableIds(instances: readonly number[],
    inventory: readonly InventoryWireRecord[], items: ReadonlyMap<number, CombatItemDefinition>): number[] {
  return Array.from({length: 5}, (_, slot) => {
    const instanceId = instances[slot] >>> 0;
    if (!instanceId) return 0;
    const record = inventory.find(item => (item.instanceId >>> 0) === instanceId);
    if (!record || record.ownedQuantity <= 0 || record.state !== 2) return 0;
    const tableId = record.itemTableId >>> 0;
    const category = classifyItemId(tableId);
    return category >= 8 && category <= 12 && items.has(tableId) ? tableId : 0;
  });
}
