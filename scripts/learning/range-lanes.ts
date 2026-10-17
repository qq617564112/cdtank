import {createOriginalBotNavigation} from '../../apps/server/src/battle/cpu/original-navigation';
import type {Battlefield, Point} from '../../apps/server/src/battlefield';

interface RangeLane {start: Point; target: Point; yaw: number;}
const cached = new Map<string, RangeLane[]>();

/** Clear practice corridors include the travel needed to reach the distance band. */
export function rangeLessonLanes(field: Battlefield, range: number, level: number): readonly RangeLane[] {
  const key = `${field.source.id}:${range}:${level}`;
  const existing = cached.get(key);
  if (existing) return existing;
  const navigation = createOriginalBotNavigation(field);
  const fractions = level === 0 ? [1.05, 1.125, 1.2]
    : level === 1 ? [.35, .45, .55] : [.7, .85, 1.05];
  const lanes: RangeLane[] = [];
  for (const spawn of field.spawns) {
    for (let heading = 0; heading < 72; heading++) {
      const yaw = heading * Math.PI / 36;
      const point = (distance: number): Point | undefined => {
        const x = spawn.x + Math.sin(yaw) * distance, z = spawn.z + Math.cos(yaw) * distance;
        if (!field.navigation.isValidAt(x, z)) return undefined;
        const y = field.navigation.groundHeightAt(x, z);
        return y === undefined ? undefined : {x, y, z};
      };
      for (const fraction of fractions) {
        const target = point(range * fraction);
        const stand = point(range * (fraction - .825));
        if (!target || !stand || !navigation.canTraverse(spawn, target)
            || !navigation.canTraverse(spawn, stand)
            || field.firstSurfaceHit({...spawn, y: spawn.y + 20}, {...target, y: target.y + 20}, 0)) continue;
        lanes.push({start: {...spawn}, target, yaw});
      }
    }
  }
  if (!lanes.length) throw new Error('Map has no traversable practice corridor for this range lesson');
  cached.set(key, lanes);
  return lanes;
}
