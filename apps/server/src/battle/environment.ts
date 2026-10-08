import type {MsgRoomEvent, ObjectiveSnapshot, SceneObjectSnapshot, SceneCrushSnapshot} from '../../../shared/protocols';
import type {Battlefield} from '../battlefield';
import {getSceneBreakables, getSceneCastles, getSceneCrushes} from '../scene-objects';
import {recordBunkerDamage, type RoundStatsCarrier} from './round-statistics';
import {setCastleDamageAnimation} from './castle-animation';

const active = new WeakMap<Battlefield, Set<string>>();
const castleTargets = new WeakMap<object, {round: number; mode: number; mapId: number; objects: CastleTargetSnapshot[]}>();

/** One Castle instance serves both the mode2 rule target and the rendered scene entity. */
export interface CastleTargetSnapshot extends SceneObjectSnapshot, ObjectiveSnapshot {
  kind: 'CAPTURE' | 'DESTROY';
  sourcePlacementId: string;
  sourceModel: string;
}

interface CastleRoom {
  mode: number;
  round?: number;
  map: {mapId: number; bunkerHp?: number; defaultButt?: number};
}

/**
 * Original Castle placements as a single entity. The per-room memo keeps
 * `objectives` and `sceneObjects` pointed at the same objects, so rule HP,
 * render HP and destruction lifecycle never split into duplicate entities.
 * Mode1 keeps the CAS record HP; mode2 uses the source BunkerHP rule value.
 */
export function castleSceneObjects(room: CastleRoom): CastleTargetSnapshot[] {
  if (room.mode !== 1 && room.mode !== 2) return [];
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
  const sources = [1, 2, 3, 4].includes(room.mode) ? getSceneBreakables(room.map.mapId) : [];
  if (!sources.length) return castles;
  const initialHp = room.map.defaultButt ?? 200;
  if (!(initialHp > 0)) return castles;
  return [...castles, ...sources
    .map(source => ({id: `ENV:${source.id}`, sourcePlacementId: source.id, sourceModel: source.model,
      x: source.matrix[12], y: source.matrix[13], z: source.matrix[14], hp: initialHp, maxHp: initialHp}))];
}

/**
 * Restore ordinary mode1-4 Breaches in place. Source map values define both
 * the delay and HP; non-positive values disable automatic restoration rather
 * than repeatedly scheduling a zero-HP object. No private state is needed:
 * `destroyedAt` is already the round-scoped destruction clock carried by the
 * room and reconnect snapshots.
 */
export function advanceSceneObjects(room: {
  mode: number;
  map: {buttReborn: number; buttRebornTime: number};
  sceneObjects: readonly SceneObjectSnapshot[];
}, now: number): void {
  if (![1, 2, 3, 4].includes(room.mode)) return;
  const rebornHp = room.map.buttReborn;
  const rebornSeconds = room.map.buttRebornTime;
  if (!(rebornHp > 0) || !(rebornSeconds > 0)) return;
  for (const object of room.sceneObjects) {
    if (object.id.startsWith('CASTLE:') || object.hp > 0 || object.destroyedAt === undefined) continue;
    if (now - object.destroyedAt < rebornSeconds * 1000) continue;
    object.hp = rebornHp;
    object.maxHp = rebornHp;
    object.destroyedAt = undefined;
  }
}

/**
 * Apply Castle/Breach rule HP. Only a real enemy-Castle HP reduction credits
 * the attacker's cumulative `teamScores`; own-Castle damage still reduces the
 * same instance's HP but is never a friendly score. Cumulative damage alone
 * never wins: victory reads the live Castle HP in `advanceObjectives`.
 */
export function damageSceneObject(room: {roomId: string; phase: string; mode: number;
  map: {mapId: number}; teamScores?: number[]},
  owner: RoundStatsCarrier & {id: string; name: string; team: number; sceneBreakCount?: number}, target: SceneObjectSnapshot,
  damage: number, now: number, events: MsgRoomEvent[]): void {
  if (room.phase !== 'PLAYING' || !Number.isFinite(damage) || damage <= 0 || target.hp <= 0) return;
  const previousHp = target.hp;
  target.hp = Math.max(0, previousHp - damage);
  const dealt = previousHp - target.hp;
  setCastleDamageAnimation(target, previousHp, now);
  if (room.mode === 2 && dealt > 0 && target.id.startsWith('CASTLE:')) {
    const castle = getSceneCastles(room.map.mapId).find(source => source.id === target.sourcePlacementId);
    if (castle && (castle.affiliation === 1 || castle.affiliation === 2)
        && (owner.team === 0 || owner.team === 1)
        && castle.affiliation !== owner.team + 1) {
      if (room.teamScores) room.teamScores[owner.team] = (room.teamScores[owner.team] ?? 0) + dealt;
      recordBunkerDamage(owner, dealt);
    }
  }
  events.push({roomId: room.roomId, type: 'sceneObjectHit', message: `${owner.name}命中场景物件`,
    playerId: owner.id, targetId: target.id, value: dealt,
    castleDamage: target.id.startsWith('CASTLE:') ? {castleId: target.sourcePlacementId,
      currentHP: target.hp, maxHP: target.maxHp, delta: dealt} : undefined,
    x: target.x, y: target.y, z: target.z});
  if (target.hp === 0) {
    target.destroyedAt = now;
    owner.sceneBreakCount = (owner.sceneBreakCount ?? 0) + 1;
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
