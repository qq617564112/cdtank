import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {resolveQualifiedLastStandDuration} from '../apps/server/src/battle/roles/qualified-last-stand-duration';

assert.equal(resolveQualifiedLastStandDuration(false, 3), undefined);
assert.equal(resolveQualifiedLastStandDuration(true, 3), 3000);
assert.equal(resolveQualifiedLastStandDuration(true, 0), 0);
assert.equal(resolveQualifiedLastStandDuration(true, 1.5), 1500);
const result = {
  status: 'PASS_FINITE_QUALIFIED_LAST_STAND_DURATION_SECONDS_TO_MILLISECONDS_SCOPE',
  skillId: 10441, sourceFunctionType: 11, sourceT: 3, durationMilliseconds: 3000,
  policy: 'Caller owns current selected Pet4 slot3 rank1 and attributesReady; Web authority serverNow deadline'
};
writeFileSync('recovery/output/qualified-last-stand-duration.json', JSON.stringify(result, null, 2) + '\n');
console.log(result.status);
