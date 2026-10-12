import {cacheImageResource, imageResourceKey, prepareImageCache, type ImageAsset} from './image-cache';
import {bundledImageUrls} from './image-resources';
import {loadStaticResourceBlob, prepareStaticResourceCache, type StaticResourceAsset} from './static-resource-cache';
import {withResourceTimeout} from './static-resources';

interface ResourceManifest {images: ImageAsset[]; resources: StaticResourceAsset[];}

export interface ResourceLoadingProgress {completed: number; total: number;}

/** Only the confirmed resource-pack action downloads every published game asset. */
export async function preloadGameResources(onProgress: (progress: ResourceLoadingProgress) => void,
  signal: AbortSignal): Promise<void> {
  const manifest = await withResourceTimeout((async () => {
    const response = await fetch('/manifests/image-assets.json', {cache: 'no-cache', signal});
    if (!response.ok) throw new Error(`资源目录加载失败（HTTP ${response.status}）`);
    return await response.json() as ResourceManifest;
  })(), '资源目录');
  signal.throwIfAborted();
  await prepareImageCache(manifest.images, bundledImageUrls);
  prepareStaticResourceCache(manifest.resources);
  const resources = new Map<string, {url: string; image: boolean}>();
  for (const resource of manifest.resources) {
    const image = /\.(?:png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(resource.url);
    const key = image ? imageResourceKey(resource.url) : new URL(resource.url, location.href).href;
    resources.set(key, {url: resource.url, image});
  }
  for (const url of bundledImageUrls) resources.set(imageResourceKey(url), {url, image: true});
  const assets = [...resources.values()];
  const progress: ResourceLoadingProgress = {completed: 0, total: assets.length};
  onProgress({...progress});
  let next = 0;
  let failure: unknown;
  let lastUpdate = performance.now();
  await Promise.all(Array.from({length: Math.min(8, assets.length)}, async () => {
    while (!failure && next < assets.length) {
      signal.throwIfAborted();
      const asset = assets[next++];
      try {
        if (asset.image) {
          const download = new AbortController();
          const cancel = () => download.abort(signal.reason);
          signal.addEventListener('abort', cancel, {once: true});
          const timer = setTimeout(() => download.abort(new Error(`资源载入超时，请重试：${asset.url}`)), 30_000);
          try {await cacheImageResource(asset.url, download.signal);}
          finally {clearTimeout(timer); signal.removeEventListener('abort', cancel);}
        } else await loadStaticResourceBlob(asset.url, signal);
        signal.throwIfAborted();
        progress.completed++;
        const now = performance.now();
        if (progress.completed === progress.total || now - lastUpdate >= 100) {
          lastUpdate = now;
          onProgress({...progress});
        }
      } catch (error) {
        failure = error;
      }
    }
  }));
  if (failure) throw failure;
  signal.throwIfAborted();
}
