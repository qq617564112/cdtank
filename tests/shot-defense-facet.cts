import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {resolveShotDefenseFacet} from '../apps/server/src/battle/roles/shot-defense-facet';
import {calculateQualifiedShotDamage} from '../apps/server/src/battle/roles/qualified-shot-defense';

const bearing = (angle: number) => ({x: Math.sin(angle), z: Math.cos(angle)});
assert.equal(resolveShotDefenseFacet(0, bearing(0)), 'FRONT');
for (const sign of [-1, 1]) {
  assert.equal(resolveShotDefenseFacet(0, bearing(sign * Math.PI / 4)), 'FRONT');
  assert.equal(resolveShotDefenseFacet(0, bearing(sign * (Math.PI / 4 + 1e-8))), 'SIDE');
  assert.equal(resolveShotDefenseFacet(0, bearing(sign * Math.PI / 2)), 'SIDE');
  assert.equal(resolveShotDefenseFacet(0, bearing(sign * (3 * Math.PI / 4 - 1e-8))), 'SIDE');
  assert.equal(resolveShotDefenseFacet(0, bearing(sign * 3 * Math.PI / 4)), 'BACK');
  assert.equal(resolveShotDefenseFacet(0, bearing(sign * Math.PI)), 'BACK');
}
assert.equal(resolveShotDefenseFacet(Math.PI, {x: 0, z: -10}), 'FRONT');
assert.equal(resolveShotDefenseFacet(2 * Math.PI, {x: 0, z: 3}), 'FRONT');
assert.equal(resolveShotDefenseFacet(-Math.PI / 2, {x: 4, z: 0}), 'BACK');
const fields = {defensePercent: 0.17000000178813934, defenseBonus: 44};
const sideCorrection = Math.fround(70 * Math.fround(.01));
const front = calculateQualifiedShotDamage(151, fields);
const side = calculateQualifiedShotDamage(151, fields, sideCorrection);
const back = calculateQualifiedShotDamage(151, fields, .5);
assert.equal(front, 15100 / (100 + fields.defensePercent * 100 + 44));
assert.equal(side, 15100 / (100 + (fields.defensePercent * 100 + 44) * sideCorrection));
assert.equal(back, 15100 / (100 + (fields.defensePercent * 100 + 44) * .5));
assert(front < side && side < back);
assert.notEqual(side, Math.round(side));
assert.equal(calculateQualifiedShotDamage(151, fields, 0), 151);
assert.equal(calculateQualifiedShotDamage(151, {defensePercent: -1, defenseBonus: 0}, .5), 151);
const evidence = {
  status: 'PASS_FINITE_WEB_FRONT_SIDE_BACK_SECTORS_CORRECTED_DEFENSE_POINTS_SCOPE',
  sectors: {frontInclusive: Math.PI / 4, backInclusive: 3 * Math.PI / 4},
  fields, corrections: {front: 1, side: sideCorrection, back: .5}, damage: {front, side, back},
  expectedIntegerHP: {front: (650 - front) | 0, side: (((650 - front) | 0) - side) | 0,
    back: (((((650 - front) | 0) - side) | 0) - back) | 0},
  policy: 'Correct nonnegative combined defense points; floating damage and existing integer HP setter',
  scope: 'Pure sectors and mitigation only; authority supplies real incidence and current qualified ratios',
  originalFacetOrServerFormulaRecovered: false,
};
writeFileSync('recovery/output/shot-defense-facet.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(evidence.status);
