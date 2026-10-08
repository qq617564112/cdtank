import glyphs from '../../assets/reviewed-ui-glyphs.json';
import './reviewed-font-glyph.css';

interface OutlineGlyph {
  text: string;
  font: string;
  box: readonly number[];
  fill: string;
  stroke: number;
  shadow: number;
}

const outlines: Readonly<Record<string, OutlineGlyph>> = glyphs;

export function reviewedFontGlyph(asset: string): OutlineGlyph | undefined {
  return outlines[asset];
}

export function loadReviewedGlyphFonts(): Promise<FontFace[][]> {
  return Promise.all(['CDTank Review Sans', 'CDTank Review Heavy']
    .map(font => document.fonts.load(`700 64px "${font}"`)));
}

/** Render the requested outline face inside the original glyph's ink bounds. */
export function ReviewedFontGlyph({asset, width, height}: {asset: string; width: number; height: number}) {
  const glyph = outlines[asset];
  return <canvas width={width * 4} height={height * 4} aria-hidden="true"
    data-source-text-image={asset} data-source-font-rendered={glyph.text}
    style={{display: 'block', flex: '0 0 auto', width, height}}
    ref={canvas => {
      if (!canvas) return;
      const context = canvas.getContext('2d')!;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.font = `700 64px "${glyph.font}"`;
      const metrics = context.measureText(glyph.text);
      const [left, top, right, bottom] = glyph.box;
      const scaleX = (right - left) * 4 / (metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight);
      const scaleY = (bottom - top) * 4 / (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent);
      context.save();
      context.translate(left * 4 + metrics.actualBoundingBoxLeft * scaleX,
        top * 4 + metrics.actualBoundingBoxAscent * scaleY);
      context.scale(scaleX, scaleY);
      context.lineJoin = 'round';
      if (glyph.shadow) {
        context.fillStyle = 'rgba(0,0,0,0.75)';
        context.fillText(glyph.text, glyph.shadow * 4 / scaleX, glyph.shadow * 4 / scaleY);
      }
      if (glyph.stroke) {
        context.lineWidth = glyph.stroke * 8 / Math.min(scaleX, scaleY);
        context.strokeStyle = '#000';
        context.strokeText(glyph.text, 0, 0);
      }
      context.fillStyle = glyph.fill;
      context.fillText(glyph.text, 0, 0);
      context.restore();
    }}/>;
}
