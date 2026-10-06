import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advanceHomePreviewOrbit, HOME_PREVIEW_CLIP_PLANES} from '../../../apps/web/src/interface/home/home-preview-orbit';
const evidence = JSON.parse(readFileSync('recovery/output/home-preview-orbit-native.json', 'utf8')) as {
  rows: {before: number[]; delta: number[]; after: number[]}[];
};
assert.equal(evidence.rows.length, 64);
for (const row of evidence.rows) {
  const state = {pitch: row.before[0], yaw: row.before[1], orbitYaw: row.before[2]};
  advanceHomePreviewOrbit(state);
  assert.deepEqual([state.pitch, state.yaw, state.orbitYaw], row.after);
  assert.deepEqual(row.delta, [0, Math.fround(0.0075)]);
}
console.log('PASS: 64 native home preview angle accumulations');
const projection = JSON.parse(readFileSync('recovery/output/home-preview-projection-native.json', 'utf8')) as {
  rows: {near: number; far: number}[];
};
assert.equal(projection.rows.length, 16);
for (const row of projection.rows) assert.deepEqual(HOME_PREVIEW_CLIP_PLANES, {near: row.near, far: row.far});
console.log('PASS: 16 original projection clip plane assemblies');
