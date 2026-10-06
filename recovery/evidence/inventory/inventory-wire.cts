import type {InventoryWireRecord} from '../../../apps/shared/protocols/PtlInventory';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeInventoryRecord, encodeInventoryRecord} from './inventory-wire';
import {applyInventoryQuery, type InventoryItemRecord} from '../../../apps/shared/combat/inventory-query';

interface NativeRow {
  record: Omit<InventoryWireRecord, 'state'>;
  bitOffset: number;
  payload: string;
  result: InventoryWireRecord;
}
const evidence: {rows: NativeRow[]} = JSON.parse(readFileSync('recovery/output/inventory-wire-native.json', 'utf8'));
for (const row of evidence.rows) {
  const encoded = encodeInventoryRecord({...row.record, state: 99}, row.bitOffset);
  assert.equal(Buffer.from(encoded).toString('hex'), row.payload, 'Byte-for-byte original record writer');
  const decoded = decodeInventoryRecord(Buffer.from(row.payload, 'hex'), row.bitOffset);
  assert.deepEqual(decoded, row.result, 'Original constructor and record reader');
}
assert.throws(() => decodeInventoryRecord(new Uint8Array(27)), RangeError);

const sample = evidence.rows.find(row => row.record.itemTableId === 2001 && row.bitOffset === 0)!;
const decoded = decodeInventoryRecord(Buffer.from(sample.payload, 'hex'));
const groups: InventoryItemRecord[][] = Array.from({length: 8}, () => []);
applyInventoryQuery(groups, [decoded], {field44: 0, field45: 0,
  array1: [0, 0, 0], array2: [0, 0, 0, 0, 0]});
assert.equal(groups[1][0], decoded, 'Decoded original record enters the recovered query category');
assert.equal(decoded.state, 0);
console.log(`PASS: ${evidence.rows.length} native inventory wire records, byte equality, bit offsets, float bits and decoded query import`);
