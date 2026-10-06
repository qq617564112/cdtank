import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {roleEquipmentSlotCount} from '../../../apps/server/src/accounts/equipment/slot-count';
interface Row {parts: number[]; capacity: number; gearPresent: boolean; bases: number[];
  ranks: number[]; bonuses: [number, number][]; result: number; lookups: number[];}
const evidence: {rows: Row[]} = JSON.parse(
  readFileSync('recovery/output/role-equipment-slot-count-native.json', 'utf8'));
for (const row of evidence.rows) {
  const bonus = new Map(row.bonuses);
  const lookups: number[] = [];
  const value = roleEquipmentSlotCount({parts: row.parts, capacity: row.capacity},
    row.gearPresent ? {skillIds: row.bases, ranks: row.ranks} : undefined, key => {
      lookups.push(key);
      return bonus.has(key) ? {partSlots: bonus.get(key)!} : undefined;
    });
  assert.equal(value, row.result);
  assert.deepEqual(lookups, row.lookups);
}
console.log(`PASS: ${evidence.rows.length} native dynamic equipment slot counts and lookup order`);
