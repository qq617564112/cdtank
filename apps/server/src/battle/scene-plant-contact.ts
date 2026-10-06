import type {MsgRoomEvent, ScenePlantSnapshot} from '../../../shared/protocols';
import type {Battlefield} from '../battlefield';
import {getScenePlants} from '../scene-objects';
import type {RoleStaticCollider} from './roles/movement-controller';

interface PlantContactRoom {
  roomId: string;
  phase: string;
  map: {mapId: number};
  scenePlants?: ScenePlantSnapshot[];
  battlefield: Battlefield;
}

/** Enabled Plant participation is rebuilt; original type100 hides without blocking. */
export function createScenePlants(room: {mode: number; map: {mapId: number}}): ScenePlantSnapshot[] {
  const supported = [2, 5].includes(room.map.mapId) && [1, 2, 3].includes(room.mode) ||
    room.map.mapId === 4 && [1, 3].includes(room.mode);
  if (!supported) return [];
  return getScenePlants(room.map.mapId).map(source => ({
    id: `PLANT:${source.id}`, sourcePlacementId: source.id, sourceModel: source.model,
    enabled: source.enabled, hidden: !source.enabled,
  }));
}

/** Source+1e8 Plant order, predicted OBB and the44e081 hidden guard. */
export function plantContactColliders(room: PlantContactRoom, playerId: string,
  events: MsgRoomEvent[]): RoleStaticCollider[] {
  if (room.phase !== 'PLAYING' || !room.scenePlants?.length) return [];
  const sources = getScenePlants(room.map.mapId);
  return room.scenePlants.filter(state => state.enabled && !state.hidden).map(state => {
    const source = sources.find(source => source.id === state.sourcePlacementId)!;
    return {
      obb: {matrix: source.matrix,
        dimensions: [source.dimensions[0], source.dimensions[1], source.dimensions[2]]},
      notify: () => {
        if (state.hidden) return;
        state.hidden = true;
        room.battlefield.setDynamicBox(undefined, state.id);
        events.push({roomId: room.roomId, type: 'scenePlantHidden', message: '接触隐藏场景植物',
          playerId, targetId: state.id, value: 0,
          x: source.matrix[12], y: source.matrix[13], z: source.matrix[14],
          scenePlant: {placementId: state.sourcePlacementId}});
      },
    };
  });
}
