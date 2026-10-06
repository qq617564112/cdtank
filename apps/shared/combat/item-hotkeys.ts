export interface BattleItemRecord {
  instanceId: number;
  itemTableId: number;
  ownedQuantity: number;
  battleQuantity: number;
}

export type HotkeyCommand = {kind: 'selectAmmo'; slot: number}
  | {kind: 'placeTrap' | 'useItem'; instanceId: number}
  | {kind: 'empty'; messageId: 28}
  | {kind: 'none'};

/** Original0x439762 unsigned ID ranges, independent of ItemType table values. */
export function classifyItemId(itemTableId: number): number {
  const id = itemTableId >>> 0;
  for (const [base, count, first] of [[0, 4, 1], [10000, 8, 5], [20000, 2, 13], [30000, 3, 15]]) {
    if (id > base && id <= base + count * 1000) return first + Math.floor((id - base - 1) / 1000);
  }
  return 0;
}

/** Original0x4cb2f5: request dispatch; quantities change only on later updates. */
export function resolveItemHotkey(slot: number, hasController: boolean,
  hotkeys: ArrayLike<number> | undefined, records: readonly BattleItemRecord[], hasRole = true):
  {accepted: boolean; command: HotkeyCommand} {
  const none = {kind: 'none'} as const;
  if (!hasController) return {accepted: false, command: none};
  const index = slot >>> 0;
  if (index < 1 || index > 8) return {accepted: true, command: none};
  if (index === 1) return {accepted: true, command: {kind: 'selectAmmo', slot: 1}};
  if (!hasRole) return {accepted: false, command: none};
  if (!hotkeys) return {accepted: true, command: none};
  const instanceId = hotkeys[index - 2] >>> 0;
  const record = instanceId ? records.find(record => (record.instanceId >>> 0) === instanceId) : undefined;
  if (!record) return {accepted: true, command: none};
  if ((record.battleQuantity >>> 0) === 0) return {accepted: false, command: {kind: 'empty', messageId: 28}};
  if (index >= 5) return {accepted: true, command: {kind: 'useItem', instanceId}};
  const type = classifyItemId(record.itemTableId);
  return {accepted: true, command: type === 3 ? {kind: 'selectAmmo', slot: index}
    : type === 4 ? {kind: 'placeTrap', instanceId} : none};
}

/** Original43d2e3 initializes usable counts only for the seven assigned records. */
export function initializeBattleQuantities(hotkeys: ArrayLike<number>, records: readonly BattleItemRecord[],
  battleUseMax: (itemTableId: number) => number): void {
  for (let slot = 0; slot < 7; slot++) {
    const id = hotkeys[slot] >>> 0;
    if (!id) continue;
    const record = records.find(record => (record.instanceId >>> 0) === id);
    if (record) record.battleQuantity = Math.min(record.ownedQuantity >>> 0, battleUseMax(record.itemTableId) >>> 0);
  }
}
