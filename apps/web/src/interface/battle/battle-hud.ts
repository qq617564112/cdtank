import {ReloadProgress} from './reload-progress';
import {battleInfoMessages} from './battle-info-messages';
import {BattleInfoOpacity} from './battle-info-opacity';
import {teamInfo, type TeamCounts} from './team-info';
import {BattleSpectator} from '../../match/battle-spectator';
import {BattleScoreboard} from './battle-scoreboard';
import {HudPlayerStatuses} from './hud-player-status';
import type {MsgRoomSnapshot, PlayerSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';
import type {MsgRoomEvent} from '../../../../shared/protocols/MsgRoomEvent';
import {PortraitState} from './portrait-state';
import {battleRemotePortraitAsset} from './battle-portrait-bounds';
import {loadUiFont} from '../resources/source-ui-fonts';
import {loadStaticJson} from '../../assets/static-resources';
import {combatState, sameCombatState, sameItemCombatState, type HudCombatSnapshot} from './hud-combat-state';
import {modeInfo, type HudModeInfo} from './hud-mode-info';
import {battleIntroStage, type BattleIntroStage} from '../../../../shared/combat/battle-start';

export type {HudCombatSnapshot} from './hud-combat-state';

export interface SourceWindow {
  name: string;
  parent: string | null;
  type: string;
  properties: Record<string, string>;
}
export interface SourceLayout {path: string; windows: SourceWindow[];}
export interface SourceRegion {Name: string; asset?: string; Width: string; Height: string;}
export interface SourceUi {
  portraits: {petId: number; asset: string | null; remoteAsset: string | null;
    expressions: Record<string, string | null>}[];
  portraitDeath: {local: string; remote: string};
  layouts: SourceLayout[];
  imagesets: {path: string; attributes: {Name: string; AutoScaled?: string; NativeHorzRes?: string; NativeVertRes?: string}; images: SourceRegion[]}[];
  fonts: {attributes: {Name: string; Filename: string}; mappings: {Image: string; Codepoint: string}[]}[];
}

export interface HudPlayer {
  id: string; name: string; tankId: number; petId?: number; alive: boolean; hp: number; maxHp: number;
  expression: string; asset?: string | null; isVIP: boolean; title?: string;
  statuses: readonly number[];
}
export interface HudSnapshot {
  data?: SourceUi; visible: boolean; mode: number;
  roomId?: string; round?: number; phase?: MsgRoomSnapshot['phase'];
  introStage: BattleIntroStage;
  timers: readonly {text: string; colour?: string; elapsedMinutes?: number}[];
  slots: readonly (HudPlayer | undefined)[];
  localHealth?: {name: string; hp: number; maxHp: number};
  teamCounts?: TeamCounts;
  modeInfo?: HudModeInfo;
  messages: string;
  notice?: {id: number; text: string};
  deathCountdown?: number;
}
export interface HudReloadSnapshot {visible: boolean; fraction: number;}
export type HudLayoutSnapshot = Omit<HudSnapshot, 'slots' | 'localHealth'>;

const EMPTY_COMBAT: HudCombatSnapshot = {visible: false, canUseShortcuts: false, alive: false, serverTime: 0, ammoSlots: [], activeEffects: []};
const EMPTY_TIMER: HudSnapshot['timers'][number] = {text: ''};
const EMPTY_TIMERS: HudSnapshot['timers'] = [EMPTY_TIMER, EMPTY_TIMER, EMPTY_TIMER, EMPTY_TIMER, EMPTY_TIMER];
const MAX_PENDING_NOTICES = 2;
const NOTICE_MAX_WAIT_MS = 5000;

/** Only visible source HUD projections notify React; movement and tick fields do not. */
export class BattleHud {
  readonly spectator = new BattleSpectator();
  readonly scoreboard = new BattleScoreboard();
  private state: HudSnapshot = {visible: false, mode: 1, introStage: 'hidden', timers: EMPTY_TIMERS, slots: [], messages: ''};
  private layoutState: HudLayoutSnapshot = this.state;
  private reload: HudReloadSnapshot = {visible: false, fraction: 1};
  private combat: HudCombatSnapshot = EMPTY_COMBAT;
  private itemCombat: HudCombatSnapshot = EMPTY_COMBAT;
  private readonly listeners = new Set<() => void>();
  private readonly reloadListeners = new Set<() => void>();
  private readonly combatListeners = new Set<() => void>();
  private readonly messages: string[] = [];
  private roomSnapshot?: MsgRoomSnapshot;
  private localPlayerId = '';
  private noticeId = 0;
  private readonly noticeQueue: {text: string; receivedAt: number}[] = [];
  private noticeTimer?: ReturnType<typeof setTimeout>;
  private readonly portraits = new Map<string, {petId?: number; alive: boolean; state: PortraitState}>();
  private readonly presentPlayers = new Set<string>();
  private readonly friends: PlayerSnapshot[] = [];
  private readonly enemies: PlayerSnapshot[] = [];
  private readonly beforeShotPending = new Set<string>();
  private readonly playerStatuses = new HudPlayerStatuses();
  private lastUpdate?: number;
  private readonly reloadProgress = new ReloadProgress();
  private readonly battleInfoOpacity = new BattleInfoOpacity();
  private reloadRound?: number;
  private loadGeneration = 0;
  private loading?: Promise<void>;
  private lifecycle?: string;
  private connected = true;

  readonly getSnapshot = (): HudSnapshot => this.state;
  readonly getLayoutSnapshot = (): HudLayoutSnapshot => this.layoutState;
  readonly getLocalHealthSnapshot = (): HudSnapshot['localHealth'] => this.state.localHealth;
  readonly subscribe = (listener: () => void): (() => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  readonly getReloadSnapshot = (): HudReloadSnapshot => this.reload;
  readonly subscribeReload = (listener: () => void): (() => void) => {this.reloadListeners.add(listener); return () => {this.reloadListeners.delete(listener);};};
  readonly getCombatSnapshot = (): HudCombatSnapshot => this.combat;
  readonly getItemCombatSnapshot = (): HudCombatSnapshot => this.itemCombat;
  readonly subscribeCombat = (listener: () => void): (() => void) => {this.combatListeners.add(listener); return () => {this.combatListeners.delete(listener);};};
  setConnected(connected: boolean): void {
    this.connected = connected;
    if (!connected) this.publishCombat({...this.combat, canUseShortcuts: false});
  }
  readonly getBattleInfoOpacity = this.battleInfoOpacity.getSnapshot;
  readonly subscribeBattleInfoOpacity = this.battleInfoOpacity.subscribe;
  readonly battleInfoHover = (entered: boolean): void => {this.battleInfoOpacity.hover(entered);};
  private publish(next: HudSnapshot): void {
    const sameLayout = this.state.data === next.data && this.state.visible === next.visible && this.state.mode === next.mode
      && this.state.roomId === next.roomId && this.state.round === next.round && this.state.phase === next.phase
      && this.state.introStage === next.introStage
      && this.state.messages === next.messages
      && this.state.notice === next.notice
      && this.state.deathCountdown === next.deathCountdown
      && sameTeamCounts(this.state.teamCounts, next.teamCounts)
      && sameModeInfo(this.state.modeInfo, next.modeInfo)
      && this.state.timers.every((timer, index) => sameTimer(timer, next.timers[index]));
    const same = sameLayout && sameHealth(this.state.localHealth, next.localHealth)
      && this.state.slots.length === next.slots.length && this.state.slots.every((slot, index) => slot === next.slots[index]);
    if (same) return;
    this.state = next;
    if (!sameLayout) this.layoutState = next;
    for (const listener of this.listeners) listener();
  }
  private publishReload(visible: boolean, fraction: number): void {
    if (this.reload.visible === visible && this.reload.fraction === fraction) return;
    this.reload = {visible, fraction}; for (const listener of this.reloadListeners) listener();
  }
  private publishCombat(next: HudCombatSnapshot): void {
    if (sameCombatState(this.combat, next)) return;
    if (!sameItemCombatState(this.itemCombat, next)) this.itemCombat = next;
    this.combat = next; for (const listener of this.combatListeners) listener();
  }
  load(): Promise<void> {
    if (this.state.data) return Promise.resolve();
    if (this.loading) return this.loading;
    const generation = ++this.loadGeneration;
    void loadUiFont().catch(() => {});
    const operation = (async () => {
      const data = await loadStaticJson<SourceUi>('/manifests/ui.json');
      if (generation !== this.loadGeneration) return;
      this.publish({...this.state, data});
    })().catch(error => {if (generation === this.loadGeneration) throw error;}).finally(() => {
      if (generation === this.loadGeneration) this.loading = undefined;
    });
    this.loading = operation; return operation;
  }
  update(snapshot: MsgRoomSnapshot, playerId: string, now = performance.now(), serverNow = snapshot.serverTime): void {
    this.roomSnapshot = snapshot;
    this.localPlayerId = playerId;
    this.scoreboard.update(snapshot, playerId);
    this.spectator.update(snapshot, playerId, serverNow);
    const data = this.state.data; if (!data) return;
    const seconds = this.lastUpdate === undefined ? 0 : (now - this.lastUpdate) / 1000; this.lastUpdate = now;
    this.battleInfoOpacity.advance(seconds);
    const present = this.presentPlayers;
    present.clear();
    for (const player of snapshot.players) present.add(player.id);
    for (const id of this.portraits.keys()) if (!present.has(id)) this.portraits.delete(id);
    for (const id of this.beforeShotPending) {
      const player = snapshot.players.find(value => value.id === id);
      if (!player || !player.alive) this.beforeShotPending.delete(id);
    }
    const round = snapshot.match?.round;
    const newRound = this.state.roomId !== snapshot.roomId || this.state.round !== round;
    const resetNotices = newRound || snapshot.phase !== 'PLAYING';
    if (resetNotices) this.clearNotices();
    if (newRound) {
      this.portraits.clear();
      this.messages.length = 0;
      this.playerStatuses.clear();
    }
    this.playerStatuses.update(snapshot, now);
    const mode = snapshot.mode ?? 1;
    const remaining = Math.max(0, Math.trunc(snapshot.remaining));
    const battleStartsAt = snapshot.match?.battleStartsAt;
    const timers = hudTimers(this.state.timers, mode, remaining, battleStartsAt, serverNow);
    let local: PlayerSnapshot | undefined;
    for (const player of snapshot.players) {
      if (player.id === playerId) {local = player; break;}
    }
    const lifecycle = `${snapshot.roomId}:${snapshot.phase}:${snapshot.match?.round ?? 0}`;
    if (lifecycle !== this.lifecycle) {
      this.lifecycle = lifecycle;
      this.beforeShotPending.clear();
    }
    const deathCountdown = snapshot.phase === 'PLAYING' && local?.alive === false && local.respawnAt > 0
      ? Math.max(0, Math.ceil((local.respawnAt - serverNow) / 1000)) : undefined;
    const friends = this.friends, enemies = this.enemies;
    friends.length = enemies.length = 0;
    let localIndex = -1;
    for (const player of snapshot.players) {
      if (mode <= 3 ? player.team === local?.team : player.id === playerId) {
        if (player.id === playerId) localIndex = friends.length;
        friends.push(player);
      } else enemies.push(player);
    }
    if (localIndex > 0) {
      const first = friends[0];
      friends[0] = friends[localIndex];
      friends[localIndex] = first;
    }
    const leftFriends = Math.min(6, friends.length), rightEnemies = Math.min(6, enemies.length);
    const previousSlots = this.state.slots;
    let updatedSlots: (HudPlayer | undefined)[] | undefined = previousSlots.length === 12 ? undefined : [];
    for (let slot = 0; slot < 12; slot++) {
      let player: PlayerSnapshot | undefined;
      if (slot < 6) player = slot < leftFriends ? friends[slot] : enemies[6 + slot - leftFriends];
      else {
        const index = slot - 6;
        player = index < rightEnemies ? enemies[index] : friends[6 + index - rightEnemies];
      }
      if (!player) {
        updatedSlots = appendHudSlot(previousSlots, updatedSlots, slot, undefined);
        continue;
      }
      let portrait: SourceUi['portraits'][number] | undefined;
      for (const candidate of data.portraits) {
        if (candidate.petId === player.petId) {portrait = candidate; break;}
      }
      let animation = this.portraits.get(player.id);
      if (!animation || animation.petId !== player.petId) {
        animation = {petId: player.petId, alive: player.alive, state: new PortraitState()};
        if (!player.alive) animation.state.set(0x04000000);
        this.portraits.set(player.id, animation);
      } else if (animation.alive !== player.alive) {
        animation.state.set(player.alive ? 0x01000000 : 0x04000000); animation.alive = player.alive;
      }
      if (player.alive) {
        const lowLife = player.hp / player.maxHp < Math.fround(.3), lowState = Boolean(animation.state.flags & 0x02000000);
        if (lowLife !== lowState) animation.state.set(lowLife ? 0x02000000 : 0x01000000);
      }
      animation.state.advance(seconds);
      const expression = animation.state.image();
      const asset = slot !== 0 ? battleRemotePortraitAsset(player.petId, expression, slot >= 6)
        : expression === 'dead' ? data.portraitDeath.local
        : expression === 'normal' ? portrait?.asset : portrait?.expressions[expression];
      const previous = previousSlots[slot];
      const previousStatuses = previous?.id === player.id ? previous.statuses : undefined;
      const statuses = snapshot.phase === 'PLAYING'
        ? this.playerStatuses.current(player, serverNow, previousStatuses)
        : previousStatuses?.length === 0 ? previousStatuses : [];
      const title = player.title?.name;
      if (previous?.id === player.id && previous.name === player.name && previous.tankId === player.tankId
        && previous.petId === player.petId && previous.alive === player.alive && previous.hp === player.hp
        && previous.maxHp === player.maxHp && previous.expression === expression && previous.asset === asset
        && previous.isVIP === player.isVIP && previous.title === title && previous.statuses === statuses) {
        updatedSlots = appendHudSlot(previousSlots, updatedSlots, slot, previous);
      } else {
        updatedSlots = appendHudSlot(previousSlots, updatedSlots, slot,
          {id: player.id, name: player.name, tankId: player.tankId, petId: player.petId, alive: player.alive,
            hp: player.hp, maxHp: player.maxHp, expression, asset, isVIP: player.isVIP, title, statuses});
      }
    }
    const slots = updatedSlots ?? previousSlots;
    if (round !== this.reloadRound || !local?.alive || snapshot.phase !== 'PLAYING') this.reloadProgress.reset();
    this.reloadRound = round;
    const reloadVisible = !!local?.reload && local.alive && snapshot.phase === 'PLAYING';
    const fraction = local?.reload && reloadVisible ? this.reloadProgress.update(local.reload, snapshot.serverTime, serverNow) : 1;
    this.publishReload(reloadVisible, fraction);
    const combat = combatState(snapshot, local, serverNow, this.combat);
    this.publishCombat(this.connected || !combat.canUseShortcuts ? combat : {...combat, canUseShortcuts: false});
    const introStage = battleIntroStage(snapshot, serverNow);
    const state = this.state;
    const visible = snapshot.phase === 'PLAYING' || snapshot.phase === 'FINISHED';
    const messages = newRound ? '' : state.messages;
    const notice = resetNotices ? undefined : state.notice;
    const localHealth = !local ? undefined : state.localHealth?.name === local.name
      && state.localHealth.hp === local.hp && state.localHealth.maxHp === local.maxHp ? state.localHealth
      : {name: local.name, hp: local.hp, maxHp: local.maxHp};
    const teamCounts = teamInfo(snapshot, playerId, state.teamCounts);
    const info = modeInfo(snapshot, playerId, state.modeInfo, teamCounts);
    if (state.visible === visible && state.mode === mode && state.roomId === snapshot.roomId
      && state.round === round && state.phase === snapshot.phase && state.introStage === introStage
      && state.deathCountdown === deathCountdown && state.messages === messages && state.notice === notice
      && state.timers === timers && state.slots === slots && state.localHealth === localHealth
      && state.teamCounts === teamCounts && state.modeInfo === info) return;
    this.publish({...state, visible, mode, timers, slots, roomId: snapshot.roomId, round, phase: snapshot.phase,
      introStage, deathCountdown, messages, notice, localHealth, teamCounts, modeInfo: info});
  }
  event(event: MsgRoomEvent): void {
    if (this.roomSnapshot?.phase === 'PLAYING') this.playerStatuses.event(event, performance.now());
    if (event.type === 'beforeShot') {
      this.beforeShotPending.add(event.playerId);
      this.portraits.get(event.playerId)?.state.set(2);
    }
    if (event.type === 'fire' && !this.beforeShotPending.delete(event.playerId)) {
      this.portraits.get(event.playerId)?.state.set(2);
    }
    if (event.type === 'hit') this.portraits.get(event.targetId)?.state.set(8);
    if (event.type === 'destroy') {
      this.beforeShotPending.delete(event.targetId);
      this.portraits.get(event.targetId)?.state.set(0x04000000); this.portraits.get(event.playerId)?.state.set(4);
    }
    if (event.type === 'respawn') {
      this.beforeShotPending.delete(event.playerId);
      this.portraits.get(event.playerId)?.state.set(0x01000000);
    }
    const messages = battleInfoMessages(event, this.roomSnapshot, this.localPlayerId);
    if (!messages.length) return;
    this.battleInfoOpacity.reset();
    const snapshot = this.roomSnapshot;
    const battleStartsAt = snapshot?.match?.battleStartsAt;
    const combatTime = snapshot?.phase === 'FINISHED'
      ? snapshot.match?.result?.endedAt ?? snapshot.serverTime : snapshot?.serverTime ?? 0;
    const elapsed = battleStartsAt === undefined ? 0 : Math.max(0, Math.floor((combatTime - battleStartsAt) / 1000));
    const timestamp = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
    this.messages.push(...messages.map(message => `[${timestamp}] ${message}`));
    if (this.messages.length > 5) this.messages.splice(0, this.messages.length - 5);
    this.publish({...this.state, messages: this.messages.join('\n')});
    for (const message of messages) this.announce(message);
  }
  announce(text: string): void {
    if (!this.state.visible || this.state.phase !== 'PLAYING') return;
    this.noticeQueue.push({text, receivedAt: performance.now()});
    if (this.noticeQueue.length > MAX_PENDING_NOTICES) this.noticeQueue.shift();
    if (this.noticeTimer === undefined) this.nextNotice();
  }
  private nextNotice(): void {
    const now = performance.now();
    let next = this.noticeQueue.shift();
    while (next && now - next.receivedAt > NOTICE_MAX_WAIT_MS) next = this.noticeQueue.shift();
    this.publish({...this.state, notice: next ? {id: ++this.noticeId, text: next.text} : undefined});
    if (!next) return;
    this.noticeTimer = setTimeout(() => {
      this.noticeTimer = undefined;
      this.nextNotice();
    }, 3000);
  }
  private clearNotices(): void {
    if (this.noticeTimer !== undefined) clearTimeout(this.noticeTimer);
    this.noticeTimer = undefined;
    this.noticeQueue.length = 0;
  }
  clear(): void {
    this.roomSnapshot = undefined;
    this.localPlayerId = '';
    this.scoreboard.clear();
    this.connected = true;
    this.spectator.clear();
    ++this.loadGeneration; this.loading = undefined;
    this.messages.length = 0; this.portraits.clear(); this.presentPlayers.clear(); this.beforeShotPending.clear(); this.lastUpdate = undefined;
    this.friends.length = this.enemies.length = 0;
    this.clearNotices();
    this.playerStatuses.clear();
    this.lifecycle = undefined;
    this.reloadProgress.reset(); this.reloadRound = undefined;
    this.battleInfoOpacity.reset();
    this.publishReload(false, 1);
    this.publishCombat(EMPTY_COMBAT);
    this.publish({...this.state, visible: false, slots: [], localHealth: undefined, introStage: 'hidden',
      roomId: undefined, round: undefined, phase: undefined, deathCountdown: undefined,
      messages: '', notice: undefined, teamCounts: undefined, modeInfo: undefined,
      timers: EMPTY_TIMERS});
  }
}

function appendHudSlot(previous: HudSnapshot['slots'], updated: (HudPlayer | undefined)[] | undefined,
  index: number, value: HudPlayer | undefined): (HudPlayer | undefined)[] | undefined {
  if (!updated && previous[index] === value) return;
  updated ??= previous.slice(0, index);
  updated.push(value);
  return updated;
}

function hudTimers(previous: HudSnapshot['timers'], mode: number, remaining: number,
  battleStartsAt: number | undefined, serverNow: number): HudSnapshot['timers'] {
  if (mode < 1 || mode > 5) return EMPTY_TIMERS;
  const active = mode - 1;
  const text = `${Math.trunc(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  const colour = remaining < 10 ? 'ffff0000' : remaining < 60 ? 'ffffff00' : 'ffffffff';
  const elapsedMinutes = battleStartsAt === undefined ? undefined
    : Math.max(0, Math.floor((serverNow - battleStartsAt) / 60000));
  const current = previous[active];
  const sameActive = current.text === text && current.colour === colour && current.elapsedMinutes === elapsedMinutes;
  let unchanged = sameActive;
  for (let index = 0; index < 5; index++) {
    if (index !== active && !sameTimer(previous[index], EMPTY_TIMER)) unchanged = false;
  }
  if (unchanged) return previous;
  const timers = [...EMPTY_TIMERS];
  timers[active] = sameActive ? current : {text, colour, elapsedMinutes};
  return timers;
}

function sameHealth(left: HudSnapshot['localHealth'], right: HudSnapshot['localHealth']): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.name === right.name && left.hp === right.hp && left.maxHp === right.maxHp;
}

function sameTeamCounts(left: HudSnapshot['teamCounts'], right: HudSnapshot['teamCounts']): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.self === right.self && left.enemy === right.enemy;
}

function sameModeInfo(left: HudSnapshot['modeInfo'], right: HudSnapshot['modeInfo']): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.mode === right.mode && left.self === right.self && left.enemy === right.enemy
    && left.info === right.info && left.binding === right.binding && left.label === right.label
    && left.finished === right.finished;
}

function sameTimer(left: HudSnapshot['timers'][number], right: HudSnapshot['timers'][number] | undefined): boolean {
  if (left === right) return true;
  return !!right && left.text === right.text && left.colour === right.colour
    && left.elapsedMinutes === right.elapsedMinutes;
}
