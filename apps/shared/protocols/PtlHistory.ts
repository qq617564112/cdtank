import type {MatchResult, ResultPlayer} from './MsgRoomSnapshot';

/** Rebuilt account history from authoritative settlement; no reward authority. */
export interface MatchHistoryRecord {
  matchId: string;
  round: number;
  mode: number;
  mapId: number;
  endedAt: number;
  reason: MatchResult['reason'];
  result: ResultPlayer;
}

export interface ReqHistory {offset?: number; limit?: number;}
export interface ResHistory {
  records: MatchHistoryRecord[];
  total: number;
  offset: number;
  limit: number;
}
