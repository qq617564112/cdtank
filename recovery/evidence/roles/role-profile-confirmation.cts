import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyRoleProfileConfirmation} from './role-profile-confirmation';
const evidence: {rows: {result: number; callback: boolean; before: number[]; source: number[];
  beforeStrings: [string, string]; sourceStrings: [string, string]; profile: number[];
  strings: [string, string]; events: {result: number; profile: number[]; strings: string[]}[]}[]} =
  JSON.parse(readFileSync('recovery/output/role-profile-confirmation-native.json', 'utf8'));
for (const row of evidence.rows) {
  const profile = {bytes: new Uint8Array(row.before), strings: [...row.beforeStrings] as [string, string]};
  const source = {bytes: new Uint8Array(row.source), strings: [...row.sourceStrings] as [string, string]};
  const events: typeof row.events = [];
  applyRoleProfileConfirmation(profile, {result: row.result, profile: source}, row.callback ? result => {
    events.push({result, profile: [...profile.bytes], strings: [...profile.strings]});
  } : undefined);
  assert.deepEqual([...profile.bytes], row.profile);
  assert.deepEqual(profile.strings, row.strings);
  assert.deepEqual(events, row.events);
  assert.deepEqual([...source.bytes], row.source);
  assert.deepEqual(source.strings, row.sourceStrings);
}
console.log(`PASS: ${evidence.rows.length} native profile confirmations, all copied bytes and callback timing`);
