import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {resolveAttackCancellation} from '../apps/server/src/battle/roles/reactive-armor-counter';

const first = resolveAttackCancellation(1, 0);
assert.deepEqual(first, {blocked: true, cancellationsSpent: 1});
assert.deepEqual(resolveAttackCancellation(1, first.cancellationsSpent), {blocked: false, cancellationsSpent: 1});
assert.deepEqual(resolveAttackCancellation(undefined, 0), {blocked: false, cancellationsSpent: 0});
assert.deepEqual(resolveAttackCancellation(undefined, 1), {blocked: false, cancellationsSpent: 1});
assert.deepEqual(resolveAttackCancellation(0, 0), {blocked: false, cancellationsSpent: 0});
assert.deepEqual(resolveAttackCancellation(0, 1), {blocked: false, cancellationsSpent: 1});
assert.deepEqual(resolveAttackCancellation(2, 1), {blocked: true, cancellationsSpent: 2});
let spent = 0;
for (let n = 0; n < 9; n++) {
  const result = resolveAttackCancellation(9, spent);
  assert(result.blocked);
  assert.equal(result.cancellationsSpent, spent + 1);
  spent = result.cancellationsSpent;
}
assert.deepEqual(resolveAttackCancellation(9, spent), {blocked: false, cancellationsSpent: 9});
// Source changes retain spent state; only the authority's new-life reset supplies0.
assert.deepEqual(resolveAttackCancellation(1, spent), {blocked: false, cancellationsSpent: 9});
assert.deepEqual(resolveAttackCancellation(1, 0), first);
const evidence = {
  status: 'PASS_FINITE_WEB_QUALIFIED_ATTACK_CANCELLATION_CAPACITY_SPENT_SCOPE',
  first,
  maximumSourceLimit: 9,
  exhaustedSpent: spent,
  policy: 'Current qualified maximum > spent consumes1; missing/exhausted capacity preserves spent',
  scope: 'Pure counting only; authority owns hostile shot, friendly/immune/medical/periodic gates, no-score hit0, newround/respawn reset',
  originalServerResetOrConsumptionRecovered: false,
};
writeFileSync('recovery/output/shot-attack-cancellation.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(evidence.status);
