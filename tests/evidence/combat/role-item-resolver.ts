import type {BattleItemRecord} from '../../../apps/shared/combat/item-hotkeys';

/** Original422dfd: inventory instance lookup, then ItemTable lookup by record+c. */
export function resolveRoleItemInstance<T>(
  groups: readonly (readonly BattleItemRecord[])[], instanceId: number,
  lookupTable: (tableId: number) => T | undefined,
): T | undefined {
  const id = instanceId >>> 0;
  for (const group of [0, 1, 2, 3, 5, 6]) {
    const record = groups[group].find(item => (item.instanceId >>> 0) === id);
    if (record) return lookupTable(record.itemTableId >>> 0);
  }
  return undefined;
}
