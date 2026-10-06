/** Manage one CPU participant in the current waiting room. */
export interface CpuLoadoutItem {
  slot: number;
  itemTableId: number;
  quantity: number;
}

export interface ReqCpu {
  round: number;
  operation: 'ADD' | 'REMOVE' | 'CONFIGURE';
  tankId?: number;
  playerId?: string;
  team?: number;
  /** Rebuilt temporary CPU stock, independent of all account inventory. */
  loadout?: CpuLoadoutItem[];
}
export interface ResCpu {
  round: number;
  playerId: string;
}
