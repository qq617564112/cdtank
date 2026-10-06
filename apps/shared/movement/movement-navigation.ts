import type {NavigationGrid} from './navigation';

interface Point {x: number; y: number; z: number;}
interface SamplingPose {
  position: Point;
  /** Normalized predicted forward, as434cee consumes after its normalization. */
  forward: Point;
}
export interface RoleNavigationResult {
  accepted: boolean;
  /** Meaningful only on failure; success does not initialize the original slot. */
  failureCode?: 0 | 1 | 2;
}

/** Original434cee footprint stage after movement prediction, for horizontal roles. */
export function sampleRoleNavigation(grid: NavigationGrid, pose: SamplingPose,
  command: number, width: number, depth: number): RoleNavigationResult {
  const columns = 1 - Math.trunc((Math.fround(width) - 24) * Math.fround(-1 / 6));
  const length = Math.fround(Math.fround(depth) - 24);
  const rows = Math.trunc(length * Math.fround(1 / 12));
  // Original fixed stack array has ten columns and ten rows, with a stride10.
  // This interface only accepts dimensions whose complete source sampling fits.
  if (!Number.isInteger(columns) || !Number.isInteger(rows)
      || columns < 1 || columns > 10 || rows < 1 || rows > 10 || pose.forward.y !== 0) {
    throw new RangeError('Unsupported original role footprint or nonhorizontal direction');
  }
  let angle = Math.fround(Math.acos(pose.forward.z));
  if (!Number.isFinite(angle)) throw new RangeError('Original sampling acos input outside [-1,1]');
  // Original61e5f8 is an approximate f32 2pi, not Math.PI * 2.
  if (pose.forward.x < 0) angle = Math.fround(6.283180236816406 - angle);
  const cosine = Math.fround(Math.cos(angle)), sine = Math.fround(Math.sin(angle));
  const points: Point[][] = [];
  for (let row = 0; row < rows; row++) {
    const line: Point[] = [];
    for (let column = 0; column < columns; column++) {
      const moving = command === 1 || command === 2 || command >= 5 && command <= 8;
      const localX = moving ? Math.fround(column * 12 - Math.fround(width) + 24) : 0;
      const localZ = !moving ? 0 : command === 1 || command === 5 || command === 6
        ? Math.fround(length - row * 22) : Math.fround(row * 22 - Math.fround(depth) + 24);
      const x = Math.fround(localX * cosine + localZ * sine);
      const z = Math.fround(localZ * cosine - localX * sine);
      line.push({x: Math.fround(x + pose.position.x), y: pose.position.y,
        z: Math.fround(z + pose.position.z)});
    }
    points.push(line);
  }
  const valid = (point: Point): boolean => grid.sample(point.x, point.z)?.valid ?? false;
  const first = valid(points[0][0]), last = valid(points[0][columns - 1]);
  // Commands1/5/6 reverse the side-to-failure-code assignment.
  const reverse = command === 1 || command === 5 || command === 6;
  const side0 = reverse ? last : first, side1 = reverse ? first : last;
  if (!side0 && !side1) return {accepted: false, failureCode: 2};
  if (!side1) return {accepted: false, failureCode: 0};
  if (!side0) return {accepted: false, failureCode: 1};
  for (const line of points) {
    for (let column = 0; column < columns; column++) {
      if (!valid(line[column])) {
        const failureCode = command === 1 || command === 2
          ? (column >= Math.trunc(columns / 2) ? 1 : 0)
          : (command === 5 || command === 8 ? 1 : 0);
        return {accepted: false, failureCode};
      }
    }
  }
  return {accepted: true};
}
