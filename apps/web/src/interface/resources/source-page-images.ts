import {imageResourceBackground, imageResourceUrl} from '../../assets/image-cache';
import {decodeImage} from '../../assets/image-resources';

const normalCursorUrl = '/local-images/assets/ui/normal-cursor.png';
const normalCursorHdUrl = '/local-images/assets/ui/normal-cursor-hd.png';
const inputCursorUrl = '/Data/ui/imagesets/InputCursor.png';
const pageIconUrl = new URL('../../assets/ui/client-icon.ico', import.meta.url).href;

/** Attach page artwork only after its images are ready in the shared cache. */
export async function prepareSourcePageImages(signal: AbortSignal): Promise<void> {
  const [, , inputCursor] = await Promise.all([
    decodeImage(normalCursorUrl, signal), decodeImage(normalCursorHdUrl, signal),
    decodeImage(inputCursorUrl, signal), decodeImage(pageIconUrl, signal),
  ]);
  signal.throwIfAborted();
  const style = document.documentElement.style;
  style.setProperty('--source-normal-cursor', `${imageResourceBackground(normalCursorUrl)} 2 4, default`);
  style.setProperty('--source-normal-cursor-images',
    `image-set(${imageResourceBackground(normalCursorUrl)} 1x, ${imageResourceBackground(normalCursorHdUrl)} 4x) 2 4, default`);
  style.setProperty('--source-input-cursor',
    `image-set(${imageResourceBackground(inputCursorUrl)} ${inputCursor.naturalWidth / 32}x) 16 16, text`);
  let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement('link');
    icon.rel = 'icon';
    document.head.append(icon);
  }
  icon.type = 'image/x-icon';
  icon.sizes.value = '16x16 24x24 32x32 48x48 64x64 128x128 256x256';
  icon.href = imageResourceUrl(pageIconUrl);
}
