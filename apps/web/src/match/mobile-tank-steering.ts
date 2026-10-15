import type {BattleJoystickDirection} from './battle-input';
import type {RoleMovementMathInput, RoleMovementPose} from '../../../shared/movement/movement-math';
import {roleMovementCommand} from '../../../shared/movement/movement-permission';

export const MOBILE_TURN_IN_PLACE_ANGLE = 120 * Math.PI / 180;
const DRIVE_SWITCH_ANGLE = 130 * Math.PI / 180;

export interface MobileTankSteeringResult {
  pose: RoleMovementPose;
  command: RoleMovementMathInput['command'];
}

/** Choose the nearest end initially; switch above 130 degrees while dragging. */
export function mobileTankDriveDirection(initial: RoleMovementPose, stick: BattleJoystickDirection,
  cameraYaw: number, current?: 1 | -1): 1 | -1 {
  const bodyYaw = Math.atan2(initial.forward.x, initial.forward.z);
  const heading = cameraYaw - Math.atan2(stick.x, -stick.y);
  const bodyAngle = Math.abs(Math.atan2(Math.sin(heading - bodyYaw), Math.cos(heading - bodyYaw)));
  if (current === undefined) return bodyAngle > Math.PI / 2 ? -1 : 1;
  const travelAngle = current > 0 ? bodyAngle : Math.PI - bodyAngle;
  return travelAngle > DRIVE_SWITCH_ANGLE ? (current === 1 ? -1 : 1) : current;
}

/** The chosen end follows the continuous stick bearing throughout the drag. */
export function steerMobileTank(initial: RoleMovementPose, stick: BattleJoystickDirection,
  cameraYaw: number, movement: {speed: number; turn: number; canMove: boolean; canTurn: boolean},
  seconds: number, move: 1 | -1): MobileTankSteeringResult {
  const result: MobileTankSteeringResult = {pose: {position: {x: 0, y: 0, z: 0},
    look: {x: 0, y: 0, z: 0}, forward: {x: 0, y: 0, z: 0}}, command: 0};
  return steerMobileTankToRef(initial, stick, cameraYaw, movement, seconds, move, result);
}

/** Result vectors belong to the caller and must be separate from the initial pose. */
export function steerMobileTankToRef(initial: RoleMovementPose, stick: BattleJoystickDirection,
  cameraYaw: number, movement: {speed: number; turn: number; canMove: boolean; canTurn: boolean},
  seconds: number, move: 1 | -1, result: MobileTankSteeringResult): MobileTankSteeringResult {
  const bodyYaw = Math.atan2(initial.forward.x, initial.forward.z);
  const reach = Math.hypot(stick.x, stick.y);
  // Source +X is reflected in the Web world, so screen-right decreases native yaw.
  const heading = cameraYaw - Math.atan2(stick.x, -stick.y);
  const target = heading + (move < 0 ? Math.PI : 0);
  const error = Math.atan2(Math.sin(target - bodyYaw), Math.cos(target - bodyYaw));
  const maximumTurn = movement.canTurn ? movement.turn * seconds : 0;
  const turn = Math.max(-maximumTurn, Math.min(maximumTurn, error));
  const x = Math.fround(Math.sin(bodyYaw + turn)), z = Math.fround(Math.cos(bodyYaw + turn));
  const canTravel = Math.abs(error) <= MOBILE_TURN_IN_PLACE_ANGLE;
  const travel = movement.canMove && canTravel
    ? move * movement.speed * Math.min(1, reach) * seconds : 0;
  const pose = result.pose;
  pose.position.x = initial.position.x + x * travel;
  pose.position.y = initial.position.y;
  pose.position.z = initial.position.z + z * travel;
  pose.look.x = pose.forward.x = x;
  pose.look.y = pose.forward.y = 0;
  pose.look.z = pose.forward.z = z;
  result.command = roleMovementCommand(Math.sign(travel), turn);
  return result;
}
