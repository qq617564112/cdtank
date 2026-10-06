import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accumulateRoleReload, computeRoleReload, type RoleReloadFields} from '../recovery/evidence/roles/reload';
import {isRoleFireReady, roleSkillMultiplier} from '../apps/server/src/battle/roles/reload';
const evidence: {limits: {lower: number; upper: number}; rows: Array<{baseDuration: number; type1Factor: number;
  normalSeconds: number; type1Seconds: number}>;
  readiness: Array<{permitted: boolean; currentSeconds: number; nextAvailableSeconds: number; ready: boolean}>;
  additions: Array<RoleReloadFields & {delay: number; loadTime: number; multiplier: number; result: RoleReloadFields}>;
  multipliers: Array<{triggerType: number; roleValue9: number; funcZ1: number; multiplier: number}>;
} = JSON.parse(readFileSync('recovery/output/combat-reload-native.json', 'utf8'));
for (const row of evidence.rows) {
  const actual = computeRoleReload(row.baseDuration, row.type1Factor, evidence.limits);
  assert.deepEqual(actual, {normalSeconds: row.normalSeconds, type1Seconds: row.type1Seconds});
}
for (const row of evidence.readiness) {
  assert.equal(isRoleFireReady(row.permitted, row.currentSeconds, row.nextAvailableSeconds), row.ready);
}
for (const row of evidence.additions) {
  assert.deepEqual(accumulateRoleReload(row, row.delay, row.loadTime, row.multiplier), row.result);
}
for (const row of evidence.multipliers) {
  assert.equal(roleSkillMultiplier(row.triggerType, row.roleValue9, row.funcZ1), row.multiplier);
}
console.log(`PASS: ${evidence.rows.length} role durations, ${evidence.readiness.length} fire-readiness calls and ${evidence.additions.length} source skill additions match original execution`);
