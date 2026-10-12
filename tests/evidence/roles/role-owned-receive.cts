import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readOwnedRolePairMessage} from './role-owned-sources';
import {receiveRoleOwnedPair, type RoleOwnedSources} from '../../../apps/server/src/accounts/owned/receive-pair';
import {resolveRoleRecomputeSource} from '../../../apps/server/src/accounts/owned/source-selection';

const native: {rows: {base: number; equipment: number; resultBase: number;
  resultEquipment: number}[]} = JSON.parse(
  readFileSync('recovery/output/role-owned-receive-native.json', 'utf8'));
for (const row of native.rows) {
  const bases = new Map(native.rows.filter(value => value.base !== 0).map(value =>
    [value.base, {name: `base${value.base}`, fields: new Map<number, number>()}]));
  const equipment = new Map(native.rows.filter(value => value.equipment !== 0).map(value =>
    [value.equipment, {name: `equipment${value.equipment}`, fields: new Map<number, number>()}]));
  const owner = {base: bases.values().next().value, equipment: equipment.values().next().value};
  const message: RoleOwnedSources = {
    base: bases.get(row.base), equipment: equipment.get(row.equipment),
  };
  const originalMessage = {...message};
  receiveRoleOwnedPair(owner, message);
  assert.strictEqual(owner.base, bases.get(row.resultBase));
  assert.strictEqual(owner.equipment, equipment.get(row.resultEquipment));
  assert.deepEqual(message, originalMessage);
}

const pairs: {rows: {raw: number[]; alignment: number}[]} = JSON.parse(
  readFileSync('recovery/output/role-owned-pair-native.json', 'utf8'));
const owner: RoleOwnedSources = {base: undefined, equipment: undefined};
for (const row of pairs.rows) {
  const message = readOwnedRolePairMessage(new Uint8Array(row.raw), row.alignment,
    bytes => Buffer.from(bytes).toString('hex'));
  receiveRoleOwnedPair(owner, message);
  for (const stage of [3, 4]) {
    const unexpectedLookup = (): never => {throw new Error('Battle source must use received reference');};
    assert.strictEqual(resolveRoleRecomputeSource(stage, owner.base, 73, unexpectedLookup), message.base);
    assert.strictEqual(resolveRoleRecomputeSource(stage, owner.equipment, 74, unexpectedLookup), message.equipment);
  }
}
console.log(`PASS: ${native.rows.length} paired callback cases and ${pairs.rows.length} parsed messages to battle source getters`);
