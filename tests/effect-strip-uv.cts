import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advanceEffectStripState, EffectStripControl, EffectStripState} from '../apps/web/src/render/effects/strips/effect-strip-state';
import {advanceEffectStripUv} from '../apps/web/src/render/effects/strips/effect-strip-uv';
interface Row {
  node: number;
  modifier: number;
  parent: boolean;
  globalRotation: number[];
  config: EffectStripControl;
  initial: EffectStripState;
  frames: [number, number, number, number][];
  segments: number;
  textureLength: number;
  scrollRate: number;
  steps: {delta: number; elapsed: number; state: EffectStripState; randomValues: number[];
    scroll: number; uvs: [number, number, number, number][]}[];
}
const native = JSON.parse(readFileSync('recovery/output/effect-strip-uv-native.json', 'utf8')) as {rows: Row[]};
for (const row of native.rows) {
  let state = row.initial, scroll = 0;
  for (const [index, step] of row.steps.entries()) {
    let randomIndex = 0;
    state = advanceEffectStripState(state, row.config, step.elapsed, step.delta,
      row.globalRotation, row.parent, count => step.randomValues[randomIndex++] % count);
    assert.equal(randomIndex, step.randomValues.length);
    assert.deepEqual({...state, orbitOffset: state.orbitOffset.map(v => v === 0 ? 0 : v)}, step.state);
    const uv = advanceEffectStripUv(scroll, step.delta, row.scrollRate, row.frames[state.frame],
      row.segments, row.textureLength);
    scroll = uv.scroll;
    assert.equal(scroll, step.scroll, `node${row.node}/${row.modifier} tick${index} scroll`);
    assert.deepEqual(uv.uvs, step.uvs, `node${row.node}/${row.modifier} tick${index} uvs`);
  }
}
console.log(`PASS: ${native.rows.length} full original type7 state/strip UV sequences`);
