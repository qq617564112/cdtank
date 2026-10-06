import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoleObbFromPose, predictRoleMovementObb} from '../apps/server/src/battle/roles/movement-obb-prediction';
import type {RoleMovementMathInput} from '../apps/server/src/battle/roles/movement-math';
import type {RoleObb} from '../apps/server/src/battle/roles/obb-intersection';

interface MatrixRow {
  name: string;
  position: number[];
  forward: number[];
  output_obb: number[];
}
interface PredictionRow {
  name: string;
  command: RoleMovementMathInput['command'];
  dt: number;
  tank_type: RoleMovementMathInput['tankType'];
  definition_present: boolean;
  source_obb: number[];
  output_obb: number[];
  wrappers: {velocity: number; turn_velocity: number}[];
}
const vector = (v: readonly number[]) => ({x: v[0], y: v[1], z: v[2]});
const obb = (v: number[]): RoleObb => ({matrix: v.slice(0,16), dimensions: [v[16],v[17],v[18]]});
let maximumMatrixError = 0;
let maximumPositionError = 0;
function compare(actual: RoleObb, expected: number[], name: string): void {
  assert.deepEqual(actual.dimensions, expected.slice(16), name);
  assert.equal(actual.matrix.length, 16, name);
  actual.matrix.forEach((value, index) => {
    const error = Math.abs(value - expected[index]);
    const position = index >= 12 && index <= 14;
    assert(error <= (position ? .0002 : .000002), `${name} matrix[${index}] error=${error}`);
    if (position) maximumPositionError = Math.max(maximumPositionError, error);
    else maximumMatrixError = Math.max(maximumMatrixError, error);
  });
}
const matrices: {status: string; rows: MatrixRow[]} =
  JSON.parse(readFileSync('recovery/output/movement-obb-matrix-native.json', 'utf8'));
assert.equal(matrices.status, 'PASS');
for (const row of matrices.rows) {
  const pose = {position: vector(row.position), forward: vector(row.forward), look: vector(row.forward)};
  compare(createRoleObbFromPose(pose), row.output_obb, row.name);
}
const evidence: {status: string; rows: PredictionRow[];
  controller_rows: {name: string; matrices: {position: number[]; forward: number[]}[];
    obb: {left: number[]; right: number[]}[]}[]} =
  JSON.parse(readFileSync('recovery/output/movement-prediction-native.json', 'utf8'));
assert.equal(evidence.status, 'PASS');
for (const row of evidence.rows) {
  const sourceObb = obb(row.source_obb);
  const wrapper = row.wrappers[0];
  const input = {pose: {position: vector(sourceObb.matrix.slice(12,15)),
    look: {x: 1,y: 0,z: 0}, forward: {x: 1,y: 0,z: 0}}, command: row.command,
    tankType: row.definition_present ? row.tank_type : 1 as const,
    move: wrapper?.velocity ?? 30, turn: wrapper?.turn_velocity ?? .5, sourceObb};
  const before = JSON.stringify(input);
  const actual = predictRoleMovementObb(input, row.dt);
  compare(actual, row.output_obb, row.name);
  assert.equal(JSON.stringify(input), before, `${row.name} source unchanged`);
  assert.notEqual(actual.matrix, sourceObb.matrix);
  assert.notEqual(actual.dimensions, sourceObb.dimensions);
  if (Math.fround(row.dt) < Math.fround(.001)) assert.deepEqual(actual, sourceObb, row.name);
}
for (const row of evidence.controller_rows) {
  row.matrices.forEach((matrix, index) => {
    const expected = index === 0 ? row.obb[0].left : row.obb[0].right;
    compare(createRoleObbFromPose({position: vector(matrix.position), forward: vector(matrix.forward),
      look: vector(matrix.forward)}, obb(expected).dimensions), expected, row.name);
  });
}
console.log(`PASS ${matrices.rows.length} native matrices, ${evidence.rows.length} predictions, `+
  `${evidence.controller_rows.length * 2} controller matrices; matrix error ${maximumMatrixError}; position error ${maximumPositionError}`);
