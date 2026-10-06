import {moveRolePose, type RoleMovementMathInput, type RoleMovementPose} from './movement-math';
import type {RoleObb} from './obb-intersection';

export interface RoleMovementObbPredictionInput {
  pose: RoleMovementPose;
  command: RoleMovementMathInput['command'];
  tankType: RoleMovementMathInput['tankType'];
  move: number;
  turn: number;
  sourceObb: RoleObb;
}

const f = Math.fround;
const TWO_PI = 6.283180236816406;
const DEGREES_PER_RADIAN = 57.295780181884766;
const RADIANS_PER_DEGREE = 0.01745329238474369;

/** Original433073 rebuilds the matrix from forward.z and the sign of forward.x. */
export function createRoleObbFromPose(pose: RoleMovementPose,
  dimensions: RoleObb['dimensions'] = [49, 24, 52]): RoleObb {
  const x = f(pose.forward.x);
  const z = Math.max(-1, Math.min(f(pose.forward.z), 1));
  let angle = Math.acos(z);
  if (x < 0) angle = TWO_PI - angle;
  const degrees = f(angle * DEGREES_PER_RADIAN);
  const radians = degrees * RADIANS_PER_DEGREE;
  // Original10030220 passes the extended product to cos, but reloads f32 for sin.
  const cos = f(Math.cos(radians));
  const sin = f(Math.sin(f(radians)));
  return {matrix: [cos, 0, -sin, 0, 0, 1, 0, 0, sin, 0, cos, 0,
    f(pose.position.x), f(pose.position.y), f(pose.position.z), 1],
    dimensions: [f(dimensions[0]), f(dimensions[1]), f(dimensions[2])]};
}

/** Original433d1c copies below .001, otherwise predicts without NAV and caps dt at .2. */
export function predictRoleMovementObb(input: RoleMovementObbPredictionInput, dt: number): RoleObb {
  dt = f(dt);
  if (dt < f(.001)) {
    return {matrix: [...input.sourceObb.matrix], dimensions: [...input.sourceObb.dimensions]};
  }
  const pose = moveRolePose({...input.pose, command: input.command, tankType: input.tankType,
    move: input.move, turn: input.turn, dt: Math.min(dt, f(.2))});
  return createRoleObbFromPose(pose, input.sourceObb.dimensions);
}
