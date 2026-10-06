import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {
  createRoleEntityFireRequest, encodeRoleEntityFireRequest, decodeRoleEntityFireRequest,
  ROLE_ENTITY_FIRE_BODY_BITS, ROLE_ENTITY_FIRE_MESSAGE_TYPE,
} from '../recovery/evidence/combat/role-entity-fire';
import type {RoleEntityFireSnapshot} from '../recovery/evidence/combat/role-entity-fire';

interface NativeSend {
  kind: string; type: number; targetId: number; actor: number[]; target: number[];
}
interface NativeEvidence {
  rows: {events: NativeSend[]}[];
  wireRows: {offset: number; bitCount: number; payload: string; decoded: number[][]}[];
}
const evidence: NativeEvidence = JSON.parse(readFileSync('recovery/output/role-ammo-producer-sol-native.json', 'utf8'));
const bits = (value: number): number => {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, true);
  return view.getUint32(0, true);
};
const actor: RoleEntityFireSnapshot = {
  field00: 0x11223344, field04: 2, xBits: bits(12.25), zBits: bits(-30),
  direction10: 540, direction14: 540, secondsBits: bits(123.456789),
  field1cBits: bits(2.5), field20Bits: bits(3.5),
};
const target: RoleEntityFireSnapshot = {
  field00: 0x55667788, field04: 2, xBits: bits(-25), zBits: bits(45),
  direction10: 540, direction14: 540, secondsBits: bits(123.456789),
  field1cBits: bits(5.5), field20Bits: bits(6.5),
};
const words = (snapshot: RoleEntityFireSnapshot): number[] => [snapshot.field00, snapshot.field04,
  snapshot.xBits, snapshot.zBits, snapshot.direction10, snapshot.direction14,
  snapshot.secondsBits, snapshot.field1cBits, snapshot.field20Bits];
assert.equal(ROLE_ENTITY_FIRE_MESSAGE_TYPE, 0x3a9d);
assert.equal(ROLE_ENTITY_FIRE_BODY_BITS, 352);

for (const row of evidence.rows) {
  const send = row.events.find(event => event.kind === 'send')!;
  const request = createRoleEntityFireRequest(91, actor, target);
  assert.equal(send.type, ROLE_ENTITY_FIRE_MESSAGE_TYPE);
  assert.equal(request.targetObjectId, send.targetId);
  assert.deepEqual(words(request.actor), send.actor);
  assert.deepEqual(words(request.target), send.target);
  assert.notEqual(request.actor, actor);
  assert.notEqual(request.target, target);
  for (const wire of evidence.wireRows) {
    assert.equal(Buffer.from(encodeRoleEntityFireRequest(request, wire.offset)).toString('hex'), wire.payload);
  }
}

const request = createRoleEntityFireRequest(91, actor, target);
for (const row of evidence.wireRows) {
  assert.equal(row.bitCount, ROLE_ENTITY_FIRE_BODY_BITS);
  const payload = Buffer.from(row.payload, 'hex');
  const decoded = decodeRoleEntityFireRequest(payload,
    {actorTailBits: [0xaaaaaaaa, 0xaaaaaaaa], targetTailBits: [0xaaaaaaaa, 0xaaaaaaaa]}, row.offset);
  assert.equal(decoded.targetObjectId, 91);
  assert.deepEqual([words(decoded.actor), words(decoded.target)], row.decoded);
  assert.equal(Buffer.from(encodeRoleEntityFireRequest(decoded, row.offset)).toString('hex'), row.payload);
  const retained = decodeRoleEntityFireRequest(payload,
    {actorTailBits: [actor.field1cBits, actor.field20Bits], targetTailBits: [target.field1cBits, target.field20Bits]}, row.offset);
  assert.equal(retained.actor.field1cBits, actor.field1cBits);
  assert.equal(retained.actor.field20Bits, actor.field20Bits);
  assert.equal(retained.target.field1cBits, target.field1cBits);
  assert.equal(retained.target.field20Bits, target.field20Bits);
  assert.equal(Buffer.from(encodeRoleEntityFireRequest(retained, row.offset)).toString('hex'), row.payload);
  assert.throws(() => decodeRoleEntityFireRequest(payload.subarray(0, payload.length - 1),
    {actorTailBits: [1, 2], targetTailBits: [3, 4]}, row.offset), /Incomplete/);
}
assert.deepEqual(words(request.actor), words(actor));
assert.deepEqual(words(request.target), words(target));
writeFileSync('recovery/output/role-entity-fire-sol.json', JSON.stringify({status: 'PASS',
  requestRows: evidence.rows.length, codecRows: evidence.wireRows.length,
  bodyBits: ROLE_ENTITY_FIRE_BODY_BITS, messageType: ROLE_ENTITY_FIRE_MESSAGE_TYPE,
  scope: 'Shared explicit two-snapshot request construction compared with every native entity send; original352-bit payloads/decode at eight offsets. Snapshot tail bits preserved explicitly, omitted from encoding. No server acceptance, projectile or ammo producer.'}, null, 2) + '\n');
console.log(`PASS: ${evidence.rows.length} native entity request bodies, ${evidence.wireRows.length}352-bit codecs and explicit retained tails`);
