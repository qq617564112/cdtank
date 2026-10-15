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
  const failureCode = sampleRoleNavigationFailure(grid, pose.position, pose.forward, command, width, depth);
  return failureCode === undefined ? {accepted: true} : {accepted: false, failureCode};
}

/** Undefined means passage; failure codes retain the original side assignment. */
export function sampleRoleNavigationFailure(grid: NavigationGrid, position: Point, forward: Point,
  command: number, width: number, depth: number): RoleNavigationResult['failureCode'] {
  const columns = 1 - Math.trunc((Math.fround(width) - 24) * Math.fround(-1 / 6));
  const length = Math.fround(Math.fround(depth) - 24);
  const rows = Math.trunc(length * Math.fround(1 / 12));
  // Original fixed stack array has ten columns and ten rows, with a stride10.
  // This interface only accepts dimensions whose complete source sampling fits.
  if (!Number.isInteger(columns) || !Number.isInteger(rows)
      || columns < 1 || columns > 10 || rows < 1 || rows > 10 || forward.y !== 0) {
    throw new RangeError('Unsupported original role footprint or nonhorizontal direction');
  }
  let angle = Math.fround(Math.acos(forward.z));
  if (!Number.isFinite(angle)) throw new RangeError('Original sampling acos input outside [-1,1]');
  // Original61e5f8 is an approximate f32 2pi, not Math.PI * 2.
  if (forward.x < 0) angle = Math.fround(6.283180236816406 - angle);
  const cosine = Math.fround(Math.cos(angle)), sine = Math.fround(Math.sin(angle));
  const moving = command === 1 || command === 2 || command >= 5 && command <= 8;
  const reverse = command === 1 || command === 5 || command === 6;
  const width32 = Math.fround(width), depth32 = Math.fround(depth);
  const edgeZ = localSampleZ(0, moving, reverse, length, depth32);
  const first = validSample(grid, position, moving ? Math.fround(0 * 12 - width32 + 24) : 0,
    edgeZ, cosine, sine);
  const last = validSample(grid, position, moving ? Math.fround((columns - 1) * 12 - width32 + 24) : 0,
    edgeZ, cosine, sine);
  // Commands1/5/6 reverse the side-to-failure-code assignment.
  const side0 = reverse ? last : first, side1 = reverse ? first : last;
  if (!side0 && !side1) return 2;
  if (!side1) return 0;
  if (!side0) return 1;
  for (let row = 0; row < rows; row++) {
    const localZ = localSampleZ(row, moving, reverse, length, depth32);
    for (let column = 0; column < columns; column++) {
      const localX = moving ? Math.fround(column * 12 - width32 + 24) : 0;
      if (!validSample(grid, position, localX, localZ, cosine, sine)) {
        const failureCode = command === 1 || command === 2
          ? (column >= Math.trunc(columns / 2) ? 1 : 0)
          : (command === 5 || command === 8 ? 1 : 0);
        return failureCode;
      }
    }
  }
  return undefined;
}

function localSampleZ(row: number, moving: boolean, reverse: boolean, length: number, depth: number): number {
  return !moving ? 0 : reverse ? Math.fround(length - row * 22) : Math.fround(row * 22 - depth + 24);
}

function validSample(grid: NavigationGrid, position: Point,
  localX: number, localZ: number, cosine: number, sine: number): boolean {
  const x = Math.fround(localX * cosine + localZ * sine);
  const z = Math.fround(localZ * cosine - localX * sine);
  return grid.isValidAt(Math.fround(x + position.x), Math.fround(z + position.z));
}
