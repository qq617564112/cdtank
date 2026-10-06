export interface RoleMovementVector {x: number; y: number; z: number}
export interface RoleMovementPose {
  position: RoleMovementVector;
  look: RoleMovementVector;
  forward: RoleMovementVector;
}
export interface RoleMovementMathInput extends RoleMovementPose {
  command: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  tankType: 1 | 2 | 3 | 4;
  move: number;
  turn: number;
  dt: number;
}
const f = Math.fround;
const EPSILON = f(.0001);
const RIGHT_ANGLE = 1.570796012878418;
const copy = (v: RoleMovementVector): RoleMovementVector => ({x: f(v.x), y: f(v.y), z: f(v.z)});
const negate = (v: RoleMovementVector): RoleMovementVector => ({x: -v.x, y: -v.y, z: -v.z});

/** Original424043 leaves vectors whose squared length differs from1 by <.0001. */
export function normalizeRoleMovementDirection(v: RoleMovementVector): RoleMovementVector {
  const squared = f(v.z * v.z + v.y * v.y + v.x * v.x);
  const length = Math.abs(squared) < EPSILON ? 0 :
    Math.abs(f(squared - 1)) < EPSILON ? 1 : f(Math.sqrt(squared));
  if (Math.abs(length) < EPSILON) return {x: 0, y: 0, z: 0};
  if (Math.abs(f(length - 1)) < EPSILON) return v;
  const inverse = f(1 / length);
  return {x: f(v.x * inverse), y: f(v.y * inverse), z: f(v.z * inverse)};
}

/** Original57454b stores sin/cos as f32 before rotating around the Y axis. */
export function rotateRoleMovementDirection(v: RoleMovementVector, angle: number): RoleMovementVector {
  const sin = f(Math.sin(angle));
  const cos = f(Math.cos(angle));
  return {x: f(cos * v.x + sin * v.z), y: v.y, z: f(-sin * v.x + cos * v.z)};
}
function angleBetween(a: RoleMovementVector, b: RoleMovementVector): number {
  if (Math.abs(a.x - b.x) < EPSILON && Math.abs(a.z - b.z) < EPSILON) return 0;
  const dot = a.z * b.z + a.y * b.y + a.x * b.x;
  const angle = Math.acos(dot);
  if (!Number.isFinite(angle)) throw new RangeError('Original movement acos input outside [-1,1]');
  return angle;
}
const cross = (look: RoleMovementVector, forward: RoleMovementVector) =>
  look.z * forward.x - forward.z * look.x;
function align(look: RoleMovementVector, forward: RoleMovementVector, command: number,
    tankType: number, turnAngle: number): [RoleMovementVector, RoleMovementVector] {
  if (tankType === 4) return [look, {...look}];
  forward = normalizeRoleMovementDirection(forward);
  look = normalizeRoleMovementDirection(look);
  const gap = angleBetween(look, forward);
  if (command <= 2) {
    if (gap <= turnAngle) return [look, {...look}];
    return [look, rotateRoleMovementDirection(forward, cross(look, forward) < 0 ? turnAngle : -turnAngle)];
  }
  const positive = command === 6 || command === 7;
  // Original434241 compares against3a, rotates by2a, then checks the remaining gap.
  const threshold = f(turnAngle * 3);
  const step = f(turnAngle * 2);
  const side = cross(look, forward);
  const turnsToward = positive ? side >= 0 : side <= 0;
  if (turnsToward && gap >= threshold) return [look, forward];
  forward = rotateRoleMovementDirection(forward, positive ? step : -step);
  if (turnsToward && angleBetween(forward, look) > threshold) {
    forward = rotateRoleMovementDirection(look, positive ? threshold : -threshold);
  }
  return [look, forward];
}

/** Horizontal4344e7 mathematics; dt is supplied after the caller's time gates.
 * Arc commands require positive turn. Collision and explicit external centers are separate.
 */
export function moveRolePose(input: RoleMovementMathInput): RoleMovementPose {
  let position = copy(input.position);
  let look = copy(input.look);
  let forward = copy(input.forward);
  const {command, tankType} = input;
  if (look.y !== 0 || forward.y !== 0) throw new RangeError('Movement mathematics requires horizontal directions');
  const move = f(input.move);
  const turn = f(input.turn);
  const dt = f(input.dt);
  const distance = f(move * dt);
  const turnAngle = f(turn * dt);
  if (command === 0) return {position, look, forward};
  if (command === 1 || command === 2) {
    if (command === 2) {look = negate(look); forward = negate(forward);}
    [look, forward] = align(look, forward, command, tankType, turnAngle);
    position.x = f(position.x + distance * look.x);
    position.z = f(position.z + distance * look.z);
    if (command === 2) {look = negate(look); forward = negate(forward);}
  } else if (command === 3 || command === 4) {
    look = normalizeRoleMovementDirection(look);
    forward = normalizeRoleMovementDirection(forward);
    look = rotateRoleMovementDirection(look, command === 3 ? turnAngle : -turnAngle);
    if (tankType === 4) forward = {...look};
    else {
      look = normalizeRoleMovementDirection(look);
      if (angleBetween(look, forward) > RIGHT_ANGLE) {
        const side = f(cross(look, forward));
        if (command === 3 && side <= 0) forward = rotateRoleMovementDirection(look, -RIGHT_ANGLE);
        else if (command === 4 && side > 0) forward = rotateRoleMovementDirection(look, RIGHT_ANGLE);
      }
    }
  } else {
    if (!(turn > 0)) throw new RangeError('Arc movement requires positive turn');
    const centerRadius = Math.max(move / turn, 80);
    const radius = Math.max(f(move / turn), 80);
    const positiveCenter = command === 5 || command === 7;
    const perpendicular = positiveCenter ? {x: look.z, y: 0, z: -look.x} :
      {x: -look.z, y: 0, z: look.x};
    const center = {x: f(position.x + f(-perpendicular.x * centerRadius)), y: 0,
      z: f(position.z + f(-perpendicular.z * centerRadius))};
    const arcAngle = f(distance / radius);
    const radial = rotateRoleMovementDirection(perpendicular, command === 6 || command === 7 ? arcAngle : -arcAngle);
    position = {x: f(center.x + f(radial.x * radius)), y: 0,
      z: f(center.z + f(radial.z * radius))};
    look = positiveCenter ? {x: -radial.z, y: 0, z: radial.x} :
      {x: radial.z, y: 0, z: -radial.x};
    [look, forward] = align(look, forward, command, tankType, turnAngle);
  }
  look.x = Math.max(-1, Math.min(look.x, 1)); look.z = Math.max(-1, Math.min(look.z, 1));
  forward.x = Math.max(-1, Math.min(forward.x, 1)); forward.z = Math.max(-1, Math.min(forward.z, 1));
  return {position, look, forward};
}
