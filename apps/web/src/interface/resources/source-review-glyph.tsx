import type {ComponentPropsWithoutRef} from 'react';
import {SOURCE_REVIEW_GLYPHS} from './source-review-glyph-data';
import './source-review-glyph.css';

export interface SourceReviewGlyphStyle {
  text: string;
  font: 'sans' | 'heavy';
  width: number;
  height: number;
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
  strokeWidth: number;
  fill: string;
  shadow?: {
    x: number;
    y: number;
    color: string;
    opacity: number;
  };
}

export function sourceReviewGlyph(asset: string): SourceReviewGlyphStyle | undefined {
  return SOURCE_REVIEW_GLYPHS[asset.replace(/^\//, '')];
}

/** Selected source glyphs use outline fonts within their original image boxes. */
export function SourceReviewGlyph({asset, glyph, fit = 'stretch', style, ...props}: {
  asset: string;
  glyph: SourceReviewGlyphStyle;
  fit?: 'stretch' | 'contain';
} & ComponentPropsWithoutRef<'span'>) {
  return <span role="img" aria-label={glyph.text} {...props} data-image-artwork=""
    data-source-asset={asset.replace(/^\//, '')} data-image-fit={fit} data-review-font={glyph.font}
    style={{display: 'inline-block', width: glyph.width, height: glyph.height, ...style}}>
    <svg width="100%" height="100%" viewBox={`0 0 ${glyph.width} ${glyph.height}`}
      preserveAspectRatio={fit === 'contain' ? 'xMidYMid meet' : 'none'} aria-hidden="true"
      style={{display: 'block', overflow: 'hidden', pointerEvents: 'none'}}>
      {glyph.shadow && <text x={glyph.x} y={glyph.y}
        transform={`translate(${glyph.left + glyph.shadow.x} ${glyph.top + glyph.shadow.y}) scale(${glyph.scaleX} ${glyph.scaleY})`}
        fill={glyph.shadow.color} opacity={glyph.shadow.opacity}>{glyph.text}</text>}
      <text x={glyph.x} y={glyph.y}
        transform={`translate(${glyph.left} ${glyph.top}) scale(${glyph.scaleX} ${glyph.scaleY})`}
        fill={glyph.fill} stroke="#000" strokeWidth={glyph.strokeWidth} strokeLinejoin="round"
        style={{paintOrder: 'stroke fill'}}>{glyph.text}</text>
    </svg>
  </span>;
}

export function loadSourceReviewFonts(): Promise<void> {
  return Promise.all([
    document.fonts.load('700 128px "CDTank Review Sans"', '0123456789×∞%+=-:BENS'),
    document.fonts.load('900 128px "CDTank Review Heavy"', '0123456789∞BENS'),
  ]).then(() => {});
}
