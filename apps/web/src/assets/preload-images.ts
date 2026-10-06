export interface ImageLoadingProgress {
  completed: number;
  cached: number;
  total: number;
  loadedBytes: number;
  totalBytes: number;
}

interface ImageAsset {url: string; bytes: number; modifiedAt: number;}
interface ImageManifest {images: ImageAsset[];}

const imageCacheName = 'cdtank-images';
const imageUpdatedHeader = 'X-CDTank-Image-Updated';
const imageManifestUrl = '/image-assets.json';
const browserManifestKey = 'cdtank-image-manifest';

/** Download missing images and reuse complete local responses without decoding them. */
export class ImagePreloader {
  private readonly completed = new Map<string, number>();

  async load(onProgress: (progress: ImageLoadingProgress) => void, signal: AbortSignal): Promise<void> {
    const response = await fetch(imageManifestUrl, {cache: 'no-cache', signal});
    if (!response.ok) throw new Error(`图片目录加载失败（HTTP ${response.status}）`);
    const {images} = await response.json() as ImageManifest;
    if (images.length === 0) throw new Error('图片资源目录为空');
    const cache = await this.openCache();
    let storedManifest: ImageManifest | undefined;
    let cachedUrls: Set<string> | undefined;
    if (cache) {
      const [stored, requests] = await Promise.all([cache.match(imageManifestUrl), cache.keys()]);
      if (stored) storedManifest = await stored.json() as ImageManifest;
      cachedUrls = new Set(requests.map(request => request.url));
    } else {
      try {
        const stored = localStorage.getItem(browserManifestKey);
        if (stored) storedManifest = JSON.parse(stored) as ImageManifest;
      } catch {
        // Browser caching also works when persistent storage is unavailable.
      }
    }
    const storedVersions = new Map<string, number>(
      storedManifest?.images.map(image => [image.url, image.modifiedAt]) ?? []);
    const progress: ImageLoadingProgress = {
      completed: 0, cached: 0, total: images.length, loadedBytes: 0,
      totalBytes: images.reduce((total, image) => total + image.bytes, 0),
    };
    const pending: ImageAsset[] = [];
    for (const image of images) {
      signal.throwIfAborted();
      const cached = storedVersions.get(image.url) === image.modifiedAt
        && cachedUrls?.has(new URL(image.url, location.href).href);
      if (this.completed.get(image.url) === image.modifiedAt || cached) {
        progress.completed++;
        progress.cached++;
        progress.loadedBytes += image.bytes;
        this.completed.set(image.url, image.modifiedAt);
      } else pending.push(image);
    }
    onProgress({...progress});
    let lastProgressUpdate = performance.now();
    let next = 0;
    let failure: unknown;
    async function download(): Promise<void> {
      while (!failure && next < pending.length) {
        signal.throwIfAborted();
        const image = pending[next++];
        try {
          if (await load(image)) progress.cached++;
          progress.completed++;
          progress.loadedBytes += image.bytes;
          const now = performance.now();
          if (progress.completed === progress.total || now - lastProgressUpdate >= 100) {
            lastProgressUpdate = now;
            onProgress({...progress});
          }
        } catch (error) {
          failure = error;
        }
      }
    }
    const load = async (image: ImageAsset): Promise<boolean> => {
      let cached = false;
      if (cache) {
        const stored = await cache.match(image.url);
        cached = stored?.headers.get(imageUpdatedHeader) === String(image.modifiedAt);
        if (!cached) {
          const response = await fetch(image.url, {cache: 'no-cache', signal});
          if (!response.ok) throw new Error(`图片下载失败：${image.url}（HTTP ${response.status}）`);
          const body = await response.blob();
          const headers = new Headers(response.headers);
          headers.delete('Content-Encoding');
          headers.delete('Content-Length');
          headers.delete('Vary');
          headers.set(imageUpdatedHeader, String(image.modifiedAt));
          await cache.put(image.url, new Response(body, {headers}));
        }
      } else {
        const unchanged = storedVersions.get(image.url) === image.modifiedAt;
        const response = await fetch(image.url, {cache: unchanged ? 'force-cache' : 'no-cache', signal});
        if (!response.ok) throw new Error(`图片下载失败：${image.url}（HTTP ${response.status}）`);
        await response.blob();
      }
      this.completed.set(image.url, image.modifiedAt);
      return cached;
    };
    await Promise.all(Array.from({length: Math.min(8, pending.length)}, () => download()));
    if (failure) throw failure;
    signal.throwIfAborted();
    if (pending.length > 0 || !storedManifest) {
      const manifest = JSON.stringify({images});
      if (cache) {
        await cache.put(imageManifestUrl, new Response(manifest, {
          headers: {'Content-Type': 'application/json'},
        }));
      } else {
        try {
          localStorage.setItem(browserManifestKey, manifest);
        } catch {
          // Resource readiness does not depend on browser storage permission.
        }
      }
    }
    signal.throwIfAborted();
    await document.fonts.load('16px "CDTank-Xiangjiao"');
  }

  private async openCache(): Promise<Cache | undefined> {
    if (!window.isSecureContext || !('serviceWorker' in navigator)) return undefined;
    await navigator.serviceWorker.register('/image-cache-worker.js', {scope: '/', updateViaCache: 'none'});
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {once: true});
      });
    }
    return caches.open(imageCacheName);
  }
}
