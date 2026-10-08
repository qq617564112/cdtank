import {gameContent} from '../content/catalog';
import {isTreasureItem} from './treasure-items';

export function cpuLoadoutItemIds(): number[] {
  return [...gameContent().items.values()].filter(item => item.cpuAvailable).map(item => item.id);
}

const TREASURE_UINT32_MAX = 0xffffffff;

/** Explicit configured quantity gate for the CPU loadout.
 *
 * Ordinary items keep the original `1..sourceBattleUseMax` integer range. The two Func20
 * treasures have source `BattleUseMax0`; an operator-configured explicit positive finite
 * integer is accepted against the uint32 inventory representation, which is a
 * representation bound rather than a per-round cap.
 */
export function isValidCpuLoadoutQuantity(itemTableId: number, quantity: number,
    sourceBattleUseMax: number): boolean {
  if (!Number.isInteger(quantity) || quantity <= 0) return false;
  if (isTreasureItem(itemTableId)) return quantity <= TREASURE_UINT32_MAX;
  return quantity <= sourceBattleUseMax;
}
