import type {EffectRuntime} from '../../render/effects/runtime/effect-runtime';
import type {EffectNativeMatrix} from '../../render/effects/common/effect-native-space';

interface SceneEffectPlacement {id: string; name: string; enabled: boolean; matrix: EffectNativeMatrix;}
interface SceneEffectMap {mapId: number; effects: SceneEffectPlacement[];}

/** Original scene objects retain their effects from map startup until release. */
export class MapSceneEffects {
  private revision = 0;
  private handles: number[] = [];

  constructor(private readonly effects: Pick<EffectRuntime, 'spawnSceneEffect' | 'releaseSceneEffect'>) {}

  async load(mapId: number): Promise<void> {
    this.clear();
    if (!Number.isInteger(mapId) || mapId < 1 || mapId > 25) return;
    const revision = this.revision;
    const response = await fetch(`/scene-effects-${String(mapId).padStart(4, '0')}.json`);
    if (!response.ok) throw new Error(`Unable to load scene effects: ${response.status}`);
    const map = await response.json() as SceneEffectMap;
    if (revision !== this.revision) return;
    if (map.mapId !== mapId) throw new Error(`Unexpected scene effect map ${map.mapId}`);
    const allocated: number[] = [];
    try {
      for (const placement of map.effects) {
        if (!placement.enabled) continue;
        const handle = await this.effects.spawnSceneEffect(placement.name, placement.matrix, placement.id);
        if (revision !== this.revision) {
          if (handle) this.effects.releaseSceneEffect(handle);
          return;
        }
        if (!handle) throw new Error(`Scene effect was not created for ${placement.id}`);
        allocated.push(handle);
        this.handles.push(handle);
      }
    } catch (error) {
      allocated.forEach(value => this.effects.releaseSceneEffect(value));
      if (revision === this.revision) this.handles = [];
      throw error;
    }
  }

  clear(): void {
    ++this.revision;
    this.handles.forEach(handle => this.effects.releaseSceneEffect(handle));
    this.handles = [];
  }
}
