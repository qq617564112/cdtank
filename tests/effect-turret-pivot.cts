import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {effectTurretPivotCorrection} from '../apps/web/src/assets/tanks/effect-turret-pivot';
const source = JSON.parse(readFileSync('recovery/output/effect-turret-pivot-native.json', 'utf8'));
for (const row of source.rows) {
  assert.deepEqual(effectTurretPivotCorrection(row.pivot, row.yaw, row.turretYaw, row.up ?? [0, 1, 0]).map(value => value === 0 ? 0 : value),
    row.correction.map((value: number) => value === 0 ? 0 : value), JSON.stringify(row));
}
console.log(`PASS: ${source.rows.length} original dynamic turret pivot compensation results`);
