import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mediumHtMetrics} from '../apps/web/src/interface/resources/source-bitmap-font.tsx';
const library=JSON.parse(readFileSync('recovery/output/web-assets/ui-fonts.json'));
const source=library.fonts.find(font=>font.name==='MediumHT');
const native=JSON.parse(readFileSync('recovery/output/room-card-id-font-scale-native.json'));
let rows=0;
for(const row of native.vectors.filter(row=>row.fontAutoScaled)){
  const result=mediumHtMetrics(source.glyphs,{width:row.displayProvider[0],height:row.displayProvider[1]});
  assert.equal(result.lineSpacing,row.lineSpacing);assert.equal(result.baseline,row.baseline);
  for(const glyph of result.glyphs){const original=row.glyphs.find(g=>g.codepoint===glyph.codepoint);assert.deepEqual([glyph.width,glyph.height,glyph.advance],[...original.imageSize,original.advance]);}
  rows++;
}
console.log('PASS:',rows,'original notify metric vectors, including actual baseline consumer input');
