/** Original4d87bb uses TankTable.TankType gamestrings680–683. */
export function sourceTankKind(tankType?: number): string {
  return tankType === 1 ? '轻型坦克' : tankType === 2 ? '中型坦克'
    : tankType === 3 ? '重型坦克' : tankType === 4 ? '突击炮' : '';
}

/** Original4d899c displays signed default durability without expiry arithmetic. */
export function sourceTankDays(defaultDurability?: number): string {
  return defaultDurability === undefined ? '' : `（${defaultDurability | 0}天）`;
}

/** Original4d99d6 unsigned Tankshop coin×0.1; purchase amount is unchanged. */
export function sourceTankPrice(tokenPrice?: number): string {
  if (tokenPrice === undefined) return '';
  const value = ((tokenPrice >>> 0) * 0.1).toPrecision(16).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
  return `购买价  星币${value}`;
}

/** Original4d9633/4d8a38 displays signed TankMoney half. */
export function sourceTankOwnedPrice(tankMoney?: number): string {
  return tankMoney === undefined ? '' : `出售价  金钱${Math.trunc((tankMoney | 0) / 2)}`;
}
