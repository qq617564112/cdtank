import {gameContent} from '../../../shared/content/catalog';
import {Scene} from '@babylonjs/core';
import type {PlayerSnapshot, RoleDisguiseSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import {RoleDisguiseVisual} from '../assets/scenes/role-disguise-visual';

interface DisguiseEntry {
  visual: RoleDisguiseVisual;
  error: string;
  ready: boolean;
  retryAt: number;
}

/** Owns per-player original4173 props, keyed by the authoritative disguise epoch. */
export class BattleRoleDisguises {
  private readonly entries = new Map<string, DisguiseEntry>();
  private readonly present = new Set<string>();

  constructor(private readonly scene: Scene) {
    scene.onDisposeObservable.addOnce(() => {this.clear();});
  }

  /** Authoritative snapshot presence, not item/effect notifications, selects props. */
  reconcile(players: readonly PlayerSnapshot[], playing: boolean): void {
    const present = this.present;
    present.clear();
    for (const player of players) {
      const disguise = player.roleDisguise;
      if (!playing || !player.alive || !this.supported(disguise)) continue;
      present.add(player.id);
      const existing = this.entries.get(player.id);
      if (existing && this.sameEpoch(existing.visual.snapshot, disguise)
          && (!existing.error || performance.now() < existing.retryAt)) continue;
      existing?.visual.dispose();
      const visual = new RoleDisguiseVisual(this.scene, player.id, disguise.style, disguise);
      const entry: DisguiseEntry = {visual, error: '', ready: false, retryAt: 0};
      // Register before awaiting so late clears/epoch changes own the eventual asset.
      this.entries.set(player.id, entry);
      void visual.load().then(() => {
        if (this.entries.get(player.id) === entry) entry.ready = true;
        else visual.dispose();
      }).catch(error => {
        visual.dispose();
        if (this.entries.get(player.id) !== entry) return;
        entry.error = `伪装替身载入失败：${String(error)}`;
        entry.retryAt = performance.now() + 1000;
      });
    }
    for (const id of this.entries.keys()) {
      if (present.has(id)) continue;
      this.entries.get(id)!.visual.dispose();
      this.entries.delete(id);
    }
    present.clear();
  }

  /** Keep the tank visible until its replacement prop is ready. */
  hidesActor(playerId: string): boolean {
    return this.entries.get(playerId)?.ready === true;
  }

  get loadingError(): string {
    for (const entry of this.entries.values()) {
      if (entry.error) return entry.error;
    }
    return '';
  }

  get resourcesReady(): boolean {
    for (const entry of this.entries.values()) if (!entry.ready) return false;
    return true;
  }

  clear(): void {
    for (const entry of this.entries.values()) entry.visual.dispose();
    this.entries.clear();
    this.present.clear();
  }

  private supported(disguise: RoleDisguiseSnapshot | undefined): disguise is RoleDisguiseSnapshot {
    if (!disguise) return false;
    for (const item of gameContent().items.values()) {
      if (item.runtime.use === 'disguise' && item.runtime.skillRoles.primary === disguise.skillId) {
        return disguise.style === 1 || disguise.style === 2;
      }
    }
    return false;
  }

  private sameEpoch(previous: RoleDisguiseSnapshot, next: RoleDisguiseSnapshot): boolean {
    return previous.skillId === next.skillId && previous.style === next.style
      && previous.startedAt === next.startedAt && previous.expiresAt === next.expiresAt
      && previous.x === next.x && previous.y === next.y && previous.z === next.z;
  }
}
