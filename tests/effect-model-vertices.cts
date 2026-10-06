import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {effectModelVertices} from '../apps/web/src/render/effects/models/effect-model-animation';
const native = JSON.parse(readFileSync('recovery/output/effect-model-vertices-native.json', 'utf8')) as {
  frames: number[][][]; times: number[]; rows: {time: number; vertices: number[][]}[];
};
for (const row of native.rows) assert.deepEqual(effectModelVertices(native.frames, native.times, row.time), row.vertices);
console.log(`PASS: ${native.rows.length} original animated model draws, all XYZ/UV/normals exact`);
