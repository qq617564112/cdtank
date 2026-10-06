import {Constants, Scene, Texture} from '@babylonjs/core';
import type {OwnedTankTextures} from '../../../../shared/combat/role-owned-textures';

interface TextureAsset {
  request: string;
  source: string | null;
  asset: string | null;
  status: string;
}
interface TankTextureRow {
  recordId: number;
  tankId: number;
  part: 'U' | 'M' | 'XY';
  filename: string;
  textures: {A: TextureAsset; B: TextureAsset | null};
}
interface TankTextureCatalog {rows: TankTextureRow[];}
let catalog: Promise<TankTextureCatalog> | undefined;

function textureCatalog(): Promise<TankTextureCatalog> {
  return catalog ??= fetch('/tank-textures.json').then(async response => {
    if (!response.ok) throw new Error('战车贴图目录载入失败');
    return response.json() as Promise<TankTextureCatalog>;
  });
}

/** Resolve the model's actual embedded A filename, without selecting a shop skin. */
export async function loadEmbeddedTrackTextures(scene: Scene, tankId: number,
    filename: string): Promise<Map<string, Texture>> {
  const basename = (value: string): string => value.replace(/\\/g, '/').split('/').pop()!.toLowerCase();
  const row = (await textureCatalog()).rows.find(row => row.tankId === tankId && row.part === 'XY' &&
    basename(row.textures.A.request) === basename(filename));
  if (!row) throw new Error(`缺少原模型履带帧 ${tankId}/${filename}`);
  return loadTankTextures(scene, {U: 0, M: 0, XY: row.recordId}, ['X', 'Y'], tankId);
}

/** The actor owns selected texture resources separately from its action containers. */
export async function loadTankTextures(scene: Scene, ids: OwnedTankTextures | undefined,
    parts: readonly string[], tankId: number): Promise<Map<string, Texture>> {
  const loaded = new Map<string, Texture>();
  if (!ids || ![ids.U, ids.M, ids.XY].some(id => id !== 0)) return loaded;
  try {
    const source = await textureCatalog();
    for (const component of ['U', 'M', 'XY'] as const) {
      if (!(component === 'XY' ? parts.some(part => part === 'X' || part === 'Y') : parts.includes(component))) continue;
      const id = ids[component];
      if (id === 0) continue;
      const row = source.rows.find(row => row.recordId === id && row.part === component && row.tankId === tankId);
      const variants = component === 'XY' ? ['A', 'B'] as const : ['A'] as const;
      for (const variant of variants) {
        const asset = row?.textures[variant]?.asset;
        if (!asset) throw new Error(`缺少战车贴图 ${component}/${id}/${variant}`);
        const texture = await new Promise<Texture>((resolve, reject) => {
          const value = new Texture(`/${asset}`, scene, false, false,
            Constants.TEXTURE_LINEAR_LINEAR, () => resolve(value),
            (_message, error) => {value.dispose(); reject(error ?? new Error(`贴图载入失败 ${id}/${variant}`));});
        });
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
