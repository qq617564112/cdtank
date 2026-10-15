import {loadStaticResourceBlob} from './static-resource-cache';

const RESOURCE_TIMEOUT_MS = 30_000;
const jsonResources = new Map<string, Promise<unknown>>();
const binaryResources = new Map<string, Promise<ArrayBuffer>>();

/** Share pending reads; consumed bytes are owned by their decoder, not the cache. */
export function loadStaticBinary(url: string): Promise<ArrayBuffer> {
  const key = new URL(url, location.href).href;
  const cached = binaryResources.get(key);
  if (cached) return cached;
  const loading = loadStaticResourceBlob(key).then(blob => blob.arrayBuffer()).finally(() => {
    if (binaryResources.get(key) === loading) binaryResources.delete(key);
  });
  binaryResources.set(key, loading);
  return loading;
}

export function releaseStaticResources(): void {
  binaryResources.clear();
  jsonResources.clear();
}

/** Parsed map data is owned by the active scene; IndexedDB retains the files. */
export function releaseStaticJsonResources(prefix: string): void {
  for (const url of jsonResources.keys()) {
    if (new URL(url, location.href).pathname.startsWith(prefix)) jsonResources.delete(url);
  }
}

/** Share both the request and parsed directory across page sessions. */
export function loadStaticJson<T>(url: string, retain = true): Promise<T> {
  if (!retain) return loadStaticResourceBlob(url).then(async blob => JSON.parse(await blob.text()) as T);
  const cached = jsonResources.get(url);
  if (cached) return cached as Promise<T>;
  const loading = loadStaticResourceBlob(url).then(async blob => JSON.parse(await blob.text()) as T).catch(error => {
    if (jsonResources.get(url) === loading) jsonResources.delete(url);
    throw error;
  });
  jsonResources.set(url, loading);
  return loading;
}

/** Image decoding and FontFace loading do not accept an AbortSignal. */
export function withResourceTimeout<T>(loading: Promise<T>, resource: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`资源载入超时，请重试：${resource}`)), RESOURCE_TIMEOUT_MS);
    void loading.then(value => {clearTimeout(timer); resolve(value);}, error => {clearTimeout(timer); reject(error);});
  });
}
