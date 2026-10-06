import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {queuedPartSkillIds} from '../apps/server/src/battle/passive-part-effects';

assert.deepEqual(queuedPartSkillIds([17036, 0, 0, 0, 0], new Int32Array(16)), [13506]);
writeFileSync('recovery/output/queued13506-qualification.json', JSON.stringify({
  status: 'PASS_NEW13506_SELECTOR_ONLY',
  scope: 'Confirmed item17036 part slot selects original13506; original tree audio scope recorded separately.',
}, null, 2) + '\n');
console.log('PASS_NEW13506_SELECTOR_ONLY');
