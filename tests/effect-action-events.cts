import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {queryEffectActionEvents, effectActorTimeStep} from '../apps/web/src/assets/tanks/effect-action-events';

const evidence = JSON.parse(readFileSync('recovery/output/effect-action-events-native.json', 'utf8'));
let count = 0;
for (const row of evidence.rows) {
  for (const step of row.steps) {
    assert.deepEqual(queryEffectActionEvents(row.action.duration, row.action.events,
      step.previous, step.current), step.identifiers);
    ++count;
  }
}
for (const row of evidence.clock) {
  assert.equal(effectActorTimeStep(row.delta, row.scale, row.precision === 0x27f ? 53 : 64), row.step);
}
console.log(`PASS: ${count} original message intervals / ${evidence.clock.length} original actor time steps`);
