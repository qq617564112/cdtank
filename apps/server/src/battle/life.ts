import {clearAmmoBurn, type AmmoBurnState} from './items/ammo-burn';
import {defenseAdjustedDamage, type DefenseBoostState} from './items/defense-drink';
import {calculateQualifiedShotDamage} from './roles/qualified-shot-defense';
import {resolveShotDefenseFacet} from './roles/shot-defense-facet';
import {applyShotLifeDrain} from './shot-life-drain';
import {consumeShotCancellation} from './shot-cancellation';
import {resolveShotCritical} from './shot-critical';
import {resolveShotBackCriticalBonus} from './shot-back-critical';
import {qualifiedLastStandDuration} from './last-stand';
import type {BattleRoleSources} from '../battle-role-sources';
import {resolveShotHurtSelector} from './shot-hurt-resistance';
import {setBattleHealth, type HealthParticipant} from './health';
import {resetConfirmedAmmo} from './items/ammo-confirmation';
import type {RoleCombatState} from './roles/combat-state';
import type {MsgPlayerInput, MsgRoomEvent} from '../../../shared/protocols';
import type {Battlefield, SpawnPoint} from '../battlefield';
import {applyFriendlyKill, applyModeKill, type ModeOutcome} from '../modes/outcomes';

interface LifePlayer extends HealthParticipant {
  id: string; name: string; team: number; x: number; y: number; z: number;
  hp: number; alive: boolean; score: number; deaths: number; kills: number;
  respawnAt: number; vip: boolean;
  defenseBoost?: DefenseBoostState;
  armorReady?: boolean;
  recoveredArmor?: {defensePercent: number; defenseBonus: number;
    sideDefensePercent?: number; backDefensePercent?: number};
  attributesReady?: boolean;
  ownedRoles?: Pick<BattleRoleSources, 'snapshot' | 'tables'>;
  cancellationsSpent?: number;
  attributes: HealthParticipant['attributes'] & {values?: {roleIntegers: Map<number, number>}};
  burn?: AmmoBurnState;
  invincibility?: {expiresAt: number};
  combat: HealthParticipant['combat'] & {readonly status: number; roleFloatFields?: Map<number, number>; setStatus(status: number): void;
    setSelectedAmmoSlot(value: number): boolean; setCurrentAmmoTableId(value: number): boolean};
}

/** Apply existing damage and mode counters; World commits any returned outcome. */
export function damagePlayer(room: {
  roomId: string; mode: number; targetScore: number; friendlyFire?: boolean;
  map: {brokenScore: number; hitScore: number; destroyScore: number; respawnTime: number};
  teamScores: number[]; teamLives: number[];
}, attacker: LifePlayer, target: LifePlayer, damage: number, now: () => number,
  events: MsgRoomEvent[], hurtSelector?: number, ammoItemId?: number,
  incidence?: {bodyYaw: number; bearing: {x: number; z: number}}): ModeOutcome | undefined {
  const friendly = room.mode <= 3 && attacker.team === target.team;
  if (friendly && !room.friendlyFire) {
    attacker.score += room.map.brokenScore;
    events.push({roomId: room.roomId, type: 'friendlyFire', message: `${attacker.name}误伤队友`,
      playerId: attacker.id, targetId: target.id, value: 0, x: 0, y: 0, z: 0, skillId: undefined});
    return;
  }
  // Rebuilt item8 authority: a real projectile hits but causes no damage or hit reward.
  if (target.invincibility && now() < target.invincibility.expiresAt) {
    events.push({roomId: room.roomId, type: 'immuneHit', message: `${target.name}处于无敌状态`,
      playerId: attacker.id, targetId: target.id, value: 0,
      x: target.x, y: target.y, z: target.z, skillId: 8});
    return;
  }
  if (ammoItemId !== undefined && !friendly && attacker.id !== target.id &&
      consumeShotCancellation(target)) {
    events.push({roomId: room.roomId, type: 'hit', message: `${target.name}抵消攻击`,
      playerId: attacker.id, targetId: target.id, value: 0,
      x: target.x, y: target.y, z: target.z});
    return;
  }
  const shotCritical = ammoItemId !== undefined && !friendly && attacker.id !== target.id
    ? resolveShotCritical(attacker, damage) : undefined;
  if (shotCritical) damage = shotCritical.attack;
  const facet = incidence ? resolveShotDefenseFacet(incidence.bodyYaw, incidence.bearing) : 'FRONT';
  const correction = facet === 'SIDE' ? target.recoveredArmor?.sideDefensePercent
    : facet === 'BACK' ? target.recoveredArmor?.backDefensePercent : 1;
  damage = ammoItemId !== undefined && target.armorReady && target.recoveredArmor
    ? calculateQualifiedShotDamage(damage, target.recoveredArmor, correction)
    : defenseAdjustedDamage(damage, target.defenseBoost, now());
  damage += resolveShotBackCriticalBonus(attacker, shotCritical?.critical === true, facet);
  const previousHp = target.hp;
  setBattleHealth(target, Math.max(0, previousHp - damage));
  attacker.score += friendly ? room.map.brokenScore : room.map.hitScore;
  if (friendly) events.push({roomId: room.roomId, type: 'friendlyFire', message: `${attacker.name}误伤队友`,
    playerId: attacker.id, targetId: target.id, value: damage,
    x: target.x, y: target.y, z: target.z, skillId: undefined});
  events.push({roomId: room.roomId, type: 'hit', message: `${attacker.name}命中${target.name}`,
    playerId: attacker.id, targetId: target.id, value: damage,
    x: target.x, y: target.y, z: target.z, skillId: undefined,
    hurtSelector: ammoItemId !== undefined ? resolveShotHurtSelector(target, hurtSelector) : hurtSelector,
    shotPlayerResult: shotCritical && ammoItemId !== undefined
      ? {itemId: ammoItemId, critical: shotCritical.critical} : undefined});
  if (ammoItemId !== undefined && !friendly && attacker.id !== target.id) {
    applyShotLifeDrain(room.roomId, attacker, previousHp - target.hp, events);
  }
  return resolvePlayerLethalState(room, attacker, target, friendly, now(), events);
}

