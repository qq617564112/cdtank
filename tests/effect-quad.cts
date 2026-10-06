import assert from 'node:assert/strict';
import fs from 'node:fs';
import {expandEffectQuad} from '../apps/web/src/render/effects/common/effect-quad';

const library = JSON.parse(fs.readFileSync('recovery/output/web-assets/effect-library.json', 'utf8'));
const native = JSON.parse(fs.readFileSync('recovery/output/effect-quad-native.json', 'utf8'));
assert.equal(native.sourceSha256, library.engine.sourceSha256);
assert.equal(native.rows.length, 18);
for (const row of native.rows) {
  assert.deepEqual(expandEffectQuad(row.corners, row.uv, row.color, row.screenSpace), row.vertices);
}
console.log('PASS: Web quad positions, diagonal, UVs, packed colors and RHW match executed original engine');
