import {ReloadProgress} from './reload-progress';
import {BattleInfoOpacity} from './battle-info-opacity';
import {teamInfo} from './team-info';
import {LocalDeathCountdown} from '../../match/local-death-countdown';
import type {MsgRoomSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';
import type {MsgRoomEvent} from '../../../../shared/protocols/MsgRoomEvent';
import {PortraitState} from './portrait-state';
import {loadSourceUiFonts} from '../resources/source-ui-fonts';
import {combatState, sameCombatState, type HudCombatSnapshot} from './hud-combat-state';
import {minimapState, sameMinimapState, type HudMinimapSnapshot} from './hud-minimap-state';
import {modeInfo, type HudModeInfo} from './hud-mode-info';
import {battleIntroStage, type BattleIntroStage} from '../../../../shared/combat/battle-start';

export type {HudCombatSnapshot} from './hud-combat-state';
export type {HudMinimapSnapshot} from './hud-minimap-state';

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
}
export interface HudSnapshot {
  data?: SourceUi; visible: boolean; mode: number;
  roomId?: string; round?: number; phase?: MsgRoomSnapshot['phase'];
  introStage: BattleIntroStage;
  timers: readonly {text: string; colour?: string}[];
  slots: readonly (HudPlayer | undefined)[];
  localHealth?: {name: string; hp: number; maxHp: number};
  teamCounts?: {self: string; enemy: string};
  modeInfo?: HudModeInfo;
  messages: string;
  deathCountdown?: number;
}
export interface HudReloadSnapshot {visible: boolean; fraction: number;}

const EMPTY_COMBAT: HudCombatSnapshot = {visible: false, canUseShortcuts: false, alive: false, serverTime: 0, ammoSlots: [], activeEffects: []};
const EMPTY_MINIMAP: HudMinimapSnapshot = {visible: false, mode: 1, players: [], objectives: []};

/** Only visible source HUD projections notify React; movement and tick fields do not. */
export class BattleHud {
  private state: HudSnapshot = {visible: false, mode: 1, introStage: 'hidden', timers: Array.from({length: 5}, () => ({text: ''})), slots: [], messages: ''};
  private reload: HudReloadSnapshot = {visible: false, fraction: 1};
  private combat: HudCombatSnapshot = EMPTY_COMBAT;
  private minimap: HudMinimapSnapshot = EMPTY_MINIMAP;
  private minimapImage?: {mapId: number; imageUrl: string};
  private readonly listeners = new Set<() => void>();
  private readonly reloadListeners = new Set<() => void>();
  private readonly combatListeners = new Set<() => void>();
  private readonly minimapListeners = new Set<() => void>();
  private readonly messages: string[] = [];
  private readonly portraits = new Map<string, {petId?: number; alive: boolean; state: PortraitState}>();
  private readonly beforeShotPending = new Set<string>();
  private lastUpdate?: number;
  private readonly reloadProgress = new ReloadProgress();
  private readonly battleInfoOpacity = new BattleInfoOpacity();
  private reloadRound?: number;
  private loadGeneration = 0;
  private loading?: Promise<void>;
  private abort?: AbortController;
  private readonly deathCountdown = new LocalDeathCountdown(count => {
    this.publish({...this.state, deathCountdown: count});
  });
  private lifecycle?: string;
  private connected = true;

