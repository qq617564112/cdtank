import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {readContactMineNumbers} from '../apps/server/src/battle/roles/contact-mine-numbers';

assert.deepEqual(readContactMineNumbers(30, 30, -300),
  {durationMs: 30000, triggerRadius: 30, damage: 300});
const result = {status: 'PASS_FINITE_CONTACT_MINE3002_SOURCE_DURATION_RADIUS_HP_AMOUNT_SCOPE',
  placementSkillId: 3002, damageSkillId: 4023,
  source: {durationSeconds: 30, triggerRadius: 30, hpDelta: -300},
  numbers: readContactMineNumbers(30, 30, -300),
  policy: 'Web Func12 T seconds/X radius; caller owns contact geometry, qualification and directHP execution'};
writeFileSync('recovery/output/contact-mine-numbers.json', JSON.stringify(result, null, 2) + '\n');
console.log(result.status);
