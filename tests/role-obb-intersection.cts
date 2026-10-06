import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {intersectsOriginalObb, type RoleObb} from '../apps/server/src/battle/roles/obb-intersection';

interface OracleRow {
  readonly name: string;
  readonly left: RoleObb;
  readonly right: RoleObb;
  readonly result: boolean;
  readonly trace: {readonly cross_comparisons: number; readonly cross_continues: number};
}
const output = resolve(__dirname, '../recovery/output');
const oracle = JSON.parse(readFileSync(resolve(output, 'role-obb-kernel-native.json'), 'utf8')) as {
  status: string;
  rows: OracleRow[];
};
assert.equal(oracle.status, 'PASS');
for (const row of oracle.rows) {
  assert.equal(intersectsOriginalObb(row.left, row.right), row.result, row.name);
}
const crossSeparated = oracle.rows.filter(row => row.result &&
  row.trace.cross_comparisons > row.trace.cross_continues);
assert.ok(crossSeparated.length > 0);
const summary = `PASS ${oracle.rows.length} service OBB comparisons against original instructions; ` +
  `${crossSeparated.length} cross-only separations preserve original success`;
writeFileSync(resolve(output, 'role-obb-kernel-service.log'), `${summary}\n`);
console.log(summary);
