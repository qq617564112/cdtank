import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advanceEffectStripState, EffectStripControl, EffectStripState} from '../apps/web/src/render/effects/strips/effect-strip-state';
interface Row {
  node: number;
  modifier: number;
  parent: boolean;
  globalRotation: number[];
  config: EffectStripControl;
  initial: EffectStripState;
  steps: {delta: number; elapsed: number; state: EffectStripState; randomValues: number[]}[];
}
const native = JSON.parse(readFileSync('recovery/output/effect-strip-state-native.json', 'utf8')) as {rows: Row[]};
for (const row of native.rows) {
  let state = row.initial;
  for (const [index, step] of row.steps.entries()) {
    let randomIndex = 0;
    state = advanceEffectStripState(state, row.config, step.elapsed, step.delta,
      row.globalRotation, row.parent, count => step.randomValues[randomIndex++] % count);
    assert.equal(randomIndex, step.randomValues.length);
    assert.deepEqual({...state, orbitOffset: state.orbitOffset.map(v => v === 0 ? 0 : v)}, step.state, `node${row.node}/${row.modifier} tick${index}`);
  }
}
console.log(`PASS: ${native.rows.length} original type7 state sequences`);
