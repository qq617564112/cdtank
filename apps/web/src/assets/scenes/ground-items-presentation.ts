import type {Scene} from '@babylonjs/core';
import type {GroundItemSnapshot} from '../../../../shared/protocols/MsgRoomSnapshot';
import type {MsgRoomEvent} from '../../../../shared/protocols/MsgRoomEvent';
import type {EffectRuntime} from '../../render/effects/runtime/effect-runtime';
import type {EffectVec3} from '../../render/effects/common/types';
import {GroundItemVisual} from './ground-item-visual';

type GroundItemRuntime = Pick<EffectRuntime, 'spawnSceneEffect' | 'releaseSceneEffect' | 'playSceneSound'>;

interface VisualEntry {
  visual: GroundItemVisual;
  loaded?: Promise<void>;
  effectHandle?: number;
}

interface SourceRecord {
  soundId: string;
  position: EffectVec3;
  missingAt?: number;
}

/**
 * Snapshot presence owns rebuilt ground drops. The visual geometry and the
 * original GA cue come from the dropitem row the server stored on the entity;
 * the model and its bound particles share the same presence and lifetime.
 */
export class GroundItemsPresentation {
  private readonly visuals = new Map<string, VisualEntry>();
  private readonly sources = new Map<string, SourceRecord>();
  private readonly present = new Set<string>();
  private scope?: string;

  constructor(private readonly scene: Scene, private readonly runtime: GroundItemRuntime) {}

  async reconcile(sources: readonly GroundItemSnapshot[], scope: string, playing: boolean,
    tick: number): Promise<void> {
    if (this.scope !== scope) {
      this.clear();
      this.scope = scope;
    }
    if (!playing) {
      this.disposeVisuals();
      return;
    }
    const present = this.present;
    present.clear();
    for (const source of sources) present.add(source.id);
    // Snapshot removal precedes pickup events. Keep the first missing tick's
    // cue, then release it on a newer snapshot if its event was missed offline.
    for (const id of this.sources.keys()) {
      const record = this.sources.get(id)!;
      if (present.has(id)) record.missingAt = undefined;
      else if (record.missingAt === undefined) record.missingAt = tick;
      else if (tick > record.missingAt) this.sources.delete(id);
    }
    for (const id of this.visuals.keys()) if (!present.has(id)) this.removeVisual(id);
    for (const source of sources) {
      // Retain the authoritative cue so a same-tick pickup event that
      // follows the snapshot removal can still start the original cue.
      this.rememberSource(source);
      if (this.visuals.has(source.id)) continue;
      const visual = new GroundItemVisual(this.scene, source.id, source.modelId, source.texture,
        source.x, source.y, source.z);
      const entry: VisualEntry = {visual};
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
      }).then(() => {entry.loaded = undefined;}).catch(error => {
        if (this.visuals.get(source.id) === entry) this.removeVisual(source.id);
        throw error;
      });
    }
    let loading: Promise<void>[] | undefined;
    for (const entry of this.visuals.values()) {
      if (entry.loaded) (loading ??= []).push(entry.loaded);
    }
    if (loading) await Promise.all(loading);
  }

  private rememberSource(source: GroundItemSnapshot): void {
    const record = this.sources.get(source.id);
    if (record) {
      record.soundId = source.soundId;
      record.missingAt = undefined;
      record.position[0] = source.x;
      record.position[1] = source.y;
      record.position[2] = source.z;
    } else {
      this.sources.set(source.id, {soundId: source.soundId, position: [source.x, source.y, source.z],
        missingAt: undefined});
    }
  }

  /**
   * Scene removal for a successful pickup or explicit delete. The source pose
   * and sound identity are consumed from the owned record; the local GA cue
   * fires once only for the local picker's own message.
   */
  event(event: MsgRoomEvent, localPlayerId: string | undefined): void {
    const dropped = event.groundItemDropped;
    if (dropped) {
      // The snapshot owns the model and particles; retain the cue for a pickup
      // that arrives before the next snapshot creates the visual.
      this.rememberSource(dropped);
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
    if (localPlayerId !== undefined && pickup.playerId === localPlayerId && record.soundId) {
      this.runtime.playSceneSound(record.soundId, record.position);
    }
  }

  clear(): void {
    this.disposeVisuals();
    this.sources.clear();
    this.present.clear();
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