  readonly getSnapshot = (): HudSnapshot => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  readonly getReloadSnapshot = (): HudReloadSnapshot => this.reload;
  readonly subscribeReload = (listener: () => void): (() => void) => {this.reloadListeners.add(listener); return () => {this.reloadListeners.delete(listener);};};
  readonly getCombatSnapshot = (): HudCombatSnapshot => this.combat;
  readonly subscribeCombat = (listener: () => void): (() => void) => {this.combatListeners.add(listener); return () => {this.combatListeners.delete(listener);};};
  readonly getMinimapSnapshot = (): HudMinimapSnapshot => this.minimap;
  readonly subscribeMinimap = (listener: () => void): (() => void) => {this.minimapListeners.add(listener); return () => {this.minimapListeners.delete(listener);};};
  setConnected(connected: boolean): void {
    this.connected = connected;
    if (!connected) this.publishCombat({...this.combat, canUseShortcuts: false});
  }
  setMinimapImage(mapId: number, imageUrl: string): void {
    this.minimapImage = {mapId, imageUrl};
    if (this.minimap.mapId === mapId) this.publishMinimap({...this.minimap, imageUrl});
  }
  readonly getBattleInfoOpacity = this.battleInfoOpacity.getSnapshot;
  readonly subscribeBattleInfoOpacity = this.battleInfoOpacity.subscribe;
  readonly battleInfoHover = (entered: boolean): void => {this.battleInfoOpacity.hover(entered);};
  private publish(next: HudSnapshot): void {
    const same = this.state.data === next.data && this.state.visible === next.visible && this.state.mode === next.mode
      && this.state.roomId === next.roomId && this.state.round === next.round && this.state.phase === next.phase
      && this.state.introStage === next.introStage
      && this.state.messages === next.messages
      && this.state.deathCountdown === next.deathCountdown
      && sameValues(this.state.localHealth, next.localHealth) && sameValues(this.state.teamCounts, next.teamCounts)
      && sameValues(this.state.modeInfo, next.modeInfo)
      && this.state.timers.every((timer, index) => sameValues(timer, next.timers[index]))
      && this.state.slots.length === next.slots.length && this.state.slots.every((slot, index) => sameValues(slot, next.slots[index]));
    if (same) return;
    this.state = next;
    for (const listener of this.listeners) listener();
  }
  private publishReload(next: HudReloadSnapshot): void {
    if (this.reload.visible === next.visible && this.reload.fraction === next.fraction) return;
    this.reload = next; for (const listener of this.reloadListeners) listener();
  }
  private publishCombat(next: HudCombatSnapshot): void {
    if (sameCombatState(this.combat, next)) return;
    this.combat = next; for (const listener of this.combatListeners) listener();
  }
  private publishMinimap(next: HudMinimapSnapshot): void {
    if (sameMinimapState(this.minimap, next)) return;
    this.minimap = next; for (const listener of this.minimapListeners) listener();
  }
  load(): Promise<void> {
    if (this.state.data) return Promise.resolve();
    if (this.loading) return this.loading;
    const generation = ++this.loadGeneration, abort = new AbortController(); this.abort = abort;
    const operation = (async () => {
      const response = await fetch('/ui.json', {signal: abort.signal});
      if (!response.ok) throw new Error('战斗界面资源载入失败');
      const data = await response.json() as SourceUi;
      await loadSourceUiFonts();
      if (generation !== this.loadGeneration) return;
      this.publish({...this.state, data});
    })().catch(error => {if (generation === this.loadGeneration) throw error;}).finally(() => {
      if (generation === this.loadGeneration) {this.loading = undefined; this.abort = undefined;}
    });
    this.loading = operation; return operation;
  }
  update(snapshot: MsgRoomSnapshot, playerId: string, now = performance.now(), serverNow = snapshot.serverTime): void {
    const data = this.state.data; if (!data) return;
    const seconds = this.lastUpdate === undefined ? 0 : (now - this.lastUpdate) / 1000; this.lastUpdate = now;
    this.battleInfoOpacity.advance(seconds);
    const present = new Set(snapshot.players.map(player => player.id));
    for (const id of this.portraits.keys()) if (!present.has(id)) this.portraits.delete(id);
    for (const id of this.beforeShotPending) {
      const player = snapshot.players.find(value => value.id === id);
      if (!player || !player.alive) this.beforeShotPending.delete(id);
    }
    const round = snapshot.match?.round;
    const newRound = this.state.roomId !== snapshot.roomId || this.state.round !== round;
    if (newRound) {
      this.portraits.clear();
      this.messages.length = 0;
    }
    const mode = snapshot.mode ?? 1;
    const timers: {text: string; colour?: string}[] = Array.from({length: 5}, (_, index) =>
      !newRound && mode === this.state.mode && index === mode - 1 ? this.state.timers[index] : {text: ''});
    const remaining = Math.max(0, Math.trunc(snapshot.remaining));
    if (mode >= 1 && mode <= 5) timers[mode - 1] = {
      text: `${Math.trunc(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`,
      colour: remaining < 30 && remaining % 2 === 1 ? 'ffff0000' : 'ffffffff',
    };
    const local = snapshot.players.find(player => player.id === playerId);
    const lifecycle = `${snapshot.roomId}:${snapshot.phase}:${snapshot.match?.round ?? 0}`;
    if (lifecycle !== this.lifecycle) {
      this.lifecycle = lifecycle;
      this.beforeShotPending.clear();
    }
    this.deathCountdown.update(`${snapshot.roomId}:${snapshot.match?.round}:${playerId}`,
      snapshot.phase === 'PLAYING', local?.alive);
    const friends = snapshot.players.filter(player => mode <= 3 ? player.team === local?.team : player.id === playerId);
    const localIndex = friends.findIndex(player => player.id === playerId);
    if (localIndex > 0) [friends[0], friends[localIndex]] = [friends[localIndex], friends[0]];
    const enemies = snapshot.players.filter(player => mode <= 3 ? player.team !== local?.team : player.id !== playerId);
    const left = friends.slice(0, 6), right = [...enemies.slice(0, 6), ...friends.slice(6)].slice(0, 6);
    left.push(...enemies.slice(6, 6 + 6 - left.length));
    const slots: (HudPlayer | undefined)[] = [];
    for (let slot = 0; slot < 12; slot++) {
      const player = slot < 6 ? left[slot] : right[slot - 6];
      if (!player) {slots.push(undefined); continue;}
      const portrait = data.portraits.find(portrait => portrait.petId === player.petId);
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
      const asset = expression === 'dead' ? data.portraitDeath[slot === 0 ? 'local' : 'remote']
        : slot !== 0 ? portrait?.remoteAsset : expression === 'normal' ? portrait?.asset : portrait?.expressions[expression];
      slots.push({id: player.id, name: player.name, tankId: player.tankId, petId: player.petId, alive: player.alive,
        hp: player.hp, maxHp: player.maxHp, expression, asset, isVIP: player.isVIP, title: player.title?.name});
    }
    if (round !== this.reloadRound || !local?.alive || snapshot.phase !== 'PLAYING') this.reloadProgress.reset();
    this.reloadRound = round;
    const visible = !!local?.reload && local.alive && snapshot.phase === 'PLAYING';
    const fraction = local?.reload && visible ? this.reloadProgress.update(local.reload, snapshot.serverTime, seconds) : 1;
    this.publishReload({visible, fraction});
    const combat = combatState(snapshot, local, serverNow);
    this.publishCombat({...combat, canUseShortcuts: this.connected && combat.canUseShortcuts});
    const minimap = minimapState(snapshot, playerId);
    this.publishMinimap({...minimap, imageUrl: this.minimapImage?.mapId === minimap.mapId
      ? this.minimapImage.imageUrl : undefined});
    const introStage = battleIntroStage(snapshot, serverNow);
    this.publish({...this.state, visible: snapshot.phase === 'PLAYING' || snapshot.phase === 'FINISHED', mode, timers, slots,
      roomId: snapshot.roomId, round, phase: snapshot.phase, introStage, messages: this.messages.join('\n'),
      localHealth: local ? {name: local.name, hp: local.hp, maxHp: local.maxHp} : undefined,
      teamCounts: teamInfo(snapshot, playerId), modeInfo: modeInfo(snapshot, playerId)});
  }
  event(event: MsgRoomEvent): void {
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
    if (!['hit', 'destroy', 'respawn', 'finish', 'leave', 'chat', 'friendlyFire', 'itemUsed', 'itemRejected'].includes(event.type)) return;
    this.battleInfoOpacity.reset();
    this.messages.push(event.message); if (this.messages.length > 5) this.messages.shift();
    this.publish({...this.state, messages: this.messages.join('\n')});
  }
  clear(): void {
    this.connected = true;
    this.minimapImage = undefined;
    this.deathCountdown.clear();
    ++this.loadGeneration; this.abort?.abort(); this.abort = undefined; this.loading = undefined;
    this.messages.length = 0; this.portraits.clear(); this.beforeShotPending.clear(); this.lastUpdate = undefined;
    this.lifecycle = undefined;
    this.reloadProgress.reset(); this.reloadRound = undefined;
    this.battleInfoOpacity.reset();
    this.publishReload({visible: false, fraction: 1});
    this.publishCombat(EMPTY_COMBAT);
    this.publishMinimap(EMPTY_MINIMAP);
    this.publish({...this.state, visible: false, slots: [], localHealth: undefined, introStage: 'hidden',
      roomId: undefined, round: undefined, phase: undefined, deathCountdown: undefined,
      messages: '', teamCounts: undefined, modeInfo: undefined,
      timers: this.state.timers.map(() => ({text: ''}))});
  }
}

function sameValues(left: object | undefined, right: object | undefined): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  const entries = Object.entries(left);
  return entries.length === Object.keys(right).length && entries.every(([key, value]) => value === (right as Record<string, unknown>)[key]);
}
