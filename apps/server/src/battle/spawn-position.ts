import {defaultAmmoId} from '../../../shared/content/catalog';
import type {Battlefield, SpawnPoint} from '../battlefield';
import {overlapsTankPose, tankBodyPose, tankObstacles, type TankBody} from '../../../shared/movement/tank-collision';
import {battleSpawnLayout, onSpawnSide, spacedSpawns, type BattleSpawnLayout} from './spawn-layout';
import {queryShotTarget} from './shot-query';
import type {ShotModifiers} from './roles/shot-modifiers';

interface TankSpawn {x: number; y: number; z: number; yaw: number;}
interface SpawnParticipant extends TankBody {
  team: number;
  combat?: {currentAmmoTableId: number};
  shotModifiers?: ShotModifiers;
  lastRespawnPosition?: {x: number; z: number};
}

const ENEMY_SPAWN_CLEARANCE = 180;
const ALLY_OPENING_CLEARANCE = 60;

function availableSpawn(field: Battlefield, spawn: TankSpawn,
  obstacles: ReturnType<typeof tankObstacles>): TankSpawn | undefined {
  const cell = field.navigation.sample(spawn.x, spawn.z);
  if (!cell?.valid) return undefined;
  const candidate = {x: spawn.x, y: cell.height, z: spawn.z, yaw: spawn.yaw};
  const cosine = Math.cos(spawn.yaw), sine = Math.sin(spawn.yaw);
  // Check the complete 49x52 footprint, including its boundary and center.
  for (const x of [-24.5, -12, 0, 12, 24.5]) {
    for (const z of [-26, -12, 0, 12, 26]) {
      if (!field.navigation.sample(spawn.x + x * cosine + z * sine,
        spawn.z - x * sine + z * cosine)?.valid) return undefined;
    }
  }
  return overlapsTankPose(tankBodyPose(candidate), obstacles) ? undefined : candidate;
}

function* nearbySpawns(points: readonly TankSpawn[]): Generator<TankSpawn> {
  for (const radius of [60, 120, 180]) {
    for (const spawn of points) {
      for (let direction = 0; direction < 16; direction++) {
        const angle = direction * Math.PI / 8;
        yield {...spawn, x: spawn.x + Math.cos(angle) * radius,
          z: spawn.z + Math.sin(angle) * radius};
      }
    }
  }
}

/** Read real NAV cell centers, refining the search when coarse ground is unavailable. */
function* navigationSpawns(field: Battlefield, yaw: number, step: number): Generator<TankSpawn> {
  const grid = field.navigation.source;
  for (let z = 0; z < grid.height; z += step) {
    for (let x = 0; x < grid.width; x += step) {
      const point = field.navigation.positionAtCell(x, z);
      if (point) yield {...point, yaw};
    }
  }
}

function firstFreeSpawn(field: Battlefield, points: readonly TankSpawn[],
  obstacles: ReturnType<typeof tankObstacles>): TankSpawn | undefined {
  for (const spawn of points) {
    const candidate = availableSpawn(field, spawn, obstacles);
    if (candidate) return candidate;
  }
  for (const spawn of nearbySpawns(points)) {
    const candidate = availableSpawn(field, spawn, obstacles);
    if (candidate) return candidate;
  }
  return undefined;
}

function distanceSquared(a: {x: number; z: number}, b: {x: number; z: number}): number {
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
}

function nearestDistanceSquared(spawn: TankSpawn, players: readonly SpawnParticipant[]): number {
  let distance = Infinity;
  for (const player of players) distance = Math.min(distance, distanceSquared(spawn, player));
  return distance;
}

