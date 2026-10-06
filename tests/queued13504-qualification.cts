import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {queuedPartSkillIds} from '../apps/server/src/battle/passive-part-effects';

assert.deepEqual(queuedPartSkillIds([17034, 0, 0, 0, 0], new Int32Array(16)), [13504]);
assert.deepEqual(queuedPartSkillIds(undefined, new Int32Array(16)), []);
assert.deepEqual(queuedPartSkillIds([17034], undefined), []);
writeFileSync('recovery/output/queued13504-qualification.json', JSON.stringify({
  status: 'PASS_NEW13504_SELECTOR_ONLY',
  scope: 'Confirmed item17034 part slot selects original13504; absent required sources remain empty.',
}, null, 2) + '\n');
console.log('PASS_NEW13504_SELECTOR_ONLY');
