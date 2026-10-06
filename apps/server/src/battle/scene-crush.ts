import type {MsgRoomEvent, SceneCrushSnapshot} from '../../../shared/protocols';
import type {Point} from '../battlefield';
import {getSceneCrushes} from '../scene-objects';

/** Rebuilt ordinary2001 permission for the original enabled map7 Crush objects. */
export function createSceneCrushes(room: {mode: number; map: {mapId: number}}): SceneCrushSnapshot[] {
  if (![1, 3].includes(room.mode) || room.map.mapId !== 7) return [];
  return getSceneCrushes(7).filter(source => source.model === 'obj05420').map(source => ({
    id: `CRUSH:${source.id}`, sourcePlacementId: source.id, sourceModel: source.model,
    enabled: source.enabled, hidden: !source.enabled,
  }));
}

/** Ground objects use the projected render-mesh footprint, without enlarging it.
 * Height-independent ordinary shot selection is a rebuilt server query policy.
 */
export function querySceneCrush(start: Point, end: Point, states: readonly SceneCrushSnapshot[]) {
  let nearest: {id: string; fraction: number} | undefined;
  for (const source of getSceneCrushes(7)) {
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
export function acceptSceneCrush(room: {roomId: string; phase: string},
  ownerId: string, target: SceneCrushSnapshot, events: MsgRoomEvent[]): boolean {
  if (room.phase !== 'PLAYING' || !target.enabled || target.hidden) return false;
  target.hidden = true;
  const source = getSceneCrushes(7).find(source => source.id === target.sourcePlacementId)!;
  events.push({roomId: room.roomId, type: 'sceneCrushed', message: '射击隐藏场景物件',
    playerId: ownerId, targetId: target.id, value: 0,
    x: source.matrix[12], y: source.matrix[13], z: source.matrix[14],
    sceneCrush: {placementId: target.sourcePlacementId}});
  return true;
}
