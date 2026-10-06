import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {composeEffectWorldTag} from '../apps/web/src/assets/tanks/effect-tag-world';

const evidence = JSON.parse(readFileSync('recovery/output/effect-tag-world-native.json', 'utf8'));
for (const row of evidence.rows) {
  assert.deepEqual(composeEffectWorldTag(row.local, row.pose, row.variant === 'fourPartAttack'), row.matrix);
}
console.log(`PASS: ${evidence.rows.length} original body/turret primary tag world matrices`);
