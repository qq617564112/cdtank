import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {resolveQualifiedShotHurtSelector} from '../apps/server/src/battle/roles/qualified-shot-hurt-resistance';

for (const selector of [0, 1, 2, 3, undefined]) {
  assert.equal(resolveQualifiedShotHurtSelector(selector, undefined), selector);
  assert.equal(resolveQualifiedShotHurtSelector(selector, 0), selector);
  assert.equal(resolveQualifiedShotHurtSelector(selector, 1), undefined);
}
const result = {
  status: 'PASS_FINITE_QUALIFIED_ZERO_FULL_HURT_SELECTOR_RESISTANCE_SCOPE',
  sourceSkill: 11011, sourceRate: 1,
  policy: 'Web qualified rate>=1 omits shot hurtSelector; zero or missing retains selector',
  scope: 'Pure selector only; authority owns target qualification and ammo gate',
};
writeFileSync('recovery/output/qualified-shot-hurt-resistance.json', JSON.stringify(result, null, 2) + '\n');
console.log(result.status);
