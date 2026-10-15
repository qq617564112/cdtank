import {LoadAssetContainerAsync, type AssetContainer, type LoadAssetContainerOptions, type Scene} from '@babylonjs/core';
import {cacheImageResource} from './image-cache';
import {installModelImageLoader} from './model-image-loader';
import {loadStaticBinary} from './static-resources';
import {battleArtworkUrl} from './battle-artwork';
import {isMobileDevice} from '../platform/device';

interface ModelImages {images?: {uri?: string}[];}
const preparedModels = new Map<string, Promise<void>>();
const waitingDecoders: (() => void)[] = [];
let activeDecoders = 0;

/** Prepare a GLB body and its external images before its first battle instance. */
export function prepareModelResource(url: string): Promise<void> {
  const key = new URL(url, location.href).href;
  const cached = preparedModels.get(key);
  if (cached) return cached;
  const loading = (async () => {
    await acquireModelDecoder();
    try {
      const bytes = await loadStaticBinary(key);
      const length = new DataView(bytes).getUint32(12, true);
      const model = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, length))) as ModelImages;
      await Promise.all((model.images ?? []).flatMap(image => image.uri
        ? [cacheImageResource(new URL(image.uri, key).href)] : []));
    } finally {
      releaseModelDecoder();
    }
  })().catch(error => {preparedModels.delete(key); throw error;});
  preparedModels.set(key, loading);
  return loading;
}

/** Count the body read, image preparation and Babylon parse as one decoder job. */
async function acquireModelDecoder(): Promise<void> {
  const limit = isMobileDevice() ? 2 : 4;
  if (activeDecoders < limit) {
    activeDecoders++;
    return;
  }
  await new Promise<void>(resolve => waitingDecoders.push(resolve));
}

function releaseModelDecoder(): void {
  const next = waitingDecoders.shift();
  if (next) next();
  else activeDecoders--;
}

/** Preserve each actor's own meshes and materials while sharing downloaded files. */
export async function loadPreparedModel(url: string, scene: Scene,
  options: LoadAssetContainerOptions = {}): Promise<AssetContainer> {
  installModelImageLoader();
  const address = new URL(battleArtworkUrl(url, scene), location.href);
  await acquireModelDecoder();
  try {
    if (scene.isDisposed) throw new Error('模型所属场景已关闭');
    const bytes = await loadStaticBinary(address.href);
    if (scene.isDisposed) throw new Error('模型所属场景已关闭');
    const assets = await LoadAssetContainerAsync(new Uint8Array(bytes), scene, {
      rootUrl: new URL('.', address).href, pluginExtension: '.glb',
      name: address.pathname.split('/').at(-1), ...options,
    });
    if (scene.isDisposed) {
      assets.dispose();
      throw new Error('模型所属场景已关闭');
    }
    return assets;
  } finally {
    releaseModelDecoder();
  }
}
