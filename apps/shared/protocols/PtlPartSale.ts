import type {ResInventory} from './PtlInventory';

/** Original durable-item sale uses an owned instance, independent of remaining minutes. */
export interface ReqPartSale {
  operation: 'QUERY' | 'SELL';
  instanceId?: number;
  requestId?: string;
}

export interface ResPartSale {
  quotes: {instanceId: number; itemTableId: number; price: number; canSell: boolean}[];
  inventory: ResInventory;
  money?: number;
  profile?: {bytes: number[]; strings: [string, string]};
  sold?: {instanceId: number; itemTableId: number; price: number; result: 1};
  replayed?: boolean;
}
