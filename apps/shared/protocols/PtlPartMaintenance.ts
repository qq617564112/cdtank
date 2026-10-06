import type {ResInventory} from './PtlInventory';

export interface PartMaintenanceQuote {
  days: 1 | 7 | 30;
  currency: 0 | 1;
  cost: number;
  displayCost: string;
}

export interface ReqPartMaintenance {
  operation: 'QUERY' | 'MAINTAIN';
  instanceId?: number;
  days?: 1 | 7 | 30;
  currency?: 0 | 1;
  requestId?: string;
}

export interface ResPartMaintenance {
  parts: {instanceId: number; itemTableId: number; remainingMinutes: number;
    canMaintain: boolean; quotes: PartMaintenanceQuote[]}[];
  money?: number;
  tokens?: number;
  inventory: ResInventory;
  profile?: {bytes: number[]; strings: [string, string]};
  maintained?: {instanceId: number; remainingMinutes: number; cost: number; currency: 0 | 1; days: 1 | 7 | 30};
  replayed?: boolean;
}
