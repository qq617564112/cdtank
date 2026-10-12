import {loadUiFont} from '../interface/resources/source-ui-fonts';
import {bundledImages, bundledImageUrls, decodeImageRegion} from './image-resources';
import {imageResourceKey, imageResourceUrl, loadImageResource, prepareImageCache,
  type ImageAsset} from './image-cache';
import {bindButtonBackgrounds, buttonArtwork} from './button-artwork';
import {prepareSpriteImages, type SpriteManifest} from './sprite-images';
import {bindImageBackgrounds} from './image-artwork';
import {prepareStaticResourceCache, type StaticResourceAsset} from './static-resource-cache';
import {prepareArtworkManifest} from './battle-artwork';

export interface ImageLoadingProgress {
  phase: 'download' | 'decode';
  completed: number;
  cached: number;
  total: number;
  decoded: number;
  decodeTotal: number;
  loadedBytes: number;
  totalBytes: number;
}

interface ImageManifest {images: ImageAsset[]; sprites?: SpriteManifest; resources: StaticResourceAsset[];}

const imageManifestUrl = '/manifests/image-assets.json';
const needsRaster = (url: string) => !buttonArtwork(url)?.background;

/** Download and decode UI images before entering the game. */
export class ImagePreloader {
  private manifest?: Promise<ImageAsset[]>;

  /** Prepare versions and local storage before even the loading artwork is requested. */
  prepare(signal: AbortSignal): Promise<ImageAsset[]> {
    signal.throwIfAborted();
    this.manifest ??= (async () => {
      const response = await fetch(imageManifestUrl, {cache: 'no-cache', signal});
      if (!response.ok) throw new Error(`图片目录加载失败（HTTP ${response.status}）`);
      const {images, sprites, resources} = await response.json() as ImageManifest;
      if (images.length === 0) throw new Error('图片资源目录为空');
      prepareStaticResourceCache(resources);
      await prepareArtworkManifest();
      prepareSpriteImages(sprites, bundledImages);
      const rasterImages = images.filter(image => needsRaster(image.url));
      await prepareImageCache(rasterImages, bundledImageUrls);
      const uiUrls = new Set([
        ...bundledImageUrls.map(imageResourceKey),
        ...(sprites?.atlases ?? []).map(atlas => imageResourceKey(atlas.url)),
        ...Object.keys(sprites?.images ?? {}).map(imageResourceKey),
      ]);
      const artwork = [...new Map<string, ImageAsset>(rasterImages.filter(image => uiUrls.has(imageResourceKey(image.url))
        || /^\/assets\/(?:ui|minimaps\/markers)\//.test(image.url))
        .map(image => [imageResourceKey(image.url), image])).values()];
      const atlases = sprites?.atlases ?? [];
      let nextAtlas = 0;
      await Promise.all(Array.from({length: Math.min(8, atlases.length)}, async () => {
        while (nextAtlas < atlases.length) {
          signal.throwIfAborted();
          await decodeImageRegion(atlases[nextAtlas++].url, signal);
        }
      }));
      bindImageBackgrounds();
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration('/');
        const workerUrl = new URL('/image-cache-worker.js', location.href).href;
        if (registration && [registration.active, registration.waiting, registration.installing]
          .some(worker => worker?.scriptURL === workerUrl)) await registration.unregister();
      }
      signal.throwIfAborted();
      return artwork;
    })().catch(error => {this.manifest = undefined; throw error;});
    return this.manifest;
  }

  async load(onProgress: (progress: ImageLoadingProgress) => void, signal: AbortSignal): Promise<void> {
    const images = await this.prepare(signal);
    const decodeUrls = [...new Set([...images.map(image => image.url), ...bundledImageUrls]
      .map(imageResourceKey))];
    const progress: ImageLoadingProgress = {
      phase: 'download', decoded: 0, decodeTotal: decodeUrls.length,
      completed: 0, cached: 0, total: images.length, loadedBytes: 0,
      totalBytes: images.reduce((total, image) => total + image.bytes, 0),
    };
    onProgress({...progress});
    let lastProgressUpdate = performance.now();
    let next = 0;
    let failure: unknown;
    async function download(): Promise<void> {
      while (!failure && next < images.length) {
        signal.throwIfAborted();
        const image = images[next++];
        try {
          const resource = await loadImageResource(image.url, signal);
          if (resource.cached) progress.cached++;
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
    await Promise.all(Array.from({length: Math.min(8, images.length)}, () => download()));
    if (failure) throw failure;
    signal.throwIfAborted();
    progress.phase = 'decode';
    onProgress({...progress});
    failure = undefined;
    next = 0;
    async function decode(): Promise<void> {
      while (!failure && next < decodeUrls.length) {
        signal.throwIfAborted();
        const url = decodeUrls[next++];
        try {
          await decodeImageRegion(url, signal);
          progress.decoded++;
          const now = performance.now();
          if (progress.decoded === progress.decodeTotal || now - lastProgressUpdate >= 100) {
            lastProgressUpdate = now;
            onProgress({...progress});
          }
        } catch (error) {
          failure = error;
        }
      }
    }
    await Promise.all(Array.from({length: Math.min(8, decodeUrls.length)}, () => decode()));
    if (failure) throw failure;
    signal.throwIfAborted();
    await loadUiFont();
    bindButtonBackgrounds(imageResourceUrl);
  }
}
