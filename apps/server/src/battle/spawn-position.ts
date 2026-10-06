import type {Battlefield} from '../battlefield';
import {overlapsTankPose, tankBodyPose, tankObstacles, type TankBody} from '../../../shared/movement/tank-collision';

interface TankSpawn {x: number; y: number; z: number; yaw: number;}

/** Prefer original spawn points, then nearby free ground; an occupied map waits. */
export function findAvailableTankSpawn(field: Battlefield, id: TankBody['id'],
  others: Iterable<TankBody>, preferred?: TankSpawn): TankSpawn | undefined {
  const obstacles = tankObstacles(id, others);
  const first = Math.floor(Math.random() * field.spawns.length);
  const spawns = preferred ? [preferred] : field.spawns.map((_, index) => field.spawn(first + index));
  const available = (spawn: TankSpawn): TankSpawn | undefined => {
    const cell = field.navigation.sample(spawn.x, spawn.z);
    if (!cell?.valid) return undefined;
    const candidate = {...spawn, y: cell.height};
    const cosine = Math.cos(spawn.yaw), sine = Math.sin(spawn.yaw);
    // Check the complete 49x52 footprint, including its boundary and center.
    for (const x of [-24.5, -12, 0, 12, 24.5]) {
      for (const z of [-26, -12, 0, 12, 26]) {
        if (!field.navigation.sample(spawn.x + x * cosine + z * sine,
          spawn.z - x * sine + z * cosine)?.valid) return undefined;
      }
    }
    return overlapsTankPose(tankBodyPose(candidate), obstacles) ? undefined : candidate;
  };
  for (const spawn of spawns) {
    const candidate = available(spawn);
    if (candidate) return candidate;
  }
  for (const radius of [60, 120, 180]) {
    for (const spawn of spawns) {
      for (let direction = 0; direction < 16; direction++) {
        const angle = direction * Math.PI / 8;
        const candidate = available({...spawn,
          x: spawn.x + Math.cos(angle) * radius, z: spawn.z + Math.sin(angle) * radius});
        if (candidate) return candidate;
      }
    }
  }
  return undefined;
}
