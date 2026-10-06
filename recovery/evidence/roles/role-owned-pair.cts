import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readOwnedRolePairMessage} from './role-owned-sources';
const evidence: {rows: {alignment: number; raw: number[]; equipment: Record<string, number>;
  base: Record<string, number>; equipmentName: number[]; baseName: number[]; finalBit: number}[]} =
  JSON.parse(readFileSync('recovery/output/role-owned-pair-native.json', 'utf8'));
for (const row of evidence.rows) {
  const parsed = readOwnedRolePairMessage(new Uint8Array(row.raw), row.alignment,
    bytes => Buffer.from(bytes).toString('hex'));
  assert.deepEqual(Object.fromEntries(parsed.equipment.fields), row.equipment);
  assert.deepEqual(Object.fromEntries(parsed.base.fields), row.base);
  assert.equal(parsed.equipment.name, Buffer.from(row.equipmentName).toString('hex'));
  assert.equal(parsed.base.name, Buffer.from(row.baseName).toString('hex'));
  assert.equal(parsed.endBit, row.finalBit);
}
console.log(`PASS: ${evidence.rows.length} original3aa5 paired owned-record messages`);
