import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {calculateQualifiedShotAttack} from '../apps/server/src/battle/roles/qualified-shot-attack';

// Reuse accepted original-field evidence without rerunning source/native work.
const source = JSON.parse(readFileSync('recovery/output/tank-purchased-part-armor-network-2026-10-04T17-31-42-127Z.json', 'utf8'));
const vectors: {attackBase: number; attackPercent: number; attackBonus: number}[] = [];
function collect(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  if (typeof record.attackBase === 'number' && typeof record.attackPercent === 'number'
      && typeof record.attackBonus === 'number') {
    vectors.push({attackBase: record.attackBase, attackPercent: record.attackPercent,
      attackBonus: record.attackBonus});
  }
  for (const child of Object.values(record)) collect(child);
}
collect(source);
assert(vectors.length > 0);
assert.deepEqual(vectors[0], {attackBase: 100, attackPercent: 0.731999933719635, attackBonus: 78});
assert.equal(calculateQualifiedShotAttack(vectors[0]), 151);
const barrel = {...vectors[0], attackPercent: Math.fround(vectors[0].attackPercent + Math.fround(.2))};
assert.equal(calculateQualifiedShotAttack(barrel), 171);
assert.equal(calculateQualifiedShotAttack({attackBase: 100, attackPercent: Math.fround(.2), attackBonus: 0}), 20);
assert.equal(calculateQualifiedShotAttack({attackBase: 100, attackPercent: -1, attackBonus: 20}), 0);
assert.equal(calculateQualifiedShotAttack({attackBase: 0, attackPercent: 1, attackBonus: 20}), 20);
assert.equal(calculateQualifiedShotAttack({attackBase: 100, attackPercent: .205, attackBonus: 0}), 21);
const evidence = {status: 'PASS_FINITE_WEB_QUALIFIED_SHOT_ATTACK_COMPOSITION_ROUNDING_SCOPE',
  source: 'recovery/output/tank-purchased-part-armor-network-2026-10-04T17-31-42-127Z.json',
  reusedFields: vectors[0], baseline: 151, barrel13001: 171,
  policy: 'Math.round(Math.max(0, attackBase * attackPercent + attackBonus))',
  scope: 'Pure Web composition only; qualification/stale field gate, shot acceptance, defense and HP authority belong to consumers'};
writeFileSync('recovery/output/qualified-shot-attack.json', JSON.stringify(evidence, null, 2) + '\n');
console.log(evidence.status);
