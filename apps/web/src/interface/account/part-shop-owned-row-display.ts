import {classifyItemId} from '../../../../shared/combat/item-hotkeys';

/** Original4d83b3 kind+685 gamestrings for CommonPart rows. */
export function sourcePartOwnedKind(itemTableId: number): string {
  const labels: Record<number, string> = {8: '炮管类', 9: '装甲类', 10: '射击类', 11: '移动类', 12: '一般类'};
  return labels[classifyItemId(itemTableId)] ?? '';
}

/** Original4d849e reads unsigned MyItem+10 and rounds up minutes to days. */
export function sourcePartOwnedDays(ownedQuantity?: number): string {
  return ownedQuantity === undefined ? '' : `（${Math.ceil((ownedQuantity >>> 0) / 1440)}天）`;
}
