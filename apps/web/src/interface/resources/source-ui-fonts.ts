import {withResourceTimeout} from '../../assets/static-resources';
import './app-font.css';
import {loadSourceBitmapFonts} from './source-bitmap-font';

export interface SourceUiFont {
  name: string;
  attributes: Record<string, string>;
  asset?: string;
  family?: string;
  glyphCount?: number;
  glyphs?: {codepoint: number; asset: string; width: number; height: number}[];
}

export interface SourceUiFontLibrary {fonts: SourceUiFont[];}

let loading: Promise<void> | undefined;

/** Load the original dynamic face and source bitmap fonts. */
export function loadUiFont(): Promise<void> {
  loading ??= withResourceTimeout(Promise.all([
    document.fonts.load('16px "CDTank-SIMSUN"'),
    loadSourceBitmapFonts(),
  ]), '界面字体')
    .then(() => {}).catch(error => {loading = undefined; throw error;});
  return loading;
}
