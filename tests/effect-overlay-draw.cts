import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {effectOverlayVertices, EffectOverlayDrawState, EffectOverlayRectangle, EffectOverlayVertex} from '../apps/web/src/render/effects/overlays/effect-overlay-draw';
import {EffectColor} from '../apps/web/src/render/effects/common/types';
interface Row {
  width: number;
  height: number;
  textured: boolean;
  frame: number;
  inputColor: EffectColor;
  draw: EffectOverlayRectangle & {script: number; texture: number | null};
  vertices: EffectOverlayVertex[];
}
const native = JSON.parse(readFileSync('recovery/output/effect-overlay-draw-native.json', 'utf8')) as {
  frames: [number, number, number, number][];
  rows: Row[];
};
let state: EffectOverlayDrawState;
let width = 0;
for (const row of native.rows) {
  if (row.width !== width) {
    state = new EffectOverlayDrawState(row.width, row.height);
    width = row.width;
  }
  assert.deepEqual(state!.draw(row.inputColor, row.textured, native.frames[row.frame]), {
    rectangle: row.draw.rectangle, z: row.draw.z, color: row.draw.color,
  });
  assert.equal(row.draw.script, row.textured ? 23 : 17);
  assert.equal(row.draw.texture, row.textured ? 1234 : null);
  assert.deepEqual(effectOverlayVertices(row.draw), row.vertices);
}
console.log(`PASS: ${native.rows.length} original overlay rectangle/color/UV draws and DLL XYZRHW vertices`);
