import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bindRoleSourceTables, type RoleTableBinding} from '../recovery/evidence/combat/role-table-binding';
import {TANKS, PET_BASES} from '../apps/server/src/config';
const evidence: {rows: {field68: number; field78: number; before: {pet: number; tank: number};
  result: {pet: number; tank: number}; lookups: {kind: string; id: number}[]}[]} =
  JSON.parse(readFileSync('recovery/output/role-table-binding-native.json', 'utf8'));
const tanks = new Map(TANKS.map(tank => [tank.id, tank.recomputeBase]));
const pets = new Map(PET_BASES.map(pet => [pet.id, pet]));
for (const row of evidence.rows) {
  const binding: RoleTableBinding = {pet: pets.get(row.before.pet), tank: tanks.get(row.before.tank)};
  const lookups: {kind: string; id: number}[] = [];
  bindRoleSourceTables(binding, row, id => {
    lookups.push({kind: 'pet', id: id >>> 0}); return pets.get(id);
  }, id => {lookups.push({kind: 'tank', id: id >>> 0}); return tanks.get(id);});
  assert.deepEqual(lookups, row.lookups);
  assert.deepEqual({pet: binding.pet!.id, tank: binding.tank!.id}, row.result);
}
console.log(`PASS: ${evidence.rows.length} original role message → formal pet/tank table binding contracts`);
