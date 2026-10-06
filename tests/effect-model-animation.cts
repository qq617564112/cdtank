import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectModelAnimation, EffectModelAnimationNode, effectModelEngineDelta} from '../apps/web/src/render/effects/models/effect-model-animation';
interface Row {rate: number; duration: number; node: EffectModelAnimationNode;
  steps: {delta: number; time: number; loops: number; matrix: number[]}[];}
const native = JSON.parse(readFileSync('recovery/output/effect-model-animation-native.json', 'utf8')) as {rows: Row[]};
const engine = JSON.parse(readFileSync('recovery/output/effect-model-source-state-native.json', 'utf8')) as {
  deltaRows: {input: number; output: number}[];
};
for (const row of engine.deltaRows) assert.equal(effectModelEngineDelta(row.input), row.output);
let maximumError = 0;
for (const row of native.rows) {
  const model = new EffectModelAnimation(row.node, row.duration);
  model.setRate(row.rate);
  for (const step of row.steps) {
    model.update(step.delta);
    assert.equal(model.time, step.time);
    assert.equal(model.loops, step.loops);
    model.matrix.forEach((value, index) => {
      const error = Math.abs(value - step.matrix[index]);
      maximumError = Math.max(maximumError, error);
      assert.ok(error <= .000003814697265625, `rate${row.rate} time${step.time} matrix${index}: ${error}`);
    });
  }
}
console.log(`PASS: ${native.rows.length} original CVD clock/track/matrix sequences, maximum matrix error ${maximumError}`);
