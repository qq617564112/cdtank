import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moveRolePose, RoleMovementMathInput} from '../apps/server/src/battle/roles/movement-math';
interface NativeRow {
  input: Omit<RoleMovementMathInput, 'position' | 'look' | 'forward'> &
    {position: number[]; look: number[]; forward: number[]};
  output: {position: number[]; look: number[]; forward: number[]};
}
const evidence: {status: string; rows: NativeRow[]; executedBranches: Record<string, number>} =
  JSON.parse(readFileSync('recovery/output/movement-directions-native.json', 'utf8'));
assert.equal(evidence.status, 'PASS');
assert(Object.values(evidence.executedBranches).every(count => count > 0));
let maximumPositionError = 0;
let maximumDirectionError = 0;
for (const row of evidence.rows) {
  const vector = (values: number[]) => ({x: values[0], y: values[1], z: values[2]});
  const actual = moveRolePose({...row.input, position: vector(row.input.position),
    look: vector(row.input.look), forward: vector(row.input.forward)});
  for (const key of ['position', 'look', 'forward'] as const) {
    const values = [actual[key].x, actual[key].y, actual[key].z];
    for (let index = 0; index < 3; index++) {
      const error = Math.abs(values[index] - row.output[key][index]);
      assert(error <= (key === 'position' ? .0002 : .000002),
        `${key}[${index}] ${error}: ${JSON.stringify(row)} actual ${JSON.stringify(actual)}`);
      if (key === 'position') maximumPositionError = Math.max(maximumPositionError, error);
      else maximumDirectionError = Math.max(maximumDirectionError, error);
    }
  }
}
console.log(`PASS ${evidence.rows.length} native movement samples; position error ${maximumPositionError}; direction error ${maximumDirectionError}`);
