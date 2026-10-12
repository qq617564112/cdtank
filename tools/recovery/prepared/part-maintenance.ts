/** Original439898 Item maintenance; currency0 raw coin, currency1 money. */
export function calculatePartMaintenanceCost(input: {
  itemMoney: number; itemCoin: number; moneyWeekMultiplier: number;
  currency: 0 | 1; days: 1 | 7 | 30;
}): number {
  const weekly = (input.currency === 0 ? input.itemCoin
    : Math.imul(input.itemMoney, input.moneyWeekMultiplier)) >>> 0;
  return input.days === 1 ? Math.floor(weekly / 5)
    : input.days === 7 ? weekly : (weekly << 1) >>> 0;
}

/** Original439aa5 coin formatter and519d0b selected Item cost controls. */
export function formatPartMaintenanceCost(input: {
  itemCoin: number; currency: 0 | 1; days: 1 | 7 | 30; cost: number;
}): string {
  if (input.currency === 1) return String(input.cost);
  const scale = input.days === 1 ? .02 : input.days === 7 ? .1 : .2;
  return String(Number(((input.itemCoin >>> 0) * scale).toFixed(1)));
}
