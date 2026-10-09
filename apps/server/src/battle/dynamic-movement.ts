import type {MsgPlayerInput} from '../../../shared/protocols';
import type {Battlefield} from '../battlefield';
import {battleMovementPose, originalMovementParameters, predictBattleMovement,
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
  peers?: RoleMovementCollider[];
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

/** Original movement permission is followed by a sweep against every living tank. */
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
  let allowed = true;
  if (command !== 0 && permitted) {
    const role = context.role ??= createBattleMovementCollider(player);
    const peers = context.peers ??= context.players.map(createBattleMovementCollider);
    const objects = function* (): Generator<RoleStaticCollider> {
      if (staticObjects) yield* staticObjects(role.predictObb(command, Math.fround(.3)));
    };
    allowed = isRoleControllerMovementAllowed(role, command, peers,
      staticObjects ? objects() : [], true, () => {});
  }
  if (!allowed) {
    const pose = battleMovementPose(player);
    const ground = field.navigation.sample(pose.position.x, pose.position.z)?.height;
    const verticalState = {...(player.verticalState
      ?? initialTankVerticalState(player.y, ground))};
    const vertical = advanceTankVertical(pose.position, field.navigation, verticalState, roleMovementElapsed(elapsed),
      ground === undefined ? 0 : Math.max(0, ground - pose.position.y));
    return {pose, yaw: player.yaw, bodyYaw: player.bodyYaw ?? player.yaw,
      verticalState: vertical.state, command: 0};
  }
  // Vertical state is advanced once per tick from the pre-step value, after the
  // horizontal candidate is clamped against other tanks. predictBattleMovement
  // also advances vertical for its NAV-only consumers; that result is discarded
  // here so the constrained X/Z receives the single authoritative vertical step.
  const verticalState = {...(player.verticalState
    ?? initialTankVerticalState(player.y, field.navigation.sample(player.x, player.z)?.height))};
  const state = predictBattleMovement(player, input, field, elapsed)!;
  const start = battleMovementPose(player);
  // Constrain the horizontal candidate; vertical motion is resolved afterwards
  // so a slope cannot shorten the horizontal sweep.
  const horizontal = {look: state.pose.look, forward: state.pose.forward,
    position: {x: state.pose.position.x, y: start.position.y, z: state.pose.position.z}};
  const pose = constrainTankPose(start, horizontal,
    context.obstacles ??= tankObstacles(player.id, context.players));
  const ground = field.navigation.sample(pose.position.x, pose.position.z)?.height;
  const vertical = advanceTankVertical(pose.position, field.navigation, verticalState,
    roleMovementElapsed(elapsed), ground === undefined ? 0 : Math.max(0, ground - start.position.y));
  const committed = vertical.accepted ? pose : start;
  return {pose: committed, yaw: Math.atan2(committed.look.x, committed.look.z),
    bodyYaw: Math.atan2(committed.forward.x, committed.forward.z),
    verticalState: vertical.state,
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
