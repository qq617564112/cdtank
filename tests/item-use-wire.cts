import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeItemUse, encodeItemUse, type ItemUsePacket} from '../recovery/evidence/combat/item-use-wire';

const oracle = JSON.parse(readFileSync('recovery/output/item-use-wire-native.json', 'utf8')) as {
  rows: {packet: ItemUsePacket; bitOffset: number; payload: string}[];
};
for (const row of oracle.rows) {
  const bytes = Buffer.from(row.payload, 'hex');
  assert.equal(Buffer.from(encodeItemUse(row.packet, row.bitOffset)).toString('hex'), row.payload);
  assert.deepEqual(decodeItemUse(bytes, row.bitOffset), row.packet);
}
assert.throws(() => decodeItemUse(new Uint8Array(8)), RangeError);
console.log(`PASS: ${oracle.rows.length} shared item-use packets match original x86 bytes and values`);
