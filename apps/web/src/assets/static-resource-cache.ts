export interface StaticResourceAsset {url: string; bytes: number; modifiedAt: number;}

interface CachedResource {url: string; version: number; blob: Blob;}

const STORE_NAME = 'resources';
const versions = new Map<string, number>();
const downloads = new Map<string, Promise<Blob>>();
let database: Promise<IDBDatabase> | undefined;
let resourcePackBytes = 0;

/** The directory registers versions without downloading any game resources. */
export function prepareStaticResourceCache(resources: readonly StaticResourceAsset[]): void {
  for (const resource of resources) versions.set(new URL(resource.url, location.href).href, resource.modifiedAt);
  resourcePackBytes = resources.reduce((total, resource) => total + resource.bytes, 0);
}

export function getResourcePackBytes(): number {
  return resourcePackBytes;
}

function openDatabase(): Promise<IDBDatabase> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('cdtank-static-resources', 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, {keyPath: 'url'});
    request.onerror = () => reject(new Error('无法打开本地资源缓存，请允许站点存储后重试', {cause: request.error}));
    request.onsuccess = () => {
      const value = request.result;
      value.onversionchange = () => {value.close(); database = undefined;};
      resolve(value);
    };
  }).catch(error => {database = undefined; throw error;});
  return database;
}

async function readResource(url: string): Promise<CachedResource | undefined> {
  const store = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = store.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(url);
    request.onsuccess = () => resolve(request.result as CachedResource | undefined);
    request.onerror = () => reject(new Error('本地资源缓存读取失败，请重试', {cause: request.error}));
  });
}

async function writeResource(resource: CachedResource): Promise<void> {
  const store = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = store.transaction(STORE_NAME, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(new Error('本地资源缓存保存失败，请检查站点存储空间后重试',
      {cause: transaction.error}));
    transaction.objectStore(STORE_NAME).put(resource);
  });
}

/** Persist complete bodies and release them after the requesting consumer finishes. */
export function loadStaticResourceBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  signal?.throwIfAborted();
  const key = new URL(url, location.href).href;
  const existing = downloads.get(key);
  if (existing) return existing;
  const loading = (async () => {
    const version = versions.get(key);
    const stored = version === undefined ? undefined : await readResource(key);
    signal?.throwIfAborted();
    if (stored && stored.version === version) return stored.blob;
    const controller = new AbortController();
    const cancel = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', cancel, {once: true});
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(key, {cache: 'no-cache', signal: controller.signal});
      if (!response.ok) throw new Error(`资源载入失败（HTTP ${response.status}）：${url}`);
      const blob = await response.blob();
      controller.signal.throwIfAborted();
      if (version !== undefined) await writeResource({url: key, version, blob});
      signal?.throwIfAborted();
      return blob;
    } catch (error) {
      if (signal?.aborted) throw signal.reason;
      if (controller.signal.aborted) throw new Error(`资源载入超时，请重试：${url}`, {cause: error});
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  })().finally(() => downloads.delete(key));
  downloads.set(key, loading);
  return loading;
}
