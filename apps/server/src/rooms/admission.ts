import {randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
import {MAPS, TANKS} from '../config';
import {selectPlayerLimits, roomMaxPlayers} from './player-limits';
import {modeName} from './create';
import type {RoomState, JoinResult} from './state';
import {ROOM_NAME_MAX_CODEPOINTS, ROOM_PASSWORD_MAX_CODEPOINTS, validateRoomInputLength} from '../../../shared/room-input';

interface CreationRequest {
  clientId: string;
  mode: number;
  mapId: number;
  roomName: string;
  name: string;
  tankId: number;
  password: string;
  minPlayers?: number;
  maxPlayers?: number;
  friendlyFire?: boolean;
}

/** Creation retry and rollback use the same authoritative registry as joins. */
export function createAndJoinRoom(rooms: Map<string, RoomState>, request: CreationRequest,
  create: (limits: {minPlayers: number; maxPlayers: number; friendlyFire: boolean}) => RoomState, join: (room: RoomState) => JoinResult): JoinResult {
  const {clientId, mode, mapId, roomName, name, tankId, password} = request;
  validateRoomInputLength(roomName, ROOM_NAME_MAX_CODEPOINTS, '房间名称');
  validatePassword(password);
  const map = MAPS.find(value => value.mode === mode && value.mapId === mapId);
  if (!Number.isInteger(mode) || !Number.isInteger(mapId) || !map) {
    throw new Error('该模式没有这张地图');
  }
  if (request.friendlyFire !== undefined && typeof request.friendlyFire !== 'boolean') {
    throw new Error('友军伤害必须为布尔值');
  }
  const friendlyFire = request.friendlyFire ?? false;
  if (friendlyFire && mode >= 4) throw new Error('该模式不支持友军伤害');
  const limits = {...selectPlayerLimits(map, request.minPlayers, request.maxPlayers), friendlyFire};
  if (!TANKS.some(tank => tank.id === tankId)) throw new Error('战车不存在');
  const sanitizedRoomName = roomName.replace(/[<>&\u0000-\u001f]/g, '').trim();
  const creationKey = JSON.stringify([mode, mapId, sanitizedRoomName, name, tankId, limits.minPlayers, limits.maxPlayers, friendlyFire]);
  for (const previous of rooms.values()) {
    const existing = [...previous.players.values()].find(player => player.clientId === clientId);
    if (!existing) continue;
    if (previous.creatorClientId === clientId && previous.creationKey === creationKey
        && !!previous.passwordHash === !!password && passwordMatches(previous, password)) {
      return {playerId: existing.id, roomId: previous.roomId, mode, mapId};
    }
    throw new Error('请先离开当前房间再创建新房间');
  }
  if (rooms.size >= 100) throw new Error('当前房间过多，请加入已有房间');
  const room = create(limits);
  room.creatorClientId = clientId;
  room.creationKey = creationKey;
  if (password) {
    room.passwordSalt = randomBytes(16);
    room.passwordHash = scryptSync(password, room.passwordSalt, 32);
  }
  if (sanitizedRoomName) room.roomName = `${sanitizedRoomName} · ${modeName(mode)}·${map.name}`;
  try {
    return join(room);
  } catch (error) {
    rooms.delete(room.roomId);
    throw error;
  }
}

/** Existing membership retries precede password and capacity checks. */
export function admitRoomPlayer(room: RoomState | undefined, clientId: string, password: string,
  insert: (room: RoomState) => JoinResult): JoinResult {
  if (!room) throw new Error('房间不存在');
  const existing = [...room.players.values()].find(player => player.clientId === clientId);
  if (existing) {
    return {playerId: existing.id, roomId: room.roomId, mode: room.mode, mapId: room.map.mapId};
  }
  validatePassword(password);
  if (!passwordMatches(room, password)) throw new Error('房间密码错误');
  if (room.players.size >= roomMaxPlayers(room) || room.phase === 'PLAYING') {
    throw new Error('房间已满或正在对战，请选择等待中的房间');
  }
  return insert(room);
}

function validatePassword(password: string): void {
  validateRoomInputLength(password, ROOM_PASSWORD_MAX_CODEPOINTS, '房间密码');
  if (/[\u0000-\u001f]/.test(password)) throw new Error('房间密码不能包含控制字符');
}

function passwordMatches(room: RoomState, password: string): boolean {
  if (!room.passwordHash || !room.passwordSalt) return true;
  return timingSafeEqual(room.passwordHash, scryptSync(password, room.passwordSalt, 32));
}
