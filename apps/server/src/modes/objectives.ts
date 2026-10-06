import type {ObjectiveSnapshot, MsgRoomEvent} from '../../../shared/protocols';
import type {ModeMapConfig} from '../config';
import {getSceneBreakables, getSceneCastles} from '../scene-objects';
import {castleSceneObjects, damageSceneObject} from '../battle/environment';

type SceneTarget = ObjectiveSnapshot & {sourcePlacementId: string; sourceModel: string};

function isSceneTarget(target: ObjectiveSnapshot): target is SceneTarget {
  return target.sourcePlacementId !== undefined && target.sourceModel !== undefined;
}

interface ObjectiveRoom {
  mode: number;
  round?: number;
  map: ModeMapConfig;
}

/**
 * Rule-level objective end. `winnerTeam` is authoritative for mode2 (the team
 * whose enemy Castle reached 0 HP) and `-1` for mode5, where the caller resolves
 * the individual winner from `objectivesDestroyed`/score.
 */
export interface ObjectiveEnd {
  winnerTeam: number;
  winnerPlayerId?: string;
}

/**
 * Server-side Breach lifecycle. `destroyedAt` is the existing shared scheduling
 * field; `rebornAt` is the minimal private clock the rules need to know before
 * a destroyed target is scheduled to return. Nothing here enters the wire schema.
 */
interface BreachState {
  rebornAt?: number;
}

const breachStates = new WeakMap<object, {round: number; mode: number; mapId: number; states: Map<string, BreachState>}>();

function breachStateStore(room: {round?: number; mode: number; map: {mapId: number}}):
{round: number; mode: number; mapId: number; states: Map<string, BreachState>} {
  const round = room.round ?? 0;
  const cached = breachStates.get(room);
  if (cached && cached.round === round && cached.mode === room.mode && cached.mapId === room.map.mapId) return cached;
  const value = {round, mode: room.mode, mapId: room.map.mapId, states: new Map<string, BreachState>()};
  breachStates.set(room, value);
  return value;
}

/** Live objective end; mode2 resolves from the destroyed source Castle owner. */
export function objectiveEnd(room: {
  mode: number;
  map: {mapId: number};
  objectives: readonly ObjectiveSnapshot[];
}): ObjectiveEnd | undefined {
  if (room.mode === 2) {
    for (const target of room.objectives) {
      if (!isCastleObjective(target) || target.hp > 0) continue;
      const castle = getSceneCastles(room.map.mapId)
        .find(source => source.id === target.sourcePlacementId);
      if (!castle) continue;
      return {winnerTeam: castle.affiliation === 1 ? 1 : castle.affiliation === 2 ? 0 : -1};
    }
    return undefined;
  }
  return room.mode === 5 && room.objectives.length > 0
    && room.objectives.every(target => target.hp <= 0) ? {winnerTeam: -1} : undefined;
}

/**
 * Apply one accepted hit to a mode2 Castle or mode5 Breach objective.
 * A destroyed target absorbs no further hit or score until it is realive;
 * mode5 hit/destroy scores come from the source map row.
 */
