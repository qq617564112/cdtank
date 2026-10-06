import {resetTrapFireRestraint} from './battle/items/trap-fire-restraint';
import {advanceEquipmentSupply, resetEquipmentSupply} from './battle/items/equipment-supply';
import {resetTrapTurnRestraint} from './battle/items/trap-turn-restraint';
import {placeGroundTrap, advanceGroundTraps, clearGroundTraps} from './battle/items/ground-traps';
import {
  advanceGroundItems,
  clearGroundItems,
  createBreachDrop,
  discardToGround,
  reconcileGroundItemInventory,
  type AcquireDiscardCallbacks,
  type AcquireGroundItemRequest,
  type DiscardGroundItemRequest,
} from './battle/items/ground-items';
import {advanceOldBombs} from './battle/items/old-bomb';
import {advanceContactMines} from './battle/items/contact-mine';
import {advanceAirstrikes} from './battle/items/airstrike';
import {resetTrapRestraint} from './battle/items/trap-restraint';
import {createSceneCrushes, acceptSceneCrush} from './battle/scene-crush';
import {createScenePlants, plantContactColliders} from './battle/scene-plant-contact';
import {MEDICAL_AMMO_ID, resolveMedicalAmmo} from './battle/items/medical-ammo';
import {advanceAmmoBurn, clearAmmoBurn, startAmmoBurn} from './battle/items/ammo-burn';
import {advanceAmmoSlow, clearAmmoSlow, startAmmoSlow} from './battle/items/ammo-slow';
import {advanceAmmoRadarJam, clearAmmoRadarJam, startAmmoRadarJam} from './battle/items/ammo-radar-jam';
import {roomMaxPlayers, roomMinPlayers} from './rooms/player-limits';
import {findAvailableTankSpawn} from './battle/spawn-position';
import {battleAttributes, battlePartSources, battleSkillSources, battleInventory} from './battle/projection';
import {configureBattleAutopilot} from './battle/autopilot';
import {roomChat} from './rooms/chat';
import {canBindBattleSources, bindBattleInventory, bindOwnedBattleSources, bindBattleEquipment, selectBattleTank, confirmBattleKitbag} from './battle/preparation';
import {baseTankMaxHp} from './battle/create-player';
import {setBattleHealth} from './battle/health';
import {combatSkills, combatItemSkills} from './battle/catalog';
import {selectRoleSkills} from './battle/roles/skills';
import {insertRoomPlayer} from './rooms/membership';
import {manageRoomCpu} from './rooms/cpu';
import {editWaitingRoom} from './rooms/edit';
import type {ReqEditRoom} from '../../shared/protocols/PtlEditRoom';
import {confirmBattleItemConsumption} from './battle/items/consumption';
import type {CpuLoadoutItem, ReqCpu} from '../../shared/protocols/PtlCpu';
import {leaveRoomPlayer} from './rooms/departure';
import {ensureDefaultRooms, ensureWaitingRoom} from './rooms/availability';
import {quickMatchRoom} from './rooms/quick-match';
import type {PlayerState} from './battle/player-state';
import type {RoomState, JoinResult, DepartedParticipantRecord} from './rooms/state';
import {createWaitingRoom} from './rooms/create';
import {createAndJoinRoom, admitRoomPlayer} from './rooms/admission';
import {damagePlayer, damagePlayerDirectly, respawnPlayer, advanceLastStandDeath} from './battle/life';
import {clearCopiedRoleSkill, copyPassiveSkillAfterKill} from './battle/passive-skill-copy';
import {healPetAfterKill} from './battle/pet-kill-heal';
import {applyPetHitSpeed, advancePetHitSpeed, clearPetHitSpeed} from './battle/pet-hit-speed';
import {battleMovementPose} from './battle/movement';
import {roleHurtSelector} from './battle/roles/hurt-direction';
import {initializeBattleParticipants} from './battle/start';
import {initializeModeRound} from './modes/start';
import {timeLimitOutcome} from './modes/outcomes';
import {advanceActors} from './battle/actors';
import {consumeConfirmedAmmo} from './battle/items/ammo-consumption';
import {acceptBattleInput} from './battle/accept-input';
import {advanceAttackDrink, clearAttackDrink} from './battle/items/attack-drink';
import {advanceDefenseDrink, clearDefenseDrink} from './battle/items/defense-drink';
import {recomputeBattleAttributes} from './battle/attributes';
import {advanceTurnDrink, clearTurnDrink} from './battle/items/turn-drink';
import {advanceSpeedDrink, clearSpeedDrink} from './battle/items/speed-drink';
import {advanceInvincibility, clearInvincibility} from './battle/items/invincibility';
import {advanceOpticalCamouflage, clearOpticalCamouflage} from './battle/items/optical-camouflage';
import {advanceRoleDisguise, clearRoleDisguise, restoreRoleDisguiseAfterAcceptedFire} from './battle/items/role-disguise';
import {setReady, changeWaitingTeam, voteRematch, prepareRematch, readyCpus} from './rooms/preparation';
import {advanceProjectiles} from './battle/projectiles';
import {createSceneObjects, damageSceneObject, syncSceneObjectCollision, resetSceneObjectCollision} from './battle/environment';
import {attachProjectileSceneResult} from './battle/projectile-scene-result';
import {createObjectives, advanceObjectives, damageObjective, objectiveEnd} from './modes/objectives';
import {resetBreachCollision, syncBreachCollision} from './battle/breach-collision';
import {applyRespawnProtection, advanceRespawnProtection, clearRespawnProtection} from './battle/respawn-protection';
import type {
  GroundItemAcquireContext,
  GroundItemDiscardContext,
  GroundItemDiscardResult,
} from './accounts/ground-items';
import type {MsgPlayerAction} from '../../shared/protocols';
import {roomSnapshot, playerSnapshot} from './rooms/snapshot';
import type {MsgRoomEvent} from '../../shared/protocols/MsgRoomEvent';
import {BATTLE_INTRO_MS} from '../../shared/combat/battle-start';
import type {
  MsgPlayerInput,
  MsgRoomSnapshot,
  RoomSummary,
  MatchResult,
  MapOption,
} from '../../shared/protocols';
import type {PlayerTitle} from '../../shared/protocols/MsgRoomSnapshot';
import {MAPS, type TankConfig} from './config';
import type {InventoryWireRecord} from '../../shared/protocols/PtlInventory';
import type {AccountInventory} from './account-store';
import type {BattleRoleSources} from './battle-role-sources';
import type {RoleOwnedSources} from './accounts/owned/receive-pair';
import type {RoleProfilePayload} from './accounts/profile/payload';
import type {KitbagAssignmentResult, KitbagCancellationResult} from './accounts/kitbag-configuration';
import {matchFinishMessage} from './settlement/match-result';
import {finishRound} from './settlement/finish-round';
import type {CommittedMatch, CommittedReceipt} from './settlement/history';
import {readResultRewardModifiers} from './settlement/reward-modifiers';
import type {ResultRewardModifiers} from './settlement/reward-modifiers';
import type {ResultAward} from '../../shared/protocols/MsgRoomSnapshot';
import {countShot} from './battle/round-statistics';

export type WorldEvent = MsgRoomEvent;

export type {JoinResult} from './rooms/state';

/** A participant removed while the round continued; frozen for the final settlement. */
interface DepartedParticipant {
  player: DepartedParticipantRecord;
  accountId?: string;
  /** Real frozen PLAYING time before this participant left; never extended by the surviving round. */
  elapsedSeconds?: number;
  /** Func19 selection captured before the departing participant's temporary sources are cleared. */
  rewardModifiers?: ResultRewardModifiers;
}

