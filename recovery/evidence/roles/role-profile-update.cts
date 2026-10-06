import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyRoleProfileUpdate, readRoleProfilePacket} from './role-profile-update';
import {readRoleProfileSelection} from '../../../apps/server/src/accounts/profile/selection';
import type {RoleProfilePayload} from '../../../apps/server/src/accounts/profile/payload';
interface Event {value: number; profile: number[]; strings: number[][]; states: number[];}
interface ReaderRow {alignment: number; raw: number[]; before: number[]; profile: number[];
  strings: number[][]; endBit: number;}
interface UpdateRow extends Omit<ReaderRow, 'alignment' | 'endBit'> {
  code: number; callback: boolean; states: number[]; events: Event[];
}
const evidence: {readers: ReaderRow[]; updates: UpdateRow[]} = JSON.parse(
  readFileSync('recovery/output/role-profile-update-native.json', 'utf8'));
const decode = (bytes: Uint8Array): string => String.fromCharCode(...bytes);
const encode = (value: string): number[] => [...value].map(char => char.charCodeAt(0));
function profile(before: number[]): RoleProfilePayload {
  const bytes = new Uint8Array(before);
  new DataView(bytes.buffer).setUint32(0, 0x5c4118, true);
  return {bytes, strings: ['old0', 'old1']};
}
for (const row of evidence.readers) {
  const value = profile(row.before);
  const bytes = new Uint8Array(row.raw);
  assert.equal(readRoleProfilePacket(value, bytes, row.alignment, decode), row.endBit);
  assert.deepEqual([...value.bytes], row.profile);
  assert.deepEqual(value.strings.map(encode), row.strings);
  const view = new DataView(value.bytes.buffer);
  const fields = new Map([[0x84, view.getUint32(0xa4, true)], [0x88, view.getUint32(0xa8, true)]]);
  assert.equal(readRoleProfileSelection(fields, 28), new DataView(Uint8Array.from(row.profile).buffer).getUint32(0xa4, true));
  assert.equal(readRoleProfileSelection(fields, 29), new DataView(Uint8Array.from(row.profile).buffer).getUint32(0xa8, true));
  assert.deepEqual([...bytes], row.raw);
}
for (const row of evidence.updates) {
  const value = profile(row.before);
  const groups = Array.from({length: 7}, (_, index) => [{state: 0x80000001 + index}]);
  const callbacks = new Map<number, (value: number) => void>();
  const events: Event[] = [];
  if (row.callback) callbacks.set(row.code, result => events.push({value: result,
    profile: [...value.bytes], strings: value.strings.map(encode),
    states: groups.map(group => group[0].state)}));
  applyRoleProfileUpdate(groups, value, {code: row.code, result: 0xf1234567,
    profileBytes: new Uint8Array(row.raw)}, decode, callbacks);
  assert.deepEqual([...value.bytes], row.profile);
  assert.deepEqual(value.strings.map(encode), row.strings);
  const view = new DataView(value.bytes.buffer);
  const fields = new Map([[0x84, view.getUint32(0xa4, true)], [0x88, view.getUint32(0xa8, true)]]);
  assert.equal(readRoleProfileSelection(fields, 28), new DataView(Uint8Array.from(row.profile).buffer).getUint32(0xa4, true));
  assert.equal(readRoleProfileSelection(fields, 29), new DataView(Uint8Array.from(row.profile).buffer).getUint32(0xa8, true));
  assert.deepEqual(groups.map(group => group[0].state), row.states);
  assert.deepEqual(events, row.events);
}
console.log(`PASS: ${evidence.readers.length} native profile wire reads and ${evidence.updates.length} complete updates`);
