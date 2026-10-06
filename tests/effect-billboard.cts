import assert from 'node:assert/strict';
import fs from 'node:fs';
import {effectBillboardCorners} from '../apps/web/src/render/effects/camera/effect-billboard';
const library = JSON.parse(fs.readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
const native = JSON.parse(fs.readFileSync('recovery/output/effect-billboard-native.json', 'utf8'));
assert.equal(native.exeSha256, library.exeSha256);
assert.equal(native.rows.length, (library.spriteControls.length + 8) * 2);
assert.deepEqual(effectBillboardCorners([4, 5, 6], [2, 3, 99], 0),
  [[2, 2, 6], [6, 2, 6], [6, 8, 6], [2, 8, 6]]);
let maximumRelativeError = 0;
for (const row of native.rows) {
  const corners = effectBillboardCorners(row.center, row.scale, row.angle);
  for (let corner = 0; corner < 4; ++corner) {
    for (let axis = 0; axis < 3; ++axis) {
      const expected = row.corners[corner][axis];
      const error = Math.abs(corners[corner][axis] - expected) / Math.max(1, Math.abs(expected));
      maximumRelativeError = Math.max(maximumRelativeError, error);
      assert.ok(error <= 1e-6, JSON.stringify({row, corner, axis, actual: corners[corner][axis]}));
    }
  }
}
console.log(`PASS: ${native.rows.length} Web/native camera-space corner cases; max relative error ${maximumRelativeError}`);
