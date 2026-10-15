import type {MapOption} from '../protocols/PtlListMaps';

/** Static inputs shared by the server simulation and the browser training host. */
export interface SimulationCatalog {
  content: Record<string, unknown>;
  tables: Record<string, unknown>;
  scenes: unknown;
  maps: MapOption[];
}

export interface SimulationMap {
  field: {id: string};
  collision: unknown;
}

export interface RoomPassword {
  passwordSalt?: Uint8Array;
  passwordHash?: Uint8Array;
}

