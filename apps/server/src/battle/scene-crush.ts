import type {MsgRoomEvent, SceneCrushSnapshot} from '../../../shared/protocols';
import type {Battlefield, Point} from '../battlefield';
import {getSceneCrushes} from '../scene-objects';
import type {RoleStaticCollider} from './roles/movement-controller';

interface CrushContactRoom {
  roomId: string;
  phase: string;
  map: {mapId: number};
  sceneCrushes?: SceneCrushSnapshot[];
  battlefield: Battlefield;
}

/** Original scene Crush identities and enabled state from the current source placements. */
export function createSceneCrushes(room: {map: {mapId: number}}): SceneCrushSnapshot[] {
  return getSceneCrushes(room.map.mapId).map(source => ({
    id: `CRUSH:${source.id}`, sourcePlacementId: source.id, sourceModel: source.model,
    enabled: source.enabled, hidden: !source.enabled,
  }));
}

/** Ground objects use the projected render-mesh footprint, without enlarging it.
 * Height-independent ordinary shot selection is a rebuilt server query policy.
 */
export function querySceneCrush(start: Point, end: Point, states: readonly SceneCrushSnapshot[], mapId: number) {
  let nearest: {id: string; fraction: number} | undefined;
  for (const source of getSceneCrushes(mapId)) {
    const state = states.find(state => state.sourcePlacementId === source.id);
    if (!state?.enabled || state.hidden) continue;
    const fraction = source.mesh!.firstFootprintHit(start, end);
    if (fraction !== undefined && (!nearest || fraction < nearest.fraction)) {
      nearest = {id: state.id, fraction};
    }
  }
  return nearest;
}

/** Original44e081 hidden guard precedes45efb3; no HP or delayed fade. */
export function acceptSceneCrush(room: {roomId: string; phase: string; map: {mapId: number};
  battlefield: Battlefield},
  ownerId: string, target: SceneCrushSnapshot, events: MsgRoomEvent[]): boolean {
  if (room.phase !== 'PLAYING' || !target.enabled || target.hidden) return false;
  const source = getSceneCrushes(room.map.mapId).find(source => source.id === target.sourcePlacementId);
  if (!source) return false;
  target.hidden = true;
  room.battlefield.setDynamicBox(undefined, target.id);
  events.push({roomId: room.roomId, type: 'sceneCrushed', message: '隐藏场景物件',
    playerId: ownerId, targetId: target.id, value: 0,
    x: source.matrix[12], y: source.matrix[13], z: source.matrix[14],
    sceneCrush: {placementId: target.sourcePlacementId}});
  return true;
}

/** Original4272d7 appends Crush after Plant and hides without rejecting movement. */
export function sceneCrushContactColliders(room: CrushContactRoom, playerId: string,
  events: MsgRoomEvent[]): RoleStaticCollider[] {
  if (room.phase !== 'PLAYING' || !room.sceneCrushes?.length) return [];
  const sources = getSceneCrushes(room.map.mapId);
  return room.sceneCrushes.filter(state => state.enabled && !state.hidden).flatMap(state => {
    const source = sources.find(source => source.id === state.sourcePlacementId);
    if (!source) return [];
    return [{
      obb: {matrix: source.matrix,
        dimensions: [source.dimensions[0], source.dimensions[1], source.dimensions[2]]},
      notify: () => {
        acceptSceneCrush(room, playerId, state, events);
      },
    }];
  });
}
