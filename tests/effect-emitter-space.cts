import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advanceEffectEmitterSpace, EffectEmitterSpace, EffectEmitterSpaceControl} from '../apps/web/src/render/effects/particles/effect-emitter-space';
import type {EffectVec3} from '../apps/web/src/render/effects/common/types';
interface Row {
  control: EffectEmitterSpaceControl;
  parent: boolean;
  globalRotation: number[];
  initial: number[];
  steps: {delta: number; elapsed: number; state: number[]}[];
}
const source = JSON.parse(readFileSync('recovery/output/effect-emitter-space-native.json', 'utf8')) as {rows: Row[]};
for (const row of source.rows) {
  let state: EffectEmitterSpace = {position: row.initial.slice(0, 3) as EffectVec3,
    orbitOffset: row.initial.slice(3, 6) as EffectVec3};
  for (const step of row.steps) {
    state = advanceEffectEmitterSpace(state, row.control, step.elapsed, step.delta,
      row.globalRotation, row.parent);
    assert.deepEqual([...state.position, ...state.orbitOffset].map(value => value === 0 ? 0 : value),
      step.state.map(value => value === 0 ? 0 : value), JSON.stringify({control: row.control, step}));
  }
}
console.log(`PASS: ${source.rows.length * 5} complete original type6 emitter motion/orbit updates`);
