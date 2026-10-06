import type {ClientTankPose} from '../../../shared/protocols/MsgPlayerInput';
import type {PlayerState} from './player-state';
import type {RoleMovementMathInput} from './roles/movement-math';
import {constrainTankPose, tankBodyPose, tankObstacles, type TankBody} from '../../../shared/movement/tank-collision';

/** Accept manual motion up to the first occupied tank body. */
export function acceptClientTankPose(round: number, player: PlayerState, pose: ClientTankPose,
  others: Iterable<TankBody>): boolean {
  if (!player.alive || pose.round !== round || pose.life !== player.deaths ||
      ![pose.x, pose.y, pose.z, pose.yaw, pose.bodyYaw, pose.aim].every(Number.isFinite) ||
      !Number.isInteger(pose.command) || pose.command < 0 || pose.command > 8) return false;
  const start = tankBodyPose(player);
  const accepted = constrainTankPose(start, tankBodyPose(pose), tankObstacles(player.id, others));
  Object.assign(player, accepted.position);
  player.yaw = Math.atan2(accepted.look.x, accepted.look.z);
  player.bodyYaw = Math.atan2(accepted.forward.x, accepted.forward.z);
  const aim = pose.yaw + pose.aim - player.yaw;
  player.aim = Math.atan2(Math.sin(aim), Math.cos(aim));
  player.movementState = undefined;
  player.movementCommand = accepted === start ? 0 : pose.command as RoleMovementMathInput['command'];
  return true;
}
