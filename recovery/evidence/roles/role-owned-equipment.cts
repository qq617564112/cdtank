import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ownedRoleEquipmentFields, readOwnedRoleEquipmentRecord, receiveOwnedRoleEquipmentBatch} from './role-owned-equipment';
import type {OwnedRoleEquipmentRecord} from '../../../apps/shared/contracts/owned-equipment';
import {receiveOwnedRoleSourcesMessage} from './role-owned-sources';
import type {OwnedRoleBaseRecord} from '../../../apps/shared/contracts/owned-base';
import {resolveRoleRecomputeSource} from '../../../apps/server/src/accounts/owned/source-selection';

interface IndexedRecord {
  key: number;
  fields: Record<string, number>;
  nameBytes: number[];
}
const evidence: {
  arrayGates: {raw: number[]; declared: number; capacity: number;
    beforeBase: Omit<IndexedRecord, 'nameBytes'>[]; beforeEquipment: Omit<IndexedRecord, 'nameBytes'>[];
    finalBit: number}[];
  messages: {type: number; alignment: number; raw: number[];
    beforeBase: Omit<IndexedRecord, 'nameBytes'>[]; beforeEquipment: Omit<IndexedRecord, 'nameBytes'>[];
    base: Omit<IndexedRecord, 'nameBytes'>[]; equipment: Omit<IndexedRecord, 'nameBytes'>[];
    additional: number[]; finalBit: number}[];
  fields: [number, number][];
  rows: {alignment: number; raw: number[]; nameBytes: number[]; result: Record<string, number>; finalBit: number}[];
  batches: {alignment: number; raw: number[]; before: IndexedRecord[]; result: IndexedRecord[];
    finalBit: number; lookups: {key: number; found: boolean}[]}[];
} = JSON.parse(readFileSync('recovery/output/role-owned-equipment-native.json', 'utf8'));
assert.deepEqual(ownedRoleEquipmentFields, evidence.fields);
for (const row of evidence.rows) {
  let cursor = row.alignment;
  const widths: number[] = [];
  const unsigned = (width: number): number => {
    let value = 0;
    for (let bit = 0; bit < width; bit++, cursor++) {
      value += ((row.raw[cursor >>> 3]! >>> (cursor & 7)) & 1) * 2 ** bit;
    }
    return value;
  };
  const record = readOwnedRoleEquipmentRecord({
    unsigned: width => { widths.push(width); return unsigned(width); },
    name: () => {
      assert.equal(cursor, row.alignment);
      const bytes = new Uint8Array(unsigned(32));
      for (let index = 0; index < bytes.length; index++) bytes[index] = unsigned(8);
      assert.deepEqual([...bytes], row.nameBytes);
      return Buffer.from(bytes).toString('hex');
    },
  });
  assert.equal(cursor, row.finalBit);
  assert.deepEqual(widths, evidence.fields.map(([, width]) => width));
  assert.deepEqual(Object.fromEntries(record.fields), row.result);
  assert.equal(record.name, Buffer.from(row.nameBytes).toString('hex'));
}
const records = new Map<number, OwnedRoleEquipmentRecord>();
const indexed = (): IndexedRecord[] => [...records].sort(([left], [right]) => left - right)
  .map(([key, record]) => ({key, fields: Object.fromEntries(record.fields),
    nameBytes: [...Buffer.from(record.name, 'hex')]}));
for (const batch of evidence.batches) {
  assert.deepEqual(indexed(), batch.before);
  assert.equal(receiveOwnedRoleEquipmentBatch(records, new Uint8Array(batch.raw), batch.alignment,
    bytes => Buffer.from(bytes).toString('hex')), batch.finalBit);
  assert.deepEqual(indexed(), batch.result);
  for (const lookup of batch.lookups) {
    const source = resolveRoleRecomputeSource(2, undefined, lookup.key, key => records.get(key));
    assert.equal(source !== undefined, lookup.found);
    if (source) assert.equal(source.fields.get(0x1c), lookup.key);
  }
}
console.log(`PASS: ${evidence.rows.length} second-source records and ${evidence.batches.length} native batch/lookup comparisons`);

const baseRecords = new Map<number, OwnedRoleBaseRecord>();
const equipmentRecords = new Map<number, OwnedRoleEquipmentRecord>();
const fieldsOnly = (table: ReadonlyMap<number, {fields: ReadonlyMap<number, number>}>) =>
  [...table].sort(([left], [right]) => left - right)
    .map(([key, record]) => ({key, fields: Object.fromEntries(record.fields)}));
for (const message of evidence.messages) {
  assert.equal(message.type, 0x3aab);
  assert.deepEqual(fieldsOnly(baseRecords), message.beforeBase);
  assert.deepEqual(fieldsOnly(equipmentRecords), message.beforeEquipment);
  const parsed = receiveOwnedRoleSourcesMessage(baseRecords, equipmentRecords,
    new Uint8Array(message.raw), message.alignment, 4096, bytes => Buffer.from(bytes).toString('hex'));
  assert.equal(parsed.additionalLength, message.additional.length);
  assert.deepEqual([...parsed.additional!], message.additional);
  assert.equal(parsed.endBit, message.finalBit);
  assert.deepEqual(fieldsOnly(baseRecords), message.base);
  assert.deepEqual(fieldsOnly(equipmentRecords), message.equipment);
}
console.log(`PASS: ${evidence.messages.length} complete3aab messages with both owned tables and additional bytes`);

for (const gate of evidence.arrayGates) {
  assert.deepEqual(fieldsOnly(baseRecords), gate.beforeBase);
  assert.deepEqual(fieldsOnly(equipmentRecords), gate.beforeEquipment);
  const parsed = receiveOwnedRoleSourcesMessage(baseRecords, equipmentRecords,
    new Uint8Array(gate.raw), 0, gate.capacity, bytes => Buffer.from(bytes).toString('hex'));
  assert.deepEqual(parsed, {additionalLength: gate.declared, additional: undefined, endBit: gate.finalBit});
  assert.equal(baseRecords.size, 0);
  assert.equal(equipmentRecords.size, 0);
}
console.log(`PASS: ${evidence.arrayGates.length} original additional-array capacity gates`);
