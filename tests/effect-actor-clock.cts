import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectActorActionClock} from '../apps/web/src/assets/tanks/effect-actor-clock';

const evidence = JSON.parse(readFileSync('recovery/output/effect-actor-update-native.json', 'utf8'));
let ticks = 0;
for (const row of evidence.rows) {
  const clock = new EffectActorActionClock(row.action.duration, row.action.events, row.stopped, 1, 53);
  for (const step of row.steps) {
    assert.deepEqual(clock.advance(step.delta), step.messages);
    assert.equal(clock.time, step.time);
    assert.equal(clock.overMessage, step.overMessage);
    ++ticks;
  }
}
console.log(`PASS: ${evidence.rows.length} source attack/death actions / ${ticks} complete native actor ticks`);
