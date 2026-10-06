import type {MsgPlayerInput, MsgRoomEvent, ObjectiveSnapshot, SceneObjectSnapshot} from '../../../shared/protocols';
import {originalMovementParameters, commitBattleMovement, battleMovementPose, type BattleMovementState} from './movement';
import {predictControlledBattleMovement} from './dynamic-movement';
import type {RoleMovementMathInput} from './roles/movement-math';
import {createOriginalBotNavigation} from './cpu/original-navigation';
import type {RoleAttributeState} from './roles/attribute-state';
import type {RoleCombatState} from './roles/combat-state';
import {applyRoleFireReloadNotification, isRoleFireReady} from './roles/reload';
import {isRoleMovementAllowed, roleMovementCommand} from './roles/movement-permission';
import {roleMovementElapsed} from './roles/movement-time';
import {advanceBattleTurret} from './turret-movement';
import {advanceDefaultAmmoMagazine, consumeDefaultAmmoMagazine, isDefaultAmmo} from './roles/ammo-magazine';
import type {BotActor, BotController} from './cpu/controller';
import type {TankConfig} from '../config';
import type {Battlefield} from '../battlefield';
import {fireProjectile, type BulletState} from './projectiles';
import type {AttackBoostState} from './items/attack-drink';
import type {RoleStaticCollider} from './roles/movement-controller';
import type {recomputeQualifiedRoleArmor} from './roles/recompute-armor';
import {createRoleObbFromPose} from './roles/movement-obb-prediction';
import {intersectsOriginalObb} from './roles/obb-intersection';
import {constrainTankPose, tankObstacles} from '../../../shared/movement/tank-collision';

// Original42b000/42b020 schedules4288fe independently of the03 action clock.
const SHOT_QUERY_DELAY_SECONDS = Math.fround(0.4);

interface CombatActor extends BotActor {
  name: string;
  tank: TankConfig;
  combat: RoleCombatState;
  input: MsgPlayerInput;
  respawnAt: number;
  attributesReady: boolean;
  magazineReady?: boolean;
  attributes: RoleAttributeState;
  attackBoost?: AttackBoostState;
  armorReady?: boolean;
  recoveredArmor?: ReturnType<typeof recomputeQualifiedRoleArmor>;
  bodyYaw?: number;
  movementState?: BattleMovementState;
  movementCommand?: RoleMovementMathInput['command'];
  cpu?: BotController;
  autopilot?: BotController;
}

