/** Original43b425: raw currency0 is coin; currency1 is money. */
export function calculateTankMaintenanceCost(input: {
  tankMoney: number;
  tankCoin: number;
  moneyWeekMultiplier: number;
  currency: 0 | 1;
  days: 1 | 7 | 30;
}): number {
  const weekly = input.currency === 0 ? input.tankCoin | 0
    : Math.imul(input.tankMoney, input.moneyWeekMultiplier);
  return input.days === 1 ? Math.trunc(weekly / 5)
    : input.days === 7 ? weekly : weekly << 1;
}
