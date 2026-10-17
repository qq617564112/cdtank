import type {ClientTankPose} from '../../../shared/protocols/MsgPlayerInput';
import type {BattleMotionInput} from './battle-input';
import {mobileTankDriveDirection, steerMobileTankToRef,
  type MobileTankSteeringResult} from './mobile-tank-steering';
import type {MsgRoomSnapshot, PlayerSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import {roleMovementCommand} from '../../../shared/movement/movement-permission';
import {roleMovementElapsed} from '../../../shared/movement/movement-time';
import {canMoveRoleThroughNavigation, moveRoleThroughNavigation} from '../../../shared/movement/movement-wrapper';
import {turnStationaryRolePose} from '../../../shared/movement/keyboard-turn';
import type {RoleMovementMathInput, RoleMovementPose} from '../../../shared/movement/movement-math';
import {constrainTankPose, TankObstacleWorkspace} from '../../../shared/movement/tank-collision';
import {ClientBattlefield} from './client-battlefield';
import {hasFixedTurret} from '../../../shared/combat/tank-turret';
import {advanceTankVertical, initialTankVerticalState, TankVerticalWorkspace,
  type TankVerticalState} from '../../../shared/movement/tank-vertical';

const DIMENSIONS = {width: 49, depth: 52};
const MOBILE_AIM_RAMP_SECONDS = .04;
const direction = (yaw: number) => ({x: Math.fround(Math.sin(yaw)), y: 0, z: Math.fround(Math.cos(yaw))});
const poseFromPlayer = (player: PlayerSnapshot): RoleMovementPose => ({
  position: {x: player.x, y: player.y, z: player.z},
  look: direction(player.yaw), forward: direction(player.bodyYaw ?? player.yaw),
});
const createSteeringResult = (): MobileTankSteeringResult => ({
  pose: {position: {x: 0, y: 0, z: 0}, look: {x: 0, y: 0, z: 0}, forward: {x: 0, y: 0, z: 0}},
  command: 0,
});

/** Manual motion persists across acknowledgements except occupied tank paths. */
export class LocalTankMotion {
  readonly field = new ClientBattlefield();
  private readonly tankObstacles = new TankObstacleWorkspace();
  private readonly mobileSteering = createSteeringResult();
  private readonly alternateMobileSteering = createSteeringResult();
  private readonly verticalWorkspace = new TankVerticalWorkspace();
  moving = false;
  private player?: PlayerSnapshot;
  private pose?: RoleMovementPose;
  private yaw = 0;
  private bodyYaw = 0;
  private aim = 0;
  private cameraYaw = 0;
  private mobileAim = 0;
  private mobileDrive?: {gesture: number; move: 1 | -1};
  private round = 0;
  private command: RoleMovementMathInput['command'] = 0;
  private playing = false;
  private active = false;
  private verticalState: TankVerticalState = {velocity: 0, airborne: false};

  constructor(private readonly mobile = false) {}

  get mobileCameraYaw(): number | undefined {
    return this.mobile && this.pose ? this.cameraYaw : undefined;
  }

  /** Shared server-clock gate; false during the round intro before the battle start. */
  setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.mobileDrive = undefined;
      this.mobileAim = 0;
    }
  }

  resetPrediction(): void {
    this.pose = undefined;
    this.moving = false;
    this.command = 0;
    this.active = false;
    this.mobileDrive = undefined;
    this.mobileAim = 0;
    this.verticalState = {velocity: 0, airborne: false};
  }

  synchronize(snapshot: MsgRoomSnapshot, playerId?: string): void {
    const player = snapshot.players.find(value => value.id === playerId);
    const round = snapshot.match?.round ?? 0;
    const previous = this.player;
    if (!player || player.isAutopilot) {
      this.pose = undefined;
      this.moving = false;
      this.mobileDrive = undefined;
      this.mobileAim = 0;
    } else if (!this.pose || round !== this.round || !player.alive
        || snapshot.phase !== 'PLAYING' || player.alive &&
        (!previous?.alive || previous.isAutopilot || previous.deaths !== player.deaths || previous.tankId !== player.tankId
          || snapshot.phase === 'PLAYING' && !this.playing
          || player.roleDisguise?.startedAt !== previous?.roleDisguise?.startedAt
          || constrainTankPose(poseFromPlayer(player), this.pose,
            this.tankObstacles.read(player.id, snapshot.players), this.field.navigation) !== this.pose)) {
      this.pose = poseFromPlayer(player);
      this.yaw = player.yaw;
      this.bodyYaw = player.bodyYaw ?? player.yaw;
      this.aim = player.aim;
      this.cameraYaw = hasFixedTurret(player.tankId) ? this.bodyYaw : this.yaw + this.aim;
      if (round !== this.round || !player.alive || snapshot.phase !== 'PLAYING'
          || !previous?.alive || previous.isAutopilot || previous.deaths !== player.deaths
          || previous.tankId !== player.tankId || player.roleDisguise?.startedAt !== previous.roleDisguise?.startedAt) {
        this.mobileDrive = undefined;
        this.mobileAim = 0;
      }
      this.command = 0;
      this.verticalState = initialTankVerticalState(player.y,
        this.field.navigation?.groundHeightAt(player.x, player.z));
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

  /** Synchronous presentation can reuse its pose; network messages own their copies. */
  renderedPoseToRef(result: ClientTankPose): ClientTankPose | undefined {
    if (!this.pose || !this.player || this.player.isAutopilot) return undefined;
    result.round = this.round;
    result.life = this.player.deaths;
    result.x = this.pose.position.x;
    result.y = this.pose.position.y;
    result.z = this.pose.position.z;
    result.yaw = this.yaw;
    result.bodyYaw = this.bodyYaw;
    result.aim = this.aim;
    result.command = this.command;
    return result;
  }

  get reportedPose(): ClientTankPose | undefined {
    return this.playing && this.active && this.player?.alive && this.field.navigation ? this.renderedPose : undefined;
  }

  advance(axes: BattleMotionInput, seconds: number, players: readonly PlayerSnapshot[]): void {
    this.moving = false;
    if (axes.movementGesture === undefined || this.mobileDrive?.gesture !== axes.movementGesture) {
      this.mobileDrive = undefined;
    }
    const player = this.player, initial = this.pose, movement = player?.movement;
    const grid = this.field.navigation, dt = roleMovementElapsed(seconds);
    if (!player?.alive || player.isAutopilot || !this.playing || !this.active || !initial || !movement || !grid || dt === 0) return;
    const tankType = movement.tankType as RoleMovementMathInput['tankType'];
    let steering: MobileTankSteeringResult | undefined;
    if (this.mobile && axes.direction) {
      const move = mobileTankDriveDirection(initial, axes.direction, this.cameraYaw, this.mobileDrive?.move);
      if (axes.movementGesture !== undefined) {
        if (this.mobileDrive) this.mobileDrive.move = move;
        else this.mobileDrive = {gesture: axes.movementGesture, move};
      }
      // An accepted candidate can become the current pose; write the other buffer.
      const result = initial === this.mobileSteering.pose ? this.alternateMobileSteering : this.mobileSteering;
      steering = steerMobileTankToRef(initial, axes.direction, this.cameraYaw, movement, dt, move, result);
    }
    const command = steering?.command ?? roleMovementCommand(axes.move, axes.turn);
    const permitted = command <= 2 ? movement.canMove : command <= 4 ? movement.canTurn
      : movement.canMove && movement.canTurn;
    this.command = 0;
    if (command !== 0 && permitted) {
      let candidate: RoleMovementPose;
      let acceptedCommand: RoleMovementMathInput['command'] = 0;
      if (steering) {
        candidate = steering.pose;
      } else if (command === 3 || command === 4) {
        candidate = turnStationaryRolePose(initial, axes.turn, movement.turn, dt);
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
      }
      // Arc commands rebuild position with y=0; keep the current vertical position.
      candidate.position.y = initial.position.y;
      if (steering || !movement.original || command <= 4) {
        if (canMoveRoleThroughNavigation(initial, candidate, grid, command, DIMENSIONS)) {
          acceptedCommand = command;
        } else if (command >= 5) {
          // Continuous steering keeps its heading when travel meets a model.
          const turn = steering ? {position: {...initial.position},
            look: {...candidate.look}, forward: {...candidate.forward}}
            : turnStationaryRolePose(initial, axes.turn, movement.turn, dt);
          const yaw = Math.atan2(turn.forward.x, turn.forward.z) - Math.atan2(initial.forward.x, initial.forward.z);
          const turnCommand = roleMovementCommand(0, Math.atan2(Math.sin(yaw), Math.cos(yaw)));
          if (canMoveRoleThroughNavigation(initial, turn, grid, turnCommand, DIMENSIONS)) {
            candidate = turn;
            acceptedCommand = turnCommand;
          } else candidate = initial;
        } else candidate = initial;
      }
      candidate = constrainTankPose(initial, candidate, this.tankObstacles.read(player.id, players), grid);
      if (candidate === initial) acceptedCommand = 0;
      const ground = grid.groundHeightAt(candidate.position.x, candidate.position.z);
      const vertical = advanceTankVertical(candidate.position, grid, this.verticalState, dt,
        ground === undefined ? 0 : Math.max(0, ground - initial.position.y), ground, this.verticalWorkspace);
      this.verticalState = vertical.state;
      if (!vertical.accepted) acceptedCommand = 0;
      this.pose = vertical.accepted ? candidate : initial;
      this.yaw = Math.atan2(this.pose.look.x, this.pose.look.z);
      this.bodyYaw = Math.atan2(this.pose.forward.x, this.pose.forward.z);
      this.command = acceptedCommand;
    }
    if (!(command !== 0 && permitted)) {
      const ground = grid.groundHeightAt(this.pose!.position.x, this.pose!.position.z);
      const vertical = advanceTankVertical(this.pose!.position, grid, this.verticalState, dt,
        ground === undefined ? 0 : Math.max(0, ground - this.pose!.position.y), ground, this.verticalWorkspace);
      this.verticalState = vertical.state;
    }
    this.advanceTurret(axes.aim, dt);
    this.moving = Math.hypot(this.pose!.position.x - initial.position.x, this.pose!.position.z - initial.position.z) > .0001;
  }

  private advanceTurret(aimInput: number, dt: number): void {
    if (this.mobile && !hasFixedTurret(this.player!.tankId)) {
      const target = Math.max(-1, Math.min(1, aimInput));
      if (target === 0 || target * this.mobileAim < 0) this.mobileAim = 0;
      const step = dt / MOBILE_AIM_RAMP_SECONDS;
      this.mobileAim += Math.max(-step, Math.min(step, target - this.mobileAim));
      const angle = this.cameraYaw + this.player!.movement!.turn * this.mobileAim * dt;
      this.cameraYaw = Math.atan2(Math.sin(angle), Math.cos(angle));
      const aim = this.cameraYaw - this.yaw;
      this.aim = Math.atan2(Math.sin(aim), Math.cos(aim));
      return;
    }
    if (this.mobile) {
      const angle = this.cameraYaw + this.player!.movement!.turn * aimInput * dt;
      this.cameraYaw = Math.atan2(Math.sin(angle), Math.cos(angle));
    }
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
    this.tankObstacles.clear();
    this.player = undefined;
    this.pose = undefined;
    this.moving = false;
    this.playing = false;
    this.active = false;
    this.mobileDrive = undefined;
    this.mobileAim = 0;
    this.command = 0;
    this.verticalState = {velocity: 0, airborne: false};
  }
}
