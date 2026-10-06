import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectTrailConfig, EffectTrailHistory} from '../apps/web/src/render/effects/sprites/effect-trail';

interface Row {
  config: EffectTrailConfig;
  initial: string;
  initialCount: number;
  steps: {delta: number; current: string; entries: string[]; elapsed: number}[];
}
const native: {rows: Row[]} = JSON.parse(readFileSync('recovery/output/effect-trail-native.json', 'utf8'));
let updates = 0;
for (const row of native.rows) {
  const history = new EffectTrailHistory(Buffer.from(row.initial, 'hex'), row.config, state => Buffer.from(state));
  if (!row.config.enabled) {
    while (history.entries.length < row.initialCount) history.entries.push(Buffer.from(row.initial, 'hex'));
  }
  for (const step of row.steps) {
    history.update(Buffer.from(step.current, 'hex'), step.delta, row.config);
    assert.deepEqual(history.entries.map(state => state.toString('hex')), step.entries);
    assert.equal(history.elapsed, step.elapsed);
    ++updates;
  }
}
console.log(`PASS: ${native.rows.length} histories/${updates} updates match native sample/copy/crop and f32 time`);
