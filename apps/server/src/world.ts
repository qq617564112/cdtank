import {resetTrapFireRestraint} from './battle/items/trap-fire-restraint';
import {advanceEquipmentSupply, resetEquipmentSupply} from './battle/items/equipment-supply';
import {resetTrapTurnRestraint} from './battle/items/trap-turn-restraint';
import {placeGroundTrap, advanceGroundTraps, clearGroundTraps} from './battle/items/ground-traps';
import {advanceOldBombs} from './battle/items/old-bomb';
import {advanceContactMines} from './battle/items/contact-mine';
import {advanceAirstrikes} from './battle/items/airstrike';
import {resetTrapRestraint} from './battle/items/trap-restraint';
import {createSceneCrushes, acceptSceneCrush} from './battle/scene-crush';
import {createScenePlants, plantContactColliders} from './battle/scene-plant-contact';
import {MEDICAL_AMMO_ID, resolveMedicalAmmo} from './battle/items/medical-ammo';
import {advanceAmmoBurn, clearAmmoBurn, startAmmoBurn} from './battle/items/ammo-burn';
import {advanceAmmoSlow, clearAmmoSlow, startAmmoSlow} from './battle/items/ammo-slow';
import {roomMaxPlayers, roomMinPlayers} from './rooms/player-limits';
import {separateBattleParticipants} from './battle/dynamic-movement';
import {battleAttributes, battlePartSources, battleSkillSources, battleInventory} from './battle/projection';
import {configureBattleAutopilot} from './battle/autopilot';
import {roomChat} from './rooms/chat';
import {canBindBattleSources, bindBattleInventory, bindOwnedBattleSources, bindBattleEquipment, selectBattleTank, confirmBattleKitbag} from './battle/preparation';
import {baseTankMaxHp} from './battle/create-player';
import {setBattleHealth} from './battle/health';
import {insertRoomPlayer} from './rooms/membership';
import {manageRoomCpu} from './rooms/cpu';
import {confirmBattleItemConsumption} from './battle/items/consumption';
import type {CpuLoadoutItem, ReqCpu} from '../../shared/protocols/PtlCpu';
import {leaveRoomPlayer} from './rooms/departure';
import {ensureDefaultRooms, ensureWaitingRoom} from './rooms/availability';
import {quickMatchRoom} from './rooms/quick-match';
import type {PlayerState} from './battle/player-state';
import type {RoomState, JoinResult} from './rooms/state';
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
import {setReady, changeWaitingTeam, voteRematch, prepareRematch} from './rooms/preparation';
import {advanceProjectiles} from './battle/projectiles';
import {createSceneObjects, damageSceneObject, syncSceneObjectCollision, resetSceneObjectCollision} from './battle/environment';
import {attachProjectileSceneResult} from './battle/projectile-scene-result';
import {createObjectives, advanceObjectives, damageObjective} from './modes/objectives';
import {resetBreachCollision, syncBreachCollision} from './battle/breach-collision';
import {roomSnapshot, playerSnapshot} from './rooms/snapshot';
import type {MsgRoomEvent} from '../../shared/protocols/MsgRoomEvent';
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
import type {MatchResultInput} from './settlement/match-result';
import type {CommittedMatch, CommittedReceipt} from './settlement/history';
import type {ResultAward} from '../../shared/protocols/MsgRoomSnapshot';

export type WorldEvent = MsgRoomEvent;

export type {JoinResult} from './rooms/state';

/** A participant removed while the round continued; frozen for the final settlement. */
interface DepartedParticipant {
  player: MatchResultInput['players'][number];
  accountId?: string;
  /** Real frozen PLAYING time before this participant left; never extended by the surviving round. */
  elapsedSeconds?: number;
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
  /** Real configured tick interval, captured from the running world step. */
  private lastTickMs = 0;
  /** Mid-round ordinary departures, keyed by room then retired participant id; cleared at round end. */
  private readonly departedParticipants = new Map<string, Map<string, DepartedParticipant>>();

