import {randomBytes, scryptSync} from 'node:crypto';
import type {ReqEditRoom} from '../../../shared/protocols/PtlEditRoom';
import {ROOM_NAME_MAX_CODEPOINTS, ROOM_PASSWORD_MAX_CODEPOINTS, validateRoomInputLength} from '../../../shared/room-input';
import {MAPS} from '../config';
import {createWaitingRoom, modeName} from './create';
import {selectPlayerLimits} from './player-limits';
import {readyCpus} from './preparation';
import type {RoomState} from './state';

/** World confirms the waiting round and host before changing its configuration. */
export function editWaitingRoom(room: RoomState, request: ReqEditRoom): void {
  const map = MAPS.find(value => value.mode === request.mode && value.mapId === request.mapId);
  if (!map) throw new Error('该模式没有这张地图');
  validateRoomInputLength(request.roomName, ROOM_NAME_MAX_CODEPOINTS, '房间名称');
  if (request.password !== undefined) {
    validateRoomInputLength(request.password, ROOM_PASSWORD_MAX_CODEPOINTS, '房间密码');
    if (/[\u0000-\u001f]/.test(request.password)) throw new Error('房间密码不能包含控制字符');
  }
  if (request.friendlyFire && request.mode > 3) throw new Error('该模式不支持友军伤害');
  const limits = selectPlayerLimits(map, request.minPlayers, request.maxPlayers);
  if (room.players.size > limits.maxPlayers) throw new Error('房间容量不能少于当前房内人数');
  const players = [...room.players.values()];
  const teams = players.map((player, index) => request.mode > 3 ? 0 : room.mode > 3 ? index % 2 : player.team);
  if (request.mode <= 3 && [0, 1].some(team => teams.filter(value => value === team).length > Math.ceil(limits.maxPlayers / 2))) {
    throw new Error('当前队伍人数超过新容量，请先调整猫狗两队人数');
  }
  const name = request.roomName.replace(/[<>&\u0000-\u001f]/g, '').trim();
  const replacement = createWaitingRoom(request.mode, request.mapId, () => room.roomId,
    limits.minPlayers, limits.maxPlayers, request.friendlyFire);
  let passwordSalt = room.passwordSalt, passwordHash = room.passwordHash;
  if (request.password !== undefined) {
    passwordSalt = request.password ? randomBytes(16) : undefined;
    passwordHash = passwordSalt ? scryptSync(request.password, passwordSalt, 32) : undefined;
  }
  Object.assign(room, replacement, {
    roomName: name ? `${name} · ${modeName(request.mode)}·${map.name}` : replacement.roomName,
    players: room.players, round: room.round, tick: room.tick, result: undefined, creationKey: undefined,
    passwordSalt, passwordHash,
  });
  players.forEach((player, index) => {player.team = teams[index];});
  readyCpus(room);
}
