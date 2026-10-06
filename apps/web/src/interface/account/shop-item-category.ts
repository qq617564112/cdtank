import {classifyItemId} from '../../../../shared/combat/item-hotkeys';

/** Original ConvenientPage radio callback4a03c7 chooses these product factories. */
export function sourceShopItemCategory(itemTableId: number): 'Item' | 'Weapon' | undefined {
  const kind = classifyItemId(itemTableId);
  return kind === 1 ? 'Item' : kind === 3 || kind === 4 ? 'Weapon' : undefined;
}
