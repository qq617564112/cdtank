import {withResourceTimeout} from '../../assets/static-resources';
import './app-font.css';
import {loadSourceBitmapFonts} from './source-bitmap-font';
import {loadSourceReviewFonts} from './source-review-glyph';

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
    document.fonts.load('700 32px "CDTank Review UI Sans"', '好友玩家回上页创意点技能金币队伍密语聊天家族'),
    document.fonts.load('400 32px "CDTank Review UI Condensed"', 'G M'),
    loadSourceReviewFonts(),
    loadSourceBitmapFonts(),
  ]), '界面字体')
    .then(() => {}).catch(error => {loading = undefined; throw error;});
  return loading;
}
