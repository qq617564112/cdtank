/** Func20 treasure consumables (item20001 鱼骨 / item20002 骨头).
 *  They are the only category6 records adopted into the rebuilt ordinary-use chain. */
export const TREASURE_ITEMS = [20001, 20002] as const;

export function isTreasureItem(itemTableId: number): boolean {
  const id = itemTableId >>> 0;
  return id === 20001 || id === 20002;
}
