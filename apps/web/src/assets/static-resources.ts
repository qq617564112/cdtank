const RESOURCE_TIMEOUT_MS = 30_000;
const jsonResources = new Map<string, Promise<unknown>>();

/** Share both the request and parsed directory across page sessions. */
export function loadStaticJson<T>(url: string): Promise<T> {
  const cached = jsonResources.get(url);
  if (cached) return cached as Promise<T>;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RESOURCE_TIMEOUT_MS);
  const loading = (async () => {
    const response = await fetch(url, {signal: controller.signal});
    if (!response.ok) throw new Error(`资源载入失败（HTTP ${response.status}）：${url}`);
    return await response.json() as T;
  })().catch(error => {
    jsonResources.delete(url);
    if (controller.signal.aborted) throw new Error(`资源载入超时，请重试：${url}`, {cause: error});
    throw error;
  }).finally(() => clearTimeout(timer));
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
