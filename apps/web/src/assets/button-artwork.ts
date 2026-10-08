import catalogue from './button-artwork.json';
import './button-artwork.css';
import type {SourceTextStyle} from '../interface/resources/source-text-artwork';

interface ButtonArtwork {
  background: string | null;
  family: string;
  filter: string;
  text: SourceTextStyle;
}

const assets: Readonly<Record<string, ButtonArtwork>> = catalogue.assets;

export function buttonArtwork(path: string): ButtonArtwork | undefined {
  return assets[path.replace(/^\//, '')];
}

export const buttonBackgrounds = [...new Set(Object.values(assets).flatMap(artwork => artwork.background ? [artwork.background] : []))];

/** CSS body layers reuse the backgrounds already prepared in the image cache. */
export function bindButtonBackgrounds(resolve: (url: string) => string): void {
  for (const url of buttonBackgrounds) {
    const name = url.split('/').at(-1)!.replace(/\.png$/, '');
    document.documentElement.style.setProperty(`--source-button-${name}`, `url('${resolve(url)}')`);
  }
}
