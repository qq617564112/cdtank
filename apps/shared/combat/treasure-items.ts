import {gameContent} from '../content/catalog';

export function treasureItemIds(): number[] {
  return [...gameContent().items.values()].filter(item => item.treasure).map(item => item.id);
}
export function isTreasureItem(itemTableId: number): boolean {
  return gameContent().items.get(itemTableId >>> 0)?.treasure ?? false;
}
