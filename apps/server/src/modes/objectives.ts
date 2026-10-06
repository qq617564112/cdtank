import type {ObjectiveSnapshot, MsgRoomEvent} from '../../../shared/protocols';
import type {ModeMapConfig} from '../config';
import type {Battlefield, Point} from '../battlefield';
import {getSceneBreakables} from '../scene-objects';

interface ObjectivePlayer extends Point {
  team: number;
  alive: boolean;
}

interface ObjectiveRoom {
  mode: number;
  map: ModeMapConfig;
  battlefield: Battlefield;
  players: ReadonlyMap<string, ObjectivePlayer>;
}

/** Apply the existing destruction objective damage and scoring in hit order. */
export function damageObjective(room: {
  roomId: string; map: {hitScore: number; destroyScore: number};
}, owner: {id: string; name: string; score: number; objectivesDestroyed: number},
  target: ObjectiveSnapshot, bulletDamage: number, now: number, events: MsgRoomEvent[]): void {
  const damage = Math.min(target.hp, bulletDamage);
  target.hp -= damage;
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

// These are the existing rebuilt mode policies; original authority is unresolved.
export function createObjectives(room: ObjectiveRoom, bodyRadius: number): ObjectiveSnapshot[] {
  if (room.mode !== 2 && room.mode !== 5) return [];
  if (room.mode === 5) {
    // Real Breach placements replace the three guessed spheres. HP/OBB and
    // all-destroyed outcome remain explicit rebuilt policies, not native rules.
    return getSceneBreakables(room.map.mapId).map(source => ({
      id: `SCN:${source.id}`, kind: 'DESTROY', sourcePlacementId: source.id,
      sourceModel: source.model, x: source.matrix[12], y: source.matrix[13], z: source.matrix[14],
      radius: Math.max(...source.dimensions) / 2, hp: room.map.bunkerHp || 200,
      maxHp: room.map.bunkerHp || 200, ownerTeam: -1, contested: false,
    }));
  }
  const count = 1;
  return Array.from({length: count}, (_, index) => {
    const spawn = room.battlefield.spawn(index * 2);
    // Reachable offsets from recovered spawn points; original target placement
    // is unresolved. No guessed original object or castle identity is used.
    let point: Point = spawn;
    if (room.mode === 2) {
      const players = [...room.players.values()];
      const first = players.find(player => player.team === 0);
      const second = players.find(player => player.team === 1);
      if (first && second) {
        const x = (first.x + second.x) / 2;
        const z = (first.z + second.z) / 2;
        const cell = room.battlefield.navigation.sample(x, z);
        if (cell?.valid) {
          const midpoint = {x, y: cell.height, z};
          const reaches = (player: ObjectivePlayer): boolean => {
            const moved = room.battlefield.move(player, midpoint, bodyRadius);
            return Math.hypot(moved.x - x, moved.z - z) < 0.1;
          };
          if (reaches(first) && reaches(second)) point = midpoint;
        }
      }
    }
    // Prefer an equidistant, reachable neutral point for capture. Maps whose
    // original routes do not permit it retain the explicit offset fallback.
    if (point !== spawn) {
      return {id: `O${index + 1}`, kind: 'CAPTURE', ...point, radius: 90,
        hp: 0, maxHp: 0, ownerTeam: -1, contested: false};
    }
    for (let angleIndex = 0; angleIndex < 16; angleIndex++) {
      const angle = angleIndex * Math.PI / 8;
      const end = {...spawn, x: spawn.x + Math.sin(angle) * 100,
        z: spawn.z + Math.cos(angle) * 100};
      const moved = room.battlefield.move(spawn, end, bodyRadius);
      if (Math.hypot(moved.x - spawn.x, moved.z - spawn.z) > 95) {
        point = moved;
        break;
      }
    }
    return {id: `O${index + 1}`, kind: 'CAPTURE',
      ...point, radius: 90, hp: 0, maxHp: 0,
      ownerTeam: -1, contested: false};
  });
}

/** Advance capture ownership and scores after combat; World commits any finish. */
export function advanceObjectives(room: {
  mode: number;
  players: ReadonlyMap<string, ObjectivePlayer>;
  objectives: ObjectiveSnapshot[];
  teamScores: number[];
  targetScore: number;
}, dt: number): boolean {
  if (room.mode === 2) {
    const zone = room.objectives[0];
    const teams = new Set([...room.players.values()].filter(player => player.alive
      && Math.hypot(player.x - zone.x, player.z - zone.z) <= zone.radius
      && Math.abs(player.y - zone.y) < 40).map(player => player.team));
    zone.contested = teams.size > 1;
    zone.ownerTeam = teams.size === 1 ? [...teams][0] : -1;
    if (zone.ownerTeam >= 0) room.teamScores[zone.ownerTeam] += dt;
    return room.teamScores.some(score => score >= room.targetScore);
  }
  return room.mode === 5 && room.objectives.every(objective => objective.hp <= 0);
}
