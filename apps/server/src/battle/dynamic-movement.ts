import type {MsgPlayerInput} from '../../../shared/protocols';
import type {Battlefield} from '../battlefield';
import {battleMovementPose, originalMovementParameters, predictBattleMovement,
  type MovingParticipant, type BattleMovementState} from './movement';
import {isRoleMovementAllowed, roleMovementCommand} from './roles/movement-permission';
import {createRoleObbFromPose, predictRoleMovementObb} from './roles/movement-obb-prediction';
import {isRoleControllerMovementAllowed, type RoleMovementCollider, type RoleStaticCollider} from './roles/movement-controller';
import type {RoleMovementMathInput} from './roles/movement-math';
import {turnStationaryRolePose} from './roles/keyboard-turn';
import {constrainTankPose, overlapsTankPose, tankObstacles} from '../../../shared/movement/tank-collision';
import {findAvailableTankSpawn} from './spawn-position';

export interface DynamicMovingParticipant extends MovingParticipant {
  id: string;
  alive: boolean;
  movementCommand?: RoleMovementMathInput['command'];
}
interface ControlledMovementState extends BattleMovementState {
  command: RoleMovementMathInput['command'];
}

export function createBattleMovementCollider(player: DynamicMovingParticipant): RoleMovementCollider {
  const pose = battleMovementPose(player);
  const currentObb = createRoleObbFromPose(pose);
  const parameters = originalMovementParameters(player)
    ?? {speed: player.tank.speed * 6, turn: player.tank.turn * .12};
  return {id: player.id, status: player.combat.status, x: player.x, z: player.z,
    command: player.movementCommand ?? 0, currentObb,
    predictObb: (command, elapsed) => command === 3 || command === 4
      ? createRoleObbFromPose(turnStationaryRolePose(pose, command === 3 ? 1 : -1,
        parameters.turn, elapsed), currentObb.dimensions)
      : predictRoleMovementObb({pose, command,
      tankType: player.tank.recomputeBase.tankType as RoleMovementMathInput['tankType'],
      move: parameters.speed, turn: parameters.turn, sourceObb: currentObb}, elapsed)};
}

/** Original movement permission is followed by a sweep against every living tank. */
export function predictControlledBattleMovement(player: DynamicMovingParticipant,
  input: MsgPlayerInput, field: Battlefield, others: Iterable<DynamicMovingParticipant>,
  elapsed: number, staticObjects: Iterable<RoleStaticCollider> = []): ControlledMovementState | undefined {
  if (!originalMovementParameters(player)) return undefined;
  const command = roleMovementCommand(input.move, input.turn) as RoleMovementMathInput['command'];
  const permitted = isRoleMovementAllowed(player.combat, command);
  const peers = [...others].filter(other => other.alive);
  if (command !== 0 && permitted && !isRoleControllerMovementAllowed(createBattleMovementCollider(player), command,
      peers.map(createBattleMovementCollider), staticObjects, true, () => {})) {
    return {pose: battleMovementPose(player), yaw: player.yaw, bodyYaw: player.bodyYaw ?? player.yaw, command: 0};
  }
  const state = predictBattleMovement(player, input, field, elapsed)!;
  const start = battleMovementPose(player);
  const pose = constrainTankPose(start, state.pose, tankObstacles(player.id, peers));
  return {pose, yaw: Math.atan2(pose.look.x, pose.look.z), bodyYaw: Math.atan2(pose.forward.x, pose.forward.z),
    command: pose === start ? 0 : command === 0 ? 0 : permitted ? command : player.movementCommand ?? 0};
}

/** Pose installation checks all bodies again after each participant is placed. */
export function separateBattleParticipants(players: Iterable<DynamicMovingParticipant>,
  field: Battlefield, _clock: () => number, targetId?: string): void {
  const participants = [...players];
  for (const player of participants) {
    if (!player.alive || targetId !== undefined && player.id !== targetId) continue;
    if (!overlapsTankPose(battleMovementPose(player), tankObstacles(player.id, participants))) continue;
    const spawn = findAvailableTankSpawn(field, player.id, participants,
      {x: player.x, y: player.y, z: player.z, yaw: player.bodyYaw ?? player.yaw});
    if (spawn) Object.assign(player, {x: spawn.x, y: spawn.y, z: spawn.z});
  }
}
