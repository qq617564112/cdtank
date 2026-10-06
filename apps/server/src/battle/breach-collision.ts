import type {ObjectiveSnapshot} from '../../../shared/protocols';
import type {Battlefield} from '../battlefield';
import {getSceneBreakables} from '../scene-objects';

const active = new WeakMap<Battlefield, Set<string>>();

/** Room-owned render mesh/NAV: intact geometry is retained through the broken fade. */
export function syncBreachCollision(room: {mode: number; map: {mapId: number};
  battlefield: Battlefield; objectives: readonly ObjectiveSnapshot[]}, now: number): void {
  if (room.mode !== 5 || ![20, 21, 22].includes(room.map.mapId)) return;
  let previous = active.get(room.battlefield);
  if (!previous) {previous = new Set(); active.set(room.battlefield, previous);}
  const sources = getSceneBreakables(room.map.mapId);
  const present = new Set<string>();
  for (const objective of room.objectives) {
    if (objective.sourcePlacementId === undefined) continue;
    // Source broken visual fades at 0.5/s and hides after alpha reaches 0;
    // the intact mesh and its dynamic NAV box leave at the same server instant.
    if (objective.hp <= 0 && objective.destroyedAt !== undefined && now - objective.destroyedAt > 2000) continue;
    const source = sources.find(source => source.id === objective.sourcePlacementId);
    if (!source) continue;
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
