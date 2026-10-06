import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sampleEffectTag} from '../apps/web/src/assets/tanks/effect-tag-sampler';

const evidence = JSON.parse(readFileSync('recovery/output/effect-tag-tracks-native.json', 'utf8'));
let count = 0;
for (const row of evidence.rows) {
  for (const step of row.steps) {
    assert.deepEqual(sampleEffectTag(row.track.frames, step.time), step.matrix);
    ++count;
  }
}
console.log(`PASS: ${evidence.rows.length} real attachment tracks / ${count} original matrices`);
