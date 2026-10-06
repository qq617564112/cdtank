import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {effectBoltDrawVertices} from '../apps/web/src/render/effects/bolts/effect-bolt-draw';
import {effectStripTriangleIndices, EffectStripVertex} from '../apps/web/src/render/effects/common/effect-quad';
import {EffectVec3} from '../apps/web/src/render/effects/common/types';

const rows = JSON.parse(readFileSync('recovery/output/effect-bolt-draw-native.json', 'utf8')).rows as {
  node: number; segments: number[][]; matrix: number[]; eye: EffectVec3; width: number; color: number;
  vertices: EffectStripVertex[];
}[];
let maxError = 0;
for (const row of rows) {
  const vertices = effectBoltDrawVertices(row.segments, row.matrix, row.eye, row.width, row.color);
  assert.equal(vertices.length, row.vertices.length);
  vertices.forEach((vertex, index) => {
    const native = row.vertices[index];
    assert.deepEqual(vertex.uv, native.uv, `node ${row.node} UV ${index}`);
    assert.equal(vertex.color, native.color, `node ${row.node} color ${index}`);
    vertex.position.forEach((value, axis) => {
      const error = Math.abs(value - native.position[axis]);
      maxError = Math.max(maxError, error);
      assert.ok(error <= .00001, `node ${row.node} vertex ${index}:${axis}: ${value} / ${native.position[axis]}`);
    });
  });
}
assert.deepEqual(effectStripTriangleIndices(6), [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5]);
console.log(`PASS: ${rows.length} original type2 ribbon / DLL vertices; maximum absolute error ${maxError}`);
