import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {calculateQualifiedShotCritical} from '../apps/server/src/battle/roles/qualified-shot-critical';

const ordinary = {attack: 151, critical: false};
assert.deepEqual(calculateQualifiedShotCritical(151, undefined, 0, 2), ordinary);
assert.deepEqual(calculateQualifiedShotCritical(151, 0, 0, 2), ordinary);
assert.deepEqual(calculateQualifiedShotCritical(151, .2, .2, 2), ordinary);
assert.deepEqual(calculateQualifiedShotCritical(151, .2, .20000001, 2), ordinary);
assert.deepEqual(calculateQualifiedShotCritical(151, .2, .19999999, 2), {attack: 302, critical: true});
assert.deepEqual(calculateQualifiedShotCritical(151, .2, 0, 2), {attack: 302, critical: true});
assert.deepEqual(calculateQualifiedShotCritical(151, .65, .99999999, 2), ordinary);
assert.deepEqual(calculateQualifiedShotCritical(151, 1, .99999999, 2), {attack: 302, critical: true});
const sourceRate = .19999998807907104;
assert.deepEqual(calculateQualifiedShotCritical(151, sourceRate, .19999999, 2), ordinary);
assert.deepEqual(calculateQualifiedShotCritical(151, sourceRate, sourceRate - 1e-8, 2), {attack: 302, critical: true});
assert.deepEqual(calculateQualifiedShotCritical(1.25, .2, 0, 2), {attack: 2.5, critical: true});
assert.deepEqual(calculateQualifiedShotCritical(151, .2, 0, 3), {attack: 453, critical: true});

const points = .17000000178813934 * 100 + 44;
const results = {
  status: 'PASS_FINITE_QUALIFIED_CRITICAL_STRICT_ROLL_MULTIPLIER_RAW_ATTACK_SCOPE',
  sourceRate, ordinary: calculateQualifiedShotCritical(151, sourceRate, sourceRate, 2),
  critical: calculateQualifiedShotCritical(151, sourceRate, 0, 2),
  frontDamage: {ordinary: 15100 / (100 + points), critical: 30200 / (100 + points)},
  policy: 'Web rate>one uniform authority roll, multiplier2 before facet defense; no damage or HP rounding here',
  scope: 'Pure amount and strict boundary only; life authority owns hostile/current/alive/source gate and RNG',
  originalServerChanceOrMultiplierRecovered: false,
};
writeFileSync('recovery/output/qualified-shot-critical.json', JSON.stringify(results, null, 2) + '\n');
console.log(results.status);
