import type {ResOwnedRoles} from './PtlOwnedRoles';

export interface TankMaintenanceQuote {
  days: 1 | 7 | 30;
  /** Original raw currency selector: 0 coin, 1 money. */
  currency: 0 | 1;
  cost: number;
  displayCost: string;
}

/** Rebuilt account authority uses original owned instance and maintenance choices. */
export interface ReqTankMaintenance {
  operation: 'QUERY' | 'MAINTAIN';
  instanceId?: number;
  days?: 1 | 7 | 30;
  currency?: 0 | 1;
  requestId?: string;
}

export interface ResTankMaintenance {
  tanks: {instanceId: number; tankId: number; remainingMinutes: number; quotes: TankMaintenanceQuote[]}[];
  money?: number;
  tokens?: number;
  owned: ResOwnedRoles;
  profile?: {bytes: number[]; strings: [string, string]};
  maintained?: {instanceId: number; remainingMinutes: number; cost: number; currency: 0 | 1; days: 1 | 7 | 30};
  replayed?: boolean;
}
