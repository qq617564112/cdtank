import {gameContent} from '../../../../shared/content/catalog';
import type {TankView} from './tank-view';
import type {EffectRuntime} from '../../render/effects/runtime/effect-runtime';

export interface AmmoBurnPresentationState {
  itemId: number;
  skillId: number;
  startedAt: number;
  expiresAt: number;
}
export interface AmmoBurnPresentationPlayer {
  id: string;
  alive: boolean;
  ammoBurn?: AmmoBurnPresentationState;
}
interface ActiveBurn {
  startedAt: number;
  view: TankView;
  effect: number;
  sound: number;
}

/** Original4005 retained slot0 uses014/tag0/oneShot0 and spatialSE03 selector-1.
 * Authority snapshot presence controls the rebuilt burn start/stop policy.
 */
export class AmmoBurnPresentation {
  private context = '';
  private readonly active = new Map<string, ActiveBurn>();
  /** Real startedAt values an ammoBurnEnded event already retired for a role. */
  private readonly ended = new Map<string, Set<number>>();
  private readonly currentEnded = new Map<string, Set<number>>();
  private readonly present = new Set<string>();

  constructor(private readonly runtime: Pick<EffectRuntime,
    'spawnAttachedEffect' | 'playSkillSound' | 'stopEffect' | 'stopSkillSound'>,
    private readonly role: (id: string) => TankView | undefined) {}

  reconcile(players: readonly AmmoBurnPresentationPlayer[], context: string, playing: boolean): void {
    if (this.context !== context) {
      this.clear();
      this.context = context;
    }
    const currentEnded = this.currentEnded;
    for (const startedAt of currentEnded.values()) startedAt.clear();
    for (const player of players) {
      const burn = player.ammoBurn;
      if (!player.alive || !burn || gameContent().items.get(burn.itemId)?.runtime.hit !== 'burn') continue;
      if (this.ended.get(player.id)?.has(burn.startedAt)) {
        let startedAt = currentEnded.get(player.id);
        if (!startedAt) {startedAt = new Set(); currentEnded.set(player.id, startedAt);}
        startedAt.add(burn.startedAt);
      }
    }
    for (const id of currentEnded.keys()) {
      if (!currentEnded.get(id)!.size) currentEnded.delete(id);
    }
    this.clearMarkers(currentEnded);
    const present = this.present;
    present.clear();
    if (playing) for (const player of players) {
      const burn = player.ammoBurn;
      if (!player.alive || !burn || gameContent().items.get(burn.itemId)?.runtime.hit !== 'burn') continue;
      const view = this.role(player.id);
      if (!view || view.root.isDisposed()) continue;
      present.add(player.id);
      const previous = this.active.get(player.id);
      if (previous?.view === view && previous.startedAt === burn.startedAt) continue;
      // A stale snapshot can still carry the burn the ammoBurnEnded event already retired;
      // its real startedAt keeps the stopped instance from restarting before the snapshot drops it.
      if (this.ended.get(player.id)?.has(burn.startedAt)) continue;
      this.remove(player.id);
      const slot = gameContent().skills.get(burn.skillId)?.effects[0];
      if (!slot) continue;
      const effect = this.runtime.spawnAttachedEffect(view, slot.effectId, slot.tag, false);
      if (!effect) continue;
      const sound = this.runtime.playSkillSound(view, slot.sound, -1);
      this.active.set(player.id, {startedAt: burn.startedAt, view, effect, sound});
    }
    for (const id of this.active.keys()) if (!present.has(id)) this.remove(id);
    present.clear();
  }

  /**
   * Consumes the real ammoBurnEnded event before the generic slot1 notification: it stops the
   * matching startedAt instance and records the ending so later stale snapshots cannot replay it.
   */
  end(playerId: string, startedAt: number, context: string): void {
    if (this.context !== context) return;
    let ended = this.ended.get(playerId);
    if (!ended) {ended = new Set(); this.ended.set(playerId, ended);}
    ended.add(startedAt);
    const instance = this.active.get(playerId);
    if (instance?.startedAt === startedAt) this.remove(playerId);
  }

  private remove(id: string): void {
    const instance = this.active.get(id);
    if (!instance) return;
    this.runtime.stopEffect(instance.effect);
    this.runtime.stopSkillSound(instance.sound);
    this.active.delete(id);
  }

  private clearMarkers(current: ReadonlyMap<string, ReadonlySet<number>>): void {
    for (const id of this.ended.keys()) {
      const ended = this.ended.get(id)!;
      const currentEnded = current.get(id);
      for (const startedAt of ended) if (!currentEnded?.has(startedAt)) ended.delete(startedAt);
      if (!ended.size) this.ended.delete(id);
    }
  }

  clear(): void {
    for (const id of this.active.keys()) this.remove(id);
    this.ended.clear();
    this.currentEnded.clear();
    this.present.clear();
    this.context = '';
  }
}
