import type {FriendRecord} from './PtlFriends';

/** Exact nickname lookup over persistent accounts; responses reuse the friend projection. */
export interface ReqPlayerSearch {
  name: string;
}

export interface ResPlayerSearch {
  players: FriendRecord[];
}
