import type {MsgRoomEvent, ScenePlantSnapshot} from '../../../shared/protocols';
import type {Battlefield} from '../battlefield';
import {getScenePlants, type ScenePlant} from '../scene-objects';
import type {RoleStaticCollider} from './roles/movement-controller';
import type {RoleObb} from './roles/obb-intersection';
import {SceneContactIndex} from './scene-contact-index';

interface PlantContact {
  state: ScenePlantSnapshot;
  source: ScenePlant;
  obb: RoleObb;
}
const contacts = new WeakMap<readonly ScenePlantSnapshot[], SceneContactIndex<PlantContact>>();

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

/** Source+1e8 Plant order, build-time first-frame OBB and the44e081 hidden guard. */
export function plantContactColliders(room: PlantContactRoom, playerId: string,
  events: MsgRoomEvent[], proposed: RoleObb): RoleStaticCollider[] {
  if (room.phase !== 'PLAYING' || !room.scenePlants?.length) return [];
  let index = contacts.get(room.scenePlants);
  if (!index) {
    const sources = new Map(getScenePlants(room.map.mapId).map(source => [source.id, source]));
    index = new SceneContactIndex(room.scenePlants.map(state => {
      const source = sources.get(state.sourcePlacementId)!;
      return {state, source, obb: source.contactObb};
    }));
    contacts.set(room.scenePlants, index);
  }
  return index.nearby(proposed).filter(({state}) => state.enabled && !state.hidden).map(({state, source, obb}) => {
    return {
      obb,
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
