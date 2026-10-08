import {gameContent} from '../../../shared/content/catalog';
import {Scene} from '@babylonjs/core';
import type {PlayerSnapshot, RoleDisguiseSnapshot} from '../../../shared/protocols/MsgRoomSnapshot';
import {RoleDisguiseVisual} from '../assets/scenes/role-disguise-visual';

interface DisguiseEntry {
  visual: RoleDisguiseVisual;
  key: string;
  error: string;
}

/** Owns per-player original4173 props, keyed by the authoritative disguise epoch. */
export class BattleRoleDisguises {
  private readonly entries = new Map<string, DisguiseEntry>();

  constructor(private readonly scene: Scene) {
    scene.onDisposeObservable.addOnce(() => {this.clear();});
  }

  /** Authoritative snapshot presence, not item/effect notifications, selects props. */
  reconcile(players: readonly PlayerSnapshot[], playing: boolean): void {
    const present = new Set<string>();
    for (const player of players) {
      const disguise = player.roleDisguise;
      if (!playing || !player.alive || !this.supported(disguise)) continue;
      present.add(player.id);
      const key = this.key(disguise);
      const existing = this.entries.get(player.id);
      if (existing?.key === key) continue;
      existing?.visual.dispose();
      const visual = new RoleDisguiseVisual(this.scene, player.id, disguise.style, disguise);
      const entry: DisguiseEntry = {visual, key, error: ''};
      // Register before awaiting so late clears/epoch changes own the eventual asset.
      this.entries.set(player.id, entry);
      void visual.load().catch(error => {
        if (this.entries.get(player.id) !== entry) {
          visual.dispose();
          return;
        }
        entry.error = `伪装替身载入失败：${String(error)}`;
      });
    }
    for (const [id, entry] of this.entries) {
      if (present.has(id)) continue;
      entry.visual.dispose();
      this.entries.delete(id);
    }
  }

  /** True while an active prop should hide the tank actor for every observer. */
  hidesActor(playerId: string): boolean {
    return this.entries.has(playerId);
  }

  get loadingError(): string {
    for (const entry of this.entries.values()) {
      if (entry.error) return entry.error;
    }
    return '';
  }

  clear(): void {
    this.entries.forEach(entry => {entry.visual.dispose();});
    this.entries.clear();
  }

  private supported(disguise: RoleDisguiseSnapshot | undefined): disguise is RoleDisguiseSnapshot {
    return !!disguise && [...gameContent().items.values()].some(item => item.runtime.use === 'disguise'
      && item.runtime.skillRoles.primary === disguise.skillId)
      && (disguise.style === 1 || disguise.style === 2);
  }

  private key(disguise: RoleDisguiseSnapshot): string {
    return [disguise.skillId, disguise.style, disguise.startedAt, disguise.expiresAt,
      disguise.x, disguise.y, disguise.z].join(':');
  }
}
