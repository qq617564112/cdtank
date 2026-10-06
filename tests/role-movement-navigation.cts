import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getBattlefield} from '../apps/server/src/battlefield';
interface NativeMap {
  id: string; source: string; width: number; height: number; minimum: number[]; maximum: number[];
  cells: {index: number[]; inBounds: boolean; valid: boolean; sourceOffset?: number;
    bytes?: string; height?: number; flags?: number}[];
}
const native: {maps: NativeMap[]} = JSON.parse(readFileSync(
  'recovery/output/movement-real-nav-native.json', 'utf8'));
assert.equal(native.maps.length, 25);
let cells = 0;
for (const map of native.maps) {
  const grid = getBattlefield(Number(map.id)).navigation;
  const source = readFileSync(map.source);
  assert.equal(grid.source.width, map.width);
  assert.equal(grid.source.height, map.height);
  assert.deepEqual(grid.source.minimum, map.minimum);
  assert.deepEqual(grid.source.maximum, map.maximum);
  const exported = Buffer.from(grid.source.cells, 'base64');
  for (const expected of map.cells) {
    const [x, z] = expected.index;
    const actual = grid.cellAt(x, z);
    if (!expected.inBounds) {
      assert.equal(actual, undefined);
    } else {
      const originalBytes = source.subarray(expected.sourceOffset!, expected.sourceOffset! + 8);
      assert.equal(originalBytes.toString('hex'), expected.bytes);
      assert.deepEqual(exported.subarray((z * map.width + x) * 8, (z * map.width + x + 1) * 8), originalBytes);
      assert.deepEqual(actual, {x, z, height: expected.height, fields: expected.flags, valid: expected.valid});
    }
    cells++;
  }
}
console.log(`PASS: ${native.maps.length} formal map grids and ${cells} original collision-selected cells; source bytes, bounds, height and predicate match`);
