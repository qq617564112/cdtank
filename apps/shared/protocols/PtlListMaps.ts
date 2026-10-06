export interface MapOption {
  mode: number;
  mapId: number;
  name: string;
  timeLimit: number;
  sourceMinPlayers: number;
  maxPlayers: number;
}

export interface ReqListMaps {}

export interface ResListMaps {
  maps: MapOption[];
}
