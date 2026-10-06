import type {MsgPlayerInput} from '../../../shared/protocols';
import type {Battlefield} from '../battlefield';
import {battleMovementPose, originalMovementParameters, predictBattleMovement,
  type MovingParticipant, type BattleMovementState} from './movement';
import {isRoleMovementAllowed, roleMovementCommand} from './roles/movement-permission';
import {createRoleObbFromPose, predictRoleMovementObb} from './roles/movement-obb-prediction';
import {isRoleControllerMovementAllowed, type RoleMovementCollider, type RoleStaticCollider} from './roles/movement-controller';
import {separateRoleOverlap, type SeparatingRole} from './roles/movement-separation';
import type {RoleMovementMathInput} from './roles/movement-math';
import {turnStationaryRolePose} from './roles/keyboard-turn';

export interface DynamicMovingParticipant extends MovingParticipant {
  id: string;
  movementCommand?: RoleMovementMathInput['command'];
}
interface ControlledMovementState extends BattleMovementState {
  command: RoleMovementMathInput['command'];
}

function collider(player: DynamicMovingParticipant): RoleMovementCollider {
  const pose = battleMovementPose(player);
  const currentObb = createRoleObbFromPose(pose);
  const parameters = originalMovementParameters(player)!;
  return {id: player.id, status: player.combat.status, x: player.x, z: player.z,
    command: player.movementCommand ?? 0, currentObb,
    predictObb: (command, elapsed) => command === 3 || command === 4
      ? createRoleObbFromPose(turnStationaryRolePose(pose, command === 3 ? 1 : -1,
        parameters.turn, elapsed), currentObb.dimensions)
      : predictRoleMovementObb({pose, command,
      tankType: player.tank.recomputeBase.tankType as RoleMovementMathInput['tankType'],
      move: parameters.speed, turn: parameters.turn, sourceObb: currentObb}, elapsed)};
}

/** Complete-source roles execute original dynamic permission before actual NAV.
 * VIP may use the independently recovered movement prefix without full HP
 * readiness. Incomplete peers remain excluded; static type100 is separate.
 */
export function predictControlledBattleMovement(player: DynamicMovingParticipant,
  input: MsgPlayerInput, field: Battlefield, others: Iterable<DynamicMovingParticipant>,
  elapsed: number, staticObjects: Iterable<RoleStaticCollider> = []): ControlledMovementState | undefined {
  if (!originalMovementParameters(player)) return undefined;
  const command = roleMovementCommand(input.move, input.turn) as RoleMovementMathInput['command'];
  const permitted = isRoleMovementAllowed(player.combat, command);
  const peers = [...others].filter(other => !!originalMovementParameters(other));
  if (command !== 0 && permitted && !isRoleControllerMovementAllowed(collider(player), command,
      peers.map(collider), staticObjects, true, () => {})) {
    return {pose: battleMovementPose(player), yaw: player.yaw, bodyYaw: player.bodyYaw ?? player.yaw, command: 0};
  }
  const state = predictBattleMovement(player, input, field, elapsed)!;
  return {...state, command: command === 0 ? 0 : permitted ? command : player.movementCommand ?? 0};
}

/** Original separation is invoked on pose installation, not on each movement tick. */
export function separateBattleParticipants(players: Iterable<DynamicMovingParticipant>,
  field: Battlefield, clock: () => number, targetId?: string): void {
  const complete = [...players].filter(player => !!originalMovementParameters(player));
  const roles: SeparatingRole[] = complete.map(player => {
    const pose = battleMovementPose(player);
    return {id: player.id, status: player.combat.status, pose, obb: createRoleObbFromPose(pose)};
  });
  complete.forEach((player, index) => {
    if (targetId !== undefined && player.id !== targetId) return;
    const role = roles[index];
    separateRoleOverlap(role, roles, field.navigation, clock);
    Object.assign(player, role.pose.position);
  });
}
