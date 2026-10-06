import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {queuedPartSkillIds} from '../apps/server/src/battle/passive-part-effects';
assert.deepEqual(queuedPartSkillIds([17033, 0, 0, 0, 0], new Int32Array(16)), [13503]);
assert.deepEqual(queuedPartSkillIds(undefined, new Int32Array(16)), []);
assert.deepEqual(queuedPartSkillIds([17033], undefined), []);
writeFileSync('recovery/output/queued13503-qualification.json', JSON.stringify({status: 'PASS_NEW13503_SELECTOR_ONLY',
 scope: 'Confirmed item17033 part slot selects original13503, absent required sources remain empty; old13501/2 evidence reused.'}, null, 2) + '\n');
console.log('PASS_NEW13503_SELECTOR_ONLY');
