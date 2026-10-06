import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {effectRenderMatrix} from '../apps/web/src/render/effects/common/effect-render-transform';
import {EffectVec3} from '../apps/web/src/render/effects/common/types';
const rows = JSON.parse(readFileSync('recovery/output/effect-render-transform-native.json', 'utf8')) as {
  node: number; position: EffectVec3; orbit: EffectVec3; angles: EffectVec3; scale: EffectVec3; parent?: number[]; matrix: number[];
}[];
let maxError = 0;
for (const row of rows) {
  const actual = effectRenderMatrix(row.position, row.orbit, row.angles, row.scale, row.parent ?? undefined);
  row.matrix.forEach((expected, index) => {
    const error = Math.abs(actual[index] - expected);
    maxError = Math.max(maxError, error);
    assert.ok(error <= Math.max(0.00001, Math.abs(expected) * .000001), `node ${row.node} matrix ${index}: ${actual[index]} / ${expected}`);
  });
}
console.log(`PASS: ${rows.length} original matrix stack orientations; maximum absolute error ${maxError}`);
