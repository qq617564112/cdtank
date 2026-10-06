import type {AccountGrowth, PlayerTitle} from './MsgRoomSnapshot';

export interface OwnedTitle extends PlayerTitle {
  description: string;
}

export interface AccountTitles {
  owned: OwnedTitle[];
  selectedTitleId: number;
}

export interface AccountStatistics {
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  loseStreak: number;
  battleSeconds: number;
  kills: number;
  deaths: number;
  shots?: number;
  hits?: number;
  damage?: number;
  killCombo?: number;
  spentMoney?: number;
  spentTokens?: number;
}

export interface AwardCounts {
  perfect: number;
  mvp: number;
  savage: number;
  console: number;
  brave: number;
  kind: number;
  crafty: number;
  shy: number;
  greedy: number;
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
  statistics?: AccountStatistics;
  awards?: AwardCounts;
}
