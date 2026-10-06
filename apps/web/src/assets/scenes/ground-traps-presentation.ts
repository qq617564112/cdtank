import type {Scene} from '@babylonjs/core';
import {Trap3001Visual} from './trap3001-visual';
import {Trap3002Visual} from './trap3002-visual';
import {Trap3003Visual} from './trap3003-visual';
import {Trap3004Visual} from './trap3004-visual';
import {Trap3005Visual} from './trap3005-visual';

export interface GroundTrapPresentationSource {
  readonly id: string;
  readonly ownerId: string;
  readonly team: number;
  readonly itemTableId: 3001 | 3002 | 3003 | 3004 | 3005;
  readonly modelId: 3001 | 3002 | 3003 | 3004 | 3005;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly expiresAt: number;
}

interface Entry {
  visual: Trap3001Visual | Trap3002Visual | Trap3003Visual | Trap3004Visual | Trap3005Visual;
  loaded: Promise<void>;
}

/** Snapshot presence owns the rebuilt ground object; each original POL supplies its geometry. */
export class GroundTrapsPresentation {
  private readonly entries = new Map<string, Entry>();
  private scope?: string;

  constructor(private readonly scene: Scene) {}

  private createVisual(source: GroundTrapPresentationSource): Entry['visual'] {
    // Ground yaw0/scale1 is the explicit authority reconstruction contract.
    const Visual = source.modelId === 3001 ? Trap3001Visual
      : source.modelId === 3002 ? Trap3002Visual
      : source.modelId === 3005 ? Trap3005Visual : source.modelId === 3004 ? Trap3004Visual : Trap3003Visual;
    return new Visual(this.scene, source.id,
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, source.x, source.y, source.z, 1]);
  }

  async reconcile(sources: readonly GroundTrapPresentationSource[], scope: string): Promise<void> {
    if (this.scope !== scope) {
      this.clear();
      this.scope = scope;
    }
    const present = new Set(sources.map(source => source.id));
    for (const [id, entry] of this.entries) {
      if (!present.has(id)) {
        entry.visual.dispose();
        this.entries.delete(id);
      }
    }
    for (const source of sources) {
      if (this.entries.has(source.id)) continue;
      const visual = this.createVisual(source);
      const entry: Entry = {visual, loaded: Promise.resolve()};
      this.entries.set(source.id, entry);
      entry.loaded = visual.load().catch(error => {
        visual.dispose();
        if (this.entries.get(source.id) === entry) this.entries.delete(source.id);
        throw error;
      });
    }
    await Promise.all([...this.entries.values()].map(entry => entry.loaded));
  }

  clear(): void {
    for (const entry of this.entries.values()) entry.visual.dispose();
    this.entries.clear();
    this.scope = undefined;
  }
}
