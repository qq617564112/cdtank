import {loadStaticResourceBlob} from './static-resource-cache';

const RESOURCE_TIMEOUT_MS = 30_000;
const jsonResources = new Map<string, Promise<unknown>>();
const binaryResources = new Map<string, Promise<ArrayBuffer>>();
const resourceUrls = new Map<string, string>();

/** Models and sounds retain their downloaded bytes for later battle instances. */
export function loadStaticBinary(url: string): Promise<ArrayBuffer> {
  const key = new URL(url, location.href).href;
  const cached = binaryResources.get(key);
  if (cached) return cached;
  const loading = loadStaticResourceBlob(key).then(blob => blob.arrayBuffer()).catch(error => {
    binaryResources.delete(key);
    throw error;
  });
  binaryResources.set(key, loading);
  return loading;
}

/** Streaming audio uses a complete local body instead of starting another request. */
export async function prepareStaticResourceUrl(url: string): Promise<string> {
  const key = new URL(url, location.href).href;
  const bytes = await loadStaticBinary(key);
  let ready = resourceUrls.get(key);
  if (!ready) {
    ready = URL.createObjectURL(new Blob([bytes]));
    resourceUrls.set(key, ready);
  }
  return ready;
}

export function staticResourceUrl(url: string): string {
  return resourceUrls.get(new URL(url, location.href).href) ?? url;
}

export function releaseStaticResources(): void {
  for (const url of resourceUrls.values()) URL.revokeObjectURL(url);
  resourceUrls.clear();
  binaryResources.clear();
}

/** Share both the request and parsed directory across page sessions. */
export function loadStaticJson<T>(url: string): Promise<T> {
  const cached = jsonResources.get(url);
  if (cached) return cached as Promise<T>;
  const loading = loadStaticResourceBlob(url).then(async blob => JSON.parse(await blob.text()) as T).catch(error => {
    jsonResources.delete(url);
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
