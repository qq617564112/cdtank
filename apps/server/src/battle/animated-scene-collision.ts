import type {Battlefield} from '../battlefield';
import type {ObjectiveSnapshot, SceneObjectSnapshot, SceneCrushSnapshot} from '../../../shared/protocols';
import {getAnimatedSceneColliders, sampleAnimatedSceneCollider} from '../scene-objects';

interface AnimatedRoom {
  startedAt: number;
  map: {mapId: number};
  battlefield: Battlefield;
  objectives: readonly ObjectiveSnapshot[];
  sceneObjects: readonly SceneObjectSnapshot[];
  sceneCrushes?: readonly SceneCrushSnapshot[];
}
const active = new WeakMap<Battlefield, Set<string>>();

/** Only animated placements replace static collision; business target identity stays intact. */
export function syncAnimatedSceneCollision(room: AnimatedRoom, now: number): void {
  const present = new Set<string>();
  const objects = new Map([...room.objectives, ...room.sceneObjects]
    .map(object => [object.sourcePlacementId, object]));
  const crushes = new Map((room.sceneCrushes ?? []).map(object => [object.sourcePlacementId, object]));
  for (const source of getAnimatedSceneColliders(room.map.mapId)) {
    const object = objects.get(source.id), crush = crushes.get(source.id);
    const id = object?.id ?? crush?.id ?? `ANIM:${source.id}`;
    if ((object && object.hp <= 0 && object.destroyedAt !== undefined && now - object.destroyedAt > 2000)
        || (crush && (!crush.enabled || crush.hidden))) continue;
    const animation = object && 'castleAnimation' in object ? object.castleAnimation : undefined;
    const action = animation?.action as 'c2' | 'c3' | 'n1' | 'n2' | undefined;
    const time = Math.max(0, (now - (animation?.startedAt ?? room.startedAt)) / 1000);
    const mesh = sampleAnimatedSceneCollider(source, time, action ?? 'n1', animation?.stopAtEnd ?? false);
    room.battlefield.setAnimatedBox({...source, id, mesh}, id);
    present.add(id);
  }
  for (const id of active.get(room.battlefield) ?? []) {
    if (!present.has(id)) room.battlefield.setAnimatedBox(undefined, id);
  }
  active.set(room.battlefield, present);
}

export function resetAnimatedSceneCollision(field: Battlefield): void {
  for (const id of active.get(field) ?? []) field.setAnimatedBox(undefined, id);
  active.delete(field);
}
