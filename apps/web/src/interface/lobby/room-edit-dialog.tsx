import {useState} from 'react';
import type {MsgRoomSnapshot} from '../../../../shared/protocols';
import type {RoomEditSettings} from '../../../../shared/protocols/PtlEditRoom';
import type {MapOption} from '../../../../shared/protocols/PtlListMaps';
import {RoomMapSelector} from './room-map-selector';
import {RoomCreateDialog} from './room-create-dialog';
import type {RoomPasswordAction} from './room-create-dialog';
import type {RoomCreateDraft} from './room-create-draft';
import {waitingRoomCustomName} from './waiting-room-state';

export interface RoomEditor {
  listMaps(): Promise<MapOption[]>;
  save(settings: RoomEditSettings): Promise<void>;
}

interface RoomEditDialogProps {
  snapshot: MsgRoomSnapshot;
  maps: readonly MapOption[];
  editor: RoomEditor;
  close(): void;
}

/** Keep the room's current settings while reusing the original selection and input sheets. */
export function RoomEditDialog({snapshot, maps, editor, close}: RoomEditDialogProps) {
  const [selecting, setSelecting] = useState(true);
  const [passwordAction, setPasswordAction] = useState<RoomPasswordAction>('KEEP');
  const [draft, setDraft] = useState<RoomCreateDraft>(() => ({
    mode: snapshot.mode, mapId: snapshot.roomInfo!.mapId,
    roomName: waitingRoomCustomName(snapshot), password: '',
    minPlayers: snapshot.match!.minPlayers, maxPlayers: snapshot.match!.maxPlayers!,
    friendlyFire: !!snapshot.match!.friendlyFire,
  }));
  const map = maps.find(value => value.mode === draft.mode && value.mapId === draft.mapId);
  return selecting ? <RoomMapSelector open maps={maps} busy={false} close={close} closeOnConfirm={false}
    initialMode={draft.mode} initialMapId={draft.mapId} confirm={(mode, mapId) => {
      const selected = maps.find(value => value.mode === mode && value.mapId === mapId);
      if (!selected) return false;
      const maxPlayers = Math.max(selected.sourceMinPlayers, Math.min(draft.maxPlayers, selected.maxPlayers));
      setDraft({...draft, mode, mapId, maxPlayers,
        minPlayers: Math.max(selected.sourceMinPlayers, Math.min(draft.minPlayers, maxPlayers)),
        friendlyFire: mode <= 3 && draft.friendlyFire});
      setSelecting(false);
      return true;
    }}/> : <RoomCreateDialog open editing initialDraft={draft} initialPasswordAction={passwordAction} map={map} close={close}
      changeMap={(value, action) => {setDraft(value); setPasswordAction(action); setSelecting(true);}}
      submit={async (value, passwordAction) => {
        const {password, ...settings} = value;
        await editor.save({...settings, password: passwordAction === 'KEEP' ? undefined
          : passwordAction === 'CLEAR' ? '' : password});
      }}/>;
}
