import type {Scene} from '@babylonjs/core';
import {gameContent} from '../../../../shared/content/catalog';
import {ContentItemVisual} from './content-item-visual';

export interface GroundTrapPresentationSource {
  readonly id: string;
  readonly ownerId: string;
  readonly team: number;
  readonly itemTableId: number;
  readonly modelId: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly expiresAt: number;
}

interface Entry {
  visual: ContentItemVisual;
  loaded?: Promise<void>;
}

/** Snapshot presence owns the rebuilt ground object; each original POL supplies its geometry. */
export class GroundTrapsPresentation {
  private readonly entries = new Map<string, Entry>();
  private readonly present = new Set<string>();
  private scope?: string;

  constructor(private readonly scene: Scene) {}

  private createVisual(source: GroundTrapPresentationSource): Entry['visual'] {
    const definition = gameContent().items.get(source.itemTableId);
    if (!definition) throw new Error(`陷阱内容定义缺失：${source.itemTableId}`);
    return new ContentItemVisual(this.scene, source.id, definition,
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, source.x, source.y, source.z, 1]);
  }

  async reconcile(sources: readonly GroundTrapPresentationSource[], scope: string): Promise<void> {
    if (this.scope !== scope) {
      this.clear();
      this.scope = scope;
    }
    const present = this.present;
    present.clear();
    for (const source of sources) present.add(source.id);
    for (const [id, entry] of this.entries) {
      if (!present.has(id)) {
        entry.visual.dispose();
        this.entries.delete(id);
      }
    }
    for (const source of sources) {
      if (this.entries.has(source.id)) continue;
      const visual = this.createVisual(source);
      const entry: Entry = {visual};
      this.entries.set(source.id, entry);
      entry.loaded = visual.load().then(() => {entry.loaded = undefined;}).catch(error => {
        visual.dispose();
        if (this.entries.get(source.id) === entry) this.entries.delete(source.id);
        throw error;
      });
    }
    let loading: Promise<void>[] | undefined;
    for (const entry of this.entries.values()) {
      if (entry.loaded) (loading ??= []).push(entry.loaded);
    }
    if (loading) await Promise.all(loading);
  }

  clear(): void {
    for (const entry of this.entries.values()) entry.visual.dispose();
    this.entries.clear();
    this.present.clear();
    this.scope = undefined;
  }
}
