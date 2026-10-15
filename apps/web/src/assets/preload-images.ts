import {loadUiFont} from '../interface/resources/source-ui-fonts';
import {battleUiLayouts, forgetPreparedSourceUi, prepareSourceUi, STARTUP_UI_LAYOUTS} from '../interface/resources/source-ui-resources';
import {prepareSourcePageImages} from '../interface/resources/source-page-images';
import {bundledImages, bundledImageUrls, decodeImageRegion, forgetDecodedImage} from './image-resources';
import {imageResourceKey, imageResourceUrl, loadImageResource, prepareImageCache,
  releasePreparedImage, type ImageAsset} from './image-cache';
import {bindButtonBackgrounds} from './button-artwork';
import {prepareSpriteImages, selectSpriteScope, type SpriteManifest, type UiSpriteScope} from './sprite-images';
import {bindImageBackgrounds} from './image-artwork';
import {prepareStaticResourceCache, type StaticResourceAsset} from './static-resource-cache';
import {prepareArtworkManifest} from './battle-artwork';
import {isMobileDevice} from '../platform/device';

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

interface ImageManifest {images: ImageAsset[]; sprites: SpriteManifest; resources: StaticResourceAsset[];}

const imageManifestUrl = '/manifests/image-assets.json';

export function uiSpriteScope(battle: boolean): UiSpriteScope {
  return battle ? isMobileDevice() ? 'mobile-battle' : 'desktop-battle' : 'lobby';
}

/** Download and decode only the active page's independent UI package. */
export class ImagePreloader {
  private manifest?: Promise<ImageAsset[]>;
  private sprites?: SpriteManifest;
  private scope?: UiSpriteScope;
  private readonly uiImages = new Set<string>();
  private readonly battleWaiters = new Set<{resolve: () => void; reject: (error: unknown) => void}>();
  private battleUiError?: unknown;
  readyScope?: UiSpriteScope;

  /** Register all versions and retain only UI preload records for later package switches. */
  prepare(signal: AbortSignal, selected = uiSpriteScope(false)): Promise<ImageAsset[]> {
    signal.throwIfAborted();
    this.manifest ??= (async () => {
      const response = await fetch(imageManifestUrl, {cache: 'no-cache', signal});
      if (!response.ok) throw new Error(`图片目录加载失败（HTTP ${response.status}）`);
      const {images, sprites, resources} = await response.json() as ImageManifest;
      if (images.length === 0) throw new Error('图片资源目录为空');
      prepareStaticResourceCache(resources);
      await prepareArtworkManifest();
      this.sprites = sprites;
      prepareSpriteImages(sprites, bundledImages, selected);
      const preloadImages = new Set<string>();
      for (const atlas of sprites.atlases) this.uiImages.add(imageResourceKey(atlas.url));
      for (const value of Object.values(sprites.scopes)) {
        for (const url of value.preload) preloadImages.add(imageResourceKey(url));
        for (const image of Object.values(value.images)) {
          this.uiImages.add(imageResourceKey('atlas' in image ? image.atlas : image.url));
        }
      }
      this.activateScope(selected);
      await prepareImageCache(images, bundledImageUrls);
      // Loading failures share the dialog grain supplied by every package.
      await decodeImageRegion('/ui/cards/mdf-texture.webp', signal);
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration('/');
        const workerUrl = new URL('/image-cache-worker.js', location.href).href;
        if (registration && [registration.active, registration.waiting, registration.installing]
          .some(worker => worker?.scriptURL === workerUrl)) await registration.unregister();
      }
      signal.throwIfAborted();
      return images.filter(image => preloadImages.has(imageResourceKey(image.url)));
    })().catch(error => {this.manifest = undefined; throw error;});
    return this.manifest;
  }

  /** Called after React has unmounted consumers belonging to the previous package. */
  activateScope(selected: UiSpriteScope): void {
    if (this.scope === selected) return;
    for (const url of this.uiImages) {
      forgetDecodedImage(url);
      releasePreparedImage(url);
    }
    this.readyScope = undefined;
    this.scope = selected;
    selectSpriteScope(selected);
    forgetPreparedSourceUi();
    bindImageBackgrounds(new Set());
    if (selected === 'lobby') this.finishBattleWaiters(new DOMException('已返回大厅', 'AbortError'));
  }

  /** Server readiness also waits for the device's HUD and shared battle dialogs. */
  waitForBattleUi(): Promise<void> {
    if (this.readyScope === uiSpriteScope(true)) return Promise.resolve();
    if (this.battleUiError) return Promise.reject(this.battleUiError);
    return new Promise((resolve, reject) => {this.battleWaiters.add({resolve, reject});});
  }

  private finishBattleWaiters(error?: unknown): void {
    for (const waiter of this.battleWaiters) {
      if (error) waiter.reject(error);
      else waiter.resolve();
    }
    this.battleWaiters.clear();
  }

  /** Loading artwork is released after the combat page replaces the loading page. */
  releaseLoadingImages(): void {
    for (const [asset, image] of Object.entries(this.sprites!.scopes[this.scope!].images)) {
      if (!/^\/Data\/ui\/loading\/[1-5]\.webp$/.test(asset)) continue;
      const url = 'atlas' in image ? image.atlas : image.url;
      forgetDecodedImage(url);
      releasePreparedImage(url);
    }
  }

  async load(onProgress: (progress: ImageLoadingProgress) => void, signal: AbortSignal,
    scope: 'ui' | 'battle' = 'ui'): Promise<void> {
    if (scope === 'battle') this.battleUiError = undefined;
    try {
      await this.loadSelected(onProgress, signal, uiSpriteScope(scope === 'battle'));
      if (scope === 'battle') this.finishBattleWaiters();
    } catch (error) {
      if (scope === 'battle' && this.scope === uiSpriteScope(true) && !signal.aborted) {
        this.battleUiError = error;
        this.finishBattleWaiters(error);
      }
      throw error;
    }
  }

  private async loadSelected(onProgress: (progress: ImageLoadingProgress) => void, signal: AbortSignal,
    selected: UiSpriteScope): Promise<void> {
    const artwork = await this.prepare(signal, selected);
    signal.throwIfAborted();
    if (this.scope !== selected) throw new DOMException('界面已切换', 'AbortError');
    if (this.readyScope === selected) return;
    const preload = new Set(this.sprites!.scopes[selected].preload.map(imageResourceKey));
    const images = artwork.filter(image => preload.has(imageResourceKey(image.url)));
    const decodeUrls = [...preload];
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
    signal.throwIfAborted();
    await prepareSourcePageImages(signal);
    await prepareSourceUi(selected === 'lobby' ? STARTUP_UI_LAYOUTS : battleUiLayouts(isMobileDevice()), signal);
    signal.throwIfAborted();
    if (this.scope !== selected) throw new DOMException('界面已切换', 'AbortError');
    bindImageBackgrounds(preload);
    bindButtonBackgrounds(imageResourceUrl);
    this.readyScope = selected;
  }
}

export const pageImages = new ImagePreloader();
