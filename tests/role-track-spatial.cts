import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blendRoleSpatialPosition, roleSpatialBlendWeight} from '../recovery/evidence/combat/role-track-spatial';
const original = JSON.parse(readFileSync('recovery/output/role-track-spatial-sol-native.json', 'utf8'));
for (const row of original.rows) {
  const point = (v: number[]) => ({x: v[0], y: v[1], z: v[2]});
  assert.equal(roleSpatialBlendWeight(row.elapsed, original.interpolationPeriod), row.weight, row.label);
  assert.deepEqual(blendRoleSpatialPosition(point(row.current), point(row.target), row.elapsed,
    original.interpolationPeriod), point(row.position), row.label);
}
console.log(`PASS: ${original.rows.length} original full spatial position blends and float32 weights`);
