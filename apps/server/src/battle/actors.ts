import type {MsgPlayerInput, MsgRoomEvent, ObjectiveSnapshot, SceneObjectSnapshot} from '../../../shared/protocols';
import {originalMovementParameters, commitBattleMovement, battleMovementPose, type BattleMovementState} from './movement';
import {createBattleMovementCollider, predictControlledBattleMovement} from './dynamic-movement';
import type {RoleMovementMathInput} from './roles/movement-math';
import {createOriginalBotNavigation} from './cpu/original-navigation';
import type {RoleAttributeState} from './roles/attribute-state';
import type {RoleCombatState} from './roles/combat-state';
import type {ShotModifiers} from './roles/shot-modifiers';
import {applyRoleFireReloadNotification, isRoleFireReady} from './roles/reload';
import {isBattleMovementAllowed, roleMovementCommand} from './roles/movement-permission';
import type {RoleDisguiseState} from './items/role-disguise';
import {roleMovementElapsed} from './roles/movement-time';
import {advanceBattleTurret} from './turret-movement';
import {advanceDefaultAmmoMagazine, consumeDefaultAmmoMagazine, isDefaultAmmo} from './roles/ammo-magazine';
import type {BotActor, BotController} from './cpu/controller';
import type {TankConfig} from '../config';
import type {Battlefield} from '../battlefield';
import {fireProjectile, type BulletState} from './projectiles';
import type {AttackBoostState} from './items/attack-drink';
import {isRoleControllerMovementAllowed, type RoleStaticCollider} from './roles/movement-controller';
import type {recomputeQualifiedRoleArmor} from './roles/recompute-armor';
import {createRoleObbFromPose} from './roles/movement-obb-prediction';
import {intersectsOriginalObb} from './roles/obb-intersection';
import {constrainTankPose, tankObstacles} from '../../../shared/movement/tank-collision';
import {defaultMovementParameters} from './movement-parameters';
import {advanceTankVertical, initialTankVerticalState,
  type TankVerticalState} from '../../../shared/movement/tank-vertical';

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
  roleDisguise?: RoleDisguiseState;
  armorReady?: boolean;
  shotModifiers?: ShotModifiers;
  recoveredArmor?: ReturnType<typeof recomputeQualifiedRoleArmor>;
  bodyYaw?: number;
  movementState?: BattleMovementState;
  movementCommand?: RoleMovementMathInput['command'];
  verticalState?: TankVerticalState;
  cpu?: BotController;
  autopilot?: BotController;
}

