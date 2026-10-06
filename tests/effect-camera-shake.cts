import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectCameraPose, EffectCameraShakeState} from '../apps/web/src/render/effects/camera/effect-camera-shake';
import {EffectVec3} from '../apps/web/src/render/effects/common/types';
const rows = JSON.parse(readFileSync('recovery/output/effect-camera-shake-native.json', 'utf8')).rows as {
  node: number; config: {parameter: number; strength: number}; duration: number;
  started: {parameter: number; active: boolean; elapsed: number};
  steps: {delta: number; pose: EffectCameraPose; eye: EffectVec3; target: EffectVec3; active: boolean; elapsed: number;
    seed: number; events: {kind: string; value?: number}[]}[];
}[];
for (const row of rows) {
  const state = new EffectCameraShakeState();
  let seed = 1;
  state.activate(row.config.parameter, row.duration, row.config.strength);
  assert.deepEqual({parameter: state.parameter, active: state.active, elapsed: state.elapsed}, row.started);
  for (const step of row.steps) {
    const randomValues: number[] = [];
    const pose = state.update(step.delta, step.pose, () => {
      seed = (Math.imul(seed, 214013) + 2531011) >>> 0;
      const value = (seed >>> 16) & 32767;
      randomValues.push(value);
      return value;
    });
    assert.deepEqual(pose.eye, step.eye, `node ${row.node} eye`);
    assert.deepEqual(pose.target, step.target, `node ${row.node} target`);
    assert.equal(state.active, step.active);
    assert.equal(state.elapsed, step.elapsed);
    assert.equal(seed, step.seed);
    assert.deepEqual(randomValues, step.events.filter(event => event.kind === 'random').map(event => event.value));
    assert.deepEqual(step.events.slice(0, 3).map(event => event.kind), ['child', 'child', 'base']);
  }
}
console.log(`PASS: ${rows.length} source shake sequences / ${rows.length * 6} original full camera updates and CRT random consumption`);
