import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {CombatCatalog, CombatDataScaleDefinition} from '../../../apps/shared/combat/catalog';
import {applyRoleDataScale, readRoleDataScaleLimits, ROLE_MAX_HP_DATA_SCALE_ID, type RoleDataScaleLimit} from '../../../apps/server/src/battle/roles/data-scale';
import {finishRoleMaxHp} from '../roles/role-max-hp';
import {computeRoleReload} from '../roles/reload';

const evidence: {
  initial: Record<string, RoleDataScaleLimit>;
  rows: (CombatDataScaleDefinition & {before: Record<string, RoleDataScaleLimit>; after: Record<string, RoleDataScaleLimit>})[];
  final: Record<string, RoleDataScaleLimit>;
  caps: {value: number; hp: number; maxHp: number}[];
  reloads: {base: number; factor: number; normalSeconds: number; type1Seconds: number}[];
} = JSON.parse(readFileSync('recovery/output/role-data-scale-native.json', 'utf8'));
const limits = new Map(Object.entries(evidence.initial).map(([id, limit]) => [Number(id), {...limit}]));
for (const row of evidence.rows) {
  assert.deepEqual(Object.fromEntries(limits), row.before);
  applyRoleDataScale(limits, row);
  assert.deepEqual(Object.fromEntries(limits), row.after);
}
const catalog: CombatCatalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8'));
assert.deepEqual(catalog.dataScales, evidence.rows.map(({id, name, minimum, maximum}) => ({id, name, minimum, maximum})));
const loaded = readRoleDataScaleLimits(catalog.dataScales);
assert.deepEqual(Object.fromEntries(loaded), evidence.final);
for (const row of evidence.caps) {
  assert.equal(finishRoleMaxHp(row.value, loaded.get(ROLE_MAX_HP_DATA_SCALE_ID)!, 0, 1), row.maxHp);
  assert.equal(row.hp, 777);
}
for (const row of evidence.reloads) {
  assert.deepEqual(computeRoleReload(row.base, row.factor, loaded.get(16)!),
    {normalSeconds: row.normalSeconds, type1Seconds: row.type1Seconds});
}
console.log(`PASS: ${evidence.rows.length} source data scales,23 loaded limit pairs,6 HP caps and18 reload conversions match original x86`);
