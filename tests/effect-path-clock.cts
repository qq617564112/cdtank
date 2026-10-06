import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectPathClock} from '../apps/web/src/render/effects/common/effect-path-clock';
import type {EffectVec3} from '../apps/web/src/render/effects/common/types';
interface Row {
  vertices: EffectVec3[];
  mode: number;
  rate: number;
  sentinel: EffectVec3;
  steps: {delta: number; frame: number; remainder: number; position: EffectVec3}[];
}
const source = JSON.parse(readFileSync('recovery/output/effect-path-native.json', 'utf8')) as {rows: Row[]};
for (const row of source.rows) {
  const clock = new EffectPathClock(row.vertices, row.rate, row.mode, row.sentinel);
  for (const step of row.steps) {
    assert.deepEqual(clock.advance(step.delta), step.position);
    assert.equal(clock.frame, step.frame);
    assert.equal(clock.remainder, step.remainder);
  }
  clock.reset();
  assert.equal(clock.frame, 0);
  assert.equal(clock.remainder, 0);
}
console.log(`PASS: ${source.rows.length * 9} complete original source path samples with explicit trailing storage`);
