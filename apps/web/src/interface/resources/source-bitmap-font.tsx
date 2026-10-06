import type {SourceStaticTextProps} from './source-static-text';
import {SourceStaticText} from './source-static-text';
import {type SourceUiFont} from './source-ui-fonts';

type BitmapGlyph = NonNullable<SourceUiFont['glyphs']>[number];

/** Original static-font metrics for an explicitly supplied source display size. */
export function mediumHtMetrics(glyphs: readonly BitmapGlyph[], sourceViewport: {width: number; height: number}) {
  const horizontal = Math.fround(Math.fround(sourceViewport.width) / 800);
  const vertical = Math.fround(Math.fround(sourceViewport.height) / 600);
  const scaled = glyphs.map(glyph => ({...glyph,
    width: Math.round(Math.fround(glyph.width * horizontal)),
    height: Math.round(Math.fround(glyph.height * vertical)),
    // Original x87 ftol truncates the native integer advance times the stored f32 factor.
    advance: Math.trunc(glyph.width * horizontal)}));
  const lineSpacing = Math.fround(Math.max(0, ...scaled.map(glyph => glyph.height)) * vertical);
  return {glyphs: scaled, lineSpacing, baseline: 0};
}

/** Dynamic former bitmap fields use the selected outline font within source bounds. */
export function SourceBitmapStaticText(props: SourceStaticTextProps) {
  return <SourceStaticText {...props}/>;
}