export function damageObjective(room: {
  roomId: string; phase: string; mode: number;
  map: {mapId: number; hitScore: number; destroyScore: number};
  teamScores?: number[];
}, owner: {id: string; name: string; team: number; score: number; objectivesDestroyed: number},
  target: ObjectiveSnapshot, bulletDamage: number, now: number, events: MsgRoomEvent[]): void {
  if (room.mode === 2 && target.id.startsWith('CASTLE:') && isSceneTarget(target)) {
    damageSceneObject(room, owner, target, bulletDamage, now, events);
    return;
  }
  if (!Number.isFinite(bulletDamage) || bulletDamage <= 0 || target.hp <= 0) return;
  const damage = Math.min(target.hp, bulletDamage);
  target.hp -= damage;
  // Mode2 Castles share identity with the scene entity; credit the attacker's
  // cumulative damage only for a real enemy-Castle HP reduction.
  if (room.mode === 2 && damage > 0 && target.id.startsWith('CASTLE:') && room.teamScores
      && (owner.team === 0 || owner.team === 1)) {
    const castle = getSceneCastles(room.map.mapId).find(source => source.id === target.sourcePlacementId);
    if (castle && (castle.affiliation === 1 || castle.affiliation === 2)
        && castle.affiliation !== owner.team + 1) {
      room.teamScores[owner.team] = (room.teamScores[owner.team] ?? 0) + damage;
    }
  }
  owner.score += room.map.hitScore;
  events.push({roomId: room.roomId, type: 'objectiveHit', message: `${owner.name}命中破坏目标`,
    playerId: owner.id, targetId: target.id, value: damage,
    x: target.x, y: target.y, z: target.z, skillId: undefined});
  if (target.hp <= 0) {
    target.destroyedAt = now;
    owner.objectivesDestroyed++;
    owner.score += room.map.destroyScore;
    events.push({roomId: room.roomId, type: 'objectiveDestroyed', message: `${owner.name}摧毁了目标`,
      playerId: owner.id, targetId: target.id, value: 1,
      x: target.x, y: target.y, z: target.z, skillId: undefined});
  }
}

/** Real source Breach targets: identity/model/matrix/OBB from the CAS record. */
function breachObjectives(room: ObjectiveRoom): ObjectiveSnapshot[] {
  const initialHp = room.map.defaultButt;
  return getSceneBreakables(room.map.mapId).map(source => ({
    id: `SCN:${source.id}`, kind: 'DESTROY' as const, sourcePlacementId: source.id,
    sourceModel: source.model, x: source.matrix[12], y: source.matrix[13], z: source.matrix[14],
    radius: Math.max(...source.dimensions) / 2, hp: initialHp, maxHp: initialHp,
    ownerTeam: -1, contested: false,
  }));
}

/**
 * Build this round's objectives.
 * Mode2 returns the exact Castle instances owned by `createSceneObjects`, so
 * rule HP, rendered HP and destruction lifecycle are one entity. Mode5 returns
 * every real source Breach at the source DefaultButt HP.
 */
export function createObjectives(room: ObjectiveRoom, _bodyRadius?: number): ObjectiveSnapshot[] {
  if (room.mode === 2) return castleSceneObjects(room);
  if (room.mode === 5) {
    breachStateStore(room);
    return breachObjectives(room);
  }
  return [];
}

/** Existing collision geometry is shared with the goal targets via placement identity. */
export function isCastleObjective(objective: Pick<ObjectiveSnapshot, 'id'>): boolean {
  return objective.id.startsWith('CASTLE:');
}

/**
 * Advance objective rules using the server clock in real milliseconds.
 * Returns a rule end only when:
 *  - mode2: some enemy Castle is at rule HP 0 (cumulative damage alone never wins).
 *  - mode5: every current Breach is simultaneously at HP 0 at that instant;
 *    targets reborn earlier in this call are already back above 0 and do not count.
 * The bridge must pass the same real server millisecond clock it uses for snapshots.
 */
export function advanceObjectives(room: {
  mode: number;
  round?: number;
  map: {mapId: number; buttReborn: number; buttRebornTime: number};
  objectives: ObjectiveSnapshot[];
}, now: number): ObjectiveEnd | undefined {
  if (room.mode === 2) return objectiveEnd(room);
  if (room.mode !== 5) return undefined;
  const {states} = breachStateStore(room);
  for (const objective of room.objectives) {
    if (objective.hp > 0) {
      states.delete(objective.id);
      objective.destroyedAt = undefined;
      continue;
    }
    const state = states.get(objective.id) ?? (states.set(objective.id, {}), states.get(objective.id)!);
    if (objective.destroyedAt === undefined) objective.destroyedAt = now;
    state.rebornAt ??= objective.destroyedAt + room.map.buttRebornTime * 1000;
    if (now >= state.rebornAt) {
      objective.hp = room.map.buttReborn;
      objective.maxHp = room.map.buttReborn;
      objective.destroyedAt = undefined;
      states.delete(objective.id);
    }
  }
  return objectiveEnd(room);
}
