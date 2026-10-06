import {roomMaxPlayers} from './player-limits';
import type {RoomState, JoinResult} from './state';

/** Preserve first available public waiting room and the existing fallback policy. */
export function quickMatchRoom(rooms: ReadonlyMap<string, RoomState>,
  createFallback: () => RoomState, join: (room: RoomState) => JoinResult): JoinResult {
  const available = [...rooms.values()].find(room => !room.passwordHash
    && room.players.size < roomMaxPlayers(room) && room.phase === 'WAITING');
  return join(available ?? createFallback());
}
