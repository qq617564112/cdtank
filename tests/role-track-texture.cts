import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advanceRoleTrackTexture, createRoleTrackTextureState} from '../apps/web/src/assets/tanks/role-track-texture';
import type {RoleTrackTextureState} from '../apps/web/src/assets/tanks/role-track-texture';

interface NativeStep {
  delta: number;
  before: RoleTrackTextureState;
  after: RoleTrackTextureState;
  updateCalls: string[];
}
const native = JSON.parse(readFileSync('recovery/output/role-track-texture-sol-native.json', 'utf8')) as {
  initialState: RoleTrackTextureState;
  rows: {label: string; steps: NativeStep[]}[];
};
const type4 = JSON.parse(readFileSync('recovery/output/role-actor-global-clock-sol-native.json', 'utf8')) as {
  type4: {label: string; steps: NativeStep[]}[];
};
assert.deepEqual(createRoleTrackTextureState(), native.initialState);
let steps = 0;
for (const row of [...native.rows, ...type4.type4]) {
  for (const step of row.steps) {
    // The native full caller decides whether the movement target permits update.
    const actual = step.updateCalls.includes('0x4654f1')
      ? advanceRoleTrackTexture(step.before, step.delta) : step.before;
    assert.deepEqual(actual, step.after, row.label);
    steps++;
  }
}
console.log(`PASS: ${steps} native target-gated texture phase updates, pre-round comparison and frozen phase`);
