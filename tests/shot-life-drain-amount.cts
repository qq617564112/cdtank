import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {calculateShotLifeDrain} from '../apps/server/src/battle/roles/shot-life-drain-amount';

assert.equal(calculateShotLifeDrain(96), 0);
assert.equal(calculateShotLifeDrain(96, 0), 0);
assert.equal(calculateShotLifeDrain(0, .1), 0);
assert.equal(calculateShotLifeDrain(96, -.1), 0);
assert.equal(calculateShotLifeDrain(96, Math.fround(10 * Math.fround(.01))), 10);
assert.equal(calculateShotLifeDrain(94, .1), 9);
assert.equal(calculateShotLifeDrain(95, .1), 10);
assert.equal(calculateShotLifeDrain(7, .1), 1);
assert.equal(calculateShotLifeDrain(96, .2), 19);
assert.equal(calculateShotLifeDrain(96, .3), 29);
const evidence = {
  status: 'PASS_FINITE_WEB_SHOT_LIFE_DRAIN_ACTUAL_INTEGER_HP_AMOUNT_SCOPE',
  policy: 'undefined => 0; Math.round(Math.max(0, actualHpRemoved * qualifiedRate))',
  sourceRate: Math.fround(10 * Math.fround(.01)),
  actualIntegerLoss: 96,
  restoration: calculateShotLifeDrain(96, Math.fround(10 * Math.fround(.01))),
  scope: 'Pure amount only; caller owns hostile shot, immunity, living attacker, current attribute qualification and maxHP clamp',
  originalServerFormulaRecovered: false,
};
writeFileSync('recovery/output/shot-life-drain-amount.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(evidence.status);
