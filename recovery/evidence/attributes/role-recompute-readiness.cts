import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {missingRoleRecomputeSource, type RoleRecomputePrerequisites} from '../../../apps/server/src/battle/roles/recompute-readiness';
const evidence: {rows: {present: Record<keyof RoleRecomputePrerequisites, boolean>;
  missing: keyof RoleRecomputePrerequisites | null}[]} =
  JSON.parse(readFileSync('recovery/output/role-recompute-readiness-native.json', 'utf8'));
for (const row of evidence.rows) {
  const sources = Object.fromEntries(Object.entries(row.present).map(([key, present]) =>
    [key, present ? {} : undefined])) as unknown as RoleRecomputePrerequisites;
  assert.equal(missingRoleRecomputeSource(sources), row.missing ?? undefined);
}
console.log(`PASS: ${evidence.rows.length} ordered original role recompute prerequisites`);
