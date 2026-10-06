import type {ClientTankPose, MsgPlayerInput} from '../../../shared/protocols/MsgPlayerInput';
import type {MsgRoomSnapshot, PlayerSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import {roleMovementCommand} from '../../../shared/movement/movement-permission';
import {roleMovementElapsed} from '../../../shared/movement/movement-time';
import {moveRoleThroughNavigation} from '../../../shared/movement/movement-wrapper';
import {sampleRoleNavigation} from '../../../shared/movement/movement-navigation';
import {turnStationaryRolePose} from '../../../shared/movement/keyboard-turn';
import {normalizeRoleMovementDirection, rotateRoleMovementDirection,
  type RoleMovementMathInput, type RoleMovementPose} from '../../../shared/movement/movement-math';
import {constrainTankPose, tankObstacles} from '../../../shared/movement/tank-collision';
import {ClientBattlefield} from './client-battlefield';

const DIMENSIONS = {width: 49, depth: 52};
type Axes = Pick<MsgPlayerInput, 'move' | 'turn' | 'aim'>;
const direction = (yaw: number) => ({x: Math.fround(Math.sin(yaw)), y: 0, z: Math.fround(Math.cos(yaw))});
const poseFromPlayer = (player: PlayerSnapshot): RoleMovementPose => ({
  position: {x: player.x, y: player.y, z: player.z},
  look: direction(player.yaw), forward: direction(player.bodyYaw ?? player.yaw),
});

/** Manual motion persists across acknowledgements except occupied tank paths. */
export class LocalTankMotion {
  readonly field = new ClientBattlefield();
  moving = false;
  private player?: PlayerSnapshot;
  private pose?: RoleMovementPose;
  private yaw = 0;
  private bodyYaw = 0;
  private aim = 0;
  private round = 0;
  private command: RoleMovementMathInput['command'] = 0;
  private playing = false;

  synchronize(snapshot: MsgRoomSnapshot, playerId?: string): void {
    const player = snapshot.players.find(value => value.id === playerId);
    const round = snapshot.match?.round ?? 0;
    const previous = this.player;
    if (!player || player.isAutopilot) {
      this.pose = undefined;
      this.moving = false;
    } else if (!this.pose || round !== this.round || player.alive &&
        (!previous?.alive || previous.isAutopilot || previous.deaths !== player.deaths || previous.tankId !== player.tankId
          || snapshot.phase === 'PLAYING' && !this.playing
          || constrainTankPose(poseFromPlayer(player), this.pose, tankObstacles(player.id, snapshot.players)) !== this.pose)) {
      this.pose = poseFromPlayer(player);
      this.yaw = player.yaw;
      this.bodyYaw = player.bodyYaw ?? player.yaw;
      this.aim = player.aim;
      this.command = 0;
    }
    this.player = player;
    this.round = round;
    this.playing = snapshot.phase === 'PLAYING';
  }

  get renderedPose(): ClientTankPose | undefined {
    if (!this.pose || !this.player || this.player.isAutopilot) return undefined;
    return {round: this.round, life: this.player.deaths, ...this.pose.position,
      yaw: this.yaw, bodyYaw: this.bodyYaw, aim: this.aim, command: this.command};
  }

  get reportedPose(): ClientTankPose | undefined {
    return this.playing && this.player?.alive && this.field.navigation ? this.renderedPose : undefined;
  }

  advance(axes: Axes, seconds: number, players: readonly PlayerSnapshot[]): void {
    this.moving = false;
    const player = this.player, initial = this.pose, movement = player?.movement;
    const grid = this.field.navigation, dt = roleMovementElapsed(seconds);
    if (!player?.alive || player.isAutopilot || !this.playing || !initial || !movement || !grid || dt === 0) return;
    const tankType = movement.tankType as RoleMovementMathInput['tankType'];
    const command = roleMovementCommand(axes.move, axes.turn) as RoleMovementMathInput['command'];
    const permitted = command <= 2 ? movement.canMove : command <= 4 ? movement.canTurn
      : movement.canMove && movement.canTurn;
    this.command = 0;
    if (command !== 0 && permitted) {
      let candidate: RoleMovementPose;
      if (command === 3 || command === 4) {
        candidate = turnStationaryRolePose(initial, axes.turn, movement.turn, dt);
        if (!sampleRoleNavigation(grid, candidate, command, DIMENSIONS.width, DIMENSIONS.depth).accepted) candidate = initial;
      } else if (movement.original) {
        candidate = moveRoleThroughNavigation({...initial, command, tankType,
          move: movement.speed, turn: movement.turn, dt}, grid, DIMENSIONS).pose;
      } else {
        candidate = turnStationaryRolePose(initial, axes.turn, movement.turn, dt);
        const distance = Math.sign(axes.move) * movement.speed * dt;
        candidate.position.x += candidate.look.x * distance;
        candidate.position.z += candidate.look.z * distance;
        if (!sampleRoleNavigation(grid, candidate, command, DIMENSIONS.width, DIMENSIONS.depth).accepted) candidate = initial;
      }
      const steps = Math.ceil(Math.hypot(candidate.position.x - initial.position.x, candidate.position.z - initial.position.z) / 6);
      const startYaw = Math.atan2(initial.forward.x, initial.forward.z);
      const endYaw = Math.atan2(candidate.forward.x, candidate.forward.z);
      const delta = Math.atan2(Math.sin(endYaw - startYaw), Math.cos(endYaw - startYaw));
      for (let step = 1; step < steps; step++) {
        const fraction = step / steps;
        const sample = {position: {x: initial.position.x + (candidate.position.x - initial.position.x) * fraction,
          y: initial.position.y, z: initial.position.z + (candidate.position.z - initial.position.z) * fraction},
          forward: direction(startYaw + delta * fraction)};
        if (!sampleRoleNavigation(grid, sample, command, DIMENSIONS.width, DIMENSIONS.depth).accepted) {
          candidate = initial;
          break;
        }
      }
      candidate.position.y = grid.sample(candidate.position.x, candidate.position.z)?.height ?? initial.position.y;
      candidate = constrainTankPose(initial, candidate, tankObstacles(player.id, players));
      this.pose = candidate;
      this.yaw = Math.atan2(candidate.look.x, candidate.look.z);
      this.bodyYaw = Math.atan2(candidate.forward.x, candidate.forward.z);
      this.command = candidate === initial ? 0 : command;
    }
    this.advanceTurret(axes.aim, dt, players);
    this.moving = Math.hypot(this.pose!.position.x - initial.position.x, this.pose!.position.z - initial.position.z) > .0001;
  }

  private advanceTurret(aimInput: number, dt: number, players: readonly PlayerSnapshot[]): void {
    if (aimInput === 0) return;
    const pose = this.pose!, movement = this.player!.movement!;
    const turretYaw = this.yaw + this.aim;
    const input: RoleMovementMathInput = {...pose, look: direction(turretYaw),
      command: roleMovementCommand(0, aimInput) as RoleMovementMathInput['command'],
      tankType: movement.tankType as RoleMovementMathInput['tankType'], move: movement.speed,
      turn: movement.turn * Math.abs(aimInput), dt};
    const result = moveRoleThroughNavigation(input, this.field.navigation, DIMENSIONS);
    if (!result.accepted) return;
    const forward = result.pose.forward;
    const bodyDelta = Math.atan2(forward.x * pose.forward.z - forward.z * pose.forward.x,
      forward.x * pose.forward.x + forward.z * pose.forward.z);
    if (bodyDelta !== 0 && !movement.canTurn) return;
    let look = pose.look;
    if (input.tankType === 4) look = {...forward};
    else if (bodyDelta !== 0) {
      look = rotateRoleMovementDirection(normalizeRoleMovementDirection({...look}), bodyDelta);
      look.x = Math.max(-1, Math.min(look.x, 1));
      look.z = Math.max(-1, Math.min(look.z, 1));
    }
    const candidate = {position: pose.position, look, forward};
    if (bodyDelta !== 0 && constrainTankPose(pose, candidate, tankObstacles(this.player!.id, players)) !== candidate) return;
    this.pose = candidate;
    this.yaw = Math.atan2(look.x, look.z);
    this.bodyYaw = Math.atan2(forward.x, forward.z);
    const aim = Math.atan2(result.pose.look.x, result.pose.look.z) - this.yaw;
    this.aim = input.tankType === 4 ? 0 : Math.atan2(Math.sin(aim), Math.cos(aim));
  }

  clear(): void {
    this.field.clear();
    this.player = undefined;
    this.pose = undefined;
    this.moving = false;
    this.playing = false;
    this.command = 0;
  }
}
