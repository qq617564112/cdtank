/** Rebuilt unilateral account friends; native server approval rules are unknown. */
export type ReqFriends = {operation: 'QUERY'} |
  {operation: 'ADD' | 'REMOVE'; targetAccountId: string};

export interface FriendRecord {
  accountId: string;
  name: string;
  online: boolean;
  inRoom: boolean;
}

export interface ResFriends {friends: FriendRecord[];}
