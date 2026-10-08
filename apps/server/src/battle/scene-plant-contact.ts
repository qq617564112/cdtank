import type {MsgRoomEvent, ScenePlantSnapshot} from '../../../shared/protocols';
import type {Battlefield} from '../battlefield';
import {getScenePlants} from '../scene-objects';
import type {RoleStaticCollider} from './roles/movement-controller';
import {animatedPlantContact} from './plant-animation-contact';

interface PlantContactRoom {
  roomId: string;
  startedAt: number;
  phase: string;
  map: {mapId: number};
  scenePlants?: ScenePlantSnapshot[];
  battlefield: Battlefield;
}

/** Enabled Plant participation is rebuilt; original type100 hides without blocking. */
export function createScenePlants(room: {map: {mapId: number}}): ScenePlantSnapshot[] {
  return getScenePlants(room.map.mapId).map(source => ({
    id: `PLANT:${source.id}`, sourcePlacementId: source.id, sourceModel: source.model,
    enabled: source.enabled, hidden: !source.enabled,
  }));
}

/** Source+1e8 Plant order, predicted OBB and the44e081 hidden guard. */
export function plantContactColliders(room: PlantContactRoom, playerId: string,
  events: MsgRoomEvent[], now: number): RoleStaticCollider[] {
  if (room.phase !== 'PLAYING' || !room.scenePlants?.length) return [];
  const sources = getScenePlants(room.map.mapId);
  return room.scenePlants.filter(state => state.enabled && !state.hidden).map(state => {
    const source = sources.find(source => source.id === state.sourcePlacementId)!;
    return {
      obb: animatedPlantContact(room.map.mapId, state.sourcePlacementId, Math.max(0, (now - room.startedAt) / 1000)),
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