/** Step the real participants; CPU inputs pass through World's ordinary authority gate. */
export function advanceActors<Player extends CombatActor>(room: {
  roomId: string;
  readonly phase: string;
  mode: number;
  map: {mapId: number; tankLimit: number; bunkerHp: number};
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
  allocateShotId(): string;
  staticObjects?(player: Player): Iterable<RoleStaticCollider>;
  afterMovement?(player: Player): void;
  beforeFire?(player: Player): boolean;
  fired?(player: Player, shotId: string): void;
  afterFire?(player: Player): void;
  hitSceneObject?(owner: Player, targetId: string, damage: number, ammoItemId: number): boolean;
  hitPlayer?(owner: Player, targetId: string, damage: number, ammoItemId: number,
    shotId: string | undefined): void;
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
      const shotId = handlers.allocateShotId();
      fireProjectile(room, player, (now - room.startedAt) / 1000,
        handlers.allocateBulletId, events, bodyRadius,
        (targetId, damage, ammoItemId) => handlers.hitSceneObject?.(player, targetId, damage, ammoItemId) ?? false,
        (targetId, damage, ammoItemId) => handlers.hitPlayer?.(player, targetId, damage, ammoItemId, shotId),
        pendingShot.ammoItemId, shotId, () => handlers.fired?.(player, shotId), pendingShot.shotModifiers);
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
      (player.cpu ?? player.autopilot)?.resetReaction();
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
            return {...state.pose.position, yaw: state.yaw, bodyYaw: state.bodyYaw};
          },
        } : undefined}, [...room.players.values()], room.objectives,
        room.battlefield, room.mode, now, dt, {mode: room.mode, team: player.team,
          initialLives: room.map.tankLimit, lives: room.teamLives}, room), !!player.autopilot));
    }
    const input = player.input;
    const currentSeconds = (now - room.startedAt) / 1000;
    advanceDefaultAmmoMagazine(player.combat, currentSeconds, player.magazineReady === true);
    if (!controller && input.pose) {
      const command = roleMovementCommand(input.move, input.turn);
      if (command !== 0 && isBattleMovementAllowed(player, command)) {
        const peers = [...room.players.values()].filter(other => other.alive).map(createBattleMovementCollider);
        isRoleControllerMovementAllowed(createBattleMovementCollider(player), command,
          peers, handlers.staticObjects?.(player) ?? [], true, () => {});
      } else {
        const obb = createRoleObbFromPose(battleMovementPose(player));
        for (const object of handlers.staticObjects?.(player) ?? []) {
          if (intersectsOriginalObb(obb, object.obb)) object.notify(100);
        }
      }
    } else {
      const movementElapsed = roleMovementElapsed(dt);
      const original = predictControlledBattleMovement(player, input, room.battlefield, room.players.values(), dt,
        handlers.staticObjects?.(player));
      if (original) {
        commitBattleMovement(player, original);
        player.movementCommand = original.command;
      } else if (movementElapsed > 0) {
        // Without recovered movement sources, build a horizontal candidate
        // through the ordinary NAV/terrain move and then resolve the vertical
        // step once on the final X/Z. Horizontal permission only gates
        // translation: stationary, refused and collision-blocked bodies still
        // advance gravity.
        const start = battleMovementPose(player);
        const command = roleMovementCommand(input.move, input.turn) as RoleMovementMathInput['command'];
        let pose = start;
        if (command !== 0 && isBattleMovementAllowed(player, command)) {
          const parameters = defaultMovementParameters(player.tank, moveScale);
          const turn = input.turn * parameters.turn * movementElapsed;
          const yaw = player.yaw + turn;
          const bodyYaw = (player.bodyYaw ?? player.yaw) + turn;
          const forward = Math.sign(input.move) * parameters.speed * movementElapsed;
          const destination = room.battlefield.move(player, {
            x: player.x + Math.sin(yaw) * forward, y: player.y,
            z: player.z + Math.cos(yaw) * forward,
          }, bodyRadius);
          // battlefield.move writes the sampled NAV height into Y; restore the
          // pre-step physical Y so the shared vertical step alone decides the
          // fall instead of reading an already-grounded candidate.
          destination.y = start.position.y;
          pose = constrainTankPose(start, battleMovementPose({...player, ...destination, yaw, bodyYaw}),
            tankObstacles(player.id, room.players.values()));
        }
        const ground = room.battlefield.navigation.sample(pose.position.x, pose.position.z)?.height;
        const verticalState = {...(player.verticalState
          ?? initialTankVerticalState(player.y, room.battlefield.navigation.sample(player.x, player.z)?.height))};
        const vertical = advanceTankVertical(pose.position, room.battlefield.navigation, verticalState,
          movementElapsed, ground === undefined ? 0 : Math.max(0, ground - start.position.y));
        const committed = vertical.accepted ? pose : start;
        commitBattleMovement(player, {pose: committed, yaw: Math.atan2(committed.look.x, committed.look.z),
          bodyYaw: Math.atan2(committed.forward.x, committed.forward.z),
          verticalState: vertical.state});
        player.movementCommand = committed === start ? 0 : command;
      }
      advanceBattleTurret(player, input.aim, dt);
    }
    handlers.afterMovement?.(player);
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
        ammoItemId: player.combat.currentAmmoTableId,
        shotModifiers: {...(player.shotModifiers ?? {penetratesObstacles: false, rangePercent: 100})}};
      events.push({roomId: room.roomId, type: 'beforeShot', message: `${player.name}准备开火`,
        playerId: player.id, targetId: '', value: 0, x: player.x, y: player.y, z: player.z,
        skillId: player.combat.pendingShot.ammoItemId});
      consumeDefaultAmmoMagazine(player.combat);
    }
  }
}
