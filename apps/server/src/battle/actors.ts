import type {MsgPlayerInput, MsgRoomEvent, ObjectiveSnapshot} from '../../../shared/protocols';
import {originalMovementParameters, commitBattleMovement, type BattleMovementState} from './movement';
import {predictControlledBattleMovement} from './dynamic-movement';
import type {RoleMovementMathInput} from './roles/movement-math';
import {createOriginalBotNavigation} from './cpu/original-navigation';
import type {RoleAttributeState} from './roles/attribute-state';
import type {RoleCombatState} from './roles/combat-state';
import {applyRoleFireReloadNotification, isRoleFireReady} from './roles/reload';
import {isRoleMovementAllowed, roleMovementCommand} from './roles/movement-permission';
import {roleMovementElapsed} from './roles/movement-time';
import {aimTurnRate} from './roles/aim-turn';
import {advanceDefaultAmmoMagazine, consumeDefaultAmmoMagazine, isDefaultAmmo} from './roles/ammo-magazine';
import type {BotActor, BotController} from './cpu/controller';
import type {TankConfig} from '../config';
import type {Battlefield} from '../battlefield';
import {fireProjectile, type BulletState} from './projectiles';
import type {AttackBoostState} from './items/attack-drink';
import type {RoleStaticCollider} from './roles/movement-controller';
import type {recomputeQualifiedRoleArmor} from './roles/recompute-armor';

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
  map: {tankLimit: number};
  teamLives: number[];
  startedAt: number;
  players: ReadonlyMap<string, Player>;
  objectives: ObjectiveSnapshot[];
  battlefield: Battlefield;
  bullets: BulletState[];
}, dt: number, now: number, bodyRadius: number, moveScale: number, events: MsgRoomEvent[], handlers: {
  respawn(player: Player): void;
  maxHp(player: Player): number;
  input(playerId: string, input: MsgPlayerInput, autonomous: boolean): MsgRoomEvent[];
  allocateBulletId(): string;
  staticObjects?(player: Player): Iterable<RoleStaticCollider>;
  beforeFire?(player: Player): boolean;
  hitSceneObject?(owner: Player, targetId: string, damage: number): boolean;
  hitPlayer?(owner: Player, targetId: string, damage: number, ammoItemId: number): void;
}): void {
  for (const player of room.players.values()) {
    if (room.phase !== 'PLAYING') break;
    player.combat.advanceTimers(dt);
    if (!player.alive) {
      if (now >= player.respawnAt) {
        handlers.respawn(player);
        events.push({roomId: room.roomId, type: 'respawn', message: `${player.name}重新出击`,
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
        fireReady: isRoleFireReady(player.combat.getFlag(11) !== 0,
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
          initialLives: room.map.tankLimit, lives: room.teamLives}), !!player.autopilot));
    }
    const input = player.input;
    const currentSeconds = (now - room.startedAt) / 1000;
    advanceDefaultAmmoMagazine(player.combat, currentSeconds, player.magazineReady === true);
    const movementElapsed = roleMovementElapsed(dt);
    player.aim += input.aim * aimTurnRate(originalMovementParameters(player)?.turn,
      player.tank.turn) * movementElapsed;
    const original = predictControlledBattleMovement(player, input, room.battlefield, room.players.values(), dt,
      handlers.staticObjects?.(player));
    if (original) {
      commitBattleMovement(player, original);
      player.movementCommand = original.command;
    } else if (movementElapsed > 0
        && isRoleMovementAllowed(player.combat, roleMovementCommand(input.move, input.turn))) {
      // Incomplete/VIP owned sources retain explicit prototype geometry until
      // the original collision/controller and full direction contracts close.
      player.yaw += input.turn * player.tank.turn * movementElapsed * 0.12;
      const forward = Math.sign(input.move) * player.tank.speed * moveScale * movementElapsed;
      const destination = room.battlefield.move(player, {
        x: player.x + Math.sin(player.yaw) * forward, y: player.y,
        z: player.z + Math.cos(player.yaw) * forward,
      }, bodyRadius);
      player.x = destination.x; player.y = destination.y; player.z = destination.z;
    }
    if (input.fire && isRoleFireReady(player.combat.getFlag(11) !== 0,
        currentSeconds, player.combat.nextAvailableSeconds)) {
      if (!player.magazineReady) continue;
      if (isDefaultAmmo(player.combat) && player.combat.bulletCount <= 0) continue;
      const bulletCount = player.combat.bulletCount;
      if (handlers.beforeFire && !handlers.beforeFire(player)) continue;
      // Original client uses a relative clock plus an f32 duration/deadline.
      // Ammo qualification is independent of owned HP and VIP life policy.
      if (player.magazineReady) {
        applyRoleFireReloadNotification({local: true,
          bulletCount,
          normalSeconds: player.combat.roleFloatFields.get(0x50)!,
          lastBulletSeconds: player.combat.roleFloatFields.get(0x54)!,
          currentSeconds: () => currentSeconds}, player.combat, {duration: seconds => {player.combat.reloadDuration = seconds;}, forwarded: () => {}});
        player.combat.reloadSource = 'original-normal';
      }
      player.combat.reloadStartedAt = now;
      fireProjectile(room, player, currentSeconds, handlers.allocateBulletId, events, bodyRadius,
        (targetId, damage) => handlers.hitSceneObject?.(player, targetId, damage) ?? false,
        (targetId, damage, ammoItemId) => handlers.hitPlayer?.(player, targetId, damage, ammoItemId));
      consumeDefaultAmmoMagazine(player.combat);
    }
  }
}
