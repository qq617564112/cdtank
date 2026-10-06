import type {NavigationGrid} from '../../navigation';
import {moveRolePose, normalizeRoleMovementDirection, rotateRoleMovementDirection,
  type RoleMovementMathInput, type RoleMovementPose} from './movement-math';
import {sampleRoleNavigation} from './movement-navigation';

export interface RoleMovementResult {
  pose: RoleMovementPose;
  accepted: boolean;
  command: RoleMovementMathInput['command'];
}

/** Original435088: try on copies, retry arcs as turns, then commit or deflect. */
export function moveRoleThroughNavigation(input: RoleMovementMathInput,
  grid: NavigationGrid | undefined, dimensions: {width: number; depth: number}): RoleMovementResult {
  const dt = Math.min(Math.fround(input.dt), Math.fround(.2));
  let command = input.command;
  while (true) {
    const predicted = moveRolePose({...input, command, dt});
    const trial = grid ? sampleRoleNavigation(grid, {position: predicted.position,
      forward: normalizeRoleMovementDirection(predicted.forward)}, command, dimensions.width, dimensions.depth)
      : {accepted: true, failureCode: undefined};
    if (trial.accepted) return {pose: predicted, accepted: true, command};
    if (command >= 5) {
      command = command === 5 || command === 8 ? 4 : 3;
      continue;
    }
    const pose: RoleMovementPose = {position: {...input.position}, look: {...input.look}, forward: {...input.forward}};
    if ((command === 1 || command === 2) && trial.failureCode !== 2) {
      const angle = Math.fround(Math.fround(input.turn) * dt) * (trial.failureCode === 0 ? 1 : -1);
      pose.look = rotateRoleMovementDirection(normalizeRoleMovementDirection(pose.look), angle);
      pose.forward = rotateRoleMovementDirection(normalizeRoleMovementDirection(pose.forward), angle);
    }
    return {pose, accepted: false, command};
  }
}
