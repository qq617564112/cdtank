export interface ReqRematch {
  /** Prevents a delayed vote from being applied to another round. */
  round: number;
}

export interface ResRematch {
  round: number;
}