/** Step the real participants; CPU inputs pass through World's ordinary authority gate. */
export function advanceActors<Player extends CombatActor>(room: {
  roomId: string;
  readonly phase: string;
  mode: number;
  map: {mapId: number; tankLimit: number};
  teamLives: number[];
  startedAt: number;
  players: ReadonlyMap<string, Player>;
  objectives: ObjectiveSnapshot[];
  sceneObjects: SceneObjectSnapshot[];
  battlefield: Battlefield;
  bullets: BulletState[];
}, dt: number, now: number, bodyRadius: number, moveScale: number, events: MsgRoomEvent[], handlers: {
  respawn(player: Player): void;
  maxHp(player: Player): number;
  input(playerId: string, input: MsgPlayerInput, autonomous: boolean): MsgRoomEvent[];
  allocateBulletId(): string;
  staticObjects?(player: Player): Iterable<RoleStaticCollider>;
  beforeFire?(player: Player): boolean;
  afterFire?(player: Player): void;
  hitSceneObject?(owner: Player, targetId: string, damage: number, ammoItemId: number): boolean;
  hitPlayer?(owner: Player, targetId: string, damage: number, ammoItemId: number): void;
}): void {
  // Original415da6 advances the callback queue before the scene's actors.
  for (const player of room.players.values()) {
    if (room.phase !== 'PLAYING') break;
    const pendingShot = player.combat.pendingShot;
    if (!pendingShot) continue;
    if (!player.alive) {
      player.combat.pendingShot = undefined;
      player.combat.specialFlag12 = 0;
      continue;
    }
    const elapsed = Math.fround(dt);
    // Original4046a5 invokes once when the remaining f32 time fits this step.
    if (pendingShot.remainingSeconds <= elapsed) {
      player.combat.pendingShot = undefined;
      fireProjectile(room, player, (now - room.startedAt) / 1000,
        handlers.allocateBulletId, events, bodyRadius,
        (targetId, damage, ammoItemId) => handlers.hitSceneObject?.(player, targetId, damage, ammoItemId) ?? false,
        (targetId, damage, ammoItemId) => handlers.hitPlayer?.(player, targetId, damage, ammoItemId),
        pendingShot.ammoItemId);
      handlers.afterFire?.(player);
    } else {
      pendingShot.remainingSeconds = Math.fround(pendingShot.remainingSeconds - elapsed);
    }
  }
  for (const player of room.players.values()) {
    if (room.phase !== 'PLAYING') break;
    player.combat.advanceTimers(dt);
    if (!player.alive) {
      player.combat.pendingShot = undefined;
      player.combat.specialFlag12 = 0;
      if (now >= player.respawnAt) {
        handlers.respawn(player);
        if (player.alive) events.push({roomId: room.roomId, type: 'respawn', message: `${player.name}重新出击`,
          playerId: player.id, targetId: '', value: 0, x: 0, y: 0, z: 0, skillId: undefined});
      }
      continue;
    }
    const controller = player.cpu ?? player.autopilot;
    if (controller) {
      const parameters = originalMovementParameters(player);
      events.push(...handlers.input(player.id, controller.input({...player,
        maxHp: handlers.maxHp(player),
        movementReady: parameters !== undefined,
        fireReady: !player.combat.pendingShot && isRoleFireReady(player.combat.getFlag(11) !== 0,
          (now - room.startedAt) / 1000, player.combat.nextAvailableSeconds),
        movement: parameters ? {
          ...parameters,
          navigation: createOriginalBotNavigation(room.battlefield),
          predict: (input: MsgPlayerInput) => {
            const state = predictControlledBattleMovement(player, input, room.battlefield, room.players.values(), dt)!;
            return {...state.pose.position, yaw: state.yaw};
          },
        } : undefined}, [...room.players.values()], room.objectives,
        room.battlefield, room.mode, now, dt, {mode: room.mode, team: player.team,
          initialLives: room.map.tankLimit, lives: room.teamLives}, room), !!player.autopilot));
    }
    const input = player.input;
    const currentSeconds = (now - room.startedAt) / 1000;
    advanceDefaultAmmoMagazine(player.combat, currentSeconds, player.magazineReady === true);
    if (!controller && input.pose) {
      const obb = createRoleObbFromPose(battleMovementPose(player));
      for (const object of handlers.staticObjects?.(player) ?? []) {
        if (intersectsOriginalObb(obb, object.obb)) object.notify(100);
      }
    } else {
      const movementElapsed = roleMovementElapsed(dt);
      const original = predictControlledBattleMovement(player, input, room.battlefield, room.players.values(), dt,
        handlers.staticObjects?.(player));
      if (original) {
        commitBattleMovement(player, original);
        player.movementCommand = original.command;
      } else if (movementElapsed > 0
          && isRoleMovementAllowed(player.combat, roleMovementCommand(input.move, input.turn))) {
        const start = battleMovementPose(player);
        const turn = input.turn * player.tank.turn * movementElapsed * 0.12;
        player.bodyYaw = (player.bodyYaw ?? player.yaw) + turn;
        player.yaw += turn;
        const forward = Math.sign(input.move) * player.tank.speed * moveScale * movementElapsed;
        const destination = room.battlefield.move(player, {
          x: player.x + Math.sin(player.yaw) * forward, y: player.y,
          z: player.z + Math.cos(player.yaw) * forward,
        }, bodyRadius);
        const pose = constrainTankPose(start, battleMovementPose({...player, ...destination}),
          tankObstacles(player.id, room.players.values()));
        commitBattleMovement(player, {pose, yaw: Math.atan2(pose.look.x, pose.look.z),
          bodyYaw: Math.atan2(pose.forward.x, pose.forward.z)});
        player.movementCommand = pose === start ? 0
          : roleMovementCommand(input.move, input.turn) as RoleMovementMathInput['command'];
      }
      advanceBattleTurret(player, input.aim, room.battlefield, room.players.values(), dt,
        handlers.staticObjects?.(player));
    }
    if (input.fire && !player.combat.pendingShot && isRoleFireReady(player.combat.getFlag(11) !== 0,
        currentSeconds, player.combat.nextAvailableSeconds)) {
      if (!player.magazineReady) continue;
      if (isDefaultAmmo(player.combat) && player.combat.bulletCount <= 0) continue;
      const bulletCount = player.combat.bulletCount;
      if (handlers.beforeFire && !handlers.beforeFire(player)) continue;
      // Reserve the existing Web ammo transaction at acceptance. Reload starts
      // at the deferred query, as in423092, rather than at the03 action start.
      if (player.magazineReady) {
        applyRoleFireReloadNotification({local: true,
          bulletCount,
          normalSeconds: player.combat.roleFloatFields.get(0x50)!,
          lastBulletSeconds: player.combat.roleFloatFields.get(0x54)!,
          currentSeconds: () => currentSeconds + SHOT_QUERY_DELAY_SECONDS}, player.combat, {duration: seconds => {player.combat.reloadDuration = seconds;}, forwarded: () => {}});
        player.combat.reloadSource = 'original-normal';
      }
      player.combat.reloadStartedAt = now + SHOT_QUERY_DELAY_SECONDS * 1000;
      player.combat.specialFlag12 = 1;
      player.combat.pendingShot = {remainingSeconds: SHOT_QUERY_DELAY_SECONDS,
        ammoItemId: player.combat.currentAmmoTableId};
      events.push({roomId: room.roomId, type: 'beforeShot', message: `${player.name}准备开火`,
        playerId: player.id, targetId: '', value: 0, x: player.x, y: player.y, z: player.z,
        skillId: player.combat.pendingShot.ammoItemId});
      consumeDefaultAmmoMagazine(player.combat);
    }
  }
}