// Body radius and speed conversion remain prototype rules in native map units.
const BODY_RADIUS = 20;
const MOVE_SCALE = 6;

const DEFAULT_INPUT: MsgPlayerInput = {
  sequence: 0,
  move: 0,
  turn: 0,
  aim: 0,
  fire: false,
  useItem: 0,
  clientTime: 0,
};

export class World {
  private readonly rooms = new Map<string, RoomState>();
  private nextPlayerId = 1;
  private nextRoomId = 1;
  private nextBulletId = 1;
  private nextShotId = 1;
  /** Real configured tick interval, captured from the running world step. */
  private lastTickMs = 0;
  /** Mid-round ordinary departures, keyed by room then retired participant id; cleared at round end. */
  private readonly departedParticipants = new Map<string, Map<string, DepartedParticipant>>();
  /** Successful item uses for the current round, keyed by player then item table ID. */
  private readonly roundItemUses = new Map<string, Map<number, number>>();
  /** Last ordinary discard sequence accepted for the current round. */
  private readonly lastGroundItemActionSequence = new Map<string, number>();
  /** Live participants refreshed by a committed ground write, awaiting their inventoryChanged event. */
  private readonly pendingInventoryChanged = new Set<string>();

  constructor(private readonly now: () => number = Date.now,
              private readonly options: {timeLimitSeconds?: number; minPlayers?: number;
                consumeItem?: (playerId: string, instanceId: number, expectedOwned: number, itemTableId: number) => boolean;
                acquireOwnedItem?: (accountId: string, context: GroundItemAcquireContext) =>
                  InventoryWireRecord | undefined;
                discardOwnedItem?: (accountId: string, context: GroundItemDiscardContext) =>
                  GroundItemDiscardResult | undefined;
                resolveAccount?: (connectionId: string) => string | undefined;
                currentTitle?: (accountId: string) => PlayerTitle | undefined;
                onMatchCommitted?: (match: CommittedMatch) =>
                  ReadonlyMap<string, ResultAward> | void} = {}) {
    this.ensureDefaultRooms();
  }

  listRooms(): RoomSummary[] {
    return [...this.rooms.values()].map(room => ({
      id: room.roomId,
      name: room.roomName,
      mode: room.mode,
      mapId: room.map.mapId,
      playerCount: room.players.size,
      teamPlayerCounts: [0, 1].map(team => [...room.players.values()].filter(player => player.team === team).length),
      maxPlayers: roomMaxPlayers(room),
      minPlayers: this.minPlayers(room),
      friendlyFire: room.friendlyFire ?? false,
      phase: room.phase,
      hasPassword: !!room.passwordHash,
    }));
  }

  roomName(roomId: string): string {
    return this.rooms.get(roomId)?.roomName ?? '';
  }

  listMaps(): MapOption[] {
    return MAPS.map(map => ({mode: map.mode, mapId: map.mapId, name: map.name,
      timeLimit: map.timeLimit, sourceMinPlayers: map.sourceMinPlayers, maxPlayers: map.maxPlayers}));
  }

  createAndJoin(clientId: string, mode: number, mapId: number, roomName: string,
                name: string, tankId: number, password = '', minPlayers?: number, maxPlayers?: number, friendlyFire?: boolean): JoinResult {
    return createAndJoinRoom(this.rooms, {clientId, mode, mapId, roomName, name, tankId, password, minPlayers, maxPlayers, friendlyFire},
      limits => this.createRoom(mode, mapId, limits.minPlayers, limits.maxPlayers, limits.friendlyFire),
      room => this.joinRoom(room.roomId, clientId, name, tankId, password));
  }

  roomPlayers(roomId: string): {id: string; name: string; tankId: number}[] {
    const room = this.rooms.get(roomId);
    return room
      ? [...room.players.values()].map(player => ({id: player.id, name: player.name, tankId: player.tank.id}))
      : [];
  }

  quickMatch(clientId: string, name: string, tankId: number): JoinResult {
    return quickMatchRoom(this.rooms,
      () => this.createRoom(2 + (this.nextRoomId % 4), 2 + (this.nextRoomId % 10)),
      room => this.joinRoom(room.roomId, clientId, name, tankId));
  }

  joinRoom(roomId: string, clientId: string, name: string, tankId: number, password = ''): JoinResult {
    return admitRoomPlayer(this.rooms.get(roomId), clientId, password,
      room => this.insertPlayer(room, clientId, name, tankId));
  }

  private insertPlayer(room: RoomState, clientId: string, name: string, tankId: number): JoinResult {
    return insertRoomPlayer(this.rooms, room, clientId, name, tankId,
      () => `P${this.nextPlayerId++}`, id => {this.leave(id);}, DEFAULT_INPUT);
  }

  manageCpu(playerId: string, round: number, operation: ReqCpu['operation'], tankId = 1,
    cpuId?: string, loadout?: CpuLoadoutItem[], team?: number): string {
    const found = this.findPlayer(playerId);
    if (!found || found.room.round !== round || found.room.phase !== 'WAITING') {
      throw new Error('只能在当前等待房间管理CPU');
    }
    return manageRoomCpu(found.room, found.player, operation, tankId, cpuId,
      () => this.insertPlayer(found.room, `CPU:${this.nextPlayerId}`, `CPU ${this.nextPlayerId}`, tankId), loadout, team);
  }

  /** AI controls the same owned participant through ordinary inputs. */
  configureAutopilot(playerId: string, round: number, enabled: boolean): void {
    const found = this.findPlayer(playerId);
    if (!found || found.room.round !== round) {
      throw new Error('当前对局无法设置AI托管');
    }
    configureBattleAutopilot(found.room, found.player, enabled, DEFAULT_INPUT);
  }

  ready(playerId: string, round: number, isReady = true): number {
    const found = this.findPlayer(playerId);
    if (!found || round !== found.room.round) {
      throw new Error('对局已变化，请等待最新状态');
    }
    const {room} = found;
    if (setReady(room, playerId, isReady, this.minPlayers(room))) this.beginRoomLoading(room);
    return room.round;
  }

  resourcesLoaded(playerId: string, round: number): number {
    const found = this.findPlayer(playerId);
    if (!found || found.room.round !== round) throw new Error('对局已变化，请等待最新状态');
    const {room} = found;
    if (room.phase === 'PLAYING' && room.loaded.has(playerId)) return room.round;
    if (room.phase !== 'LOADING') throw new Error('当前房间未开始载入');
    room.loaded.add(playerId);
    if ([...room.players.keys()].every(id => room.loaded.has(id))) this.startRoom(room);
    return room.round;
  }

  changeTeam(playerId: string, round: number, team: number): number {
    const found = this.findPlayer(playerId);
    if (!found || found.room.round !== round || found.room.phase !== 'WAITING') {
      throw new Error('只能在当前等待房间换队');
    }
    const {room, player} = found;
    return changeWaitingTeam(room, player, team);
  }

