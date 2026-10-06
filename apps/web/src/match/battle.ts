import type {ReqStackItemSale, ResStackItemSale} from '../../../shared/protocols/PtlStackItemSale';
import type {ReqPartSale, ResPartSale} from '../../../shared/protocols/PtlPartSale';
import type {ReqPartMaintenance, ResPartMaintenance} from '../../../shared/protocols/PtlPartMaintenance';
import {Trade} from '../network/trade';
import {ROOM_RECONNECT_WINDOW_MS} from '../../../shared/room-reconnection';
import {GroundTrapsPresentation} from '../assets/scenes/ground-traps-presentation';
import {Blacklist} from '../network/blacklist';
import type {ReqShop} from '../../../shared/protocols/PtlShop';
import type {ReqTankShop} from '../../../shared/protocols/PtlTankShop';
import type {ReqPetShop} from '../../../shared/protocols/PtlPetShop';
import type {CpuLoadoutItem} from '../../../shared/protocols/PtlCpu';
import {configureBattleCamera} from '../render/battle-camera';
import {BattlePlayers} from '../render/battle-players';
import {GameConnection} from '../network/game-connection';
import {LobbyChat} from '../network/lobby-chat';
import {Friends} from '../network/friends';
import {LobbyPresence} from '../network/lobby-presence';
import {ArcRotateCamera, Scene, Vector3} from '@babylonjs/core';
import type {MsgRoomSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import type {MapOption, ResJoin, RoomSummary} from '../../../shared/protocols';
import {ScenePreview} from '../assets/scenes/scene-preview';
import {MapSceneEffects} from '../assets/scenes/map-scene-effects';
import {EffectRuntime} from '../render/effects/runtime/effect-runtime';
import {BattleHud} from '../interface/battle/battle-hud';
import {BattleMusic} from '../audio/battle-music';
import {PageMusic} from './page-music';
import {BattleSound} from '../audio/battle-sound';
import {MapEnvironmentSound} from '../audio/map-environment-sound';
import {BattleMatch} from '../interface/battle/battle-match';
import {BattleTargets} from '../render/battle-targets';
import {BattleChat} from '../interface/battle/battle-chat';
import type {ResInventory} from '../../../shared/protocols/PtlInventory';
import type {ReqKitbag, ResKitbag} from '../../../shared/protocols/PtlKitbag';
import type {ResOwnedRoles} from '../../../shared/protocols/PtlOwnedRoles';
import type {ResRoleProfile} from '../../../shared/protocols/PtlRoleProfile';
import type {ReqEquipment, ResEquipment} from '../../../shared/protocols/PtlEquipment';
import type {ReqSelectRole, ResSelectRole} from '../../../shared/protocols/PtlSelectRole';
import type {ReqTankTextures, ResTankTextures} from '../../../shared/protocols/PtlTankTextures';
import type {ReqPetSkillLearning, ResPetSkillLearning} from '../../../shared/protocols/PtlPetSkillLearning';
import type {ReqTankMaintenance, ResTankMaintenance} from '../../../shared/protocols/PtlTankMaintenance';
import type {ReqOwnedRoleSale, ResOwnedRoleSale} from '../../../shared/protocols/PtlOwnedRoleSale';
import type {CombatCatalog} from '../../../shared/combat/catalog';
import {createSkillEffectNotifications} from './skills/skill-effect-runtime';
import {BattleSkillEffects} from './skills/battle-skill-effects';
import {TankShotDisplay} from '../assets/tanks/shot-display';
import {TankShotPlayerResult} from '../assets/tanks/shot-player-result';
import {TankShotItemResult} from '../assets/tanks/shot-item-result';
import {AmmoBurnPresentation} from '../assets/tanks/ammo-burn-presentation';
import {TankPetDeathPresentation} from '../assets/tanks/tank-pet-death-presentation';
import {RoomFeed} from './room-feed';
import {BattleInput} from './battle-input';
import {BattleItemInventory} from './battle-item-inventory';
import type {KeyBindings} from './input-bindings';
import type {QuickChatPreferences} from '../interface/settings/quick-chat-preferences';

/** Displays server-owned world state; no local damage or outcome calculation. */
export class Battle {
  readonly originalHud = new BattleHud();
  readonly itemInventory = new BattleItemInventory(() => this.inventory());
  private readonly music = new BattleMusic();
  private pageMusic?: PageMusic;
  private readonly sound = new BattleSound();
  private readonly connection = new GameConnection();
  readonly lobbyChat = new LobbyChat(this.connection);
  readonly lobbyPresence = new LobbyPresence(this.connection);
  readonly trade = new Trade(this.connection);
  readonly friends = new Friends(this.connection);
  readonly blacklist = new Blacklist(this.connection);
  private readonly client = this.connection.client;
  private readonly accounts = this.connection.accounts;
  private readonly rooms = this.connection.rooms;
  get hasSavedIdentity(): boolean {return this.connection.hasSavedIdentity;}
  authenticate(credentials?: import('../../../shared/protocols/PtlAccount').ReqAccount['credentials']) {
    if (this.inRoom) throw new Error('请先离开房间');
    return this.connection.authenticate(credentials);
  }
  channels(channelId?: string) {return this.connection.channels(channelId);}
  disconnectAccount(): Promise<void> {
    if (this.inRoom) throw new Error('请先离开房间');
    this.lobbyPresence.stop();
    return this.connection.disconnect();
  }
  private readonly input = new BattleInput(() => ({
    active: this.active,
    playing: this.roomFeed.snapshot?.phase === 'PLAYING',
    connected: this.client.isConnected && !this.reconnecting,
    autopilot: this.roomFeed.snapshot?.players.find(player => player.id === this.playerId)?.isAutopilot ?? false,
  }), message => {void this.client.sendMsg('PlayerInput', message);});
  readonly chat = new BattleChat(async (text, channel, targetName) => {
    if (!this.active || !this.client.isConnected) throw new Error('连接已断开');
    if (channel === 3) {
      const snapshot = this.roomFeed.snapshot;
      if (!snapshot?.match) throw new Error('请先加入房间');
      const result = await this.client.callApi('FriendChat', {text, roomId: snapshot.roomId, round: snapshot.match.round});
      if (!result.isSucc) throw new Error(result.err.message);
    } else if (channel === 2) {
      const snapshot = this.roomFeed.snapshot;
      if (!snapshot?.match) throw new Error('请先加入房间');
      await this.rooms.whisper({text, targetName: targetName ?? '', roomId: snapshot.roomId, round: snapshot.match.round});
    } else await this.rooms.chat(text, channel);
  }, () => {this.input.clear();});
  private readonly players: BattlePlayers;
  private readonly battlefield: ScenePreview;
  private readonly groundTraps: GroundTrapsPresentation;
  private groundTrapError?: string;
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
  readonly matchPanel = new BattleMatch(() => this.rematch(),
    isReady => this.ready(isReady), team => this.changeTeam(team),
    (operation, playerId) => this.manageCpu(operation, playerId), enabled => this.autopilot(enabled),
    () => this.exitRoom(), () => this.inviteRoom(),
    (playerId, loadout) => this.configureCpuLoadout(playerId, loadout));
  private readonly targets: BattleTargets;
  private readonly roomFeed: RoomFeed;
  private playerId?: string;
  private active = false;
  private session = 0;
  private mapId?: number;
  private mapLoaded = false;
  private resultMusicRound?: number;
  private returnToLobby?: () => void;
  private exiting?: Promise<void>;
  private reconnecting = false;
  private recovery?: Promise<void>;

  constructor(private readonly scene: Scene, private readonly camera: ArcRotateCamera,
              private readonly hud: HTMLOutputElement) {
    this.battlefield = new ScenePreview(scene, camera);
    this.groundTraps = new GroundTrapsPresentation(scene);
    this.effects = new EffectRuntime(scene, camera);
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
    this.targets = new BattleTargets(scene);
    this.roomFeed = new RoomFeed(this.client, {
      beforeSnapshot: (snapshot, previous) => {
        if (snapshot.phase !== 'PLAYING' || snapshot.match?.round !== previous?.match?.round) {
          this.input.clear();
        }
        if (snapshot.match?.round !== previous?.match?.round) {
          this.skillEffects?.clear();
          this.effects.clearRoundEffects();
          this.players.resetRound(snapshot.players);
        }
        if (snapshot.phase === 'FINISHED' && previous?.phase !== 'FINISHED') {
          this.skillEffects?.clear();
        }
      },
      snapshot: snapshot => {this.reconcile(snapshot);},
      event: (event, snapshot) => {
        this.itemInventory.event(event);
        this.originalHud.event(event);
        this.skillEffects?.event(event);
        if (event.type === 'chat') this.chat.message(event.message);
        if (snapshot && this.playerId) this.sound.event(event, snapshot, this.playerId);
        if (event.type === 'fire') {
          const localRecoil = this.players.fire(event.playerId);
          if (event.playerId === this.playerId && localRecoil) this.effects.ordinaryFireCamera();
          if (event.shotDisplay) this.shotDisplay?.show(event.shotDisplay);
        }
        if (event.type === 'hit') {
          this.players.damage(event.targetId, event.value, event.targetId === this.playerId,
            event.shotPlayerResult?.critical === true);
        }
        if (event.type === 'hit' || event.type === 'playerHealed') {
          const victim = this.players.get(event.targetId);
          if (victim && event.shotPlayerResult) {
            this.shotPlayerResult?.showPlayerResult(victim, event.shotPlayerResult.itemId,
              this.playerId ? this.players.get(this.playerId) : undefined);
          }
          if (event.type === 'hit' && event.hurtSelector !== undefined) {
            const localShake = this.players.hurt(event.targetId, event.hurtSelector);
            if (event.targetId === this.playerId && localShake) this.effects.ordinaryHurtCamera();
          }
        }
        if (event.type === 'sceneCrushed' && event.sceneCrush && event.shotItemResult) {
          this.battlefield.crush(event.sceneCrush.placementId);
        }
        if (this.mapLoaded && !this.reconnecting &&
            event.type === 'sceneObjectHit' && event.castleDamage) {
          this.battlefield.damageCastle(event.castleDamage);
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
          const result = event.shotItemResult;
          this.shotItemResult?.show(result, event.playerId, this.playerId,
            () => this.sound.shotItemResult(event, snapshot, this.playerId!, result.itemId));
        }
      },
    });
    this.client.flows.postDisconnectFlow.push(input => {
      this.input.clear();
      if (this.active && !this.recovery) {
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
    scene.onBeforeRenderObservable.add(() => {this.render();});
    scene.onDisposeObservable.addOnce(() => {
      this.itemInventory.clear();
      if (this.pageMusic) this.pageMusic.dispose();
      else this.music.dispose();
      this.lobbyPresence.stop();
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
    return this.accounts.inventory();
  }

  async shop(request: ReqShop) {
    return this.accounts.shop(request);
  }

  async tankShop(request: ReqTankShop) {
    return this.accounts.tankShop(request);
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

  async roleProfile(): Promise<ResRoleProfile> {
    return this.accounts.roleProfile();
  }

  async selectRole(request: ReqSelectRole): Promise<ResSelectRole> {
    return this.accounts.selectRole(request);
  }

  async configureTankTextures(request: ReqTankTextures): Promise<ResTankTextures> {
    return this.accounts.configureTankTextures(request);
  }

  async petSkillLearning(request: ReqPetSkillLearning): Promise<ResPetSkillLearning> {
    return this.accounts.petSkillLearning(request);
  }

  async stackItemSale(request: ReqStackItemSale): Promise<ResStackItemSale> {
    return this.accounts.stackItemSale(request);
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

  async listMaps(): Promise<MapOption[]> {return this.rooms.listMaps();}

  async createRoom(mode: number, mapId: number, roomName: string, name: string, tankId: number, password = '',
                   minPlayers?: number, maxPlayers?: number, friendlyFire?: boolean): Promise<void> {
    const session = this.session;
    await this.connection.ensureConnected();
    const result = await this.rooms.create({mode, mapId, roomName, name, tankId, password, minPlayers, maxPlayers, friendlyFire});
    if (session !== this.session) return;
    if (!result.isSucc) throw new Error(result.err.message);
    await this.enter(result.res, session);
  }

  async startCpuMatch(name: string, tankId: number): Promise<void> {
    const session = this.session;
    this.hud.value = '连接并创建 CPU 对局…';
    await this.createRoom(4, 7, 'CPU 对局', name, tankId);
    try {
      if (session !== this.session || !this.active) return;
      this.hud.value = '加入三名 CPU，载入战车…';
      for (let count = 0; count < 3; count++) {
        await this.manageCpu('ADD');
        if (session !== this.session || !this.active) return;
      }
      const deadline = performance.now() + 60000;
      while (!this.roomFeed.snapshot || this.roomFeed.snapshot.players.length !== 4
          || !this.players.resourcesReady) {
        if (session !== this.session || !this.active) return;
        if (this.players.loadingError) throw new Error(this.players.loadingError);
        if (performance.now() > deadline) throw new Error('CPU 战车载入超时，请重试');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      await this.ready(true);
    } catch (error) {
      this.leave();
      throw error;
    }
  }

  async join(roomId: string, name: string, tankId: number, password = ''): Promise<void> {
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

  private async enter(result: ResJoin, session: number): Promise<void> {
    this.roomFeed.enter(result.room.id);
    this.playerId = result.playerId;
    this.mapId = result.room.mapId;
    this.input.resetSequence();
    this.active = true;
    this.pageMusic?.room(result.room.phase ?? 'WAITING', result.room.mode, result.room.mapId);
    this.lobbyChat.setInRoom(true);
    this.lobbyPresence.setInRoom(true);
    this.hud.value = '载入战场…';
    try {
      const [, , catalog] = await Promise.all([this.originalHud.load(), this.effects.load(),
        fetch('/combat-catalog.json').then(async response => {
          if (!response.ok) throw new Error('原技能目录载入失败');
          return response.json() as Promise<CombatCatalog>;
        })]);
      if (session !== this.session || !this.active) return;
      this.skillEffects = new BattleSkillEffects(createSkillEffectNotifications(this.effects, catalog, {
        role: roleId => this.players.get(`P${roleId}`),
        localRole: () => this.playerId ? this.players.get(this.playerId) : undefined,
      }));
      this.shotDisplay = new TankShotDisplay(this.effects, catalog);
      this.shotPlayerResult = new TankShotPlayerResult(this.effects, catalog);
      this.shotItemResult = new TankShotItemResult(this.effects, catalog);
      this.ammoBurnPresentation = new AmmoBurnPresentation(this.effects, id => this.players.get(id));
      await this.battlefield.load(String(this.mapId).padStart(4, '0'), this.effects);
      if (session === this.session && this.active && this.roomFeed.snapshot) {
        const snapshot = this.roomFeed.snapshot;
        this.battlefield.reconcileCrushes(snapshot.match?.sceneCrushes ?? [], snapshot.match?.round ?? 0);
        this.battlefield.reconcilePlants(snapshot.match?.scenePlants ?? [], snapshot.match?.round ?? 0);
      }
      if (session !== this.session || !this.active) {
        return;
      }
      if (!this.environmentSound) {
        const context = this.effects.audioContext();
        if (!context) throw new Error('地图声音管理器未就绪');
        this.environmentSound = new MapEnvironmentSound(this.camera, context);
        if (this.soundVolume !== undefined) this.environmentSound.setVolume(this.soundVolume);
      }
      await this.environmentSound.load(this.mapId!);
      if (session !== this.session || !this.active) return;
      await this.sceneEffects.load(this.mapId!);
      if (session !== this.session || !this.active) return;
      this.effects.start();
      if (this.roomFeed.snapshot) {
        const snapshot = this.roomFeed.snapshot;
        this.battlefield.restoreObjects([
          ...(snapshot.match?.objectives ?? []), ...(snapshot.match?.sceneObjects ?? []),
        ], snapshot.match?.round ?? 0, snapshot.serverTime);
      }
      this.mapLoaded = true;
      await this.sound.start();
      if (session !== this.session || !this.active) return;
      if (!this.pageMusic) await this.music.play(result.room.mode, this.mapId!);
      if (session !== this.session || !this.active) return;
      // Local map and tank (including death action) must exist before readiness.
      const deadline = performance.now() + 60000;
      while (!this.roomFeed.snapshot || !this.players.resourcesReady) {
        if (session !== this.session || !this.active) return;
        if (this.players.loadingError) throw new Error(this.players.loadingError);
        if (performance.now() > deadline) throw new Error('等待战车资源超时，请重试');
        await new Promise(resolve => setTimeout(resolve, 50));
      }

    } catch (error) {
      if (session !== this.session || !this.active) {
        return;
      }
      this.leave();
      throw error;
    }
    configureBattleCamera(this.camera);
    this.hud.value = '等待房间快照…';
    this.chat.show();
    this.input.start();
  }

  get inRoom(): boolean {return this.active;}

  setRoomExitHandler(handler?: () => void): void {this.returnToLobby = handler;}

  onRoomInvitation(handler: (message: import('../../../shared/protocols/MsgRoomInvitation').MsgRoomInvitation) => void): () => void {
    const listener = (message: import('../../../shared/protocols/MsgRoomInvitation').MsgRoomInvitation): void => {
      if (!this.active) handler(message);
    };
    this.client.listenMsg('RoomInvitation', listener);
    return () => {this.client.unlistenMsg('RoomInvitation', listener);};
  }

  private async inviteRoom(): Promise<number> {
    const snapshot = this.roomFeed.snapshot;
    if (!this.active || !snapshot?.match) throw new Error('请先加入房间');
    const result = await this.rooms.invite({roomId:snapshot.roomId,round:snapshot.match.round});
    return result.expiresAt;
  }

  private async recoverRoom(): Promise<void> {
    const session = this.session, roomId = this.roomFeed.roomId, playerId = this.playerId;
    if (!roomId || !playerId) return;
    this.reconnecting = true;
    const deadline = performance.now() + ROOM_RECONNECT_WINDOW_MS;
    this.hud.value = '连接已断开，正在恢复原房间…';
    while (session === this.session && this.active && performance.now() < deadline) {
      try {
        await this.connection.ensureConnected();
        if (session !== this.session || !this.active) return;
        const result = await this.rooms.resume({roomId, playerId});
        if (session !== this.session || !this.active) return;
        if (!result.isSucc) break;
        this.input.clear();
        this.input.resetSequence(result.res.inputSequence);
        this.roomFeed.receive(result.res.snapshot);
        const snapshot = this.roomFeed.snapshot;
        if (snapshot) {
          this.battlefield.restoreObjects([
            ...(snapshot.match?.objectives ?? []), ...(snapshot.match?.sceneObjects ?? []),
          ], snapshot.match?.round ?? 0, snapshot.serverTime);
        }
        this.reconnecting = false;
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
    }
  }

  exitRoom(): Promise<void> {
    if (this.exiting) return this.exiting;
    const session = this.session;
    const exit = async () => {
      await this.recovery;
      if (this.active && this.client.isConnected) {
        const snapshot = this.roomFeed.snapshot;
        if (!snapshot?.match) throw new Error('等待房间状态后重试');
        await this.rooms.leave({roomId: snapshot.roomId, round: snapshot.match.round});
      }
      if (session !== this.session) return;
      this.leave(!this.client.isConnected);
      this.returnToLobby?.();
    };
    this.exiting = exit().finally(() => {this.exiting = undefined;});
    return this.exiting;
  }

  leave(disconnect = true): void {
    this.active = false;
    this.reconnecting = false;
    this.resultMusicRound = undefined;
    this.itemInventory.clear();
    this.ammoBurnPresentation?.clear();
    this.ammoBurnPresentation = undefined;
    this.lobbyChat.setInRoom(false);
    this.lobbyPresence.setInRoom(false);
    if (this.pageMusic) this.pageMusic.lobby();
    else this.music.stop();
    this.sound.stop();
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
    this.effects.clear();
    this.battlefield.clear();
    this.groundTraps.clear();
    this.groundTrapError = undefined;
    this.mapLoaded = false;
    this.mapId = undefined;
    this.originalHud.clear();
    this.matchPanel.clear();
    this.chat.clear();
    this.targets.clear();
    this.hud.value = '';
    delete this.hud.dataset.world;
  }

  get isConnected(): boolean {return this.client.isConnected;}

  setMusicVolume(volume: number): void {
    this.music.setVolume(volume);
  }

  getKeyBindings(): KeyBindings {return this.input.getKeyBindings();}
  setKeyBindings(bindings: KeyBindings): void {this.input.setKeyBindings(bindings);}
  setQuickChats(preferences: QuickChatPreferences): void {this.chat.setQuickChats(preferences);}

  setSoundVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    const clamped = Math.max(0, Math.min(1, volume));
    this.soundVolume = clamped;
    this.sound.setVolume(clamped);
    this.effects.setVolume(clamped);
    this.environmentSound?.setVolume(clamped);
  }

  private async ready(isReady: boolean): Promise<void> {
    const round = this.roomFeed.snapshot?.match?.round;
    if (!this.mapLoaded || this.players.loadingError || round === undefined || this.roomFeed.snapshot?.phase !== 'WAITING'
        || !this.players.resourcesReady) {
      throw new Error('请等待地图和战车载入完成');
    }
    await this.rooms.ready({round, isReady});
    document.querySelector<HTMLCanvasElement>('#world')?.focus();
  }

  private async changeTeam(team: number): Promise<void> {
    const round = this.roomFeed.snapshot?.match?.round;
    if (round === undefined || this.roomFeed.snapshot?.phase !== 'WAITING') {
      throw new Error('当前对局不能换队');
    }
    await this.rooms.changeTeam({round, team});
  }

  private async manageCpu(operation: 'ADD' | 'REMOVE', playerId?: string): Promise<void> {
    const round = this.roomFeed.snapshot?.match?.round;
    if (round === undefined) throw new Error('请先加入房间');
    await this.rooms.cpu({round, operation, playerId,
      tankId: Number(document.querySelector<HTMLSelectElement>('#tank')?.value ?? 1)});
  }

  private async configureCpuLoadout(playerId: string, loadout: CpuLoadoutItem[]): Promise<void> {
    const round = this.roomFeed.snapshot?.match?.round;
    if (round === undefined) throw new Error('请先加入房间');
    await this.rooms.cpu({round, operation: 'CONFIGURE', playerId, loadout});
  }

  private async autopilot(enabled: boolean): Promise<void> {
    const round = this.roomFeed.snapshot?.match?.round;
    if (round === undefined) throw new Error('请先加入房间');
    await this.rooms.autopilot({round, enabled});
    this.input.clear();
  }

  private async rematch(): Promise<void> {
    const round = this.roomFeed.snapshot?.match?.round;
    if (round === undefined || this.roomFeed.snapshot?.phase !== 'FINISHED' || !this.client.isConnected) {
      throw new Error('当前对局无法再战，请返回后重新加入');
    }
    await this.rooms.rematch({round});
    this.input.clear();
    document.querySelector<HTMLCanvasElement>('#world')?.focus();
  }

  private reconcile(snapshot: MsgRoomSnapshot): void {
    const session = this.session;
    void this.groundTraps.reconcile(snapshot.phase === 'PLAYING' ? snapshot.match?.groundTraps ?? [] : [],
      `${snapshot.roomId}:${snapshot.match?.round ?? 0}`).catch(error => {
      if (session === this.session && this.active) this.groundTrapError = String(error);
    });
    if (this.playerId) this.itemInventory.update(snapshot, this.playerId);
    if (this.active && this.mapId !== undefined) {
      const result = snapshot.phase === 'FINISHED' ? snapshot.match?.result : undefined;
      const own = this.playerId ? result?.players.find(player => player.id === this.playerId) : undefined;
      const resultFlag = own?.outcome === 'WIN' ? 1 : own?.outcome === 'LOSE' ? 2 : undefined;
      this.pageMusic?.room(snapshot.phase, snapshot.mode, this.mapId, resultFlag, result?.round, snapshot.roomId);
      if (!this.pageMusic && this.mapLoaded && resultFlag !== undefined && result && this.resultMusicRound !== result.round) {
        this.resultMusicRound = result.round;
        void this.music.playResult(resultFlag).catch(error => console.error('结算音乐载入失败', error));
      }
    }
    this.players.reconcile(snapshot.players, this.playerId);
    this.ammoBurnPresentation?.reconcile(snapshot.players,
      `${snapshot.roomId}:${snapshot.match?.round ?? 0}`, snapshot.phase === 'PLAYING');
    this.matchPanel.setReadyAvailable(this.mapLoaded && this.players.resourcesReady && !this.players.loadingError);
    this.battlefield.reconcileCrushes(snapshot.match?.sceneCrushes ?? [], snapshot.match?.round ?? 0);
    this.battlefield.reconcilePlants(snapshot.match?.scenePlants ?? [], snapshot.match?.round ?? 0);
    this.chat.setPhase(snapshot.phase);
    this.chat.setPlayers(snapshot.players);
    if (this.playerId) this.matchPanel.update(snapshot, this.playerId);
    this.targets.update(snapshot);
    this.hud.dataset.world = JSON.stringify({roomId: this.roomFeed.roomId, playerId: this.playerId,
      mapId: this.mapId, mapLoaded: this.mapLoaded,
      phase: snapshot.phase, mode: snapshot.mode, remaining: snapshot.remaining,
      match: snapshot.match, teamScores: snapshot.teamScores,
      tick: snapshot.tick, players: snapshot.players, bullets: snapshot.bullets.length,
      renderedPlayers: this.players.size,
      renderedActions: this.players.actions});
  }

  private render(): void {
    this.environmentSound?.update();
    const position = this.camera.globalPosition;
    const forward = this.camera.getForwardRay().direction;
    const up = this.camera.getDirection(Vector3.Up());
    this.sound.listener({x: -position.x, y: position.y, z: position.z},
      {x: -forward.x, y: forward.y, z: forward.z}, {x: -up.x, y: up.y, z: up.z});
    const snapshot = this.roomFeed.snapshot;
    if (!this.active || !snapshot || !this.client.isConnected || this.reconnecting) {
      return;
    }
    this.matchPanel.setReadyAvailable(this.mapLoaded && this.players.resourcesReady && !this.players.loadingError);
    const alpha = Math.min(1, this.scene.getEngine().getDeltaTime() / 80);
    this.ammoBurnPresentation?.reconcile(snapshot.players,
      `${snapshot.roomId}:${snapshot.match?.round ?? 0}`, snapshot.phase === 'PLAYING');
    this.players.render(alpha, this.playerId, snapshot.phase === 'PLAYING');
    this.skillEffects?.frame(this.scene.getEngine().getDeltaTime() / 1000);
    const elapsed = Math.min((performance.now() - this.roomFeed.receivedAt) / 1000, 0.1);
    this.battlefield.advance(this.scene.getEngine().getDeltaTime() / 1000);
    this.battlefield.updateObjects([...(snapshot.match?.objectives ?? []), ...(snapshot.match?.sceneObjects ?? [])], snapshot.match?.round ?? 0,
      snapshot.serverTime, this.scene.getEngine().getDeltaTime() / 1000);
    const local = snapshot.players.find(player => player.id === this.playerId);
    if (this.playerId) {
      this.originalHud.update(snapshot, this.playerId);
    }
    const phase = {WAITING: '等待其他玩家', PLAYING: '战斗中', FINISHED: '本局结束'}[snapshot.phase] ?? snapshot.phase;
    this.hud.value = this.groundTrapError || this.players.loadingError || `${phase} · ${snapshot.players.length} 人 · ${snapshot.remaining}s · 生命 ${local?.hp ?? 0}/${local?.maxHp ?? 0} · 得分 ${local?.score ?? 0}`;
    // DOM world state supports HUD accessibility and browser integration verification.
    this.hud.dataset.world = JSON.stringify({roomId: this.roomFeed.roomId, playerId: this.playerId,
      mapId: this.mapId, mapLoaded: this.mapLoaded,
      phase: snapshot.phase, mode: snapshot.mode, remaining: snapshot.remaining,
      match: snapshot.match, teamScores: snapshot.teamScores,
      tick: snapshot.tick, players: snapshot.players, bullets: snapshot.bullets.length,
      renderedPlayers: this.players.size,
      renderedActions: this.players.actions});
  }
}
