import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {selectCopiedRoleSkill} from '../apps/server/src/battle/roles/copied-role-skill-selection';

const candidates = [{baseId: 10231, rank: 2}, {baseId: 10241, rank: 3}];
assert.equal(selectCopiedRoleSkill([], 0), undefined);
for (const [roll, index] of [[0, 0], [.499, 0], [.5, 1], [.999, 1]]) {
  assert.deepEqual(selectCopiedRoleSkill(candidates, roll), candidates[index]);
}
assert.deepEqual(candidates, [{baseId: 10231, rank: 2}, {baseId: 10241, rank: 3}]);
const result = {status: 'PASS_FINITE_COPIED_ROLE_SKILL_EMPTY_UNIFORM_BOUNDARY_BASE_RANK_SCOPE',
  policy: 'Provider supplies qualified six-slot order; authority roll in [0,1)',
  rolls: [0, .499, .5, .999], candidateRanksPreserved: true};
writeFileSync('recovery/output/copied-role-skill-selection.json', JSON.stringify(result, null, 2) + '\n');
console.log(result.status);