  kickRoomPlayer(playerId: string, round: number, targetId: string): {roomId: string; events: WorldEvent[]} {
    const found = this.findPlayer(playerId);
    if (!found || found.room.round !== round || found.room.phase !== 'WAITING') {
      throw new Error('只能在当前等待房间踢出成员');
    }
    const {room, player} = found;
    if (player.cpu || room.creatorClientId !== player.clientId) throw new Error('只有房主可以踢出成员');
    if (targetId === playerId) throw new Error('不能踢出自己');
    if (!room.players.has(targetId)) throw new Error('该成员已离开房间');
    room.ready.clear();
    const events = this.leave(targetId);
    readyCpus(room);
    return {roomId: room.roomId, events};
  }

  editRoom(playerId: string, request: ReqEditRoom): number {
    const found = this.findPlayer(playerId);
    if (!found || found.room.round !== request.round || found.room.phase !== 'WAITING') {
      throw new Error('只能编辑当前等待房间');
    }
    if (found.player.cpu || found.room.creatorClientId !== found.player.clientId) {
      throw new Error('只有房主可以编辑房间');
    }
    editWaitingRoom(found.room, request);
    return found.room.round;
  }

  rematch(playerId: string, round: number): number {
    const found = this.findPlayer(playerId);
    if (!found || round !== found.room.round || found.room.phase !== 'FINISHED') {
      throw new Error('只有当前已结束的对局可以再战');
    }
    voteRematch(found.room, playerId);
    this.tryRematch(found.room);
    return found.room.round;
  }

  leave(playerId: string): WorldEvent[] {
    const found = this.findPlayer(playerId);
    if (!found) return [];
    const {room, player} = found;
    const rewardModifiers = this.freezeRewardModifiers(room.players.values());
    clearRespawnProtection(player);
    this.clearPlayerRoundState(playerId);
    clearAmmoRadarJam(player);
    clearCopiedRoleSkill(player.combat);
    clearPetHitSpeed(player, () => recomputeBattleAttributes(player));
    clearOpticalCamouflage(player, () => recomputeBattleAttributes(player));
    const events: WorldEvent[] = [];
    clearRoleDisguise(player, () => recomputeBattleAttributes(player), room.roomId, events);
    room.groundTraps = room.groundTraps.filter(trap => trap.ownerId !== playerId);
    room.airstrikes = room.airstrikes.filter(pending => pending.ownerId !== playerId);
    resetTrapRestraint(player);
    resetTrapTurnRestraint(player);
    resetTrapFireRestraint(player);
    events.push(...leaveRoomPlayer(this.rooms, room, player, this.minPlayers(room), {
      finish: outcome => this.finishRoom(room, this.now(), 'FORFEIT',
        outcome.winnerTeam, outcome.winnerPlayerId, events, rewardModifiers),
      departed: departed => this.captureDeparted(room, departed, rewardModifiers.get(departed.id)),
      create: mode => {this.createRoom(mode);},
      start: () => this.beginRoomLoading(room),
      rematch: () => this.tryRematch(room),
    }));
    if (!this.rooms.has(room.roomId)) {
      clearGroundItems(room);
      this.departedParticipants.delete(room.roomId);
    }
    return events;
  }

  /** Freeze a mid-round ordinary leaver's statistics and real account before removal. */
  private captureDeparted(room: RoomState, player: PlayerState,
    rewardModifiers?: ResultRewardModifiers): void {
    if (player.cpu) return;
    const accountId = this.options.resolveAccount?.(player.clientId);
    const frozen = {id: player.id, name: player.name, team: player.team, score: player.score,
      kills: player.kills, deaths: player.deaths, objectivesDestroyed: player.objectivesDestroyed,
      roundStats: player.roundStats ? {...player.roundStats} : undefined,
      playedSeconds: Math.max(0, (this.now() - room.startedAt) / 1000)};
    room.departedParticipants ??= new Map();
    room.departedParticipants.set(player.id, frozen);
    const byRoom = this.departedParticipants.get(room.roomId) ?? new Map();
    byRoom.set(player.id, {player: frozen, accountId,
      elapsedSeconds: frozen.playedSeconds, rewardModifiers});
    this.departedParticipants.set(room.roomId, byRoom);
  }

  /** Freeze each human participant's real Func19 selection before any leave/finish cleanup. */
  private freezeRewardModifiers(players: Iterable<PlayerState>):
    Map<string, ResultRewardModifiers> {
    const frozen = new Map<string, ResultRewardModifiers>();
    for (const player of players) {
      if (player.cpu) continue;
      frozen.set(player.id, this.selectedRewardModifiers(player));
    }
    return frozen;
  }

  /** Read Func19 only from this role's actual selected skill sources; catalog ownership alone grants nothing. */
  private selectedRewardModifiers(player: PlayerState): ResultRewardModifiers {
    const sources = battleSkillSources(player);
    const skillIds = sources
      ? selectRoleSkills(sources, combatSkills, combatItemSkills).map(skill => skill.skillId)
      : [];
    return {...readResultRewardModifiers(skillIds)};
  }

  /** Attach committed receipts to the still-live frozen result, by player id. */
  private attachResultAwards(room: RoomState, round: number, awards: ReadonlyMap<string, ResultAward>): void {
    if (room.phase !== 'FINISHED' || room.round !== round || !room.result) return;
    for (const player of room.result.players) {
      const award = awards.get(player.id);
      if (award) player.award = award;
    }
    // Refresh still-live participants' worn badge after a first or retried commit; the persisted
    // account title is authoritative and survives disconnect/mid-round leave.
    for (const [playerId, player] of room.players) {
      if (!awards.has(playerId)) continue;
      const accountId = this.options.resolveAccount?.(player.clientId);
      player.title = accountId ? this.options.currentTitle?.(accountId) : undefined;
    }
  }

  /** Publish successful retry receipts to any still-existing room; released rooms stay persisted only. */
  publishReceipts(receipts: readonly CommittedReceipt[]): void {
    for (const receipt of receipts) {
      const room = this.rooms.get(receipt.roomId);
      if (room) this.attachResultAwards(room, receipt.round, receipt.awards);
    }
  }

  /** Retired participants are settled once; drop their frozen bookkeeping when the round ends. */
  private releaseRoundFrozen(room: RoomState): void {
    room.departedParticipants = undefined;
    this.departedParticipants.delete(room.roomId);
  }

  /** Transport loss releases controls without changing the participant or round. */
  pauseDisconnectedPlayer(playerId: string): void {
    const found = this.findPlayer(playerId);
    if (!found) return;
    found.player.autopilot = undefined;
    found.player.autopilotInputSequence = 0;
    found.player.input = {...DEFAULT_INPUT, sequence: found.player.inputSequence};
  }

  restorePlayerConnection(playerId: string, connectionId: string): void {
    const found = this.findPlayer(playerId);
    if (!found) throw new Error('保留的角色已离开房间');
    if (found.room.creatorClientId === found.player.clientId) found.room.creatorClientId = connectionId;
    found.player.clientId = connectionId;
  }

  playerInputSequence(playerId: string): number {
    const found = this.findPlayer(playerId);
    if (!found) throw new Error('角色不存在');
    return found.player.inputSequence;
  }

  bindInventory(playerId: string, inventory: AccountInventory, cancelReady = false): void {
    const found = this.findPlayer(playerId);
    if (!found) throw new Error('角色不存在');
    bindBattleInventory(found.room, found.player, inventory);
    const accountId = this.accountForPlayer(playerId);
    if (accountId) {
      for (const record of found.player.inventory) {
        reconcileGroundItemInventory(found.player, record, this.groundItemCallbacks);
      }
    }
    if (cancelReady && found.room.phase === 'WAITING') found.room.ready.delete(playerId);
  }

