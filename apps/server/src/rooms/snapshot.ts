import {battleSkillSources} from '../battle/projection';
import {selectRoleSkills} from '../battle/roles/skills';
import {combatSkills, combatItemSkills} from '../battle/catalog';
import type {OwnedRoleBaseRecord} from '../../../shared/contracts/owned-base';
import {queuedPartSkillIds} from '../battle/passive-part-effects';
import {roomMaxPlayers} from './player-limits';
import type {DefenseBoostState} from '../battle/items/defense-drink';
import type {RoleDisguiseState} from '../battle/items/role-disguise';
import type {MsgRoomSnapshot, PlayerSnapshot, MatchResult, ObjectiveSnapshot, SceneObjectSnapshot, SceneCrushSnapshot, ScenePlantSnapshot, GroundTrapSnapshot} from '../../../shared/protocols';
import type {PlayerTitle} from '../../../shared/protocols/MsgRoomSnapshot';
import {readOwnedTankTextures} from '../../../shared/combat/role-owned-textures';
import type {RoleOwnedSources} from '../accounts/owned/receive-pair';
import type {InventoryWireRecord} from '../../../shared/protocols/PtlInventory';
import {classifyItemId} from '../../../shared/combat/item-hotkeys';
import {originalMovementParameters, type MovingParticipant} from '../battle/movement';
import {isRoleMovementAllowed} from '../battle/roles/movement-permission';

interface SnapshotPlayer extends MovingParticipant {
  id: string; name: string; team: number;
  x: number; y: number; z: number; yaw: number; bodyYaw?: number; aim: number; hp: number;
  alive: boolean; score: number; kills: number; deaths: number; respawnAt: number;
  vip: boolean; objectivesDestroyed: number; cpu?: unknown; autopilot?: unknown;
  movementCommand?: number;
  inventory: InventoryWireRecord[];
  ownedRoles: {snapshot(): RoleOwnedSources};
  boundGear?: OwnedRoleBaseRecord;
  defenseBoost?: DefenseBoostState;
  attackBoost?: {skillId: number; expiresAt: number; attackPercent: number; attackBonus: number};
  turnBoost?: {skillId: number; expiresAt: number; turnBonus: number};
  speedBoost?: {skillId: number; expiresAt: number; moveBonus: number};
  invincibility?: {skillId: number; expiresAt: number};
  opticalCamouflage?: {skillId: 9; expiresAt: number};
  roleDisguise?: RoleDisguiseState;
  trapRestraint?: {skillId: 4001; expiresAt: number};
  trapTurnRestraint?: {skillId: 4002; expiresAt: number};
  trapFireRestraint?: {skillId: 4003; expiresAt: number};
  burn?: {startedAt: number};
  title?: PlayerTitle;
}

interface SnapshotRoom {
  map: {maxPlayers: number; mapId: number; name: string; description?: string};
  roomName: string; passwordHash?: Uint8Array;
  maxPlayers?: number; friendlyFire?: boolean;
  roomId: string; mode: number; tick: number; phase: MsgRoomSnapshot['phase']; startedAt: number;
  players: ReadonlyMap<string, {id: string; clientId: string}>;
  bullets: MsgRoomSnapshot['bullets']; teamScores: number[]; winnerTeam: number;
  round: number; ready: ReadonlySet<string>; rematch: ReadonlySet<string>;
  loaded: ReadonlySet<string>;
  creatorClientId?: string; targetScore: number; teamLives: number[];
  objectives: ObjectiveSnapshot[]; sceneObjects?: SceneObjectSnapshot[]; sceneCrushes?: SceneCrushSnapshot[]; scenePlants?: ScenePlantSnapshot[]; groundTraps?: GroundTrapSnapshot[]; result?: MatchResult;
}

