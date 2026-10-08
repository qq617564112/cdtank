import {loadStaticJson} from './static-resources';

export interface ImageAsset {url: string; bytes: number; modifiedAt: number;}

export interface SpriteImage {atlas: string; x: number; y: number; width: number; height: number;}
interface SpriteDirectory {images: Record<string, SpriteImage>;}

interface CachedImage {url: string; version: number | string; blob: Blob;}
interface PreparedImage {url: string; version: number | string; cached: boolean; blob?: Blob;}
export interface FreshImage {url: string; version: number | string; blob: Blob;}

const DATABASE_NAME = 'cdtank-image-assets';
const STORE_NAME = 'images';
const versions = new Map<string, number | string>();
const preparedImages = new Map<string, PreparedImage>();
const loadingImages = new Map<string, Promise<PreparedImage>>();
let database: Promise<IDBDatabase> | undefined;
let sprites: Promise<SpriteDirectory> | undefined;
const spriteImages = new Map<string, SpriteImage>();
const atlasImages = new Map<string, Promise<ImageBitmap>>();

const imageKey = (url: string) => new URL(url, location.href).href;

/** Identical atlas cells share one prepared URL and decoded image. */
export function imageResourceKey(url: string): string {
  const key = imageKey(url);
  const sprite = spriteImages.get(key);
  return sprite ? `${imageKey(sprite.atlas)}#${sprite.x},${sprite.y},${sprite.width},${sprite.height}` : key;
}

export function prepareSpriteImages(): Promise<SpriteDirectory> {
  sprites ??= loadStaticJson<SpriteDirectory>('/sprite-images.json').then(directory => {
    for (const [path, sprite] of Object.entries(directory.images)) spriteImages.set(imageKey(path), sprite);
    return directory;
  }).catch(error => {sprites = undefined; throw error;});
  return sprites;
}

function imageVersion(key: string): number | string {
  const sprite = spriteImages.get(key);
  return versions.get(sprite ? imageKey(sprite.atlas) : key) ?? key;
}

async function spriteBody(sprite: SpriteImage, source: PreparedImage): Promise<Blob> {
  let atlas = atlasImages.get(source.url);
  if (!atlas) {
    atlas = createImageBitmap(source.blob!).catch(error => {atlasImages.delete(source.url); throw error;});
    atlasImages.set(source.url, atlas);
  }
  const image = await atlas;
  const canvas = document.createElement('canvas');
  canvas.width = sprite.width; canvas.height = sprite.height;
  const context = canvas.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  context.drawImage(image, sprite.x, sprite.y, sprite.width, sprite.height,
    0, 0, sprite.width, sprite.height);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => {
    canvas.width = 0; canvas.height = 0;
    if (blob) resolve(blob);
    else reject(new Error('精灵图裁切失败，请重试'));
  }, 'image/png'));
}

function releaseAtlasBitmap(key: string): void {
  const atlas = atlasImages.get(key);
  if (atlas) void atlas.then(image => image.close(), () => {});
  atlasImages.delete(key);
}

/** Release the temporary full sheet after its original-size images are ready. */
export function releaseSpriteAtlas(url: string): void {
  const source = preparedImages.get(imageKey(url));
  if (source) releaseAtlasBitmap(source.url);
}

export function releaseSpriteAtlases(): void {
  for (const key of atlasImages.keys()) releaseAtlasBitmap(key);
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
  await Promise.all([openDatabase(), prepareSpriteImages()]);
  for (const url of bundled) versions.set(imageKey(url), imageKey(url));
  for (const image of images) versions.set(imageKey(image.url), image.modifiedAt);
}

/** Download missing images once, and commit each complete Blob before reporting readiness. */
export async function loadImageResource(url: string, signal?: AbortSignal): Promise<PreparedImage> {
  signal?.throwIfAborted();
  await prepareSpriteImages();
  signal?.throwIfAborted();
  const key = imageKey(url);
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
    const sprite = spriteImages.get(key);
    if (sprite) {
      const atlas = await loadImageResource(sprite.atlas, signal);
      const blob = await spriteBody(sprite, atlas);
      signal?.throwIfAborted();
      if (prepared) URL.revokeObjectURL(prepared.url);
      const image = {url: URL.createObjectURL(blob), version, cached: atlas.cached, blob};
      preparedImages.set(resourceKey, image);
      return image;
    }
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
  await prepareSpriteImages();
  const key = imageKey(url);
  const version = imageVersion(key);
  const sprite = spriteImages.get(key);
  if (sprite) {
    const freshAtlas = await loadFreshImage(sprite.atlas, signal);
    const atlasUrl = URL.createObjectURL(freshAtlas.blob);
    let blob: Blob;
    try {
      blob = await spriteBody(sprite, {...freshAtlas, url: atlasUrl, cached: false});
      await commitFreshImage(freshAtlas, signal);
    } finally {releaseAtlasBitmap(atlasUrl); URL.revokeObjectURL(atlasUrl);}
    return {url: key, version, blob};
  }
  const response = await fetch(key, {cache: 'no-cache', signal});
  if (!response.ok) throw new Error(`图片下载失败：${url}（HTTP ${response.status}）`);
  const blob = await response.blob();
  signal?.throwIfAborted();
  return {url: key, version, blob};
}

/** Replace one URL's stored Blob and prepared Blob URL under its existing version. */
export async function commitFreshImage(fresh: FreshImage, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  if (!spriteImages.has(fresh.url)) {
    const database = await openDatabase();
    signal?.throwIfAborted();
    await writeImage(database, {url: fresh.url, version: fresh.version, blob: fresh.blob}, signal);
  }
  signal?.throwIfAborted();
  const key = imageResourceKey(fresh.url);
  const prepared = preparedImages.get(key);
  if (prepared) {releaseAtlasBitmap(prepared.url); URL.revokeObjectURL(prepared.url);}
  preparedImages.set(key, {
    url: URL.createObjectURL(fresh.blob), version: fresh.version, cached: false, blob: fresh.blob,
  });
}

/** UI and engine consumers reuse the Blob URLs prepared before game startup. */
export function imageResourceUrl(url: string): string {
  return preparedImages.get(imageResourceKey(url))?.url ?? url;
}

export function imageResourceBackground(url: string): string {
  return `url("${imageResourceUrl(url)}")`;
}

/** Release page-owned Blob URLs after the scene and UI have stopped using them. */
export function releaseImageResources(): void {
  for (const image of preparedImages.values()) URL.revokeObjectURL(image.url);
  preparedImages.clear();
  releaseSpriteAtlases();
}