  bindRoleSources(playerId: string, sources: RoleOwnedSources): void {
    const found = this.findPlayer(playerId);
    if (!found || !canBindBattleSources(found.room, found.player)) throw new Error('请在准备阶段配置角色来源');
    bindOwnedBattleSources(found.room, found.player, sources);
  }

  roleSources(playerId: string): RoleOwnedSources {
    const player = this.findPlayer(playerId)?.player;
    if (!player) throw new Error('角色不存在');
    return player.ownedRoles.snapshot();
  }

  bindEquipmentProfile(playerId: string, profile: RoleProfilePayload | undefined): void {
    const found = this.findPlayer(playerId);
    if (!found || !canBindBattleSources(found.room, found.player)) throw new Error('请在准备阶段配置装备来源');
    bindBattleEquipment(found.room, found.player, profile);
  }

  /** Project the authenticated account's current worn title onto the live participant. */
  bindTitle(playerId: string, title: PlayerTitle | undefined): void {
    const player = this.findPlayer(playerId)?.player;
    if (!player) throw new Error('角色不存在');
    player.title = title;
  }

  /** Refresh every live room role belonging to one authenticated account. */
  refreshAccountTitle(accountId: string, title: PlayerTitle | undefined): string[] {
    const affectedRooms = new Set<string>();
    for (const room of this.rooms.values()) {
      let changed = false;
      for (const player of room.players.values()) {
        if (player.cpu || this.options.resolveAccount?.(player.clientId) !== accountId) continue;
        player.title = title ? {...title} : undefined;
        changed = true;
      }
      if (changed) affectedRooms.add(room.roomId);
    }
    return [...affectedRooms];
  }

  roleAttributes(playerId: string): ReturnType<typeof battleAttributes> {
    const player = this.findPlayer(playerId)?.player;
    if (!player) throw new Error('角色不存在');
    return battleAttributes(player);
  }

  private playerMaxHp(player: PlayerState): number {
    if (player.lifeReady && player.recoveredMaxHp !== undefined) return player.recoveredMaxHp;
    return player.attributesReady ? player.attributes.record.maxHp : baseTankMaxHp(player.tank);
  }

  equipmentSources(playerId: string): ReturnType<BattleRoleSources['equipment']> {
    const player = this.findPlayer(playerId)?.player;
    if (!player) throw new Error('角色不存在');
    return player.ownedRoles.equipment();
  }

  battlePartSources(playerId: string): {tableIds: number[]; passiveSkillIds: number[]} {
    const player = this.findPlayer(playerId)?.player;
    if (!player) throw new Error('角色不存在');
    return battlePartSources(player);
  }

  roleSkillSources(playerId: string): ReturnType<typeof battleSkillSources> {
    const player = this.findPlayer(playerId)?.player;
    if (!player) throw new Error('角色不存在');
    return battleSkillSources(player);
  }

  roleSourceTables(playerId: string): ReturnType<BattleRoleSources['tables']> {
    const player = this.findPlayer(playerId)?.player;
    if (!player) throw new Error('角色不存在');
    return player.ownedRoles.tables();
  }

  inventory(playerId: string): AccountInventory {
    const player = this.findPlayer(playerId)?.player;
    if (!player) throw new Error('角色不存在');
    return battleInventory(player);
  }

  selectTank(playerId: string, tank: TankConfig): void {
    const found = this.findPlayer(playerId);
    if (!found || found.room.phase !== 'WAITING') throw new Error('请在准备阶段更换战车');
    selectBattleTank(found.room, found.player, tank);
  }

  canConfigureInventory(playerId: string): boolean {
    const found = this.findPlayer(playerId);
    return found !== undefined && found.room.phase === 'WAITING';
  }

  confirmKitbag(playerId: string, result: KitbagAssignmentResult | KitbagCancellationResult): void {
    const player = this.findPlayer(playerId)?.player;
    if (!player) throw new Error('角色不存在');
    confirmBattleKitbag(player, result);
  }

  updateInput(playerId: string, input: MsgPlayerInput, autonomous = false): WorldEvent[] {
    const found = this.findPlayer(playerId);
    if (!found) return [];
    const events = acceptBattleInput(found.room, found.player, input, autonomous,
      () => found.player.vip ? Math.max(1, found.room.map.vipHp) : this.playerMaxHp(found.player),
      this.consumeItem, this.now(), this.lastTickMs);
    for (const notice of [...events]) if (notice.itemUseRequest) {
      placeGroundTrap(found.room, found.player, notice.itemUseRequest, this.now(),
        () => `${found.room.roomId}:${found.room.round}:T${++this.nextGroundTrapId}`, this.consumeItem, events);
    }
    return events;
  }

  private nextGroundTrapId = 0;

  private roundItemUseCount(playerId: string, itemTableId: number): number {
    return this.roundItemUses.get(playerId)?.get(itemTableId >>> 0) ?? 0;
  }

