import type {Scene} from '@babylonjs/core';
import type {GroundItemSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';
import type {MsgRoomEvent} from '../../../../shared/protocols/MsgRoomEvent';
import type {EffectRuntime} from '../../render/effects/runtime/effect-runtime';
import type {EffectVec3} from '../../render/effects/common/types';
import {GroundItemVisual} from './ground-item-visual';

type GroundItemRuntime = Pick<EffectRuntime, 'spawnSceneEffect' | 'releaseSceneEffect' | 'playSceneSound'>;

interface VisualEntry {
  visual: GroundItemVisual;
  loaded: Promise<void>;
  effectHandle?: number;
}

interface SourceRecord {
  modelId: string;
  texture: 'A' | 'B';
  soundId: string;
  effectId: string;
  position: EffectVec3;
}

/**
 * Snapshot presence owns rebuilt ground drops. The visual geometry and the
 * original GA cue come from the dropitem row the server stored on the entity;
 * the model and its bound particles share the same presence and lifetime.
 */
export class GroundItemsPresentation {
  private readonly visuals = new Map<string, VisualEntry>();
  private readonly sources = new Map<string, SourceRecord>();
  private scope?: string;

  constructor(private readonly scene: Scene, private readonly runtime: GroundItemRuntime) {}

  async reconcile(sources: readonly GroundItemSnapshot[], scope: string, playing: boolean): Promise<void> {
    if (this.scope !== scope) {
      this.clear();
      this.scope = scope;
    }
    if (!playing) {
      this.disposeVisuals();
      return;
    }
    const present = new Set(sources.map(source => source.id));
    for (const id of this.visuals.keys()) if (!present.has(id)) this.removeVisual(id);
    for (const source of sources) {
      // Retain the authoritative pose/model so a same-tick pickup event that
      // follows the snapshot removal can still start the original cue.
      this.sources.set(source.id, {modelId: source.modelId, texture: source.texture,
        soundId: source.soundId, effectId: source.effectId, position: [source.x, source.y, source.z]});
      if (this.visuals.has(source.id)) continue;
      const visual = new GroundItemVisual(this.scene, source.id, source.modelId, source.texture,
        source.x, source.y, source.z);
      const entry: VisualEntry = {visual, loaded: Promise.resolve()};
      this.visuals.set(source.id, entry);
      entry.loaded = visual.load().then(async () => {
        if (this.visuals.get(source.id) !== entry || !source.effectId) return;
        const handle = await this.runtime.spawnSceneEffect(
          `_root\\online\\${String(source.effectId).padStart(3, '0')}`, visual.effectMatrix);
        if (this.visuals.get(source.id) !== entry) {
          if (handle) this.runtime.releaseSceneEffect(handle);
          return;
        }
        entry.effectHandle = handle;
      }).catch(error => {
        if (this.visuals.get(source.id) === entry) this.removeVisual(source.id);
        throw error;
      });
    }
    await Promise.all([...this.visuals.values()].map(entry => entry.loaded));
  }

  /**
   * Scene removal for a successful pickup or explicit delete. The source pose
   * and effect identity are consumed from the owned record; the local GA cue
   * fires once only for the local picker's own message.
   */
  event(event: MsgRoomEvent, localPlayerId: string | undefined): void {
    const dropped = event.groundItemDropped;
    if (dropped) {
      // The snapshot owns the model and particles; retain the pose for a pickup
      // that arrives before the next snapshot creates the visual.
      this.sources.set(dropped.id, {modelId: dropped.modelId, texture: dropped.texture,
        soundId: dropped.soundId, effectId: dropped.effectId, position: [dropped.x, dropped.y, dropped.z]});
      return;
    }
    const pickup = event.groundItemPickedUp;
    const removed = event.groundItemRemoved;
    const id = pickup?.id ?? removed?.id;
    if (id === undefined) return;
    this.removeVisual(id);
    const record = this.sources.get(id);
    if (!record) return;
    this.sources.delete(id);
    if (!pickup) return;
    const origin: EffectVec3 = [...record.position];
    if (localPlayerId !== undefined && pickup.playerId === localPlayerId && record.soundId) {
      this.runtime.playSceneSound(record.soundId, origin);
    }
  }

  clear(): void {
    this.disposeVisuals();
    this.sources.clear();
    this.scope = undefined;
  }

  private disposeVisuals(): void {
    for (const id of this.visuals.keys()) this.removeVisual(id);
  }

  private removeVisual(id: string): void {
    const entry = this.visuals.get(id);
    if (!entry) return;
    this.visuals.delete(id);
    if (entry.effectHandle) this.runtime.releaseSceneEffect(entry.effectHandle);
    entry.visual.dispose();
  }
}
