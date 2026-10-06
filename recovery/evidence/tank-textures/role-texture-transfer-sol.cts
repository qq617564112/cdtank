import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyRoleTankTextureConfirmation} from '../../../apps/server/src/accounts/tank-texture-change';
import {readRoleTankTextureConfirmation, writeRoleTankTextureRequest} from './role-texture-transfer-sol';
import {readOwnedTankTextures} from '../../../apps/shared/combat/role-owned-textures';

const native = JSON.parse(readFileSync('recovery/output/role-texture-transfer-sol-native.json', 'utf8'));
for (const row of native.codecs) {
  let bit = row.startBit;
  const output = new Uint8Array(row.requestBytes.length);
  writeRoleTankTextureRequest({unsigned(value, width) {
    for (let index = 0; index < width; index++, bit++) {
      output[bit >>> 3] |= ((value >>> index) & 1) << (bit & 7);
    }
  }}, row.instanceId, {U: row.textures[0], M: row.textures[1], XY: row.textures[2]});
  assert.deepEqual([...output], row.requestBytes);
  bit = row.startBit;
  const parsed = readRoleTankTextureConfirmation({unsigned(width) {
    let value = 0;
    for (let index = 0; index < width; index++, bit++) {
      value += ((row.responseBytes[bit >>> 3] >>> (bit & 7)) & 1) * 2 ** index;
    }
    return value;
  }});
  assert.deepEqual(parsed, {instanceId: row.instanceId,
    textures: {U: row.textures[0], M: row.textures[1], XY: row.textures[2]},
    tokens: 1234, money: 5678, result: 3});
}
for (const row of native.confirmations) {
  const fields = new Map([[0x1c, row.instanceId], [0x24, 1], [0x28, 71], [0x2c, 72], [0x30, 73]]);
  const records = new Map(row.ownedFound ? [[row.instanceId, {fields, name: 'owned'}]] : []);
  const profile = new Map([[0x74, 100], [0x70, 200], [0x118, 900]]);
  const events: unknown[] = [];
  applyRoleTankTextureConfirmation(row.phase, records, profile, {
    instanceId: row.instanceId,
    textures: {U: row.incomingTextures[0], M: row.incomingTextures[1], XY: row.incomingTextures[2]},
    tokens: 1234, money: 5678, result: row.result,
  }, row.callback ? result => events.push({result,
    textures: records.has(row.instanceId) ? Object.values(readOwnedTankTextures(records.get(row.instanceId)!)!) : [71, 72, 73],
    balances: [profile.get(0x74), profile.get(0x70)]}) : undefined);
  assert.deepEqual(events, row.events);
  assert.deepEqual([profile.get(0x74), profile.get(0x70)], row.balances);
  assert.equal(profile.get(0x118), 900);
  if (row.ownedFound) {
    assert.deepEqual(Object.values(readOwnedTankTextures(records.get(row.instanceId)!)!), row.textures);
    assert.equal(records.get(row.instanceId)!.fields.get(0x24), 1);
    assert.equal(records.get(row.instanceId)!.name, 'owned');
  }
}
console.log(`PASS: ${native.codecs.length} native texture wire cases, ${native.confirmations.length} native confirmed mutations`);
