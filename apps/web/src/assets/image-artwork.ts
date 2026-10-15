import type {CSSProperties} from 'react';
import {imageResourceKey, imageResourceUrl} from './image-cache';
import {spriteImage} from './sprite-images';

/** Backgrounds retain single-image sizing, tiling and crop behavior. */
export function imageBackgroundStyle(url: string): CSSProperties {
  return {backgroundImage: `url("${imageResourceUrl(url)}")`};
}

/** Copy image properties when a source control supplies geometry for a different box. */
export function backgroundStyle(style?: CSSProperties): CSSProperties {
  return {backgroundImage: style?.backgroundImage, backgroundSize: style?.backgroundSize,
    backgroundPosition: style?.backgroundPosition, backgroundRepeat: style?.backgroundRepeat, filter: style?.filter};
}

/** Static CSS artwork uses the same prepared images as component backgrounds. */
export function bindImageBackgrounds(retained?: ReadonlySet<string>): void {
  const backgrounds: Record<string, string> = {
    'login-background': '/ui/login/background-4k.png',
    'scroll-thumb-middle': '/ui/home/scroll-thumb-middle.png',
    'settings-pumpkin': '/ui/settings/pumpkin.png',
    'settings-red-field': '/ui/settings/red-field.svg',
    'room-warm-footer': '/ui/room-create/panels.svg#warm-footer',
  };
  for (const [name, url] of Object.entries(backgrounds)) {
    if (!spriteImage(url) || retained && !retained.has(imageResourceKey(url))) {
      document.documentElement.style.removeProperty(`--image-${name}`);
      continue;
    }
    document.documentElement.style.setProperty(`--image-${name}`, `url("${imageResourceUrl(url)}")`);
  }
}
