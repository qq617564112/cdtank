import type {Battlefield, SpawnPoint} from '../battlefield';

export interface BattleSpawnLayout {
  points: readonly SpawnPoint[];
  sides: [SpawnPoint[], SpawnPoint[]];
  explicitTeams: boolean;
  boundary: {x: number; z: number; offset: number};
}

/** Use the fullest grounded source group; ties favor team or individual layouts. */
export function battleSpawnLayout(field: Battlefield, mode: number): BattleSpawnLayout {
  const groups = mode <= 3 ? field.spawnGroups : [...field.spawnGroups].reverse();
  const points = groups.reduce((best, group) => group.length > best.length ? group : best, groups[0]);
  const explicitTeams = points.some(point => point.team !== undefined);
  let sides: [SpawnPoint[], SpawnPoint[]] = [[], []];
  if (explicitTeams || points === field.spawnGroups[0]) {
    points.forEach((point, index) => {
      const side = point.team ?? ((point.slot ?? index) < 6 ? 0 : 1);
      sides[side === 1 ? 1 : 0].push(point);
    });
  }
  let boundary: BattleSpawnLayout['boundary'];
  if (explicitTeams || sides[0].length && sides[1].length) {
    const center = (side: number): {x: number; z: number} => {
      const group = sides[side];
      const grid = field.navigation.source;
      return group.length ? {
        x: group.reduce((sum, point) => sum + point.x, 0) / group.length,
        z: group.reduce((sum, point) => sum + point.z, 0) / group.length,
      } : {x: grid.minimum[0] + (grid.maximum[0] - grid.minimum[0]) * (side ? .75 : .25),
        z: (grid.minimum[2] + grid.maximum[2]) / 2};
    };
    const first = center(0), second = center(1);
    const x = second.x - first.x, z = second.z - first.z;
    boundary = {x, z, offset: (first.x + second.x) / 2 * x + (first.z + second.z) / 2 * z};
  } else {
    // Individual source arrays can circle the map instead of naming two teams.
    const grid = field.navigation.source;
    const minX = points.length ? Math.min(...points.map(point => point.x)) : grid.minimum[0];
    const maxX = points.length ? Math.max(...points.map(point => point.x)) : grid.maximum[0];
    const minZ = points.length ? Math.min(...points.map(point => point.z)) : grid.minimum[2];
    const maxZ = points.length ? Math.max(...points.map(point => point.z)) : grid.maximum[2];
    const axis = maxX - minX >= maxZ - minZ ? 'x' : 'z';
    const ordered = [...points].sort((a, b) => a[axis] - b[axis]);
    const middle = Math.ceil(ordered.length / 2);
    sides = [ordered.slice(0, middle), ordered.slice(middle)];
    const offset = sides[0].length && sides[1].length
      ? (sides[0][sides[0].length - 1][axis] + sides[1][0][axis]) / 2
      : axis === 'x' ? (minX + maxX) / 2 : (minZ + maxZ) / 2;
    boundary = {x: axis === 'x' ? 1 : 0, z: axis === 'z' ? 1 : 0, offset};
    const along = axis === 'x' ? 'z' : 'x';
    sides.forEach(side => side.sort((a, b) => a[along] - b[along] || (a.slot ?? 0) - (b.slot ?? 0)));
  }
  return {points, sides, explicitTeams, boundary};
}

/** Keep supplemental opening points inside the participant's side of the map. */
export function onSpawnSide(layout: BattleSpawnLayout, point: {x: number; z: number},
  side: number): boolean {
  const distance = point.x * layout.boundary.x + point.z * layout.boundary.z - layout.boundary.offset;
  return side === 1 ? distance >= 0 : distance <= 0;
}

/** Include both endpoints, without repeating a source point when slots are scarce. */
export function spacedSpawns(points: readonly SpawnPoint[], count: number): SpawnPoint[] {
  const available = Math.min(count, points.length);
  return Array.from({length: available}, (_, index) =>
    points[available === 1 ? 0 : Math.round(index * (points.length - 1) / (available - 1))]);
}
