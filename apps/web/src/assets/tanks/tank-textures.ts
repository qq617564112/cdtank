import {Constants, Scene, Texture} from '@babylonjs/core';
import {prepareGameContent} from '../../content';
import type {OwnedTankTextures} from '../../../../shared/combat/role-owned-textures';

function loadTexture(scene: Scene, asset: string): Promise<Texture> {
  return new Promise<Texture>((resolve, reject) => {
    const value = new Texture(`/${asset}`, scene, false, false,
      Constants.TEXTURE_LINEAR_LINEAR, () => resolve(value),
      (_message, error) => {value.dispose(); reject(error ?? new Error(`贴图载入失败 ${asset}`));});
  });
}

/** The default material names map to editable paths in the tank definition. */
export async function loadTankDefaultTextures(scene: Scene, tankId: number): Promise<Map<string, Texture>> {
  const definition = (await prepareGameContent()).tanks.get(tankId)!;
  const loaded = new Map<string, Texture>();
  try {
    for (const [request, asset] of Object.entries(definition.resources.textures)) {
      if (request === definition.resources.trackTextures.A || request === definition.resources.trackTextures.B) continue;
      loaded.set(request, await loadTexture(scene, asset));
    }
    return loaded;
  } catch (error) {
    loaded.forEach(texture => texture.dispose());
    throw error;
  }
}

/** The actor owns selected texture resources separately from its action containers. */
export async function loadTankTextures(scene: Scene, ids: OwnedTankTextures | undefined,
    parts: readonly string[], tankId: number): Promise<Map<string, Texture>> {
  const loaded = new Map<string, Texture>();
  try {
    const definition = (await prepareGameContent()).tanks.get(tankId)!;
    for (const component of ['U', 'M', 'XY'] as const) {
      if (!(component === 'XY' ? parts.some(part => part === 'X' || part === 'Y') : parts.includes(component))) continue;
      const id = ids?.[component] ?? 0;
      if (id === 0 && component !== 'XY') continue;
      const row = definition.resources.textureVariants.find(row => row.recordId === id && row.part === component);
      const variants = component === 'XY' ? ['A', 'B'] as const : ['A'] as const;
      for (const variant of variants) {
        const asset = id === 0
          ? definition.resources.textures[definition.resources.trackTextures[variant]]
          : row?.textures[variant]?.asset;
        if (!asset) throw new Error(`缺少战车贴图 ${component}/${id}/${variant}`);
        const texture = await loadTexture(scene, asset);
        loaded.set(variant === 'A' ? component : 'XY-B', texture);
      }
    }
    return loaded;
  } catch (error) {
    loaded.forEach(texture => texture.dispose());
    throw error;
  }
}

/** Native XY setter initially supplies A to both track actors. */
export function tankComponentTexture(textures: ReadonlyMap<string, Texture>, part: string): Texture | undefined {
  return textures.get(part === 'X' || part === 'Y' ? 'XY' : part);
}
