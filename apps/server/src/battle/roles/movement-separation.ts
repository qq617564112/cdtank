import type {NavigationGrid} from '../../navigation';
import {normalizeRoleMovementDirection, type RoleMovementPose} from './movement-math';
import {createRoleObbFromPose} from './movement-obb-prediction';
import {intersectsOriginalObb, type RoleObb} from './obb-intersection';
import {sampleRoleNavigation} from './movement-navigation';

export interface SeparatingRole {
  id: number | string;
  status: number;
  pose: RoleMovementPose;
  obb: RoleObb;
  previousPosition?: RoleMovementPose['position'];
}
const f = Math.fround;

/** Original410069 reseeds EXE srand from GetTickCount on every call. */
export function originalSeparationRandom(clock: number): number {
  const state = (Math.imul(clock >>> 0, 214013) + 2531011) >>> 0;
  return ((state >>> 16) & 0x7fff) * .000030517578125;
}

/** Original426b92 stops after the first overlapping role; failed NAV relocates
 * to that role's center and recurses, rather than restoring the old position.
 * Caller owns original tree order, scene availability and event invocation.
 */
export function separateRoleOverlap(role: SeparatingRole, others: readonly SeparatingRole[],
  grid: NavigationGrid | undefined, clock: () => number, depth = 0): void {
  if (!grid || depth > 50) return;
  for (const other of others) {
    if (other.id === role.id || other.status === 3 || !intersectsOriginalObb(role.obb, other.obb)) continue;
    let direction = normalizeRoleMovementDirection({x: f(role.pose.position.x - other.pose.position.x),
      y: f(role.pose.position.y - other.pose.position.y), z: f(role.pose.position.z - other.pose.position.z)});
    const squared = f(direction.z * direction.z + direction.y * direction.y + direction.x * direction.x);
    const length = Math.abs(squared) < .0001 ? 0 : Math.abs(f(squared - 1)) < .0001 ? 1 : Math.sqrt(squared);
    if (length < 1) {
      direction.x = f(originalSeparationRandom(clock()));
      direction = normalizeRoleMovementDirection(direction);
    }
    const setPosition = (position: RoleMovementPose['position']) => {
      role.previousPosition = {...role.pose.position};
      role.pose.position = {...position};
      role.obb = createRoleObbFromPose(role.pose, role.obb.dimensions);
    };
    setPosition({x: f(other.pose.position.x + f(direction.x * 60)),
      y: f(other.pose.position.y + f(direction.y * 60)), z: f(other.pose.position.z + f(direction.z * 60))});
    if (!sampleRoleNavigation(grid, role.pose, 0, role.obb.dimensions[0], role.obb.dimensions[2]).accepted) {
      setPosition(other.pose.position);
      separateRoleOverlap(role, others, grid, clock, depth + 1);
    }
    return;
  }
}