/** Project authoritative state onto the existing wire format without advancing the world. */
export function playerSnapshot(player: SnapshotPlayer, maxHp: number, currentSeconds = 0): PlayerSnapshot {
  const sources = player.ownedRoles.snapshot();
  const owned = sources.equipment;
  const skills = battleSkillSources(player);
  const movement = originalMovementParameters(player);
  return {trapFireRestraint: player.trapFireRestraint ? {...player.trapFireRestraint,
    firePermissionCount: player.combat.record!.flags![11]} : undefined, trapTurnRestraint: player.trapTurnRestraint ? {...player.trapTurnRestraint,
    turnPermissionCount: player.combat.record!.flags![10]} : undefined, trapRestraint: player.trapRestraint ? {...player.trapRestraint,
    movePermissionCount: player.combat.record!.flags![9]} : undefined, id: player.id, name: player.name, tankId: player.tank.id,
    petId: sources.base?.fields.get(8),
    roleSkillSources: skills ? {
      currentSkillIds: [...skills.currentSkillIds ?? []],
      equipmentSkills: skills.equipmentSkills?.map(skill => ({...skill})) ?? [],
      selectedSkillIds: selectRoleSkills(skills, combatSkills, combatItemSkills).map(skill => skill.skillId),
    } : undefined,
    queuedPartSkillIds: queuedPartSkillIds(player.combat.record?.arrays.get(2),
      player.combat.record?.arrays.get(4)),
    tankTextures: owned ? readOwnedTankTextures(owned) : undefined, team: player.team,
    x: round(player.x), y: round(player.y), z: round(player.z),
    yaw: round(player.yaw, 4), bodyYaw: player.bodyYaw === undefined ? undefined : round(player.bodyYaw, 4), aim: round(player.aim, 4), hp: Math.round(player.hp), maxHp,
    movement: {speed: movement?.speed ?? player.tank.speed * 6,
      turn: movement?.turn ?? player.tank.turn * .12,
      tankType: player.tank.recomputeBase.tankType, original: movement !== undefined,
      canMove: isRoleMovementAllowed(player.combat, 1),
      canTurn: isRoleMovementAllowed(player.combat, 3), command: player.movementCommand ?? 0},
    alive: player.alive, score: Math.round(player.score), kills: player.kills, deaths: player.deaths,
    respawnAt: player.respawnAt, isVIP: player.vip, objectivesDestroyed: player.objectivesDestroyed,
    isCpu: !!player.cpu, isAutopilot: !!player.autopilot, selectedAmmoSlot: player.combat.selectedAmmoSlot,
    cpuLoadout: player.cpu ? Array.from({length: 7}, (_, index) => {
      const instanceId = player.combat.record?.arrays.get(0)?.[index];
      const item = player.inventory.find(record => record.instanceId === (instanceId ?? 0));
      return item ? {slot: index + 2, itemTableId: item.itemTableId, quantity: item.ownedQuantity} : undefined;
    }).filter((item): item is NonNullable<typeof item> => item !== undefined) : undefined,
    ammoItemId: player.combat.currentAmmoTableId,
    ammoMagazine: {remaining: player.combat.bulletCount, capacity: player.combat.maxBulletCount},
    ammoSlots: Array.from({length: 3}, (_, index) => {
      const instanceId = player.combat.record?.arrays.get(0)?.[index];
      const item = instanceId === undefined ? undefined : player.inventory.find(record =>
        (record.instanceId >>> 0) === (instanceId >>> 0) && classifyItemId(record.itemTableId) === 3);
      return item ? {slot: index + 2, itemTableId: item.itemTableId, quantity: item.battleQuantity} : undefined;
    }).filter((slot): slot is {slot: number; itemTableId: number; quantity: number} => slot !== undefined),
    defenseBoost: player.defenseBoost ? {...player.defenseBoost} : undefined,
    attackBoost: player.attackBoost ? {...player.attackBoost} : undefined,
    turnBoost: player.turnBoost ? {...player.turnBoost} : undefined,
    speedBoost: player.speedBoost ? {...player.speedBoost} : undefined,
    invincibility: player.invincibility ? {...player.invincibility} : undefined,
    opticalCamouflage: player.opticalCamouflage ? {...player.opticalCamouflage} : undefined,
    roleDisguise: player.roleDisguise ? {...player.roleDisguise} : undefined,
    ammoBurn: player.alive && player.burn ? {itemId: 2007, skillId: 4005,
      startedAt: player.burn.startedAt, expiresAt: player.burn.startedAt + 9000} : undefined,
    title: player.title ? {...player.title} : undefined,
    reload: {duration: player.combat.reloadDuration, startedAt: player.combat.reloadStartedAt, source: player.combat.reloadSource,
      remaining: player.alive ? Math.max(0, player.combat.nextAvailableSeconds - Math.fround(currentSeconds)) : 0}};
}

/** World supplies its configured timing and validated player HP policy. */
export function roomSnapshot(room: SnapshotRoom, now: number, timeLimit: number,
  minPlayers: number, players: PlayerSnapshot[]): MsgRoomSnapshot {
  return {roomId: room.roomId, serverTime: now, mode: room.mode, tick: room.tick,
    roomInfo: {name: room.roomName, mapId: room.map.mapId, mapName: room.map.name,
      mapDescription: room.map.description ?? '', timeLimitSeconds: timeLimit, hasPassword: !!room.passwordHash},
    remaining: room.phase === 'PLAYING'
      ? Math.max(0, timeLimit - Math.floor((now - room.startedAt) / 1000)) : 0,
    phase: room.phase, players, bullets: room.bullets.map(bullet => ({...bullet})),
    teamScores: [...room.teamScores], winnerTeam: room.winnerTeam,
    match: {round: room.round, readyPlayerIds: [...room.ready], loadedPlayerIds: [...room.loaded], rematchPlayerIds: [...room.rematch],
      cpuManagerId: [...room.players.values()].find(player => player.clientId === room.creatorClientId)?.id,
      minPlayers, maxPlayers: roomMaxPlayers(room), friendlyFire: room.friendlyFire ?? false, targetScore: room.targetScore, teamLives: [...room.teamLives],
      objectives: room.objectives.map(objective => ({...objective})),
      sceneObjects: (room.sceneObjects ?? []).map(object => ({...object})), sceneCrushes: (room.sceneCrushes ?? []).map(object => ({...object})), scenePlants: (room.scenePlants ?? []).map(plant => ({...plant})), groundTraps: (room.groundTraps ?? []).map(trap => ({...trap})), result: room.result}};
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