  private recordRoundItemUse(playerId: string, itemTableId: number): void {
    const id = itemTableId >>> 0;
    let counts = this.roundItemUses.get(playerId);
    if (!counts) {
      counts = new Map();
      this.roundItemUses.set(playerId, counts);
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  private clearPlayerRoundState(playerId: string): void {
    this.roundItemUses.delete(playerId);
    this.lastGroundItemActionSequence.delete(playerId);
  }

  private readonly groundItemCallbacks: AcquireDiscardCallbacks = {
    roundUse: (playerId, itemTableId) => this.roundItemUseCount(playerId, itemTableId),
    acquire: request => this.acquireGroundItem(request),
    discard: request => this.discardGroundItem(request),
  };

  private accountForPlayer(playerId: string): string | undefined {
    const player = this.findPlayer(playerId)?.player;
    return player && !player.cpu ? this.options.resolveAccount?.(player.clientId) : undefined;
  }

  private accountAffectedRooms(accountId: string): string[] {
    const rooms = new Set<string>();
    for (const room of this.rooms.values()) {
      for (const player of room.players.values()) {
        if (!player.cpu && this.options.resolveAccount?.(player.clientId) === accountId) {
          rooms.add(room.roomId);
        }
      }
    }
    return [...rooms];
  }

  private syncGroundItemRecord(accountId: string, record: InventoryWireRecord): void {
    for (const playerId of this.accountPlayerIds(accountId)) {
      const player = this.findPlayer(playerId)?.player;
      if (!player) continue;
      reconcileGroundItemInventory(player, record, this.groundItemCallbacks);
      this.pendingInventoryChanged.add(playerId);
    }
  }

  /**
   * Emit one ordinary inventoryChanged event per participant refreshed by the committed
   * ground write. The event carries no account identity; the client re-queries its own
   * Inventory RPC. Callers own the transaction boundary and drain it before returning.
   */
  private drainInventoryChanged(events: WorldEvent[]): void {
    if (!this.pendingInventoryChanged.size) return;
    const playerIds = [...this.pendingInventoryChanged];
    this.pendingInventoryChanged.clear();
    for (const playerId of playerIds) {
      const found = this.findPlayer(playerId);
      if (!found) continue;
      events.push(event(found.room.roomId, 'inventoryChanged', '', found.player.id, found.player.id));
    }
  }

  private accountPlayerIds(accountId: string): string[] {
    const playerIds: string[] = [];
    for (const room of this.rooms.values()) {
      for (const player of room.players.values()) {
        if (!player.cpu && this.options.resolveAccount?.(player.clientId) === accountId) {
          playerIds.push(player.id);
        }
      }
    }
    return playerIds;
  }

  private acquireGroundItem(request: AcquireGroundItemRequest): {record: InventoryWireRecord} | undefined {
    const accountId = this.accountForPlayer(request.playerId);
    if (!accountId || !this.options.acquireOwnedItem) return undefined;
    const record = this.options.acquireOwnedItem(accountId, {
      roomId: request.roomId,
      round: request.round,
      groundId: request.groundId,
      itemTableId: request.itemTableId,
      quantity: request.quantity,
    });
    if (!record) return undefined;
    this.syncGroundItemRecord(accountId, record);
    return {record};
  }

  private discardGroundItem(request: DiscardGroundItemRequest): InventoryWireRecord | undefined {
    const found = this.findPlayer(request.playerId);
    const accountId = this.accountForPlayer(request.playerId);
    if (!found || !accountId || !this.options.discardOwnedItem) return undefined;
    const item = found.player.inventory.find(record =>
      (record.instanceId >>> 0) === (request.instanceId >>> 0)
      && (record.itemTableId >>> 0) === (request.itemTableId >>> 0)
      && (record.ownedQuantity >>> 0) === (request.expectedQuantity >>> 0));
    if (!item) return undefined;
    const result = this.options.discardOwnedItem(accountId, {
      roomId: request.roomId,
      round: request.round,
      groundId: request.groundId,
      instanceId: request.instanceId,
      expectedOwned: request.expectedQuantity,
      itemTableId: request.itemTableId,
      quantity: 1,
    });
    if (!result) return undefined;
    const record = result.deleted ? {...item, ownedQuantity: 0} : result.remaining;
    if (!record) return undefined;
    this.syncGroundItemRecord(accountId, record);
    return record;
  }

  private readonly consumeItem = (playerId: string, instanceId: number,
    expectedOwned: number, itemTableId: number): boolean => {
    const confirmed = confirmBattleItemConsumption(
      this.findPlayer(playerId)?.player, instanceId, expectedOwned, itemTableId, this.options.consumeItem);
    if (confirmed) {
      this.recordRoundItemUse(playerId, itemTableId);
      this.syncConsumedAccountRecord(playerId, instanceId, expectedOwned, itemTableId);
    }
    return confirmed;
  };

  private syncConsumedAccountRecord(playerId: string, instanceId: number,
    expectedOwned: number, itemTableId: number): void {
    const found = this.findPlayer(playerId);
    const accountId = this.accountForPlayer(playerId);
    const item = found?.player.inventory.find(record =>
      (record.instanceId >>> 0) === (instanceId >>> 0)
      && (record.itemTableId >>> 0) === (itemTableId >>> 0)
      && (record.ownedQuantity >>> 0) === (expectedOwned >>> 0));
    if (!accountId || !item || found?.player.cpu) return;
    const record = {...item, ownedQuantity: Math.max(0, (expectedOwned >>> 0) - 1)};
    for (const otherId of this.accountPlayerIds(accountId)) {
      if (otherId === playerId) continue;
      const other = this.findPlayer(otherId)?.player;
      if (other) reconcileGroundItemInventory(other, record, this.groundItemCallbacks);
    }
  }

  useAction(playerId: string, message: MsgPlayerAction): {events: WorldEvent[]; affectedRoomIds: string[]} | undefined {
    const found = this.findPlayer(playerId);
    const accountId = this.accountForPlayer(playerId);
    if (!found || !accountId || found.room.phase !== 'PLAYING'
        || message.roomId !== found.room.roomId || message.round !== found.room.round
        || this.now() < found.room.startedAt || found.player.autopilot) return undefined;
    if (!Number.isSafeInteger(message.sequence)
        || message.sequence <= (this.lastGroundItemActionSequence.get(playerId) ?? 0)) return undefined;
    // The ordinary sequence watermark is shared by all PlayerAction values. A request
    // that passes here is consumed even when the specific action has no production rule.
    this.lastGroundItemActionSequence.set(playerId, message.sequence);
    if (message.action !== 100 || !Number.isSafeInteger(message.value)
        || message.value <= 0 || message.value > 0xffffffff) {
      return {events: [], affectedRoomIds: []};
    }
    const hotkeys = found.player.combat.record?.arrays.get(0);
    let selected = false;
    if (hotkeys) {
      for (let slot = 0; slot < hotkeys.length; slot++) {
        if ((hotkeys[slot] >>> 0) === (message.value >>> 0)) {
          selected = true;
          break;
        }
      }
    }
    if (!selected) return {events: [], affectedRoomIds: []};
    const events: WorldEvent[] = [];
    const discarded = discardToGround(found.room, found.player, message.value >>> 0,
      this.now(), this.groundItemCallbacks, events);
    if (!discarded) return {events, affectedRoomIds: []};
    this.drainInventoryChanged(events);
    return {events, affectedRoomIds: this.accountAffectedRooms(accountId)};
  }

  chat(playerId: string, text: string, channel = 0): WorldEvent[] {
    const found = this.findPlayer(playerId);
    if (channel === 1 && (!found || ![1, 2, 3].includes(found.room.mode)
        || (found.player.team !== 0 && found.player.team !== 1))) return [];
    return found ? roomChat(found.room.roomId, found.player, text, channel) : [];
  }

  step(deltaMs: number): {snapshots: MsgRoomSnapshot[]; events: WorldEvent[]} {
    const snapshots: MsgRoomSnapshot[] = [];
    const events: WorldEvent[] = [];
    const now = this.now();
    this.lastTickMs = deltaMs;
    for (const room of this.rooms.values()) {
      if (room.phase === 'PLAYING') {
        room.tick += 1;
        // The intro is real wall time before the battle clock starts: the loop
        // below is skipped so human, CPU and autopilot participants all stay put.
        if (now >= room.startedAt) {
          // Expiry precedes simulation: no post-deadline movement, hit or respawn.
          if (now - room.startedAt >= this.timeLimit(room) * 1000) {
            const outcome = timeLimitOutcome(room);
            this.finishRoom(room, now, 'TIME_LIMIT',
              outcome.winnerTeam, outcome.winnerPlayerId, events);
            events.push(event(room.roomId, 'finish', this.finishMessage(room), ''));
          } else {
            // The first active tick only advances by the time elapsed since the
            // battle clock started, never by the preceding intro.
            const activeDeltaMs = Math.max(0, Math.min(deltaMs, now - room.startedAt));
            this.simulateRoom(room, activeDeltaMs / 1000, now, events);
          }
        }
      }
      snapshots.push(this.snapshotRoom(room, now));
    }
    // Pickups committed by advanceGroundItems during this tick: deliver the
    // ordinary inventoryChanged notices after every room snapshot is queued.
    this.drainInventoryChanged(events);
    return {snapshots, events};
  }

  snapshot(roomId: string): MsgRoomSnapshot | undefined {
    const room = this.rooms.get(roomId);
    return room ? this.snapshotRoom(room, this.now()) : undefined;
  }

  private ensureDefaultRooms(): void {
    ensureDefaultRooms(this.rooms, mode => {this.createRoom(mode);});
  }

  private createRoom(mode: number, mapId?: number, minPlayers?: number, maxPlayers?: number, friendlyFire = false): RoomState {
    const room = createWaitingRoom(mode, mapId, () => `R${this.nextRoomId++}`, minPlayers, maxPlayers, friendlyFire);
    this.rooms.set(room.roomId, room);
    return room;
  }

  private findPlayer(playerId: string): {room: RoomState; player: PlayerState} | undefined {
    for (const room of this.rooms.values()) {
      const player = room.players.get(playerId);
      if (player) {
        return {room, player};
      }
    }
    return undefined;
  }

  private simulateRoom(room: RoomState, dt: number, now: number, events: WorldEvent[]): void {
    const existingEnd = objectiveEnd(room);
    if (existingEnd) {
      this.finishObjective(room, now, existingEnd, events);
      return;
    }
    for (const player of room.players.values()) {
      advanceRespawnProtection(room.roomId, player, now, events);
    }
    for (const player of room.players.values()) {
      if (room.phase !== 'PLAYING') return;
      const death = advanceLastStandDeath(room, player,
        player.lastStand ? room.players.get(player.lastStand.attackerId) : undefined, now, events);
      if (death) this.commitPlayerDeath(room, player, death.attackerId, death.outcome, events);
    }
    if (room.phase !== 'PLAYING') return;
    const hitGroundSkill = (owner: PlayerState, target: PlayerState, damage: number, skillId: number) => {
      const wasAlive = target.alive;
      const hpBefore = target.hp;
      const outcome = damagePlayerDirectly(room, owner, target, damage, now, skillId, events);
      applyPetHitSpeed(target, owner, room.mode, hpBefore, now, () => recomputeBattleAttributes(target));
      if (wasAlive && !target.alive) this.commitPlayerDeath(room, target, owner.id, outcome, events);
    };
    const breachDropOnDestroy = (owner: PlayerState, target: PlayerState, now: number) => {
      if (room.mode !== 5) return;
      createBreachDrop(room, {
        id: target.sourcePlacementId ?? target.id,
        hp: target.hp,
        destroyedAt: target.destroyedAt,
        x: target.x,
        y: target.y,
        z: target.z,
      }, owner.id, now, Math.random, events);
    };
    advanceOldBombs(room, now, events, hitGroundSkill);
    if (room.phase !== 'PLAYING') return;
    advanceAirstrikes(room, now, events, hitGroundSkill);
    if (room.phase !== 'PLAYING') return;
    advanceContactMines(room, now, events, hitGroundSkill);
    if (room.phase !== 'PLAYING') return;
    advanceGroundTraps(room, now, events);
    if (room.phase !== 'PLAYING') return;
    const rebirth = advanceObjectives(room, now);
    syncBreachCollision(room, now);
    syncSceneObjectCollision(room, now);
    if (rebirth) {
      this.finishObjective(room, now, rebirth, events);
      return;
    }
    for (const player of room.players.values()) {
      advancePetHitSpeed(player, now, () => recomputeBattleAttributes(player));
      advanceDefenseDrink(room.roomId, player, now, () => recomputeBattleAttributes(player), events);
      advanceAttackDrink(room.roomId, player, now, () => recomputeBattleAttributes(player), events);
      advanceInvincibility(room.roomId, player, now, () => recomputeBattleAttributes(player), events);
      advanceOpticalCamouflage(room.roomId, player, now, () => recomputeBattleAttributes(player), events);
      advanceRoleDisguise(room.roomId, player, now, () => recomputeBattleAttributes(player), events);
      advanceSpeedDrink(room.roomId, player, now, () => recomputeBattleAttributes(player), events);
      advanceTurnDrink(room.roomId, player, now, () => recomputeBattleAttributes(player), events);
      advanceAmmoSlow(room.roomId, player, now, () => recomputeBattleAttributes(player), events);
      advanceAmmoRadarJam(room.roomId, player, now, events);
    }
    for (const target of room.players.values()) {
      if (room.phase !== 'PLAYING') break;
      advanceAmmoBurn(target, now, id => room.players.has(id), (ownerId, damage) => {
        const owner = room.players.get(ownerId)!;
        this.applyPlayerDamage(room, owner, target, damage, events, undefined, 4005);
      });
    }
    if (room.phase !== 'PLAYING') return;
    const resolveShotPlayerHit = (owner: PlayerState, target: PlayerState, damage: number,
      ammoItemId: number | undefined, shotId?: string, bearing?: {x: number; z: number}) => {
      if (!target.alive || room.phase !== 'PLAYING') return;
      const selector = roleHurtSelector(battleMovementPose(target).look, battleMovementPose(owner).look);
      const previousHp = target.hp;
      this.applyPlayerDamage(room, owner, target, damage, events, selector, undefined, ammoItemId,
        bearing ? {bodyYaw: target.bodyYaw ?? target.yaw, bearing} : undefined, shotId);
      if (room.phase === 'PLAYING' && ammoItemId === 2007 && target.alive && target.hp < previousHp) {
        startAmmoBurn(target, owner.id, now);
      }
      if (room.phase === 'PLAYING' && ammoItemId === 2008 && target.alive && target.hp < previousHp) {
        startAmmoSlow(room.roomId, target, now, () => recomputeBattleAttributes(target), events);
      }
      if (room.phase === 'PLAYING' && ammoItemId === 2010 && target.alive && target.hp > 0
          && target.hp < previousHp
          && owner.id !== target.id && !this.isAlly(room, owner, target)) {
        startAmmoRadarJam(room.roomId, target, now, events);
      }
    };
    advanceActors(room, dt, now, BODY_RADIUS, MOVE_SCALE, events, {
      respawn: player => {
        const spawn = findAvailableTankSpawn(room.battlefield, player.id, room.players.values());
        if (!spawn) return;
        clearCopiedRoleSkill(player.combat);
        clearPetHitSpeed(player, () => recomputeBattleAttributes(player));
        clearOpticalCamouflage(player, () => recomputeBattleAttributes(player));
        clearRoleDisguise(player, () => recomputeBattleAttributes(player));
        clearAmmoRadarJam(player);
        clearRespawnProtection(player);
        resetTrapRestraint(player);
        resetTrapTurnRestraint(player);
        resetTrapFireRestraint(player);
        respawnPlayer(room.battlefield, player, this.playerMaxHp(player), DEFAULT_INPUT, spawn);
        recomputeBattleAttributes(player);
        setBattleHealth(player, this.playerMaxHp(player), this.playerMaxHp(player));
        applyRespawnProtection(room.roomId, player, now, events);
        resetEquipmentSupply(player, now);
      },
      maxHp: player => player.vip ? Math.max(1, room.map.vipHp) : this.playerMaxHp(player),
      input: (id, input, autonomous) => this.updateInput(id, input, autonomous),
      allocateBulletId: () => `B${this.nextBulletId++}`,
      allocateShotId: () => `S${this.nextShotId++}`,
      staticObjects: player => plantContactColliders(room, player.id, events),
      beforeFire: player => {
        const accepted = consumeConfirmedAmmo(room.roomId, player, this.consumeItem, events);
        if (accepted) {
          restoreRoleDisguiseAfterAcceptedFire(room.roomId, player,
            () => recomputeBattleAttributes(player), events);
        }
        if (player.combat.dirty) recomputeBattleAttributes(player);
        return accepted;
      },
      fired: player => {
        countShot(player);
      },
      afterFire: player => {
        restoreRoleDisguiseAfterAcceptedFire(room.roomId, player,
          () => recomputeBattleAttributes(player), events);
      },
      hitSceneObject: (owner, targetId, damage, ammoItemId) => {
        if (ammoItemId === MEDICAL_AMMO_ID) return false;
        const firstEvent = events.length;
        const crush = room.sceneCrushes.find(object => object.id === targetId);
        if (crush) {
          if (ammoItemId !== 2001 || !acceptSceneCrush(room, owner.id, crush, events)) return false;
          this.attachShotItemResult(events, firstEvent, owner.id, ammoItemId);
          return true;
        }
        const target = room.sceneObjects.find(object => object.id === targetId && object.hp > 0);
        if (target) {
          damageSceneObject(room, owner, target, damage, now, events);
          if (room.phase === 'PLAYING') {
            const end = objectiveEnd(room);
            if (end) this.finishObjective(room, now, end, events);
          }
          this.attachShotItemResult(events, firstEvent, owner.id, ammoItemId);
          return true;
        }
        const objective = room.objectives.find(object => object.id === targetId && object.kind === 'DESTROY' && object.hp > 0);
        if (!objective) return false;
        damageObjective(room, owner, objective, damage, now, events);
        breachDropOnDestroy(owner, objective, now);
        if (room.phase === 'PLAYING') {
          const end = objectiveEnd(room);
          if (end) this.finishObjective(room, now, end, events);
        }
        this.attachShotItemResult(events, firstEvent, owner.id, ammoItemId);
        return true;
      },
      hitPlayer: (owner, targetId, damage, ammoItemId, shotId) => {
        const target = room.players.get(targetId);
        if (!target) return;
        resolveShotPlayerHit(owner, target, damage, ammoItemId, shotId,
          {x: owner.x - target.x, z: owner.z - target.z});
      },
    });
    if (room.phase !== 'PLAYING') return;
    advanceGroundItems(room, now, this.groundItemCallbacks, events);
    advanceProjectiles(room, dt, BODY_RADIUS, {
      hitPlayer: (owner, target, damage, ammoItemId, bearing, shotId) => {
        resolveShotPlayerHit(owner, target, damage, ammoItemId, shotId, bearing);
      },
      hitObjective: (owner, target, damage, ammoItemId) => {
        if (ammoItemId === MEDICAL_AMMO_ID) return;
        const firstEvent = events.length;
        damageObjective(room, owner, target, damage, now, events);
        breachDropOnDestroy(owner, target, now);
        if (room.phase === 'PLAYING') {
          const end = objectiveEnd(room);
          if (end) this.finishObjective(room, now, end, events);
        }
        attachProjectileSceneResult(events, firstEvent, owner.id, ammoItemId);
      },
      hitSceneObject: (owner, target, damage, ammoItemId) => {
        if (ammoItemId === MEDICAL_AMMO_ID) return;
        const firstEvent = events.length;
        damageSceneObject(room, owner, target, damage, now, events);
        if (room.phase === 'PLAYING') {
          const end = objectiveEnd(room);
          if (end) this.finishObjective(room, now, end, events);
        }
        attachProjectileSceneResult(events, firstEvent, owner.id, ammoItemId);
      },
      terrainHit: value => events.push(value),
    });
    if (room.phase !== 'PLAYING') return;
    advanceContactMines(room, now, events, hitGroundSkill);
    if (room.phase !== 'PLAYING') return;
    advanceGroundTraps(room, now, events);
    if (room.phase !== 'PLAYING') return;
    for (const player of room.players.values()) {
      advanceEquipmentSupply(room.roomId, room.phase, player, now,
        player.vip ? Math.max(1, room.map.vipHp) : this.playerMaxHp(player), events);
    }
  }

  /** Freeze an objective terminal at the exact hit/rebirth boundary. */
  private finishObjective(room: RoomState, now: number, end: import('./modes/objectives').ObjectiveEnd,
    events: MsgRoomEvent[]): void {
    const winnerPlayerId = end.winnerTeam < 0
      ? timeLimitOutcome(room).winnerPlayerId : end.winnerPlayerId;
    this.finishRoom(room, now, 'OBJECTIVE', end.winnerTeam, winnerPlayerId, events);
    events.push(event(room.roomId, 'finish', this.finishMessage(room), ''));
  }

  /** Source result display only follows the accepted scene shot which caused destruction. */
  private attachShotItemResult(events: MsgRoomEvent[], firstEvent: number, ownerId: string, itemId: number): void {
    if (itemId === 2002 || itemId === 2003 || itemId === 2004) {
      attachProjectileSceneResult(events, firstEvent, ownerId, itemId);
      return;
    }
    const shot = events[firstEvent - 1];
    if (shot?.type !== 'fire' || shot.playerId !== ownerId || shot.skillId !== itemId) return;
    if (!shot?.shotDisplay) return;
    for (const notice of events.slice(firstEvent)) {
      if (notice.type === 'sceneObjectDestroyed' || notice.type === 'objectiveDestroyed' || notice.type === 'sceneCrushed') {
        notice.shotItemResult = {...shot.shotDisplay};
      }
    }
  }

  /** One authority for shot and rebuilt periodic damage, including mode termination. */
  private applyPlayerDamage(room: RoomState, owner: PlayerState, target: PlayerState, damage: number,
    events: MsgRoomEvent[], selector?: number, skillId?: number, ammoItemId?: number,
    incidence?: {bodyYaw: number; bearing: {x: number; z: number}}, shotId?: string): void {
    if (resolveMedicalAmmo(room.roomId, owner, target, ammoItemId, events,
        this.isAlly(room, owner, target))) return;
    const wasAlive = target.alive;
    const hpBefore = target.hp;
    const firstEvent = events.length;
    const outcome = damagePlayer(room, owner, target, damage, this.now, events, selector, ammoItemId,
      incidence, shotId);
    applyPetHitSpeed(target, owner, room.mode, hpBefore, this.now(), () => recomputeBattleAttributes(target));
    if (skillId !== undefined) {
      for (const notice of events.slice(firstEvent)) if (notice.type === 'hit') notice.skillId = skillId;
    }
    if (ammoItemId !== undefined) {
      for (const notice of events.slice(firstEvent)) {
        if (notice.type === 'hit') notice.shotPlayerResult = {...notice.shotPlayerResult, itemId: ammoItemId};
      }
    }
    if (wasAlive && !target.alive) this.commitPlayerDeath(room, target, owner.id, outcome, events);
  }

  /** Real teams in modes1-3; modes4/5 are individual, so no other participant is an ally. */
  private isAlly(room: RoomState, owner: Pick<PlayerState, 'id' | 'team'>,
    target: Pick<PlayerState, 'id' | 'team'>): boolean {
    return room.mode <= 3 && owner.id !== target.id && owner.team === target.team;
  }

  private commitPlayerDeath(room: RoomState, target: PlayerState, attackerId: string,
    outcome: import('./modes/outcomes').ModeOutcome | undefined, events: MsgRoomEvent[]): void {
    const attacker = room.players.get(attackerId);
    clearRespawnProtection(target);
    clearAmmoRadarJam(target);
    clearPetHitSpeed(target, () => recomputeBattleAttributes(target));
    if (attacker) healPetAfterKill(room.roomId, attacker, target, room.mode, events);
    if (attacker && copyPassiveSkillAfterKill(attacker, target, room.mode)) recomputeBattleAttributes(attacker);
    if (clearCopiedRoleSkill(target.combat)) recomputeBattleAttributes(target);
    target.equipmentSupply = undefined;
    resetTrapRestraint(target);
    resetTrapTurnRestraint(target);
    resetTrapFireRestraint(target);
    clearDefenseDrink(target, () => recomputeBattleAttributes(target));
    clearAttackDrink(target, () => recomputeBattleAttributes(target));
    clearInvincibility(target, () => recomputeBattleAttributes(target));
    clearOpticalCamouflage(target, () => recomputeBattleAttributes(target));
    clearRoleDisguise(target, () => recomputeBattleAttributes(target), room.roomId, events);
    clearSpeedDrink(target, () => recomputeBattleAttributes(target));
    clearTurnDrink(target, () => recomputeBattleAttributes(target));
    clearAmmoSlow(target, () => recomputeBattleAttributes(target));
    if (outcome) {
      this.finishRoom(room, this.now(), 'OBJECTIVE', outcome.winnerTeam, outcome.winnerPlayerId, events);
      events.push(event(room.roomId, 'finish', this.finishMessage(room), attackerId));
    }
  }

  private minPlayers(room: RoomState): number {
    return this.options.minPlayers ?? roomMinPlayers(room);
  }

  private timeLimit(room: RoomState): number {
    return this.options.timeLimitSeconds ?? room.map.timeLimit;
  }

  private startRoom(room: RoomState): void {
    clearGroundTraps(room);
    clearGroundItems(room);
    room.airstrikes = [];
    resetBreachCollision(room.battlefield);
    resetSceneObjectCollision(room.battlefield);
    room.phase = 'PLAYING';
    room.startedAt = this.now() + BATTLE_INTRO_MS;
    room.endedAt = 0;
    room.tick = 0;
    const assignVip = initializeModeRound(room);
    room.winnerTeam = -1;
    room.result = undefined;
    this.releaseRoundFrozen(room);
    room.bullets = [];
    room.rematch.clear();
    initializeBattleParticipants(room.battlefield, room.players.values(), DEFAULT_INPUT,
      assignVip, player => player.vip ? Math.max(1, room.map.vipHp) : this.playerMaxHp(player), this.now);
    for (const player of room.players.values()) {
      clearAmmoRadarJam(player);
      const accountId = !player.cpu ? this.options.resolveAccount?.(player.clientId) : undefined;
      player.title = accountId ? this.options.currentTitle?.(accountId) : undefined;
      resetEquipmentSupply(player, room.startedAt);
    }
    room.objectives = createObjectives(room, BODY_RADIUS);
    room.sceneObjects = createSceneObjects(room);
    room.sceneCrushes = createSceneCrushes(room);
    room.scenePlants = createScenePlants(room);
    syncSceneObjectCollision(room, this.now());
    syncBreachCollision(room, this.now());
    this.ensureAvailableRoom(room.mode);
  }

  private ensureAvailableRoom(mode: number): void {
    ensureWaitingRoom(this.rooms, mode, value => {this.createRoom(value);});
  }

  private tryRematch(room: RoomState): void {
    if (prepareRematch(room, this.minPlayers(room))) this.beginRoomLoading(room);
  }

  private beginRoomLoading(room: RoomState): void {
    room.phase = 'LOADING';
    room.tick = 0;
    clearGroundItems(room);
    room.loaded.clear();
    for (const player of room.players.values()) {
      this.clearPlayerRoundState(player.id);
      clearRespawnProtection(player);
      clearAmmoRadarJam(player);
      player.input = {...DEFAULT_INPUT};
      if (player.cpu) room.loaded.add(player.id);
    }
    this.ensureAvailableRoom(room.mode);
  }

  private finishRoom(room: RoomState, now: number, reason: MatchResult['reason'],
                     winnerTeam?: number, winnerPlayerId?: string,
                     events: MsgRoomEvent[] = [],
                     frozenRewardModifiers?: ReadonlyMap<string, ResultRewardModifiers>): void {
    if (finishRound(room, now, reason, DEFAULT_INPUT, winnerTeam, winnerPlayerId)) {
      const rewardModifiers = frozenRewardModifiers
        ?? this.freezeRewardModifiers(room.players.values());
      clearGroundTraps(room);
      clearGroundItems(room);
      room.airstrikes = [];
      for (const player of room.players.values()) {
        clearRespawnProtection(player);
        player.combat.pendingShot = undefined;
        player.combat.specialFlag12 = 0;
        clearAmmoBurn(player);
        clearAmmoRadarJam(player);
        player.equipmentSupply = undefined;
        player.lastStand = undefined;
      }
      const committed = this.options.onMatchCommitted?.({roomId: room.roomId, mode: room.mode, mapId: room.map.mapId,
        result: {...room.result!, players: room.result!.players.map(player => ({...player,
          roundStats: player.roundStats ? {...player.roundStats} : undefined,
          awards: player.awards?.map(award => ({...award}))}))},
        participants: [
          ...[...room.players.values()].map(player => ({playerId: player.id,
            connectionId: player.clientId, cpu: !!player.cpu,
            elapsedSeconds: Math.max(0, (now - room.startedAt) / 1000),
            rewardModifiers: player.cpu ? undefined : {...rewardModifiers.get(player.id)!}})),
          ...[...this.departedParticipants.get(room.roomId)?.values() ?? []].map(departed =>
            ({playerId: departed.player.id, connectionId: '', cpu: false, accountId: departed.accountId,
              elapsedSeconds: departed.elapsedSeconds,
              rewardModifiers: departed.rewardModifiers
                ? {...departed.rewardModifiers} : undefined})),
        ]});
      // Attach the authoritative receipt only after the same-transaction write commits;
      // a failed or replayed commit leaves the frozen award absent.
      if (committed) this.attachResultAwards(room, room.round, committed);
      for (const player of room.players.values()) clearDefenseDrink(player, () => recomputeBattleAttributes(player));
      for (const player of room.players.values()) clearAttackDrink(player, () => recomputeBattleAttributes(player));
      for (const player of room.players.values()) clearInvincibility(player, () => recomputeBattleAttributes(player));
      for (const player of room.players.values()) clearOpticalCamouflage(player, () => recomputeBattleAttributes(player));
      for (const player of room.players.values()) clearRoleDisguise(player,
        () => recomputeBattleAttributes(player), room.roomId, events);
      for (const player of room.players.values()) clearSpeedDrink(player, () => recomputeBattleAttributes(player));
      for (const player of room.players.values()) clearPetHitSpeed(player, () => recomputeBattleAttributes(player));
      for (const player of room.players.values()) clearTurnDrink(player, () => recomputeBattleAttributes(player));
      for (const player of room.players.values()) clearAmmoSlow(player, () => recomputeBattleAttributes(player));
      this.releaseRoundFrozen(room);
      this.ensureAvailableRoom(room.mode);
    }
  }

  private finishMessage(room: RoomState): string {
    return matchFinishMessage(room.result, room.winnerTeam);
  }

  private snapshotRoom(room: RoomState, now: number): MsgRoomSnapshot {
    const combatTime = room.phase === 'FINISHED' ? room.endedAt : now;
    const battleActive = room.phase !== 'PLAYING' || now >= room.startedAt;
    return roomSnapshot(room, now, this.timeLimit(room), this.minPlayers(room),
      [...room.players.values()].map(player => playerSnapshot(player,
        player.vip ? Math.max(1, room.map.vipHp) : this.playerMaxHp(player),
        (combatTime - room.startedAt) / 1000, battleActive, now)));
  }

}


function event(
  roomId: string,
  type: string,
  message: string,
  playerId: string,
  targetId = '',
  value = 0,
  x = 0,
  y = 0,
  z = 0,
  skillId?: number,
): WorldEvent {
  return {roomId, type, message, playerId, targetId, value, x, y, z, skillId};
}
