import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {calculateQualifiedShotDamage} from '../apps/server/src/battle/roles/qualified-shot-defense';

const prepared = JSON.parse(readFileSync('recovery/output/permanent-armor-source-inputs.json', 'utf8'));
const defender = prepared.participants[0];
const baselineFields = defender.baseline.fields;
const mountedFields = defender.mounted.fields;
assert.equal(baselineFields.defensePercent, 0.13599999248981476);
assert.equal(mountedFields.defensePercent, 0.28599998354911804);
assert.equal(baselineFields.defenseBonus, 44);
assert.equal(mountedFields.defenseBonus, 44);
const baseline = calculateQualifiedShotDamage(151, baselineFields);
const mounted = calculateQualifiedShotDamage(151, mountedFields);
assert(Math.abs(baseline - 95.81218274136192) < 1e-6);
assert(Math.abs(mounted - 87.48551647629548) < 1e-6);
assert(mounted < baseline);
assert.notEqual(baseline, Math.round(baseline));
assert.equal(calculateQualifiedShotDamage(100, {defensePercent: .2, defenseBonus: 0}), 10000 / 120);
assert.equal(calculateQualifiedShotDamage(100, {defensePercent: 0, defenseBonus: 20}), 10000 / 120);
assert.equal(calculateQualifiedShotDamage(151, {defensePercent: -.2, defenseBonus: 0}), 151);
assert.equal(calculateQualifiedShotDamage(0, mountedFields), 0);
const evidence = {status: 'PASS_FINITE_WEB_QUALIFIED_SHOT_DEFENSE_RATIO_POINTS_FLOAT_DAMAGE_SCOPE',
  source: 'recovery/output/permanent-armor-source-inputs.json', baselineFields, mountedFields,
  rawAttack: 151, baseline, mounted,
  policy: 'rawDamage *100/(100+Math.max(0,defensePercent*100+defenseBonus))',
  scope: 'Pure shot mitigation only; caller supplies current qualification, shot-only scope and existing integer HP mutation'};
writeFileSync('recovery/output/qualified-shot-defense.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(evidence.status);
