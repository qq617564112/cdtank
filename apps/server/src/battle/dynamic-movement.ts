import type {MsgPlayerInput} from '../../../shared/protocols';
import type {Battlefield} from '../battlefield';
import {battleMovementPose, commitBattleMovement, originalMovementParameters, predictBattleMovement,
  type MovingParticipant, type BattleMovementResult} from './movement';
import {isBattleMovementAllowed, roleMovementCommand} from './roles/movement-permission';
import {createRoleObbFromPose, predictRoleMovementObb} from './roles/movement-obb-prediction';
import {isRoleControllerMovementAllowed, type RoleMovementCollider, type RoleStaticCollider} from './roles/movement-controller';
import type {RoleMovementMathInput} from './roles/movement-math';
import {turnStationaryRolePose} from './roles/keyboard-turn';
import {constrainTankPose, overlapsTankPose, tankObstacles} from '../../../shared/movement/tank-collision';
import {findAvailableTankSpawn} from './spawn-position';
import {defaultMovementParameters} from './movement-parameters';
import {advanceTankVertical, initialTankVerticalState} from '../../../shared/movement/tank-vertical';
import {roleMovementElapsed} from './roles/movement-time';
import type {RoleObb} from './roles/obb-intersection';

export interface DynamicMovingParticipant extends MovingParticipant {
  id: string;
  alive: boolean;
  movementCommand?: RoleMovementMathInput['command'];
}

export function createBattleMovementCollider(player: DynamicMovingParticipant): RoleMovementCollider {
  const pose = battleMovementPose(player);
  const currentObb = createRoleObbFromPose(pose);
  const parameters = originalMovementParameters(player)
    ?? defaultMovementParameters(player.tank);
  const tankType = player.tank.recomputeBase.tankType as RoleMovementMathInput['tankType'];
  let predicted: RoleObb | undefined;
  let predictedCommand: RoleMovementMathInput['command'] | undefined;
  let predictedElapsed: number | undefined;
  return {id: player.id, status: player.combat.status, x: player.x, z: player.z,
    command: player.movementCommand ?? 0, currentObb,
    predictObb: (command, elapsed) => {
      if (predicted && command === predictedCommand && elapsed === predictedElapsed) return predicted;
      predictedCommand = command;
      predictedElapsed = elapsed;
      predicted = command === 3 || command === 4
        ? createRoleObbFromPose(turnStationaryRolePose(pose, command === 3 ? 1 : -1,
          parameters.turn, elapsed), currentObb.dimensions)
        : predictRoleMovementObb({pose, command, tankType,
          move: parameters.speed, turn: parameters.turn, sourceObb: currentObb}, elapsed);
      return predicted;
    }};
}

interface MovementCollisionContext {
  readonly players: readonly DynamicMovingParticipant[];
  role?: RoleMovementCollider;
  obstacles?: RoleObb[];
}

interface MovementPreview {x: number; y: number; z: number; yaw: number; bodyYaw: number;}

/** Original-source roles reuse pure previews within one synchronous CPU decision. */
export function createBattleMovementPredictor(player: DynamicMovingParticipant, field: Battlefield,
  others: Iterable<DynamicMovingParticipant>, elapsed: number): (input: MsgPlayerInput) => MovementPreview {
  const previews = new Map<number, Map<number, MovementPreview>>();
  let context: MovementCollisionContext | undefined;
  return input => {
    let turns = previews.get(input.move);
    const cached = turns?.get(input.turn);
    if (cached) return cached;
    context ??= {players: [...others].filter(other => other.alive)};
    const state = predictControlledMovement(player, input, field, elapsed, context);
    const preview = {...state.pose.position, yaw: state.yaw, bodyYaw: state.bodyYaw};
    if (!turns) {turns = new Map(); previews.set(input.move, turns);}
    turns.set(input.turn, preview);
    return preview;
  };
}

