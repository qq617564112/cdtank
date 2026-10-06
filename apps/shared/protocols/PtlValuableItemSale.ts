import type {ResInventory} from './PtlInventory';

/** Original kind5 valuable sale carries an owned instance and a 24-bit quantity. */
export interface ReqValuableItemSale {
  operation: 'QUERY' | 'SELL';
  instanceId?: number;
  quantity?: number;
  requestId?: string;
}

export interface ResValuableItemSale {
  quotes: {instanceId: number; itemTableId: number; ownedQuantity: number; unitPrice: number; canSell: boolean}[];
  inventory: ResInventory;
  money?: number;
  profile?: {bytes: number[]; strings: [string, string]};
  sold?: {instanceId: number; itemTableId: number; quantity: number; price: number; result: 2};
  replayed?: boolean;
}
