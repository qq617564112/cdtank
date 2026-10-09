import type {CSSProperties} from 'react';
import {buttonArtwork} from './button-artwork';
import {imageResourceUrl, spriteImage} from './image-cache';
import {imageRegion} from './image-resources';
import './review-ui-shapes.css';
import './review-ui-labels.css';

/** Backgrounds stretch only their selected atlas rectangle to the element's box. */
export function imageBackgroundStyle(url: string, crop?: {left: number; width: number}): CSSProperties {
  url = buttonArtwork(url)?.background ?? url;
  const sprite = spriteImage(url);
  if (!sprite) return {backgroundImage: `url("${imageResourceUrl(url)}")`};
  const region = imageRegion(url, false)!;
  const width = region.image.width, height = region.image.height;
  const cellWidth = sprite.width * (crop?.width ?? 1);
  const cellX = sprite.x + sprite.width * (crop?.left ?? 0);
  return {
    backgroundImage: `url("${imageResourceUrl(sprite.atlas)}")`,
    backgroundSize: `${width / cellWidth * 100}% ${height / sprite.height * 100}%`,
    backgroundPosition: `${width === cellWidth ? 0 : cellX / (width - cellWidth) * 100}% ${height === sprite.height ? 0 : sprite.y / (height - sprite.height) * 100}%`,
    backgroundRepeat: 'no-repeat',
    filter: sprite.filter,
  };
}

/** Copy image properties when a source control supplies geometry for a different box. */
export function backgroundStyle(style?: CSSProperties): CSSProperties {
  return {backgroundImage: style?.backgroundImage, backgroundSize: style?.backgroundSize,
    backgroundPosition: style?.backgroundPosition, backgroundRepeat: style?.backgroundRepeat, filter: style?.filter};
}
