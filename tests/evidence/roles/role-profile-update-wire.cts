import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeRoleProfileUpdate} from './role-profile-update-wire';
import {applyRoleProfileUpdate, readRoleProfilePacket} from './role-profile-update';
const evidence: {rows: {alignment: number; raw: number[]; profileBytes: number[];
  code: number; result: number; endBit: number}[]} = JSON.parse(
  readFileSync('recovery/output/role-profile-update-wire-native.json', 'utf8'));
let applied = 0;
for (const row of evidence.rows) {
  const bytes = new Uint8Array(row.raw);
  const parsed = decodeRoleProfileUpdate(bytes, row.alignment);
  assert.equal(parsed.endBit, row.endBit);
  assert.deepEqual(parsed.message, {profileBytes: new Uint8Array(row.profileBytes), code: row.code, result: row.result});
  assert.deepEqual([...bytes], row.raw);
  if (row.code === 3 || row.profileBytes.length > 1) {
    const before = new Uint8Array(0x170).fill(0xaa);
    const profile = {bytes: new Uint8Array(before), strings: ['old0', 'old1'] as [string, string]};
    const expected = {bytes: new Uint8Array(before), strings: ['old0', 'old1'] as [string, string]};
    const decode = (input: Uint8Array): string => Buffer.from(input).toString('latin1');
    if (row.code !== 3) readRoleProfilePacket(expected, parsed.message.profileBytes, 0, decode);
    const notifications: number[] = [];
    applyRoleProfileUpdate(Array.from({length: 7}, () => []), profile, parsed.message, decode,
      new Map([[row.code, value => {assert.deepEqual(profile, expected); notifications.push(value);}]]));
    assert.deepEqual(profile, expected);
    assert.deepEqual(notifications, row.code === 255 ? [] : [row.code === 3 ? row.result : 1]);
    applied++;
  }
}
console.log(`PASS: ${evidence.rows.length} native3aac envelopes and ${applied} envelope-to-profile updates`);
