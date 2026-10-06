import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {calculateQualifiedBackCriticalBonus} from '../apps/server/src/battle/roles/qualified-back-critical-bonus';

for (const critical of [false, true]) {
  for (const facet of ['FRONT', 'SIDE', 'BACK'] as const) {
    assert.equal(calculateQualifiedBackCriticalBonus(critical, facet, undefined), 0);
    assert.equal(calculateQualifiedBackCriticalBonus(critical, facet, 400),
      critical && facet === 'BACK' ? 400 : 0);
  }
}
assert.equal(calculateQualifiedBackCriticalBonus(true, 'BACK', 0), 0);
const result = {status: 'PASS_FINITE_QUALIFIED_BACK_CRITICAL_BONUS400_ORDINARY_FACET_MISSING_SCOPE',
  sourceSkill: 10221, referencedSkill: 30004, sourceHp: -400,
  policy: 'Web extra400 after existing critical/facet damage; caller owns current qualified source'};
writeFileSync('recovery/output/qualified-back-critical-bonus.json', JSON.stringify(result, null, 2) + '\n');
console.log(result.status);
