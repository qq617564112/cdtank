import {performance} from 'node:perf_hooks';
import {type Battlefield, type Point} from '../../battlefield';
const edgeCaches = new WeakMap<Battlefield, {revision: number; edges: Map<string, boolean>}>();

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
  movement: number | BotNavigationPolicy = 20): Generator<void, Point[]> {
  const traversable = (a: Point, b: Point) => typeof movement === 'number'
    ? clear(field, a, b, movement) : movement.canTraverse(a, b);
  const policyKey = typeof movement === 'number' ? `prototype:${movement}` : movement.cacheKey;
  if (!field.navigation.sample(goal.x, goal.z)?.valid || !field.navigation.sample(start.x, start.z)?.valid) return [];
  if (traversable(start, goal)) return [goal];
  const grid = field.navigation;
  let cache = edgeCaches.get(field);
  if (!cache) {
    cache = {revision: field.navigationRevision, edges: new Map()};
    edgeCaches.set(field, cache);
  }
  const edges = cache.edges;
  const first = grid.sample(start.x, start.z)!;
  const last = grid.sample(goal.x, goal.z)!;
  const key = (x: number, z: number) => `${x},${z}`;
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
  const parents = new Map<string, string | undefined>([[key(first.x, first.z), undefined]]);
  const closed = new Set<string>();
  while (queue.length) {
    yield;
    if (cache.revision !== field.navigationRevision) {
      cache.revision = field.navigationRevision;
      edges.clear();
    }
    const cell = pop();
    const cellKey = key(cell.x, cell.z);
    if (closed.has(cellKey)) continue;
    const a = grid.positionAtCell(cell.x, cell.z);
    if (!a) continue;
    closed.add(cellKey);
    if (cell.x === last.x && cell.z === last.z) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = cell.x + dx, z = cell.z + dz;
      if (closed.has(key(x, z))) continue;
      const b = grid.positionAtCell(x, z);
      const cost = costs.get(key(cell.x, cell.z))! + Math.hypot(dx, dz);
      if (cost >= (costs.get(key(x, z)) ?? Infinity) || !b) continue;
      const edge = `${policyKey}:${cell.x},${cell.z}:${x},${z}`;
      let accepted = edges.get(edge);
      if (accepted === undefined) {
        accepted = traversable(a, b);
        edges.set(edge, accepted);
      }
      if (!accepted) continue;
      costs.set(key(x, z), cost);
      parents.set(key(x, z), key(cell.x, cell.z));
      push({x, z, priority: cost + heuristic(x, z)});
    }
  }
  let current: string | undefined = key(last.x, last.z);
  if (!parents.has(current)) return [];
  const points: Point[] = [goal];
  while (current) {
    const [x, z] = current.split(',').map(Number);
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
    while (end > at && !traversable(a, points[end])) {end--; yield;}
    if (!traversable(a, points[end])) return [];
    a = points[end];
    simplified.push(a);
    at = end + 1;
  }
  return simplified;
}

/** Resumable search; CPU ticks never exhaust the complete grid synchronously. */
export class BotPathPlanner {
  private readonly search: Generator<void, Point[]>;
  constructor(field: Battlefield, start: Point, goal: Point, movement: number | BotNavigationPolicy = 20) {
    this.search = searchBotPath(field, {...start}, {...goal}, movement);
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
