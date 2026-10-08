/** Room (0), team (1), or original GM question submission (6). */
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
