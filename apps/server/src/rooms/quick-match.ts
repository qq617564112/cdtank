import {roomMaxPlayers} from './player-limits';
import type {RoomState, JoinResult} from './state';

/** Join the first available public waiting room. */
export function quickMatchRoom(rooms: ReadonlyMap<string, RoomState>,
  join: (room: RoomState) => JoinResult): JoinResult {
  const available = [...rooms.values()].find(room => !room.passwordHash
    && room.players.size < roomMaxPlayers(room) && room.phase === 'WAITING');
  if (!available) throw new Error('暂无可加入的房间，请先开新房间');
  return join(available);
}
