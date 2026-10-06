import type {MsgRoomEvent, ObjectiveSnapshot, SceneObjectSnapshot, SceneCrushSnapshot} from '../../../shared/protocols';
import type {Battlefield} from '../battlefield';
import {getSceneBreakables, getSceneCastles, getSceneCrushes} from '../scene-objects';
import type {RoundStatsCarrier} from './round-statistics';

type BunkerDamageCarrier = RoundStatsCarrier & {
  roundStats?: NonNullable<RoundStatsCarrier['roundStats']> & {bunkerDamage?: number};
};

const active = new WeakMap<Battlefield, Set<string>>();
const castleTargets = new WeakMap<object, {round: number; mode: number; mapId: number; objects: CastleTargetSnapshot[]}>();

/** One Castle instance serves both the mode2 rule target and the rendered scene entity. */
export interface CastleTargetSnapshot extends SceneObjectSnapshot, ObjectiveSnapshot {
  kind: 'CAPTURE' | 'DESTROY';
}

interface CastleRoom {
  mode: number;
  round?: number;
  map: {mapId: number; bunkerHp?: number};
}

/**
 * Original Castle placements as a single entity. The per-room memo keeps
 * `objectives` and `sceneObjects` pointed at the same objects, so rule HP,
 * render HP and destruction lifecycle never split into duplicate entities.
 * Mode1 keeps the CAS record HP; mode2 uses the source BunkerHP rule value.
 */
export function castleSceneObjects(room: CastleRoom): CastleTargetSnapshot[] {
  if ((room.mode !== 1 && room.mode !== 2) || ![2, 5, 6, 10, 11].includes(room.map.mapId)) return [];
  const round = room.round ?? 0;
  const cached = castleTargets.get(room);
  if (cached && cached.round === round && cached.mode === room.mode && cached.mapId === room.map.mapId) {
    return cached.objects;
  }
  const objects = getSceneCastles(room.map.mapId).map(source => {
    const hp = room.mode === 2 ? room.map.bunkerHp ?? source.hp : source.hp;
    return {id: `CASTLE:${source.id}`, sourcePlacementId: source.id, sourceModel: source.model,
      x: source.matrix[12], y: source.matrix[13], z: source.matrix[14], hp, maxHp: hp,
      kind: room.mode === 2 ? 'CAPTURE' as const : 'DESTROY' as const,
      radius: Math.max(...source.dimensions) / 2,
      ownerTeam: source.affiliation - 1, contested: false};
  });
  castleTargets.set(room, {round, mode: room.mode, mapId: room.map.mapId, objects});
  return objects;
}

/** Castle rule instances plus the existing rebuilt ordinary breakables. */
export function createSceneObjects(room: CastleRoom): SceneObjectSnapshot[] {
  const castles = castleSceneObjects(room);
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

/**
 * Apply Castle/Breach rule HP. Only a real enemy-Castle HP reduction credits
 * the attacker's cumulative `teamScores`; own-Castle damage still reduces the
 * same instance's HP but is never a friendly score. Cumulative damage alone
 * never wins: victory reads the live Castle HP in `advanceObjectives`.
 */
export function damageSceneObject(room: {roomId: string; phase: string; mode: number;
  map: {mapId: number}; teamScores?: number[]},
  owner: BunkerDamageCarrier & {id: string; name: string; team: number}, target: SceneObjectSnapshot,
  damage: number, now: number, events: MsgRoomEvent[]): void {
  if (room.phase !== 'PLAYING' || !Number.isFinite(damage) || damage <= 0 || target.hp <= 0) return;
  const previousHp = target.hp;
  target.hp = Math.max(0, previousHp - damage);
  const dealt = previousHp - target.hp;
  if (room.mode === 2 && dealt > 0 && target.id.startsWith('CASTLE:')) {
    const castle = getSceneCastles(room.map.mapId).find(source => source.id === target.sourcePlacementId);
    if (castle && (castle.affiliation === 1 || castle.affiliation === 2)
        && (owner.team === 0 || owner.team === 1)
        && castle.affiliation !== owner.team + 1) {
      if (room.teamScores) room.teamScores[owner.team] = (room.teamScores[owner.team] ?? 0) + dealt;
      if (owner.roundStats) {
        owner.roundStats.bunkerDamage = (owner.roundStats.bunkerDamage ?? 0) + dealt;
      }
    }
  }
  events.push({roomId: room.roomId, type: 'sceneObjectHit', message: `${owner.name}命中场景物件`,
    playerId: owner.id, targetId: target.id, value: dealt,
    castleDamage: target.id.startsWith('CASTLE:') ? {castleId: target.sourcePlacementId,
      currentHP: target.hp, maxHP: target.maxHp, delta: dealt} : undefined,
    x: target.x, y: target.y, z: target.z});
  if (target.hp === 0) {
    target.destroyedAt = now;
    events.push({roomId: room.roomId, type: 'sceneObjectDestroyed', message: `${owner.name}摧毁场景物件`,
      playerId: owner.id, targetId: target.id, value: 0, x: target.x, y: target.y, z: target.z});
  }
}

/** Render mesh/NAV occupancy retains intact geometry during the broken fade. */
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
