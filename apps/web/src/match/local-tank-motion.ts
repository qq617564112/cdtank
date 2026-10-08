import type {ClientTankPose, MsgPlayerInput} from '../../../shared/protocols/MsgPlayerInput';
import type {MsgRoomSnapshot, PlayerSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import {roleMovementCommand} from '../../../shared/movement/movement-permission';
import {roleMovementElapsed} from '../../../shared/movement/movement-time';
import {moveRoleThroughNavigation} from '../../../shared/movement/movement-wrapper';
import {sampleRoleNavigation} from '../../../shared/movement/movement-navigation';
import {turnStationaryRolePose} from '../../../shared/movement/keyboard-turn';
import type {RoleMovementMathInput, RoleMovementPose} from '../../../shared/movement/movement-math';
import {constrainTankPose, tankObstacles} from '../../../shared/movement/tank-collision';
import {ClientBattlefield} from './client-battlefield';
import {hasFixedTurret} from '../../../shared/combat/tank-turret';
import {advanceTankVertical, initialTankVerticalState,
  type TankVerticalState} from '../../../shared/movement/tank-vertical';

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
  private active = false;
  private verticalState: TankVerticalState = {velocity: 0, airborne: false};

  /** Shared server-clock gate; false during the round intro before the battle start. */
  setActive(active: boolean): void {
    this.active = active;
  }

  resetPrediction(): void {
    this.pose = undefined;
    this.moving = false;
    this.command = 0;
    this.active = false;
    this.verticalState = {velocity: 0, airborne: false};
  }

  synchronize(snapshot: MsgRoomSnapshot, playerId?: string): void {
    const player = snapshot.players.find(value => value.id === playerId);
    const round = snapshot.match?.round ?? 0;
    const previous = this.player;
    if (!player || player.isAutopilot) {
      this.pose = undefined;
      this.moving = false;
    } else if (!this.pose || round !== this.round || !player.alive
        || snapshot.phase !== 'PLAYING' || player.alive &&
        (!previous?.alive || previous.isAutopilot || previous.deaths !== player.deaths || previous.tankId !== player.tankId
          || snapshot.phase === 'PLAYING' && !this.playing
          || player.roleDisguise?.startedAt !== previous?.roleDisguise?.startedAt
          || constrainTankPose(poseFromPlayer(player), this.pose, tankObstacles(player.id, snapshot.players)) !== this.pose)) {
      this.pose = poseFromPlayer(player);
      this.yaw = player.yaw;
      this.bodyYaw = player.bodyYaw ?? player.yaw;
      this.aim = player.aim;
      this.command = 0;
      this.verticalState = initialTankVerticalState(player.y,
        this.field.navigation?.sample(player.x, player.z)?.height);
    }
    this.player = player;
    if (player && hasFixedTurret(player.tankId)) {
      const aim = this.bodyYaw - this.yaw;
      this.aim = Math.atan2(Math.sin(aim), Math.cos(aim));
    }
    this.round = round;
    this.playing = snapshot.phase === 'PLAYING';
  }

  get renderedPose(): ClientTankPose | undefined {
    if (!this.pose || !this.player || this.player.isAutopilot) return undefined;
    return {round: this.round, life: this.player.deaths, ...this.pose.position,
      yaw: this.yaw, bodyYaw: this.bodyYaw, aim: this.aim, command: this.command};
  }

  get reportedPose(): ClientTankPose | undefined {
    return this.playing && this.active && this.player?.alive && this.field.navigation ? this.renderedPose : undefined;
  }

  advance(axes: Axes, seconds: number, players: readonly PlayerSnapshot[]): void {
    this.moving = false;
    const player = this.player, initial = this.pose, movement = player?.movement;
    const grid = this.field.navigation, dt = roleMovementElapsed(seconds);
    if (!player?.alive || player.isAutopilot || !this.playing || !this.active || !initial || !movement || !grid || dt === 0) return;
    const tankType = movement.tankType as RoleMovementMathInput['tankType'];
    const command = roleMovementCommand(axes.move, axes.turn) as RoleMovementMathInput['command'];
    const permitted = command <= 2 ? movement.canMove : command <= 4 ? movement.canTurn
      : movement.canMove && movement.canTurn;
    this.command = 0;
    if (command !== 0 && permitted) {
      let candidate: RoleMovementPose;
      let acceptedCommand: RoleMovementMathInput['command'] = 0;
      if (command === 3 || command === 4) {
        candidate = turnStationaryRolePose(initial, axes.turn, movement.turn, dt);
        if (sampleRoleNavigation(grid, candidate, command, DIMENSIONS.width, DIMENSIONS.depth).accepted) acceptedCommand = command;
        else candidate = initial;
      } else if (movement.original) {
        const result = moveRoleThroughNavigation({...initial, command, tankType,
          move: movement.speed, turn: movement.turn, dt}, grid, DIMENSIONS);
        candidate = result.pose;
        acceptedCommand = result.accepted ? result.command : 0;
      } else {
        candidate = turnStationaryRolePose(initial, axes.turn, movement.turn, dt);
        const distance = Math.sign(axes.move) * movement.speed * dt;
        candidate.position.x += candidate.look.x * distance;
        candidate.position.z += candidate.look.z * distance;
        if (sampleRoleNavigation(grid, candidate, command, DIMENSIONS.width, DIMENSIONS.depth).accepted) acceptedCommand = command;
        else candidate = initial;
      }
      // Arc commands rebuild position with y=0; keep the current vertical position.
      candidate.position.y = initial.position.y;
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
          acceptedCommand = 0;
          break;
        }
      }
      candidate = constrainTankPose(initial, candidate, tankObstacles(player.id, players));
      if (candidate === initial) acceptedCommand = 0;
      const ground = grid.sample(candidate.position.x, candidate.position.z)?.height;
      const vertical = advanceTankVertical(candidate.position, grid, this.verticalState, dt,
        ground === undefined ? 0 : Math.max(0, ground - initial.position.y));
      this.verticalState = vertical.state;
      if (!vertical.accepted) acceptedCommand = 0;
      this.pose = vertical.accepted ? candidate : initial;
      this.yaw = Math.atan2(this.pose.look.x, this.pose.look.z);
      this.bodyYaw = Math.atan2(this.pose.forward.x, this.pose.forward.z);
      this.command = acceptedCommand;
    }
    if (!(command !== 0 && permitted)) {
      const ground = grid.sample(this.pose!.position.x, this.pose!.position.z)?.height;
      const vertical = advanceTankVertical(this.pose!.position, grid, this.verticalState, dt,
        ground === undefined ? 0 : Math.max(0, ground - this.pose!.position.y));
      this.verticalState = vertical.state;
    }
    this.advanceTurret(axes.aim, dt);
    this.moving = Math.hypot(this.pose!.position.x - initial.position.x, this.pose!.position.z - initial.position.z) > .0001;
  }

  private advanceTurret(aimInput: number, dt: number): void {
    if (hasFixedTurret(this.player!.tankId)) {
      const aim = this.bodyYaw - this.yaw;
      this.aim = Math.atan2(Math.sin(aim), Math.cos(aim));
      return;
    }
    if (aimInput === 0) return;
    const angle = Math.fround(Math.fround(this.player!.movement!.turn * aimInput) * dt);
    const aim = this.aim + angle;
    this.aim = Math.atan2(Math.sin(aim), Math.cos(aim));
  }

  clear(): void {
    this.field.clear();
    this.player = undefined;
    this.pose = undefined;
    this.moving = false;
    this.playing = false;
    this.active = false;
    this.command = 0;
    this.verticalState = {velocity: 0, airborne: false};
  }
}