function openingSpawn(field: Battlefield, layout: BattleSpawnLayout, side: number,
  player: Pick<SpawnParticipant, 'id' | 'team'>, peers: readonly SpawnParticipant[],
  mode: number, anchor?: SpawnPoint): TankSpawn | undefined {
  const obstacles = tankObstacles(player.id, peers);
  const separated = (spawn: TankSpawn): boolean => peers.every(peer => {
    const clearance = mode <= 3 && peer.team === player.team
      ? ALLY_OPENING_CLEARANCE : ENEMY_SPAWN_CLEARANCE;
    return distanceSquared(spawn, peer) >= clearance ** 2;
  });
  if (anchor) {
    const spawn = availableSpawn(field, anchor, obstacles);
    if (spawn && separated(spawn)) return spawn;
  }
  const choose = (points: Iterable<TankSpawn>, supplemental: boolean): TankSpawn | undefined => {
    let selected: TankSpawn | undefined;
    for (const point of points) {
      if (supplemental && !onSpawnSide(layout, point, side)) continue;
      if (!separated(point)) continue;
      const spawn = availableSpawn(field, point, obstacles);
      if (!spawn) continue;
      if (!selected || (anchor ? distanceSquared(spawn, anchor) < distanceSquared(selected, anchor)
        : nearestDistanceSquared(spawn, peers) > nearestDistanceSquared(selected, peers))) selected = spawn;
    }
    return selected;
  };
  if (anchor) {
    const nearby = choose(nearbySpawns([anchor]), true);
    if (nearby) return nearby;
  }
  const points = layout.sides[side];
  const native = choose(points, false);
  if (native) return native;
  const nearby = choose(nearbySpawns(points), true);
  if (nearby) return nearby;
  for (const step of [5, 1]) {
    const spawn = choose(navigationSpawns(field, anchor?.yaw ?? points[0]?.yaw ?? 0, step), true);
    if (spawn) return spawn;
  }
  return undefined;
}

/** Plan the whole opening without using positions left over from the previous round. */
export function initialBattleSpawns(field: Battlefield,
  participants: readonly Pick<SpawnParticipant, 'id' | 'team'>[],
  mode: number): Map<TankBody['id'], TankSpawn> {
  const layout = battleSpawnLayout(field, mode);
  const sides = layout.sides;
  const anchors = new Map<TankBody['id'], SpawnPoint>();
  const sideByPlayer = new Map<TankBody['id'], number>();
  if (mode <= 3) {
    for (const team of [0, 1]) {
      const members = participants.filter(player => player.team === team);
      const spawns = spacedSpawns(sides[team], members.length);
      members.forEach((player, index) => {
        sideByPlayer.set(player.id, team);
        if (spawns[index]) anchors.set(player.id, spawns[index]);
      });
    }
  } else {
    const firstCount = layout.points.length >= participants.length
      ? Math.min(sides[0].length, Math.max(Math.ceil(participants.length / 2),
        participants.length - sides[1].length)) : Math.ceil(participants.length / 2);
    for (const side of [0, 1]) {
      const members = side === 0 ? participants.slice(0, firstCount) : participants.slice(firstCount);
      const spawns = spacedSpawns(sides[side], members.length);
      members.forEach((player, index) => {
        sideByPlayer.set(player.id, side);
        if (spawns[index]) anchors.set(player.id, spawns[index]);
      });
    }
  }
  const result = new Map<TankBody['id'], TankSpawn>();
  const placed: SpawnParticipant[] = [];
  participants.forEach((player, index) => {
    // Reserve later players' native anchors so fallback placement cannot steal them.
    const reserved: SpawnParticipant[] = [];
    for (const other of participants.slice(index + 1)) {
      const anchor = anchors.get(other.id);
      const position = anchor && availableSpawn(field, anchor, []);
      if (position) reserved.push({...position, id: other.id, team: other.team, alive: true});
    }
    const spawn = openingSpawn(field, layout, sideByPlayer.get(player.id)!, player,
      [...placed, ...reserved], mode, anchors.get(player.id));
    if (!spawn) throw new Error(`地图${field.source.id}没有可用出生位置`);
    result.set(player.id, spawn);
    placed.push({...spawn, id: player.id, team: player.team, alive: true});
  });
  return result;
}

