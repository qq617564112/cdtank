import {Constants, Scene, Texture} from '@babylonjs/core';
import {prepareGameContent} from '../../content';
import {loadStaticJson} from '../static-resources';
import type {OwnedTankTextures} from '../../../../shared/combat/role-owned-textures';
import {battleArtworkUrl} from '../battle-artwork';

function loadTexture(scene: Scene, asset: string): Promise<Texture> {
  return new Promise<Texture>((resolve, reject) => {
    const value = new Texture(battleArtworkUrl(`/${asset}`, scene), scene, false, false,
      Constants.TEXTURE_LINEAR_LINEAR, () => resolve(value),
      (_message, error) => {value.dispose(); reject(error ?? new Error(`贴图载入失败 ${asset}`));});
  });
}

interface TrackAnimationDefinition {
  readonly frames: readonly string[];
  readonly frameDuration: number;
  readonly filters: Readonly<Record<string, readonly [number, number, number]>>;
}

interface SharedTrackFrames {
  references: number;
  readonly loading: Promise<Texture[]>;
}

export interface TankTrackTextures {
  readonly frames: readonly Texture[];
  readonly frameDuration: number;
  readonly filter: readonly [number, number, number];
  dispose(): void;
}

const trackFramesByScene = new WeakMap<Scene, Map<string, SharedTrackFrames>>();

async function loadTrackFrames(scene: Scene, paths: readonly string[]): Promise<Texture[]> {
  const frames: Texture[] = [];
  try {
    for (const path of paths) frames.push(await loadTexture(scene, path));
    return frames;
  } catch (error) {
    frames.forEach(texture => texture.dispose());
    throw error;
  }
}

/** One scene shares the animation frames; each actor applies its selected color. */
export async function loadTankTrackTextures(scene: Scene, ids: OwnedTankTextures | undefined,
    parts: readonly string[], tankId: number): Promise<TankTrackTextures | undefined> {
  if (!parts.some(part => part === 'X' || part === 'Y')) return undefined;
  const definition = (await prepareGameContent()).tanks.get(tankId)!;
  const animations = await loadStaticJson<Record<string, TrackAnimationDefinition>>('/data/tanks/tank-track-animations.json');
  const animation = animations[String(tankId)];
  const id = ids?.XY ?? 0;
  const row = definition.resources.textureVariants.find(value => value.recordId === id && value.part === 'XY');
  if (id !== 0 && !row) throw new Error(`缺少战车履带贴图 ${tankId}/${id}`);
  const paths = animation?.frames ?? (['A', 'B'] as const).map(variant => {
    const asset = id === 0
      ? definition.resources.textures[definition.resources.trackTextures[variant]]
      : row?.textures[variant]?.asset;
    if (!asset) throw new Error(`缺少战车履带贴图 ${tankId}/${id}/${variant}`);
    return asset;
  });
  const filter = animation ? animation.filters[String(id)] : [1, 1, 1] as const;
  if (!filter) throw new Error(`缺少战车履带颜色滤镜 ${tankId}/${id}`);
  const cache = trackFramesByScene.get(scene) ?? new Map<string, SharedTrackFrames>();
  trackFramesByScene.set(scene, cache);
  const key = animation ? String(tankId) : `${tankId}/${id}`;
  let shared = cache.get(key);
  if (!shared) {
    shared = {references: 0, loading: loadTrackFrames(scene, paths)};
    cache.set(key, shared);
  }
  shared.references++;
  let frames: Texture[];
  try {
    frames = await shared.loading;
  } catch (error) {
    shared.references--;
    if (cache.get(key) === shared) cache.delete(key);
    throw error;
  }
  const borrowed = shared;
  return {
    frames, filter, frameDuration: animation?.frameDuration ?? 0.1,
    dispose(): void {
      borrowed.references--;
      if (borrowed.references === 0) {
        cache.delete(key);
        frames.forEach(texture => texture.dispose());
      }
    },
  };
}

/** One actor owns only the default images referenced by its unmodified meshes. */
export class TankDefaultTextures {
  readonly bySource = new Map<string, Texture>();
  private readonly byAsset = new Map<string, Promise<Texture>>();
  private disposed = false;

  constructor(private readonly scene: Scene, private readonly tankId: number) {}

  async load(request: string): Promise<void> {
    if (this.disposed || this.bySource.has(request)) return;
    const definition = (await prepareGameContent()).tanks.get(this.tankId)!;
    if (this.disposed) return;
    const asset = definition.resources.textures[request];
    if (!asset) throw new Error(`缺少战车默认贴图 ${this.tankId}/${request}`);
    let loading = this.byAsset.get(asset);
    if (!loading) {
      const pending = loadTexture(this.scene, asset).catch(error => {
        if (this.byAsset.get(asset) === pending) this.byAsset.delete(asset);
        throw error;
      });
      loading = pending;
      this.byAsset.set(asset, loading);
    }
    const texture = await loading;
    if (!this.disposed) this.bySource.set(request, texture);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const loading of this.byAsset.values()) {
      void loading.then(texture => {texture.dispose();}, () => {});
    }
    this.byAsset.clear();
    this.bySource.clear();
  }
}

/** The actor owns selected armor textures separately from its action containers. */
export async function loadTankTextures(scene: Scene, ids: OwnedTankTextures | undefined,
    parts: readonly string[], tankId: number): Promise<Map<string, Texture>> {
  const loaded = new Map<string, Texture>();
  try {
    const definition = (await prepareGameContent()).tanks.get(tankId)!;
    for (const component of ['U', 'M'] as const) {
      if (!parts.includes(component)) continue;
      const id = ids?.[component] ?? 0;
      if (id === 0) continue;
      const row = definition.resources.textureVariants.find(row => row.recordId === id && row.part === component);
      const asset = row?.textures.A?.asset;
      if (!asset) throw new Error(`缺少战车贴图 ${component}/${id}/A`);
      loaded.set(component, await loadTexture(scene, asset));
    }
    return loaded;
  } catch (error) {
    loaded.forEach(texture => texture.dispose());
    throw error;
  }
}

/** Selected armor overrides are keyed by actor component. */
export function tankComponentTexture(textures: ReadonlyMap<string, Texture>, part: string): Texture | undefined {
  return textures.get(part);
}
