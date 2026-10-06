import type {Battlefield} from '../battlefield';
import {battleMovementPose, commitBattleMovement, originalMovementParameters,
  ORIGINAL_MOVEMENT_DIMENSIONS} from './movement';
import {createBattleMovementCollider, type DynamicMovingParticipant} from './dynamic-movement';
import {aimTurnRate} from './roles/aim-turn';
import {normalizeRoleMovementDirection, rotateRoleMovementDirection,
  type RoleMovementMathInput} from './roles/movement-math';
import {isRoleMovementAllowed, roleMovementCommand} from './roles/movement-permission';
import {roleMovementElapsed} from './roles/movement-time';
import {moveRoleThroughNavigation} from './roles/movement-wrapper';
import {createRoleObbFromPose, predictRoleMovementObb} from './roles/movement-obb-prediction';
import {isRoleControllerMovementAllowed, type RoleMovementCollider,
  type RoleStaticCollider} from './roles/movement-controller';
import {constrainTankPose, tankObstacles} from '../../../shared/movement/tank-collision';

interface AimingParticipant extends DynamicMovingParticipant {aim: number;}

/** Split-key aim uses original4340fd look rotation and body following. */
export function advanceBattleTurret(player: AimingParticipant, inputAim: number,
  field: Battlefield, others: Iterable<DynamicMovingParticipant>, seconds: number,
  staticObjects: Iterable<RoleStaticCollider> = []): void {
  const dt = roleMovementElapsed(seconds);
  if (inputAim === 0 || dt === 0) return;
  const tankType = player.tank.recomputeBase.tankType;
  if (tankType < 1 || tankType > 4) throw new RangeError('Original turret turn requires a recovered TankType');
  const parameters = originalMovementParameters(player);
  const turn = aimTurnRate(parameters?.turn, player.tank.turn) * Math.abs(inputAim);
  const pose = battleMovementPose(player);
  const turretYaw = player.yaw + player.aim;
  const input: RoleMovementMathInput = {...pose,
    look: {x: Math.fround(Math.sin(turretYaw)), y: 0, z: Math.fround(Math.cos(turretYaw))},
    command: roleMovementCommand(0, inputAim) as RoleMovementMathInput['command'],
    tankType: tankType as RoleMovementMathInput['tankType'],
    move: parameters?.speed ?? player.tank.speed, turn, dt};
  const result = moveRoleThroughNavigation(input, field.navigation, ORIGINAL_MOVEMENT_DIMENSIONS);
  if (!result.accepted) return;
  const forward = result.pose.forward;
  const bodyDelta = Math.atan2(forward.x * pose.forward.z - forward.z * pose.forward.x,
    forward.x * pose.forward.x + forward.z * pose.forward.z);
  const peers = [...others].filter(other => other.alive);
  if (bodyDelta !== 0) {
    if (!isRoleMovementAllowed(player.combat, input.command)) return;
    const currentObb = createRoleObbFromPose(pose);
    const owner: RoleMovementCollider = {id: player.id, status: player.combat.status,
      x: player.x, z: player.z, command: input.command, currentObb,
      predictObb: (command, elapsed) => predictRoleMovementObb({pose: input,
        command, tankType: input.tankType, move: input.move, turn,
        sourceObb: currentObb}, elapsed)};
    if (!isRoleControllerMovementAllowed(owner, input.command,
      peers.map(createBattleMovementCollider), staticObjects, true, () => {})) return;
  }
  // Body following rotates the movement reference; aim preserves the absolute
  // turret direction consumed by both rendering and projectile production.
  let look = pose.look;
  let yaw = player.yaw;
  if (tankType === 4) {
    look = {...forward};
    yaw = Math.atan2(look.x, look.z);
  } else if (bodyDelta !== 0) {
    look = rotateRoleMovementDirection(normalizeRoleMovementDirection({...look}), bodyDelta);
    look.x = Math.max(-1, Math.min(look.x, 1));
    look.z = Math.max(-1, Math.min(look.z, 1));
    yaw = Math.atan2(look.x, look.z);
  }
  const bodyYaw = tankType === 4 ? yaw
    : bodyDelta === 0 ? player.bodyYaw ?? player.yaw : Math.atan2(forward.x, forward.z);
  const aim = Math.atan2(result.pose.look.x, result.pose.look.z) - yaw;
  const candidate = {position: pose.position, look, forward};
  if (bodyDelta !== 0 && constrainTankPose(pose, candidate, tankObstacles(player.id, peers)) !== candidate) return;
  commitBattleMovement(player, {pose: candidate, yaw, bodyYaw});
  player.aim = tankType === 4 ? 0 : Math.atan2(Math.sin(aim), Math.cos(aim));
}
