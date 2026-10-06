/** Rebuilt unilateral blocks; native server filtering rules remain unknown. */
export type ReqBlacklist = {operation: 'QUERY'} |
  {operation: 'ADD' | 'REMOVE'; targetAccountId: string};

export interface BlockedRecord {
  accountId: string;
  name: string;
  online: boolean;
  inRoom: boolean;
}

export interface ResBlacklist {blocked: BlockedRecord[];}
