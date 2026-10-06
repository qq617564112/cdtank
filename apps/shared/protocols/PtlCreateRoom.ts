import type {ResJoin} from './PtlJoin';

export interface ReqCreateRoom {
  mode: number;
  mapId: number;
  roomName: string;
  name: string;
  tankId: number;
  password?: string;
  minPlayers?: number;
  maxPlayers?: number;
  friendlyFire?: boolean;
}

/** Creates a room and joins its creator on the same connection atomically. */
export interface ResCreateRoom extends ResJoin {}
