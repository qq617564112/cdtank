import {useRef, useState, type Dispatch, type SetStateAction} from 'react';
import {useNavigationChoice, useNavigationNumber, useNavigationValue} from '../../navigation/route';
import type {RoomCreateDraft} from './room-create-draft';

/** Room drafts restore from tab navigation state; passwords remain in memory. */
export function useRoomDraft(initial: RoomCreateDraft, prefix: string):
    [RoomCreateDraft, Dispatch<SetStateAction<RoomCreateDraft>>] {
  const [mode, setMode] = useNavigationChoice(`${prefix}Mode`, ['1', '2', '3', '4', '5', '6'], String(initial.mode) as '1' | '2' | '3' | '4' | '5' | '6', true);
  const [mapId, setMapId] = useNavigationNumber(`${prefix}Map`, true);
  const [roomName, setRoomName] = useNavigationValue(`${prefix}Name`, initial.roomName, true);
  const [minPlayers, setMinPlayers] = useNavigationValue(`${prefix}Min`, String(initial.minPlayers), true);
  const [maxPlayers, setMaxPlayers] = useNavigationValue(`${prefix}Max`, String(initial.maxPlayers), true);
  const [timeLimit, setTimeLimit] = useNavigationValue(`${prefix}Time`,
    initial.timeLimitSeconds === undefined ? '' : String(initial.timeLimitSeconds), true);
  const [friendlyFire, setFriendlyFire] = useNavigationChoice(`${prefix}Friendly`, ['true', 'false'], String(initial.friendlyFire) as 'true' | 'false', true);
  const [password, setPassword] = useState(initial.password);
  const draft: RoomCreateDraft = {mode: Number(mode), mapId: mapId ?? initial.mapId, roomName,
    minPlayers: Number(minPlayers), maxPlayers: Number(maxPlayers),
    timeLimitSeconds: timeLimit === '' ? undefined : Number(timeLimit),
    friendlyFire: friendlyFire === 'true', password};
  const current = useRef(draft);
  current.current = draft;
  return [draft, update => {
    const next = typeof update === 'function' ? update(current.current) : update;
    current.current = next;
    setMode(String(next.mode) as '1' | '2' | '3' | '4' | '5' | '6');
    setMapId(next.mapId); setRoomName(next.roomName);
    setMinPlayers(String(next.minPlayers)); setMaxPlayers(String(next.maxPlayers));
    setTimeLimit(next.timeLimitSeconds === undefined ? '' : String(next.timeLimitSeconds));
    setFriendlyFire(next.friendlyFire ? 'true' : 'false');
    setPassword(next.password);
  }];
}
