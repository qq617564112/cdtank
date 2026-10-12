/// <reference types="vite/client" />
import {withResourceTimeout} from './static-resources';
import {commitFreshImage, forgetDecodedAtlas, imageResourceKey, imageResourceUrl, loadFreshImage,
  loadImageResource, rememberDecodedAtlas} from './image-cache';
import {publishedImageUrl, spriteRegion, type SpriteRegion} from './sprite-images';

export const bundledImages = import.meta.glob<string>(
  '../**/*.{png,jpg,jpeg,gif,webp,svg,avif,bmp,ico}',
  {eager: true, import: 'default', query: '?url'},
);
export const bundledImageUrls = Object.values(bundledImages);

const decodedImages = new Map<string, Promise<HTMLImageElement>>();
const readyImages = new Map<string, HTMLImageElement>();
const croppedImages = new Map<SpriteRegion, Promise<HTMLImageElement>>();
const needsFreshResponse = new Set<string>();

export interface ImageRegion {
  image: HTMLImageElement | HTMLCanvasElement;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** UI and Canvas reuse an atlas while retaining each image's original bounds. */
export function imageRegion(url: string): ImageRegion | undefined {
  const image = readyImages.get(imageResourceKey(url));
  const region = spriteRegion(url);
  if (image && region) return {image, x: region.x, y: region.y, width: region.width, height: region.height};
  return image ? {image, x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight} : undefined;
}

export async function decodeImageRegion(url: string, signal?: AbortSignal): Promise<ImageRegion> {
  signal?.throwIfAborted();
  const ready = imageRegion(url);
  if (ready) return ready;
  await decodePublishedImage(publishedImageUrl(url), signal);
  return imageRegion(url)!;
}

export function drawImageRegion(context: Pick<CanvasRenderingContext2D, 'drawImage'>, region: ImageRegion,
  x: number, y: number, width = region.width, height = region.height): void {
  context.drawImage(region.image, region.x, region.y, region.width, region.height, x, y, width, height);
}

/** Complete images remain available to cursor and natural-size consumers. */
export async function decodeImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  signal?.throwIfAborted();
  const region = spriteRegion(url);
  if (!region) return decodePublishedImage(publishedImageUrl(url), signal);
  await decodeImageRegion(url, signal);
  signal?.throwIfAborted();
  const existing = croppedImages.get(region);
  if (existing) return existing;
  const image = new Image();
  image.src = imageResourceUrl(url);
  const loading = withResourceTimeout(image.decode(), url).then(() => image).catch(error => {
    croppedImages.delete(region);
    throw error;
  });
  croppedImages.set(region, loading);
  return loading;
}

/** Retain one complete decoded image per published file. */
async function decodePublishedImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
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
    rememberDecodedAtlas(url, image);
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
  readyImages.delete(imageResourceUrl(publishedImageUrl(url)));
  readyImages.delete(key);
  needsFreshResponse.delete(key);
  forgetDecodedAtlas(url);
  for (const region of croppedImages.keys()) {
    if (imageResourceKey(region.atlas) === key) croppedImages.delete(region);
  }
}
