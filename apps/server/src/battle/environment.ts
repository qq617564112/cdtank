import type {MsgRoomEvent, SceneObjectSnapshot, SceneCrushSnapshot} from '../../../shared/protocols';
import type {Battlefield} from '../battlefield';
import {getSceneBreakables, getSceneCastles, getSceneCrushes} from '../scene-objects';

const active = new WeakMap<Battlefield, Set<string>>();

/** Breakables use rebuilt 200 HP; Castle initial HP comes from the original CAS. */
export function createSceneObjects(room: {mode: number; map: {mapId: number}}): SceneObjectSnapshot[] {
  const castles = room.mode === 1 && [2, 5, 6, 10, 11].includes(room.map.mapId)
    ? getSceneCastles(room.map.mapId).map(source => ({id: `CASTLE:${source.id}`,
      sourcePlacementId: source.id, sourceModel: source.model,
      x: source.matrix[12], y: source.matrix[13], z: source.matrix[14],
      hp: source.hp, maxHp: source.hp})) : [];
  const models = room.mode === 1 && room.map.mapId === 2 ? ['obj05428', 'obj05427', 'obj05425', 'obj05426', 'obj05422']
    : room.mode === 1 && room.map.mapId === 5 ? ['obj05425', 'obj05426', 'obj05432']
    : room.mode === 1 && room.map.mapId === 6 ? ['obj05421', 'obj05423', 'obj05443', 'obj05433', 'obj05432']
    : room.mode === 1 && room.map.mapId === 10 ? ['obj05425', 'obj05426', 'obj05427', 'obj05428', 'obj05429']
    : room.mode === 1 && room.map.mapId === 11 ? ['obj05430']
    : room.mode === 1 && room.map.mapId === 4 ? ['obj05466', 'obj05422']
    : room.mode === 4 && room.map.mapId === 14 ? ['obj05425', 'obj05426', 'obj05428']
    : room.mode === 4 && room.map.mapId === 17 ? ['obj05469']
    : room.mode === 4 && room.map.mapId === 18 ? ['obj05424', 'obj05442']
    : [1, 3].includes(room.mode) && room.map.mapId === 7 ? ['obj05466', 'obj05467', 'obj05468', 'obj05462', 'obj05423', 'obj05445']
    : [];
  if (!models.length) return castles;
  return [...castles, ...getSceneBreakables(room.map.mapId).filter(source => models.includes(source.model))
    .map(source => ({id: `ENV:${source.id}`, sourcePlacementId: source.id, sourceModel: source.model,
      x: source.matrix[12], y: source.matrix[13], z: source.matrix[14], hp: 200, maxHp: 200}))];
}

export function damageSceneObject(room: {roomId: string; phase: string},
  owner: {id: string; name: string}, target: SceneObjectSnapshot,
  damage: number, now: number, events: MsgRoomEvent[]): void {
  if (room.phase !== 'PLAYING' || !Number.isFinite(damage) || damage <= 0 || target.hp <= 0) return;
  const previousHp = target.hp;
  target.hp = Math.max(0, previousHp - damage);
  events.push({roomId: room.roomId, type: 'sceneObjectHit', message: `${owner.name}命中场景物件`,
    playerId: owner.id, targetId: target.id, value: previousHp - target.hp,
    castleDamage: target.id.startsWith('CASTLE:') ? {castleId: target.sourcePlacementId,
      currentHP: target.hp, maxHP: target.maxHp, delta: previousHp - target.hp} : undefined,
    x: target.x, y: target.y, z: target.z});
  if (target.hp === 0) {
    target.destroyedAt = now;
    events.push({roomId: room.roomId, type: 'sceneObjectDestroyed', message: `${owner.name}摧毁场景物件`,
      playerId: owner.id, targetId: target.id, value: 0, x: target.x, y: target.y, z: target.z});
  }
}

/** Reconstructed source OBB/NAV occupancy retains intact bounds during the broken fade. */
export function syncSceneObjectCollision(room: {map: {mapId: number}; battlefield: Battlefield;
  sceneObjects: readonly SceneObjectSnapshot[]; sceneCrushes?: readonly SceneCrushSnapshot[]}, now: number): void {
  const previous = active.get(room.battlefield) ?? new Set<string>();
  const present = new Set<string>();
  const sources = room.sceneObjects.length
    ? [...getSceneBreakables(room.map.mapId), ...getSceneCastles(room.map.mapId)] : [];
  for (const object of room.sceneObjects) {
    if (object.hp <= 0 && object.destroyedAt !== undefined && now - object.destroyedAt > 2000) continue;
    const source = sources.find(source => source.id === object.sourcePlacementId);
    if (!source) continue;
    present.add(object.id);
    if (!previous.has(object.id)) room.battlefield.setDynamicBox({...source, id: object.id}, object.id);
  }
  for (const object of room.sceneCrushes ?? []) {
    if (!object.enabled || object.hidden) continue;
    const source = getSceneCrushes(room.map.mapId).find(source => source.id === object.sourcePlacementId);
    if (!source) continue;
    present.add(object.id);
    if (!previous.has(object.id)) room.battlefield.setDynamicBox({...source, id: object.id}, object.id);
  }
  for (const id of previous) if (!present.has(id)) room.battlefield.setDynamicBox(undefined, id);
  active.set(room.battlefield, present);
}

export function resetSceneObjectCollision(field: Battlefield): void {
  for (const id of active.get(field) ?? []) field.setDynamicBox(undefined, id);
  active.delete(field);
}
