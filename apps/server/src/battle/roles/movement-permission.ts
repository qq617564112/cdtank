import {isRoleMovementAllowed} from '../../../../shared/movement/movement-permission';
import type {RoleCombatState} from './combat-state';
import type {RoleDisguiseState} from '../items/role-disguise';

export {isRoleMovementAllowed, roleMovementCommand} from '../../../../shared/movement/movement-permission';

/** Disguise blocks body motion without changing the original permission counters. */
export function isBattleMovementAllowed(player: {combat: RoleCombatState; roleDisguise?: RoleDisguiseState},
  command: number): boolean {
  return !player.roleDisguise && isRoleMovementAllowed(player.combat, command);
}
