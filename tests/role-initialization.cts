import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {needsRoleInitialization, needsBattleRoleInitialization} from '../recovery/evidence/combat/role-initialization';
const evidence: {rows: {present: boolean[]; needsInitialization: boolean}[];
  battleRows: {present: boolean[]; needsInitialization: boolean; ownerInitializationCalled: boolean}[]} =
  JSON.parse(readFileSync('recovery/output/role-initialization-native.json', 'utf8'));
for (const row of evidence.rows) {
  const [role, base, equipment] = row.present.map(present => present ? {} : undefined);
  assert.equal(needsRoleInitialization(role, base, equipment), row.needsInitialization);
}
for (const row of evidence.battleRows) {
  const role = row.present[0] ? {} : undefined;
  assert.equal(needsBattleRoleInitialization(role), row.needsInitialization);
  assert.equal(!needsBattleRoleInitialization(role), row.ownerInitializationCalled);
}
console.log(`PASS: ${evidence.rows.length} base and ${evidence.battleRows.length} network role initialization gates`);
