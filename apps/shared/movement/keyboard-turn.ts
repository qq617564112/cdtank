import {normalizeRoleMovementDirection, rotateRoleMovementDirection,
  type RoleMovementPose} from './movement-math';
import {roleMovementElapsed} from './movement-time';

/** Rebuilt stationary A/D mapping. Return a candidate for NAV/OBB permission;
 * moving commands retain the original forward-following mathematics.
 */
export function turnStationaryRolePose(pose: RoleMovementPose, inputTurn: number,
    roleTurn: number, seconds: number): RoleMovementPose {
  const position = {...pose.position};
  const elapsed = roleMovementElapsed(seconds);
  if (inputTurn === 0 || elapsed === 0) {
    return {position, look: {...pose.look}, forward: {...pose.forward}};
  }
  const angle = Math.fround(Math.fround(roleTurn) * elapsed) * Math.sign(inputTurn);
  const look = rotateRoleMovementDirection(normalizeRoleMovementDirection({...pose.look}), angle);
  const forward = rotateRoleMovementDirection(normalizeRoleMovementDirection({...pose.forward}), angle);
  // Original moveRolePose clamps direction components before NAV samples acos(z).
  look.x = Math.max(-1, Math.min(look.x, 1));
  look.z = Math.max(-1, Math.min(look.z, 1));
  forward.x = Math.max(-1, Math.min(forward.x, 1));
  forward.z = Math.max(-1, Math.min(forward.z, 1));
  return {position, look, forward};
}
