import type {MapOption} from '../../../../shared/protocols/PtlListMaps';
import {ROOM_NAME_MAX_CODEPOINTS, ROOM_PASSWORD_MAX_CODEPOINTS, validateRoomInputLength} from '../../../../shared/room-input';

export interface RoomCreateDraft {
  mode: number; mapId: number; roomName: string; password: string;
  minPlayers: number; maxPlayers: number; friendlyFire: boolean;
}

/** Same reconstructed map bounds as ordinary creation; server retains final authority. */
export function validateRoomCreateDraft(draft: RoomCreateDraft, map: MapOption | undefined): void {
  validateRoomInputLength(draft.roomName, ROOM_NAME_MAX_CODEPOINTS, '房间名称');
  validateRoomInputLength(draft.password, ROOM_PASSWORD_MAX_CODEPOINTS, '房间密码');
  if (!map || draft.mode !== map.mode || draft.mapId !== map.mapId) throw new Error('所选模式或地图已不可用');
  if (!Number.isInteger(draft.minPlayers) || !Number.isInteger(draft.maxPlayers)
      || draft.minPlayers < map.sourceMinPlayers || draft.minPlayers > draft.maxPlayers
      || draft.maxPlayers > map.maxPlayers) throw new Error(`人数须满足 ${map.sourceMinPlayers} ≤ 开局人数 ≤ 房间容量 ≤ ${map.maxPlayers}`);
  if (draft.mode > 3 && draft.friendlyFire) throw new Error('该模式不支持友军伤害');
}

export function changeRoomCreateBound(draft: RoomCreateDraft, map: MapOption,
  bound: 'minPlayers' | 'maxPlayers', delta: number): RoomCreateDraft {
  const changed = {...draft, [bound]: draft[bound] + delta};
  validateRoomCreateDraft(changed, map);
  return changed;
}
