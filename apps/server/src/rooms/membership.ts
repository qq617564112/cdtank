import type {MsgPlayerInput} from '../../../shared/protocols';
import {getTankConfig} from '../config';
import {createBattlePlayer} from '../battle/create-player';
import {joiningTeam} from '../modes/start';
import type {RoomState, JoinResult} from './state';

/** Admission already succeeded; leave through the authoritative settlement path. */
export function insertRoomPlayer(rooms: ReadonlyMap<string, RoomState>, room: RoomState,
  clientId: string, name: string, tankId: number, allocateId: () => string,
  leave: (playerId: string) => void, defaultInput: MsgPlayerInput): JoinResult {
  for (const previous of rooms.values()) {
    const player = [...previous.players.values()].find(value => value.clientId === clientId);
    if (player) {
      leave(player.id);
      break;
    }
  }
  const playerId = allocateId();
  const tank = getTankConfig(tankId);
  const team = joiningTeam(room.mode, room.players.values());
  const spawn = room.battlefield.spawn(room.players.size);
  room.players.set(playerId, createBattlePlayer(playerId, clientId, name, tank, team, spawn, defaultInput));
  return {playerId, roomId: room.roomId, mode: room.mode, mapId: room.map.mapId};
}
