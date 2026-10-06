/** Delivered items allowed by the rebuilt waiting-room CPU configuration. The two
 *  Func20 treasures (20001 鱼骨 / 20002 骨头) are the only category6 entries. */
export const CPU_LOADOUT_ITEM_IDS: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 502, 2007, 2011, 20001, 20002,
];

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
  if (itemTableId === 20001 || itemTableId === 20002) return quantity <= TREASURE_UINT32_MAX;
  return quantity <= sourceBattleUseMax;
}