/** Direct skill HP loss shares life settlement without the ammunition calculation chain. */
export function damagePlayerDirectly(room: Parameters<typeof damagePlayer>[0],
  attacker: LifePlayer, target: LifePlayer, damage: number, now: number,
  skillId: number, events: MsgRoomEvent[]): ModeOutcome | undefined {
  if (!target.alive || target.combat.status !== 2 || attacker.id === target.id ||
      (room.mode <= 3 && attacker.team === target.team)) return;
  if (target.invincibility && now < target.invincibility.expiresAt) {
    events.push({roomId: room.roomId, type: 'immuneHit', message: `${target.name}处于无敌状态`,
      playerId: attacker.id, targetId: target.id, value: 0,
      x: target.x, y: target.y, z: target.z, skillId: 8});
    return;
  }
  setBattleHealth(target, Math.max(0, target.hp - damage));
  attacker.score += room.map.hitScore;
  events.push({roomId: room.roomId, type: 'hit', message: `${attacker.name}命中${target.name}`,
    playerId: attacker.id, targetId: target.id, value: damage,
    x: target.x, y: target.y, z: target.z, skillId});
  return resolvePlayerLethalState(room, attacker, target, false, now, events);
}

function resolvePlayerLethalState(room: Parameters<typeof damagePlayer>[0],
  attacker: LifePlayer, target: LifePlayer, friendly: boolean, now: number,
  events: MsgRoomEvent[]): ModeOutcome | undefined {
  if (target.hp > 0 || target.lastStand) return;
  const duration = qualifiedLastStandDuration(target);
  if (duration !== undefined) {
    target.lastStand = {expiresAt: now + duration, attackerId: attacker.id,
      attackerName: attacker.name, friendly};
    clearAmmoBurn(target);
    return;
  }
  return finalizePlayerDeath(room, attacker, target, friendly, now, events);
}

/** Expiration commits the same death chain once, before that tick's actor inputs. */
export function advanceLastStandDeath(room: Parameters<typeof damagePlayer>[0],
  target: LifePlayer, attacker: LifePlayer | undefined, now: number,
  events: MsgRoomEvent[]): {outcome?: ModeOutcome; attackerId: string} | undefined {
  const pending = target.lastStand;
  if (!pending || now < pending.expiresAt) return;
  target.lastStand = undefined;
  const outcome = finalizePlayerDeath(room, attacker, target, pending.friendly, now, events,
    {id: pending.attackerId, name: pending.attackerName});
  return {outcome, attackerId: pending.attackerId};
}

function finalizePlayerDeath(room: Parameters<typeof damagePlayer>[0],
  attacker: LifePlayer | undefined, target: LifePlayer, friendly: boolean,
  now: number, events: MsgRoomEvent[], attribution: {id: string; name: string} | undefined = attacker): ModeOutcome | undefined {
  if (!target.alive) return;
  target.lastStand = undefined;
  target.alive = false;
  clearAmmoBurn(target);
  target.combat.setStatus(3);
  target.deaths += 1;
  target.respawnAt = now + room.map.respawnTime * 1000;
  if (!friendly && attacker) {
    attacker.kills += 1;
    attacker.score += room.map.destroyScore;
  }
  const outcome = friendly || !attacker ? applyFriendlyKill(room, target) : applyModeKill(room, attacker, target);
  events.push({roomId: room.roomId, type: 'destroy', message: `${attribution?.name ?? ''}击毁${target.name}`,
    playerId: attribution?.id ?? '', targetId: target.id, value: 1,
    x: target.x, y: target.y, z: target.z, skillId: undefined});
  return outcome;
}

/** Restore the same participant at the selected free spawn; input watermark is retained. */
export function respawnPlayer(field: Battlefield, player: LifePlayer & {
  combat: RoleCombatState;
  yaw: number; bodyYaw?: number; movementState?: unknown; movementCommand?: number; aim: number; input: MsgPlayerInput;
}, maxHp: number, defaultInput: MsgPlayerInput,
  spawn: SpawnPoint = field.spawn(Math.floor(Math.random() * field.spawns.length))): void {
  player.lastStand = undefined;
  clearAmmoBurn(player);
  player.x = spawn.x;
  player.y = spawn.y;
  player.z = spawn.z;
  player.yaw = spawn.yaw;
  player.bodyYaw = undefined;
  player.movementState = undefined;
  player.movementCommand = 0;
  player.aim = 0;
  setBattleHealth(player, maxHp, maxHp);
  player.alive = true;
  player.combat.setStatus(2);
  resetConfirmedAmmo(player.combat);
  player.respawnAt = 0;
  player.cancellationsSpent = 0;
  player.input = {...defaultInput};
}
