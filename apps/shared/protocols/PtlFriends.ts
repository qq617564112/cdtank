import type {PlayerTitle} from './MsgRoomSnapshot';

/** Rebuilt unilateral account friends; native server approval rules are unknown. */
export type ReqFriends = {operation: 'QUERY'} |
  {operation: 'ADD' | 'REMOVE'; targetAccountId: string};

export interface FriendRecord {
  accountId: string;
  name: string;
  online: boolean;
  inRoom: boolean;
  /** Worn title for the friend when known; offline friends may carry it too. */
  title?: PlayerTitle;
}

export interface ResFriends {friends: FriendRecord[];}
