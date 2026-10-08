import type {Battlefield} from '../battlefield';
import type {RoleAttributeState} from './roles/attribute-state';
import type {RoleCombatState} from './roles/combat-state';
import type {TankConfig} from '../config';
import type {MsgPlayerInput} from '../../../shared/protocols';
import {roleMovementCommand, isBattleMovementAllowed} from './roles/movement-permission';
import type {RoleDisguiseState} from './items/role-disguise';
import {roleMovementElapsed} from './roles/movement-time';
import {moveRoleThroughNavigation} from './roles/movement-wrapper';
import type {RoleMovementPose, RoleMovementMathInput} from './roles/movement-math';
import {turnStationaryRolePose} from './roles/keyboard-turn';
import {sampleRoleNavigation} from './roles/movement-navigation';
import {adjustedMovementParameters} from './movement-parameters';
import {advanceTankVertical, initialTankVerticalState,
  type TankVerticalState} from '../../../shared/movement/tank-vertical';

/** Proven constructor footprint; later role resizing remains a recovery task. */
export const ORIGINAL_MOVEMENT_DIMENSIONS = {width: 49, depth: 52} as const;

export interface BattleMovementState {
  pose: RoleMovementPose;
  yaw: number;
  bodyYaw: number;
  verticalState: TankVerticalState;
}
/** Prediction carries the command the step actually committed, not the raw input. */
export interface BattleMovementResult extends BattleMovementState {
  command: RoleMovementMathInput['command'];
}
export interface MovingParticipant {
  x: number; y: number; z: number; yaw: number; bodyYaw?: number;
  movementState?: BattleMovementState;
  verticalState?: TankVerticalState;
  tank: TankConfig;
  attributes: RoleAttributeState;
  attributesReady: boolean;
  recoveredMovement?: {speed: number; turn: number};
  combat: RoleCombatState;
  roleDisguise?: RoleDisguiseState;
}

export function originalMovementParameters(player: MovingParticipant): {speed: number; turn: number} | undefined {
  const {move, turn} = player.attributes.record;
  const recovered = player.recoveredMovement;
  if (recovered && Number.isFinite(recovered.speed) && recovered.speed > 0
      && Number.isFinite(recovered.turn) && recovered.turn > 0) {
    return adjustedMovementParameters(recovered.speed, recovered.turn);
  }
  if (!player.attributesReady || !Number.isFinite(move) || !(move > 0)
      || !Number.isFinite(turn) || !(turn > 0)) return undefined;
  return adjustedMovementParameters(move, turn);
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
  const verticalState = {...(player.verticalState
    ?? initialTankVerticalState(player.y, field.navigation.sample(player.x, player.z)?.height))};
  const ground = field.navigation.sample(pose.position.x, pose.position.z)?.height;
  const rise = ground === undefined ? 0 : Math.max(0, ground - pose.position.y);
  if (!(dt > 0) || !isBattleMovementAllowed(player, command)) {
    const vertical = advanceTankVertical(pose.position, field.navigation, verticalState, dt, rise);
    return {pose, yaw: player.yaw, bodyYaw: player.bodyYaw ?? player.yaw,
      verticalState: vertical.state, command: 0};
  }
  // Rebuilt A/D mapping rotates both body and movement reference while stopped.
  // Check the candidate before committing; moving arcs keep the source kernel.
  if (command === 3 || command === 4) {
    const candidate = turnStationaryRolePose(pose, input.turn, parameters.turn, dt);
    const allowed = sampleRoleNavigation(field.navigation, candidate, command,
      ORIGINAL_MOVEMENT_DIMENSIONS.width, ORIGINAL_MOVEMENT_DIMENSIONS.depth).accepted;
    const accepted = allowed ? candidate : pose;
    const acceptedGround = field.navigation.sample(accepted.position.x, accepted.position.z)?.height;
    const vertical = advanceTankVertical(accepted.position, field.navigation, verticalState, dt,
      acceptedGround === undefined ? 0 : Math.max(0, acceptedGround - pose.position.y));
    const committed = vertical.accepted ? accepted : pose;
    return {pose: committed, yaw: Math.atan2(committed.look.x, committed.look.z),
      bodyYaw: Math.atan2(committed.forward.x, committed.forward.z), verticalState: vertical.state,
      command: committed === pose ? 0 : command};
  }
  const type = player.tank.recomputeBase.tankType;
  if (type < 1 || type > 4) throw new RangeError('Original movement requires a recovered TankType');
  // Keep role constructor dimensions; map occupancy comes from the render meshes.
  const result = moveRoleThroughNavigation({...pose, command, tankType: type as 1 | 2 | 3 | 4,
    move: parameters.speed, turn: parameters.turn, dt}, field.navigation, ORIGINAL_MOVEMENT_DIMENSIONS);
  // Arc commands rebuild position with y=0; keep the current vertical position
  // so a horizontal result never resets the body to the world origin plane.
  result.pose.position.y = pose.position.y;
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
      const vertical = advanceTankVertical(pose.position, field.navigation, verticalState, dt, rise);
      return {pose, yaw: player.yaw, bodyYaw: player.bodyYaw ?? player.yaw,
        verticalState: vertical.state, command: 0};
    }
  }
  const resultGround = field.navigation.sample(result.pose.position.x, result.pose.position.z)?.height;
  const vertical = advanceTankVertical(result.pose.position, field.navigation, verticalState, dt,
    resultGround === undefined ? 0 : Math.max(0, resultGround - pose.position.y));
  const committed = vertical.accepted ? result.pose : pose;
  return {pose: committed, yaw: Math.atan2(committed.look.x, committed.look.z),
    bodyYaw: Math.atan2(committed.forward.x, committed.forward.z), verticalState: vertical.state,
    command: result.accepted && committed === result.pose ? result.command : 0};
}

export function commitBattleMovement(player: MovingParticipant, state: BattleMovementState): void {
  Object.assign(player, state.pose.position);
  player.yaw = state.yaw;
  player.bodyYaw = state.bodyYaw;
  player.movementState = state;
  player.verticalState = state.verticalState;
}
