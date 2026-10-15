import {type Battlefield, type Point} from '../../battlefield';
import type {NavigationGrid} from '../../navigation';
const edgeCaches = new WeakMap<NavigationGrid, {revision: number; edges: Map<string, Map<number, boolean>>}>();
const diagonalCost = Math.hypot(1, 1);
const neighbors: readonly (readonly [number, number, number])[] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, diagonalCost], [-1, 1, diagonalCost], [1, -1, diagonalCost], [-1, -1, diagonalCost],
];

/** Collision policy selected by the participant's actual movement source. */
export interface BotNavigationPolicy {
  readonly cacheKey: string;
  canTraverse(start: Point, end: Point): boolean;
  reachable(start: Point, end: Point): Point;
}

// Rebuilt path planning on recovered NAV and static collision geometry.

function clear(field: Battlefield, a: Point, b: Point, radius: number): boolean {
  const reached = field.move(a, b, radius);
  return Math.hypot(reached.x - b.x, reached.z - b.z) < .01;
}
function* searchBotPath(field: Battlefield, start: Point, goal: Point,
  movement: number | BotNavigationPolicy = 20,
  grid = field.navigation): Generator<void, Point[]> {
  const traversable = (a: Point, b: Point) => typeof movement === 'number'
    ? clear(field, a, b, movement) : movement.canTraverse(a, b);
  const policyKey = typeof movement === 'number' ? `prototype:${movement}` : movement.cacheKey;
  if (!grid.sample(goal.x, goal.z)?.valid || !grid.sample(start.x, start.z)?.valid) return [];
  if (traversable(start, goal)) return [goal];
  let cache = edgeCaches.get(grid);
  if (!cache) {
    cache = {revision: field.navigationRevision, edges: new Map()};
    edgeCaches.set(grid, cache);
  }
  let edges = cache.edges.get(policyKey);
  if (!edges) {
    edges = new Map();
    cache.edges.set(policyKey, edges);
  }
  const first = grid.sample(start.x, start.z)!;
  const last = grid.sample(goal.x, goal.z)!;
  const {width, height} = grid.source;
  const key = (x: number, z: number) => z * width + x;
  const queue: Array<{x: number; z: number; priority: number}> = [];
  const push = (entry: {x: number; z: number; priority: number}): void => {
    queue.push(entry);
    let index = queue.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (queue[parent].priority <= entry.priority) break;
      queue[index] = queue[parent]; index = parent;
    }
    queue[index] = entry;
  };
  const pop = (): {x: number; z: number; priority: number} => {
    const first = queue[0], last = queue.pop()!;
    if (queue.length) {
      let index = 0;
      while (index * 2 + 1 < queue.length) {
        let child = index * 2 + 1;
        if (child + 1 < queue.length && queue[child + 1].priority < queue[child].priority) child++;
        if (last.priority <= queue[child].priority) break;
        queue[index] = queue[child]; index = child;
      }
      queue[index] = last;
    }
    return first;
  };
  const costs = new Map([[key(first.x, first.z), 0]]);
  const heuristic = (x: number, z: number) => Math.hypot(x - last.x, z - last.z);
  push({x: first.x, z: first.z, priority: heuristic(first.x, first.z)});
  const parents = new Map<number, number | undefined>([[key(first.x, first.z), undefined]]);
  const closed = new Set<number>();
  while (queue.length) {
    yield;
    if (cache.revision !== field.navigationRevision) {
      cache.revision = field.navigationRevision;
      // Other suspended planners retain these maps across ticks.
      for (const policyEdges of cache.edges.values()) policyEdges.clear();
    }
    const cell = pop();
    const cellKey = key(cell.x, cell.z);
    if (closed.has(cellKey)) continue;
    const a = grid.positionAtCell(cell.x, cell.z);
    if (!a) continue;
    closed.add(cellKey);
    if (cell.x === last.x && cell.z === last.z) break;
    const cellCost = costs.get(cellKey)!;
    for (let direction = 0; direction < neighbors.length; direction++) {
      const [dx, dz, stepCost] = neighbors[direction];
      const x = cell.x + dx, z = cell.z + dz;
      if (x < 0 || z < 0 || x >= width || z >= height) continue;
      const nextKey = key(x, z);
      if (closed.has(nextKey)) continue;
      const b = grid.positionAtCell(x, z);
      const cost = cellCost + stepCost;
      if (cost >= (costs.get(nextKey) ?? Infinity) || !b) continue;
      const edge = cellKey * neighbors.length + direction;
      let accepted = edges.get(edge);
      if (accepted === undefined) {
        accepted = traversable(a, b);
        edges.set(edge, accepted);
      }
      if (!accepted) continue;
      costs.set(nextKey, cost);
      parents.set(nextKey, cellKey);
      push({x, z, priority: cost + heuristic(x, z)});
    }
  }
  let current: number | undefined = key(last.x, last.z);
  if (!parents.has(current)) return [];
  const points: Point[] = [goal];
  while (current !== undefined) {
    const x = current % width, z = Math.floor(current / width);
    const point = grid.positionAtCell(x, z);
    if (!point) return [];
    points.push(point);
    current = parents.get(current);
  }
  points.push(start);
  points.reverse();
  const simplified: Point[] = [];
  let a: Point = start;
  for (let at = 1; at < points.length;) {
    let end = points.length - 1;
    let accepted = false;
    while (end > at) {
      if (traversable(a, points[end])) {accepted = true; break;}
      end--; yield;
    }
    if (!accepted && !traversable(a, points[end])) return [];
    a = points[end];
    simplified.push(a);
    at = end + 1;
  }
  return simplified;
}

/** Resumable search; CPU ticks never exhaust the complete grid synchronously. */
export class BotPathPlanner {
  private readonly search: Generator<void, Point[]>;
  constructor(field: Battlefield, start: Point, goal: Point, movement: number | BotNavigationPolicy = 20,
    grid = field.navigation) {
    this.search = searchBotPath(field, {...start}, {...goal}, movement, grid);
  }
  advance(maxExpansions = 256, budgetMs = 2): Point[] | undefined {
    const deadline = performance.now() + budgetMs;
    for (let step = 0; step < maxExpansions; step++) {
      const result = this.search.next();
      if (result.done) return result.value;
      if (performance.now() >= deadline) break;
    }
    return undefined;
  }
}

/** Synchronous helper for route verification; runtime uses BotPathPlanner. */
export function findBotPath(field: Battlefield, start: Point, goal: Point, movement: number | BotNavigationPolicy = 20): Point[] {
  const search = searchBotPath(field, start, goal, movement);
  for (;;) {
    const result = search.next();
    if (result.done) return result.value;
  }
}
