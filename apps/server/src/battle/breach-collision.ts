import type {ObjectiveSnapshot} from '../../../shared/protocols';
import type {Battlefield} from '../battlefield';
import {getSceneBreakables} from '../scene-objects';

const active = new WeakMap<Battlefield, Set<string>>();

/** Room-owned reconstructed coverage: retain the intact footprint during broken fade. */
export function syncBreachCollision(room: {mode: number; map: {mapId: number};
  battlefield: Battlefield; objectives: readonly ObjectiveSnapshot[]}, now: number): void {
  if (room.mode !== 5 || ![20, 21, 22].includes(room.map.mapId)) return;
  let previous = active.get(room.battlefield);
  if (!previous) {previous = new Set(); active.set(room.battlefield, previous);}
  const sources = getSceneBreakables(room.map.mapId);
  const present = new Set<string>();
  for (const objective of room.objectives) {
    if (objective.sourcePlacementId === undefined) continue;
    // Original broken visual fades at0.5/s and hides strictly after alpha0.
    // Server-time scheduling and intact bounds during that fade remain rebuilt.
    if (objective.hp <= 0 && objective.destroyedAt !== undefined && now - objective.destroyedAt > 2000) continue;
    const source = sources.find(source => source.id === objective.sourcePlacementId);
    if (!source || room.map.mapId === 20 && !['obj05460', 'obj05461', 'obj05462', 'obj05442'].includes(source.model)) continue;
    present.add(objective.id);
    if (!previous.has(objective.id)) room.battlefield.setDynamicBox({...source, id: objective.id}, objective.id);
  }
  for (const id of previous) if (!present.has(id)) room.battlefield.setDynamicBox(undefined, id);
  active.set(room.battlefield, present);
}

export function resetBreachCollision(field: Battlefield): void {
  for (const id of active.get(field) ?? []) field.setDynamicBox(undefined, id);
  active.delete(field);
}
