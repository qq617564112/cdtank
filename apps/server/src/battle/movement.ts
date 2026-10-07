import type {Battlefield} from '../battlefield';
import type {RoleAttributeState} from './roles/attribute-state';
import type {RoleCombatState} from './roles/combat-state';
import type {TankConfig} from '../config';
import type {MsgPlayerInput} from '../../../shared/protocols';
import {roleMovementCommand, isRoleMovementAllowed} from './roles/movement-permission';
import {roleMovementElapsed} from './roles/movement-time';
import {moveRoleThroughNavigation} from './roles/movement-wrapper';
import type {RoleMovementPose, RoleMovementMathInput} from './roles/movement-math';
import {turnStationaryRolePose} from './roles/keyboard-turn';
import {sampleRoleNavigation} from './roles/movement-navigation';

/** Proven constructor footprint; later role resizing remains a recovery task. */
export const ORIGINAL_MOVEMENT_DIMENSIONS = {width: 49, depth: 52} as const;

export interface BattleMovementState {pose: RoleMovementPose; yaw: number; bodyYaw: number;}
/** Prediction carries the command the step actually committed, not the raw input. */
export interface BattleMovementResult extends BattleMovementState {
  command: RoleMovementMathInput['command'];
}
export interface MovingParticipant {
  x: number; y: number; z: number; yaw: number; bodyYaw?: number;
  movementState?: BattleMovementState;
  tank: TankConfig;
  attributes: RoleAttributeState;
  attributesReady: boolean;
  recoveredMovement?: {speed: number; turn: number};
  combat: RoleCombatState;
}

export function originalMovementParameters(player: MovingParticipant): {speed: number; turn: number} | undefined {
  const {move, turn} = player.attributes.record;
  const recovered = player.recoveredMovement;
  if (recovered && Number.isFinite(recovered.speed) && recovered.speed > 0
      && Number.isFinite(recovered.turn) && recovered.turn > 0) return recovered;
  if (!player.attributesReady || !Number.isFinite(move) || !(move > 0)
      || !Number.isFinite(turn) || !(turn > 0)) return undefined;
  return {speed: move, turn};
}

export function battleMovementPose(player: MovingParticipant): RoleMovementPose {
  const direction = (yaw: number) => ({x: Math.fround(Math.sin(yaw)), y: 0, z: Math.fround(Math.cos(yaw))});
  const previous = player.movementState;
  // Source vectors persist between ticks. Spawn/revive and explicit fixture pose
  // edits invalidate the cached vectors rather than retaining another life’s pose.
  const unchanged = previous && previous.yaw === player.yaw && previous.bodyYaw === (player.bodyYaw ?? player.yaw);
  const look = unchanged ? previous.pose.look : direction(player.yaw);
  const forward = unchanged ? previous.pose.forward : direction(player.bodyYaw ?? player.yaw);
  return {position: {x: player.x, y: player.y, z: player.z}, look, forward};
}

/** Pure prediction reused by ordinary CPU input generation and authoritative stepping. */
export function predictBattleMovement(player: MovingParticipant, input: MsgPlayerInput,
  field: Battlefield, elapsed: number): BattleMovementResult | undefined {
  const parameters = originalMovementParameters(player);
  if (!parameters) return undefined;
  const dt = roleMovementElapsed(elapsed);
  const command = roleMovementCommand(input.move, input.turn) as RoleMovementMathInput['command'];
  const pose = battleMovementPose(player);
  if (!(dt > 0) || !isRoleMovementAllowed(player.combat, command)) {
    return {pose, yaw: player.yaw, bodyYaw: player.bodyYaw ?? player.yaw, command: 0};
  }
  // Rebuilt A/D mapping rotates both body and movement reference while stopped.
  // Check the candidate before committing; moving arcs keep the source kernel.
  if (command === 3 || command === 4) {
    const candidate = turnStationaryRolePose(pose, input.turn, parameters.turn, dt);
    const allowed = sampleRoleNavigation(field.navigation, candidate, command,
      ORIGINAL_MOVEMENT_DIMENSIONS.width, ORIGINAL_MOVEMENT_DIMENSIONS.depth).accepted;
    const accepted = allowed ? candidate : pose;
    accepted.position.y = field.navigation.sample(accepted.position.x, accepted.position.z)?.height ?? player.y;
    return {pose: accepted, yaw: Math.atan2(accepted.look.x, accepted.look.z),
      bodyYaw: Math.atan2(accepted.forward.x, accepted.forward.z), command: allowed ? command : 0};
  }
  const type = player.tank.recomputeBase.tankType;
  if (type < 1 || type > 4) throw new RangeError('Original movement requires a recovered TankType');
  // Keep role constructor dimensions; map occupancy comes from the render meshes.
  const result = moveRoleThroughNavigation({...pose, command, tankType: type as 1 | 2 | 3 | 4,
    move: parameters.speed, turn: parameters.turn, dt}, field.navigation, ORIGINAL_MOVEMENT_DIMENSIONS);
  // Sample intermediate footprints so a fast tick cannot jump a thin mesh wall.
  const steps = Math.ceil(Math.hypot(result.pose.position.x - pose.position.x,
    result.pose.position.z - pose.position.z) / 6);
  const firstYaw = Math.atan2(pose.forward.x, pose.forward.z);
  const lastYaw = Math.atan2(result.pose.forward.x, result.pose.forward.z);
  const turn = Math.atan2(Math.sin(lastYaw - firstYaw), Math.cos(lastYaw - firstYaw));
  for (let step = 1; step < steps; step++) {
    const fraction = step / steps, heading = firstYaw + turn * fraction;
    const position = {x: pose.position.x + (result.pose.position.x - pose.position.x) * fraction,
      y: pose.position.y, z: pose.position.z + (result.pose.position.z - pose.position.z) * fraction};
    const forward = {x: Math.fround(Math.sin(heading)), y: 0, z: Math.fround(Math.cos(heading))};
    if (!sampleRoleNavigation(field.navigation, {position, forward}, command,
        ORIGINAL_MOVEMENT_DIMENSIONS.width, ORIGINAL_MOVEMENT_DIMENSIONS.depth).accepted) {
      return {pose, yaw: player.yaw, bodyYaw: player.bodyYaw ?? player.yaw, command: 0};
    }
  }
  // Existing rebuilt grounding remains explicit until original vertical/slope
  // post-processing is recovered. Horizontal NAV collision is the original rule.
  result.pose.position.y = field.navigation.sample(result.pose.position.x, result.pose.position.z)?.height ?? player.y;
  return {pose: result.pose, yaw: Math.atan2(result.pose.look.x, result.pose.look.z),
    bodyYaw: Math.atan2(result.pose.forward.x, result.pose.forward.z),
    command: result.accepted ? result.command : 0};
}

export function commitBattleMovement(player: MovingParticipant, state: BattleMovementState): void {
  Object.assign(player, state.pose.position);
  player.yaw = state.yaw;
  player.bodyYaw = state.bodyYaw;
  player.movementState = state;
}
