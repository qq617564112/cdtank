import type {InventoryWireRecord} from '../../../apps/shared/protocols/PtlInventory';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeInventoryQuery, encodeInventoryQuery} from './inventory-wire';
import {applyInventoryQuery, type InventoryItemRecord} from '../../../apps/shared/combat/inventory-query';

interface NativeRow {
  input: InventoryWireRecord[];
  bitOffset: number;
  payload: string;
  encoded: string;
  fieldC: number;
  records: InventoryWireRecord[];
}
const evidence: {rows: NativeRow[]} = JSON.parse(readFileSync('recovery/output/inventory-packet-native.json', 'utf8'));
for (const row of evidence.rows) {
  const decoded = decodeInventoryQuery(Buffer.from(row.payload, 'hex'), row.bitOffset);
  assert.deepEqual(decoded, {fieldC: row.fieldC, records: row.records}, 'Complete original packet decoder/tree');
  assert.equal(Buffer.from(encodeInventoryQuery(decoded, row.bitOffset)).toString('hex'), row.encoded);
  assert.equal(Buffer.from(encodeInventoryQuery({fieldC: row.fieldC, records: row.input}, row.bitOffset)).toString('hex'),
    row.encoded, 'Original unsigned sort and first duplicate behavior');
  const groups: InventoryItemRecord[][] = Array.from({length: 8}, () => []);
  applyInventoryQuery(groups, decoded.records, {field44: 0, field45: 0,
    array1: [0, 0, 0], array2: [0, 0, 0, 0, 0]});
  assert(decoded.records.every(record => record.state === 0));
  assert(groups.flat().every(record => decoded.records.some(decodedRecord => decodedRecord === record)),
    'Decoded tree records reach query state by reference');
}
assert.throws(() => decodeInventoryQuery(new Uint8Array(5)), RangeError);
console.log(`PASS: ${evidence.rows.length} complete native inventory query packets, sort/duplicates, exact bytes and query import`);
