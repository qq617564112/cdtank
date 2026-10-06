import type {RoomState} from './state';

/** Defaults require one room of each mode, regardless of its phase. */
export function ensureDefaultRooms(rooms: ReadonlyMap<string, RoomState>,
  create: (mode: number) => void): void {
  for (const mode of [1, 2, 3, 4, 5]) {
    if ([...rooms.values()].some(room => room.mode === mode)) continue;
    create(mode);
  }
}

/** Starts and settlements additionally require a waiting room of this mode. */
export function ensureWaitingRoom(rooms: ReadonlyMap<string, RoomState>, mode: number,
  create: (mode: number) => void): void {
  if (![...rooms.values()].some(room => room.mode === mode && room.phase === 'WAITING')) {
    create(mode);
  }
}
