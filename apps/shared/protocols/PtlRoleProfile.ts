import type {AccountGrowth, PlayerTitle} from './MsgRoomSnapshot';

export interface OwnedTitle extends PlayerTitle {
  description: string;
}

export interface AccountTitles {
  owned: OwnedTitle[];
  selectedTitleId: number;
}

export interface ReqRoleProfile {
  /** Explicit title selection; 0 clears the worn title. Omitted for a plain query. */
  selectTitleId?: number;
}
export interface ResRoleProfile {
  /** Absent until recovered profile data has been explicitly imported. */
  /** Original signed MyPlayer getter values; absent with missing profile. */
  playerSummary?: {score: number; originality: number; tech: number};
  profile?: {bytes: number[]; strings: [string, string]};
  growth?: AccountGrowth;
  titles?: AccountTitles;
}
