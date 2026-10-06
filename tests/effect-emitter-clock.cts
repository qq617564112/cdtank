import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EffectEmitterClock, EffectEmitterConfig} from '../apps/web/src/render/effects/particles/effect-emitter-clock';
interface Row {
  config: EffectEmitterConfig;
  steps: {delta: number; randomCount: number; emitted: number;
    fraction: number; burstEmitted: boolean}[];
}
const native: {rows: Row[]} = JSON.parse(readFileSync('recovery/output/effect-emitter-native.json', 'utf8'));
for (const row of native.rows) {
  let randomCount = 0;
  let draws = 0;
  const clock = new EffectEmitterClock((minimum, maximum) => {
    assert.deepEqual([minimum, maximum], row.config.countRange);
    ++draws;
    return randomCount;
  });
  for (const [index, step] of row.steps.entries()) {
    randomCount = step.randomCount;
    assert.equal(clock.advance(step.delta, row.config), step.emitted);
    assert.equal(clock.fraction, step.fraction);
    assert.equal(clock.burstEmitted, step.burstEmitted);
    assert.equal(draws, index + 1);
  }
}
console.log(`PASS: ${native.rows.length} emission clocks/${native.rows.length * 7} ticks match native continuous/burst/random consumption`);
