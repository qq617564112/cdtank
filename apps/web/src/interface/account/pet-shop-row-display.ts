/** Original4d8c0b concatenates PetSize and PetType text without a separator. */
export function sourcePetKind(petSize?: number, petType?: number): string {
  if (petSize === undefined || petType === undefined) return '';
  const size = petSize === 1 ? '小型' : petSize === 2 ? '中型' : petSize === 3 ? '大型' : petSize === 0 ? '不明' : '';
  const kind = petType === 1 ? '猫' : petType === 2 ? '狗' : petType === 0 ? '不明' : '';
  return size + kind;
}

/** Original4d9bc1 signed PetCoin×0.1 text; independent of the purchase amount. */
export function sourcePetPrice(tokenPrice?: number): string {
  if (tokenPrice === undefined) return '';
  const value = ((tokenPrice | 0) * 0.1).toPrecision(16).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
  return `购买价  星币${value}`;
}

/** Original4d9657/4d8e82 signed PetMoney half, independent of selling authority. */
export function sourcePetOwnedPrice(petMoney?: number): string {
  return petMoney === undefined ? '' : `出售价  金钱${Math.trunc((petMoney | 0) / 2)}`;
}
