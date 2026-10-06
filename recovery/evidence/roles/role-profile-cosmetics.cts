import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readRoleProfileCosmetics, writeRoleProfileCosmetic} from '../../../apps/server/src/accounts/profile/cosmetics';
const evidence = JSON.parse(readFileSync('recovery/output/role-profile-cosmetics-native.json', 'utf8')) as {
  rows: {kind: 'skin' | 'mark'; value: number; before: number[]; after: number[];
    skinInstanceId: number; markInstanceId: number}[];
};
assert.equal(evidence.rows.length, 32);
for (const row of evidence.rows) {
  const profile = {bytes: new Uint8Array(row.before), strings: ['name', 'pet'] as [string, string]};
  assert.deepEqual(readRoleProfileCosmetics(profile), {
    skinInstanceId: row.skinInstanceId, markInstanceId: row.markInstanceId});
  writeRoleProfileCosmetic(profile, row.kind, row.value);
  assert.deepEqual([...profile.bytes], row.after);
  assert.deepEqual(profile.strings, ['name', 'pet']);
}
console.log('PASS: 32 original cosmetic profile updates, unchanged trailing mark words and strings');
