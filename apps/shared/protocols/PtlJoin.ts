export interface JoinPlayer {
  id: string;
  name: string;
  tankId: number;
}

export interface JoinRoom {
  id: string;
  name: string;
  mode: number;
  mapId: number;
  players: JoinPlayer[];
  round?: number;
  phase?: string;
}

export interface ReqJoin {
  clientId: string;
  name: string;
  tankId: number;
  roomId?: string;
  password?: string;
}

export interface ResJoin {
  playerId: string;
  room: JoinRoom;
  serverTime: number;
}
