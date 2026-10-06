import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {queuedPartSkillIds} from '../apps/server/src/battle/passive-part-effects';

assert.deepEqual(queuedPartSkillIds([17035, 0, 0, 0, 0], new Int32Array(16)), [13505]);
writeFileSync('recovery/output/queued13505-qualification.json', JSON.stringify({
  status: 'PASS_NEW13505_SELECTOR_ONLY',
  scope: 'Confirmed item17035 part slot selects original13505. Original tree sound asset gaps remain open.',
}, null, 2) + '\n');
console.log('PASS_NEW13505_SELECTOR_ONLY');
