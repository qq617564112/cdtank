import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {readOldBombBlastNumbers, isInsideOldBombBlast} from '../apps/server/src/battle/roles/old-bomb-blast-rule';

assert.deepEqual(readOldBombBlastNumbers(5, 200, -300), {delayMs: 5000, halfExtent: 100, damage: 300});
for (const [x, z] of [[0, 0], [100, 0], [-100, 0], [0, 100], [0, -100],
  [100, 100], [-100, -100], [-100, 100], [100, -100]]) {
  assert.equal(isInsideOldBombBlast(x, z, 200), true);
}
for (const [x, z] of [[100.01, 0], [-100.01, 0], [0, 100.01], [0, -100.01], [101, 101]]) {
  assert.equal(isInsideOldBombBlast(x, z, 200), false);
}
const result = {status: 'PASS_FINITE_OLD_BOMB_SOURCE_NUMBERS_SQUARE_CLOSED_BOUNDARY_SCOPE',
  placementSkillId: 3001, explosionSkillId: 3009, damageSkillId: 3012,
  delaySeconds: 5, fullExtent: 200, hpDelta: -300,
  policy: 'Web5s/200x200 axis-aligned inclusive square/directHP300; caller owns source and target qualification'};
writeFileSync('recovery/output/old-bomb-blast-rule.json', JSON.stringify(result, null, 2) + '\n');
console.log(result.status);