/** CPU look-ahead holds one command for several steps against the current bodies. */
export function createBattleMovementRollout(player: DynamicMovingParticipant, field: Battlefield,
  others: Iterable<DynamicMovingParticipant>): (input: MsgPlayerInput, steps: number, elapsed: number) => MovementPreview[] {
  let context: MovementCollisionContext | undefined;
  return (input, steps, elapsed) => {
    context ??= {players: [...others].filter(other => other.alive)};
    const ghost: DynamicMovingParticipant = {...player};
    const poses: MovementPreview[] = [];
    for (let step = 0; step < steps; step++) {
      const state = predictControlledMovement(ghost, input, field, elapsed, context);
      const preview = {...state.pose.position, yaw: state.yaw, bodyYaw: state.bodyYaw};
      poses.push(preview);
      // A refused step leaves the pose unchanged; later steps would repeat it.
      if (state.command === 0) {
        while (poses.length < steps) poses.push(preview);
        break;
      }
      commitBattleMovement(ghost, state);
    }
    return poses;
  };
}

/** Actual body sweeps resolve tank contacts; static contact notifications remain. */
export function predictControlledBattleMovement(player: DynamicMovingParticipant,
  input: MsgPlayerInput, field: Battlefield, others: Iterable<DynamicMovingParticipant>,
  elapsed: number, staticObjects?: (proposed: RoleObb) => Iterable<RoleStaticCollider>): BattleMovementResult | undefined {
  if (!originalMovementParameters(player)) return undefined;
  return predictControlledMovement(player, input, field, elapsed,
    {players: [...others].filter(other => other.alive)}, staticObjects);
}

function predictControlledMovement(player: DynamicMovingParticipant, input: MsgPlayerInput,
  field: Battlefield, elapsed: number, context: MovementCollisionContext,
  staticObjects?: (proposed: RoleObb) => Iterable<RoleStaticCollider>): BattleMovementResult {
  const command = roleMovementCommand(input.move, input.turn) as RoleMovementMathInput['command'];
  const permitted = isBattleMovementAllowed(player, command);
  if (command !== 0 && permitted && staticObjects) {
    const role = context.role ??= createBattleMovementCollider(player);
    // Static contact notifications are independent of tank body separation.
    isRoleControllerMovementAllowed(role, command, [],
      staticObjects(role.predictObb(command, Math.fround(.3))), true, () => {});
  }
  const state = predictBattleMovement(player, input, field, elapsed)!;
  const start = battleMovementPose(player);
  // Constrain the horizontal candidate; vertical motion is resolved afterwards
  // so a slope cannot shorten the horizontal sweep.
  const horizontal = {look: state.pose.look, forward: state.pose.forward,
    position: {x: state.pose.position.x, y: start.position.y, z: state.pose.position.z}};
  const pose = constrainTankPose(start, horizontal,
    context.obstacles ??= tankObstacles(player.id, context.players), field.navigation);
  let committed = pose;
  let verticalState = state.verticalState;
  // A refused NAV candidate still needs a vertical step at the actual X/Z.
  if (state.verticalAccepted && pose.position.x === state.pose.position.x
      && pose.position.z === state.pose.position.z) {
    pose.position.y = state.pose.position.y;
  } else {
    const initialVertical = {...(player.verticalState
      ?? initialTankVerticalState(player.y, field.navigation.groundHeightAt(player.x, player.z)))};
    const ground = field.navigation.groundHeightAt(pose.position.x, pose.position.z);
    const vertical = advanceTankVertical(pose.position, field.navigation, initialVertical,
      roleMovementElapsed(elapsed), ground === undefined ? 0 : Math.max(0, ground - start.position.y), ground);
    committed = vertical.accepted ? pose : start;
    verticalState = vertical.state;
  }
  return {pose: committed, yaw: Math.atan2(committed.look.x, committed.look.z),
    bodyYaw: Math.atan2(committed.forward.x, committed.forward.z),
    verticalState,
    command: committed === start ? 0 : state.command};
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
