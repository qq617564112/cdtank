import type {AccountGrowth} from './MsgRoomSnapshot';

export interface ReqRoleProfile {}
export interface ResRoleProfile {
  /** Absent until recovered profile data has been explicitly imported. */
  /** Original signed MyPlayer getter values; absent with missing profile. */
  playerSummary?: {score: number; originality: number; tech: number};
  profile?: {bytes: number[]; strings: [string, string]};
  growth?: AccountGrowth;
}
