import type {ClientTankPose} from '../../../shared/protocols/MsgPlayerInput';
import type {PlayerState} from './player-state';
import type {RoleMovementMathInput} from './roles/movement-math';
import {constrainTankPose, tankBodyPose, tankObstacles, type TankBody} from '../../../shared/movement/tank-collision';
import {hasFixedTurret} from '../../../shared/combat/tank-turret';
import type {NavigationGrid} from '../../../shared/movement/navigation';
import {advanceTankVertical, initialTankVerticalState} from '../../../shared/movement/tank-vertical';

/** Accept manual motion up to the first occupied tank body. */
export function acceptClientTankPose(round: number, player: PlayerState, pose: ClientTankPose,
  others: Iterable<TankBody>, navigation?: NavigationGrid): boolean {
  if (!player.alive || pose.round !== round || pose.life !== player.deaths ||
      ![pose.x, pose.y, pose.z, pose.yaw, pose.bodyYaw, pose.aim].every(Number.isFinite) ||
      !Number.isInteger(pose.command) || pose.command < 0 || pose.command > 8) return false;
  if (player.roleDisguise) {
    const aim = hasFixedTurret(player.tank.id) ? (player.bodyYaw ?? player.yaw) - player.yaw
      : pose.yaw + pose.aim - player.yaw;
    player.aim = Math.atan2(Math.sin(aim), Math.cos(aim));
    player.movementCommand = 0;
    return true;
  }
  const start = tankBodyPose(player);
  const accepted = constrainTankPose(start, tankBodyPose(pose), tankObstacles(player.id, others));
  player.verticalState ??= initialTankVerticalState(player.y,
    navigation?.sample(player.x, player.z)?.height);
  const vertical = advanceTankVertical(accepted.position, navigation, player.verticalState, 0);
  player.verticalState = vertical.state;
  const committed = vertical.accepted ? accepted : start;
  Object.assign(player, committed.position);
  player.yaw = Math.atan2(committed.look.x, committed.look.z);
  player.bodyYaw = Math.atan2(committed.forward.x, committed.forward.z);
  const aim = hasFixedTurret(player.tank.id) ? player.bodyYaw - player.yaw
    : pose.yaw + pose.aim - player.yaw;
  player.aim = Math.atan2(Math.sin(aim), Math.cos(aim));
  player.movementState = undefined;
  player.movementCommand = committed === start ? 0 : pose.command as RoleMovementMathInput['command'];
  return true;
}
