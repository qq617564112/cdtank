import catalogue from './simple-ui-artwork.json';
import './simple-ui-artwork.css';
import {buttonArtwork} from './button-artwork';

const assets: Readonly<Record<string, string>> = catalogue.assets;

/** Basic UI shapes are drawn by the owning HTML element's CSS layers. */
export function isSimpleUiImage(path: string): boolean {
  const button = buttonArtwork(path);
  return assets[path.replace(/^\//, '')] !== undefined || button !== undefined && button.background === null;
}
