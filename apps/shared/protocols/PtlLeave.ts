/** Authoritative quote for the current explicit departure. */
export interface LeavePenalty {
  count: number;
  points: number;
}

/** Rebuilt confirmed departure; no original protocol identity is claimed. */
export interface ReqLeave {
  roomId: string;
  round: number;
  quoteOnly?: boolean;
  confirmedPenaltyPoints?: number;
}

export interface ResLeave {
  roomId: string;
  round: number;
  penalty?: LeavePenalty;
  left?: boolean;
}
