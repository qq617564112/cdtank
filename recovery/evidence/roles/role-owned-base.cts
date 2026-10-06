import type {OwnedRoleBaseRecord} from '../../../apps/shared/contracts/owned-base';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ownedRoleBaseMaxHp, readOwnedRoleBaseRecord, readOwnedRoleBasePacket, receiveOwnedRoleBaseBatch, receiveOwnedRoleBaseMessage} from './role-owned-base';
import {resolveRoleRecomputeSource} from '../../../apps/server/src/accounts/owned/source-selection';
import {readRoleDataScaleLimits} from '../../../apps/server/src/battle/roles/data-scale';
import {finishRoleMaxHp} from './role-max-hp';
import type {CombatCatalog} from '../../../apps/shared/combat/catalog';

const evidence: {messages: {type: number; alignment: number; raw: number[]; before: {key: number; fields: Record<string, number>}[]; result: {key: number; fields: Record<string, number>}[]; field1c: number; finalBit: number}[]; batches: {alignment: number; raw: number[]; before: {key: number; fields: Record<string, number>}[]; result: {key: number; fields: Record<string, number>}[]; finalBit: number}[]; fields: {offset: number; width: number}[]; rows: {
  alignment: number; raw: number[]; result: Record<string, number>; maxHp: number; finalBit: number; nameBytes: number[];
}[]} = JSON.parse(readFileSync('recovery/output/role-owned-base-native.json', 'utf8'));
const catalog: CombatCatalog = JSON.parse(readFileSync('recovery/output/web-assets/combat-catalog.json', 'utf8'));
const limits = readRoleDataScaleLimits(catalog.dataScales).get(1)!;
for (const row of evidence.rows) {
  let cursor = row.alignment;
  const widths: number[] = [];
  const record = readOwnedRoleBaseRecord({
    unsigned: width => {
      widths.push(width);
      let value = 0;
      for (let bit = 0; bit < width; bit++, cursor++) {
        value += ((row.raw[cursor >>> 3]! >>> (cursor & 7)) & 1) * 2 ** bit;
      }
      return value;
    },
    name: () => {
      assert.equal(cursor, row.alignment + 304);
      const nameLength = row.nameBytes.length;
      cursor += 32 + nameLength * 8;
      return Buffer.from(row.nameBytes).toString('hex');
    },
  });
  const packet = readOwnedRoleBasePacket(new Uint8Array(row.raw), row.alignment, bytes => Buffer.from(bytes).toString('hex'));
  assert.deepEqual([...packet.nameBytes], row.nameBytes);
  assert.equal(packet.endBit, row.finalBit);
  assert.equal(packet.record.name, record.name);
  assert.deepEqual(Object.fromEntries(packet.record.fields), row.result);
  assert.deepEqual(Object.fromEntries(record.fields), row.result);
  assert.deepEqual(widths, evidence.fields.map(field => field.width));
  assert.equal(cursor, row.finalBit);
  assert.equal(ownedRoleBaseMaxHp(record), row.maxHp);
  // Use the recovered instance key path before applying loaded source limits.
  const instanceId = record.fields.get(0)!;
  const owned = new Map([[instanceId, record]]);
  const selected = resolveRoleRecomputeSource(2, undefined, instanceId, id => owned.get(id));
  assert.equal(selected, record);
  const health = {hp: 777, maxHp: finishRoleMaxHp(ownedRoleBaseMaxHp(selected!), limits, 0, 1)};
  assert.equal(health.maxHp, Math.min(999, row.maxHp));
  assert.equal(health.hp, 777);
}
console.log(`PASS: ${evidence.rows.length} owned-base integer contracts and instance lookup → loaded MaxHP limits`);

const ownedRecords = new Map<number, OwnedRoleBaseRecord>();
const indexed = () => [...ownedRecords].sort(([left], [right]) => left - right)
  .map(([key, record]) => ({key, fields: Object.fromEntries(record.fields)}));
for (const batch of evidence.batches) {
  assert.deepEqual(indexed(), batch.before);
  assert.equal(receiveOwnedRoleBaseBatch(ownedRecords, new Uint8Array(batch.raw), batch.alignment,
    bytes => Buffer.from(bytes).toString('hex')), batch.finalBit);
  assert.deepEqual(indexed(), batch.result);
  for (const row of batch.result) {
    const selected = resolveRoleRecomputeSource(2, undefined, row.key, id => ownedRecords.get(id));
    assert.equal(ownedRoleBaseMaxHp(selected!), row.fields['44']);
  }
}
console.log(`PASS: ${evidence.batches.length} native batch replacements and first-record duplicate selection`);

for (const message of evidence.messages) {
  assert.equal(message.type, 0x4078);
  assert.deepEqual(indexed(), message.before);
  const parsed = receiveOwnedRoleBaseMessage(ownedRecords, new Uint8Array(message.raw), message.alignment,
    bytes => Buffer.from(bytes).toString('hex'));
  assert.deepEqual(parsed, {field1c: message.field1c, endBit: message.finalBit});
  assert.deepEqual(indexed(), message.result);
}
console.log(`PASS: ${evidence.messages.length} complete type4078 message replacements and unsigned tails`);
