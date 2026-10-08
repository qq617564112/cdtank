import {battleSkillSources} from '../battle/projection';
import {selectRoleSkills} from '../battle/roles/skills';
import {combatSkills, combatItemSkills} from '../battle/catalog';
import type {OwnedRoleBaseRecord} from '../../../shared/contracts/owned-base';
import {queuedPartSkillIds} from '../battle/passive-part-effects';
import {equipmentTarget, isAppearanceEffectItem} from '../../../shared/combat/equipment-target';
import {roomMaxPlayers} from './player-limits';
import type {DefenseBoostState} from '../battle/items/defense-drink';
import type {AmmoRadarJamState} from '../battle/items/ammo-radar-jam';
import type {AmmoBurnState} from '../battle/items/ammo-burn';
import type {RoleDisguiseState} from '../battle/items/role-disguise';
import type {MsgRoomSnapshot, PlayerSnapshot, MatchResult, ObjectiveSnapshot, SceneObjectSnapshot, SceneCrushSnapshot, ScenePlantSnapshot, GroundTrapSnapshot, GroundItemSnapshot} from '../../../shared/protocols';
import type {PlayerTitle} from '../../../shared/protocols/MsgRoomSnapshot';
import {readOwnedTankTextures} from '../../../shared/combat/role-owned-textures';
import type {RoleOwnedSources} from '../accounts/owned/receive-pair';
import type {BattleRoleSources} from '../battle-role-sources';
import type {InventoryWireRecord} from '../../../shared/protocols/PtlInventory';
import {classifyItemId} from '../../../shared/combat/item-hotkeys';
import {originalMovementParameters, type MovingParticipant} from '../battle/movement';
import {isBattleMovementAllowed} from '../battle/roles/movement-permission';
import {defaultMovementParameters} from '../battle/movement-parameters';
import type {Battlefield} from '../battlefield';

interface SnapshotPlayer extends MovingParticipant {
  id: string; name: string; team: number;
  x: number; y: number; z: number; yaw: number; bodyYaw?: number; aim: number; hp: number;
  alive: boolean; score: number; kills: number; deaths: number; respawnAt: number;
  catsInfo?: number; dogsInfo?: number;
  vip: boolean; objectivesDestroyed: number; cpu?: unknown; cpuPetId?: number; autopilot?: unknown;
  movementCommand?: number;
  inventory: InventoryWireRecord[];
  ownedRoles: {snapshot(): RoleOwnedSources; equipment?: BattleRoleSources['equipment']};
  boundGear?: OwnedRoleBaseRecord;
  petBattle?: {attributeSkillIds(): number[]};
  defenseBoost?: DefenseBoostState;
  attackBoost?: {skillId: number; expiresAt: number; attackPercent: number; attackBonus: number};
  turnBoost?: {skillId: number; expiresAt: number; turnBonus: number};
  speedBoost?: {skillId: number; expiresAt: number; moveBonus: number};
  invincibility?: {skillId: number; expiresAt: number};
  respawnProtection?: {skillId: number; expiresAt: number};
  opticalCamouflage?: {skillId: number; expiresAt: number};
  roleDisguise?: RoleDisguiseState;
  trapRestraint?: {skillId: number; expiresAt: number};
  trapTurnRestraint?: {skillId: number; expiresAt: number};
  trapFireRestraint?: {skillId: number; expiresAt: number};
  burn?: AmmoBurnState;
  radarJam?: AmmoRadarJamState;
  title?: PlayerTitle;
}

interface SnapshotRoom {
  battlefield: Battlefield;
  map: {maxPlayers: number; mapId: number; name: string; description?: string};
  roomName: string; passwordHash?: Uint8Array;
  maxPlayers?: number; friendlyFire?: boolean;
  roomId: string; mode: number; tick: number; phase: MsgRoomSnapshot['phase']; startedAt: number;
  players: ReadonlyMap<string, {id: string; clientId: string}>;
  bullets: MsgRoomSnapshot['bullets']; teamScores: number[]; winnerTeam: number;
  round: number; ready: ReadonlySet<string>; rematch: ReadonlySet<string>;
  loaded: ReadonlySet<string>;
  creatorClientId?: string; targetScore: number; teamLives: number[];
  objectives: ObjectiveSnapshot[]; sceneObjects?: SceneObjectSnapshot[]; sceneCrushes?: SceneCrushSnapshot[]; scenePlants?: ScenePlantSnapshot[]; groundTraps?: GroundTrapSnapshot[]; groundItems?: GroundItemSnapshot[]; result?: MatchResult;
}

