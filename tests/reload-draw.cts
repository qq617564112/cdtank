import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lifeProgress} from '../apps/web/src/interface/battle/life-progress';

const native = JSON.parse(readFileSync('recovery/output/reload-draw-native.json', 'utf8')) as {
  status: string;
  rows: {scale: number; progress: number; extent: number;
    draws: {part: string; colours: number[]}[]}[];
};
assert.equal(native.status, 'PASS');
for (const row of native.rows) {
  assert.equal(lifeProgress(row.progress, 1, 37 * row.scale).extent, row.extent);
  for (const draw of row.draws) {
    for (let corner = 0; corner < 4; corner++) {
      assert.equal(draw.colours[corner * 4 + 3], Math.fround(.6));
      assert.deepEqual(draw.colours.slice(corner * 4, corner * 4 + 3), [1, 1, 1]);
    }
  }
}
console.log(`PASS ${native.rows.length} original Crossbar pixel extent and effective-alpha override vectors`);
