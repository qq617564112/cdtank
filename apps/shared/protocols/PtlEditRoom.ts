export interface ReqEditRoom {
  round: number;
  mode: number;
  mapId: number;
  roomName: string;
  minPlayers: number;
  maxPlayers: number;
  friendlyFire: boolean;
  /** Omit to keep the password; an empty string removes it. */
  password?: string;
}

export interface ResEditRoom {
  round: number;
}

export type RoomEditSettings = Omit<ReqEditRoom, 'round'>;
