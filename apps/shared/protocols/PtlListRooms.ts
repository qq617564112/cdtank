export interface RoomSummary {
  id: string;
  name: string;
  mode: number;
  mapId: number;
  playerCount: number;
  /** Current authoritative team0/team1 membership; absent on older servers. */
  teamPlayerCounts?: number[];
  maxPlayers: number;
  minPlayers?: number;
  friendlyFire?: boolean;
  phase: string;
  hasPassword?: boolean;
}

export interface ReqListRooms {
}

export interface ResListRooms {
  rooms: RoomSummary[];
}
