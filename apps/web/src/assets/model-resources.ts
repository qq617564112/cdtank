import {LoadAssetContainerAsync, type AssetContainer, type LoadAssetContainerOptions, type Scene} from '@babylonjs/core';
import {decodeImageRegion} from './image-resources';
import {imageResourceUrl} from './image-cache';
import {loadStaticBinary} from './static-resources';
import {battleArtworkUrl} from './battle-artwork';

interface ModelImages {images?: {uri?: string}[];}
const preparedModels = new Map<string, Promise<void>>();

/** Prepare a GLB body and its external images before its first battle instance. */
export function prepareModelResource(url: string): Promise<void> {
  const key = new URL(url, location.href).href;
  const cached = preparedModels.get(key);
  if (cached) return cached;
  const loading = (async () => {
    const bytes = await loadStaticBinary(key);
    const length = new DataView(bytes).getUint32(12, true);
    const model = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, length))) as ModelImages;
    await Promise.all((model.images ?? []).flatMap(image => image.uri
      ? [decodeImageRegion(new URL(image.uri, key).href)] : []));
  })().catch(error => {preparedModels.delete(key); throw error;});
  preparedModels.set(key, loading);
  return loading;
}

/** Preserve each actor's own meshes and materials while sharing downloaded files. */
export async function loadPreparedModel(url: string, scene: Scene,
  options: LoadAssetContainerOptions = {}): Promise<AssetContainer> {
  const address = new URL(battleArtworkUrl(url, scene), location.href);
  await prepareModelResource(address.href);
  const bytes = await loadStaticBinary(address.href);
  const gltf = options.pluginOptions?.gltf;
  return LoadAssetContainerAsync(new Uint8Array(bytes), scene, {
    rootUrl: new URL('.', address).href, pluginExtension: '.glb',
    name: address.pathname.split('/').at(-1), ...options,
    pluginOptions: {...options.pluginOptions, gltf: {...gltf,
      preprocessUrlAsync: async (url, rootUrl) => imageResourceUrl(
        gltf?.preprocessUrlAsync ? await gltf.preprocessUrlAsync(url, rootUrl) : url),
    }},
  });
}
