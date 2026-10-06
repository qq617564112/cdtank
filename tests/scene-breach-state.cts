import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
import {SceneBreachState} from '../apps/web/src/assets/scenes/scene-breach-state';

const evidence = JSON.parse(readFileSync('recovery/output/scene-breach-state-native.json', 'utf8')) as {
  rows: Array<{steps: Array<{delta: number; fading: boolean; hidden: boolean; alpha: number}>}>;
};
let count = 0;
for (const row of evidence.rows) {
  const state = new SceneBreachState();
  assert(state.destroy());
  assert.equal(state.destroy(), false);
  for (const step of row.steps) {
    state.update(step.delta);
    assert.deepEqual(state.snapshot(), {fading: step.fading, hidden: step.hidden, alpha: step.alpha});
    count++;
  }
  state.reset();
  assert.deepEqual(state.snapshot(), {fading: false, hidden: false, alpha: 1});
  state.update(1);
  assert.equal(state.snapshot().alpha, 1);
  state.destroy();
  state.update(1, false);
  assert.equal(state.snapshot().alpha, 1);
}
console.log(`PASS: ${count} original native Breach lifecycle states match Web; reset and visual ownership gate`);
