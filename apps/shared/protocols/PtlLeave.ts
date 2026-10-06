/** Rebuilt confirmed departure; no original protocol identity is claimed. */
export interface ReqLeave {
  roomId: string;
  round: number;
}

export interface ResLeave {
  roomId: string;
  round: number;
}
