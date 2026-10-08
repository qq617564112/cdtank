import {NavigationGrid, type SourceNavigationLayer} from './navigation';
import {CollisionMesh, triangleIntersectsBounds} from './collision-mesh';

const meshOccupancy = new WeakMap<SourceNavigationLayer, Map<CollisionMesh, ReadonlySet<number>>>();

/** Intersect render faces with the 12-unit cells at the role's standing height. */
export function navigationOccupancy(mesh: CollisionMesh, navigation: NavigationGrid, verticalOnly = false,
  cacheResult = true): ReadonlySet<number> {
  const grid = navigation.source;
  let cache = meshOccupancy.get(grid);
  if (!cache) {cache = new Map(); meshOccupancy.set(grid, cache);}
  const cached = cacheResult ? cache.get(mesh) : undefined;
  if (cached) return cached;
  const cells = new Set<number>();
  for (const {vertices, minimum, maximum, normal} of mesh.triangles) {
    if (verticalOnly && Math.abs(normal[1]) > .0001) continue;
    const minX = Math.max(0, Math.floor((minimum[0] - grid.minimum[0]) / 12));
    const maxX = Math.min(grid.width - 1, Math.floor((maximum[0] - grid.minimum[0]) / 12));
    const minZ = Math.max(0, Math.floor((minimum[2] - grid.minimum[2]) / 12));
    const maxZ = Math.min(grid.height - 1, Math.floor((maximum[2] - grid.minimum[2]) / 12));
    for (let z = minZ; z <= maxZ; z++) for (let x = minX; x <= maxX; x++) {
      const index = z * grid.width + x;
      if (cells.has(index)) continue;
      const cell = navigation.cellAt(x, z);
      if (!cell || (cell.fields & 255) <= 1 || cell.height + 24 < minimum[1] || cell.height + .5 > maximum[1]) continue;
      const originX = grid.minimum[0] + x * 12, originZ = grid.minimum[2] + z * 12;
      // Ground contact is allowed; raised faces intersect the 24-unit role body.
      if (triangleIntersectsBounds(vertices, [originX, cell.height + .5, originZ],
          [originX + 12, cell.height + 24, originZ + 12])) cells.add(index);
    }
  }
  if (cacheResult) cache.set(mesh, cells);
  return cells;
}
