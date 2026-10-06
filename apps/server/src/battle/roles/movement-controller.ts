import {intersectsOriginalObb, type RoleObb} from './obb-intersection';
import type {RoleMovementMathInput} from './movement-math';

export interface RoleMovementCollider {
  id: string | number;
  status: number;
  x: number;
  z: number;
  command: RoleMovementMathInput['command'];
  currentObb: RoleObb;
  predictObb(command: RoleMovementMathInput['command'], elapsed: number): RoleObb;
}
export interface RoleStaticCollider {
  obb: RoleObb;
  notify(type: 100): void;
}

/** Original4272d7: dynamic overlap rejects; static hits notify and still allow.
 * The caller owns native tree/container order and command stop/application.
 */
export function isRoleControllerMovementAllowed(role: RoleMovementCollider,
  command: RoleMovementMathInput['command'], others: Iterable<RoleMovementCollider>,
  staticObjects: Iterable<RoleStaticCollider>, mapPresent: boolean,
  diagnostic: (overlapCount: number) => void): boolean {
  const proposed = mapPresent ? role.predictObb(command, Math.fround(.3)) : role.currentObb;
  for (const other of others) {
    if (other.status === 3 || other.id === role.id
        || Math.abs(Math.fround(other.x) - Math.fround(role.x)) > 200
        || Math.abs(Math.fround(other.z) - Math.fround(role.z)) > 200) continue;
    const box = mapPresent ? other.predictObb(other.command, Math.fround(.3)) : other.currentObb;
    if (intersectsOriginalObb(proposed, box)) return false;
  }
  let overlaps = 0;
  for (const object of staticObjects) {
    if (intersectsOriginalObb(object.obb, proposed)) {
      object.notify(100);
      overlaps++;
    }
  }
  if (overlaps > 8) diagnostic(overlaps);
  return true;
}
