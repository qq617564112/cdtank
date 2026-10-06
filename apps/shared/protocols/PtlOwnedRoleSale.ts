import type {ResOwnedRoles} from './PtlOwnedRoles';

/** Rebuilt sale authority uses the original owned instance request and complete money reply. */
export interface ReqOwnedRoleSale {
  operation: 'QUERY' | 'SELL';
  kind?: 'pet' | 'tank';
  instanceId?: number;
  requestId?: string;
}

export interface ResOwnedRoleSale {
  quotes: {kind: 'pet' | 'tank'; instanceId: number; definitionId: number; price: number; selected: boolean; canSell: boolean}[];
  owned: ResOwnedRoles;
  money?: number;
  profile?: {bytes: number[]; strings: [string, string]};
  sold?: {kind: 'pet' | 'tank'; instanceId: number; price: number; result: 2};
  replayed?: boolean;
}
