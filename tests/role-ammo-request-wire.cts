import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeRoleAmmoRequest, encodeRoleAmmoRequest, ROLE_AMMO_REQUEST_BODY_BITS,
  ROLE_AMMO_REQUEST_MESSAGE_TYPE} from '../recovery/evidence/combat/role-ammo-request-wire';
import {decodeRoleAmmoChange, ROLE_AMMO_CHANGE_MESSAGE_TYPE} from '../recovery/evidence/roles/role-ammo-change-wire';

interface Request {slot: number; field10: number}
const evidence: {status: string; rows: {present: boolean; status: number;
  constructorFields: number[]; events: Request[]}[];
  wire: (Request & {offset: number; payload: string})[]} =
  JSON.parse(readFileSync('recovery/output/role-ammo-request-native.json', 'utf8'));
assert.equal(evidence.status, 'PASS');
assert.equal(ROLE_AMMO_REQUEST_MESSAGE_TYPE, ROLE_AMMO_CHANGE_MESSAGE_TYPE);
assert.equal(ROLE_AMMO_REQUEST_BODY_BITS, 64);
for (const row of evidence.rows) {
  assert.deepEqual(row.events, row.present && row.status === 2 ?
    [{slot: 1, field10: row.constructorFields[0]}] : []);
}
for (const row of evidence.wire) {
  const packet = {slot: row.slot, field10: row.field10};
  const bytes = Buffer.from(row.payload, 'hex');
  assert.equal(Buffer.from(encodeRoleAmmoRequest(packet, row.offset)).toString('hex'), row.payload);
  assert.deepEqual(decodeRoleAmmoRequest(bytes, row.offset), packet);
  assert.throws(() => decodeRoleAmmoChange(bytes, row.offset), RangeError);
  assert.throws(() => decodeRoleAmmoRequest(bytes.subarray(0, bytes.length - 1), row.offset), RangeError);
}
for (const offset of [-1, 0.5, NaN, Infinity]) {
  assert.throws(() => encodeRoleAmmoRequest({slot: 1, field10: 0}, offset), RangeError);
  assert.throws(() => decodeRoleAmmoRequest(new Uint8Array(8), offset), RangeError);
}
console.log(`PASS: ${evidence.rows.length} original default-slot gates; ${evidence.wire.length} original request codecs and directional body separation`);
