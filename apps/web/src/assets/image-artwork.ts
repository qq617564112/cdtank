import type {CSSProperties} from 'react';
import {imageResourceUrl} from './image-cache';

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
export function bindImageBackgrounds(): void {
  const backgrounds: Record<string, string> = {
    'login-background': '/ui/login/background-4k.png',
    'scroll-thumb-middle': '/ui/home/scroll-thumb-middle.png',
    'settings-pumpkin': '/ui/settings/pumpkin.png',
    'settings-red-field': '/ui/settings/red-field.svg',
    'room-warm-footer': '/ui/room-create/panels.svg#warm-footer',
  };
  for (const [name, url] of Object.entries(backgrounds)) {
    document.documentElement.style.setProperty(`--image-${name}`, `url("${imageResourceUrl(url)}")`);
  }
}
