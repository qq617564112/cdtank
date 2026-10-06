import {ReloadProgress} from './reload-progress';
import {BattleInfoOpacity} from './battle-info-opacity';
import {teamInfo} from './team-info';
import {LocalDeathCountdown} from '../../match/local-death-countdown';
import type {MsgRoomSnapshot, PlayerSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';
import type {MsgRoomEvent} from '../../../../shared/protocols/MsgRoomEvent';
import {PortraitState} from './portrait-state';
import {loadSourceUiFonts} from '../resources/source-ui-fonts';

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
  expression: string; asset?: string | null; title?: string;
}
export interface HudSnapshot {
  data?: SourceUi; visible: boolean; mode: number;
  timers: readonly {text: string; colour?: string}[];
  slots: readonly (HudPlayer | undefined)[];
  localHealth?: {name: string; hp: number; maxHp: number};
  teamCounts?: {self: string; enemy: string};
  messages: string;
  deathCountdown?: number;
}
export interface HudReloadSnapshot {visible: boolean; fraction: number;}

/** Only visible source HUD projections notify React; movement and tick fields do not. */
export class BattleHud {
  private state: HudSnapshot = {visible: false, mode: 1, timers: Array.from({length: 5}, () => ({text: ''})), slots: [], messages: ''};
  private reload: HudReloadSnapshot = {visible: false, fraction: 1};
  private readonly listeners = new Set<() => void>();
  private readonly reloadListeners = new Set<() => void>();
  private readonly messages: string[] = [];
  private readonly portraits = new Map<string, {petId?: number; alive: boolean; state: PortraitState}>();
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

  readonly getSnapshot = (): HudSnapshot => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {this.listeners.add(listener); return () => {this.listeners.delete(listener);};};
  readonly getReloadSnapshot = (): HudReloadSnapshot => this.reload;
  readonly subscribeReload = (listener: () => void): (() => void) => {this.reloadListeners.add(listener); return () => {this.reloadListeners.delete(listener);};};
  readonly getBattleInfoOpacity = this.battleInfoOpacity.getSnapshot;
  readonly subscribeBattleInfoOpacity = this.battleInfoOpacity.subscribe;
  readonly battleInfoHover = (entered: boolean): void => {this.battleInfoOpacity.hover(entered);};
  private publish(next: HudSnapshot): void {
    const same = this.state.data === next.data && this.state.visible === next.visible && this.state.mode === next.mode
      && this.state.messages === next.messages
      && this.state.deathCountdown === next.deathCountdown
      && sameValues(this.state.localHealth, next.localHealth) && sameValues(this.state.teamCounts, next.teamCounts)
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
  update(snapshot: MsgRoomSnapshot, playerId: string, now = performance.now()): void {
    const data = this.state.data; if (!data) return;
    const seconds = this.lastUpdate === undefined ? 0 : (now - this.lastUpdate) / 1000; this.lastUpdate = now;
    this.battleInfoOpacity.advance(seconds);
    const present = new Set(snapshot.players.map(player => player.id));
    for (const id of this.portraits.keys()) if (!present.has(id)) this.portraits.delete(id);
    const mode = snapshot.mode ?? 1, timers = [...this.state.timers], remaining = Math.trunc(snapshot.remaining);
    if (mode >= 1 && mode <= 5) timers[mode - 1] = {
      text: `${Math.trunc(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`,
      colour: remaining < 30 ? remaining % 2 === 1 ? 'ffff0000' : 'ffffffff' : timers[mode - 1].colour,
    };
    const local = snapshot.players.find(player => player.id === playerId);
    this.deathCountdown.update(`${snapshot.roomId}:${snapshot.match?.round}:${playerId}`,
      snapshot.phase === 'PLAYING', local?.alive);
    const friends = snapshot.players.filter(player => player.team === local?.team);
    const localIndex = friends.findIndex(player => player.id === playerId);
    if (localIndex > 0) [friends[0], friends[localIndex]] = [friends[localIndex], friends[0]];
    const enemies = snapshot.players.filter(player => player.team !== local?.team);
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
        hp: player.hp, maxHp: player.maxHp, expression, asset, title: player.title?.name});
    }
    const round = snapshot.match?.round;
    if (round !== this.reloadRound || !local?.alive || snapshot.phase !== 'PLAYING') this.reloadProgress.reset();
    this.reloadRound = round;
    const visible = !!local?.reload && local.alive && snapshot.phase === 'PLAYING';
    const fraction = local?.reload && visible ? this.reloadProgress.update(local.reload, snapshot.serverTime, seconds) : 1;
    this.publishReload({visible, fraction});
    this.publish({...this.state, visible: true, mode, timers, slots,
      localHealth: local ? {name: local.name, hp: local.hp, maxHp: local.maxHp} : this.state.localHealth,
      teamCounts: teamInfo(snapshot, playerId)});
  }
  event(event: MsgRoomEvent): void {
    if (event.type === 'fire') this.portraits.get(event.playerId)?.state.set(2);
    if (event.type === 'hit') this.portraits.get(event.targetId)?.state.set(8);
    if (event.type === 'destroy') {
      this.portraits.get(event.targetId)?.state.set(0x04000000); this.portraits.get(event.playerId)?.state.set(4);
    }
    if (event.type === 'respawn') this.portraits.get(event.playerId)?.state.set(0x01000000);
    if (!['hit', 'destroy', 'respawn', 'finish', 'leave', 'chat', 'friendlyFire', 'itemUsed', 'itemRejected'].includes(event.type)) return;
    this.battleInfoOpacity.reset();
    this.messages.push(event.message); if (this.messages.length > 5) this.messages.shift();
    this.publish({...this.state, messages: this.messages.join('\n')});
  }
  clear(): void {
    this.deathCountdown.clear();
    ++this.loadGeneration; this.abort?.abort(); this.abort = undefined; this.loading = undefined;
    this.messages.length = 0; this.portraits.clear(); this.lastUpdate = undefined;
    this.reloadProgress.reset(); this.reloadRound = undefined;
    this.battleInfoOpacity.reset();
    this.publishReload({visible: false, fraction: 1});
    this.publish({...this.state, visible: false, slots: [], localHealth: undefined,
      messages: '', teamCounts: undefined,
      timers: this.state.timers.map(timer => ({text: timer.text}))});
  }
}

function sameValues(left: object | undefined, right: object | undefined): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  const entries = Object.entries(left);
  return entries.length === Object.keys(right).length && entries.every(([key, value]) => value === (right as Record<string, unknown>)[key]);
}
