/** Rebuilt room (0) or team (1) text channel; original IDs remain unrecovered. */
export interface ReqRoomChat {
  channel: number;
  text: string;
}

/** Confirms server acceptance, not delivery to every connected participant. */
export interface ResRoomChat {
  roomId: string;
  playerId: string;
  message: string;
}
