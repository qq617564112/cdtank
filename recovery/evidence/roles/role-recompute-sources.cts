import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveRoleRecomputeSource} from '../../../apps/server/src/accounts/owned/source-selection';
import {readRoleProfileSelection} from '../../../apps/server/src/accounts/profile/selection';
import {setRoleProfileSelection} from './role-profile-selection';

const evidence: {rows: {stage: number; selector: 28 | 29; instanceId: number;
  direct: number; available: boolean; result: number; lookups: number[]}[];
  selectionRows: {selector: 28 | 29; offset: number; value: number}[]}
  = JSON.parse(readFileSync('recovery/output/role-recompute-sources-native.json', 'utf8'));
for (const row of evidence.rows) {
  const lookups: number[] = [];
  const profile = new Map<number, number>([[0x84, 0], [0x88, 0]]);
  setRoleProfileSelection(profile, row.selector, row.instanceId);
  const result = resolveRoleRecomputeSource(row.stage, row.direct || undefined,
    readRoleProfileSelection(profile, row.selector), id => {
    lookups.push(id);
    return row.available ? row.direct : undefined;
  });
  assert.equal(result ?? 0, row.result);
  assert.deepEqual(lookups, row.lookups);
}
for (const row of evidence.selectionRows) {
  const profile = new Map<number, number>([[0x84, 0xaaaaaaaa], [0x88, 0xaaaaaaaa], [0x80, 7]]);
  setRoleProfileSelection(profile, row.selector, row.value);
  assert.equal(readRoleProfileSelection(profile, row.selector), row.value);
  assert.deepEqual([...profile], [[0x84, row.offset === 0x84 ? row.value : 0xaaaaaaaa],
    [0x88, row.offset === 0x88 ? row.value : 0xaaaaaaaa], [0x80, 7]]);
}
console.log(`PASS: ${evidence.rows.length} recompute source selections match original stage/profile/instance getters`);
console.log(`PASS: ${evidence.selectionRows.length} original profile selection getter/setter contracts`);
