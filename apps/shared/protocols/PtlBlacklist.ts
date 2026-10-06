import type {PlayerTitle} from './MsgRoomSnapshot';

/** Rebuilt unilateral blocks; native server filtering rules remain unknown. */
export type ReqBlacklist = {operation: 'QUERY'} |
  {operation: 'ADD' | 'REMOVE'; targetAccountId: string};

export interface BlockedRecord {
  accountId: string;
  name: string;
  online: boolean;
  inRoom: boolean;
  /** Worn title for the blocked account when known. */
  title?: PlayerTitle;
}

export interface ResBlacklist {blocked: BlockedRecord[];}
