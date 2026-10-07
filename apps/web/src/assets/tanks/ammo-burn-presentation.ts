import type {TankView} from './tank-view';
import type {EffectRuntime} from '../../render/effects/runtime/effect-runtime';

export interface AmmoBurnPresentationState {
  itemId: 2007;
  skillId: 4005;
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

  constructor(private readonly runtime: Pick<EffectRuntime,
    'spawnAttachedEffect' | 'playSkillSound' | 'stopEffect' | 'stopSkillSound'>,
    private readonly role: (id: string) => TankView | undefined) {}

  reconcile(players: readonly AmmoBurnPresentationPlayer[], context: string, playing: boolean): void {
    if (this.context !== context) {
      this.clear();
      this.context = context;
    }
    const present = new Set<string>();
    if (playing) for (const player of players) {
      const burn = player.ammoBurn;
      if (!player.alive || burn?.itemId !== 2007 || burn.skillId !== 4005) continue;
      const view = this.role(player.id);
      if (!view || view.root.isDisposed()) continue;
      present.add(player.id);
      const previous = this.active.get(player.id);
      if (previous?.view === view && previous.startedAt === burn.startedAt) continue;
      // A stale snapshot can still carry the burn the ammoBurnEnded event already retired;
      // its real startedAt keeps the stopped instance from restarting before the snapshot drops it.
      if (this.ended.get(player.id)?.has(burn.startedAt)) continue;
      this.remove(player.id);
      const effect = this.runtime.spawnAttachedEffect(view, 14, 0, false);
      if (!effect) continue;
      const sound = this.runtime.playSkillSound(view, 'SE03', -1);
      this.active.set(player.id, {startedAt: burn.startedAt, view, effect, sound});
    }
    for (const id of this.active.keys()) if (!present.has(id)) this.remove(id);
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

  clear(): void {
    for (const id of this.active.keys()) this.remove(id);
    this.ended.clear();
    this.context = '';
  }
}
