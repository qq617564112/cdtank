import {writeFileSync} from 'node:fs';
import {getBattlefield, type Point} from '../apps/server/src/battlefield';

// Plan ordinary keyboard waypoints using the same recovered NAV/static boxes.
// This only writes a test route; it never changes a player or the server world.
const field = getBattlefield(7);
function clear(a: Point, b: Point): boolean {
  const reached = field.move(a, b, 20);
  return Math.hypot(reached.x - b.x, reached.z - b.z) < .01;
}
function route(index: number, goal: Point): Point[] {
  const start = field.spawn(index);
  const grid = field.navigation;
  const first = grid.sample(start.x, start.z)!;
  const last = grid.sample(goal.x, goal.z)!;
  const key = (x: number, z: number) => `${x},${z}`;
  const queue = [{x: first.x, z: first.z}];
  const parents = new Map<string, string | undefined>([[key(first.x, first.z), undefined]]);
  for (let cursor = 0; cursor < queue.length && !parents.has(key(last.x, last.z)); cursor++) {
    const cell = queue[cursor];
    const a = grid.positionAtCell(cell.x, cell.z)!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = cell.x + dx, z = cell.z + dz;
      const b = grid.positionAtCell(x, z);
      if (parents.has(key(x, z)) || !b || !clear(a, b)) continue;
      parents.set(key(x, z), key(cell.x, cell.z));
      queue.push({x, z});
    }
  }
  let current: string | undefined = key(last.x, last.z);
  if (!parents.has(current)) throw new Error(`No source NAV route for spawn ${index}`);
  const points: Point[] = [goal];
  while (current) {
    const [x, z] = current.split(',').map(Number);
    points.push(grid.positionAtCell(x, z)!);
    current = parents.get(current);
  }
  points.push(start);
  points.reverse();
  const simplified: Point[] = [];
  let a: Point = start;
  for (let at = 1; at < points.length;) {
    let end = points.length - 1;
    while (end > at && !clear(a, points[end])) end--;
    if (!clear(a, points[end])) throw new Error(`Unreachable route segment ${index}/${at}`);
    a = points[end];
    simplified.push(a);
    at = end + 1;
  }
  return simplified;
}
const goals = [{x: -144, y: .32, z: 240}, {x: -144, y: .32, z: 216}];
const routes = [0, 2].map((spawn, index) => ({spawn, points: route(spawn, goals[index])}));
writeFileSync('recovery/output/team-routes.json', JSON.stringify(routes, null, 2));
console.log(JSON.stringify(routes));
