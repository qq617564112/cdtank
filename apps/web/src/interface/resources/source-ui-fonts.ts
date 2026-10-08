import {withResourceTimeout} from '../../assets/static-resources';
import './source-text-artwork.css';

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

/** The selected app font is declared in app-font.css and shared across page sessions. */
export function loadUiFont(): Promise<void> {
  loading ??= withResourceTimeout(Promise.all([
    document.fonts.load('16px "CDTank-Xiangjiao"'),
    document.fonts.load('700 16px "CDTank-SourceSans"'),
    document.fonts.load('700 16px "CDTank-SourceLatin"'),
    document.fonts.load('700 16px "CDTank-SourceDigits"'),
  ]), '界面字体')
    .then(() => {}).catch(error => {loading = undefined; throw error;});
  return loading;
}
