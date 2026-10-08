import type {RoleMovementMathInput} from './movement-math';

interface MovementRole {
  readonly status: number;
  getFlag(index: number): number;
}

/** Original432f91 with native431d92/43293d; controller/map gates are separate. */
export function isRoleMovementAllowed(role: MovementRole, command: number): boolean {
  if (role.getFlag(8) !== 0 || role.status !== 2) return false;
  if (command > 0 && command <= 2) return role.getFlag(9) !== 0;
  if (command > 2 && command <= 4) return role.getFlag(10) !== 0;
  return role.getFlag(9) !== 0 && role.getFlag(10) !== 0;
}

/** Map accepted axes to original low-four-bit command priority, not keyboard keys. */
export function roleMovementCommand(move: number, turn: number): RoleMovementMathInput['command'] {
  if (move > 0) return turn > 0 ? 6 : turn < 0 ? 5 : 1;
  if (move < 0) return turn > 0 ? 8 : turn < 0 ? 7 : 2;
  return turn > 0 ? 3 : turn < 0 ? 4 : 0;
}
