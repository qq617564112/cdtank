import type {InventoryWireRecord} from './PtlInventory';

export type ShopCurrency = 'MONEY' | 'TOKENS';
export interface ShopItem {
  itemTableId: number;
  name: string;
  info: string;
  iconId: number;
  moneyPrice: number;
  tokenPrice: number;
  /** Original GGet/+f4 display selector. */
  getMethod?: number;
  /** Original Durable/+f8 display field. */
  durable?: number;
}
export interface ReqShop {
  operation: 'QUERY' | 'BUY';
  itemTableId?: number;
  quantity?: number;
  currency?: ShopCurrency;
  requestId?: string;
}
export interface ResShop {
  items: ShopItem[];
  money?: number;
  tokens?: number;
  purchased?: InventoryWireRecord;
  replayed?: boolean;
}
