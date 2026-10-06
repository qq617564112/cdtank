import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advanceEffectSpriteSpace, EffectSpriteSpaceControl} from '../apps/web/src/render/effects/sprites/effect-sprite-space';
import {EffectVec3} from '../apps/web/src/render/effects/common/types';
interface Space {position: EffectVec3; velocity: EffectVec3; orbitOffset: EffectVec3;}
interface Row {
  control: EffectSpriteSpaceControl;
  parent: boolean;
  modelAligned: boolean;
  globalRotation: number[];
  initial: Space;
  steps: (Space & {delta: number; elapsed: number})[];
}
const native = JSON.parse(readFileSync('recovery/output/effect-sprite-space-native.json', 'utf8')) as {rows: Row[]};
for (const row of native.rows) {
  let state = row.initial;
  for (const step of row.steps) {
    state = advanceEffectSpriteSpace(state, row.control, step.elapsed, step.delta,
      row.globalRotation, row.parent, row.modelAligned);
    for (const key of ['position', 'velocity', 'orbitOffset'] as const) {
      assert.deepEqual(state[key].map(v => v === 0 ? 0 : v), step[key].map(v => v === 0 ? 0 : v));
    }
  }
}
console.log(`PASS: ${native.rows.length} full original type1 spatial sequences`);
