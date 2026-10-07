import type {PlayerTitle} from './MsgRoomSnapshot';
import type {AccountStatistics, AwardCounts} from './PtlRoleProfile';

/** Narrow public target profile query; absent fields remain unknown. */
export interface ReqPlayerProfile {
  targetAccountId: string;
}

export interface ResPlayerProfile {
  accountId: string;
  name: string;
  level?: number;
  score?: number;
  originality?: number;
  tech?: number;
  title?: PlayerTitle;
  statistics?: AccountStatistics;
  awards?: AwardCounts;
  family?: {
    id: string;
    name: string;
  };
}