  constructor(private readonly now: () => number = Date.now,
              private readonly options: {timeLimitSeconds?: number; minPlayers?: number;
                consumeItem?: (playerId: string, instanceId: number, expectedOwned: number, itemTableId: number) => boolean;
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
    cpuId?: string, loadout?: CpuLoadoutItem[]): string {
    const found = this.findPlayer(playerId);
    if (!found || found.room.round !== round || found.room.phase !== 'WAITING') {
      throw new Error('只能在当前等待房间管理CPU');
    }
    return manageRoomCpu(found.room, found.player, operation, tankId, cpuId,
      () => this.insertPlayer(found.room, `CPU:${this.nextPlayerId}`, `CPU ${this.nextPlayerId}`, tankId), loadout);
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
    if (setReady(room, playerId, isReady, this.minPlayers(room))) this.startRoom(room);
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
        outcome.winnerTeam, outcome.winnerPlayerId, events),
      departed: departed => this.captureDeparted(room, departed),
      create: mode => {this.createRoom(mode);},
      start: () => this.startRoom(room),
      rematch: () => this.tryRematch(room),
    }));
    if (!this.rooms.has(room.roomId)) this.departedParticipants.delete(room.roomId);
    return events;
  }

  /** Freeze a mid-round ordinary leaver's statistics and real account before removal. */
  private captureDeparted(room: RoomState, player: PlayerState): void {
    if (player.cpu) return;
    const accountId = this.options.resolveAccount?.(player.clientId);
    const frozen = {id: player.id, name: player.name, team: player.team, score: player.score,
      kills: player.kills, deaths: player.deaths, objectivesDestroyed: player.objectivesDestroyed};
    room.departedParticipants ??= new Map();
    room.departedParticipants.set(player.id, frozen);
    const byRoom = this.departedParticipants.get(room.roomId) ?? new Map();
    byRoom.set(player.id, {player: frozen, accountId,
      elapsedSeconds: Math.max(0, (this.now() - room.startedAt) / 1000)});
    this.departedParticipants.set(room.roomId, byRoom);
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

  private readonly consumeItem = (playerId: string, instanceId: number,
    expectedOwned: number, itemTableId: number): boolean => confirmBattleItemConsumption(
      this.findPlayer(playerId)?.player, instanceId, expectedOwned, itemTableId, this.options.consumeItem);

  useAction(playerId: string, action: number, value: number): WorldEvent[] {
    // Item and skill actions require recovered rules before they can affect scores.
    return [];
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
        // Expiry precedes simulation: no post-deadline movement, hit or respawn.
        if (now - room.startedAt >= this.timeLimit(room) * 1000) {
          this.finishRoom(room, now, 'TIME_LIMIT', undefined, undefined, events);
          events.push(event(room.roomId, 'finish', this.finishMessage(room), ''));
        } else {
          this.simulateRoom(room, deltaMs / 1000, now, events);
        }
      }
      snapshots.push(this.snapshotRoom(room, now));
    }
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
    advanceOldBombs(room, now, events, hitGroundSkill);
    if (room.phase !== 'PLAYING') return;
    advanceAirstrikes(room, now, events, hitGroundSkill);
    if (room.phase !== 'PLAYING') return;
    advanceContactMines(room, now, events, hitGroundSkill);
    if (room.phase !== 'PLAYING') return;
    advanceGroundTraps(room, now, events);
    syncBreachCollision(room, now);
    syncSceneObjectCollision(room, now);
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
      ammoItemId: number | undefined, bearing?: {x: number; z: number}) => {
      if (!target.alive || room.phase !== 'PLAYING') return;
      const selector = roleHurtSelector(battleMovementPose(target).look, battleMovementPose(owner).look);
      const previousHp = target.hp;
      this.applyPlayerDamage(room, owner, target, damage, events, selector, undefined, ammoItemId,
        bearing ? {bodyYaw: target.bodyYaw ?? target.yaw, bearing} : undefined);
      if (room.phase === 'PLAYING' && ammoItemId === 2007 && target.alive && target.hp < previousHp) {
        startAmmoBurn(target, owner.id, now);
      }
      if (room.phase === 'PLAYING' && ammoItemId === 2008 && target.alive && target.hp < previousHp) {
        startAmmoSlow(room.roomId, target, now, () => recomputeBattleAttributes(target), events);
      }
    };
    advanceActors(room, dt, now, BODY_RADIUS, MOVE_SCALE, events, {
      respawn: player => {
        clearCopiedRoleSkill(player.combat);
        clearPetHitSpeed(player, () => recomputeBattleAttributes(player));
        clearOpticalCamouflage(player, () => recomputeBattleAttributes(player));
        clearRoleDisguise(player, () => recomputeBattleAttributes(player));
        resetTrapRestraint(player);
        resetTrapTurnRestraint(player);
        resetTrapFireRestraint(player);
        respawnPlayer(room.battlefield, player, this.playerMaxHp(player), DEFAULT_INPUT);
        recomputeBattleAttributes(player);
        setBattleHealth(player, this.playerMaxHp(player), this.playerMaxHp(player));
        resetEquipmentSupply(player, now);
        separateBattleParticipants(room.players.values(), room.battlefield, this.now, player.id);
      },
      maxHp: player => player.vip ? Math.max(1, room.map.vipHp) : this.playerMaxHp(player),
      input: (id, input, autonomous) => this.updateInput(id, input, autonomous),
      allocateBulletId: () => `B${this.nextBulletId++}`,
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
      afterFire: player => {
        restoreRoleDisguiseAfterAcceptedFire(room.roomId, player,
          () => recomputeBattleAttributes(player), events);
      },
      hitSceneObject: (owner, targetId, damage) => {
        if (owner.combat.currentAmmoTableId === MEDICAL_AMMO_ID) return false;
        const firstEvent = events.length;
        const crush = room.sceneCrushes.find(object => object.id === targetId);
        if (crush) {
          if (owner.combat.currentAmmoTableId !== 2001 || !acceptSceneCrush(room, owner.id, crush, events)) return false;
          this.attachShotItemResult(events, firstEvent, owner.id, owner.combat.currentAmmoTableId);
          return true;
        }
        const target = room.sceneObjects.find(object => object.id === targetId && object.hp > 0);
        if (target) {
          damageSceneObject(room, owner, target, damage, now, events);
          this.attachShotItemResult(events, firstEvent, owner.id, owner.combat.currentAmmoTableId);
          return true;
        }
        const objective = room.objectives.find(object => object.id === targetId && object.kind === 'DESTROY' && object.hp > 0);
        if (!objective) return false;
        damageObjective(room, owner, objective, damage, now, events);
        this.attachShotItemResult(events, firstEvent, owner.id, owner.combat.currentAmmoTableId);
        return true;
      },
      hitPlayer: (owner, targetId, damage, ammoItemId) => {
        const target = room.players.get(targetId);
        if (!target) return;
        resolveShotPlayerHit(owner, target, damage, ammoItemId,
          {x: owner.x - target.x, z: owner.z - target.z});
      },
    });
    advanceProjectiles(room, dt, BODY_RADIUS, {
      hitPlayer: (owner, target, damage, ammoItemId, bearing) => {
        resolveShotPlayerHit(owner, target, damage, ammoItemId, bearing);
      },
      hitObjective: (owner, target, damage, ammoItemId) => {
        if (ammoItemId === MEDICAL_AMMO_ID) return;
        const firstEvent = events.length;
        damageObjective(room, owner, target, damage, now, events);
        attachProjectileSceneResult(events, firstEvent, owner.id, ammoItemId);
      },
      hitSceneObject: (owner, target, damage, ammoItemId) => {
        if (ammoItemId === MEDICAL_AMMO_ID) return;
        const firstEvent = events.length;
        damageSceneObject(room, owner, target, damage, now, events);
        attachProjectileSceneResult(events, firstEvent, owner.id, ammoItemId);
      },
      terrainHit: value => events.push(value),
    });
    advanceContactMines(room, now, events, hitGroundSkill);
    if (room.phase !== 'PLAYING') return;
    advanceGroundTraps(room, now, events);
    syncBreachCollision(room, now);
    syncSceneObjectCollision(room, now);
    if (room.phase !== 'PLAYING') return;
    for (const player of room.players.values()) {
      advanceEquipmentSupply(room.roomId, room.phase, player, now,
        player.vip ? Math.max(1, room.map.vipHp) : this.playerMaxHp(player), events);
    }
    if (advanceObjectives(room, dt)) {
      this.finishRoom(room, now, 'OBJECTIVE', undefined, undefined, events);
      events.push(event(room.roomId, 'finish', this.finishMessage(room), ''));
    }
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
    incidence?: {bodyYaw: number; bearing: {x: number; z: number}}): void {
    if (resolveMedicalAmmo(room.roomId, owner, target, ammoItemId, events)) return;
    const wasAlive = target.alive;
    const hpBefore = target.hp;
    const firstEvent = events.length;
    const outcome = damagePlayer(room, owner, target, damage, this.now, events, selector, ammoItemId, incidence);
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

  private commitPlayerDeath(room: RoomState, target: PlayerState, attackerId: string,
    outcome: import('./modes/outcomes').ModeOutcome | undefined, events: MsgRoomEvent[]): void {
    const attacker = room.players.get(attackerId);
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
    room.airstrikes = [];
    resetBreachCollision(room.battlefield);
    resetSceneObjectCollision(room.battlefield);
    room.phase = 'PLAYING';
    room.startedAt = this.now();
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
    for (const player of room.players.values()) resetEquipmentSupply(player, room.startedAt);
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
    if (prepareRematch(room, this.minPlayers(room))) this.startRoom(room);
  }

  private finishRoom(room: RoomState, now: number, reason: MatchResult['reason'],
                     winnerTeam?: number, winnerPlayerId?: string,
                     events: MsgRoomEvent[] = []): void {
    if (finishRound(room, now, reason, DEFAULT_INPUT, winnerTeam, winnerPlayerId)) {
      clearGroundTraps(room);
      room.airstrikes = [];
      for (const player of room.players.values()) {
        clearAmmoBurn(player);
        player.equipmentSupply = undefined;
        player.lastStand = undefined;
      }
      const committed = this.options.onMatchCommitted?.({roomId: room.roomId, mode: room.mode, mapId: room.map.mapId,
        result: {...room.result!, players: room.result!.players.map(player => ({...player}))},
        participants: [
          ...[...room.players.values()].map(player => ({playerId: player.id,
            connectionId: player.clientId, cpu: !!player.cpu,
            elapsedSeconds: Math.max(0, (now - room.startedAt) / 1000)})),
          ...[...this.departedParticipants.get(room.roomId)?.values() ?? []].map(departed =>
            ({playerId: departed.player.id, connectionId: '', cpu: false, accountId: departed.accountId,
              elapsedSeconds: departed.elapsedSeconds})),
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
    return roomSnapshot(room, now, this.timeLimit(room), this.minPlayers(room),
      [...room.players.values()].map(player => playerSnapshot(player,
        player.vip ? Math.max(1, room.map.vipHp) : this.playerMaxHp(player), (combatTime - room.startedAt) / 1000)));
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
