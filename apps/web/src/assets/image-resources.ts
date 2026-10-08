/// <reference types="vite/client" />
import {withResourceTimeout} from './static-resources';
import {commitFreshImage, imageResourceKey, imageResourceUrl, loadFreshImage, loadImageResource, prepareSpriteImages, spriteImage} from './image-cache';

export const bundledImageUrls = Object.values(import.meta.glob<string>(
  '../**/*.{png,jpg,jpeg,gif,webp,svg,avif,bmp,ico}',
  {eager: true, import: 'default', query: '?url'},
));

const decodedImages = new Map<string, Promise<HTMLImageElement>>();
const readyImages = new Map<string, HTMLImageElement>();
const needsFreshResponse = new Set<string>();

export interface ImageRegion {
  image: HTMLImageElement | HTMLCanvasElement;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** UI and Canvas share the complete decoded sheet and select a source rectangle. */
export function imageRegion(url: string): ImageRegion | undefined {
  const sprite = spriteImage(url);
  const image = readyImages.get(imageResourceKey(sprite?.atlas ?? url));
  return image ? {image, x: sprite?.x ?? 0, y: sprite?.y ?? 0,
    width: sprite?.width ?? image.naturalWidth, height: sprite?.height ?? image.naturalHeight} : undefined;
}

export async function decodeImageRegion(url: string, signal?: AbortSignal): Promise<ImageRegion> {
  await prepareSpriteImages();
  signal?.throwIfAborted();
  const ready = imageRegion(url);
  if (ready) return ready;
  await decodeImage(spriteImage(url)?.atlas ?? url, signal);
  return imageRegion(url)!;
}

export function drawImageRegion(context: Pick<CanvasRenderingContext2D, 'drawImage'>, region: ImageRegion,
  x: number, y: number, width = region.width, height = region.height): void {
  context.drawImage(region.image, region.x, region.y, region.width, region.height, x, y, width, height);
}

/** Retain decoded images for startup and every subsequent page. */
export async function decodeImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  signal?.throwIfAborted();
  await prepareSpriteImages();
  signal?.throwIfAborted();
  const key = imageResourceKey(url);
  const existing = decodedImages.get(key);
  if (existing) return existing;
  const fresh = needsFreshResponse.has(key);
  const image = new Image();
  const controller = new AbortController();
  let abort: (() => void) | undefined;
  const loading = new Promise<HTMLImageElement>((resolve, reject) => {
    abort = () => {controller.abort(signal?.reason); image.removeAttribute('src'); reject(controller.signal.reason);};
    signal?.addEventListener('abort', abort, {once: true});
    const ready = fresh
      ? loadFreshImage(url, controller.signal).then(async freshImage => {
          controller.signal.throwIfAborted();
          const tempUrl = URL.createObjectURL(freshImage.blob);
          const releaseTemp = () => URL.revokeObjectURL(tempUrl);
          controller.signal.addEventListener('abort', releaseTemp, {once: true});
          try {
            image.src = tempUrl;
            await image.decode();
            controller.signal.throwIfAborted();
            await commitFreshImage(freshImage, controller.signal);
            controller.signal.throwIfAborted();
            needsFreshResponse.delete(key);
            return image;
          } finally {
            controller.signal.removeEventListener('abort', releaseTemp);
            releaseTemp();
          }
        })
      : loadImageResource(url, controller.signal).then(async resource => {
          controller.signal.throwIfAborted();
          image.src = resource.url;
          await image.decode();
          return image;
        });
    void withResourceTimeout(ready, url).then(resolve, reject);
  }).then(image => {
    readyImages.set(key, image);
    readyImages.set(imageResourceUrl(url), image);
    return image;
  }).catch(error => {
    if (decodedImages.get(key) === loading) decodedImages.delete(key);
    image.removeAttribute('src');
    if (signal?.aborted) throw error;
    needsFreshResponse.add(key);
    throw new Error(`图片解码失败：${url}`, {cause: error});
  }).finally(() => {
    controller.abort();
    if (abort) signal?.removeEventListener('abort', abort);
  });
  decodedImages.set(key, loading);
  return loading;
}

/** A downloaded replacement must also replace the image retained in memory. */
export function forgetDecodedImage(url: string): void {
  const key = imageResourceKey(url);
  decodedImages.delete(key);
  readyImages.delete(imageResourceUrl(url));
  readyImages.delete(key);
  needsFreshResponse.delete(key);
}
