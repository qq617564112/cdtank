import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoleBeforeShotNotify, createRoleShotNotify, decodeRoleBeforeShotNotify,
  decodeRoleShotNotify, encodeRoleBeforeShotNotify, encodeRoleShotNotify,
  ROLE_BEFORE_SHOT_NOTIFY_TYPE, ROLE_SHOT_NOTIFY_TYPE} from '../recovery/evidence/combat/role-shot-notify';
const evidence = JSON.parse(readFileSync('recovery/output/projectile-sol-shot-wire-native.json', 'utf8')) as {
  factories: Array<{kind: string; type: number}>;
  rows: Array<{kind: string; roleId: number; itemId: number; xyz: number[]; offset: number; payload: string; decodedItemId: number}>;
};
assert.deepEqual(createRoleBeforeShotNotify(), {});
assert.deepEqual(createRoleShotNotify(), {x: 0, y: 0, z: 0});
for (const factory of evidence.factories) {
  assert.equal(factory.type, factory.kind === 'beforeShot' ? ROLE_BEFORE_SHOT_NOTIFY_TYPE : ROLE_SHOT_NOTIFY_TYPE);
}
for (const row of evidence.rows) {
  const message = {roleId: row.roleId, itemId: row.itemId, x: row.xyz[0], y: row.xyz[1], z: row.xyz[2]};
  const bytes = row.kind === 'beforeShot' ? encodeRoleBeforeShotNotify(message, row.offset) : encodeRoleShotNotify(message, row.offset);
  assert.equal(Buffer.from(bytes).toString('hex'), row.payload);
  if (row.kind === 'beforeShot') {
    assert.deepEqual(decodeRoleBeforeShotNotify(bytes, row.offset), {roleId: row.roleId});
  } else {
    assert.deepEqual(decodeRoleShotNotify(bytes, row.offset), {...message, itemId: row.decodedItemId});
  }
}
assert.throws(() => decodeRoleShotNotify(new Uint8Array(17)), RangeError);
assert.throws(() => decodeRoleBeforeShotNotify(new Uint8Array(3)), RangeError);
console.log(`PASS: ${evidence.rows.length} native shot/before-shot byte contracts; factory identifiers remain absent`);
