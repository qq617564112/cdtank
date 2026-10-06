import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NavigationGrid} from '../apps/server/src/navigation';
import {sampleRoleNavigation} from '../apps/server/src/battle/roles/movement-navigation';
interface Row {dimensions: number[]; command: number; pattern: string;
  predicted: {position: number[]; forward: number[]}; queries: {point: number[]; index: number[]; valid: boolean}[]; accepted: boolean; code: 0 | 1 | 2;}
const evidence: {rows: Row[]} = JSON.parse(readFileSync('recovery/output/movement-sampling-native.json', 'utf8'));
const point = (v: number[]) => ({x: v[0], y: v[1], z: v[2]});
for (const row of evidence.rows) {
  const bytes = Buffer.alloc(100 * 100 * 8);
  for (let z = 0; z < 100; z++) for (let x = 0; x < 100; x++) {
    const valid = row.pattern === 'clear' || row.pattern === 'stripe-x' && x % 3 !== 0
      || row.pattern === 'stripe-z' && z % 3 !== 0;
    bytes[(z * 100 + x) * 8 + 4] = valid ? 2 : 0;
  }
  const grid = new NavigationGrid({width: 100, height: 100, minimum: [0, 0, 0],
    maximum: [1200, 0, 1200], cells: bytes.toString('base64')});
  const queries: {point: number[]; index: number[]; valid: boolean}[] = [];
  const sample = grid.sample.bind(grid);
  grid.sample = (x, z) => {
    const found = sample(x, z);
    queries.push({point: [x, row.predicted.position[1], z], index: found ? [found.x, found.z] : [],
      valid: found?.valid ?? false});
    return found;
  };
  const result = sampleRoleNavigation(grid, {position: point(row.predicted.position),
    forward: point(row.predicted.forward)}, row.command, row.dimensions[0], row.dimensions[1]);
  assert.equal(queries.length, row.queries.length, 'Original sampling order and early exit');
  queries.forEach((query, index) => {
    const expected = row.queries[index];
    assert.deepEqual(query.index, expected.index);
    assert.equal(query.valid, expected.valid);
    query.point.forEach((value, axis) => assert(Math.abs(value - expected.point[axis]) < .0001,
      JSON.stringify({query, expected, row})));
  });
  assert.deepEqual(result, row.accepted ? {accepted: true} : {accepted: false, failureCode: row.code}, JSON.stringify(row));
}
console.log(`PASS: ${evidence.rows.length} original footprint sampling and directional failure-code paths`);
