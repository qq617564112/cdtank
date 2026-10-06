import type {ShopItem} from '../../../../shared/protocols/PtlShop';

/** Original439950 offered count; independent of inventory and purchase quantity. */
export function sourceShopOfferedQuantity(item: Pick<ShopItem, 'itemTableId' | 'durable'>): number | undefined {
  if (item.durable === undefined) return undefined;
  const eligible = item.itemTableId <= 4000 || item.itemTableId >= 20001 && item.itemTableId <= 21000;
  return eligible && item.durable !== 0 ? item.durable : 1;
}

/** Original4d96ba prefix/unit/value order and4d5f76 star-coin scale. */
export function sourceShopPrice(item: Pick<ShopItem, 'getMethod' | 'moneyPrice' | 'tokenPrice'>): string {
  if (item.getMethod === 1) return `购买价  金钱${item.moneyPrice}`;
  if (item.getMethod === 2) {
    // The original double stream uses16 significant digits for the uint32×0.1 range.
    const value = (item.tokenPrice * 0.1).toPrecision(16).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1');
    return `购买价  星币${value}`;
  }
  return '';
}

/** Original4d85e8 owned-row fourth text; display only. */
export function sourceShopOwnedPrice(moneyPrice?: number): string {
  return moneyPrice === undefined ? '' : `出售价  金钱${moneyPrice >>> 1}`;
}