/** Prefer covered respawns away from the death and previous respawn positions. */
export function findBattleRespawn(field: Battlefield, player: SpawnParticipant,
  participants: Iterable<SpawnParticipant>, mode: number): TankSpawn | undefined {
  const living = [...participants].filter(other => other.alive && other.id !== player.id);
  const teamMode = mode <= 3;
  const allies = teamMode ? living.filter(other => other.team === player.team) : [];
  const enemies = teamMode ? living.filter(other => other.team !== player.team) : living;
  const layout = battleSpawnLayout(field, mode);
  const side = player.team === 1 ? 1 : 0;
  const points = !teamMode ? layout.points : allies.length
    ? layout.points.filter(spawn => spawn.team === undefined || spawn.team === player.team)
    : layout.sides[side];
  const obstacles = tankObstacles(player.id, living);
  const clearanceSquared = ENEMY_SPAWN_CLEARANCE ** 2;
  const relocated = (spawn: TankSpawn): boolean => distanceSquared(spawn, player) >= clearanceSquared
    && (!player.lastRespawnPosition
      || distanceSquared(spawn, player.lastRespawnPosition) >= clearanceSquared);
  const exposed = (spawn: TankSpawn): boolean => {
    // Temporary tank shielding must not make a respawn appear safe.
    const target = {...spawn, id: String(player.id), alive: true};
    const targets = new Map([[target.id, target]]);
    return enemies.some(enemy => {
      const range = 1000 * (enemy.shotModifiers?.rangePercent ?? 100) / 100;
      const distance = Math.sqrt(distanceSquared(spawn, enemy));
      if (distance > range + 20) return false;
      const ordinary = (enemy.combat?.currentAmmoTableId ?? defaultAmmoId()) === defaultAmmoId();
      const penetratesObstacles = enemy.shotModifiers?.penetratesObstacles === true;
      // Test an enemy turned toward the spawn, rather than its current turret direction.
      const look = {x: (spawn.x - enemy.x) / distance, y: 0, z: (spawn.z - enemy.z) / distance};
      const shooter = {...enemy, id: String(enemy.id)};
      return queryShotTarget(shooter, look, targets, field, 20,
        undefined, ordinary, {closestPlayer: ordinary || penetratesObstacles,
          range, ignoreObstruction: penetratesObstacles}).kind === 'PLAYER'
        || !ordinary && queryShotTarget(shooter, look, targets, field, 20,
          undefined, true, {range, ignoreObstruction: penetratesObstacles}).kind === 'PLAYER';
    });
  };
  const candidates: {spawn: TankSpawn; allyDistance: number; enemyDistance: number; safe?: boolean}[] = [];
  const collect = (spawns: Iterable<TankSpawn>, supplemental = false): void => {
    for (const spawn of spawns) {
      if (supplemental && teamMode && (!allies.length || layout.explicitTeams)
          && !onSpawnSide(layout, spawn, side)) continue;
      const candidate = availableSpawn(field, spawn, obstacles);
      if (candidate) candidates.push({spawn: candidate,
        allyDistance: nearestDistanceSquared(candidate, allies),
        enemyDistance: nearestDistanceSquared(candidate, enemies)});
    }
  };
  const findSafe = (avoidRecent: boolean): TankSpawn | undefined => {
    candidates.sort((a, b) => {
      if (allies.length && a.allyDistance !== b.allyDistance) return a.allyDistance - b.allyDistance;
      return a.enemyDistance === b.enemyDistance ? 0 : b.enemyDistance - a.enemyDistance;
    });
    return candidates.find(candidate => {
      if (avoidRecent && !relocated(candidate.spawn)) return false;
      candidate.safe ??= candidate.enemyDistance >= clearanceSquared && !exposed(candidate.spawn);
      return candidate.safe;
    })?.spawn;
  };
  collect(points);
  let selected = findSafe(true);
  if (!selected) {
    collect(nearbySpawns(points), true);
    selected = findSafe(true);
    for (const step of [5, 1]) {
      if (selected) break;
      collect(navigationSpawns(field, points[0]?.yaw ?? 0, step), true);
      selected = findSafe(true);
    }
  }
  selected ??= findSafe(false);
  if (selected) return selected;
  const alternatives = candidates.filter(candidate => relocated(candidate.spawn));
  let farthestEnemy = -1;
  for (const candidate of alternatives.length ? alternatives : candidates) {
    if (candidate.enemyDistance > farthestEnemy) {
      selected = candidate.spawn;
      farthestEnemy = candidate.enemyDistance;
    }
  }
  return selected;
}

/** Prefer original spawn points, then nearby free ground; an occupied map waits. */
export function findAvailableTankSpawn(field: Battlefield, id: TankBody['id'],
  others: Iterable<TankBody>, preferred?: TankSpawn, team?: number): TankSpawn | undefined {
  const obstacles = tankObstacles(id, others);
  const points = field.spawnPoints(team);
  const first = Math.floor(Math.random() * points.length);
  const spawns = preferred ? [preferred] : points.map((_, index) => points[(first + index) % points.length]);
  return firstFreeSpawn(field, spawns, obstacles);
}
