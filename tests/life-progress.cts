import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lifeProgress} from '../apps/web/src/interface/battle/life-progress';

const native = JSON.parse(readFileSync('recovery/output/life-draw-native.json', 'utf8')) as {
  status: string;
  ratioRows: {hp: number; maxHp: number; fraction: number}[];
  rows: {vertical: boolean; scale: number; progress: number; band: string; extent: number}[];
};
assert.equal(native.status, 'PASS');
for (const row of native.ratioRows) {
  assert.equal(lifeProgress(row.hp, row.maxHp, 179).fraction, row.fraction);
}
for (const row of native.rows) {
  const result = lifeProgress(row.progress, 1, (row.vertical ? 33 : 179) * row.scale);
  assert.equal(result.extent, row.extent, JSON.stringify(row));
  assert.equal(['low', 'medium', 'high'][result.band], row.band, JSON.stringify(row));
}
console.log(`PASS ${native.ratioRows.length} original HP/clamp and ${native.rows.length} original draw extent/band vectors`);
