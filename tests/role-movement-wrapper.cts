import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NavigationGrid} from '../apps/server/src/navigation';
import {getBattlefield} from '../apps/server/src/battlefield';
import {moveRoleThroughNavigation} from '../apps/server/src/battle/roles/movement-wrapper';
import type {RoleMovementMathInput} from '../apps/server/src/battle/roles/movement-math';
interface Row {command: RoleMovementMathInput['command']; delta: number; mapMode: string;
  blockedCells: number[][]; result: boolean; position: number[]; look: number[]; forward: number[];
  attempts: {command: number}[];}
const native: {rows: Row[]} = JSON.parse(readFileSync('recovery/output/movement-wrapper-native.json', 'utf8'));
for (const row of native.rows) {
  const cells = Buffer.alloc(100 * 100 * 8);
  for (let index = 0; index < 100 * 100; index++) cells[index * 8 + 4] = row.mapMode === 'blocked' ? 0 : 2;
  for (const [x, z] of row.blockedCells) cells[(z * 100 + x) * 8 + 4] = 0;
  const grid = new NavigationGrid({width: 100, height: 100, minimum: [0, 0, 0],
    maximum: [1200, 0, 1200], cells: cells.toString('base64')});
  const input: RoleMovementMathInput = {position: {x: 200, y: 0, z: 200}, look: {x: 1, y: 0, z: 0},
    forward: {x: 1, y: 0, z: 0}, command: row.command, tankType: 1, move: 30, turn: .5, dt: row.delta};
  const frozen = JSON.stringify(input);
  const actual = moveRoleThroughNavigation(input, row.mapMode === 'none' ? undefined : grid, {width: 48, depth: 48});
  assert.equal(JSON.stringify(input), frozen, 'Prediction and failure cannot mutate the source role');
  assert.equal(actual.accepted, row.result);
  assert.equal(actual.command, row.attempts.at(-1)!.command);
  for (const key of ['position', 'look', 'forward'] as const) {
    [actual.pose[key].x, actual.pose[key].y, actual.pose[key].z].forEach((value, axis) =>
      assert(Math.abs(value - row[key][axis]) < .00004, JSON.stringify({row, actual, key})));
  }
}
console.log(`PASS: ${native.rows.length} complete original movement wrappers: copy/commit, capped time, map samples, retry and partial failure direction`);

// Actual source-map bytes and original wrapper samples, beyond the synthetic fixture.
interface RealRow extends Row {start: number[];}
const real: {maps: {id: string; rows: RealRow[]}[]} = JSON.parse(readFileSync(
  'recovery/output/movement-real-nav-native.json', 'utf8'));
let realRows = 0;
for (const map of real.maps) {
  const grid = getBattlefield(Number(map.id)).navigation;
  for (const row of map.rows) {
    const actual = moveRoleThroughNavigation({position: {x: row.start[0], y: row.start[1], z: row.start[2]},
      look: {x: 1, y: 0, z: 0}, forward: {x: 1, y: 0, z: 0}, command: row.command,
      tankType: 1, move: 30, turn: .5, dt: row.delta}, grid, {width: 48, depth: 48});
    assert.equal(actual.accepted, row.result, JSON.stringify({map: map.id, row, actual}));
    assert.equal(actual.command, row.attempts.at(-1)!.command);
    for (const key of ['position', 'look', 'forward'] as const) {
      [actual.pose[key].x, actual.pose[key].y, actual.pose[key].z].forEach((value, axis) =>
        assert(Math.abs(value - row[key][axis]) < .0001, JSON.stringify({map: map.id, row, actual, key})));
    }
    realRows++;
  }
}
assert.equal(realRows, 4518);
console.log(`PASS: ${real.maps.length} real source maps, ${realRows} original movement/collision/retry/final-pose comparisons`);
