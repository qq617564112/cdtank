/** Original43b425: currency0 is raw coin, currency1 is money. */
export function calculateTankMaintenanceCost(input: {
  tankMoney: number; tankCoin: number; moneyWeekMultiplier: number;
  currency: 0 | 1; days: 1 | 7 | 30;
}): number {
  const weekly = input.currency === 0 ? input.tankCoin | 0
    : Math.imul(input.tankMoney, input.moneyWeekMultiplier);
  return input.days === 1 ? Math.trunc(weekly / 5)
    : input.days === 7 ? weekly : weekly << 1;
}

/** Original43b5b3 coin display; money uses the integer request cost. */
export function formatTankMaintenanceCost(input: {
  tankCoin: number; currency: 0 | 1; days: 1 | 7 | 30; cost: number;
}): string {
  if (input.currency === 1) return String(input.cost);
  const scale = input.days === 1 ? .02 : input.days === 7 ? .1 : .2;
  return String(Number((input.tankCoin * scale).toFixed(1)));
}
