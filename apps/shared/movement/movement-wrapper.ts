import type {NavigationGrid} from './navigation';
import {moveRolePose, normalizeRoleMovementDirection, rotateRoleMovementDirection,
  type RoleMovementMathInput, type RoleMovementPose} from './movement-math';
import {sampleRoleNavigationFailure} from './movement-navigation';
import {turnStationaryRolePose} from './keyboard-turn';

export interface RoleMovementResult {
  pose: RoleMovementPose;
  accepted: boolean;
  command: RoleMovementMathInput['command'];
}

/** Sample the whole travel path so blocked translation can retry as a turn. */
export function canMoveRoleThroughNavigation(start: RoleMovementPose, end: RoleMovementPose,
  grid: NavigationGrid, command: RoleMovementMathInput['command'],
  dimensions: {width: number; depth: number}): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(end.position.x - start.position.x,
    end.position.z - start.position.z) / 6));
  const firstYaw = Math.atan2(start.forward.x, start.forward.z);
  const lastYaw = Math.atan2(end.forward.x, end.forward.z);
  const turn = Math.atan2(Math.sin(lastYaw - firstYaw), Math.cos(lastYaw - firstYaw));
  const position = {x: 0, y: start.position.y, z: 0}, forward = {x: 0, y: 0, z: 0};
  for (let step = 1; step <= steps; step++) {
    const fraction = step / steps, heading = firstYaw + turn * fraction;
    position.x = start.position.x + (end.position.x - start.position.x) * fraction;
    position.z = start.position.z + (end.position.z - start.position.z) * fraction;
    forward.x = Math.fround(Math.sin(heading));
    forward.z = Math.fround(Math.cos(heading));
    if (sampleRoleNavigationFailure(grid, position, forward, command,
      dimensions.width, dimensions.depth) !== undefined) return false;
  }
  return true;
}

/** Original travel kernel with swept NAV checks and stationary body-turn retries. */
export function moveRoleThroughNavigation(input: RoleMovementMathInput,
  grid: NavigationGrid | undefined, dimensions: {width: number; depth: number}): RoleMovementResult {
  const dt = Math.min(Math.fround(input.dt), Math.fround(.2));
  const command = input.command;
  const predicted = moveRolePose({...input, dt});
  const failureCode = grid ? sampleRoleNavigationFailure(grid, predicted.position,
    normalizeRoleMovementDirection(predicted.forward), command, dimensions.width, dimensions.depth) : undefined;
  if (failureCode === undefined && (!grid
      || canMoveRoleThroughNavigation(input, predicted, grid, command, dimensions))) {
    return {pose: predicted, accepted: true, command};
  }
  if (command >= 5) {
    // Reverse arcs retain their actual yaw direction when travel is blocked.
    const sign = command === 5 || command === 8 ? -1 : 1;
    const turnCommand = sign > 0 ? 3 : 4;
    const pose = turnStationaryRolePose(input, sign, input.turn, dt);
    const accepted = !grid || canMoveRoleThroughNavigation(input, pose, grid, turnCommand, dimensions);
    return {pose: accepted ? pose : input, accepted, command: turnCommand};
  }
  const pose: RoleMovementPose = {position: {...input.position}, look: {...input.look}, forward: {...input.forward}};
  if ((command === 1 || command === 2) && failureCode !== undefined && failureCode !== 2) {
    const angle = Math.fround(Math.fround(input.turn) * dt) * (failureCode === 0 ? 1 : -1);
    pose.look = rotateRoleMovementDirection(normalizeRoleMovementDirection(pose.look), angle);
    pose.forward = rotateRoleMovementDirection(normalizeRoleMovementDirection(pose.forward), angle);
  }
  return {pose, accepted: false, command};
}
