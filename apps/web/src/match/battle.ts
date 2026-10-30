import {pageImages} from '../assets/preload-images';
import {showGameMessage} from '../interface/resources/game-message-store';
import {itemHitHandler, gameContent} from '../../../shared/content/catalog';
import {loadCombatCatalog} from '../content';
import {prepareBattleDynamicResources} from './battle-resource-preload';
import type {ReqStackItemSale, ResStackItemSale} from '../../../shared/protocols/PtlStackItemSale';
import type {ReqValuableItemSale, ResValuableItemSale} from '../../../shared/protocols/PtlValuableItemSale';
import {loadStaticJson} from '../assets/static-resources';
import type {ReqPartSale, ResPartSale} from '../../../shared/protocols/PtlPartSale';
import type {ReqPartMaintenance, ResPartMaintenance} from '../../../shared/protocols/PtlPartMaintenance';
import {Trade} from '../network/trade';
import {ROOM_RECONNECT_WINDOW_MS} from '../../../shared/room-reconnection';
import {GroundTrapsPresentation} from '../assets/scenes/ground-traps-presentation';
import {GroundItemsPresentation} from '../assets/scenes/ground-items-presentation';
import {Blacklist} from '../network/blacklist';
import type {ReqShop} from '../../../shared/protocols/PtlShop';
import type {ReqTankShop} from '../../../shared/protocols/PtlTankShop';
import type {ReqPetShop} from '../../../shared/protocols/PtlPetShop';
import type {CpuLoadoutItem} from '../../../shared/protocols/PtlCpu';
import {configureBattleCamera} from '../render/battle-camera';
import {BattlePlayers} from '../render/battle-players';
import {setDynamicResolutionActive} from '../render/dynamic-resolution';
import {battleUiLayer} from '../render/battle-ui-layer';
import {battleInfoText} from '../interface/battle/battle-info-messages';
import {battleMinimapUrl} from '../assets/maps/minimaps';
import {BattleMinimapRenderer, type MobileMinimapBounds} from '../render/battle-minimap-renderer';
import {GameConnection} from '../network/game-connection';
import type {AccountContext} from '../network/accounts';
import {LobbyChat} from '../network/lobby-chat';
import {Family} from '../network/family';
import {Friends} from '../network/friends';
import {GmSupportInbox} from '../network/gm-support';
import {LobbyPresence} from '../network/lobby-presence';
import {ArcRotateCamera, Scene} from '@babylonjs/core';
import type {MsgRoomSnapshot, ObjectiveSnapshot, PlayerSnapshot, SceneObjectSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import type {MsgFamilyChat} from '../../../shared/protocols/MsgFamilyChat';
import type {MapOption, ResJoin, RoomSummary} from '../../../shared/protocols';
import {ScenePreview} from '../assets/scenes/scene-preview';
import {MapSceneEffects} from '../assets/scenes/map-scene-effects';
import {EffectRuntime} from '../render/effects/runtime/effect-runtime';
import {BattleHud} from '../interface/battle/battle-hud';
import {BattleMusic} from '../audio/battle-music';
import {PageMusic} from './page-music';
import {BattleSound} from '../audio/battle-sound';
import {cameraSpatialPose} from '../audio/spatial-listener';
import {BattleUiSound} from '../audio/battle-ui-sound';
import {setButtonSoundVolume} from '../audio/button-sound';
import {prepareBattleSummarySounds} from '../audio/battle-summary-sound';
import {MapEnvironmentSound} from '../audio/map-environment-sound';
import {BattleMatch} from '../interface/battle/battle-match';
import {BattleTargets} from '../render/battle-targets';
import {BattleChat} from '../interface/battle/battle-chat';
import type {ResInventory} from '../../../shared/protocols/PtlInventory';
import type {ReqKitbag, ResKitbag} from '../../../shared/protocols/PtlKitbag';
import type {ResOwnedRoles} from '../../../shared/protocols/PtlOwnedRoles';
import type {ResRoleProfile} from '../../../shared/protocols/PtlRoleProfile';
import type {ResPlayerProfile} from '../../../shared/protocols/PtlPlayerProfile';
import type {ResPlayerSearch} from '../../../shared/protocols/PtlPlayerSearch';
import type {ReqEquipment, ResEquipment} from '../../../shared/protocols/PtlEquipment';
import type {ReqSelectRole, ResSelectRole} from '../../../shared/protocols/PtlSelectRole';
import type {ReqTankTextures, ResTankTextures} from '../../../shared/protocols/PtlTankTextures';
import type {ReqPetSkillLearning, ResPetSkillLearning} from '../../../shared/protocols/PtlPetSkillLearning';
import type {ReqTankMaintenance, ResTankMaintenance} from '../../../shared/protocols/PtlTankMaintenance';
import type {ReqOwnedRoleSale, ResOwnedRoleSale} from '../../../shared/protocols/PtlOwnedRoleSale';
import type {ReqTankUpgrade, ResTankUpgrade} from '../../../shared/protocols/PtlTankUpgrade';
import type {LeavePenalty} from '../../../shared/protocols/PtlLeave';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import {createSkillEffectNotifications} from './skills/skill-effect-runtime';
import {battleRoleId, BattleSkillEffects} from './skills/battle-skill-effects';
import {TankShotDisplay} from '../assets/tanks/shot-display';
import {TankShotPlayerResult} from '../assets/tanks/shot-player-result';
import {TankShotItemResult} from '../assets/tanks/shot-item-result';
import {AmmoBurnPresentation} from '../assets/tanks/ammo-burn-presentation';
import {TankPetDeathPresentation} from '../assets/tanks/tank-pet-death-presentation';
import {RoomFeed} from './room-feed';
import {BattleInput, type BattleInputContext, type BattleMotionInput, type BattleTouchInput} from './battle-input';
import type {ClientTankPose} from '../../../shared/protocols/MsgPlayerInput';
import {LocalTankMotion} from './local-tank-motion';
import {BattleItemInventory} from './battle-item-inventory';
import {stepCandidate, WeaponCycleSelection, weaponCandidateSlots}
  from './battle-shortcut-selection';
import type {KeyBindings} from './input-bindings';
import type {QuickChatPreferences} from '../interface/settings/quick-chat-preferences';
import {battleIsActive} from '../../../shared/combat/battle-start';
import {GroundItemAction} from '../../../shared/protocols/MsgPlayerAction';
import {classifyInventoryCategory} from '../../../shared/combat/inventory-query';
import {BattleProjectiles} from '../render/battle-projectiles';
import {isMobileDevice} from '../platform/device';
import {TrainingSession} from '../training/session';
import {loadTrainingMaps} from '../training/simulation-host';
import type {TrainingOptions} from '../training/protocol';

const EMPTY_SCENE_OBJECTS: readonly SceneObjectSnapshot[] = [];
const NEUTRAL_MOTION: BattleMotionInput = {move: 0, turn: 0, aim: 0};

/** Presents snapshots and events from online rooms or the local training worker. */
export class Battle {
  readonly originalHud = new BattleHud();
  readonly itemInventory = new BattleItemInventory(() => this.inventory());
  private readonly music = new BattleMusic();
  private pageMusic?: PageMusic;
  private readonly sound = new BattleSound();
  private readonly battleUiSound = new BattleUiSound(() => this.soundVolume);
  private battleUiSoundContext?: string;
  private battleUiSoundResync = false;
  private lastDeathCountdown?: number;
  private lastIntroStage?: string;
  private readonly connection = new GameConnection();
  readonly lobbyChat = new LobbyChat(this.connection);
  readonly lobbyPresence = new LobbyPresence(this.connection);
  readonly family = new Family(this.connection);
  readonly trade = new Trade(this.connection);
  readonly friends = new Friends(this.connection);
  readonly blacklist = new Blacklist(this.connection);
  readonly gmSupport = new GmSupportInbox(this.connection);
  private readonly onFamilyChat = (message: MsgFamilyChat): void => {
    if (this.active && this.roomFeed.snapshot?.match) this.chat.receivedFamily(message);
  };
  private readonly client = this.connection.client;
  private readonly accounts = this.connection.accounts;
  private readonly rooms = this.connection.rooms;
  get accountContext(): AccountContext {return this.connection.accountContext;}
  subscribeAccountContext(listener: () => void): () => void {return this.connection.subscribeAccountContext(listener);}
  get valuableSaleRoomContext(): string {
    const snapshot = this.roomFeed.snapshot;
    return `${this.session}:${this.roomFeed.roomId ?? ''}:${snapshot?.match?.round ?? 0}:${snapshot?.phase ?? ''}`;
  }
  subscribeValuableSaleRoom(listener: () => void): () => void {
    this.saleContextListeners.add(listener);
    return () => {this.saleContextListeners.delete(listener);};
  }
  get hasSavedIdentity(): boolean {return this.connection.hasSavedIdentity;}
  authenticate(credentials?: import('../../../shared/protocols/PtlAccount').ReqAccount['credentials']) {
    if (this.inRoom) throw new Error('请先离开房间');
    return this.connection.authenticate(credentials);
  }
  channels(channelId?: string) {return this.connection.channels(channelId);}
  get ping() {return this.connection.ping;}
  disconnectAccount(): Promise<void> {
    if (this.inRoom) throw new Error('请先离开房间');
    this.lobbyPresence.stop();
    return this.connection.disconnect();
  }
  private readonly inputContext: BattleInputContext = {active: false, playing: false, connected: false, autopilot: false};
  private readonly motionAxes: BattleMotionInput = {move: 0, turn: 0, aim: 0};
  private readonly localPose: ClientTankPose = {round: 0, life: 0, x: 0, y: 0, z: 0, yaw: 0, bodyYaw: 0, aim: 0, command: 0};
  private readonly input = new BattleInput(() => {
    const snapshot = this.roomFeed.snapshot;
    let local: PlayerSnapshot | undefined;
    if (snapshot) {
      for (const player of snapshot.players) {
        if (player.id === this.playerId) {local = player; break;}
      }
    }
    const context = this.inputContext;
    context.active = this.active;
    context.playing = this.mapLoaded && this.loadedRound === snapshot?.match?.round
      && Boolean(local?.alive && snapshot && battleIsActive(snapshot, this.serverNow()));
    context.connected = this.isConnected && !this.reconnecting;
    context.autopilot = local?.isAutopilot ?? false;
    return context;
  }, message => {
    if (this.training) {
      this.training.input({type: 'input', input: {...message, pose: this.localMotion.reportedPose}});
      return;
    }
    const useItem = message.useItem;
    void this.client.sendMsg('PlayerInput', {...message, pose: this.localMotion.reportedPose})
      .then(result => {
        // A transport-level failure means the server never saw this request, so
        // any weapon-cycle intent it carried returns to the confirmed selection.
        if (!result.isSucc && useItem >= 1 && useItem <= 4) this.weaponCycle.reject();
      }, () => {
        if (useItem >= 1 && useItem <= 4) this.weaponCycle.reject();
      });
  }, {
    acceptSlot: slot => this.acceptSlot(slot),
    itemSlot: slot => this.directItemSlot(slot),
    currentItemSlot: () => this.currentItemSlot(),
    cycleWeapon: direction => this.cycleWeapon(direction),
    cycleItem: direction => this.cycleItem(direction),
    clearIntent: () => this.weaponCycle.returnToConfirmed(),
  });
  private readonly weaponCycle = new WeaponCycleSelection();
  private readonly localMotion = new LocalTankMotion(isMobileDevice());
  readonly chat: BattleChat = new BattleChat(async (text, channel, targetName) => {
    if (this.training) {
      this.chat.message(`[训练] ${text}`);
      return;
    }
    if (!this.active || !this.client.isConnected) throw new Error('连接已断开');
    if (channel === 4) {
      const generation = this.chat.getSnapshot().generation;
      const result = await this.client.callApi('RoomChat', {text, channel: 6});
      if (!result.isSucc) throw new Error(result.err.message);
      if (this.active && generation === this.chat.getSnapshot().generation) {
        this.chat.message(`[GM] ${battleInfoText(text)}`);
        this.chat.message(`[系统] ${battleInfoText(result.res.message)}`);
      }
    } else if (channel === 5) {
      const context = this.accountContext;
      await this.connection.ensureConnected();
      if (context !== this.accountContext || !context.identity) throw new Error('账户或连接已变化，请重新操作');
      const snapshot = this.roomFeed.snapshot;
      if (!snapshot?.match) throw new Error('请先加入房间');
      const result = await this.client.callApi('FamilyChat', {text, roomId: snapshot.roomId, round: snapshot.match.round});
      if (context !== this.accountContext || !this.active) throw new Error('账户或连接已变化，请重新操作');
      if (!result.isSucc) throw new Error(result.err.message);
    } else if (channel === 3) {
      const snapshot = this.roomFeed.snapshot;
      if (!snapshot?.match) throw new Error('请先加入房间');
      const result = await this.client.callApi('FriendChat', {text, roomId: snapshot.roomId, round: snapshot.match.round});
      if (!result.isSucc) throw new Error(result.err.message);
    } else if (channel === 2) {
      const snapshot = this.roomFeed.snapshot;
      if (!snapshot?.match) throw new Error('请先加入房间');
      await this.rooms.whisper({text, targetName: targetName ?? '', roomId: snapshot.roomId, round: snapshot.match.round});
    } else await this.rooms.chat(text, channel);
  }, () => {this.input.clear();}, this.family, listener => this.connection.subscribeAccountContext(listener),
    text => this.originalHud.announce(text));
  private readonly players: BattlePlayers;
  private readonly projectiles: BattleProjectiles;
  private readonly battlefield: ScenePreview;
  private readonly sceneClock = {now: 0, battleStartsAt: 0, objects: EMPTY_SCENE_OBJECTS};
  private readonly sceneObjects: (ObjectiveSnapshot | SceneObjectSnapshot)[] = [];
  private readonly minimapRenderer: BattleMinimapRenderer;
  private readonly groundTraps: GroundTrapsPresentation;
  private groundTrapError?: string;
  private readonly groundItems: GroundItemsPresentation;
  private groundItemError?: string;
  private readonly stopInventoryRefresh: () => void;
  private readonly effects: EffectRuntime;
  private readonly petDeath: TankPetDeathPresentation;
  private readonly sceneEffects: MapSceneEffects;
  private environmentSound?: MapEnvironmentSound;
  private soundVolume?: number;
  private skillEffects?: BattleSkillEffects;
  private shotDisplay?: TankShotDisplay;
  private shotPlayerResult?: TankShotPlayerResult;
  private shotItemResult?: TankShotItemResult;
  private ammoBurnPresentation?: AmmoBurnPresentation;
  private combatCatalog?: CombatCatalog;
  readonly matchPanel = new BattleMatch(() => this.returnToRoom(),
    isReady => this.ready(isReady), team => this.changeTeam(team),
    (operation, playerId, team) => this.manageCpu(operation, playerId, team), enabled => this.autopilot(enabled),
    points => this.exitRoom(points), () => this.inviteRoom(),
    (playerId, loadout) => this.configureCpuLoadout(playerId, loadout), () => this.retryBattleLoading(),
    {listMaps: async () => this.training ? loadTrainingMaps() : this.rooms.listMaps(),
      save: settings => this.editRoom(settings)}, playerId => this.kickRoomPlayer(playerId),
    () => this.soundVolume,
    {candidates: () => this.discardCandidates(), selected: () => this.discardSelectedInstance,
      setSelected: instanceId => this.setDiscardSelection(instanceId), discard: () => this.discardSelected()},
    () => this.quoteExitPenalty(), accountId => this.playerProfile(accountId));
  private readonly targets: BattleTargets;
  private readonly roomFeed: RoomFeed;
  private training?: TrainingSession;
  private playerId?: string;
  private active = false;
  private session = 0;
  private mapId?: number;
  private mapLoaded = false;
  private loadingRound?: number;
  private loadedRound?: number;
  private resourceRevision = 0;
  private snapshotRevision = 0;
  private readonly worldStateInterval = isMobileDevice() ? 100 : 0;
  private worldStatePublishedAt = -Infinity;
  private worldStateSnapshotJson?: string;
  private worldStateIdentityJson = '';
  private worldStateActionsJson = '';
  private worldStateRenderedPlayers = -1;
  private resultMusicRound?: number;
  private playingMusicRound?: number;
  private returnToLobby?: () => void;
  private exiting?: Promise<void>;
  private reconnecting = false;
  private recovery?: Promise<void>;
  private readonly saleContextListeners = new Set<() => void>();
  private publishValuableSaleRoom(): void {this.saleContextListeners.forEach(listener => listener());}

  constructor(private readonly scene: Scene, private readonly camera: ArcRotateCamera,
              private readonly hud: HTMLOutputElement) {
    this.battlefield = new ScenePreview(scene, camera);
    this.groundTraps = new GroundTrapsPresentation(scene);
    this.effects = new EffectRuntime(scene, camera);
    this.groundItems = new GroundItemsPresentation(scene, this.effects);
    this.petDeath = new TankPetDeathPresentation(this.effects);
    this.sceneEffects = new MapSceneEffects(this.effects);
    this.players = new BattlePlayers(scene, camera, {
      attach: view => {this.effects.attach(view);},
      detach: view => {this.effects.detach(view);},
      remove: id => {this.skillEffects?.remove(id);},
      revive: id => {this.skillEffects?.revive(id);},
      queuedParts: (id, skills, active) => this.skillEffects?.reconcileQueuedParts(id, skills, active) ?? false,
      petDeath: (view, petType, localView) => {this.petDeath.show(view, petType, localView);},
    });
    this.projectiles = new BattleProjectiles(scene);
    this.minimapRenderer = new BattleMinimapRenderer(scene, camera, id => this.players.get(id));
    this.targets = new BattleTargets(scene);
    this.roomFeed = new RoomFeed(this.client, {
      beforeSnapshot: (snapshot, previous) => {
        // Each participant keeps the frozen summary until they choose Continue.
        if (this.playerId && snapshot.phase === 'WAITING'
            && snapshot.match?.result?.players.some(player => player.id === this.playerId)
            && !snapshot.match.rematchPlayerIds.includes(this.playerId)) snapshot.phase = 'FINISHED';
        const local = snapshot.players.find(player => player.id === this.playerId);
        const previousLocal = previous?.players.find(player => player.id === this.playerId);
        if (snapshot.phase !== 'PLAYING' || snapshot.match?.round !== previous?.match?.round
            || !local?.alive || local.isAutopilot !== previousLocal?.isAutopilot) {
          this.input.clear();
          this.weaponCycle.reset();
        }
        if (snapshot.match?.round !== previous?.match?.round
            || (snapshot.phase === 'PLAYING' && previous?.phase === 'LOADING')) {
          this.skillEffects?.clear();
          this.effects.clearRoundEffects();
          this.players.resetRound(snapshot.players);
        }
        if (snapshot.roomId !== previous?.roomId || snapshot.match?.round !== previous?.match?.round) {
          this.battleUiSound.reset();
          this.battleUiSoundContext = undefined;
        }
        if (snapshot.phase === 'FINISHED' && previous?.phase !== 'FINISHED') {
          this.skillEffects?.clear();
        }
      },
      snapshot: snapshot => {this.reconcile(snapshot);},
      event: (event, snapshot) => {
        if (event.type === 'kicked' && event.targetId === this.playerId) {
          this.leave(false);
          this.returnToLobby?.();
          this.hud.value = event.message;
          showGameMessage(event.message, 'error');
          return;
        }
        this.itemInventory.event(event);
        this.originalHud.event(event);
        if (event.type === 'destroy' && event.killCombo !== undefined) {
          this.players.combo(event.playerId, event.killCombo);
        }
        const current = this.roomFeed.snapshot;
        const ammoBurnEnded = event.type === 'ammoBurnEnded' && event.playSkillEffect?.skillId === 4005
            && event.playSkillEffect.effectIndex === 1 && event.value !== undefined
            && current?.phase === 'PLAYING' && current.roomId === snapshot?.roomId
            && current.match?.round === snapshot?.match?.round;
        if (ammoBurnEnded) {
          this.ammoBurnPresentation?.end(event.targetId, event.value,
            `${snapshot.roomId}:${snapshot.match?.round ?? 0}`);
        }
        if (event.type !== 'ammoBurnEnded' || ammoBurnEnded) this.skillEffects?.event(event);
        // Ammo rejection carries the selected ammo table id; other itemRejected
        // reasons omit it. Drop any outstanding weapon-cycle intent so the next
        // cycle resumes from the real confirmed selection.
        if (event.type === 'itemRejected' && event.playerId === this.playerId
            && event.skillId !== undefined) this.weaponCycle.reject();
        if (event.type === 'chat') this.chat.message(event.message, false);
        if (snapshot && this.playerId) this.sound.event(event, snapshot, this.playerId);
        if (event.groundItemDropped || event.groundItemPickedUp || event.groundItemRemoved) {
          this.groundItems.event(event, this.playerId);
        }
        if (event.roleStyleChanged) {
          this.players.changeRoleStyle(event.roleStyleChanged.roleId, event.roleStyleChanged.style);
        }
        if (event.roleStyleRestored) {
          this.players.restoreRoleStyle(event.roleStyleRestored.roleId);
        }
        if (event.type === 'beforeShot') {
          const localRecoil = this.players.fire(event.playerId);
          if (event.playerId === this.playerId && localRecoil) this.effects.ordinaryFireCamera();
        }
        if (event.type === 'fire') {
          if (event.shotDisplay && !event.targetId) {
            const display = event.shotDisplay;
            // Scene impact particles start on the NAV floor beneath the endpoint.
            const ground = this.localMotion.field.navigation?.sample(display.x, display.z)?.height ?? 0;
            this.shotDisplay?.show({...display, y: ground});
          }
          if (event.playerId === this.playerId && this.active && this.mapLoaded
              && this.loadedRound === snapshot?.match?.round && snapshot?.phase === 'PLAYING'
              && this.isConnected && !this.reconnecting) {
            this.battleUiSound.play(72);
          }
        }
        if (event.type === 'shotImpact' && this.mapLoaded && !this.reconnecting) {
          this.effects.spawnShotImpact([event.x, event.y, event.z], event.value > 0);
          if (event.shotDisplay) {
            const display = event.shotDisplay;
            const ground = this.localMotion.field.navigation?.sample(display.x, display.z)?.height ?? 0;
            this.shotDisplay?.show({...display, y: ground});
          }
        }
        if (event.type === 'hit') {
          this.players.damage(event.targetId, event.value, event.targetId === this.playerId,
            event.shotPlayerResult?.critical === true);
        }
        if (event.type === 'hit' || event.type === 'playerHealed') {
          const victim = this.players.get(event.targetId);
          const hasRadarJamNotification = event.type === 'hit'
            && itemHitHandler(event.shotPlayerResult?.itemId) === 'radarJam'
            && event.playSkillEffect !== undefined
            && event.playSkillEffect?.skillId === gameContent().items.get(event.shotPlayerResult!.itemId)?.runtime.skillRoles.secondary
            && event.playSkillEffect.effectIndex === 0
            && event.playSkillEffect.roleId === battleRoleId(event.targetId);
          const hasExplosiveAmmoBlastNotification = event.type === 'hit'
            && itemHitHandler(event.shotPlayerResult?.itemId) === 'explosive';
          if (victim && event.shotPlayerResult && !hasRadarJamNotification
              && !hasExplosiveAmmoBlastNotification && (event.type === 'playerHealed' || event.value > 0)) {
            this.shotPlayerResult?.showPlayerResult(victim, event.shotPlayerResult.itemId,
              this.playerId ? this.players.get(this.playerId) : undefined);
          }
          if (event.type === 'hit' && event.hurtSelector !== undefined) {
            const localShake = this.players.hurt(event.targetId, event.hurtSelector);
            if (event.targetId === this.playerId && localShake) this.effects.ordinaryHurtCamera();
          }
        }
        if (event.type === 'sceneCrushed' && event.sceneCrush) {
          this.battlefield.crush(event.sceneCrush.placementId);
        }
        if (this.mapLoaded && !this.reconnecting &&
            (event.type === 'sceneObjectHit' || event.type === 'sceneObjectHealed') && event.castleDamage) {
          this.battlefield.damageCastle(event.castleDamage);
        }
        if (this.mapLoaded && !this.reconnecting &&
            event.type === 'sceneObjectHit' && !event.castleDamage) {
          const object = snapshot?.match?.sceneObjects?.find(value => value.id === event.targetId);
          if (object?.sourcePlacementId !== undefined) {
            this.battlefield.damageObject(object.sourcePlacementId, event.value,
              [event.x ?? object.x, event.y ?? object.y, event.z ?? object.z]);
          }
        }
        if (this.mapLoaded && !this.reconnecting &&
            event.type === 'sceneObjectDestroyed' && !event.targetId.startsWith('CASTLE:')) {
          const sourceId = snapshot?.match?.sceneObjects?.find(object => object.id === event.targetId)?.sourcePlacementId;
          if (sourceId !== undefined) this.battlefield.destroyObject(sourceId, this.effects);
        }
        if (this.mapLoaded && !this.reconnecting && event.type === 'objectiveDestroyed') {
          const sourceId = snapshot?.match?.objectives.find(object => object.id === event.targetId)?.sourcePlacementId;
          if (sourceId !== undefined) this.battlefield.destroyObject(sourceId, this.effects);
        }
        if (event.shotItemResult && snapshot && this.playerId) {
          const display = event.shotItemResult;
          const ground = this.localMotion.field.navigation?.sample(display.x, display.z)?.height ?? 0;
          const result = {...display, y: ground};
          this.shotItemResult?.show(result, event.playerId, this.playerId,
            () => this.sound.shotItemResult(event, snapshot, this.playerId!, result.itemId), false);
        }
      },
    });
    this.stopInventoryRefresh = this.itemInventory.subscribe(() => this.refreshDiscardSelection());
    this.client.flows.postDisconnectFlow.push(input => {
      if (this.training) return input;
      this.input.clear();
      this.chat.resetSession();
      if (this.active && !this.recovery) {
        this.originalHud.setConnected(false);
        this.input.stop();
        const recovery = this.recoverRoom();
        this.recovery = recovery;
        void recovery.finally(() => {if (this.recovery === recovery) this.recovery = undefined;});
      }
      return input;
    });
    this.client.listenMsg('FriendChat', message => {
      if (this.active) this.chat.receivedPrivate(message.message);
    });
    this.client.listenMsg('RoomWhisper', message => {
      if (this.active) this.chat.receivedPrivate(message.message);
    });
    this.client.listenMsg('LobbyWhisper', message => {
      if (this.active) this.chat.receivedPrivate(message.message);
    });
    this.client.listenMsg('FamilyChat', this.onFamilyChat);
    scene.onBeforeRenderObservable.add(() => {this.render();});
    scene.onDisposeObservable.addOnce(() => {
      this.training?.dispose();
      void this.connection.setTraining(false).catch(() => {});
      this.projectiles.dispose();
      this.stopInventoryRefresh();
      this.itemInventory.clear();
      this.sound.dispose();
      this.battleUiSound.dispose();
      if (this.pageMusic) this.pageMusic.dispose();
      else this.music.dispose();
      this.lobbyPresence.stop();
      this.client.unlistenMsg('FamilyChat', this.onFamilyChat);
      this.lobbyChat.dispose();
      this.chat.dispose();
      this.gmSupport.dispose();
      this.sceneEffects.clear();
      this.environmentSound?.dispose();
      this.environmentSound = undefined;
    });
  }

  startPageMusic(): void {
    if (this.pageMusic) return;
    this.pageMusic = new PageMusic(this.music, error => console.error('页面音乐载入失败', error));
    this.pageMusic.lobby();
  }

  async displayName(name?: string): Promise<string> {
    return this.accounts.displayName(name);
  }

  async inventory(): Promise<ResInventory> {
    if (this.training) return (await this.training.request({type: 'inventory'})).inventory!;
    return this.accounts.inventory();
  }

  async shop(request: ReqShop) {
    return this.accounts.shop(request);
  }

  async tankShop(request: ReqTankShop) {
    return this.accounts.tankShop(request);
  }

  async tankUpgrade(request: ReqTankUpgrade): Promise<ResTankUpgrade> {
    return this.accounts.tankUpgrade(request);
  }

  async petShop(request: ReqPetShop) {
    return this.accounts.petShop(request);
  }

  async history(offset = 0, limit = 20) {
    return this.accounts.history(offset, limit);
  }

  async ownedRoles(): Promise<ResOwnedRoles> {
    return this.accounts.ownedRoles();
  }

  async roleProfile(selectTitleId?: number): Promise<ResRoleProfile> {
    return this.accounts.roleProfile(selectTitleId);
  }

  async playerProfile(targetAccountId: string): Promise<ResPlayerProfile> {
    return this.accounts.playerProfile(targetAccountId);
  }

  async playerSearch(name: string): Promise<ResPlayerSearch> {
    return this.accounts.playerSearch(name);
  }

  async selectRole(request: ReqSelectRole): Promise<ResSelectRole> {
    return this.accounts.selectRole(request);
  }

  async configureTankTextures(request: ReqTankTextures): Promise<ResTankTextures> {
    return this.accounts.configureTankTextures(request);
  }

  async petSkillLearning(request: ReqPetSkillLearning, context = this.accountContext,
    isCurrent: (context: AccountContext) => boolean = candidate => candidate === this.accountContext): Promise<ResPetSkillLearning> {
    return this.accounts.petSkillLearning(request, context, isCurrent);
  }

  async stackItemSale(request: ReqStackItemSale): Promise<ResStackItemSale> {
    return this.accounts.stackItemSale(request);
  }

  async valuableItemSale(request: ReqValuableItemSale, context = this.accountContext,
    isCurrent: (context: AccountContext) => boolean = candidate => candidate === this.accountContext): Promise<ResValuableItemSale> {
    return this.accounts.valuableItemSale(request, context, isCurrent);
  }

  async partSale(request: ReqPartSale): Promise<ResPartSale> {
    return this.accounts.partSale(request);
  }

  async partMaintenance(request: ReqPartMaintenance): Promise<ResPartMaintenance> {
    return this.accounts.partMaintenance(request);
  }

  async tankMaintenance(request: ReqTankMaintenance): Promise<ResTankMaintenance> {
    return this.accounts.tankMaintenance(request);
  }

  async ownedRoleSale(request: ReqOwnedRoleSale): Promise<ResOwnedRoleSale> {
    return this.accounts.ownedRoleSale(request);
  }

  async equipment(request: ReqEquipment): Promise<ResEquipment> {
    return this.accounts.equipment(request);
  }

  async configureKitbag(request: ReqKitbag): Promise<ResKitbag> {
    return this.accounts.configureKitbag(request);
  }

  async listRooms(): Promise<RoomSummary[]> {return this.rooms.listRooms();}

  async listMaps(): Promise<MapOption[]> {
    const [online, local] = await Promise.allSettled([this.rooms.listMaps(), loadTrainingMaps()]);
    if (online.status === 'rejected' && local.status === 'rejected') throw online.reason;
    return [...(online.status === 'fulfilled' ? online.value : []),
      ...(local.status === 'fulfilled' ? local.value : [])];
  }

  async createRoom(mode: number, mapId: number, roomName: string, name: string, tankId: number, password = '',
                   minPlayers?: number, maxPlayers?: number, friendlyFire?: boolean,
                   timeLimitSeconds?: number): Promise<void> {
    if (mode === 6) {
      await this.createTrainingRoom({mapId, roomName, name, tankId, minPlayers, maxPlayers, timeLimitSeconds});
      return;
    }
    if (this.training) throw new Error('请先退出训练模式');
    const session = this.session;
    await this.connection.ensureConnected();
    const result = await this.rooms.create({mode, mapId, roomName, name, tankId, password,
      minPlayers, maxPlayers, friendlyFire, timeLimitSeconds});
    if (session !== this.session) return;
    if (!result.isSucc) throw new Error(result.err.message);
    await this.enter(result.res, session);
  }

  private async createTrainingRoom(options: TrainingOptions): Promise<void> {
    if (this.active || this.training) throw new Error('请先离开当前房间');
    const session = this.session;
    const training = new TrainingSession((snapshot, events) => {
      if (this.training !== training || !this.active) return;
      this.roomFeed.receive(snapshot);
      for (const event of events) this.roomFeed.receiveEvent(event);
    }, error => {
      if (this.training !== training) return;
      this.leave(false);
      this.returnToLobby?.();
      this.hud.value = error.message;
      showGameMessage(error.message, 'error');
    });
    this.training = training;
    try {
      await this.connection.setTraining(true);
      const {join} = await training.request({type: 'create', options});
      if (session !== this.session || this.training !== training) return;
      if (!join) throw new Error('训练房间创建失败');
      await this.enter(join, session);
    } catch (error) {
      if (this.training === training) {
        this.training = undefined;
        training.dispose();
        await this.connection.setTraining(false).catch(() => {});
      }
      throw error;
    }
  }

  /** Fill a normal team match and let the server control the account’s tank. */
  async startQuickMatch(mapId: 2 | 5 | 8, tankId: number, players: 10 | 12 = 10): Promise<void> {
    if (!this.active) await this.resumeSavedRoom();
    if (this.active) await this.exitRoom();
    const session = this.session;
    this.hud.value = '创建自动托管对局…';
    await this.createRoom(1, mapId, '自动托管对局', '坦克手', tankId, '', players, players);
    const waitFor = async (ready: () => boolean): Promise<boolean> => {
      const deadline = performance.now() + 60000;
      while (!ready()) {
        if (session !== this.session || !this.active) return false;
        if (performance.now() > deadline) throw new Error('等待自动托管对局超时，请重试');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return session === this.session && this.active;
    };
    if (!await waitFor(() => this.roomFeed.snapshot?.match?.round !== undefined)) return;
    const round = this.roomFeed.snapshot!.match!.round;
    for (let count = 0; count < players - 1; count++) {
      await this.rooms.cpu({round, operation: 'ADD', tankId});
      if (session !== this.session || !this.active) return;
    }
    if (!await waitFor(() => this.roomFeed.snapshot?.players.length === players)) return;
    await this.autopilot(true);
    if (!await waitFor(() => this.roomFeed.snapshot?.players
      .some(player => player.id === this.playerId && player.isAutopilot) === true)) return;
    await this.ready(true);
    await waitFor(() => this.roomFeed.snapshot?.phase !== 'WAITING');
  }

  async startCpuMatch(name: string, tankId: number): Promise<void> {
    const session = this.session;
    this.hud.value = '连接并创建 CPU 对局…';
    await this.createRoom(4, 7, 'CPU 对局', name, tankId);
    try {
      if (session !== this.session || !this.active) return;
      this.hud.value = '加入三名 CPU…';
      for (let count = 0; count < 3; count++) {
        await this.manageCpu('ADD');
        if (session !== this.session || !this.active) return;
      }
      const deadline = performance.now() + 60000;
      while (!this.roomFeed.snapshot || this.roomFeed.snapshot.players.length !== 4) {
        if (session !== this.session || !this.active) return;
        if (performance.now() > deadline) throw new Error('等待 CPU 加入超时，请重试');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      await this.ready(true);
    } catch (error) {
      this.leave();
      throw error;
    }
  }

  async join(roomId: string, name: string, tankId: number, password = ''): Promise<void> {
    if (this.training || this.active) throw new Error('请先离开当前房间');
    const session = this.session;
    await this.connection.ensureConnected();
    const result = await this.rooms.join({roomId, name, tankId, password, clientId: ''});
    if (session !== this.session) {
      return;
    }
    if (!result.isSucc) {
      throw new Error(result.err.message);
    }
    await this.enter(result.res, session);
  }

  async resumeSavedRoom(): Promise<boolean> {
    const session = this.session;
    await this.connection.ensureConnected();
    if (session !== this.session) return false;
    const result = await this.rooms.resume({});
    if (session !== this.session) return false;
    if (!result.isSucc) {
      if (result.err.code !== 'ROOM_RESUME_REJECTED') throw new Error(result.err.message);
      return false;
    }
    const snapshot = result.res.snapshot;
    if (!snapshot.roomInfo) throw new Error('房间信息不可用，请重试');
    await this.enter({playerId: result.res.playerId, serverTime: snapshot.serverTime,
      room: {id: snapshot.roomId, name: snapshot.roomInfo?.name ?? '', mode: snapshot.mode,
        mapId: snapshot.roomInfo.mapId, players: snapshot.players, round: snapshot.match?.round ?? 0, phase: snapshot.phase}}, session);
    this.input.resetSequence(result.res.inputSequence);
    this.roomFeed.receive(snapshot);
    return true;
  }

  private async enter(result: ResJoin, session: number): Promise<void> {
    if (session !== this.session) return;
    this.family.reset();
    this.roomFeed.enter(result.room.id);
    this.playerId = result.playerId;
    this.mapId = result.room.mapId;
    this.input.resetSequence();
    this.active = true;
    this.pageMusic?.room(result.room.phase ?? 'WAITING', result.room.mode, result.room.mapId);
    this.lobbyChat.setInRoom(true);
    this.lobbyPresence.setInRoom(true);
    this.hud.value = '等待房间快照…';
    if (!this.training) this.chat.show();
    this.input.start();
    this.publishValuableSaleRoom();
  }

  private async loadBattleResources(round: number): Promise<void> {
    const session = this.session;
    const revision = this.resourceRevision;
    const current = (): boolean => session === this.session && revision === this.resourceRevision && this.active
      && this.roomFeed.snapshot?.match?.round === round && this.roomFeed.snapshot?.phase !== 'WAITING';
    const progress = (value: number, status: string): void => {
      if (current()) this.matchPanel.setLoading(value, status);
    };
    try {
      progress(0, '正在载入战斗音效和特效…');
      if (!this.mapLoaded) {
        const snapshot = this.roomFeed.snapshot!;
        const [, , catalog] = await Promise.all([this.originalHud.load(), this.effects.load({snapshot, mapId: this.mapId!}),
          loadCombatCatalog()]);
        if (!current()) return;
        progress(0.15, '正在载入地图…');
        this.skillEffects = new BattleSkillEffects(createSkillEffectNotifications(this.effects, catalog, {
          role: roleId => this.players.get(`P${roleId}`),
          localRole: () => this.playerId ? this.players.get(this.playerId) : undefined,
        }));
        this.combatCatalog = catalog;
        this.shotDisplay = new TankShotDisplay(this.effects, catalog);
        this.shotPlayerResult = new TankShotPlayerResult(this.effects, catalog);
        this.shotItemResult = new TankShotItemResult(this.effects, catalog);
        this.ammoBurnPresentation = new AmmoBurnPresentation(this.effects, id => this.players.get(id));
        await this.battlefield.load(String(this.mapId).padStart(4, '0'), this.effects,
          (fraction, status) => progress(0.15 + fraction * 0.45, status));
        if (!current()) return;
        await this.localMotion.field.load(this.mapId!);
        if (current() && this.roomFeed.snapshot) {
          const snapshot = this.roomFeed.snapshot;
          this.battlefield.reconcileCrushes(snapshot.match?.sceneCrushes ?? [], snapshot.match?.round ?? 0);
          this.battlefield.reconcilePlants(snapshot.match?.scenePlants ?? [], snapshot.match?.round ?? 0);
        }
        if (!current()) {
          return;
        }
        progress(0.6, '正在载入场景声音和特效…');
        if (!this.environmentSound) {
          const context = this.effects.audioContext();
          if (!context) throw new Error('地图声音管理器未就绪');
          this.environmentSound = new MapEnvironmentSound(this.camera, context);
          if (this.soundVolume !== undefined) this.environmentSound.setVolume(this.soundVolume);
        }
        await this.environmentSound.load(this.mapId!);
        if (!current()) return;
        await this.sceneEffects.load(this.mapId!);
        if (!current()) return;
        this.effects.start();
        if (this.roomFeed.snapshot) {
          const snapshot = this.roomFeed.snapshot;
          this.battlefield.restoreObjects([
            ...(snapshot.match?.objectives ?? []), ...(snapshot.match?.sceneObjects ?? []),
          ], snapshot.match?.round ?? 0, snapshot.serverTime);
        }
        progress(0.65, '正在准备开火、战车声音和战场音乐…');
        await Promise.all([
          this.sound.start(),
          this.battleUiSound.load(),
          this.music.prepare(this.roomFeed.snapshot!.mode, this.mapId!),
          prepareBattleSummarySounds(this.effects.audioContext()!),
        ]);
        if (!current()) return;
        this.mapLoaded = true;
      } else {
        await this.effects.load({snapshot: this.roomFeed.snapshot!, mapId: this.mapId!});
        if (!current()) return;
      }
      progress(0.7, '正在载入道具、陷阱和掉落物…');
      await prepareBattleDynamicResources(this.roomFeed.snapshot!, fraction =>
        progress(0.7 + fraction * 0.1, '正在载入道具、陷阱和掉落物…'));
      if (!current()) return;
      progress(0.8, '正在载入各玩家战车…');
      if (this.roomFeed.snapshot) this.players.reconcile(this.roomFeed.snapshot.players, this.playerId, this.roomFeed.snapshot.mode);
      // A loading acknowledgement includes actors restored when joining a live round.
      const deadline = performance.now() + 60000;
      while (true) {
        if (!current()) return;
        const snapshot = this.roomFeed.snapshot!;
        const scope = `${snapshot.roomId}:${round}`;
        await Promise.all([
          this.groundTraps.reconcile(snapshot.phase === 'PLAYING' ? snapshot.match?.groundTraps ?? [] : [], scope),
          this.groundItems.reconcile(snapshot.match?.groundItems ?? [], scope, snapshot.phase === 'PLAYING', snapshot.tick),
        ]);
        if (!current()) return;
        if (this.players.loadingError) throw new Error(this.players.loadingError);
        if (this.players.resourcesReady) break;
        if (performance.now() > deadline) throw new Error('等待战车资源超时，请重试');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      progress(0.95, '正在准备战斗界面…');
      await pageImages.waitForBattleUi();
      if (!current()) return;
      progress(0.96, '正在准备画面…');
      await Promise.all([this.players.loadLabels(), this.minimapRenderer.load(this.originalHud.getSnapshot().data!)]);
      if (!current()) return;
      if (!this.minimapRenderer.hasMap(this.mapId!)) {
        const imageUrl = battleMinimapUrl(this.mapId!);
        if (!imageUrl) throw new Error(`地图 ${this.mapId} 小地图资源缺失`);
        await this.minimapRenderer.setMap(this.mapId!, imageUrl);
        if (!current()) return;
      }
      await this.scene.whenReadyAsync();
      if (!current()) return;
      configureBattleCamera(this.camera);
      this.loadedRound = round;
      progress(1, '载入完成，等待其他玩家…');
      if (this.roomFeed.snapshot?.phase === 'LOADING') await this.confirmResourcesLoaded(round);
    } catch (error) {
      if (!current()) return;
      this.matchPanel.setLoading(this.loadedRound === round ? 1 : 0, '对局资源载入失败',
        error instanceof Error ? error.message : String(error));
      this.hud.value = '对局资源载入失败，请返回房间后重新准备';
    }
  }

  private async confirmResourcesLoaded(round: number): Promise<void> {
    if (this.training) {
      await this.training.request({type: 'ready', request: {round, resourcesLoaded: true}});
      return;
    }
    if (this.reconnecting || !this.client.isConnected) return;
    await this.rooms.ready({round, resourcesLoaded: true});
  }

  private retryBattleLoading(): void {
    const snapshot = this.roomFeed.snapshot;
    if (!snapshot?.match || (snapshot.phase !== 'LOADING' && snapshot.phase !== 'PLAYING')) return;
    if (this.loadedRound === snapshot.match.round) {
      this.matchPanel.setLoading(1, snapshot.phase === 'LOADING' ? '载入完成，等待其他玩家…' : '载入完成');
      if (snapshot.phase !== 'LOADING') return;
      void this.confirmResourcesLoaded(snapshot.match.round).catch(error => {
        if (this.active && this.roomFeed.snapshot?.phase === 'LOADING') {
          this.matchPanel.setLoading(1, '载入完成，等待确认', error instanceof Error ? error.message : String(error));
        }
      });
      return;
    }
    this.clearCancelledLoading();
    this.loadingRound = snapshot.match.round;
    void this.loadBattleResources(snapshot.match.round);
  }

  private clearCancelledLoading(): void {
    this.projectiles.clear();
    this.minimapRenderer.clear();
    this.resourceRevision++;
    this.loadingRound = undefined;
    this.loadedRound = undefined;
    this.ammoBurnPresentation?.clear();
    this.ammoBurnPresentation = undefined;
    this.sound.stop();
    this.battleUiSound.stop();
    this.environmentSound?.clear();
    this.sceneEffects.clear();
    this.skillEffects?.clear();
    this.skillEffects = undefined;
    this.shotDisplay = undefined;
    this.shotPlayerResult = undefined;
    this.shotItemResult = undefined;
    this.effects.stop();
    this.players.clear();
    this.localMotion.clear();
    this.effects.clear();
    this.battlefield.clear();
    battleUiLayer(this.scene).clear();
    this.sceneClock.objects = EMPTY_SCENE_OBJECTS;
    this.sceneObjects.length = 0;
    this.clearWorldStateCache();
    this.groundTraps.clear();
    this.groundTrapError = undefined;
    this.groundItems.clear();
    this.groundItemError = undefined;
    this.targets.clear();
    this.originalHud.clear();
    this.mapLoaded = false;
    this.matchPanel.setLoading(0, '正在载入战斗资源…');
  }

  get inRoom(): boolean {return this.active;}
  get isTraining(): boolean {return !!this.training;}
  get roomId(): string | undefined {return this.roomFeed.roomId;}

  setRoomExitHandler(handler?: () => void): void {this.returnToLobby = handler;}

  onRoomInvitation(handler: (message: import('../../../shared/protocols/MsgRoomInvitation').MsgRoomInvitation) => void): () => void {
    const listener = (message: import('../../../shared/protocols/MsgRoomInvitation').MsgRoomInvitation): void => {
      if (!this.active && !this.training) handler(message);
    };
    this.client.listenMsg('RoomInvitation', listener);
    return () => {this.client.unlistenMsg('RoomInvitation', listener);};
  }

  private async inviteRoom(): Promise<number> {
    if (this.training) throw new Error('训练模式不能邀请玩家');
    const snapshot = this.roomFeed.snapshot;
    if (!this.active || !snapshot?.match) throw new Error('请先加入房间');
    const result = await this.rooms.invite({roomId:snapshot.roomId,round:snapshot.match.round});
    return result.expiresAt;
  }

  private async recoverRoom(): Promise<void> {
    const session = this.session, roomId = this.roomFeed.roomId, playerId = this.playerId;
    if (!roomId || !playerId) return;
    this.battleUiSoundResync = true;
    this.reconnecting = true;
    const deadline = performance.now() + ROOM_RECONNECT_WINDOW_MS;
    this.hud.value = '连接已断开，正在恢复原房间…';
    showGameMessage(this.hud.value, 'pending');
    while (session === this.session && this.active && performance.now() < deadline) {
      try {
        await this.connection.ensureConnected();
        if (session !== this.session || !this.active) return;
        const result = await this.rooms.resume({roomId, playerId});
        if (session !== this.session || !this.active) return;
        if (!result.isSucc) {
          if (result.err.code === 'ROOM_RESUME_REJECTED') break;
          throw new Error(result.err.message);
        }
        this.input.clear();
        this.input.resetSequence(result.res.inputSequence);
        this.roomFeed.receive(result.res.snapshot);
        const snapshot = this.roomFeed.snapshot;
        if (snapshot) {
          this.localMotion.resetPrediction();
          this.localMotion.synchronize(snapshot, playerId);
          this.battlefield.restoreObjects([
            ...(snapshot.match?.objectives ?? []), ...(snapshot.match?.sceneObjects ?? []),
          ], snapshot.match?.round ?? 0, snapshot.serverTime);
        }
        this.reconnecting = false;
        this.originalHud.setConnected(true);
        if (snapshot?.phase === 'LOADING' && snapshot.match?.round === this.loadedRound) {
          await this.confirmResourcesLoaded(this.loadedRound!);
        }
        this.input.start();
        return;
      } catch {
        if (session !== this.session || !this.active) return;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    if (session === this.session && this.active) {
      this.leave(false);
      this.returnToLobby?.();
      this.hud.value = '原房间保留已结束，请重新加入';
      showGameMessage(this.hud.value, 'error');
    }
  }

  async quoteExitPenalty(): Promise<LeavePenalty> {
    if (this.training) return {count: 0, points: 0};
    await this.recovery;
    const session = this.session;
    if (!this.active || !this.client.isConnected) throw new Error('连接已断开');
    const snapshot = this.roomFeed.snapshot;
    if (!snapshot?.match) throw new Error('等待房间状态后重试');
    const roomId = snapshot.roomId, round = snapshot.match.round;
    const penalty = await this.rooms.quoteExitPenalty({roomId, round});
    const current = this.roomFeed.snapshot;
    if (session !== this.session || !this.active || current?.roomId !== roomId
        || current.match?.round !== round) {
      throw new Error('房间或局号已变化，请刷新后重试');
    }
    return penalty;
  }

  exitRoom(confirmedPenaltyPoints = 0): Promise<void> {
    if (this.exiting) return this.exiting;
    if (this.training) {
      const training = this.training;
      this.exiting = (async () => {
        await this.connection.setTraining(false);
        if (this.training !== training) return;
        this.leave(false);
        this.returnToLobby?.();
      })().finally(() => {this.exiting = undefined;});
      return this.exiting;
    }
    const session = this.session;
    const expectedRoomId = this.roomFeed.snapshot?.roomId;
    const expectedRound = this.roomFeed.snapshot?.match?.round;
    const exit = async () => {
      await this.recovery;
      if (session !== this.session) throw new Error('退出确认已失效，请重新确认');
      if (this.active && this.client.isConnected) {
        const snapshot = this.roomFeed.snapshot;
        if (!snapshot?.match) throw new Error('等待房间状态后重试');
        if (snapshot.roomId !== expectedRoomId || snapshot.match.round !== expectedRound) {
          throw new Error('房间或局号已变化，请刷新后重试');
        }
        if (confirmedPenaltyPoints !== 0
            && !this.matchPanel.matchesExitQuote(snapshot.roomId, snapshot.match.round, confirmedPenaltyPoints)) {
          throw new Error('退出处罚确认已失效，请重新报价');
        }
        await this.rooms.leave({roomId: snapshot.roomId, round: snapshot.match.round, confirmedPenaltyPoints});
      }
      if (session !== this.session) return;
      this.leave(!this.client.isConnected);
      this.returnToLobby?.();
    };
    this.exiting = exit().finally(() => {this.exiting = undefined;});
    return this.exiting;
  }

  leave(disconnect = true): void {
    if (this.training) {
      this.training.dispose();
      this.training = undefined;
      disconnect = false;
      void this.connection.setTraining(false).catch(() => {});
    }
    this.projectiles.clear();
    this.minimapRenderer.clear();
    this.resourceRevision++;
    this.loadingRound = undefined;
    this.loadedRound = undefined;
    this.active = false;
    this.reconnecting = false;
    this.resultMusicRound = undefined;
    this.playingMusicRound = undefined;
    this.itemInventory.clear();
    this.weaponCycle.reset();
    this.discardSelection = undefined;
    this.ammoBurnPresentation?.clear();
    this.ammoBurnPresentation = undefined;
    this.lobbyChat.setInRoom(false);
    this.lobbyPresence.setInRoom(false);
    if (this.pageMusic) this.pageMusic.lobby();
    else this.music.stop();
    this.sound.stop();
    this.battleUiSound.stop();
    this.environmentSound?.clear();
    this.sceneEffects.clear();
    this.skillEffects?.clear();
    this.skillEffects = undefined;
    this.shotDisplay = undefined;
    this.shotPlayerResult = undefined;
    this.shotItemResult = undefined;
    this.effects.stop();
    this.session++;
    this.roomFeed.clear();
    this.playerId = undefined;
    this.input.clear();
    this.input.stop();
    if (disconnect) void this.connection.disconnect();
    this.players.clear();
    this.localMotion.clear();
    this.effects.clear();
    this.battlefield.clear();
    battleUiLayer(this.scene).clear();
    this.sceneClock.objects = EMPTY_SCENE_OBJECTS;
    this.sceneObjects.length = 0;
    this.clearWorldStateCache();
    this.groundTraps.clear();
    this.groundTrapError = undefined;
    this.groundItems.clear();
    this.groundItemError = undefined;
    this.mapLoaded = false;
    this.mapId = undefined;
    this.originalHud.clear();
    this.matchPanel.clear();
    this.chat.clear();
    this.targets.clear();
    this.hud.value = '';
    delete this.hud.dataset.world;
    this.worldStatePublishedAt = -Infinity;
    this.publishValuableSaleRoom();
  }

  get isConnected(): boolean {return !!this.training || this.client.isConnected;}

  setMusicVolume(volume: number): void {
    this.music.setVolume(volume);
  }

  getKeyBindings(): KeyBindings {return this.input.getKeyBindings();}
  setKeyBindings(bindings: KeyBindings): void {this.input.setKeyBindings(bindings);}
  readonly setTouchInput = (patch: Partial<BattleTouchInput>): void => {this.input.setTouch(patch);};
  readonly clearTouchInput = (): void => {this.input.clearTouch();};
  readonly setMobileMinimapBounds = (bounds: MobileMinimapBounds | undefined): void => {
    this.minimapRenderer.setMobileBounds(bounds);
  };
  readonly useHudSlot = (slot: number): void => {
    const snapshot = this.roomFeed.snapshot;
    const local = snapshot?.players.find(player => player.id === this.playerId);
    if (!this.active || !snapshot || !battleIsActive(snapshot, this.serverNow())
        || !this.isConnected || this.reconnecting || !local?.alive || local.isAutopilot) return;
    this.directItemSlot(slot);
    this.input.send(slot);
  };

  /** Single quantity gate for every slot request before it is sent. A confirmed
   * Inventory record at this round's count 0, or a locally remembered configured
   * item whose last instance was removed, plays UI28 and rejects the request;
   * unknown records and empty bindings stay silent. Accepted requests keep the
   * confirmed item cursor and discard candidate selection. */
  private acceptSlot(slot: number): boolean {
    if (slot >= 5) {
      const configured = this.itemInventory.configuredItemSlot(slot);
      if (configured?.cleared || (configured?.record
          && (configured.record.battleQuantity >>> 0) === 0)) {
        this.battleUiSound.play(28);
        return false;
      }
    } else if (slot >= 2) {
      const inventory = this.itemInventory.getSnapshot().inventory;
      const instanceId = (inventory?.hotkeys[slot - 2] ?? 0) >>> 0;
      const record = instanceId
        ? inventory?.records.find(value => (value.instanceId >>> 0) === instanceId) : undefined;
      if (record && (record.battleQuantity >>> 0) === 0) {
        this.battleUiSound.play(28);
        return false;
      }
    }
    this.useItemSlot(slot);
    return true;
  }

  /** Reflect an accepted Battle slot5–8 request: select the confirmed discard
   * candidate for item slots and move the local item cursor. */
  private useItemSlot(slot: number): void {
    this.itemInventory.setSelectedItemSlot(slot);
    const instanceId = slot >= 2 ? this.itemInventory.getSnapshot().inventory?.hotkeys[slot - 2] : undefined;
    if (instanceId && this.discardCandidates().some(candidate => candidate.instanceId === instanceId)) {
      this.discardSelection = instanceId;
    }
  }

  /** Reflect a direct Battle slot1–8 press. Item slots only move the local
   * cursor for a confirmed usable instance; weapon slots drop any cycling
   * intent so the next cycle follows the server-confirmed baseline. */
  private directItemSlot(slot: number): void {
    this.useItemSlot(slot);
    if (slot >= 1 && slot <= 4) this.weaponCycle.returnToConfirmed();
  }

  /** Cursor for the ordinary useItem key, resolved against configured item slots.
   * An exhausted bound slot still reaches the unified gate, which plays UI28 and
   * rejects without sending; unbound and unknown slots stay silent. */
  private currentItemSlot(): number | undefined {
    const {selectedItemSlot} = this.itemInventory.getSnapshot();
    return selectedItemSlot !== undefined && this.itemInventory.itemSlots().includes(selectedItemSlot)
      ? selectedItemSlot : undefined;
  }

  /** Ordinary weapon cycle over confirmed class3 ammo and class4 trap slots;
   * selects ammo or requests trap placement, no fire or consumption, while the
   * server remains the authority on selection. */
  private cycleWeapon(direction: 1 | -1): number | undefined {
    const local = this.roomFeed.snapshot?.players.find(player => player.id === this.playerId);
    if (!local?.alive) return undefined;
    const inventory = this.itemInventory.getSnapshot().inventory;
    return this.weaponCycle.next(weaponCandidateSlots(local.ammoSlots ?? [], inventory),
      direction, inventory);
  }

  /** Ordinary item cycle over configured hotkey items; the original selection
   * index moves before the unified request gate, which rejects exhausted slots.
   * The caller still runs one ordinary request and never consumes stock locally. */
  private cycleItem(direction: 1 | -1): number | undefined {
    const {selectedItemSlot} = this.itemInventory.getSnapshot();
    const slots = this.itemInventory.itemSlots();
    const slot = stepCandidate(slots, selectedItemSlot, direction);
    if (slot !== undefined) this.itemInventory.setSelectedItemSlot(slot);
    return slot;
  }

  private actionSequence = 0;
  private discardSelection?: number;

  /**
   * Legal stacked instances offered for the ordinary discard entry: the
   * player's confirmed hotkey bindings intersected with confirmed inventory
   * (owned and this-round counts positive) and an original drop visual. The
   * list is advisory only; the authority re-validates ownership and this
   * round's count, and selecting never sends a use, consumes a count or
   * changes any local record.
   */
  discardCandidates(): {instanceId: number; itemTableId: number; name: string; quantity: number}[] {
    const inventory = this.itemInventory.getSnapshot().inventory;
    if (!inventory) return [];
    const seen = new Set<number>();
    const candidates: {instanceId: number; itemTableId: number; name: string; quantity: number}[] = [];
    for (const raw of inventory.hotkeys) {
      const instanceId = raw >>> 0;
      if (!instanceId || seen.has(instanceId)) continue;
      seen.add(instanceId);
      const record = inventory.records.find(value => (value.instanceId >>> 0) === instanceId);
      if (!record || ![1, 2].includes(classifyInventoryCategory(record.itemTableId))
          || (record.ownedQuantity >>> 0) === 0 || (record.battleQuantity >>> 0) === 0) continue;
      candidates.push({instanceId, itemTableId: record.itemTableId,
        name: this.combatCatalog?.items.find(item => item.itemTableId === record.itemTableId)?.name
          ?? String(record.itemTableId), quantity: record.battleQuantity >>> 0});
    }
    return candidates;
  }

  get discardSelectedInstance(): number | undefined {
    const selection = this.discardSelection;
    return selection !== undefined && this.discardCandidates().some(candidate => candidate.instanceId === selection)
      ? selection : undefined;
  }

  setDiscardSelection(instanceId: number | undefined): void {
    this.discardSelection = instanceId;
  }

  private refreshDiscardSelection(): void {
    if (this.itemInventory.getSnapshot().inventory
        && this.discardSelection !== undefined
        && !this.discardCandidates().some(candidate => candidate.instanceId === this.discardSelection)) {
      this.discardSelection = undefined;
    }
    const snapshot = this.roomFeed.snapshot;
    if (this.active && snapshot && this.playerId) this.matchPanel.update(snapshot, this.playerId);
  }

  /** Current selection resolved against live authority state; the server re-checks on receipt. */
  private selectedDiscardInstance(): number | undefined {
    const snapshot = this.roomFeed.snapshot;
    const local = snapshot?.players.find(player => player.id === this.playerId);
    if (!snapshot || snapshot.phase !== 'PLAYING' || !local?.alive || local.isAutopilot) return undefined;
    return this.discardSelectedInstance;
  }

  async discardSelected(): Promise<void> {
    const snapshot = this.roomFeed.snapshot;
    const selection = this.selectedDiscardInstance();
    if (!snapshot?.match || selection === undefined) throw new Error('当前没有可丢弃的本局堆叠道具');
    if (this.training) {
      this.training.input({type: 'action', action: {roomId: snapshot.roomId, round: snapshot.match.round,
        sequence: ++this.actionSequence, action: GroundItemAction.DISCARD, value: selection, clientTime: Date.now()}});
      return;
    }
    if (!this.client.isConnected) throw new Error('连接已断开');
    this.client.sendMsg('PlayerAction', {roomId: snapshot.roomId, round: snapshot.match.round,
      sequence: ++this.actionSequence, action: GroundItemAction.DISCARD, value: selection,
      clientTime: Date.now()});
  }
  setQuickChats(preferences: QuickChatPreferences): void {this.chat.setQuickChats(preferences);}

  setSoundVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    const clamped = Math.max(0, Math.min(1, volume));
    this.soundVolume = clamped;
    setButtonSoundVolume(clamped);
    this.sound.setVolume(clamped);
    this.effects.setVolume(clamped);
    this.environmentSound?.setVolume(clamped);
  }

  private async ready(isReady: boolean): Promise<void> {
    const round = this.roomFeed.snapshot?.match?.round;
    if (round === undefined || this.roomFeed.snapshot?.phase !== 'WAITING') {
      throw new Error('请等待房间状态');
    }
    if (this.training) await this.training.request({type: 'ready', request: {round, isReady}});
    else await this.rooms.ready({round, isReady});
  }

  private async editRoom(settings: import('../../../shared/protocols/PtlEditRoom').RoomEditSettings): Promise<void> {
    const snapshot = this.roomFeed.snapshot;
    if (!snapshot?.match || snapshot.phase !== 'WAITING') throw new Error('只能编辑当前等待房间');
    if (this.training) {
      if (settings.mode !== 6) throw new Error('训练房间只能选择训练地图');
      await this.training.request({type: 'edit', request: {...settings, mode: 4, password: '', round: snapshot.match.round}});
    } else await this.rooms.edit({...settings, round: snapshot.match.round});
  }

  private async kickRoomPlayer(playerId: string): Promise<void> {
    const snapshot = this.roomFeed.snapshot;
    if (!snapshot?.match || snapshot.phase !== 'WAITING') throw new Error('只能在等待房间踢出成员');
    if (this.training) await this.training.request({type: 'kick', round: snapshot.match.round, playerId});
    else await this.rooms.kick({round: snapshot.match.round, playerId});
  }

  private async changeTeam(team: number): Promise<void> {
    const round = this.roomFeed.snapshot?.match?.round;
    if (round === undefined || this.roomFeed.snapshot?.phase !== 'WAITING') {
      throw new Error('当前对局不能换队');
    }
    await this.rooms.changeTeam({round, team});
  }

  private async manageCpu(operation: 'ADD' | 'REMOVE', playerId?: string, team?: number): Promise<void> {
    const snapshot = this.roomFeed.snapshot;
    if (!snapshot?.match || !this.playerId) throw new Error('请先加入房间');
    const round = snapshot.match.round;
    const tankId = Number(document.querySelector<HTMLSelectElement>('#tank')?.value ?? 1);
    if (this.training) {
      await this.training.request({type: 'cpu', request: {round, operation, playerId, team, tankId}});
    } else if (operation === 'ADD') {
      await this.rooms.addCpu(snapshot.roomId, {requesterPlayerId: this.playerId, round, tankId, team});
    } else {
      await this.rooms.cpu({round, operation, playerId, team, tankId});
    }
  }

  private async configureCpuLoadout(playerId: string, loadout: CpuLoadoutItem[]): Promise<void> {
    const round = this.roomFeed.snapshot?.match?.round;
    if (round === undefined) throw new Error('请先加入房间');
    if (this.training) await this.training.request({type: 'cpu', request: {round, operation: 'CONFIGURE', playerId, loadout}});
    else await this.rooms.cpu({round, operation: 'CONFIGURE', playerId, loadout});
  }

  private async autopilot(enabled: boolean): Promise<void> {
    const round = this.roomFeed.snapshot?.match?.round;
    if (round === undefined) throw new Error('请先加入房间');
    if (this.training) await this.training.request({type: 'autopilot', round, enabled});
    else await this.rooms.autopilot({round, enabled});
    this.input.clear();
  }

  /** Shared server clock derived from the newest snapshot's receive time. */
  private serverNow(): number {
    const snapshot = this.roomFeed.snapshot;
    return snapshot ? snapshot.serverTime + performance.now() - this.roomFeed.receivedAt : performance.now();
  }

  private async returnToRoom(): Promise<void> {
    const round = this.roomFeed.snapshot?.match?.round;
    if (round === undefined || this.roomFeed.snapshot?.phase !== 'FINISHED' || !this.isConnected) {
      throw new Error('当前无法返回原房间，请等待连接恢复');
    }
    if (this.training) await this.training.request({type: 'rematch', round});
    else await this.rooms.rematch({round});
    this.input.clear();
  }

  private reconcile(snapshot: MsgRoomSnapshot): void {
    const snapshotRevision = ++this.snapshotRevision;
    this.worldStateSnapshotJson = undefined;
    const mapId = snapshot.roomInfo?.mapId;
    if (mapId !== undefined && mapId !== this.mapId) {
      if (this.loadingRound !== undefined || this.mapLoaded) this.clearCancelledLoading();
      this.mapId = mapId;
    }
    this.localMotion.synchronize(snapshot, this.playerId);
    const session = this.session;
    const resourceRevision = this.resourceRevision;
    void this.groundTraps.reconcile(snapshot.phase === 'PLAYING' ? snapshot.match?.groundTraps ?? [] : [],
      `${snapshot.roomId}:${snapshot.match?.round ?? 0}`).then(() => {
      if (session === this.session && resourceRevision === this.resourceRevision
          && snapshotRevision === this.snapshotRevision && this.active) this.groundTrapError = undefined;
    }).catch(error => {
      if (session === this.session && resourceRevision === this.resourceRevision
          && snapshotRevision === this.snapshotRevision && this.active) this.groundTrapError = String(error);
    });
    if (this.active) {
      const scope = `${snapshot.roomId}:${snapshot.match?.round ?? 0}`;
      void this.groundItems.reconcile(snapshot.match?.groundItems ?? [], scope, snapshot.phase === 'PLAYING', snapshot.tick)
        .catch(error => {
          if (session === this.session && this.active) this.groundItemError = String(error);
        });
    }
    if (this.playerId) this.itemInventory.update(snapshot, this.playerId);
    const localPlayer = this.playerId ? snapshot.players.find(player => player.id === this.playerId) : undefined;
    this.weaponCycle.sync(localPlayer?.selectedAmmoSlot, localPlayer?.ammoSlots ?? [],
      this.itemInventory.getSnapshot().inventory);
    if (this.active && this.mapId !== undefined) {
      const result = snapshot.phase === 'FINISHED' ? snapshot.match?.result : undefined;
      const own = this.playerId ? result?.players.find(player => player.id === this.playerId) : undefined;
      const resultFlag = own?.outcome === 'WIN' ? 1 : own?.outcome === 'LOSE' ? 2 : undefined;
      this.pageMusic?.room(snapshot.phase, snapshot.mode, this.mapId, resultFlag, result?.round, snapshot.roomId);
      if (!this.pageMusic && snapshot.phase === 'PLAYING' && this.mapLoaded
          && this.playingMusicRound !== snapshot.match?.round) {
        this.playingMusicRound = snapshot.match?.round;
        void this.music.play(snapshot.mode, this.mapId).catch(error => console.error('战场音乐载入失败', error));
      }
      if (!this.pageMusic && this.mapLoaded && resultFlag !== undefined && result && this.resultMusicRound !== result.round) {
        this.resultMusicRound = result.round;
        void this.music.playResult(resultFlag).catch(error => console.error('结算音乐载入失败', error));
      }
    }
    if (snapshot.phase !== 'WAITING' && this.loadingRound !== undefined && this.mapLoaded) {
      this.players.reconcile(snapshot.players, this.playerId, snapshot.mode);
    }
    this.ammoBurnPresentation?.reconcile(snapshot.players,
      `${snapshot.roomId}:${snapshot.match?.round ?? 0}`, snapshot.phase === 'PLAYING');
    this.matchPanel.setReadyAvailable(snapshot.phase === 'WAITING' && !this.reconnecting);
    this.publishValuableSaleRoom();
    this.battlefield.reconcileCrushes(snapshot.match?.sceneCrushes ?? [], snapshot.match?.round ?? 0);
    this.battlefield.reconcilePlants(snapshot.match?.scenePlants ?? [], snapshot.match?.round ?? 0);
    this.chat.setPhase(snapshot.phase);
    this.chat.setPlayers(snapshot.players);
    if (this.playerId) this.originalHud.update(snapshot, this.playerId);
    if (this.playerId) this.matchPanel.update(snapshot, this.playerId);
    if (snapshot.phase === 'WAITING' && this.loadingRound !== undefined) {
      this.clearCancelledLoading();
    } else if ((snapshot.phase === 'LOADING' || snapshot.phase === 'PLAYING')
        && snapshot.match && this.loadingRound !== snapshot.match.round) {
      this.loadingRound = snapshot.match.round;
      void this.loadBattleResources(snapshot.match.round);
    }
    if ((snapshot.phase === 'PLAYING' || snapshot.phase === 'FINISHED')
        && this.loadedRound === snapshot.match?.round) this.targets.update(snapshot);
    this.publishWorldState(snapshot);
  }

  private syncBattleUiSounds(snapshot: MsgRoomSnapshot): void {
    if (snapshot.phase !== 'PLAYING' || !this.isConnected || this.reconnecting) return;
    const context = `${snapshot.roomId}:${snapshot.match?.round ?? 0}`;
    const hud = this.originalHud.getSnapshot();
    if (this.battleUiSoundContext !== context || this.battleUiSoundResync) {
      this.battleUiSoundContext = context;
      this.battleUiSoundResync = false;
      this.lastDeathCountdown = hud.deathCountdown;
      this.lastIntroStage = hud.introStage;
      return;
    }
    if (hud.deathCountdown !== undefined && hud.deathCountdown > 0
        && hud.deathCountdown !== this.lastDeathCountdown) {
      this.battleUiSound.play(42);
    }
    this.lastDeathCountdown = hud.deathCountdown;
    if (this.lastIntroStage !== 'fight' && hud.introStage === 'fight') {
      this.battleUiSound.play(43);
    }
    this.lastIntroStage = hud.introStage;
  }

  private render(): void {
    this.environmentSound?.update();
    const listener = cameraSpatialPose(this.camera);
    this.sound.listener(listener.position, listener.forward, listener.up);
    const snapshot = this.roomFeed.snapshot;
    setDynamicResolutionActive(this.scene, this.active && !!snapshot && this.isConnected && !this.reconnecting
      && this.mapLoaded && this.loadedRound === snapshot.match?.round && snapshot.phase === 'PLAYING');
    if (!this.active || !snapshot || !this.isConnected || this.reconnecting) {
      this.projectiles.clear();
      return;
    }
    if (!this.mapLoaded || this.loadedRound !== snapshot.match?.round
        || (snapshot.phase !== 'PLAYING' && snapshot.phase !== 'FINISHED')) {
      this.projectiles.clear();
      return;
    }
    const alpha = Math.min(1, this.scene.getEngine().getDeltaTime() / 80);
    this.ammoBurnPresentation?.reconcile(snapshot.players,
      `${snapshot.roomId}:${snapshot.match?.round ?? 0}`, snapshot.phase === 'PLAYING');
    const now = snapshot.serverTime + performance.now() - this.roomFeed.receivedAt;
    this.projectiles.reconcile(snapshot);
    this.projectiles.render(now);
    const active = battleIsActive(snapshot, now);
    this.localMotion.field.reconcile(snapshot, now);
    this.localMotion.setActive(active);
    this.localMotion.advance(active ? this.input.motionAxesToRef(this.motionAxes) : NEUTRAL_MOTION,
      this.scene.getEngine().getDeltaTime() / 1000, snapshot.players);
    if (this.playerId) {
      this.originalHud.update(snapshot, this.playerId, performance.now(), now);
      this.syncBattleUiSounds(snapshot);
    }
    const spectator = this.originalHud.spectator.getSnapshot();
    this.players.render(alpha, this.playerId, snapshot.phase === 'PLAYING',
      this.localMotion.renderedPoseToRef(this.localPose), this.localMotion.moving,
      spectator.playerId ?? this.playerId, spectator.wreckStartedAt === undefined
        ? undefined : Math.max(0, (now - spectator.wreckStartedAt) / 1000),
      this.localMotion.field.navigation, this.localMotion.mobileCameraYaw);
    if (this.playerId) this.minimapRenderer.render(snapshot, this.playerId);
    this.skillEffects?.frame(this.scene.getEngine().getDeltaTime() / 1000);
    const match = snapshot.match;
    const clock = this.sceneClock;
    clock.now = snapshot.phase === 'FINISHED' ? match?.result?.endedAt ?? now : now;
    clock.battleStartsAt = match?.battleStartsAt ?? now;
    clock.objects = match?.sceneObjects ?? EMPTY_SCENE_OBJECTS;
    this.battlefield.advance(this.scene.getEngine().getDeltaTime() / 1000, clock);
    const objects = this.sceneObjects;
    let objectIndex = 0;
    if (match?.objectives) {
      for (const object of match.objectives) objects[objectIndex++] = object;
    }
    for (const object of clock.objects) objects[objectIndex++] = object;
    objects.length = objectIndex;
    this.battlefield.updateObjects(objects, match?.round ?? 0,
      snapshot.serverTime, this.scene.getEngine().getDeltaTime() / 1000);
    const resourceError = this.groundTrapError || this.groundItemError || this.players.loadingError || '';
    if (resourceError && resourceError !== this.hud.value) showGameMessage(resourceError, 'error');
    this.hud.value = resourceError;
    this.publishWorldState(snapshot);
  }

  /** Publish diagnostic state independently of the simulation's frame rate. */
  private publishWorldState(snapshot: MsgRoomSnapshot): void {
    const now = performance.now();
    if (now - this.worldStatePublishedAt < this.worldStateInterval) return;
    this.worldStatePublishedAt = now;
    const identityJson = JSON.stringify({roomId: this.roomFeed.roomId, playerId: this.playerId,
      mapId: this.mapId, mapLoaded: this.mapLoaded});
    const snapshotChanged = this.worldStateSnapshotJson === undefined;
    const snapshotJson = this.worldStateSnapshotJson ??= JSON.stringify({
      phase: snapshot.phase, mode: snapshot.mode, remaining: snapshot.remaining,
      match: snapshot.match, teamScores: snapshot.teamScores,
      tick: snapshot.tick, players: snapshot.players, bullets: snapshot.bullets.length}).slice(1, -1);
    const renderedPlayers = this.players.size;
    const actionsJson = this.players.actionsJson;
    if (!snapshotChanged && identityJson === this.worldStateIdentityJson
        && renderedPlayers === this.worldStateRenderedPlayers && actionsJson === this.worldStateActionsJson) return;
    this.hud.dataset.world = `${identityJson.slice(0, -1)},${snapshotJson},"renderedPlayers":${renderedPlayers},"renderedActions":${actionsJson}}`;
    this.worldStateIdentityJson = identityJson;
    this.worldStateRenderedPlayers = renderedPlayers;
    this.worldStateActionsJson = actionsJson;
  }

  private clearWorldStateCache(): void {
    this.worldStateSnapshotJson = undefined;
    this.worldStateIdentityJson = '';
    this.worldStateActionsJson = '';
    this.worldStateRenderedPlayers = -1;
  }
}
