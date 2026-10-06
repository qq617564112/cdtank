/** Remove a participant from the host's current waiting room. */
export interface ReqKickRoomPlayer {
  round: number;
  playerId: string;
}

export interface ResKickRoomPlayer {
  round: number;
  playerId: string;
}
