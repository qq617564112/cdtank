import {publishedImageUrl, spriteAtlas, spriteRegion, type SpriteRegion} from './sprite-images';

export interface ImageAsset {url: string; bytes: number; modifiedAt: number;}

interface CachedImage {url: string; version: number | string; blob: Blob;}
interface PreparedImage {url: string; version: number | string; cached: boolean; blob?: Blob;}
export interface FreshImage {url: string; version: number | string; blob: Blob;}

const DATABASE_NAME = 'cdtank-image-assets';
const STORE_NAME = 'images';
const versions = new Map<string, number | string>();
const preparedImages = new Map<string, PreparedImage>();
const loadingImages = new Map<string, Promise<PreparedImage>>();
const decodedAtlases = new Map<string, HTMLImageElement>();
const croppedSprites = new Map<SpriteRegion, string>();
let database: Promise<IDBDatabase> | undefined;

const imageKey = (url: string) => new URL(url, location.href).href;

/** Regions in the same atlas share one download, stored Blob and decoded image. */
export function imageResourceKey(url: string): string {
  return imageKey(publishedImageUrl(url)).split('#')[0];
}

function imageVersion(key: string): number | string {
  return versions.get(key) ?? key;
}

function openDatabase(): Promise<IDBDatabase> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {request.result.createObjectStore(STORE_NAME, {keyPath: 'url'});};
    request.onerror = () => reject(new Error('无法打开本地图片缓存，请允许站点存储后重试', {cause: request.error}));
    request.onsuccess = () => {
      const value = request.result;
      value.onversionchange = () => {value.close(); database = undefined;};
      resolve(value);
    };
  }).catch(error => {database = undefined; throw error;});
  return database;
}

function readImage(database: IDBDatabase, url: string): Promise<CachedImage | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(url);
    request.onsuccess = () => resolve(request.result as CachedImage | undefined);
    request.onerror = () => reject(new Error('本地图片缓存读取失败，请重试', {cause: request.error}));
  });
}

function writeImage(database: IDBDatabase, image: CachedImage, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    let settled = false;
    const cancel = () => {
      if (settled) return;
      settled = true;
      transaction.abort();
      reject(signal!.reason);
    };
    transaction.oncomplete = () => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', cancel);
      resolve();
    };
    transaction.onabort = () => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', cancel);
      reject(new Error('本地图片缓存保存失败，请检查站点存储空间后重试', {cause: transaction.error}));
    };
    signal?.addEventListener('abort', cancel, {once: true});
    transaction.objectStore(STORE_NAME).put(image);
  });
}

/** Published images use manifest versions; bundled images have build-versioned URLs. */
export async function prepareImageCache(images: readonly ImageAsset[], bundled: readonly string[]): Promise<void> {
  await openDatabase();
  for (const url of bundled) versions.set(imageResourceKey(url), imageResourceKey(url));
  for (const image of images) versions.set(imageResourceKey(image.url), image.modifiedAt);
}

/** Download missing images once, and commit each complete Blob before reporting readiness. */
export async function loadImageResource(url: string, signal?: AbortSignal): Promise<PreparedImage> {
  signal?.throwIfAborted();
  const key = imageResourceKey(url);
  if (key.startsWith('data:') || key.startsWith('blob:')) {
    return Promise.resolve({url: key, version: key, cached: true});
  }
  const version = imageVersion(key);
  const resourceKey = imageResourceKey(key);
  const prepared = preparedImages.get(resourceKey);
  if (prepared?.version === version) return Promise.resolve({...prepared, cached: true});
  const existing = loadingImages.get(resourceKey);
  if (existing) return existing;
  const loading = (async () => {
    const database = await openDatabase();
    const stored = await readImage(database, key);
    signal?.throwIfAborted();
    const cached = stored !== undefined && stored.version === version;
    let blob: Blob;
    if (stored && stored.version === version) blob = stored.blob;
    else {
      const response = await fetch(key, {cache: 'no-cache', signal});
      if (!response.ok) throw new Error(`图片下载失败：${url}（HTTP ${response.status}）`);
      blob = await response.blob();
      signal?.throwIfAborted();
      await writeImage(database, {url: key, version, blob});
    }
    signal?.throwIfAborted();
    if (prepared) URL.revokeObjectURL(prepared.url);
    const image = {url: URL.createObjectURL(blob), version, cached, blob};
    preparedImages.set(key, image);
    return image;
  })().finally(() => {loadingImages.delete(resourceKey);});
  loadingImages.set(resourceKey, loading);
  return loading;
}

/** Fetch a current network body for one image without touching the prepared owner. */
export async function loadFreshImage(url: string, signal?: AbortSignal): Promise<FreshImage> {
  const key = imageResourceKey(url);
  const version = imageVersion(key);
  const response = await fetch(key, {cache: 'no-cache', signal});
  if (!response.ok) throw new Error(`图片下载失败：${url}（HTTP ${response.status}）`);
  const blob = await response.blob();
  signal?.throwIfAborted();
  return {url: key, version, blob};
}

/** Replace one URL's stored Blob and prepared Blob URL under its existing version. */
export async function commitFreshImage(fresh: FreshImage, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  const database = await openDatabase();
  signal?.throwIfAborted();
  await writeImage(database, {url: fresh.url, version: fresh.version, blob: fresh.blob}, signal);
  signal?.throwIfAborted();
  const key = imageResourceKey(fresh.url);
  const prepared = preparedImages.get(key);
  if (prepared) URL.revokeObjectURL(prepared.url);
  preparedImages.set(key, {
    url: URL.createObjectURL(fresh.blob), version: fresh.version, cached: false, blob: fresh.blob,
  });
}

/** Retain atlas pixels for HTML consumers that need a complete image URL. */
export function rememberDecodedAtlas(url: string, image: HTMLImageElement): void {
  if (spriteAtlas(new URL(url, location.href).pathname)) decodedAtlases.set(imageResourceKey(url), image);
}

export function forgetDecodedAtlas(url: string): void {
  const key = imageResourceKey(url);
  decodedAtlases.delete(key);
  for (const sprite of croppedSprites.keys()) {
    if (imageResourceKey(sprite.atlas) === key) croppedSprites.delete(sprite);
  }
}

/** Crop only when an img, cursor or repeating background needs a complete image. */
export function imageResourceUrl(url: string): string {
  const region = spriteRegion(url);
  if (region) {
    const ready = croppedSprites.get(region);
    if (ready) return ready;
    const atlas = decodedAtlases.get(imageResourceKey(region.atlas));
    if (!atlas) throw new Error(`精灵图尚未解码：${region.atlas}`);
    const canvas = document.createElement('canvas');
    canvas.width = region.width;
    canvas.height = region.height;
    canvas.getContext('2d')!.drawImage(atlas, region.x, region.y, region.width, region.height,
      0, 0, region.width, region.height);
    const image = canvas.toDataURL('image/png');
    croppedSprites.set(region, image);
    return image;
  }
  const published = publishedImageUrl(url);
  const prepared = preparedImages.get(imageResourceKey(url));
  return prepared ? prepared.url + new URL(published, location.href).hash : published;
}

export function imageResourceBackground(url: string): string {
  return `url("${imageResourceUrl(url)}")`;
}

/** Release page-owned Blob URLs after the scene and UI have stopped using them. */
export function releaseImageResources(): void {
  for (const image of preparedImages.values()) URL.revokeObjectURL(image.url);
  preparedImages.clear();
  decodedAtlases.clear();
  croppedSprites.clear();
}
