import type {BattleItemRecord} from '../../../shared/combat/item-hotkeys';
import {classifyInventoryCategory} from '../../../shared/combat/inventory-query';

export interface KitbagAssignment {instanceId: number; slot: number;}
export interface KitbagAssignmentResult extends KitbagAssignment {result: number; hotkeys: number[];}
export interface KitbagCancellationResult {slot: number; result: number;}

/** Original43dcc3; slots1..7 correspond to battle keys2..8. No local mutation. */
export function requestKitbagAssignment(groups: readonly (readonly BattleItemRecord[])[],
  instanceId: number, slot: number, send: (request: KitbagAssignment) => void,
  notify?: (code: number) => void): boolean {
  const id = instanceId >>> 0, index = slot >>> 0;
  if (!id) return false;
  if (!index) {notify?.(3); return false;}
  if (index > 7) return false;
  let record: BattleItemRecord | undefined;
  for (const group of [0, 1, 2, 3, 5, 6]) {
    record = groups[group].find(record => (record.instanceId >>> 0) === id);
    if (record) break;
  }
  if (!record) return false;
  const tableId = record.itemTableId >>> 0;
  if (!(tableId > 0 && tableId <= 4000 || tableId >= 20001 && tableId <= 21000)) {
    notify?.(0); return false;
  }
  const category = classifyInventoryCategory(tableId);
  if (category === (index <= 3 ? 1 : 2)) {notify?.(1); return false;}
  send({instanceId: id, slot: index});
  return true;
}

/** Original43cbe3 on the supported seven-slot UI domain; waits for confirmation. */
export function requestKitbagCancellation(hotkeys: ArrayLike<number>, slot: number,
  send: (slot: number) => void, notify?: (code: number) => void): boolean {
  const index = slot >>> 0;
  if (!index) {notify?.(0); return false;}
  if (!(hotkeys[index - 1] >>> 0)) return false;
  send(index);
  return true;
}