/** Project authoritative state onto the existing wire format without advancing the world. */
export function playerSnapshot(player: SnapshotPlayer, maxHp: number, currentSeconds = 0,
  battleActive = true, now = Date.now()): PlayerSnapshot {
  const sources = player.ownedRoles.snapshot();
  const appearanceInstanceId = player.ownedRoles.equipment?.().decorationInstanceId;
  const appearance = player.inventory.find(item => item.instanceId === appearanceInstanceId
    && item.state === 2 && item.ownedQuantity > 0 && isAppearanceEffectItem(item.itemTableId));
  const owned = sources.equipment;
  const decorationRecord = appearanceInstanceId === undefined || appearanceInstanceId === 0 ? undefined
    : player.inventory.find(item => (item.instanceId >>> 0) === (appearanceInstanceId >>> 0));
  const decoration = decorationRecord && decorationRecord.state === 2 && decorationRecord.ownedQuantity > 0
    && equipmentTarget(decorationRecord.itemTableId) === 'DECORATION'
    ? {itemTableId: decorationRecord.itemTableId} : undefined;
  const skills = battleSkillSources(player);
  const movement = originalMovementParameters(player);
  const parameters = movement ?? defaultMovementParameters(player.tank);
  const snapshot: PlayerSnapshot & {radarJammed?: boolean} = {trapFireRestraint: player.trapFireRestraint ? {...player.trapFireRestraint,
    firePermissionCount: player.combat.record!.flags![11]} : undefined, trapTurnRestraint: player.trapTurnRestraint ? {...player.trapTurnRestraint,
    turnPermissionCount: player.combat.record!.flags![10]} : undefined, trapRestraint: player.trapRestraint ? {...player.trapRestraint,
    movePermissionCount: player.combat.record!.flags![9]} : undefined, id: player.id, name: player.name, tankId: player.tank.id,
    petId: player.cpu ? player.cpuPetId : sources.base?.fields.get(8),
    roleSkillSources: skills ? {
      currentSkillIds: [...skills.currentSkillIds ?? []],
      equipmentSkills: skills.equipmentSkills?.map(skill => ({...skill})) ?? [],
      selectedSkillIds: selectRoleSkills(skills, combatSkills, combatItemSkills).map(skill => skill.skillId),
    } : undefined,
    queuedPartSkillIds: queuedPartSkillIds(player.combat.record?.arrays.get(2),
      player.combat.record?.arrays.get(4), appearance?.itemTableId),
    tankTextures: owned ? readOwnedTankTextures(owned) : undefined, team: player.team,
    x: round(player.x), y: round(player.y), z: round(player.z),
    yaw: round(player.yaw, 4), bodyYaw: player.bodyYaw === undefined ? undefined : round(player.bodyYaw, 4), aim: round(player.aim, 4), hp: Math.round(player.hp), maxHp,
    movement: {...parameters,
      tankType: player.tank.recomputeBase.tankType, original: movement !== undefined,
      canMove: battleActive && isBattleMovementAllowed(player, 1),
      canTurn: battleActive && isBattleMovementAllowed(player, 3),
      command: battleActive && !player.roleDisguise ? player.movementCommand ?? 0 : 0},
    alive: player.alive, score: Math.round(player.score), kills: player.kills, deaths: player.deaths,
    catsInfo: player.catsInfo, dogsInfo: player.dogsInfo,
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
    respawnProtection: player.respawnProtection ? {...player.respawnProtection} : undefined,
    opticalCamouflage: player.opticalCamouflage ? {...player.opticalCamouflage} : undefined,
    roleDisguise: player.roleDisguise ? {...player.roleDisguise} : undefined,
    radarJammed: player.alive && player.radarJam !== undefined && now < player.radarJam.expiresAt,
    decoration,
    ammoBurn: player.alive && player.burn ? {itemId: player.burn.itemId, skillId: player.burn.skillId,
      startedAt: player.burn.startedAt, expiresAt: player.burn.startedAt + player.burn.ticks * player.burn.intervalMs} : undefined,
    title: player.title ? {...player.title} : undefined,
    reload: {duration: player.combat.reloadDuration, startedAt: player.combat.reloadStartedAt, source: player.combat.reloadSource,
      remaining: player.alive ? Math.max(0, player.combat.nextAvailableSeconds - Math.fround(currentSeconds)) : 0}};
  return snapshot;
}

/** World supplies its configured timing and validated player HP policy. */
export function roomSnapshot(room: SnapshotRoom, now: number, timeLimit: number,
  minPlayers: number, players: PlayerSnapshot[]): MsgRoomSnapshot {
  const combatTime = room.phase === 'FINISHED' && room.result ? room.result.endedAt : now;
  return {roomId: room.roomId, serverTime: now, mode: room.mode, tick: room.tick,
    roomInfo: {name: room.roomName, mapId: room.map.mapId, mapName: room.map.name,
      mapDescription: room.map.description ?? '', timeLimitSeconds: timeLimit, hasPassword: !!room.passwordHash},
    remaining: room.phase === 'PLAYING' || room.phase === 'FINISHED'
      ? Math.max(0, Math.min(timeLimit, timeLimit - Math.floor((combatTime - room.startedAt) / 1000))) : 0,
    phase: room.phase, players, bullets: room.bullets.map(bullet => ({...bullet})),
    teamScores: [...room.teamScores], winnerTeam: room.winnerTeam,
    match: {round: room.round, battleStartsAt: room.startedAt,
      readyPlayerIds: [...room.ready], loadedPlayerIds: [...room.loaded], rematchPlayerIds: [...room.rematch],
      cpuManagerId: [...room.players.values()].find(player => player.clientId === room.creatorClientId)?.id,
      minPlayers, maxPlayers: roomMaxPlayers(room), friendlyFire: room.friendlyFire ?? false, targetScore: room.targetScore, teamLives: [...room.teamLives],
      animatedBlockers: room.battlefield.animatedBlockersSnapshot(),
      objectives: room.objectives.map(objective => ({...objective})),
      sceneObjects: (room.sceneObjects ?? []).map(object => ({...object})), sceneCrushes: (room.sceneCrushes ?? []).map(object => ({...object})), scenePlants: (room.scenePlants ?? []).map(plant => ({...plant})), groundTraps: (room.groundTraps ?? []).map(trap => ({...trap})), groundItems: (room.groundItems ?? []).map(item => ({...item})), result: room.result}};
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
